/*
 *  Likert Survey Pro — TCViz
 *
 *  Barras apiladas divergentes para datos de encuesta, centradas en la respuesta neutra.
 *  Sin acceso a red, sin almacenamiento y sin innerHTML: privileges es [] y nada sale
 *  del informe. Ver docs/CERTIFICATION-NOTES.md.
 */
"use strict";

import powerbi from "powerbi-visuals-api";
import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import IValueFormatter = valueFormatter.IValueFormatter;

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
    makeBlockColorSlice, SP_IDENTIFIER, matchesPlan, FREE_MAX_RESPONSES
} from "./settings";

const SVG_NS = "http://www.w3.org/2000/svg";
/** ServicePlanState: Active = 1, Warning = 2 (periodo de gracia: ya pagó). */
const STATE_ACTIVE = 1;
const STATE_WARNING = 2;
/** Etiquetas de las funciones Pro, como las nombra el aviso de compra. */
const PRO_BOXES = "Top/Bottom box";
const PRO_NPS = "NPS";
const PRO_BENCHMARK = "the benchmark line";
const PRO_GROUPS = "question groups";

interface Segment {
    responseIndex: number;
    label: string;
    value: number;
    share: number;        // 0..1 sobre el total de la pregunta
    color: string;
    selectionId: ISelectionId;
    tooltip: VisualTooltipDataItem[];
    highlighted: boolean;
}

interface QuestionRow {
    question: string;
    group: string | null;
    total: number;
    segments: Segment[];
    negShare: number;     // parte que queda a la izquierda del centro
    posShare: number;
    topBox: number;
    bottomBox: number;
    /** Puntuacion media de la pregunta sobre la escala. */
    mean: number;
    selectionId: ISelectionId;
    /** Identidad del BLOQUE, para el color por bloque y su regla. */
    groupSelectionId: ISelectionId | null;
    /** Color del bloque puesto a mano o por regla; null = el del tema. */
    groupColor: string | null;
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private root: HTMLElement;
    private svg: SVGSVGElement;
    /** El area que se desplaza. La leyenda vive fuera para no irse con el scroll. */
    private scrollHost: HTMLDivElement;
    private legendHost: HTMLDivElement;
    private legendSvg: SVGSVGElement;
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
    private attemptedPro: string[] = [];
    /** Vista previa Pro: Free, editando, con la licencia resuelta y legible. */
    private proPreview = false;
    private editing = false;

    private settings: LikertSettings = JSON.parse(JSON.stringify(defaultSettings));
    private rawSettings: LikertSettings = JSON.parse(JSON.stringify(defaultSettings));
    private formattingService: FormattingSettingsService;
    private formattingModel: LikertFormattingModel = new LikertFormattingModel();
    private localization: powerbi.extensibility.ILocalizationManager;
    private lastOptions: VisualUpdateOptions | null = null;
    private rows: QuestionRow[] = [];
    private responseLabels: string[] = [];
    private responseColors: string[] = [];
    /** Bloques presentes, para emitir un selector de color por cada uno. */
    private blocks: Array<{ name: string; sid: ISelectionId | null; color: string;
                            mean: number; positive: number; nps: number }> = [];
    /** Puntuacion numerica de cada punto de escala: la del pozo, o su posicion. */
    private responseScores: number[] = [];
    private focusIndex = -1;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.selectionManager = options.host.createSelectionManager();
        this.licenseManager = (options.host as any).licenseManager;
        this.localization = options.host.createLocalizationManager();
        this.formattingService = new FormattingSettingsService(this.localization);

        this.root = document.createElement("div");
        this.root.className = "likert-survey-pro";
        this.root.style.cssText = "width:100%;height:100%;position:relative;overflow:hidden;" +
            "font-family:'Segoe UI',system-ui,sans-serif;box-sizing:border-box;";
        this.root.setAttribute("aria-label", "Likert survey chart");
        options.element.appendChild(this.root);

        // Dos capas: la leyenda fija y el grafico desplazable. Si la leyenda se fuera con
        // el scroll, el usuario perderia la referencia de colores justo al mirar las filas
        // de abajo, que es cuando mas la necesita.
        this.scrollHost = document.createElement("div");
        this.scrollHost.style.cssText = "position:absolute;left:0;right:0;overflow-x:hidden;";
        this.root.appendChild(this.scrollHost);

        this.svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
        this.svg.style.display = "block";
        this.scrollHost.appendChild(this.svg);

        this.legendHost = document.createElement("div");
        this.legendHost.style.cssText = "position:absolute;left:0;right:0;overflow:hidden;";
        this.root.appendChild(this.legendHost);

        this.legendSvg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
        this.legendSvg.style.display = "block";
        this.legendHost.appendChild(this.legendSvg);

