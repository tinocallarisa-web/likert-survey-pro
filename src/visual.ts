/*
 *  Likert Survey Pro — TCViz
 *
 *  Barras apiladas divergentes para datos de encuesta, centradas en la respuesta neutra.
 *  Sin acceso a red, sin almacenamiento y sin innerHTML: privileges es [] y nada sale
 *  del informe. Ver docs/CERTIFICATION-NOTES.md.
 */
"use strict";

import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import {
    HtmlSubSelectableClass, HtmlSubSelectionHelper, SubSelectableDisplayNameAttribute,
    SubSelectableObjectNameAttribute, SubSelectableTypeAttribute,
} from "powerbi-visuals-utils-onobjectutils";

import DataView = powerbi.DataView;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import {
    LikertSettings, LikertFormattingModel, toSettings, defaultSettings, freeSettings,
    makeBlockColorSlice, PRO_PLAN_IDS, matchesPlan, FREE_MAX_RESPONSES, PREVIEW_PANELS,
    AUTO_MAX_BAR, PRO_STYLES
} from "./settings";
import { createProWatermark, renderProWatermark } from "./comun/watermark";
import { styleSeriesColor } from "./comun/paleta";
import { STRINGS } from "./strings";
import { LANDING_ICON } from "./landingIcon";

const SVG_NS = "http://www.w3.org/2000/svg";
/** ServicePlanState: Active = 1, Warning = 2 (periodo de gracia: ya pagó). */
const STATE_ACTIVE = 1;
const STATE_WARNING = 2;
/** Marca de la build de prueba: build-test.js la rellena; en producción queda vacía y no se pinta. */
const TEST_STAMP = ""; // TEST_STAMP_MARKER

/** Enlaces de la pantalla de inicio. ?ref= cuenta en la web las visitas que llegan desde el visual. */
const URL_GUIDE = "https://tinocallarisa-web.github.io/likert-survey-pro/support.html";
const URL_PRODUCT = "https://tcviz.com/product/likert-survey-pro/?ref=visual-likert";
const URL_VIDEO = "https://www.youtube.com/watch?v=SzSs3gFReaY";

/**
 * Los seis estilos de la colección, con los mismos tokens que Treemap, KPI Card, Pareto, Line Chart e
 * Histogram (copiados tal cual del Treemap): una página en Boardroom se ve como un solo informe.
 */
interface StyleTokens { bg: string; text: string; axis: string; grid: string; plan: string; up: string; down: string; series: string[]; font?: string; grad?: string; }
const STYLE_TOKENS: Record<string, StyleTokens> = {
    boardroom: { bg: "#16263D", text: "#F2F0E8", axis: "#9FB0C6", grid: "#2A3E5C", plan: "#6FCF97", up: "#6FCF97", down: "#EB8A7B", series: ["#C9A45C", "#8FB8E8", "#EB8A7B", "#6FCF97", "#C5D3E3"] },
    ledger: { bg: "#FBF8EF", text: "#231F16", axis: "#6E6652", grid: "#D9D2BE", plan: "#946A10", up: "#2F6B3B", down: "#A32A2A", series: ["#7A1F1F", "#3A3528", "#2F6B3B", "#946A10", "#B7AD92"], font: "Georgia, serif" },
    editorial: { bg: "#FFFFFF", text: "#111111", axis: "#5F5F5F", grid: "#E2E2E2", plan: "#111111", up: "#111111", down: "#D7263D", series: ["#D7263D", "#111111", "#5F5F5F", "#BDBDBD", "#8C1C2B"], font: "Georgia, serif" },
    signal: { bg: "#FFFFFF", text: "#14202B", axis: "#566472", grid: "#D9DEE4", plan: "#B7791F", up: "#1F7A4D", down: "#C0392B", series: ["#1F7A4D", "#14202B", "#B7791F", "#C0392B", "#9AA5B1"] },
    aurora: { bg: "#10395E", text: "#FFFFFF", axis: "#C5D3E3", grid: "#3A5C7E", plan: "#FFD27D", up: "#7CE7D0", down: "#FF9DB0", series: ["#7CE7D0", "#FFD27D", "#FF9DB0", "#9DB7FF", "#C5D3E3"], grad: "linear-gradient(135deg, #1B1147, #10395E 50%, #0B5A5E)" },
    terrace: { bg: "#FBF5EC", text: "#3A2A1E", axis: "#7A6450", grid: "#E5D6C2", plan: "#5E7128", up: "#5E7128", down: "#B5372A", series: ["#B5532A", "#5E7128", "#B5782A", "#B5372A", "#C9A77E"] },
};

interface ProFeature { id: string; label: string; }

interface Segment {
    responseIndex: number;
    label: string;
    value: number;
    share: number;        // 0..1 sobre el total de la pregunta
    color: string;
    /** TODAS las filas que suma este tramo (paneles agregados en Free, drilldown expandido). */
    ids: ISelectionId[];
    key: string;
    fmt: string | undefined;
    tooltip: VisualTooltipDataItem[];
    highlighted: boolean;
}

interface QuestionRow {
    key: string;
    /** Clave sin el panel: la misma pregunta en todos los paneles. */
    qKey: string;
    question: string;
    group: string | null;
    panel: string | null;
    total: number;
    segments: Segment[];
    negShare: number;     // parte que queda a la izquierda del centro
    posShare: number;
    topBox: number;
    bottomBox: number;
    /** Puntuacion media de la pregunta sobre la escala. */
    mean: number;
    ids: ISelectionId[];
    /** Identidad del BLOQUE, para el color por bloque y su regla. */
    groupSelectionId: ISelectionId | null;
    /** Color del bloque puesto a mano o por regla; null = el del tema o el estilo. */
    groupColor: string | null;
}

interface Geom {
    blockW: number; qW: number; leftW: number; barLeft: number; barW: number; centre: number;
    boxColW: number; pillW: number; showBoxes: boolean; showNps: boolean; showLeft: boolean;
}

/** Tamaño mínimo de texto de la tarjeta Accessibility: lo aplica text() a todo lo que escribe. */
let minText = 8;

export class Visual implements IVisual {
    private host: IVisualHost;
    private root: HTMLElement;
    private svg: SVGSVGElement;
    /** El area que se desplaza. Leyenda, ejes y títulos viven fuera para no irse con el scroll. */
    private scrollHost: HTMLDivElement;
    private topHost: HTMLDivElement;
    private topSvg: SVGSVGElement;
    private bottomHost: HTMLDivElement;
    private bottomSvg: SVGSVGElement;
    private landingEl: HTMLDivElement;
    private noteEl: HTMLDivElement;
    private guideEl: HTMLDivElement;
    private stampEl: HTMLDivElement;
    private watermarkEl: HTMLDivElement;
    private events: IVisualEventService;
    private selectionManager: ISelectionManager;
    private licenseManager: any;

    private isPro: boolean = false; // ISPRO_MARKER — build-test.js lo parchea; nunca a mano
    private licenseRequested = false;
    private licenseResolved = false;
    private licenseEnvSupported = true;
    private licenseInfoAvailable = true;
    private notifiedPro: string[] = [];
    private licenseIconTimer: number | null = null;
    private noticeShown = false;
    private attemptedPro: ProFeature[] = [];
    /** Vista previa Pro: Free, editando, con la licencia resuelta y legible. */
    private proPreview = false;
    private editing = false;
    private destroyed = false;

    private settings: LikertSettings = JSON.parse(JSON.stringify(defaultSettings));
    private rawSettings: LikertSettings = JSON.parse(JSON.stringify(defaultSettings));
    private formattingService: FormattingSettingsService;
    private formattingModel: LikertFormattingModel = new LikertFormattingModel();
    private localization: powerbi.extensibility.ILocalizationManager;
    private lastOptions: VisualUpdateOptions | null = null;
    private lastDv: DataView | undefined;
    private hasData = false;
    private rows: QuestionRow[] = [];
    private rowMap = new Map<string, QuestionRow>();
    /** Preguntas en orden de dibujo (bloque, aparición): las comparten todos los paneles. */
    private qOrder: string[] = [];
    private panels: (string | null)[] = [null];
    private questionName = "";
    private responseLabels: string[] = [];
    private responseColors: string[] = [];
    private responseIds: ISelectionId[] = [];
    /** Bloques presentes, para emitir un selector de color por cada uno. */
    private blocks: Array<{ name: string; sid: ISelectionId | null; color: string;
                            mean: number; positive: number; nps: number }> = [];
    /** Puntuacion numerica de cada punto de escala: la del pozo, o su posicion. */
    private responseScores: number[] = [];
    private negN = 0;
    private neutralIdx = -1;
    private focusIndex = -1;
    private hiddenRows = 0;
    private fmtCache = new Map<string, IValueFormatterLike>();

    /** Selección hecha con clics en este visual: unidad (tramo, pregunta o respuesta) → identidades. */
    private selUnits = new Map<string, ISelectionId[]>();
    /** Selección que llega de fuera (marcador): se pinta casando identidades. */
    private restoredIds: ISelectionId[] = [];
    private keySeq = 0;

    /** Formato desde el lienzo (on-object): el clic selecciona qué formatear, no filtra datos. */
    public visualOnObjectFormatting: powerbi.extensibility.visual.VisualOnObjectFormatting;
    private subSelectionHelper: HtmlSubSelectionHelper;
    private formatMode = false;
    private guideStep = 1;

    /** Filas por bloques: Power BI entrega 1.000 cada vez; el visual pide las siguientes. */
    private lastFetchCount = 0;
    private fetchRounds = 0;
    private truncatedAt = 0;
    private readonly MAX_FETCH_ROUNDS = 20;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.selectionManager = options.host.createSelectionManager();
        this.licenseManager = (options.host as any).licenseManager;
        this.localization = options.host.createLocalizationManager();
        this.formattingService = new FormattingSettingsService(this.localization);

        this.root = document.createElement("div");
        this.root.className = "likert-survey-pro";
        options.element.appendChild(this.root);

        // Bandas fijas arriba y abajo (leyenda, título del eje de categorías, eje de valores) y el
        // gráfico desplazable en medio. Si la leyenda se fuera con el scroll, el usuario perderia la
        // referencia de colores justo al mirar las filas de abajo, que es cuando mas la necesita.
        this.topHost = document.createElement("div");
        this.topHost.className = "lk-band";
        this.topHost.style.top = "0px";
        this.topSvg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
        this.topHost.appendChild(this.topSvg);
        this.root.appendChild(this.topHost);

        this.scrollHost = document.createElement("div");
        this.scrollHost.className = "lk-scroll";
        this.root.appendChild(this.scrollHost);
        this.svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
        this.svg.style.display = "block";
        this.scrollHost.appendChild(this.svg);

        this.bottomHost = document.createElement("div");
        this.bottomHost.className = "lk-band";
        this.bottomSvg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
        this.bottomHost.appendChild(this.bottomSvg);
        this.root.appendChild(this.bottomHost);

        this.landingEl = document.createElement("div");
        this.landingEl.className = "lk-landing";
        this.root.appendChild(this.landingEl);
        this.noteEl = document.createElement("div");
        this.noteEl.className = "lk-note";
        this.root.appendChild(this.noteEl);
        this.watermarkEl = createProWatermark(this.root);
        this.guideEl = document.createElement("div");
        this.guideEl.className = "lk-guide";
        this.root.appendChild(this.guideEl);
        this.stampEl = document.createElement("div");
        this.stampEl.className = "lk-stamp";
        this.stampEl.textContent = TEST_STAMP;
        this.stampEl.style.display = TEST_STAMP ? "block" : "none";
        this.root.appendChild(this.stampEl);

        this.subSelectionHelper = HtmlSubSelectionHelper.createHtmlSubselectionHelper({
            hostElement: options.element,
            subSelectionService: options.host.subSelectionService,
            selectionIdCallback: () => undefined,
        });
        this.visualOnObjectFormatting = {
            getSubSelectionStyles: (subs) => this.getSubSelectionStyles(subs),
            getSubSelectionShortcuts: (subs) => this.getSubSelectionShortcuts(subs),
            getSubSelectables: (filter) => this.subSelectionHelper.getAllSubSelectables(filter),
        };