        // Marca de agua de la vista previa Pro. Blanca con contorno oscuro: un gris
        // translúcido desaparece sobre barras saturadas. No intercepta clics ni entra en
        // el recorrido del lector de pantalla.
        this.watermarkEl = document.createElement("div");
        this.watermarkEl.setAttribute("aria-hidden", "true");
        this.watermarkEl.textContent = "Pro preview";
        this.watermarkEl.style.cssText =
            "position:absolute;left:0;top:0;right:0;bottom:0;display:none;align-items:center;" +
            "justify-content:center;pointer-events:none;z-index:5;font:700 32px 'Segoe UI',sans-serif;" +
            "color:#FFFFFF;opacity:0.55;transform:rotate(-20deg);" +
            "text-shadow:0 0 2px rgba(46,52,64,0.85),0 1px 3px rgba(46,52,64,0.65);";
        this.root.appendChild(this.watermarkEl);

        this.injectStyles();

        this.svg.addEventListener("contextmenu", (e: MouseEvent) => {
            const seg = (e.target as HTMLElement)?.closest?.("[data-seg]") as SVGElement | null;
            const sid = seg ? (seg as any).__sid : null;
            this.selectionManager.showContextMenu(sid ?? {}, { x: e.clientX, y: e.clientY });
            e.preventDefault();
        });
        this.svg.addEventListener("click", (e: MouseEvent) => {
            if ((this.host as any).allowInteractions === false) { return; }
            const seg = (e.target as HTMLElement)?.closest?.("[data-seg]") as SVGElement | null;
            if (!seg) { this.selectionManager.clear(); return; }
            const sid = (seg as any).__sid as ISelectionId;
            this.selectionManager.select(sid, e.ctrlKey || e.metaKey);
            e.stopPropagation();
        });
        this.root.addEventListener("keydown", (e: KeyboardEvent) => this.onKeyDown(e));
    }

    /** El .less puede no empaquetarse según la versión de tools: el CSS va desde aquí. */
    private injectStyles(): void {
        const id = "likert-survey-pro-styles";
        const doc = this.root.ownerDocument ?? document;
        if (doc.getElementById(id)) { return; }
        const st = doc.createElement("style");
        st.id = id;
        st.textContent =
            ".likert-survey-pro [data-seg]{cursor:pointer}" +
            ".likert-survey-pro [data-seg]:focus{outline:none}" +
            ".likert-survey-pro [data-seg]:focus-visible{outline:none}";
        (doc.head ?? this.root).appendChild(st);
    }

    // ── Licencia ──────────────────────────────────────────────────────────────

    /** La licencia nunca en el camino crítico del render. */
    private requestLicenseDeferred(): void {
        if (this.licenseRequested || this.isPro) { return; }
        this.licenseRequested = true;
        window.setTimeout(() => {
            try {
                const lm = this.licenseManager;
                if (!lm) { this.licenseResolved = true; this.afterLicense(); return; }
                lm.getAvailableServicePlans().then(
                    (r: any) => {
                        this.licenseEnvSupported = !r?.isLicenseUnsupportedEnv;
                        this.licenseInfoAvailable = r?.isLicenseInfoAvailable !== false;
                        this.isPro = !!(r?.plans?.some((p: any) =>
                            matchesPlan(p.spIdentifier, SP_IDENTIFIER) &&
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
        if (this.lastOptions) { this.update(this.lastOptions); }
    }

    private computePreview(): boolean {
        return !this.isPro && this.editing && this.licenseResolved
            && this.licenseEnvSupported && this.licenseInfoAvailable;
    }

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

            const added = this.attemptedPro.filter(a => this.notifiedPro.indexOf(a) === -1);
            this.notifiedPro = this.attemptedPro.slice();
            if (added.length === 0) { return; }
            this.noticeShown = true;

            const one = added.length === 1;
            const list = one ? added[0]
                : added.slice(0, -1).join(", ") + " and " + added[added.length - 1];
            const tpl = this.localization?.getDisplayName(one ? "LicenceNotice_One" : "LicenceNotice_Many")
                || `Likert Survey Pro: {0} ${one ? "is" : "are"} part of the Pro plan, shown as a watermarked preview.`;
            const msg = tpl.replace("{0}", list);

            const show = () => {
                try { lm.notifyFeatureBlocked?.(msg.slice(0, 500)); } catch (_) { /* best effort */ }
                this.cancelLicenseIcon();
                this.licenseIconTimer = window.setTimeout(() => {
                    this.licenseIconTimer = null;
                    if (this.isPro || this.notifiedPro.length === 0) { return; }
                    // LicenseNotificationType.General es const enum: 0 en runtime.
                    try { lm.notifyLicenseRequired?.(0); } catch (_) { /* best effort */ }
                }, 10500);
            };
            const cleared = lm.clearLicenseNotification?.();
            if (cleared && typeof cleared.then === "function") { cleared.then(show, show); }
            else { show(); }
        } catch (_) { /* nunca romper el render por un aviso */ }
    }

    private updateWatermark(): void {
        // El render reconstruye el SVG, no el contenedor, pero se reinserta por seguridad:
        // encender la marca sobre un nodo desconectado no pinta nada.
        if (this.watermarkEl.parentNode !== this.root) { this.root.appendChild(this.watermarkEl); }
        const show = this.proPreview && this.attemptedPro.length > 0;
        this.watermarkEl.style.display = show ? "flex" : "none";
        if (!show) { return; }
        const size = Math.max(20, Math.min(72, Math.round((this.root.clientWidth || 0) * 0.09)));
        this.watermarkEl.style.fontSize = `${size}px`;
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);
        try {
            this.lastOptions = options;
            const dv = options.dataViews?.[0];
            const w = Math.max(options.viewport.width, 1);
            const h = Math.max(options.viewport.height, 1);

            const viewMode = (options as any).viewMode;
            this.editing = typeof viewMode === "number" && viewMode !== 0;
            this.proPreview = this.computePreview();

            if (!dv?.categorical?.categories?.length || !dv.categorical.values?.length) {
                this.attemptedPro = [];
                this.proPreview = false;
                this.updateWatermark();
                this.renderLanding(w, h);
                this.requestLicenseDeferred();
                this.events.renderingFinished(options);
                return;
            }

            this.formattingModel = this.formattingService.populateFormattingSettingsModel(LikertFormattingModel, dv);
            this.rawSettings = toSettings(this.formattingModel);
            const proNow = this.isPro || this.proPreview;
            this.settings = proNow ? this.rawSettings : freeSettings(this.rawSettings);

            this.buildRows(dv);
            this.computeAttemptedPro(dv);
            this.render(w, h);

            this.requestLicenseDeferred();
            this.syncLicenseNotification();
            this.updateWatermark();

            this.events.renderingFinished(options);
        } catch (e) {
            this.events.renderingFailed(options, String(e));
        }
    }

    /** Lo que el usuario ha pedido y el tier gratuito no da. Se calcula ANTES de apagarlo. */
    private computeAttemptedPro(dv: DataView): void {
        const raw = this.rawSettings;
        const w: string[] = [];
        if (raw.boxes.show) { w.push(PRO_BOXES); }
        if (raw.boxes.showNps) { w.push(PRO_NPS); }
        if (raw.benchmark.show) { w.push(PRO_BENCHMARK); }
        if (dv.categorical?.categories?.some(c => c.source.roles?.["group"])) { w.push(PRO_GROUPS); }
        this.attemptedPro = this.isPro ? [] : w;
    }

    // ── Datos ─────────────────────────────────────────────────────────────────

    private buildRows(dv: DataView): void {
        const cat = dv.categorical;
        const qCol = cat.categories.find(c => c.source.roles?.["question"]) ?? cat.categories[0];
        const gCol = cat.categories.find(c => c.source.roles?.["group"]);
        const groups = this.sortByScaleOrder(cat.values.grouped ? cat.values.grouped() : []);
        const proNow = this.isPro || this.proPreview;

        const fmt: IValueFormatter = valueFormatter.create({
            format: cat.values[0]?.source?.format || "",
            cultureSelector: this.host.locale
        });

        // Orden de la escala: el de los grupos, que sigue la ordenación del modelo.
        const kept = groups.slice(0, FREE_MAX_RESPONSES);
        this.responseLabels = kept.map(g => String(g.name ?? ""));
        // La puntuacion sale del pozo Scale order si esta relleno; si no, de la posicion.
        // Sin eso, una media sobre una escala sin numeros no significaria nada.
        this.responseScores = kept.map((g, i) => {
            const col = (g.values as any[]).find(v => v?.source?.roles?.order);
            if (col) {
                for (let k = 0; k < (col.values?.length ?? 0); k++) {
                    const v = col.values[k];
                    if (v !== null && v !== undefined && isFinite(Number(v))) { return Number(v); }
                }
            }
            return i + 1;
        });
        this.responseColors = this.scaleColors(kept.length, dv);

        const n = qCol.values.length;
        const s = this.settings;
        const negN = Math.max(0, Math.min(s.scale.negativeCount, kept.length));
        const neutralIdx = s.scale.neutralMode === "split" ? negN : -1;

        const hasHl = kept.some(g => (g.values?.[0] as any)?.highlights != null);
        this.rows = [];

        for (let i = 0; i < n; i++) {
            const segs: Segment[] = [];
            let total = 0;
            kept.forEach((g, gi) => {
                if (gi === neutralIdx && s.scale.neutralMode === "exclude") { return; }
                const col: any = (g.values as any[]).find(v => v?.source?.roles?.value) ?? g.values[0];
                const v = Number(col?.values?.[i] ?? 0) || 0;
                total += v;
            });
            if (total <= 0) { continue; }

            kept.forEach((g, gi) => {
                if (s.scale.neutralMode === "exclude" && gi === neutralIdx) { return; }
                const col: any = (g.values as any[]).find(v => v?.source?.roles?.value) ?? g.values[0];
                const v = Number(col?.values?.[i] ?? 0) || 0;
                const hl = (col?.highlights?.[i] ?? null) != null;
                const sid = this.host.createSelectionIdBuilder()
                    .withCategory(qCol, i)
                    .withSeries(dv.categorical.values, g)
                    .createSelectionId();
                const tip: VisualTooltipDataItem[] = [
                    { displayName: String(qCol.values[i] ?? ""), value: String(g.name ?? ""),
                      color: this.responseColors[gi] },
                    { displayName: "Value", value: fmt.format(v) },
                    { displayName: "Share", value: `${(total ? v / total * 100 : 0).toFixed(1)}%` }
                ];
                (g.values as any[]).filter(v2 => v2?.source?.roles?.tooltips).forEach(v2 => {
                    tip.push({ displayName: v2.source.displayName || "", value: String(v2.values?.[i] ?? "") });
                });
                segs.push({
                    responseIndex: gi, label: String(g.name ?? ""), value: v,
                    share: total ? v / total : 0, color: this.responseColors[gi],
                    selectionId: sid, tooltip: tip,
                    highlighted: !hasHl || hl
                });
            });

            let neg = 0, pos = 0;
            segs.forEach(sg => {
                if (sg.responseIndex < negN) { neg += sg.share; }
                else if (sg.responseIndex === neutralIdx) { neg += sg.share / 2; pos += sg.share / 2; }
                else { pos += sg.share; }
            });

            const boxN = Math.max(1, Math.min(s.boxes.size, kept.length));
            const top = segs.filter(sg => sg.responseIndex >= kept.length - boxN)
                            .reduce((a, sg) => a + sg.share, 0);
            const bottom = segs.filter(sg => sg.responseIndex < boxN)
                               .reduce((a, sg) => a + sg.share, 0);

            const media = total
                ? segs.reduce((a, sg) => a + (this.responseScores[sg.responseIndex] ?? 0) * sg.value, 0) / total
                : 0;
            this.rows.push({
                question: String(qCol.values[i] ?? ""),
                group: gCol && proNow ? String(gCol.values[i] ?? "") : null,
                groupSelectionId: gCol
                    ? this.host.createSelectionIdBuilder().withCategory(gCol, i).createSelectionId()
                    : null,
                // El color del bloque llega en los objects de su propia columna. Se mira
                // tambien la de preguntas porque, segun como resuelva la regla, el color
                // puede aterrizar ahi: leer los dos sitios sale gratis y evita un viaje.
                groupColor: gCol
                    ? (((gCol as any).objects?.[i]?.qtable?.blockFillColor?.solid?.color) || null)
                    : null,
                total, segments: segs, negShare: neg, posShare: pos,
                topBox: top, bottomBox: bottom, mean: media,
                selectionId: this.host.createSelectionIdBuilder().withCategory(qCol, i).createSelectionId()
            });
        }
        this.sortRowsByGroup();
        this.collectBlocks();
    }

    /** Un bloque por nombre, en su orden de aparicion, con el color que toca mostrar. */
    private collectBlocks(): void {
        const pal: any = (this.host as any).colorPalette;
        const vistos = new Map<string, number>();
        this.blocks = [];
        this.rows.forEach(r => {
            const n = r.group;
            if (n === null || vistos.has(n)) { return; }
            vistos.set(n, this.blocks.length);
            // Los agregados del bloque se ponderan por respuestas, no por preguntas: una
            // pregunta con 95 respuestas no puede pesar lo mismo que otra con 250.
            const suyas = this.rows.filter(x => x.group === n);
            const peso = suyas.reduce((a, x) => a + x.total, 0) || 1;
            this.blocks.push({
                name: n,
                sid: r.groupSelectionId,
                color: r.groupColor ?? pal?.getColor?.(n)?.value ?? "#5E81AC",
                mean:     suyas.reduce((a, x) => a + x.mean * x.total, 0) / peso,
                positive: suyas.reduce((a, x) => a + x.posShare * x.total, 0) / peso,
                nps:      suyas.reduce((a, x) => a + (x.topBox - x.bottomBox) * x.total, 0) / peso,
            });
        });
    }

    /**
     * Agrupar solo tiene sentido si las filas del mismo bloque van juntas: si llegan
     * intercaladas, el encabezado se repite en casi cada fila y no agrupa nada. Se respeta
     * el orden de aparicion de los bloques y, dentro de cada uno, el de las preguntas.
     */
    private sortRowsByGroup(): void {
        if (!this.rows.some(r => r.group !== null)) { return; }
        const orden = new Map<string, number>();
        this.rows.forEach(r => {
            const k = r.group ?? "";
            if (!orden.has(k)) { orden.set(k, orden.size); }
        });
        this.rows = this.rows
            .map((r, i) => ({ r, i, g: orden.get(r.group ?? "") ?? 0 }))
            .sort((a, b) => a.g - b.g || a.i - b.i)
            .map(x => x.r);
    }

    /**
     * Orden de la escala. Depender de que el usuario haya configurado "Ordenar por columna"
     * en el modelo es frágil: si no lo hace, Power BI entrega las respuestas alfabéticamente
     * y el gráfico queda sin sentido SIN avisar. Con el pozo "Scale order" el orden es
     * explícito y vive en el propio visual. Sin ese pozo se respeta el orden que llega.
     */
    private sortByScaleOrder(groups: any[]): any[] {
        const rank = (g: any): number | null => {
            const col = (g?.values as any[])?.find(v => v?.source?.roles?.order);
            if (!col) { return null; }
            // El MINIMO, no el primer valor: si el usuario deja la agregacion en Suma y hay
            // varias filas por celda, cualquier estadistico se infla, pero el minimo es el
            // menos sensible y con Minimo/Media/Primero da el valor exacto.
            let min: number | null = null;
            for (let i = 0; i < (col.values?.length ?? 0); i++) {
                const v = col.values[i];
                if (v === null || v === undefined || !isFinite(Number(v))) { continue; }
                const n = Number(v);
                if (min === null || n < min) { min = n; }
            }
            return min;
        };
        const ranks = groups.map(rank);
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
    private scaleColors(count: number, dv: DataView): string[] {
        const s = this.settings.colors;
        const groups = dv.categorical.values.grouped ? dv.categorical.values.grouped() : [];
        const pal: any = (this.host as any).colorPalette;
        const hc = !!pal?.isHighContrast;
        const out: string[] = [];
        const negN = Math.max(1, Math.min(this.settings.scale.negativeCount, count));
        for (let i = 0; i < count; i++) {
            // Color por punto de escala puesto a mano o por regla (fx) sobre colors.fill.
            const objs: any = groups[i]?.objects;
            const own = objs?.colors?.fill?.solid?.color;
            if (own) { out.push(own); continue; }
            if (hc) {
                out.push(i < negN ? (pal.foreground?.value ?? "#FFF") : (pal.foregroundSelected?.value ?? "#FFF"));
                continue;
            }
            const t = count <= 1 ? 0 : i / (count - 1);
            const mid = negN / Math.max(count - 1, 1);
            out.push(t <= mid
                ? mix(s.negativeColor, s.neutralColor, mid ? t / mid : 1)
                : mix(s.neutralColor, s.positiveColor, (t - mid) / Math.max(1 - mid, 0.001)));
        }
        return out;
    }

    // ── Render ────────────────────────────────────────────────────────────────

    private clearSvg(): void {
        while (this.svg.firstChild) { this.svg.removeChild(this.svg.firstChild); }
    }

    private renderLanding(w: number, h: number): void {
        this.clearSvg();
        this.svg.setAttribute("width", String(w));
        this.svg.setAttribute("height", String(h));
        const g = el("g");
        const t1 = text(w / 2, h / 2 - 16, "Likert Survey Pro", 15, "#3B4252", "middle");
        t1.setAttribute("font-weight", "600");
        const t2 = text(w / 2, h / 2 + 8,
            "Add Question, Response and Value to draw the diverging scale.", 12, "#4C566A", "middle");
        g.appendChild(t1); g.appendChild(t2);
        this.svg.appendChild(g);
    }

    private render(w: number, h: number): void {
        this.clearSvg();
        this.svg.setAttribute("role", "img");

        const s = this.settings;
        const legendH = s.legend.show ? 24 : 0;

        // La leyenda ocupa su franja fuera del area desplazable.
        this.legendHost.style.display = s.legend.show ? "block" : "none";
        this.legendHost.style.height = `${legendH}px`;
        this.legendHost.style.top = s.legend.position === "top" ? "0px" : "";
        this.legendHost.style.bottom = s.legend.position === "bottom" ? "0px" : "";
        this.scrollHost.style.top = s.legend.position === "top" ? `${legendH}px` : "0px";
        this.scrollHost.style.bottom = s.legend.position === "bottom" ? `${legendH}px` : "0px";

        const availH = Math.max(h - legendH, 10);
        const topPad = 6;
        const botPad = 6;
        // Zona izquierda como tabla: columna de bloque y columna de pregunta. La de
        // pregunta se ajusta al texto real, con el porcentaje como TOPE en vez de como
        // medida fija: con preguntas cortas, un ancho fijo deja un hueco que nadie recupera.
        const hayBloques = this.rows.some(r => r.group !== null);
        const blockW = hayBloques ? Math.max(0, w * (s.qtable.blockWidth / 100)) : 0;
        const tope = Math.max(60, Math.min(w * (s.labels.questionWidth / 100), w * 0.6));
        const anchoTexto = this.rows.reduce(
            (m, r) => Math.max(m, r.question.length * s.qtable.questionFontSize * 0.58), 0);
        const qW = Math.max(60, Math.min(tope, anchoTexto + 12));
        const leftW = blockW + qW;
        const boxW = (s.boxes.show ? s.boxes.fontSize * 5.2 : 0)
                   + (s.boxes.showNps ? s.boxes.fontSize * 3.6 : 0)
                   + ((s.boxes.show || s.boxes.showNps) ? 20 : 0);

        // Altura de fila: con scroll se respeta el minimo legible y el lienzo crece; sin
        // scroll las filas encogen hasta que todo cabe. Recortar filas por abajo no es una
        // opcion: ocultar datos al redimensionar es causa de rechazo.
        const fitH = (availH - topPad - botPad) / Math.max(this.rows.length, 1);
        const rowH = s.layout.enableScroll
            ? Math.max(s.layout.minRowHeight, Math.min(46, fitH))
            : Math.max(8, Math.min(46, fitH));
        const needed = topPad + botPad + rowH * this.rows.length;
        const scroll = s.layout.enableScroll && needed > availH;
        this.scrollHost.style.overflowY = scroll ? "auto" : "hidden";

        // Con barra de desplazamiento el ancho util se reduce, o el eje queda descentrado.
        const sbw = scroll ? 14 : 0;
        const innerW = Math.max(w - sbw, 40);
        const barLeft = leftW + s.labels.labelGap;
        const barW = Math.max(40, innerW - barLeft - boxW - 10);
        const centre = barLeft + barW / 2;

        this.svg.setAttribute("width", String(innerW));
        this.svg.setAttribute("height", String(Math.max(needed, availH)));

        if (s.legend.show) { this.renderLegend(innerW, legendH); }

        // Eje del centro: es lo que hace legible una escala divergente.
        const axis = el("line");
        axis.setAttribute("x1", String(centre)); axis.setAttribute("x2", String(centre));
        axis.setAttribute("y1", String(topPad)); axis.setAttribute("y2", String(topPad + rowH * this.rows.length));
        axis.setAttribute("stroke", "#4C566A"); axis.setAttribute("stroke-width", "1");
        this.svg.appendChild(axis);

        if (s.benchmark.show) {
            const x = centre + (s.benchmark.value / 100) * (barW / 2);
            const bl = el("line");
            bl.setAttribute("x1", String(x)); bl.setAttribute("x2", String(x));
            bl.setAttribute("y1", String(topPad)); bl.setAttribute("y2", String(topPad + rowH * this.rows.length));
            bl.setAttribute("stroke", s.benchmark.color);
            bl.setAttribute("stroke-width", "2"); bl.setAttribute("stroke-dasharray", "4,3");
            this.svg.appendChild(bl);
        }

        // Los bloques se pintan por TRAMOS, antes que las filas: un fondo por bloque y su
        // etiqueta centrada en el tramo. Pintarlo fila a fila era lo que hacia que la
        // etiqueta se repitiera y que aquello no pareciera una tabla.
        if (hayBloques) {
            const pal: any = (this.host as any).colorPalette;
            let i = 0;
            while (i < this.rows.length) {
                const nombre = this.rows[i].group ?? "";
                let j = i;
                while (j + 1 < this.rows.length && (this.rows[j + 1].group ?? "") === nombre) { j++; }
                const yIni = topPad + i * rowH;
                const alto = (j - i + 1) * rowH;

                if (s.qtable.blockFill && s.qtable.blockOpacity > 0) {
                    const bg = el("rect");
                    bg.setAttribute("x", "0"); bg.setAttribute("y", String(yIni));
                    bg.setAttribute("width", String(leftW)); bg.setAttribute("height", String(alto));
                    // La regla gana sobre el color del tema; sin regla, el tema manda.
                    bg.setAttribute("fill", this.rows[i].groupColor
                        ?? pal?.getColor?.(nombre)?.value ?? "#5E81AC");
                    bg.setAttribute("opacity", String(s.qtable.blockOpacity / 100));
                    this.svg.appendChild(bg);
                }
                if (blockW > 0) {
                    const b = this.blocks.find(x => x.name === nombre);
                    const cyB = yIni + alto / 2;
                    // El circulo solo cabe si deja sitio al nombre: por debajo de eso se
                    // omite, antes que superponer una cifra sobre el texto del bloque.
                    const d = Math.min(s.qtable.statSize, alto - 6, blockW * 0.55);
                    const hayCirculo = s.qtable.statShow && b && d >= 16;
                    let nx = 6;

                    if (hayCirculo) {
                        const c = el("circle");
                        c.setAttribute("cx", String(6 + d / 2));
                        c.setAttribute("cy", String(cyB));
                        c.setAttribute("r", String(d / 2));
                        c.setAttribute("fill", s.qtable.statFill);
                        c.setAttribute("stroke", "#2E3440");
                        c.setAttribute("stroke-width", "1.5");
                        c.setAttribute("aria-hidden", "true");
                        this.svg.appendChild(c);

                        const v = s.qtable.statMode === "positive" ? b.positive * 100
                                : s.qtable.statMode === "nps"      ? b.nps * 100
                                :                                    b.mean;
                        const etq = s.qtable.statMode === "mean" ? v.toFixed(1)
                                  : s.qtable.statMode === "positive" ? `${v.toFixed(0)}%`
                                  : `${v >= 0 ? "+" : ""}${v.toFixed(0)}`;
                        const fs = Math.max(8, Math.min(d * 0.38, s.qtable.blockFontSize * 1.4));
                        const ct = text(6 + d / 2, cyB + fs * 0.36, etq, fs,
                                        readable(s.qtable.statFill), "middle");
                        ct.setAttribute("font-weight", "700");
                        ct.setAttribute("font-family", s.qtable.blockFontFamily);
                        this.svg.appendChild(ct);
                        nx = 6 + d + 8;
                    }

                    const bt = text(nx, cyB + s.qtable.blockFontSize * 0.36,
                        ellipsis(nombre, blockW - nx - 4, s.qtable.blockFontSize),
                        s.qtable.blockFontSize, s.qtable.blockColor, "start");
                    bt.setAttribute("font-weight", "600");
                    bt.setAttribute("font-family", s.qtable.blockFontFamily);
                    this.svg.appendChild(bt);
                }
                if (s.qtable.separator && j + 1 < this.rows.length) {
                    const sep = el("line");
                    sep.setAttribute("x1", "0"); sep.setAttribute("x2", String(innerW));
                    sep.setAttribute("y1", String(yIni + alto)); sep.setAttribute("y2", String(yIni + alto));
                    sep.setAttribute("stroke", "#D8DEE9"); sep.setAttribute("stroke-width", "1");
                    this.svg.appendChild(sep);
                }
                i = j + 1;
            }
        }

        this.rows.forEach((row, ri) => {
            const y = topPad + ri * rowH;
            // El alto de barra es la fila MENOS la separación: con separación 0 las barras
            // se tocan. Antes era un 62% fijo de la fila y el hueco se restaba de ahí, así
            // que el 38% de blanco era inamovible y el control solo podía empeorarlo.
            const barH = Math.max(4, rowH - s.layout.rowGap);
            const by = y + (rowH - barH) / 2;

            const izq = s.qtable.questionAlign === "left";
            const qt = text(izq ? blockW + 6 : leftW - 6,
                            y + rowH / 2 + s.qtable.questionFontSize * 0.36,
                            ellipsis(row.question, qW - 12, s.qtable.questionFontSize),
                            s.qtable.questionFontSize, s.qtable.questionColor,
                            izq ? "start" : "end");
            qt.setAttribute("font-family", s.qtable.questionFontFamily);
            this.svg.appendChild(qt);

            // Izquierda desde el centro hacia fuera, para que el neutro quede pegado al eje.
            let x = centre - row.negShare * (barW / 2);
            row.segments.forEach(sg => {
                const span = sg.share * (barW / 2);
                // El hueco se resta al ancho PINTADO, no al avance: así el eje sigue
                // centrado y los porcentajes siguen siendo proporcionales. Y solo se aplica
                // si el tramo sobrevive: sin esta guarda, un 1% de 2 px desaparecería.
                const gap = span > s.layout.segmentGap + 1 ? s.layout.segmentGap : 0;
                const width = Math.max(0, span - gap);
                const r = el("rect");
                r.setAttribute("x", String(x)); r.setAttribute("y", String(by));
                r.setAttribute("width", String(width)); r.setAttribute("height", String(barH));
                r.setAttribute("fill", sg.color);
                r.setAttribute("opacity", sg.highlighted ? "1" : "0.3");
                r.setAttribute("data-seg", "1");
                r.setAttribute("tabindex", "-1");
                r.setAttribute("role", "img");
                r.setAttribute("aria-label",
                    `${row.question}, ${sg.label}: ${(sg.share * 100).toFixed(1)}%`);
                (r as any).__sid = sg.selectionId;
                (r as any).__tip = sg.tooltip;
                this.svg.appendChild(r);

                if (s.labels.showValues && sg.share * 100 >= s.labels.minSegment && width > 16) {
                    const lbl = text(x + span / 2, by + barH * 0.72,
                        s.scale.asPercent ? `${(sg.share * 100).toFixed(s.labels.decimals)}%`
                                          : String(Math.round(sg.value)),
                        Math.min(s.labels.fontSize, barH * 0.6), readable(sg.color), "middle");
                    lbl.setAttribute("pointer-events", "none");
                    this.svg.appendChild(lbl);
                }
                x += span;
            });

            if (s.boxes.show || s.boxes.showNps) {
                const fs = s.boxes.fontSize;
                const cy = y + rowH / 2;
                let bx = barLeft + barW + 10;

                if (s.boxes.show) {
                    const txt = `${(row.topBox * 100).toFixed(0)}% / ${(row.bottomBox * 100).toFixed(0)}%`;
                    const bt = text(bx, cy + fs * 0.36, txt, fs, s.boxes.textColor, "start");
                    this.svg.appendChild(bt);
                    bx += txt.length * fs * 0.58 + 10;
                }

                if (s.boxes.showNps) {
                    // Pildora en vez de texto coloreado: el NPS es la cifra que se busca de
                    // un vistazo, y un numero suelto se pierde entre el resto del texto.
                    const nps = (row.topBox - row.bottomBox) * 100;
                    const etq = `${nps >= 0 ? "+" : ""}${nps.toFixed(0)}`;
                    const fondo = nps >= 0 ? s.boxes.npsPositive : s.boxes.npsNegative;
                    const ph = Math.min(fs * 1.75, Math.max(barH, fs * 1.3));
                    const pw = Math.max(ph, etq.length * fs * 0.62 + fs * 1.2);
                    const pill = el("rect");
                    pill.setAttribute("x", String(bx));
                    pill.setAttribute("y", String(cy - ph / 2));
                    pill.setAttribute("width", String(pw));
                    pill.setAttribute("height", String(ph));
                    pill.setAttribute("rx", String(ph / 2));
                    pill.setAttribute("fill", fondo);
                    pill.setAttribute("aria-hidden", "true");
                    this.svg.appendChild(pill);
                    // El texto sigue a la luminancia del relleno: con un verde claro no se
                    // puede escribir en blanco, y el color lo elige el usuario.
                    const nt = text(bx + pw / 2, cy + fs * 0.36, etq, fs, readable(fondo), "middle");
                    nt.setAttribute("font-weight", "600");
                    this.svg.appendChild(nt);
                }
            }
        });

        this.attachTooltips();
        this.restoreFocus();
    }

    private renderLegend(w: number, legendH: number): void {
        while (this.legendSvg.firstChild) { this.legendSvg.removeChild(this.legendSvg.firstChild); }
        this.legendSvg.setAttribute("width", String(w));
        this.legendSvg.setAttribute("height", String(legendH));
        let y = 6;
        let x = 8;
        const fs = Math.max(9, this.settings.labels.fontSize - 1);
        this.responseLabels.forEach((lab, i) => {
            const sw = el("rect");
            sw.setAttribute("x", String(x)); sw.setAttribute("y", String(y));
            sw.setAttribute("width", "11"); sw.setAttribute("height", "11");
            sw.setAttribute("rx", "2"); sw.setAttribute("fill", this.responseColors[i]);
            this.legendSvg.appendChild(sw);
            const t = text(x + 15, y + 10, lab, fs, this.settings.labels.textColor, "start");
            this.legendSvg.appendChild(t);
            x += 15 + lab.length * fs * 0.58 + 12;
            if (x > w - 40) { x = 8; y += 14; }
        });
    }

    private attachTooltips(): void {
        const svc: any = (this.host as any).tooltipService;
        if (!svc) { return; }
        const segs = this.svg.querySelectorAll("[data-seg]");
        segs.forEach(node => {
            const show = (ev: MouseEvent | FocusEvent) => {
                const r = (node as SVGElement).getBoundingClientRect();
                svc.show({
                    dataItems: (node as any).__tip,
                    identities: [(node as any).__sid],
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

    // ── Teclado: roving tabindex, una sola parada de Tab ──────────────────────

    private restoreFocus(): void {
        const segs = this.svg.querySelectorAll("[data-seg]");
        if (!segs.length) { return; }
        const i = Math.max(0, Math.min(this.focusIndex, segs.length - 1));
        (segs[this.focusIndex >= 0 ? i : 0] as SVGElement).setAttribute("tabindex", "0");
    }

    private onKeyDown(e: KeyboardEvent): void {
        const segs = Array.from(this.svg.querySelectorAll("[data-seg]")) as SVGElement[];
        if (!segs.length) { return; }
        const cur = segs.indexOf(document.activeElement as any);
        let next = cur;
        switch (e.key) {
            case "ArrowRight": next = Math.min(cur + 1, segs.length - 1); break;
            case "ArrowLeft":  next = Math.max(cur - 1, 0); break;
            case "Home":       next = 0; break;
            case "End":        next = segs.length - 1; break;
            case "Enter":
            case " ":
                if (cur >= 0) {
                    e.preventDefault();
                    this.selectionManager.select((segs[cur] as any).__sid, e.ctrlKey || e.metaKey);
                }
                return;
            case "Escape":
                this.selectionManager.clear();
                return;
            case "F10":
                if (e.shiftKey && cur >= 0) {
                    e.preventDefault();
                    const r = segs[cur].getBoundingClientRect();
                    this.selectionManager.showContextMenu((segs[cur] as any).__sid,
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

    // ── Ajustes ───────────────────────────────────────────────────────────────

    /**
     * Panel de formato con la API nueva. El modelo declarativo muestra SIEMPRE lo que eligió
     * el usuario, no lo que pinta el tier gratuito: si mostrara lo gateado, un ajuste Pro se
     * apagaría solo al activarlo y parecería roto.
     */
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        // El fx del color de bloque solo se ofrece con licencia o en vista previa. Un boton
        // que no hace nada es peor que no tenerlo: el usuario crea la regla y no pasa nada.
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
        return this.formattingService.buildFormattingModel(this.formattingModel);
    }
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function el(tag: string): SVGElement {
    return document.createElementNS(SVG_NS, tag) as SVGElement;
}

function text(x: number, y: number, content: string, size: number, color: string, anchor: string): SVGElement {
    const t = el("text");
    t.setAttribute("x", String(x)); t.setAttribute("y", String(y));
    t.setAttribute("font-size", String(size));
    t.setAttribute("fill", color);
    t.setAttribute("text-anchor", anchor);
    t.setAttribute("font-family", "'Segoe UI',system-ui,sans-serif");
    t.textContent = content;   // nunca innerHTML: es dato del usuario
    return t;
}

/** Ancho estimado con el tamaño de fuente real: 0.58 em de media en Segoe UI. */
function ellipsis(s: string, maxPx: number, fontSize: number): string {
    const per = fontSize * 0.58;
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
    const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
    if (!m) { return [128, 128, 128]; }
    const v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Texto legible sobre el relleno: luminancia relativa simplificada. */
function readable(bg: string): string {
    const [r, g, b] = hex(bg);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#2E3440" : "#FFFFFF";
}