        const onContext = (e: MouseEvent) => {
            e.preventDefault();
            if (!this.canInteract) { return; }
            const seg = (e.target as Element)?.closest?.("[data-seg]") as any;
            const ids: ISelectionId[] = seg?.__seg?.ids ?? [];
            this.selectionManager.showContextMenu(ids.length ? ids[0] : ({} as ISelectionId), { x: e.clientX, y: e.clientY });
        };
        this.svg.addEventListener("contextmenu", onContext);
        this.svg.addEventListener("click", (e: MouseEvent) => this.onClick(e));
        this.topSvg.addEventListener("click", (e: MouseEvent) => this.onClick(e));
        this.bottomSvg.addEventListener("click", (e: MouseEvent) => this.onClick(e));
        this.root.addEventListener("keydown", (e: KeyboardEvent) => this.onKeyDown(e));
        // Marcadores y selección hecha desde fuera: SOLO repintar. Nunca persistProperties aquí:
        // Power BI descarta la selección restaurada (Org Chart, 11-10-2026).
        this.selectionManager.registerOnSelectCallback((ids: ISelectionId[]) => {
            this.selUnits = new Map();
            this.restoredIds = ids || [];
            this.paintSelection();
        });
    }

    public destroy(): void {
        this.destroyed = true;
        this.cancelLicenseIcon();
    }

    /** allowInteractions vive en hostCapabilities (API 5.x); IVisualHost no lo tiene. */
    private get canInteract(): boolean {
        const h: any = this.host;
        return (h.hostCapabilities?.allowInteractions ?? h.allowInteractions) !== false;
    }

    private get isDesktop(): boolean {
        const env = Number((this.host as any)?.hostEnv);
        return isFinite(env) && env > 0 ? (env & 4) !== 0 : false;
    }

    private get culture(): string { return (this.host as any).locale; }

    // ── Textos ────────────────────────────────────────────────────────────────

    /**
     * Primero la tabla del bundle (src/strings.ts): Power BI Desktop solo traduce con getDisplayName
     * las claves declaradas en capabilities.json, y los textos propios del visual no lo están.
     */
    private t(key: string, fallback: string): string {
        const own = this.stringsFor()?.[key];
        if (own) { return own; }
        try { const v = this.localization.getDisplayName(key); return v && v !== key ? v : fallback; } catch { return fallback; }
    }

    private stringsFor(): Record<string, string> | undefined {
        const loc = String((this.host as any)?.locale || "");
        if (!loc || /^en/i.test(loc)) { return undefined; }
        if (STRINGS[loc]) { return STRINGS[loc]; }
        const lang = loc.split("-")[0].toLowerCase();
        const k = Object.keys(STRINGS).sort().find(x => x.toLowerCase().startsWith(lang + "-"));
        return k ? STRINGS[k] : undefined;
    }

    // ── Licencia ──────────────────────────────────────────────────────────────

    /** La licencia nunca en el camino crítico del render. */
    private requestLicenseDeferred(): void {
        if (this.licenseRequested || this.isPro) { return; }
        this.licenseRequested = true;
        window.setTimeout(() => {
            try {
                const lm = this.licenseManager;
                if (!lm) { this.licenseResolved = true; this.licenseEnvSupported = false; this.afterLicense(); return; }
                lm.getAvailableServicePlans().then(
                    (r: any) => {
                        this.licenseEnvSupported = !r?.isLicenseUnsupportedEnv;
                        this.licenseInfoAvailable = r?.isLicenseInfoAvailable !== false;
                        this.isPro = !!(r?.plans?.some((p: any) =>
                            PRO_PLAN_IDS.some(id => matchesPlan(p.spIdentifier, id)) &&
                            ((p.state as unknown as number) === STATE_ACTIVE ||
                             (p.state as unknown as number) === STATE_WARNING)));
                        this.licenseResolved = true;
                        this.afterLicense();
                    },
                    () => {
                        // Licencia ilegible: Free, pero SIN avisos. No sabemos si ya pagó.
                        this.licenseInfoAvailable = false;
                        this.licenseResolved = true;
                        this.afterLicense();
                    }
                );
            } catch (_) {
                this.licenseInfoAvailable = false;
                this.licenseResolved = true;
                this.afterLicense();
            }
        }, 0);
    }

    /**
     * La licencia responde DESPUÉS del primer render, cuando proPreview todavía era false
     * y los ajustes se resolvieron como Free. Sin repintar aquí, el autor se queda con el
     * resultado gratuito hasta que toca cualquier ajuste.
     */
    private afterLicense(): void {
        // Repintado INTERNO: no emite eventos de render. Cada update() de Power BI tiene que
        // emitir exactamente un renderingStarted y un renderingFinished/Failed (rechazo
        // 1200.1.2 de Microsoft, 02-10-2026: esta llamada duplicaba el par de eventos).
        if (this.lastOptions && !this.destroyed) { this.run(this.lastOptions, false); }
    }

    private computePreview(): boolean {
        return !this.isPro && this.editing && this.licenseResolved
            && this.licenseEnvSupported && this.licenseInfoAvailable;
    }

    private get proActive(): boolean { return this.isPro || this.proPreview; }

    private cancelLicenseIcon(): void {
        if (this.licenseIconTimer !== null) {
            window.clearTimeout(this.licenseIconTimer);
            this.licenseIconTimer = null;
        }
    }

    /**
     * Power BI muestra UNA notificación a la vez y la última sustituye a la anterior, así
     * que llamar a notifyFeatureBlocked y notifyLicenseRequired seguidos deja solo una
     * visible. Secuencia: retirar lo anterior, banner con la función concreta, y al
     * terminar (~10 s) la barra de Upgrade persistente.
     */
    private syncLicenseNotification(): void {
        const lm = this.licenseManager;
        if (!lm) { return; }
        try {
            if (this.isPro || this.attemptedPro.length === 0) {
                this.cancelLicenseIcon();
                if (this.noticeShown) {
                    this.noticeShown = false;
                    this.notifiedPro = [];
                    lm.clearLicenseNotification?.();
                }
                return;
            }
            if (!this.licenseResolved || !this.licenseEnvSupported || !this.licenseInfoAvailable) { return; }

            const ids = this.attemptedPro.map(a => a.id);
            const added = this.attemptedPro.filter(a => this.notifiedPro.indexOf(a.id) === -1);
            this.notifiedPro = ids;
            if (added.length === 0) { return; }
            this.noticeShown = true;

            const one = added.length === 1;
            const and = this.t("UI_And", "and");
            const list = one ? added[0].label
                : added.slice(0, -1).map(a => a.label).join(", ") + " " + and + " " + added[added.length - 1].label;
            const tpl = one
                ? this.t("UI_NoticeOne", "Likert Survey Pro: {0} is part of the Pro plan, shown as a watermarked preview.")
                : this.t("UI_NoticeMany", "Likert Survey Pro: {0} are part of the Pro plan, shown as a watermarked preview.");
            const msg = tpl.replace("{0}", list);

            const show = () => {
                try { lm.notifyFeatureBlocked?.(msg.slice(0, 500)); } catch (_) { /* best effort */ }
                this.cancelLicenseIcon();
                this.licenseIconTimer = window.setTimeout(() => {
                    this.licenseIconTimer = null;
                    if (this.destroyed || this.isPro || this.notifiedPro.length === 0) { return; }
                    // LicenseNotificationType.General es const enum: 0 en runtime.
                    try { lm.notifyLicenseRequired?.(0); } catch (_) { /* best effort */ }
                }, 10500);
            };
            const cleared = lm.clearLicenseNotification?.();
            if (cleared && typeof cleared.then === "function") { cleared.then(show, show); }
            else { show(); }
        } catch (_) { /* nunca romper el render por un aviso */ }
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public update(options: VisualUpdateOptions): void {
        this.run(options, true);
    }

    /**
     * Cuerpo del render. emit=true solo desde update(): ahi se emite el par de eventos que
     * Power BI espera, exactamente uno por llamada. Los repintados internos (licencia
     * resuelta, guía, zoom) pasan emit=false.
     */
    private run(options: VisualUpdateOptions, emit: boolean): void {
        if (emit) { this.events.renderingStarted(options); }
        try {
            this.lastOptions = options;
            const dv = options.dataViews?.[0];
            this.lastDv = dv;
            const w = Math.max(options.viewport.width, 1);
            const h = Math.max(options.viewport.height, 1);

            const viewMode = (options as any).viewMode;
            this.editing = typeof viewMode === "number" && viewMode !== 0;
            this.proPreview = this.computePreview();
            this.formatMode = !!(options as any).formatMode;
            this.subSelectionHelper.setFormatMode(this.formatMode);

            if (emit && dv && this.streamSegments(options, dv)) {
                // Se ha pedido el siguiente bloque: Power BI volverá a llamar a update() con todo junto.
                this.events.renderingFinished(options);
                return;
            }

            this.formattingModel = this.formattingService.populateFormattingSettingsModel(LikertFormattingModel, dv);
            this.rawSettings = toSettings(this.formattingModel);
            this.settings = this.proActive ? this.rawSettings : freeSettings(this.rawSettings);
            minText = this.rawSettings.accessibility.minTextSize;

            this.hasData = !!(dv?.categorical?.categories?.length && dv.categorical.values?.length);
            this.applyChrome();
            if (!this.hasData) {
                this.attemptedPro = [];
                this.proPreview = false;
                renderProWatermark(this.watermarkEl, null);
                this.renderLanding(w, h);
                this.guideEl.style.display = "none";
                this.noteEl.style.display = "none";
                this.warnings();
                this.requestLicenseDeferred();
                if (emit) { this.events.renderingFinished(options); }
                return;
            }
            this.landingEl.style.display = "none";

            this.buildRows(dv);
            this.computeAttemptedPro(dv);
            this.render(w, h);
            this.paintSelection();
            this.renderGuide(w, h);
            this.updateOutlines(options);

            this.requestLicenseDeferred();
            this.syncLicenseNotification();
            this.renderWatermark(w, h);
            this.warnings();

            if (emit) { this.events.renderingFinished(options); }
        } catch (e) {
            if (emit) { this.events.renderingFailed(options, String(e)); }
        }
    }

    /** Fetch More Data: el mapeo entrega las filas por ventanas; se piden las siguientes (no en Desktop). */
    private streamSegments(options: VisualUpdateOptions, dv: DataView): boolean {
        const op = (options as any).operationKind;
        if (op !== 1 && op !== 2) { this.lastFetchCount = 0; this.fetchRounds = 0; }
        this.truncatedAt = 0;
        if (!dv.metadata?.segment) { return false; }
        const loaded = dv.categorical?.categories?.[0]?.values?.length ?? 0;
        if (!this.isDesktop && loaded > this.lastFetchCount && this.fetchRounds < this.MAX_FETCH_ROUNDS) {
            this.lastFetchCount = loaded;
            this.fetchRounds++;
            if (this.host.fetchMoreData(true)) { return true; }
        }
        this.truncatedAt = loaded;
        return false;
    }

    /** Lo que el usuario ha pedido y el tier gratuito no da. Se calcula ANTES de apagarlo. */
    private computeAttemptedPro(dv: DataView): void {
        const raw = this.rawSettings;
        const w: ProFeature[] = [];
        const add = (on: boolean, id: string, key: string, fb: string) => { if (on) { w.push({ id, label: this.t(key, fb) }); } };
        add(raw.boxes.show, "boxes", "Feat_boxes", "Top/Bottom box");
        add(raw.boxes.showNps, "nps", "Feat_nps", "NPS");
        add(raw.benchmark.show, "benchmark", "Feat_benchmark", "the benchmark line");
        const cats = dv.categorical?.categories ?? [];
        add(cats.some(c => c.source.roles?.["group"]) || cats.filter(c => c.source.roles?.["question"]).length >= 2,
            "groups", "Feat_groups", "question groups");
        add(!!dv.categorical?.categories?.some(c => c.source.roles?.["panel"]), "panel", "Feat_panel", "small multiples");
        add(PRO_STYLES.indexOf(raw.style.template) >= 0, "style", "Feat_style", "the collection styles");
        this.attemptedPro = this.isPro ? [] : w;
    }

    // ── Estilo: Report theme o uno de los seis de la colección ────────────────

    private look: StyleTokens | null = null;

    private hc(): { on: boolean; fg: string; bg: string; sel: string } {
        const p: any = (this.host as any).colorPalette;
        const sys = !!p?.isHighContrast;
        const on = sys || this.rawSettings.accessibility.highContrast === "on";
        return { on, fg: sys ? (p?.foreground?.value || "#000000") : "#000000",
            bg: sys ? (p?.background?.value || "#FFFFFF") : "#FFFFFF",
            sel: sys ? (p?.foregroundSelected?.value || p?.foreground?.value || "#000000") : "#000000" };
    }

    /** El usuario ha escrito este ajuste (no es el valor por defecto). */
    private isSet(obj: string, prop: string): boolean {
        const v = this.lastDv?.metadata?.objects?.[obj]?.[prop];
        return v !== undefined && v !== null;
    }

    /**
     * Color de un ajuste: el que puso el usuario; si no, el del estilo de la colección; si no (Report
     * theme), el del tema del informe o el valor por defecto. En alto contraste, siempre el del sistema.
     */
    private pick(obj: string, prop: string, value: string, token: string | undefined, theme?: string): string {
        if (this.isSet(obj, prop) && value) { return value; }
        if (this.look && token) { return token; }
        return theme || value;
    }

    /** Tinta de texto: la del estilo, o la del tema del informe. */
    private ink(obj: string, prop: string, value: string): string {
        const h = this.hc();
        if (h.on) { return h.fg; }
        const p: any = (this.host as any).colorPalette;
        return this.pick(obj, prop, value, this.look?.text, p?.foreground?.value);
    }

    private dimInk(): string {
        const h = this.hc();
        if (h.on) { return h.fg; }
        const p: any = (this.host as any).colorPalette;
        return this.look?.axis ?? p?.foregroundNeutralSecondary?.value ?? "#4C566A";
    }

    /** Fondo, fuente y variables del foco: lo que no depende del dato. */
    private applyChrome(): void {
        const s = this.settings;
        const h = this.hc();
        this.look = !h.on && this.hasData && PRO_STYLES.indexOf(s.style.template) >= 0 ? STYLE_TOKENS[s.style.template] : null;
        const look = this.look;
        this.root.style.background = h.on ? h.bg : (look ? (look.grad ?? look.bg) : (s.background.color || "transparent"));
        this.root.style.setProperty("--lk-focus", h.on ? h.sel : s.accessibility.focusColor);
        this.root.style.setProperty("--lk-focus-w", s.accessibility.focusWidth + "px");
        this.subSelectable(this.root, "background", this.t("Obj_Background", "Background"), powerbi.visuals.SubSelectionStylesType.Shape);
    }

    // ── Datos ─────────────────────────────────────────────────────────────────

    private name(v: any): string {
        return (v === null || v === undefined || v === "") ? this.t("UI_Blank", "(Blank)")
            : (v instanceof Date ? v.toLocaleDateString(this.culture) : String(v));
    }

    private num(v: any): number | null {
        if (v === null || v === undefined || v === "") { return null; }
        const n = Number(v);
        return isFinite(n) ? n : null;
    }

    private formatOf(col: any): string | undefined {
        try { return valueFormatter.getFormatStringByColumn(col?.source as any) || col?.source?.format; } catch { return col?.source?.format; }
    }

    /** Formato con caché por cadena: el formato dinámico (F11) puede cambiar fila a fila. */
    private fmt(v: number, format: string | undefined): string {
        const key = format || "";
        let f = this.fmtCache.get(key);
        if (!f) {
            try {
                const vf = valueFormatter.create({ format: format || undefined, cultureSelector: this.culture } as any);
                f = { format: (x: number) => vf.format(x) };
            } catch { f = { format: (x: number) => String(Math.round(x * 100) / 100) }; }
            if (this.fmtCache.size > 200) { this.fmtCache.clear(); }
            this.fmtCache.set(key, f);
        }
        return f.format(v);
    }

    private pct(v: number, decimals: number): string {
        return `${(v * 100).toFixed(decimals)}%`;
    }

    private buildRows(dv: DataView): void {
        const cat = dv.categorical;
        let qCols = cat.categories.filter(c => c.source.roles?.["question"]);
        if (!qCols.length) { qCols = [cat.categories[0]]; }
        const gCol = cat.categories.find(c => c.source.roles?.["group"]);
        const pCol = cat.categories.find(c => c.source.roles?.["panel"]);
        const groups = this.sortByScaleOrder(cat.values.grouped ? cat.values.grouped() : []);
        const proNow = this.proActive;
        const s = this.settings;
        // Niveles de Question (drilldown expandido o varios campos) como en la 1.0: con dos o más, el
        // último es la pregunta y el penúltimo el bloque (si no hay campo en Group). Bajando un nivel
        // Power BI manda solo el de abajo: no hay bloque y no se inventa.
        const qLabelCols = qCols.length >= 2 ? [qCols[qCols.length - 1]] : qCols;
        const bCol = gCol ?? (qCols.length >= 2 ? qCols[qCols.length - 2] : undefined);
        const blockPrefix = gCol ? qCols.slice(0, -1) : qCols.slice(0, -2);
        this.questionName = qLabelCols.map(c => c.source.displayName).join(" · ");

        // Orden de la escala: el de los grupos, que sigue la ordenación del modelo.
        const kept = groups.slice(0, FREE_MAX_RESPONSES);
        this.responseLabels = kept.map(g => this.name(g.name));
        // La puntuacion sale del pozo Scale order cuando es UN número por punto de escala; si no, de
        // la posicion (1, 2, 3…). En la 1.0 se tomaba el valor de la primera fila: con Scale order en
        // "Suma" ese valor es código × respuestas de la primera pregunta, y la media cambiaba con el
        // orden de las filas (46,6 en un informe, 178,6 al expandir la jerarquía). Ver orderInfo().
        const info = this.orderInfo(kept);
        this.responseScores = kept.map((_, i) => info.reliable ? info.ranks[i] as number : i + 1);
        this.responseColors = this.scaleColors(kept);
        this.responseIds = kept.map(g => this.host.createSelectionIdBuilder()
            .withSeries(cat.values, g).createSelectionId());

        const n = qCols[0].values.length;
        const negN = Math.max(0, Math.min(s.scale.negativeCount, kept.length));
        const neutralIdx = s.scale.neutralMode === "split" ? negN : -1;
        this.negN = negN; this.neutralIdx = neutralIdx;
        // "Leave out of the bar" solo cuando hay un punto central (escala impar con tantos
        // negativos como positivos). En la 1.0.0.1 esta opción no quitaba nada (comparaba con
        // el índice del modo "split", que en este modo es -1).
        const excludeIdx = s.scale.neutralMode === "exclude" && kept.length === 2 * negN + 1 ? negN : -1;
        const valueCol = (g: any): any => (g.values as any[]).find(v => v?.source?.roles?.value) ?? g.values[0];
        const hasHl = kept.some(g => valueCol(g)?.highlights != null);
        const allCats = cat.categories;

        // Una fila por pregunta (× bloque × panel). Sin small multiples, los paneles se SUMAN:
        // el resultado gratuito es correcto, con todas las identidades de cada tramo.
        interface Acc { row: QuestionRow; v: number[]; ids: ISelectionId[][]; hl: boolean[]; fmt: (string | undefined)[];
                        tips: Map<string, { num: number | null; txt: string; fmt: string | undefined }>[] }
        const accs = new Map<string, Acc>();
        const order: Acc[] = [];
        for (let i = 0; i < n; i++) {
            const question = qLabelCols.map(c => this.name(c.values[i])).join(" · ");
            // El bloque sale del pozo Group o, sin él, del penúltimo nivel de Question; los niveles
            // de arriba se anteponen ("Año · Bloque"). Sin Pro no se dibuja, pero sigue en la clave:
            // dos preguntas con el mismo texto en bloques distintos no se suman.
            const blockName = bCol ? [...blockPrefix, bCol].map(c => this.name(c.values[i])).join(" · ") : "";
            const group = bCol && proNow ? blockName : null;
            const panel = pCol && proNow ? this.name(pCol.values[i]) : null;
            const qKey = blockName + "\u0001" + question;
            const key = (panel ?? "") + "\u0002" + qKey;
            let a = accs.get(key);
            if (!a) {
                a = {
                    row: {
                        key, qKey, question, group, panel, total: 0, segments: [], negShare: 0, posShare: 0,
                        topBox: 0, bottomBox: 0, mean: 0, ids: [],
                        groupSelectionId: bCol ? this.host.createSelectionIdBuilder().withCategory(bCol, i).createSelectionId() : null,
                        // El color del bloque llega en los objects de su propia columna.
                        groupColor: bCol ? (((bCol as any).objects?.[i]?.qtable?.blockFillColor?.solid?.color) || null) : null,
                    },
                    v: kept.map(() => 0), ids: kept.map(() => []), hl: kept.map(() => false),
                    fmt: kept.map(() => undefined), tips: kept.map(() => new Map()),
                };
                accs.set(key, a); order.push(a);
            }
            let rb = this.host.createSelectionIdBuilder();
            for (const c of allCats) { rb = rb.withCategory(c, i); }
            a.row.ids.push(rb.createSelectionId());
            kept.forEach((g, gi) => {
                const col = valueCol(g);
                const v = Number(col?.values?.[i] ?? 0) || 0;
                a.v[gi] += v;
                if ((col?.highlights?.[i] ?? null) != null) { a.hl[gi] = true; }
                // F11: cadena de formato dinámica por valor; si no llega, la de la columna.
                const f = col?.objects?.[i]?.general?.formatString;
                a.fmt[gi] = (typeof f === "string" && f) ? f : (a.fmt[gi] ?? this.formatOf(col));
                let b = this.host.createSelectionIdBuilder();
                for (const c of allCats) { b = b.withCategory(c, i); }
                a.ids[gi].push(b.withSeries(cat.values, g).createSelectionId());
                (g.values as any[]).filter(v2 => v2?.source?.roles?.tooltips).forEach(v2 => {
                    const nm = v2.source.displayName || "";
                    const raw = v2.values?.[i];
                    const nv = this.num(raw);
                    const cur = a.tips[gi].get(nm);
                    const tf = v2.objects?.[i]?.general?.formatString;
                    const tfmt = (typeof tf === "string" && tf) ? tf : this.formatOf(v2);
                    if (!cur) { a.tips[gi].set(nm, { num: nv, txt: raw === null || raw === undefined ? "" : String(raw), fmt: tfmt }); }
                    else if (nv !== null && cur.num !== null) { cur.num += nv; }
                });
            });
        }

        this.rows = [];
        this.rowMap.clear();
        const boxN = Math.max(1, Math.min(s.boxes.size, kept.length));
        for (const a of order) {
            const r = a.row;
            let total = 0;
            kept.forEach((_, gi) => { if (gi !== excludeIdx) { total += a.v[gi]; } });
            if (total <= 0) { continue; }
            kept.forEach((g, gi) => {
                if (gi === excludeIdx) { return; }
                const v = a.v[gi];
                const tip: VisualTooltipDataItem[] = [
                    { displayName: r.question, value: this.responseLabels[gi], color: this.responseColors[gi] },
                    { displayName: this.t("UI_TipValue", "Value"), value: this.fmt(v, a.fmt[gi]) },
                    { displayName: this.t("UI_TipShare", "Share"), value: `${(total ? v / total * 100 : 0).toFixed(1)}%` }
                ];
                if (r.panel !== null) { tip.unshift({ displayName: pCol?.source.displayName || "", value: r.panel }); }
                a.tips[gi].forEach((tv, nm) => {
                    tip.push({ displayName: nm, value: tv.num !== null ? this.fmt(tv.num, tv.fmt) : tv.txt });
                });
                r.segments.push({
                    responseIndex: gi, label: this.responseLabels[gi], value: v,
                    share: total ? v / total : 0, color: this.responseColors[gi],
                    ids: a.ids[gi], key: r.key + "\u0003" + gi, fmt: a.fmt[gi], tooltip: tip,
                    highlighted: !hasHl || a.hl[gi]
                });
            });
            r.total = total;
            let neg = 0, pos = 0;
            r.segments.forEach(sg => {
                if (sg.responseIndex < negN) { neg += sg.share; }
                else if (sg.responseIndex === neutralIdx) { neg += sg.share / 2; pos += sg.share / 2; }
                else { pos += sg.share; }
            });
            r.negShare = neg; r.posShare = pos;
            r.topBox = r.segments.filter(sg => sg.responseIndex >= kept.length - boxN).reduce((x, sg) => x + sg.share, 0);
            r.bottomBox = r.segments.filter(sg => sg.responseIndex < boxN).reduce((x, sg) => x + sg.share, 0);
            r.mean = r.segments.reduce((x, sg) => x + (this.responseScores[sg.responseIndex] ?? 0) * sg.value, 0) / total;
            this.rows.push(r);
            this.rowMap.set(r.key, r);
        }

        // Paneles en orden de aparición; preguntas comunes a todos, agrupadas por bloque.
        const panels: (string | null)[] = [];
        this.rows.forEach(r => { if (panels.indexOf(r.panel) < 0) { panels.push(r.panel); } });
        this.panels = panels.length ? panels : [null];
        const qs: { qKey: string; group: string; i: number }[] = [];
        const seen = new Set<string>();
        this.rows.forEach((r, i) => { if (!seen.has(r.qKey)) { seen.add(r.qKey); qs.push({ qKey: r.qKey, group: r.group ?? "", i }); } });
        // Agrupar solo tiene sentido si las filas del mismo bloque van juntas: si llegan
        // intercaladas, el encabezado se repite en casi cada fila y no agrupa nada. Se respeta
        // el orden de aparicion de los bloques y, dentro de cada uno, el de las preguntas.
        const gOrder = new Map<string, number>();
        qs.forEach(q => { if (!gOrder.has(q.group)) { gOrder.set(q.group, gOrder.size); } });
        qs.sort((x, y) => (gOrder.get(x.group) ?? 0) - (gOrder.get(y.group) ?? 0) || x.i - y.i);
        this.qOrder = qs.map(q => q.qKey);
        this.collectBlocks();
    }

    /** Filas de un panel en el orden común; null donde el panel no tiene esa pregunta. */
    private rowsFor(panel: string | null): (QuestionRow | null)[] {
        return this.qOrder.map(q => this.rowMap.get((panel ?? "") + "\u0002" + q) ?? null);
    }

    /** Un bloque por nombre, en su orden de aparicion, con el color que toca mostrar. */
    private collectBlocks(): void {
        const pal: any = (this.host as any).colorPalette;
        const vistos = new Map<string, number>();
        this.blocks = [];
        const ordered = this.panels.length === 1 ? this.rowsFor(this.panels[0]).filter(r => !!r) as QuestionRow[] : this.rows;
        ordered.forEach(r => {
            const n = r.group;
            if (n === null || vistos.has(n)) { return; }
            vistos.set(n, this.blocks.length);
            // Los agregados del bloque se ponderan por respuestas, no por preguntas: una
            // pregunta con 95 respuestas no puede pesar lo mismo que otra con 250.
            const suyas = this.rows.filter(x => x.group === n);
            const peso = suyas.reduce((a, x) => a + x.total, 0) || 1;
            const k = this.blocks.length;
            this.blocks.push({
                name: n,
                sid: r.groupSelectionId,
                color: r.groupColor ?? (this.look ? styleSeriesColor(this.look.series, k) : (pal?.getColor?.(n)?.value ?? "#5E81AC")),
                mean:     suyas.reduce((a, x) => a + x.mean * x.total, 0) / peso,
                positive: suyas.reduce((a, x) => a + x.posShare * x.total, 0) / peso,
                nps:      suyas.reduce((a, x) => a + (x.topBox - x.bottomBox) * x.total, 0) / peso,
            });
        });
    }

    /**
     * Orden de la escala. Depender de que el usuario haya configurado "Ordenar por columna"
     * en el modelo es frágil: si no lo hace, Power BI entrega las respuestas alfabéticamente
     * y el gráfico queda sin sentido SIN avisar. Con el pozo "Scale order" el orden es
     * explícito y vive en el propio visual. Sin ese pozo se respeta el orden que llega.
     */
    /**
     * Scale order leído como UN número por punto de escala, sin depender del orden de las filas:
     *  - si vale lo mismo en todas las filas (agregación Mínimo, Media, Primero…), ese número;
     *  - si no, pero Scale order / Value es constante (Suma del código con Value = recuento), el código;
     *  - si no (p. ej. Scale order = Suma y Value = la misma suma), no es fiable: se ordena por el
     *    mínimo, como en la 1.0, la media usa la posición 1, 2, 3… y una nota lo dice.
     */
    private orderInfo(groups: any[]): { ranks: (number | null)[]; reliable: boolean; varies: boolean } {
        const eq = (a: number[]) => a.every(x => Math.abs(x - a[0]) <= 1e-9 * Math.max(1, Math.abs(a[0])));
        const per = groups.map(g => {
            const vals = (g?.values as any[]) ?? [];
            const oc = vals.find(v => v?.source?.roles?.order);
            if (!oc) { return { r: null as number | null, ok: false, min: null as number | null }; }
            const vc = vals.find(v => v?.source?.roles?.value);
            const os: number[] = [], rs: number[] = [];
            for (let i = 0; i < (oc.values?.length ?? 0); i++) {
                const o = this.num(oc.values[i]);
                if (o === null) { continue; }
                os.push(o);
                const v = vc && vc !== oc ? this.num(vc.values?.[i]) : null;
                if (v !== null && v > 0) { rs.push(o / v); }
            }
            if (!os.length) { return { r: null, ok: false, min: null }; }
            const min = Math.min(...os);
            if (eq(os)) { return { r: os[0], ok: true, min }; }
            if (rs.length && eq(rs) && (vc?.source?.queryName !== oc.source?.queryName)) { return { r: rs[0], ok: true, min }; }
            return { r: min, ok: false, min };
        });
        const ranks = per.map(p => p.r);
        const present = ranks.filter(r => r !== null) as number[];
        const distinct = new Set(present.map(r => r.toPrecision(12))).size === present.length;
        const reliable = present.length === groups.length && per.every(p => p.ok) && distinct;
        return { ranks, reliable, varies: present.length > 0 && !reliable };
    }

    private orderVaries = false;

    private sortByScaleOrder(groups: any[]): any[] {
        const info = this.orderInfo(groups);
        this.orderVaries = info.varies;
        const ranks = info.ranks;
        if (ranks.every(r => r === null)) { return groups; }
        // Los que no traen rango se quedan al final, en su orden original.
        return groups
            .map((g, i) => ({ g, i, r: ranks[i] }))
            .sort((a, b) => {
                if (a.r === null && b.r === null) { return a.i - b.i; }
                if (a.r === null) { return 1; }
                if (b.r === null) { return -1; }
                return a.r - b.r || a.i - b.i;
            })
            .map(x => x.g);
    }

    /** Rampa divergente entre los dos extremos, pasando por el neutro. */
    private scaleColors(groups: any[]): string[] {
        const s = this.settings.colors;
        const look = this.look;
        const count = groups.length;
        const h = this.hc();
        const neg = this.pick("colors", "negativeColor", s.negativeColor, look?.down);
        const neu = this.pick("colors", "neutralColor", s.neutralColor, look ? mix(look.grid, look.axis, 0.35) : undefined);
        const pos = this.pick("colors", "positiveColor", s.positiveColor, look?.up);
        const out: string[] = [];
        const negN = Math.max(1, Math.min(this.settings.scale.negativeCount, count));
        for (let i = 0; i < count; i++) {
            if (h.on) { out.push(h.bg); continue; }
            // Color por punto de escala puesto a mano o por regla (fx) sobre colors.fill.
            const own = groups[i]?.objects?.colors?.fill?.solid?.color;
            if (own) { out.push(own); continue; }
            const t = count <= 1 ? 0 : i / (count - 1);
            const mid = negN / Math.max(count - 1, 1);
            out.push(t <= mid
                ? mix(neg, neu, mid ? t / mid : 1)
                : mix(neu, pos, (t - mid) / Math.max(1 - mid, 0.001)));
        }
        return out;
    }

    // ── Render ────────────────────────────────────────────────────────────────

    private sizeClass(w: number, h: number): "s" | "m" | "l" {
        if (w < 200 || h < 140) { return "s"; }
        if (w <= 400 || h <= 300) { return "m"; }
        return "l";
    }

    private clear(svg: SVGSVGElement): void {
        while (svg.firstChild) { svg.removeChild(svg.firstChild); }
    }

    private renderLanding(w: number, h: number): void {
        this.clear(this.svg); this.clear(this.topSvg); this.clear(this.bottomSvg);
        this.scrollHost.style.display = "none";
        this.topHost.style.display = "none";
        this.bottomHost.style.display = "none";
        const el = this.landingEl;
        while (el.firstChild) { el.removeChild(el.firstChild); }
        const size = (w >= 600 && h >= 340) ? "l" : (w >= 360 && h >= 220) ? "m" : "s";
        el.className = "lk-landing lk-landing-" + size;
        el.style.display = "flex";
        const hc = this.hc();
        const fg = hc.on ? hc.fg : "";
        const mk = (tag: string, cls?: string, text?: string): HTMLElement => {
            const n = document.createElement(tag);
            if (cls) { n.className = cls; }
            if (text !== undefined) { n.textContent = text; }
            if (fg) { n.style.color = fg; }
            return n;
        };
        const T = (k: string, d: string) => this.t(k, d);
        const q = T("Role_Question", "Question"), r = T("Role_Response", "Response"), v = T("Role_Value", "Value");
        const box = mk("div", "lk-l-box");
        el.appendChild(box);
        const head = mk("div", "lk-l-head");
        const img = document.createElement("img");
        img.src = LANDING_ICON; img.alt = ""; img.className = "lk-l-icon";
        head.appendChild(img);
        const titles = mk("div");
        titles.appendChild(mk("div", "lk-l-title", "Likert Survey Pro"));
        if (size !== "s") {
            titles.appendChild(mk("div", "lk-l-tag", size === "l"
                ? T("Landing_Tagline", "Diverging stacked bars centred on the neutral answer: see at a glance where agreement wins.")
                : T("Landing_TaglineShort", "Survey answers, centred on neutral.")));
        }
        head.appendChild(titles);
        box.appendChild(head);
        const link = (txt: string, url: string, cls: string): HTMLElement => {
            const a = mk("a", cls) as HTMLAnchorElement;
            a.href = url; a.tabIndex = 0; a.textContent = txt;
            if (hc.on) { a.style.background = "transparent"; a.style.borderColor = fg; }
            const open = (e: Event) => { e.preventDefault(); e.stopPropagation(); this.host.launchUrl(url); };
            a.addEventListener("click", open);
            a.addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { open(e); } });
            return a;
        };
        const links: [string, string, string][] = [
            [T("Landing_Guide", "Guide"), T("Landing_GuideSub", "support page"), URL_GUIDE],
            [T("Landing_Product", "Product page"), "tcviz.com", URL_PRODUCT],
            [T("Landing_Video", "Video"), "YouTube", URL_VIDEO],
        ];
        if (size === "s") {
            box.appendChild(mk("p", "lk-l-do", T("Landing_Small", "Add {q}, {r} and {v}.").replace("{q}", q).replace("{r}", r).replace("{v}", v)));
            const row = mk("div", "lk-l-inline");
            row.appendChild(link(links[0][0], links[0][2], "lk-l-a"));
            box.appendChild(row);
            return;
        }
        const L = size === "l";
        const steps = mk("ol", "lk-l-steps");
        const step = (n: number, well: string, txt: string) => {
            const li = mk("li");
            const num = mk("b", "lk-l-n", String(n));
            if (hc.on) { num.style.background = fg; num.style.color = hc.bg; }
            li.appendChild(num);
            const sp = mk("span");
            sp.appendChild(mk("strong", "lk-l-well", well));
            sp.appendChild(document.createTextNode(" · " + txt));
            li.appendChild(sp);
            steps.appendChild(li);
        };
        step(1, q, L ? T("Landing_Step1", "the survey item: one diverging bar each (a hierarchy drills down)") : T("Landing_Step1Short", "one bar each"));
        step(2, r, L ? T("Landing_Step2", "the scale point; add Scale order to fix the order") : T("Landing_Step2Short", "the scale points"));
        step(3, v, L ? T("Landing_Step3", "the count of answers") : T("Landing_Step3Short", "the count"));
        if (L) {
            const cols = mk("div", "lk-l-cols");
            const c1 = mk("div");
            c1.appendChild(mk("div", "lk-l-lbl", T("Landing_Start", "Start in 3 steps")));
            c1.appendChild(steps);
            const c2 = mk("div");
            c2.appendChild(mk("div", "lk-l-lbl", T("Landing_Help", "Help")));
            const list = mk("div", "lk-l-links");
            for (const [txt, sub, url] of links) {
                const a = link(txt, url, "lk-l-card");
                a.appendChild(mk("small", "lk-l-sub", sub));
                list.appendChild(a);
            }
            c2.appendChild(list);
            cols.appendChild(c1); cols.appendChild(c2);
            box.appendChild(cols);
        } else {
            box.appendChild(steps);
            const row = mk("div", "lk-l-inline");
            for (const l of links) { row.appendChild(link(l[1] === "tcviz.com" ? "tcviz.com" : l[0], l[2], "lk-l-a")); }
            box.appendChild(row);
        }
        if (!this.isPro) {
            const pro = mk("div", "lk-l-pro");
            const chip = mk("span", "lk-l-chip", "Pro");
            if (hc.on) { chip.style.background = "transparent"; chip.style.border = "1px solid " + fg; }
            pro.appendChild(chip);
            pro.appendChild(mk("span", undefined, L
                ? T("Landing_Pro", "Top/Bottom box, NPS, a benchmark line, question groups, small multiples and the six collection styles.")
                : T("Landing_ProShort", "Top/Bottom box, NPS, groups, small multiples.")));
            box.appendChild(pro);
        }
    }

    /** Geometría de un panel: columnas de bloque y pregunta, barras y columnas fijas de la derecha. */
    private geom(pw: number, rows: (QuestionRow | null)[], showLeft: boolean, size: "s" | "m" | "l"): Geom {
        const s = this.settings;
        const real = rows.filter(r => !!r) as QuestionRow[];
        const hayBloques = showLeft && size !== "s" && real.some(r => r.group !== null);
        // Zona izquierda como tabla: columna de bloque y columna de pregunta. La de
        // pregunta se ajusta al texto real, con el porcentaje como TOPE en vez de como
        // medida fija: con preguntas cortas, un ancho fijo deja un hueco que nadie recupera.
        let blockW = hayBloques ? Math.max(0, pw * (s.qtable.blockWidth / 100)) : 0;
        if (size === "m") { blockW = Math.min(blockW, pw * 0.18); }
        // Una columna de bloque de menos de 48 px solo enseña "En…": se quita y queda el sombreado.
        if (blockW < 48) { blockW = 0; }
        const qfs = this.qFont(size);
        let tope = Math.max(60, Math.min(pw * (s.labels.questionWidth / 100), pw * 0.6));
        if (size === "s") { tope = Math.min(tope, Math.max(40, pw * 0.4)); }
        const anchoTexto = real.reduce((m, r) => Math.max(m, r.question.length * qfs * 0.58), 0);
        // +20 y no +12: ellipsis() resta 12 + 6 px de margen; con +12 la pregunta más larga
        // perdía siempre 1-2 letras ("Sales rep servi…") aunque hubiera sitio de sobra.
        const qW = showLeft ? Math.max(Math.min(60, tope), Math.min(tope, anchoTexto + 20)) : 0;
        const leftW = blockW + qW;
        // Columnas fijas de la derecha, MEDIDAS sobre los textos reales: una estimacion fija se
        // quedaba corta con "100% / 100%". En tamaño pequeño se quitan antes que encoger las barras.
        const bf = Math.max(minText, s.boxes.fontSize);
        const boxColW = s.boxes.show ? real.reduce((m, r) => Math.max(m, boxTxt(r).length * bf * 0.58), 0) : 0;
        const pillW = s.boxes.showNps ? real.reduce((m, r) => Math.max(m, npsTxt(r).length * bf * 0.62 + bf * 1.2), bf * 1.75) : 0;
        let showBoxes = s.boxes.show && size !== "s";
        let showNps = s.boxes.showNps && size !== "s";
        const barLeft = leftW + (showLeft ? s.labels.labelGap : 4);
        const rightW = () => (showBoxes ? boxColW + 10 : 0) + (showNps ? pillW : 0) + ((showBoxes || showNps) ? 10 : 0);
        // Lo último que se quita es lo que define el producto: la barra divergente.
        if (size !== "l" && pw - barLeft - rightW() - 10 < pw * 0.35) { showBoxes = false; }
        if (size !== "l" && pw - barLeft - rightW() - 10 < pw * 0.3) { showNps = false; }
        const barW = Math.max(40, pw - barLeft - rightW() - 10);
        return { blockW, qW, leftW, barLeft, barW, centre: barLeft + barW / 2, boxColW, pillW, showBoxes, showNps, showLeft };
    }

    private qFont(size: string): number {
        const f = this.settings.qtable.questionFontSize;
        return Math.max(minText, size === "s" ? Math.min(f, 9) : f);
    }

    private render(w: number, h: number): void {
        this.clear(this.svg); this.clear(this.topSvg); this.clear(this.bottomSvg);
        this.scrollHost.style.display = "block";
        const s = this.settings;
        const size = this.sizeClass(w, h);
        this.hiddenRows = 0;
        this.svg.setAttribute("role", "group");

        let panels = this.panels;
        if (panels.length > 1 && !this.isPro && this.proPreview) { panels = panels.slice(0, PREVIEW_PANELS); }
        const multi = panels.length > 1;

        // Defs de patrones UNA vez, en el lienzo (las bandas de la leyenda los usan por url): un id repetido
        // resuelve al primero del documento, y si ese está en una banda oculta el patrón no se pinta.
        this.patternDefs(this.svg);

        // Leyenda
        const legendFs = Math.max(minText, s.legend.fontSize > 0 ? s.legend.fontSize : Math.max(9, s.labels.fontSize - 1)) - (size === "m" ? 1 : 0);
        const legendOn = s.legend.show && size !== "s";
        const legendLines = legendOn ? this.legendLayout(w, legendFs).lines : 0;
        // Si la leyenda no cabe en sus líneas, pasa a compacta (todas las muestras y los dos extremos): nunca etiquetas perdidas.
        const legendMax = size === "l" ? 4 : (h < 220 ? 1 : 2);
        const legendH = legendOn ? (legendLines > legendMax ? 1 : legendLines) * (legendFs + 5) + 8 : 0;

        // Ejes y títulos
        const catFs = Math.max(minText, s.categoryAxis.fontSize);
        const catH = s.categoryAxis.showTitle && size !== "s" ? catFs + 8 : 0;
        const axFs = Math.max(minText, s.valueAxis.fontSize);
        const tickH = s.valueAxis.show && size !== "s" ? axFs + 8 : 0;
        const vTitleH = s.valueAxis.showTitle && size === "l" ? axFs + 8 : 0;

        const notesPre = this.noteMessages(0);
        const noteH = notesPre.length ? 16 : 0;
        const topLegend = legendOn && s.legend.position === "top";
        const topH = (topLegend ? legendH : 0) + catH;
        const bottomH = (multi ? 0 : tickH) + vTitleH + (legendOn && !topLegend ? legendH : 0);
        this.topHost.style.display = topH ? "block" : "none";
        this.topHost.style.height = topH + "px";
        this.bottomHost.style.display = bottomH ? "block" : "none";
        this.bottomHost.style.height = bottomH + "px";
        this.bottomHost.style.bottom = noteH + "px";
        this.scrollHost.style.top = topH + "px";
        this.scrollHost.style.bottom = (bottomH + noteH) + "px";
        const availH = Math.max(h - topH - bottomH - noteH, 10);

        const topPad = 6, botPad = 6;
        const gapR = s.layout.rowGap;
        // La FILA puede crecer hasta 1,75 veces la barra máxima: con pocas preguntas no salen bloques
        // enormes y con 10 preguntas en un visual alto las filas llenan el alto (antes, tope fijo de 46 px:
        // la mitad de abajo quedaba vacía, visto por Tino en Desktop). La barra no pasa de AUTO_MAX_BAR.
        const maxAuto = AUTO_MAX_BAR * 1.75 + gapR;
        // Una fila nunca baja de lo que necesita su texto: el tamaño mínimo manda.
        const floorH = Math.max(minText + 2, 8);
        const rowHeightFor = (fitH: number, scrollable: boolean): number => {
            if (s.layout.rowHeightMode === "fixed") { return Math.max(floorH, s.layout.rowHeight); }
            // Automática: las filas se reparten el alto disponible, con la barra hasta 64 px.
            const lo = scrollable ? Math.max(floorH, size === "s" ? Math.min(14, s.layout.minRowHeight) : s.layout.minRowHeight) : floorH;
            return Math.max(lo, Math.min(maxAuto, fitH));
        };

        let geomFirst: Geom;
        if (!multi) {
            const rows = this.rowsFor(panels[0]);
            const n = Math.max(rows.length, 1);
            const fitH = (availH - topPad - botPad) / n;
            const scrollable = s.layout.enableScroll;
            const rowH = rowHeightFor(fitH, scrollable);
            const needed = topPad + botPad + rowH * rows.length;
            const scroll = scrollable && needed > availH + 0.5;
            // Sin scroll, lo que no cabe no se recorta en silencio: se dibuja lo que cabe y se avisa.
            const fits = scroll ? rows.length : Math.max(1, Math.min(rows.length, Math.floor((availH - topPad - botPad) / rowH + 0.001)));
            this.hiddenRows = rows.length - fits;
            this.scrollHost.style.overflowY = scroll ? "auto" : "hidden";
            const sbw = scroll ? 14 : 0;
            const innerW = Math.max(w - sbw, 40);
            const shown = rows.slice(0, fits);
            const g = this.geom(innerW, shown, true, size);
            geomFirst = g;
            this.svg.setAttribute("width", String(innerW));
            this.svg.setAttribute("height", String(Math.max(topPad + botPad + rowH * shown.length, availH)));
            const pg = el("g");
            this.svg.appendChild(pg);
            this.drawPanel(pg, shown, g, rowH, topPad, size, 0);
            // Bandas: título de categorías arriba; marcas y título del eje de valores abajo.
            let ty = topLegend ? legendH : 0;
            if (catH) { this.drawCategoryTitle(this.topSvg, g, 0, ty, catFs); ty += catH; }
            let by = 0;
            if (tickH) { this.drawValueTicks(this.bottomSvg, g, 0, by + 2, axFs); by += tickH; }
            if (vTitleH) { this.drawValueTitle(this.bottomSvg, g.centre, by + axFs + 2, axFs); by += vTitleH; }
            this.topSvg.setAttribute("width", String(w)); this.topSvg.setAttribute("height", String(topH));
            this.bottomSvg.setAttribute("width", String(w)); this.bottomSvg.setAttribute("height", String(bottomH));
            if (legendOn) { this.renderLegend(topLegend ? this.topSvg : this.bottomSvg, w, topLegend ? 0 : by, legendFs, legendH); }
        } else {
            // Small multiples (Pro): una rejilla de paneles con las mismas preguntas en el mismo orden;
            // las preguntas se escriben solo en la primera columna de cada fila de la rejilla.
            this.scrollHost.style.overflowY = "hidden";
            const sm = s.smallMultiples;
            const n = panels.length;
            const cols = sm.columns > 0 ? Math.min(n, sm.columns) : Math.max(1, Math.min(n, Math.round(Math.sqrt(n * w / Math.max(1, availH * 1.6)))));
            const gridRows = Math.ceil(n / cols);
            const gap = sm.gap;
            const rowsAll = this.qOrder.length;
            const first = this.rowsFor(panels[0]);
            // La primera columna lleva además las preguntas: se reparte el ancho para que todas las barras midan igual.
            const probe = this.geom(Math.max(120, w / cols), first, true, size);
            const leftPart = Math.min(probe.barLeft, w * 0.4);
            const rightPart = Math.max(10, Math.max(120, w / cols) - probe.barLeft - probe.barW);
            // Mismo ancho de barra en todas las columnas: w = izquierda + cols·(barra + derecha) + huecos.
            const barW = Math.max(40, (w - leftPart - cols * rightPart - (cols - 1) * (gap + 4)) / cols);
            const cellW = (c: number) => (c === 0 ? leftPart : 4) + barW + rightPart;
            const cellX = (c: number) => c === 0 ? 0 : cellW(0) + gap + (c - 1) * (cellW(1) + gap);
            const geomAt = (c: number): Geom => c === 0
                ? { ...probe, barLeft: leftPart, barW, centre: leftPart + barW / 2 }
                : { ...probe, blockW: 0, qW: 0, leftW: 0, showLeft: false, barLeft: 4, barW, centre: 4 + barW / 2 };
            const cellH = (availH - gap * (gridRows - 1)) / gridRows;
            const titleFs = Math.max(minText, sm.titleSize);
            const titleH = size === "s" ? 0 : titleFs + 8;
            const ptick = s.valueAxis.show && size !== "s" ? axFs + 6 : 0;
            const fitH = (cellH - titleH - ptick - topPad - botPad) / Math.max(rowsAll, 1);
            const rowH = Math.min(rowHeightFor(fitH, false), Math.max(floorH, fitH));
            const fits = Math.max(1, Math.min(rowsAll, Math.floor((cellH - titleH - ptick - topPad - botPad) / rowH + 0.001)));
            this.hiddenRows = rowsAll - fits;
            this.svg.setAttribute("width", String(w));
            this.svg.setAttribute("height", String(availH));
            const hcv = this.hc();
            geomFirst = probe;
            panels.forEach((p, i) => {
                const c = i % cols, rI = Math.floor(i / cols);
                const showLeft = c === 0;
                const cw = cellW(c);
                const x = cellX(c);
                const y = rI * (cellH + gap);
                const rows = this.rowsFor(p).slice(0, fits);
                const g = geomAt(c);
                if (showLeft && i === 0) { geomFirst = g; }
                const cell = el("g");
                cell.setAttribute("transform", `translate(${x},${y})`);
                this.svg.appendChild(cell);
                if (!hcv.on && sm.background) { cell.appendChild(rect(0, 0, cw, cellH, sm.background)); }
                if (sm.border) {
                    const b = rect(0.5, 0.5, cw - 1, cellH - 1, "none");
                    b.setAttribute("stroke", hcv.on ? hcv.fg : sm.borderColor);
                    cell.appendChild(b);
                }
                if (titleH) {
                    const pad = sm.background || sm.border ? 6 : 0;
                    const center = sm.titleAlign === "center";
                    const tx = center ? g.centre : (showLeft ? 4 + pad : g.barLeft);
                    const label = p ?? "";
                    const tt = text(tx, titleFs + 2 + pad / 2, ellipsis(label, cw - 8, titleFs), titleFs,
                        this.ink("smallMultiples", "titleColor", sm.titleColor || this.ink("qtable", "questionColor", s.qtable.questionColor)), center ? "middle" : "start");
                    if (sm.titleBold) { tt.setAttribute("font-weight", "600"); }
                    this.subSelectable(tt, "smallMultiples", this.t("Obj_SmallMultiples", "Small multiples"), powerbi.visuals.SubSelectionStylesType.Text);
                    cell.appendChild(tt);
                }
                const inner = el("g");
                inner.setAttribute("transform", `translate(0,${titleH})`);
                cell.appendChild(inner);
                this.drawPanel(inner, rows, g, rowH, topPad, size, i);
                if (ptick) { this.drawValueTicks(inner, g, 0, topPad + rowH * rows.length + 2, axFs); }
            });
            let ty = topLegend ? legendH : 0;
            if (catH) { this.drawCategoryTitle(this.topSvg, geomFirst, 0, ty, catFs); ty += catH; }
            let by = 0;
            if (vTitleH) { this.drawValueTitle(this.bottomSvg, w / 2, by + axFs + 2, axFs); by += vTitleH; }
            this.topSvg.setAttribute("width", String(w)); this.topSvg.setAttribute("height", String(topH));
            this.bottomSvg.setAttribute("width", String(w)); this.bottomSvg.setAttribute("height", String(bottomH));
            if (legendOn) { this.renderLegend(topLegend ? this.topSvg : this.bottomSvg, w, topLegend ? 0 : by, legendFs, legendH); }
        }
        this.renderNote(this.noteMessages(this.hiddenRows), size);
        this.svg.setAttribute("aria-label", this.t("UI_AriaChart", "Likert survey chart") + ": "
            + this.qOrder.length + " " + this.t("UI_AriaQuestions", "questions"));
        this.attachTooltips();
        this.restoreFocus();
    }

    /** Patrones para distinguir los puntos de escala sin color: sentido por la inclinación, distancia por la densidad. */
    private patternDefs(svg: SVGSVGElement): void {
        const defs = el("defs");
        svg.appendChild(defs);
        const h = this.hc();
        const inks: [string, string, number][] = h.on ? [["h", h.fg, 1]] : [["d", "#000000", 0.38], ["l", "#FFFFFF", 0.6]];
        for (const [ink, color, op] of inks) {
            for (const side of ["n", "p"]) {
                for (let d = 1; d <= 3; d++) {
                    const sp = d === 1 ? 8 : d === 2 ? 5.5 : 3.8;
                    const p = el("pattern");
                    p.setAttribute("id", `lk-${ink}-${side}${d}`);
                    p.setAttribute("width", String(sp)); p.setAttribute("height", String(sp));
                    p.setAttribute("patternUnits", "userSpaceOnUse");
                    p.setAttribute("patternTransform", `rotate(${side === "n" ? 135 : 45})`);
                    if (h.on) { p.appendChild(rect(0, 0, sp, sp, h.bg)); }
                    const ln = el("line");
                    ln.setAttribute("x1", "0"); ln.setAttribute("y1", "0"); ln.setAttribute("x2", "0"); ln.setAttribute("y2", String(sp));
                    ln.setAttribute("stroke", color); ln.setAttribute("stroke-width", "1.4"); ln.setAttribute("stroke-opacity", String(op));
                    p.appendChild(ln);
                    defs.appendChild(p);
                }
            }
            const p = el("pattern");
            p.setAttribute("id", `lk-${ink}-z`);
            p.setAttribute("width", "5"); p.setAttribute("height", "5");
            p.setAttribute("patternUnits", "userSpaceOnUse");
            if (h.on) { p.appendChild(rect(0, 0, 5, 5, h.bg)); }
            const c = el("circle");
            c.setAttribute("cx", "2.5"); c.setAttribute("cy", "2.5"); c.setAttribute("r", "0.9");
            c.setAttribute("fill", color); c.setAttribute("fill-opacity", String(op));
            p.appendChild(c);
            defs.appendChild(p);
        }
    }

    /** Id del patrón de un punto de escala, o null si no toca patrón. */
    private patternFor(ri: number, fill: string): string | null {
        const h = this.hc();
        if (!h.on && !this.rawSettings.accessibility.patterns) { return null; }
        const ink = h.on ? "h" : (readable(fill) === "#FFFFFF" ? "l" : "d");
        if (ri === this.neutralIdx) { return `lk-${ink}-z`; }
        const neutralEnd = this.neutralIdx >= 0 ? this.neutralIdx : this.negN - 1;
        const d = ri < this.negN ? this.negN - ri : ri - neutralEnd;
        return `lk-${ink}-${ri < this.negN ? "n" : "p"}${Math.max(1, Math.min(3, d))}`;
    }

    private drawPanel(parent: SVGElement, rows: (QuestionRow | null)[], g: Geom, rowH: number, topPad: number,
                      size: "s" | "m" | "l", panelIndex: number): void {
        const s = this.settings;
        const h = this.hc();
        const look = this.look;
        const pal: any = (this.host as any).colorPalette;
        const yEnd = topPad + rowH * rows.length;

        // Líneas de rejilla (detrás de todo), a ambos lados del centro.
        if (s.gridlines.show) {
            const gg = el("g");
            const gc = h.on ? h.fg : this.pick("gridlines", "color", s.gridlines.color, look?.grid, "#D8DEE9");
            for (let p = s.gridlines.step; p <= 100.001; p += s.gridlines.step) {
                for (const sign of [-1, 1]) {
                    const x = g.centre + sign * (p / 100) * (g.barW / 2);
                    const l = line(x, topPad, x, yEnd, gc, s.gridlines.width);
                    if (s.gridlines.dashed) { l.setAttribute("stroke-dasharray", "3,3"); }
                    gg.appendChild(l);
                }
            }
            this.subSelectable(gg, "gridlines", this.t("Obj_Gridlines", "Gridlines"), powerbi.visuals.SubSelectionStylesType.Shape);
            parent.appendChild(gg);
        }

        // Los bloques se pintan por TRAMOS, antes que las filas: un fondo por bloque y su
        // etiqueta centrada en el tramo. Pintarlo fila a fila era lo que hacia que la
        // etiqueta se repitiera y que aquello no pareciera una tabla.
        const hayBloques = g.showLeft && rows.some(r => r?.group != null);
        if (hayBloques) {
            let i = 0;
            while (i < rows.length) {
                const nombre = rows[i]?.group ?? "";
                let j = i;
                while (j + 1 < rows.length && (rows[j + 1]?.group ?? "") === nombre) { j++; }
                const yIni = topPad + i * rowH;
                const alto = (j - i + 1) * rowH;
                const b = this.blocks.find(x => x.name === nombre);
                if (s.qtable.blockFill && s.qtable.blockOpacity > 0 && !h.on) {
                    const bg = rect(0, yIni, g.leftW, alto, b?.color ?? pal?.getColor?.(nombre)?.value ?? "#5E81AC");
                    bg.setAttribute("opacity", String(s.qtable.blockOpacity / 100));
                    parent.appendChild(bg);
                }
                if (g.blockW > 0) {
                    const cyB = yIni + alto / 2;
                    const bfs = Math.max(minText, s.qtable.blockFontSize);
                    // El circulo solo cabe si deja sitio al nombre: por debajo de eso se
                    // omite, antes que superponer una cifra sobre el texto del bloque.
                    const d = Math.min(s.qtable.statSize, alto - 6, g.blockW * 0.55);
                    const hayCirculo = s.qtable.statShow && b && d >= 16 && this.panels.length === 1;
                    let nx = 6;
                    if (hayCirculo) {
                        const fill = h.on ? h.bg : this.pick("qtable", "statFill", s.qtable.statFill, look?.bg);
                        const c = el("circle");
                        c.setAttribute("cx", String(6 + d / 2)); c.setAttribute("cy", String(cyB)); c.setAttribute("r", String(d / 2));
                        c.setAttribute("fill", fill);
                        c.setAttribute("stroke", h.on ? h.fg : (look?.text ?? "#2E3440"));
                        c.setAttribute("stroke-width", "1.5");
                        c.setAttribute("aria-hidden", "true");
                        parent.appendChild(c);
                        const v = s.qtable.statMode === "positive" ? b.positive * 100
                                : s.qtable.statMode === "nps"      ? b.nps * 100
                                :                                    b.mean;
                        const etq = s.qtable.statMode === "mean" ? v.toFixed(1)
                                  : s.qtable.statMode === "positive" ? `${v.toFixed(0)}%`
                                  : `${v >= 0 ? "+" : ""}${v.toFixed(0)}`;
                        const fs = Math.max(8, Math.min(d * 0.38, bfs * 1.4));
                        const ct = text(6 + d / 2, cyB + fs * 0.36, etq, fs, h.on ? h.fg : readable(fill), "middle");
                        ct.setAttribute("font-weight", "700");
                        ct.setAttribute("font-family", this.font("qtable", "blockFontFamily", s.qtable.blockFontFamily));
                        parent.appendChild(ct);
                        nx = 6 + d + 8;
                    }
                    const bt = text(nx, cyB + bfs * 0.36, ellipsis(nombre, g.blockW - nx - 4, bfs), bfs,
                        this.ink("qtable", "blockColor", s.qtable.blockColor), "start");
                    bt.setAttribute("font-weight", "600");
                    bt.setAttribute("font-family", this.font("qtable", "blockFontFamily", s.qtable.blockFontFamily));
                    parent.appendChild(bt);
                }
                if (s.qtable.separator && j + 1 < rows.length) {
                    const yy = yIni + alto;
                    parent.appendChild(line(0, yy, g.barLeft + g.barW + 10, yy, h.on ? h.fg : (look?.grid ?? "#D8DEE9"), 1));
                }
                i = j + 1;
            }
        }

        // Eje del centro: es lo que hace legible una escala divergente.
        parent.appendChild(line(g.centre, topPad, g.centre, yEnd, h.on ? h.fg : (look?.axis ?? "#4C566A"), 1));

        if (s.benchmark.show) {
            const x = g.centre + (s.benchmark.value / 100) * (g.barW / 2);
            const bl = line(x, topPad, x, yEnd, h.on ? h.sel : this.pick("benchmark", "color", s.benchmark.color, look?.plan), 2);
            bl.setAttribute("stroke-dasharray", "4,3");
            parent.appendChild(bl);
        }

        const qfs = this.qFont(size);
        const qColor = this.ink("qtable", "questionColor", s.qtable.questionColor);
        const qFamily = this.font("qtable", "questionFontFamily", s.qtable.questionFontFamily);
        const qg = el("g");
        const bars = el("g");
        const showLabels = s.labels.showValues && size !== "s";
        const bfs = Math.max(minText, s.boxes.fontSize);
        rows.forEach((row, ri) => {
            const y = topPad + ri * rowH;
            // El alto de barra es la fila MENOS la separación: con separación 0 las barras
            // se tocan. Con "Automatic" el tope es AUTO_MAX_BAR: la fila crece, la barra no pasa de ahí.
            const barH = Math.max(4, Math.min(rowH - s.layout.rowGap, s.layout.rowHeightMode === "auto" ? AUTO_MAX_BAR : rowH));
            const by = y + (rowH - barH) / 2;
            const q = row ?? this.rowsFor(this.panels[0])[ri] ?? this.rows.find(r => r.qKey === this.qOrder[ri]);

            if (g.showLeft && q) {
                const izq = s.qtable.questionAlign === "left";
                const qt = text(izq ? g.blockW + 6 : g.leftW - 6, y + rowH / 2 + qfs * 0.36,
                    ellipsis(q.question, g.qW - 12, qfs), qfs, qColor, izq ? "start" : "end");
                qt.setAttribute("font-family", qFamily);
                qt.setAttribute("data-q", "1");
                (qt as any).__row = q;
                if (q.question.length * qfs * 0.58 > g.qW - 12) {
                    const tt = el("title"); tt.textContent = q.question; qt.appendChild(tt);
                }
                qg.appendChild(qt);
            }
            if (!row) { return; }

            // Izquierda desde el centro hacia fuera, para que el neutro quede pegado al eje.
            let x = g.centre - row.negShare * (g.barW / 2);
            row.segments.forEach(sg => {
                const span = sg.share * (g.barW / 2);
                // El hueco se resta al ancho PINTADO, no al avance: así el eje sigue
                // centrado y los porcentajes siguen siendo proporcionales. Y solo se aplica
                // si el tramo sobrevive: sin esta guarda, un 1% de 2 px desaparecería.
                const gap = span > s.layout.segmentGap + 1 ? s.layout.segmentGap : 0;
                const width = Math.max(0, span - gap);
                const segG = el("g");
                const r = rect(x, by, width, barH, sg.color);
                if (h.on) { r.setAttribute("stroke", h.fg); r.setAttribute("stroke-width", "1"); }
                segG.appendChild(r);
                const pat = this.patternFor(sg.responseIndex, sg.color);
                if (pat && width > 0) {
                    const pr = rect(x, by, width, barH, `url(#${pat})`);
                    pr.setAttribute("pointer-events", "none");
                    segG.appendChild(pr);
                }
                segG.setAttribute("data-seg", "1");
                segG.setAttribute("tabindex", "-1");
                segG.setAttribute("role", "img");
                segG.setAttribute("aria-label",
                    `${row.panel !== null ? row.panel + ", " : ""}${row.question}, ${sg.label}: ${(sg.share * 100).toFixed(1)}%`);
                (segG as any).__seg = sg;
                (segG as any).__row = row;
                bars.appendChild(segG);

                if (showLabels && sg.share * 100 >= s.labels.minSegment && width > 16) {
                    const fs = Math.max(minText, Math.min(s.labels.fontSize, barH * 0.6));
                    const txt = s.scale.asPercent ? this.pct(sg.share, s.labels.decimals) : this.fmt(sg.value, sg.fmt);
                    if (txt.length * fs * 0.58 <= width + 2) {
                        const lbl = text(x + span / 2, by + barH / 2 + fs * 0.36, txt, fs, h.on ? h.fg : readable(sg.color), "middle");
                        lbl.setAttribute("pointer-events", "none");
                        bars.appendChild(lbl);
                    }
                }
                x += span;
            });

            if (g.showBoxes || g.showNps) {
                const cy = y + rowH / 2;
                let bx = g.barLeft + g.barW + 10;
                if (g.showBoxes) {
                    parent.appendChild(text(bx + g.boxColW, cy + bfs * 0.36, boxTxt(row), bfs,
                        this.ink("boxes", "textColor", s.boxes.textColor), "end"));
                    bx += g.boxColW + 10;
                }
                if (g.showNps) {
                    // Pildora en vez de texto coloreado: el NPS es la cifra que se busca de
                    // un vistazo, y un numero suelto se pierde entre el resto del texto.
                    const nps = (row.topBox - row.bottomBox) * 100;
                    const fondo = h.on ? h.bg : (nps >= 0 ? this.pick("boxes", "npsPositive", s.boxes.npsPositive, look?.up)
                                                          : this.pick("boxes", "npsNegative", s.boxes.npsNegative, look?.down));
                    const ph = Math.min(bfs * 1.75, Math.max(barH, bfs * 1.3));
                    const pw = Math.max(ph, g.pillW);
                    const pill = rect(bx, cy - ph / 2, pw, ph, fondo);
                    pill.setAttribute("rx", String(ph / 2));
                    pill.setAttribute("aria-hidden", "true");
                    if (h.on) { pill.setAttribute("stroke", h.fg); }
                    parent.appendChild(pill);
                    // El texto sigue a la luminancia del relleno: con un verde claro no se
                    // puede escribir en blanco, y el color lo elige el usuario.
                    const nt = text(bx + pw / 2, cy + bfs * 0.36, npsTxt(row), bfs, h.on ? h.fg : readable(fondo), "middle");
                    nt.setAttribute("font-weight", "600");
                    parent.appendChild(nt);
                }
            }
        });
        this.subSelectable(qg, "qtable", this.t("Obj_Qtable", "Question table"), powerbi.visuals.SubSelectionStylesType.Text);
        this.subSelectable(bars, "colors", this.t("Obj_Colors", "Colors"), powerbi.visuals.SubSelectionStylesType.Shape);
        parent.appendChild(qg);
        parent.appendChild(bars);
    }

    private font(obj: string, prop: string, value: string): string {
        if (this.look?.font && !this.isSet(obj, prop)) { return this.look.font; }
        return value;
    }

    private axisInk(obj: string, value: string): string {
        const h = this.hc();
        if (h.on) { return h.fg; }
        if (this.isSet(obj, "color") && value) { return value; }
        return this.dimInk();
    }

    /** Marcas del eje de valores: la parte de respuestas a cada lado del centro (0 en el centro). */
    private drawValueTicks(parent: SVGElement, g: Geom, x0: number, y: number, fs: number): void {
        const s = this.settings;
        const ag = el("g");
        const color = this.axisInk("valueAxis", s.valueAxis.color);
        const step = s.gridlines.step;
        const minGap = fs * 3.2;
        let every = step;
        while ((every / 100) * (g.barW / 2) < minGap && every < 100) { every += step; }
        for (let p = 0; p <= 100.001; p += every) {
            for (const sign of p === 0 ? [0] : [-1, 1]) {
                const x = x0 + g.centre + sign * (p / 100) * (g.barW / 2);
                // Las marcas de los extremos se alinean hacia dentro: centradas, el "100%" se cortaba en el borde.
                const anchor = p >= 99.9 ? (sign < 0 ? "start" : "end") : "middle";
                ag.appendChild(text(x, y + fs, p === 0 ? "0" : `${Math.round(p)}%`, fs, color, anchor));
            }
        }
        this.subSelectable(ag, "valueAxis", this.t("Obj_ValueAxis", "Value axis"), powerbi.visuals.SubSelectionStylesType.Text);
        parent.appendChild(ag);
    }

    private drawValueTitle(parent: SVGElement, cx: number, y: number, fs: number): void {
        const s = this.settings;
        const txt = s.valueAxis.titleText || this.t("UI_ValueAxisTitle", "% of responses (left: negative · right: positive)");
        const t = text(cx, y, txt, fs, this.axisInk("valueAxis", s.valueAxis.color), "middle");
        t.setAttribute("font-weight", "600");
        this.subSelectable(t, "valueAxis", this.t("Obj_ValueAxis", "Value axis"), powerbi.visuals.SubSelectionStylesType.Text);
        parent.appendChild(t);
    }

    private drawCategoryTitle(parent: SVGElement, g: Geom, x0: number, y: number, fs: number): void {
        const s = this.settings;
        const txt = s.categoryAxis.titleText || this.questionName;
        const izq = s.qtable.questionAlign === "left";
        const t = text(x0 + (izq ? g.blockW + 6 : g.leftW - 6), y + fs + 2, ellipsis(txt, Math.max(60, g.qW + g.blockW), fs), fs,
            this.axisInk("categoryAxis", s.categoryAxis.color), izq ? "start" : "end");
        t.setAttribute("font-weight", "600");
        this.subSelectable(t, "categoryAxis", this.t("Obj_CategoryAxis", "Category axis"), powerbi.visuals.SubSelectionStylesType.Text);
        parent.appendChild(t);
    }

    /** Reparto de la leyenda en líneas (mismo cálculo para medir y para dibujar). */
    private legendLayout(w: number, fs: number): { lines: number; pos: { x: number; line: number }[] } {
        const pos: { x: number; line: number }[] = [];
        let x = 8, ln = 0;
        this.responseLabels.forEach(lab => {
            const iw = 15 + lab.length * fs * 0.58 + 12;
            if (x > 8 && x + iw > w - 8) { x = 8; ln++; }
            pos.push({ x, line: ln });
            x += iw;
        });
        return { lines: this.responseLabels.length ? ln + 1 : 0, pos };
    }

    private renderLegend(svg: SVGSVGElement, w: number, y0: number, fs: number, legendH: number): void {
        const s = this.settings;
        const h = this.hc();
        const lay = this.legendLayout(w, fs);
        const lg = el("g");
        const color = h.on ? h.fg : (this.isSet("legend", "color") && s.legend.color ? s.legend.color
            : this.ink("labels", "textColor", s.labels.textColor));
        const maxLines = Math.max(1, Math.floor((legendH - 8) / (fs + 5)));
        if (lay.lines > maxLines && this.responseLabels.length > 1) {
            // Compacta: todas las muestras en fila y el primer y el último punto de la escala nombrados.
            const n = this.responseLabels.length;
            const first = this.responseLabels[0], last = this.responseLabels[n - 1];
            const swW = Math.min(14, Math.max(6, (w - 40 - (first.length + last.length) * fs * 0.58) / n));
            let x = 8;
            const y = y0 + 5;
            lg.appendChild(text(x, y + 9.5, ellipsis(first, w * 0.38, fs), fs, color, "start"));
            x += Math.min(first.length * fs * 0.58, w * 0.38) + 6;
            this.responseLabels.forEach((lab, i) => {
                const item = el("g");
                item.setAttribute("data-leg", String(i));
                const sw = rect(x + i * swW, y, swW - 1, 11, this.responseColors[i]);
                if (h.on) { sw.setAttribute("stroke", h.fg); }
                const tt = el("title"); tt.textContent = lab; sw.appendChild(tt);
                item.appendChild(sw);
                const pat = this.patternFor(i, this.responseColors[i]);
                if (pat) { item.appendChild(rect(x + i * swW, y, swW - 1, 11, `url(#${pat})`)); }
                lg.appendChild(item);
            });
            x += n * swW + 6;
            lg.appendChild(text(x, y + 9.5, ellipsis(last, Math.max(30, w - x - 4), fs), fs, color, "start"));
            this.subSelectable(lg, "legend", this.t("Obj_Legend", "Legend"), powerbi.visuals.SubSelectionStylesType.Text);
            svg.appendChild(lg);
            return;
        }
        this.responseLabels.forEach((lab, i) => {
            const p = lay.pos[i];
            if (p.line >= maxLines) { return; }
            const y = y0 + 5 + p.line * (fs + 5);
            const item = el("g");
            item.setAttribute("data-leg", String(i));
            item.style.cursor = "pointer";
            const sw = rect(p.x, y, 11, 11, this.responseColors[i]);
            sw.setAttribute("rx", "2");
            if (h.on) { sw.setAttribute("stroke", h.fg); }
            item.appendChild(sw);
            const pat = this.patternFor(i, this.responseColors[i]);
            if (pat) { const pr = rect(p.x, y, 11, 11, `url(#${pat})`); pr.setAttribute("rx", "2"); item.appendChild(pr); }
            item.appendChild(text(p.x + 15, y + 9.5, lab, fs, color, "start"));
            lg.appendChild(item);
        });
        this.subSelectable(lg, "legend", this.t("Obj_Legend", "Legend"), powerbi.visuals.SubSelectionStylesType.Text);
        svg.appendChild(lg);
    }

    private noteMessages(hidden: number): string[] {
        const msgs: string[] = [];
        if (hidden > 0) {
            msgs.push((hidden === 1 ? this.t("UI_Hidden1", "1 question does not fit: turn on scrolling or set Row height to Automatic.")
                : this.t("UI_Hidden", "{0} questions do not fit: turn on scrolling or set Row height to Automatic.")).replace("{0}", String(hidden)));
        }
        if (this.orderVaries) {
            msgs.push(this.t("UI_OrderVaries", "Scale order is not one number per scale point: set its aggregation to Minimum. The mean uses positions 1, 2, 3…"));
        }
        if (this.truncatedAt) {
            msgs.push(this.t("UI_Truncated", "Showing the first {0} rows Power BI sent.").replace("{0}", String(this.truncatedAt)));
        }
        if (!this.proActive && this.attemptedPro.length && !this.editing) {
            msgs.push(this.t("UI_ReadingFree", "Pro features not applied in reading view:") + " " + this.attemptedPro.map(w => w.label).join(", "));
        }
        if (this.panels.length > PREVIEW_PANELS && !this.isPro && this.proPreview) {
            msgs.push(this.t("UI_PanelsPreview", "Pro preview: the first {0} of {1} panels")
                .replace("{0}", String(PREVIEW_PANELS)).replace("{1}", String(this.panels.length)));
        }
        return msgs;
    }

    private renderNote(msgs: string[], size: string): void {
        this.noteEl.style.display = msgs.length ? "block" : "none";
        // En tamaño pequeño, un icono "i": el texto completo va en el title.
        this.noteEl.textContent = size === "s" && msgs.length ? "ⓘ " + msgs.length : msgs.join(" · ");
        this.noteEl.title = msgs.join("\n");
        this.noteEl.style.color = this.dimInk();
    }

    private renderWatermark(w: number, h: number): void {
        const on = this.proPreview && this.attemptedPro.length > 0;
        const hc = this.hc();
        renderProWatermark(this.watermarkEl, on ? {
            width: w, height: h, title: this.t("UI_ProPreview", "Pro preview"), features: this.attemptedPro.map(x => x.label),
            highContrast: hc.on ? { foreground: hc.fg, background: hc.bg } : null,
        } : null);
    }

    /** Icono de aviso de la cabecera: filas que Power BI no ha entregado. */
    private warnings(): void {
        const host: any = this.host;
        if (typeof host.displayWarningIcon !== "function") { return; }
        if (this.truncatedAt && this.hasData) {
            host.displayWarningIcon(this.t("UI_WarnTitle", "Likert Survey Pro"), (this.isDesktop
                ? this.t("UI_WarnRowsDesktop", "In Power BI Desktop the visual uses the first rows Power BI sends: publish to the service to use them all.")
                : this.t("UI_WarnRows", "Power BI sent only part of the rows: the chart reflects the rows received.")) + " (" + this.truncatedAt + ")");
        } else if (typeof host.hideWarningIcon === "function") { host.hideWarningIcon(); }
    }

    private attachTooltips(): void {
        const svc: any = (this.host as any).tooltipService;
        if (!svc) { return; }
        const segs = this.svg.querySelectorAll("[data-seg]");
        segs.forEach(node => {
            const show = (ev: MouseEvent | FocusEvent) => {
                const r = (node as SVGElement).getBoundingClientRect();
                const sg: Segment = (node as any).__seg;
                svc.show({
                    dataItems: sg.tooltip,
                    identities: sg.ids,
                    coordinates: [(ev as MouseEvent).clientX ?? r.left + r.width / 2,
                                  (ev as MouseEvent).clientY ?? r.top],
                    isTouchEvent: false
                });
            };
            node.addEventListener("mousemove", show as EventListener);
            node.addEventListener("focus", show as EventListener);
            const hide = () => svc.hide({ immediately: false, isTouchEvent: false });
            node.addEventListener("mouseout", hide);
            node.addEventListener("blur", hide);
        });
    }

    // ── Selección: todas las identidades de cada marca ────────────────────────

    private onClick(e: MouseEvent): void {
        if (this.formatMode) { return; }
        const t = e.target as Element;
        const multi = e.ctrlKey || e.metaKey;
        const seg = t?.closest?.("[data-seg]") as any;
        if (seg) { e.stopPropagation(); this.selectUnit("s:" + seg.__seg.key, seg.__seg.ids, multi); return; }
        const q = t?.closest?.("[data-q]") as any;
        if (q?.__row) { e.stopPropagation(); this.selectUnit("q:" + q.__row.qKey, this.rowIdsFor(q.__row.qKey), multi); return; }
        const leg = t?.closest?.("[data-leg]") as Element | null;
        if (leg) {
            const i = Number(leg.getAttribute("data-leg"));
            if (this.responseIds[i]) { e.stopPropagation(); this.selectUnit("r:" + i, [this.responseIds[i]], multi); }
            return;
        }
        if (!this.canInteract) { return; }
        this.selUnits = new Map(); this.restoredIds = [];
        this.selectionManager.clear().then(() => this.paintSelection());
        this.paintSelection();
    }

    /** Una pregunta en todos los paneles: sus filas, todas. */
    private rowIdsFor(qKey: string): ISelectionId[] {
        const out: ISelectionId[] = [];
        this.rows.forEach(r => { if (r.qKey === qKey) { out.push(...r.ids); } });
        return out;
    }

    /**
     * Seleccionar una LISTA no alterna como un id suelto, así que la selección se calcula aquí
     * (alternar la unidad) y se pasa entera con select(todas, false), o clear() si queda vacía.
     */
    private selectUnit(key: string, ids: ISelectionId[], multi: boolean): void {
        if (!this.canInteract || !ids.length) { return; }
        const cur = this.selUnits;
        let next: Map<string, ISelectionId[]>;
        if (multi) {
            next = new Map(cur);
            if (next.has(key)) { next.delete(key); } else { next.set(key, ids); }
        } else {
            next = cur.size === 1 && cur.has(key) ? new Map() : new Map([[key, ids]]);
        }
        this.selUnits = next;
        this.restoredIds = [];
        const all: ISelectionId[] = [];
        next.forEach(v => all.push(...v));
        (all.length ? this.selectionManager.select(all, false) : this.selectionManager.clear()).then(() => this.paintSelection());
        this.paintSelection();
    }

    private keyOf(id: any): string {
        const k = id?.getKey?.();
        if (typeof k === "string") { return k; }
        const sel = id?.getSelector?.();
        return sel ? JSON.stringify(sel) : "#" + (++this.keySeq);
    }

    private paintSelection(): void {
        const units = this.selUnits;
        const ext = units.size ? [] : ((this.selectionManager.getSelectionIds() as ISelectionId[]) || []);
        const sel = ext.length ? ext : (units.size ? [] : this.restoredIds);
        const keys = new Set(sel.map(id => this.keyOf(id)));
        // Un marcador puede devolver la identidad con otra forma que la del clic: equals en los dos sentidos.
        const eq = (a: any, b: any) => !!(a?.equals?.(b) || b?.equals?.(a));
        const hit = (ids: ISelectionId[]) => ids.some(a => keys.has(this.keyOf(a))) || ids.some(a => sel.some(b => eq(a, b)));
        const active = units.size > 0 || sel.length > 0;
        this.svg.querySelectorAll("[data-seg]").forEach(node => {
            const sg: Segment = (node as any).__seg;
            const row: QuestionRow = (node as any).__row;
            let on = true;
            if (units.size) {
                on = units.has("s:" + sg.key) || units.has("q:" + row.qKey) || units.has("r:" + sg.responseIndex);
            } else if (sel.length) {
                on = hit(sg.ids) || hit(row.ids) || hit([this.responseIds[sg.responseIndex]].filter(x => !!x));
            }
            const op = !sg.highlighted ? 0.3 : (active && !on ? 0.35 : 1);
            (node as SVGElement).setAttribute("opacity", String(op));
            (node as SVGElement).setAttribute("aria-selected", active && on ? "true" : "false");
        });
    }

    // ── Teclado: roving tabindex, una sola parada de Tab ──────────────────────

    private restoreFocus(): void {
        const segs = this.svg.querySelectorAll("[data-seg]");
        if (!segs.length) { return; }
        const i = Math.max(0, Math.min(this.focusIndex, segs.length - 1));
        (segs[this.focusIndex >= 0 ? i : 0] as SVGElement).setAttribute("tabindex", "0");
    }

    private onKeyDown(e: KeyboardEvent): void {
        if ((e.target as Element)?.closest?.(".lk-guide,.lk-landing")) { return; }
        const segs = Array.from(this.svg.querySelectorAll("[data-seg]")) as SVGElement[];
        if (!segs.length) { return; }
        const cur = segs.indexOf(document.activeElement as any);
        let next = cur;
        switch (e.key) {
            case "ArrowRight": next = Math.min(cur + 1, segs.length - 1); break;
            case "ArrowLeft":  next = Math.max(cur - 1, 0); break;
            case "ArrowDown":
            case "ArrowUp": {
                // Misma respuesta en la pregunta de abajo o de arriba.
                const sg: Segment | undefined = cur >= 0 ? (segs[cur] as any).__seg : undefined;
                const dir = e.key === "ArrowDown" ? 1 : -1;
                let j = cur + dir;
                while (sg && j >= 0 && j < segs.length && (segs[j] as any).__seg.responseIndex !== sg.responseIndex) { j += dir; }
                next = j >= 0 && j < segs.length ? j : cur;
                break;
            }
            case "Home":       next = 0; break;
            case "End":        next = segs.length - 1; break;
            case "Enter":
            case " ":
                if (cur >= 0) {
                    e.preventDefault();
                    const sg: Segment = (segs[cur] as any).__seg;
                    this.selectUnit("s:" + sg.key, sg.ids, e.ctrlKey || e.metaKey);
                }
                return;
            case "Escape":
                if (!this.canInteract) { return; }
                this.selUnits = new Map(); this.restoredIds = [];
                this.selectionManager.clear().then(() => this.paintSelection());
                this.paintSelection();
                return;
            case "F10":
            case "ContextMenu":
                if ((e.key === "ContextMenu" || e.shiftKey) && cur >= 0 && this.canInteract) {
                    e.preventDefault();
                    const r = segs[cur].getBoundingClientRect();
                    const ids: ISelectionId[] = (segs[cur] as any).__seg.ids;
                    this.selectionManager.showContextMenu(ids.length ? ids[0] : ({} as ISelectionId),
                        { x: r.left + r.width / 2, y: r.top + r.height });
                }
                return;
            default: return;
        }
        e.preventDefault();
        segs.forEach(s => s.setAttribute("tabindex", "-1"));
        segs[next].setAttribute("tabindex", "0");
        (segs[next] as any).focus?.();
        this.focusIndex = next;
    }

    // ── Asistente de configuración (S18) ──────────────────────────────────────

    /**
     * Asistente en tres pasos, solo editando y con sitio: (1) tus campos, (2) probar funciones con tus
     * datos, (3) el estilo. No toca los pozos de datos. persistProperties SOLO desde un clic. ✕ o
     * Terminar lo cierran (style.guide = false); se vuelve a abrir en Formato → Style template.
     */
    private renderGuide(W: number, H: number): void {
        const el2 = this.guideEl;
        while (el2.firstChild) { el2.removeChild(el2.firstChild); }
        el2.style.display = "none";
        if (!this.editing || this.formatMode || !this.rawSettings.style.guide || !this.canInteract || !this.hasData || W < 420 || H < 260) { return; }
        const hc = this.hc();
        const blue = hc.on ? hc.sel : "#2B6CB0";
        const fg = hc.on ? hc.fg : "#252423";
        const muted = hc.on ? hc.fg : "#605E5C";
        el2.style.display = "block";
        el2.style.background = hc.on ? hc.bg : "#FFFFFF";
        el2.style.borderColor = blue;
        el2.style.color = fg;
        el2.setAttribute("role", "dialog");
        el2.setAttribute("aria-label", this.t("Guide_Title", "Setup guide"));
        el2.onclick = e => e.stopPropagation();
        el2.onpointerdown = e => e.stopPropagation();
        el2.onkeydown = e => e.stopPropagation();
        const mk = (tag: string, cls: string, txt?: string): HTMLElement => {
            const n = document.createElement(tag); n.className = cls; if (txt !== undefined) { n.textContent = txt; } return n;
        };
        const button = (label: string, primary: boolean, act: () => void): HTMLButtonElement => {
            const b = mk("button", "lk-g-btn", label) as HTMLButtonElement;
            b.type = "button";
            b.style.borderColor = blue;
            b.style.background = primary ? blue : "transparent";
            b.style.color = primary ? (hc.on ? hc.bg : "#FFFFFF") : blue;
            b.addEventListener("click", act);
            return b;
        };
        const go = (n: number) => { this.guideStep = n; this.renderGuide(W, H); };
        const finish = () => { this.guideStep = 1; this.persist("style", { guide: false }); };
        const head = mk("div", "lk-g-head");
        const step = mk("div", "", this.t("Guide_Step", "Setup · step {0} of 3").replace("{0}", String(this.guideStep)));
        step.style.color = blue;
        const close = mk("button", "lk-g-close", "✕") as HTMLButtonElement;
        close.type = "button";
        close.title = this.t("Guide_Close", "Close the guide");
        close.setAttribute("aria-label", close.title);
        close.style.color = muted;
        close.addEventListener("click", finish);
        head.appendChild(step); head.appendChild(close);
        el2.appendChild(head);
        const title = mk("div", "lk-g-title");
        el2.appendChild(title);
        const foot = mk("div", "lk-g-foot");
        const cols = this.lastDv?.metadata?.columns ?? [];
        const has = (role: string) => cols.some(c => c.roles?.[role]);
        const raw = this.rawSettings;
        const proChip = (parent: HTMLElement) => {
            if (this.isPro) { return; }
            const chip = mk("span", "lk-g-chip", "Pro");
            if (hc.on) { chip.style.background = "transparent"; chip.style.border = "1px solid " + fg; chip.style.color = fg; }
            parent.appendChild(chip);
        };
        if (this.guideStep === 1) {
            title.textContent = this.t("Guide_Fields", "Your data");
            const row = (done: boolean, nm: string, why: string, pro = false) => {
                const f = mk("div", "lk-g-item");
                const mark = mk("span", "", done ? "✓" : "○");
                mark.setAttribute("aria-label", done ? this.t("Guide_Done", "added") : this.t("Guide_Todo", "not added"));
                mark.style.color = done ? (hc.on ? fg : "#107C10") : muted;
                const txt = mk("span", "");
                txt.appendChild(mk("b", "", nm));
                if (pro) { proChip(txt); }
                txt.appendChild(document.createTextNode(" — " + why));
                txt.style.color = done ? muted : fg;
                f.appendChild(mark); f.appendChild(txt);
                el2.appendChild(f);
            };
            row(has("question"), this.t("Role_Question", "Question"), this.t("Guide_QuestionWhy", "one diverging bar per item; a hierarchy drills down"));
            row(has("response"), this.t("Role_Response", "Response"), this.t("Guide_ResponseWhy", "the scale points, from most negative to most positive"));
            row(has("value"), this.t("Role_Value", "Value"), this.t("Guide_ValueWhy", "the count of answers"));
            row(has("order"), this.t("Role_Order", "Scale order"), this.t("Guide_OrderWhy", "optional: a number per scale point fixes the order and the mean"));
            row(has("group") || cols.filter(c => c.roles?.["question"]).length >= 2, this.t("Guide_Group", "Group"), this.t("Guide_GroupWhy", "blocks of questions with a score per block"), true);
            row(has("panel"), this.t("Guide_Panel", "Small multiples"), this.t("Guide_PanelWhy", "one chart per region, year or team"), true);
            const note = mk("div", "lk-g-note", this.t("Guide_Wells", "Drag the fields into the field wells; this list updates by itself."));
            note.style.color = muted;
            el2.appendChild(note);
            foot.appendChild(button(this.t("Guide_Next", "Next"), true, () => go(2)));
        } else if (this.guideStep === 2) {
            title.textContent = this.t("Guide_TryTitle", "Try it on your data");
            const style = PRO_STYLES.indexOf(raw.style.template) >= 0;
            const boxes = raw.boxes.show && raw.boxes.showNps;
            const bench = raw.benchmark.show;
            const grid = raw.gridlines.show && raw.valueAxis.show;
            const pats = raw.accessibility.patterns;
            const tries: [string, string, boolean, boolean, () => void][] = [
                [this.t("Guide_TryStyles", "Collection styles"), this.t("Guide_TryStylesWhy", "six looks shared with KPI Card, Pareto and the rest of TCViz"),
                    true, style, () => this.persist("style", { template: style ? "clean" : "boardroom" })],
                [this.t("Guide_TryBoxes", "Top/Bottom box and NPS"), this.t("Guide_TryBoxesWhy", "the share at each end and the net score, in aligned columns"),
                    true, boxes, () => this.persist("boxes", { show: !boxes, showNps: !boxes })],
                [this.t("Guide_TryBench", "Benchmark line"), this.t("Guide_TryBenchWhy", "a target share of positive answers across every bar"),
                    true, bench, () => this.persist("benchmark", { show: !bench })],
                [this.t("Guide_TryGrid", "Axis and gridlines"), this.t("Guide_TryGridWhy", "percent marks either side of neutral"),
                    false, grid, () => { this.persist("gridlines", { show: !grid }); this.persist("valueAxis", { show: !grid }); }],
                [this.t("Guide_TryPatterns", "Patterns"), this.t("Guide_TryPatternsWhy", "scale points told apart without relying on colour"),
                    false, pats, () => this.persist("accessibility", { patterns: !pats })],
            ];
            for (const [nm, why, pro, on, act] of tries) {
                const f = mk("div", "lk-g-try");
                const txt = mk("span", "");
                txt.appendChild(mk("b", "", nm));
                if (pro) { proChip(txt); }
                txt.appendChild(document.createTextNode(" — " + why));
                const b = button(on ? this.t("Guide_On", "On") : this.t("Guide_Try", "Try"), on, act);
                b.setAttribute("aria-pressed", String(on));
                f.appendChild(txt); f.appendChild(b);
                el2.appendChild(f);
            }
            if (!this.isPro) {
                const note = mk("div", "lk-g-note", this.t("Guide_TryNote", "Without a licence Pro features show under a watermark while you edit; reading view shows the free chart."));
                note.style.color = muted;
                el2.appendChild(note);
            }
            foot.appendChild(button(this.t("Guide_Back", "Back"), false, () => go(1)));
            foot.appendChild(button(this.t("Guide_Next", "Next"), true, () => go(3)));
        } else {
            title.textContent = this.t("Guide_Style", "Pick a style");
            const current = raw.style.template;
            const grid = mk("div", "lk-g-grid");
            const names: [string, string][] = [["clean", this.t("Enum_TplClean", "Report theme")],
                ...PRO_STYLES.map(k => [k, this.t("Enum_Tpl" + k.charAt(0).toUpperCase() + k.slice(1), k.charAt(0).toUpperCase() + k.slice(1) + " (Pro)")] as [string, string])];
            for (const [nm, label] of names) {
                const chip = mk("button", "lk-g-tpl") as HTMLButtonElement;
                chip.type = "button";
                chip.setAttribute("aria-pressed", String(nm === current));
                chip.style.borderColor = nm === current ? blue : (hc.on ? fg : "#C8C6C4");
                chip.style.borderWidth = nm === current ? "2px" : "1px";
                chip.appendChild(this.miniLikert(nm, hc.on));
                chip.appendChild(mk("div", "", this.isPro ? label.replace(/\s*\(Pro\)\s*$/, "") : label));
                chip.addEventListener("click", () => this.persist("style", { template: nm }));
                grid.appendChild(chip);
            }
            el2.appendChild(grid);
            foot.appendChild(button(this.t("Guide_Back", "Back"), false, () => go(2)));
            foot.appendChild(button(this.t("Guide_Finish", "Finish"), true, finish));
        }
        el2.appendChild(foot);
    }

    /** Miniatura de un estilo: tres barras divergentes con sus colores y su fondo. */
    private miniLikert(nm: string, hc: boolean): SVGSVGElement {
        const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
        svg.setAttribute("width", "64"); svg.setAttribute("height", "36"); svg.setAttribute("aria-hidden", "true");
        const tok = STYLE_TOKENS[nm];
        if (tok && !hc) { svg.style.background = tok.grad ?? tok.bg; }
        const s = this.rawSettings.colors;
        const neg = tok ? tok.down : s.negativeColor, pos = tok ? tok.up : s.positiveColor;
        const neu = tok ? mix(tok.grid, tok.axis, 0.35) : s.neutralColor;
        const fg = this.host.colorPalette?.foreground?.value ?? "#000000";
        [[6, 14, 10, 18], [10, 9, 8, 20], [4, 18, 6, 14]].forEach(([a, b, c, d], i) => {
            const y = 5 + i * 10;
            let x = 32 - a - b / 2;
            for (const [wd, col] of [[a, neg], [b, neu], [c, mix(neu, pos, 0.5)], [d, pos]] as [number, string][]) {
                const r = rect(x, y, wd, 7, hc ? "none" : col);
                if (hc) { r.setAttribute("stroke", fg); }
                svg.appendChild(r);
                x += wd;
            }
        });
        return svg;
    }

    /** Guardar un ajuste. Solo desde un clic del asistente: nunca en el callback de selección (marcadores). */
    private persist(objectName: string, properties: any): void {
        this.host.persistProperties({ merge: [{ objectName, selector: null as any, properties }] });
    }

    // ── Formato desde el lienzo (on-object) ───────────────────────────────────

    private subSelectable(node: Element, objectName: string, displayName: string, type: powerbi.visuals.SubSelectionStylesType): void {
        if (!this.formatMode) { node.classList.remove(HtmlSubSelectableClass); return; }
        node.classList.add(HtmlSubSelectableClass);
        node.setAttribute(SubSelectableObjectNameAttribute, objectName);
        node.setAttribute(SubSelectableDisplayNameAttribute, displayName);
        node.setAttribute(SubSelectableTypeAttribute, String(type));
    }

    private updateOutlines(options: VisualUpdateOptions): void {
        if (!this.formatMode) { return; }
        const subs = (options as any).subSelections as powerbi.visuals.CustomVisualSubSelection[] | undefined;
        this.subSelectionHelper.updateOutlinesFromSubSelections(subs ?? [], true);
    }

    private getSubSelectionStyles(subs: powerbi.visuals.CustomVisualSubSelection[]): powerbi.visuals.SubSelectionStyles | undefined {
        const nm = subs[0]?.customVisualObjects[0]?.objectName;
        const ref = (objectName: string, propertyName: string, label: string) => ({ reference: { objectName, propertyName }, label });
        const Text = powerbi.visuals.SubSelectionStylesType.Text, Shape = powerbi.visuals.SubSelectionStylesType.Shape;
        switch (nm) {
            case "colors":
                return { type: Shape, fill: ref("colors", "positiveColor", this.t("Prop_ColorsPositiveColor", "Positive end")) } as any;
            case "qtable":
                return { type: Text,
                    fontFamily: ref("qtable", "questionFontFamily", this.t("Prop_QtableQuestionFontFamily", "Question font")),
                    fontSize: ref("qtable", "questionFontSize", this.t("Prop_QtableQuestionFontSize", "Question text size")),
                    fontColor: ref("qtable", "questionColor", this.t("Prop_QtableQuestionColor", "Question text color")) } as any;
            case "legend":
                return { type: Text,
                    fontSize: ref("legend", "fontSize", this.t("Prop_LegendFontSize", "Text size (0 = as labels)")),
                    fontColor: ref("legend", "color", this.t("Prop_LegendColor", "Text color")) } as any;
            case "valueAxis":
                return { type: Text,
                    fontSize: ref("valueAxis", "fontSize", this.t("Prop_ValueAxisFontSize", "Text size")),
                    fontColor: ref("valueAxis", "color", this.t("Prop_ValueAxisColor", "Text color")) } as any;
            case "categoryAxis":
                return { type: Text,
                    fontSize: ref("categoryAxis", "fontSize", this.t("Prop_CategoryAxisFontSize", "Title size")),
                    fontColor: ref("categoryAxis", "color", this.t("Prop_CategoryAxisColor", "Title color")) } as any;
            case "gridlines":
                return { type: Shape, stroke: ref("gridlines", "color", this.t("Prop_GridlinesColor", "Line color")) } as any;
            case "smallMultiples":
                return { type: Text,
                    bold: ref("smallMultiples", "titleBold", this.t("Prop_SmTitleBold", "Bold title")),
                    fontSize: ref("smallMultiples", "titleSize", this.t("Prop_SmTitleSize", "Title size")),
                    fontColor: ref("smallMultiples", "titleColor", this.t("Prop_SmTitleColor", "Title color")) } as any;
            case "background":
                return { type: Shape, fill: ref("background", "color", this.t("Prop_BackgroundColor", "Color")) } as any;
        }
        return undefined;
    }

    private getSubSelectionShortcuts(subs: powerbi.visuals.CustomVisualSubSelection[]): powerbi.visuals.VisualSubSelectionShortcuts | undefined {
        const nm = subs[0]?.customVisualObjects[0]?.objectName;
        const id = (objectName: string, propertyName: string) => ({ objectName, propertyName });
        // El uid de cada tarjeta lo pone FormattingSettingsService: "<nombre>-card".
        const nav = (card: string, label: string) => ({ type: powerbi.visuals.VisualShortcutType.Navigate, destinationInfo: { cardUid: "Visual-" + card + "-card" }, label });
        const toggle = (o: string, p: string, off: string, offFb: string, on: string, onFb: string) =>
            ({ type: powerbi.visuals.VisualShortcutType.Toggle, ...id(o, p), relatedToggledFormattingIds: [id(o, p)], disabledLabel: this.t(off, offFb), enabledLabel: this.t(on, onFb) });
        switch (nm) {
            case "colors":
                return [
                    toggle("labels", "showValues", "UI_HideLabels", "Hide labels", "UI_ShowLabels", "Show labels"),
                    { type: powerbi.visuals.VisualShortcutType.Picker, ...id("style", "template"), label: this.t("Prop_StyleTemplate", "Template") },
                    { type: powerbi.visuals.VisualShortcutType.Divider },
                    nav("colors", this.t("Obj_Colors", "Colors")),
                    nav("layout", this.t("Obj_Layout", "Layout")),
                ] as any;
            case "qtable":
                return [
                    { type: powerbi.visuals.VisualShortcutType.Reset, relatedResetFormattingIds: [id("qtable", "questionFontSize"), id("qtable", "questionColor"), id("qtable", "questionFontFamily")] },
                    nav("qtable", this.t("Obj_Qtable", "Question table")),
                ] as any;
            case "legend":
                return [
                    toggle("legend", "show", "UI_HideLegend", "Hide legend", "UI_ShowLegend", "Show legend"),
                    { type: powerbi.visuals.VisualShortcutType.Picker, ...id("legend", "position"), label: this.t("Prop_LegendPosition", "Position") },
                    { type: powerbi.visuals.VisualShortcutType.Divider },
                    nav("legend", this.t("Obj_Legend", "Legend")),
                ] as any;
            case "valueAxis":
                return [
                    toggle("valueAxis", "show", "UI_HideAxis", "Hide axis labels", "UI_ShowAxis", "Show axis labels"),
                    toggle("valueAxis", "showTitle", "UI_HideTitle", "Hide title", "UI_ShowTitle", "Show title"),
                    { type: powerbi.visuals.VisualShortcutType.Divider },
                    nav("valueAxis", this.t("Obj_ValueAxis", "Value axis")),
                ] as any;
            case "categoryAxis":
                return [
                    toggle("categoryAxis", "showTitle", "UI_HideTitle", "Hide title", "UI_ShowTitle", "Show title"),
                    nav("categoryAxis", this.t("Obj_CategoryAxis", "Category axis")),
                ] as any;
            case "gridlines":
                return [
                    toggle("gridlines", "show", "UI_HideGrid", "Hide gridlines", "UI_ShowGrid", "Show gridlines"),
                    nav("gridlines", this.t("Obj_Gridlines", "Gridlines")),
                ] as any;
            case "smallMultiples":
                return [nav("smallMultiples", this.t("Obj_SmallMultiples", "Small multiples"))] as any;
            case "background":
                return [
                    { type: powerbi.visuals.VisualShortcutType.Reset, relatedResetFormattingIds: [id("background", "color")] },
                    nav("background", this.t("Obj_Background", "Background")),
                ] as any;
        }
        return undefined;
    }

    // ── Ajustes ───────────────────────────────────────────────────────────────

    /**
     * Panel de formato con la API nueva. El modelo declarativo muestra SIEMPRE lo que eligió
     * el usuario, no lo que pinta el tier gratuito: si mostrara lo gateado, un ajuste Pro se
     * apagaría solo al activarlo y parecería roto.
     */
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        const card: any = this.formattingModel.qtable;
        // Se rehacen los controles de color en cada pasada: los bloques dependen del dato.
        card.slices = card.slices.filter((sl: any) => sl.name !== "blockFillColor");
        const extra: any[] = [];
        // Un selector por bloque, con su propia identidad. Gratis: es cosmetico, y los
        // colores del tema ya lo eran.
        this.blocks.forEach(b => {
            if (!b.sid) { return; }
            extra.push(makeBlockColorSlice(b.name, b.color, b.sid.getSelector()));
        });
        card.slices.splice(3, 0, ...extra);
        // La altura fija solo tiene sentido con "Row height: Fixed".
        const lay: any = this.formattingModel.layout;
        lay.rowHeight.visible = this.rawSettings.layout.rowHeightMode === "fixed";
        return this.formattingService.buildFormattingModel(this.formattingModel);
    }
}

// ── Utilidades ────────────────────────────────────────────────────────────────

interface IValueFormatterLike { format(v: number): string; }

function boxTxt(r: { topBox: number; bottomBox: number }): string {
    return `${(r.topBox * 100).toFixed(0)}% / ${(r.bottomBox * 100).toFixed(0)}%`;
}

function npsTxt(r: { topBox: number; bottomBox: number }): string {
    const v = (r.topBox - r.bottomBox) * 100;
    return `${v >= 0 ? "+" : ""}${v.toFixed(0)}`;
}

function el(tag: string): SVGElement {
    return document.createElementNS(SVG_NS, tag) as SVGElement;
}

function rect(x: number, y: number, w: number, h: number, fill: string): SVGElement {
    const r = el("rect");
    r.setAttribute("x", String(x)); r.setAttribute("y", String(y));
    r.setAttribute("width", String(Math.max(0, w))); r.setAttribute("height", String(Math.max(0, h)));
    r.setAttribute("fill", fill);
    return r;
}

function line(x1: number, y1: number, x2: number, y2: number, stroke: string, width: number): SVGElement {
    const l = el("line");
    l.setAttribute("x1", String(x1)); l.setAttribute("x2", String(x2));
    l.setAttribute("y1", String(y1)); l.setAttribute("y2", String(y2));
    l.setAttribute("stroke", stroke); l.setAttribute("stroke-width", String(width));
    return l;
}

function text(x: number, y: number, content: string, size: number, color: string, anchor: string): SVGElement {
    const t = el("text");
    t.setAttribute("x", String(x)); t.setAttribute("y", String(y));
    t.setAttribute("font-size", String(Math.max(minText, size)));
    t.setAttribute("fill", color);
    t.setAttribute("text-anchor", anchor);
    t.setAttribute("font-family", "'Segoe UI',system-ui,sans-serif");
    t.textContent = content;   // nunca innerHTML: es dato del usuario
    return t;
}

/** Ancho estimado con el tamaño de fuente real: 0.58 em de media en Segoe UI. */
function ellipsis(s: string, maxPx: number, fontSize: number): string {
    const per = Math.max(minText, fontSize) * 0.58;
    const max = Math.max(3, Math.floor((maxPx - 6) / per));
    return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function mix(a: string, b: string, t: number): string {
    const A = hex(a), B = hex(b), k = Math.max(0, Math.min(1, t));
    const c = (i: number) => Math.round(A[i] + (B[i] - A[i]) * k);
    const hx = (v: number) => (v < 16 ? "0" : "") + v.toString(16);
    return `#${hx(c(0))}${hx(c(1))}${hx(c(2))}`;
}

function hex(c: string): number[] {
    const m = /^#?([0-9a-f]{6})$/i.exec((c || "").trim());
    if (!m) { return [128, 128, 128]; }
    const v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Texto legible sobre el relleno: luminancia relativa simplificada. */
function readable(bg: string): string {
    const [r, g, b] = hex(bg);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#2E3440" : "#FFFFFF";
}
