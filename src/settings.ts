"use strict";

import powerbi from "powerbi-visuals-api";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";

import Card = formattingSettings.SimpleCard;
import Model = formattingSettings.Model;

/**
 * ConstantOrRule. VisualEnumerationInstanceKinds es un const enum: TypeScript lo inlinea y
 * referenciarlo en runtime daría undefined, de ahí el literal.
 */
const CONSTANT_OR_RULE = 3 as powerbi.VisualEnumerationInstanceKinds;

/**
 * Plan ID tal como aparece en Partner Center, última parte del Service ID.
 * El Service ID completo es editor.oferta.plan, y es lo que devuelve spIdentifier.
 */
export const SP_IDENTIFIER = "likert-survey-pro-tcviz";
/**
 * Planes que dan el Pro: el público y el privado "partner" (norma de la cartera desde 02-10-2026:
 * un plan privado tiene otro Plan ID y, con uno solo fijo en el código, quien lo compra se queda en Free).
 */
export const PRO_PLAN_IDS = [SP_IDENTIFIER, "partner"];

/**
 * getAvailableServicePlans() devuelve el Service ID COMPLETO (publisher.offer.plan), no el
 * Plan ID corto. Comparar con === contra el corto nunca casa, y deja en Free a quien pagó.
 */
export function matchesPlan(spIdentifier: unknown, planId: string): boolean {
    const sp = String(spIdentifier ?? "");
    return sp === planId || sp.endsWith("." + planId);
}

/** Un único sitio para el tope: duplicar una constante es como acaba divergiendo. */
export const FREE_MAX_RESPONSES = 30;
/** Small multiples sin licencia, editando: los primeros paneles, con la marca de agua. */
export const PREVIEW_PANELS = 4;
/** Tope de alto de BARRA con "Row height: Automatic": 2 o 3 preguntas no salen como bloques enormes. */
export const AUTO_MAX_BAR = 64;

/** Los seis estilos de la colección (Pro). "clean" = Report theme, gratis y por defecto. */
export const PRO_STYLES = ["boardroom", "ledger", "editorial", "signal", "aurora", "terrace"];

// ── Tarjetas del panel de formato ────────────────────────────────────────────
// Orden común de la cartera (utillaje/notas/estandar-panel-formato.md): Style template primero,
// las tarjetas propias, ejes, leyenda, small multiples, accesibilidad y fondo. Los nombres
// internos de las tarjetas que ya existían no se tocan: los informes guardados los leen.

class StyleCard extends Card {
    template = new formattingSettings.AutoDropdown({
        name: "template", displayNameKey: "Prop_StyleTemplate", value: "clean"
    });
    guide = new formattingSettings.ToggleSwitch({
        name: "guide", displayNameKey: "Prop_StyleGuide", value: true
    });
    name = "style";
    displayNameKey = "Obj_Style";
    slices = [this.template, this.guide];
}

class ScaleCard extends Card {
    negativeCount = new formattingSettings.NumUpDown({
        name: "negativeCount", displayNameKey: "Prop_ScaleNegativeCount", value: 2
    });
    neutralMode = new formattingSettings.AutoDropdown({
        name: "neutralMode", displayNameKey: "Prop_ScaleNeutralMode", value: "split"
    });
    asPercent = new formattingSettings.ToggleSwitch({
        name: "asPercent", displayNameKey: "Prop_ScaleAsPercent", value: true
    });
    name = "scale";
    displayNameKey = "Obj_Scale";
    slices = [this.negativeCount, this.neutralMode, this.asPercent];
}

class ColorsCard extends Card {
    /**
     * Color por punto de escala. El selector comodín es lo que hace que Power BI
     * materialice una regla fx en cada segmento; emitido una sola vez da un único fx para
     * toda la escala en lugar de uno por respuesta.
     */
    fill = new formattingSettings.ColorPicker({
        name: "fill", displayNameKey: "Prop_ColorsFill",
        value: { value: "#5E81AC" },
        selector: dataViewWildcard.createDataViewWildcardSelector(
            dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals),
        altConstantSelector: null,
        instanceKind: CONSTANT_OR_RULE
    });
    negativeColor = new formattingSettings.ColorPicker({
        name: "negativeColor", displayNameKey: "Prop_ColorsNegativeColor", value: { value: "#BF616A" }
    });
    neutralColor = new formattingSettings.ColorPicker({
        name: "neutralColor", displayNameKey: "Prop_ColorsNeutralColor", value: { value: "#D8DEE9" }
    });
    positiveColor = new formattingSettings.ColorPicker({
        name: "positiveColor", displayNameKey: "Prop_ColorsPositiveColor", value: { value: "#5E81AC" }
    });
    name = "colors";
    displayNameKey = "Obj_Colors";
    slices = [this.fill, this.negativeColor, this.neutralColor, this.positiveColor];
}

class QuestionTableCard extends Card {
    blockWidth = new formattingSettings.NumUpDown({
        name: "blockWidth", displayNameKey: "Prop_QtableBlockWidth", value: 14
    });
    blockFill = new formattingSettings.ToggleSwitch({
        name: "blockFill", displayNameKey: "Prop_QtableBlockFill", value: true
    });
    blockOpacity = new formattingSettings.NumUpDown({
        name: "blockOpacity", displayNameKey: "Prop_QtableBlockOpacity", value: 14
    });
    blockFontFamily = new formattingSettings.FontPicker({
        name: "blockFontFamily", displayNameKey: "Prop_QtableBlockFontFamily", value: "Segoe UI"
    });
    blockFontSize = new formattingSettings.NumUpDown({
        name: "blockFontSize", displayNameKey: "Prop_QtableBlockFontSize", value: 11
    });
    blockColor = new formattingSettings.ColorPicker({
        name: "blockColor", displayNameKey: "Prop_QtableBlockColor", value: { value: "#2E3440" }
    });
    statShow = new formattingSettings.ToggleSwitch({
        name: "statShow", displayNameKey: "Prop_QtableStatShow", value: true
    });
    statMode = new formattingSettings.AutoDropdown({
        name: "statMode", displayNameKey: "Prop_QtableStatMode", value: "mean"
    });
    statSize = new formattingSettings.NumUpDown({
        name: "statSize", displayNameKey: "Prop_QtableStatSize", value: 34
    });
    statFill = new formattingSettings.ColorPicker({
        name: "statFill", displayNameKey: "Prop_QtableStatFill", value: { value: "#FFFFFF" }
    });
    questionAlign = new formattingSettings.AutoDropdown({
        name: "questionAlign", displayNameKey: "Prop_QtableQuestionAlign", value: "left"
    });
    questionFontFamily = new formattingSettings.FontPicker({
        name: "questionFontFamily", displayNameKey: "Prop_QtableQuestionFontFamily", value: "Segoe UI"
    });
    questionFontSize = new formattingSettings.NumUpDown({
        name: "questionFontSize", displayNameKey: "Prop_QtableQuestionFontSize", value: 10
    });
    questionColor = new formattingSettings.ColorPicker({
        name: "questionColor", displayNameKey: "Prop_QtableQuestionColor", value: { value: "#3B4252" }
    });
    separator = new formattingSettings.ToggleSwitch({
        name: "separator", displayNameKey: "Prop_QtableSeparator", value: true
    });
    name = "qtable";
    displayNameKey = "Obj_Qtable";
    slices = [this.blockWidth, this.blockFill, this.blockOpacity, this.blockFontFamily,
              this.blockFontSize, this.blockColor,
              this.statShow, this.statMode, this.statSize, this.statFill,
              this.questionAlign,
              this.questionFontFamily, this.questionFontSize, this.questionColor,
              this.separator];
}

class LabelsCard extends Card {
    showValues = new formattingSettings.ToggleSwitch({
        name: "showValues", displayNameKey: "Prop_LabelsShowValues", value: true
    });
    minSegment = new formattingSettings.NumUpDown({
        name: "minSegment", displayNameKey: "Prop_LabelsMinSegment", value: 5
    });
    decimals = new formattingSettings.NumUpDown({
        name: "decimals", displayNameKey: "Prop_LabelsDecimals", value: 0
    });
    questionWidth = new formattingSettings.NumUpDown({
        name: "questionWidth", displayNameKey: "Prop_LabelsQuestionWidth", value: 32
    });
    labelGap = new formattingSettings.NumUpDown({
        name: "labelGap", displayNameKey: "Prop_LabelsLabelGap", value: 8
    });
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize", displayNameKey: "Prop_LabelsFontSize", value: 10
    });
    textColor = new formattingSettings.ColorPicker({
        name: "textColor", displayNameKey: "Prop_LabelsTextColor", value: { value: "#3B4252" }
    });
    name = "labels";
    displayNameKey = "Obj_Labels";
    slices = [this.showValues, this.minSegment, this.decimals,
              this.questionWidth, this.labelGap, this.fontSize, this.textColor];
}

class BoxesCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show", displayNameKey: "Prop_BoxesShow", value: false
    });
    size = new formattingSettings.AutoDropdown({
        name: "size", displayNameKey: "Prop_BoxesSize", value: "2"
    });
    showNps = new formattingSettings.ToggleSwitch({
        name: "showNps", displayNameKey: "Prop_BoxesShowNps", value: false
    });
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize", displayNameKey: "Prop_BoxesFontSize", value: 10
    });
    textColor = new formattingSettings.ColorPicker({
        name: "textColor", displayNameKey: "Prop_BoxesTextColor", value: { value: "#3B4252" }
    });
    npsPositive = new formattingSettings.ColorPicker({
        name: "npsPositive", displayNameKey: "Prop_BoxesNpsPositive", value: { value: "#A3BE8C" }
    });
    npsNegative = new formattingSettings.ColorPicker({
        name: "npsNegative", displayNameKey: "Prop_BoxesNpsNegative", value: { value: "#BF616A" }
    });
    name = "boxes";
    displayNameKey = "Obj_Boxes";
    slices = [this.show, this.size, this.showNps, this.fontSize, this.textColor,
              this.npsPositive, this.npsNegative];
}

class BenchmarkCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show", displayNameKey: "Prop_BenchmarkShow", value: false
    });
    value = new formattingSettings.NumUpDown({
        name: "value", displayNameKey: "Prop_BenchmarkValue", value: 70
    });
    color = new formattingSettings.ColorPicker({
        name: "color", displayNameKey: "Prop_BenchmarkColor", value: { value: "#4C566A" }
    });
    name = "benchmark";
    displayNameKey = "Obj_Benchmark";
    slices = [this.show, this.value, this.color];
}

class LayoutCard extends Card {
    rowHeightMode = new formattingSettings.AutoDropdown({
        name: "rowHeightMode", displayNameKey: "Prop_LayoutRowHeightMode", value: "auto"
    });
    rowHeight = new formattingSettings.NumUpDown({
        name: "rowHeight", displayNameKey: "Prop_LayoutRowHeight", value: 32
    });
    enableScroll = new formattingSettings.ToggleSwitch({
        name: "enableScroll", displayNameKey: "Prop_LayoutEnableScroll", value: true
    });
    minRowHeight = new formattingSettings.NumUpDown({
        name: "minRowHeight", displayNameKey: "Prop_LayoutMinRowHeight", value: 26
    });
    segmentGap = new formattingSettings.NumUpDown({
        name: "segmentGap", displayNameKey: "Prop_LayoutSegmentGap", value: 1
    });
    rowGap = new formattingSettings.NumUpDown({
        name: "rowGap", displayNameKey: "Prop_LayoutRowGap", value: 6
    });
    name = "layout";
    displayNameKey = "Obj_Layout";
    slices = [this.rowHeightMode, this.rowHeight, this.enableScroll, this.minRowHeight,
              this.segmentGap, this.rowGap];
}

class ValueAxisCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show", displayNameKey: "Prop_ValueAxisShow", value: false
    });
    showTitle = new formattingSettings.ToggleSwitch({
        name: "showTitle", displayNameKey: "Prop_ValueAxisShowTitle", value: false
    });
    titleText = new formattingSettings.TextInput({
        name: "titleText", displayNameKey: "Prop_ValueAxisTitleText", value: "", placeholder: ""
    });
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize", displayNameKey: "Prop_ValueAxisFontSize", value: 9
    });
    color = new formattingSettings.ColorPicker({
        name: "color", displayNameKey: "Prop_ValueAxisColor", value: { value: "" }
    });
    name = "valueAxis";
    displayNameKey = "Obj_ValueAxis";
    slices = [this.show, this.showTitle, this.titleText, this.fontSize, this.color];
}

class CategoryAxisCard extends Card {
    showTitle = new formattingSettings.ToggleSwitch({
        name: "showTitle", displayNameKey: "Prop_CategoryAxisShowTitle", value: false
    });
    titleText = new formattingSettings.TextInput({
        name: "titleText", displayNameKey: "Prop_CategoryAxisTitleText", value: "", placeholder: ""
    });
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize", displayNameKey: "Prop_CategoryAxisFontSize", value: 11
    });
    color = new formattingSettings.ColorPicker({
        name: "color", displayNameKey: "Prop_CategoryAxisColor", value: { value: "" }
    });
    name = "categoryAxis";
    displayNameKey = "Obj_CategoryAxis";
    slices = [this.showTitle, this.titleText, this.fontSize, this.color];
}

class GridlinesCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show", displayNameKey: "Prop_GridlinesShow", value: false
    });
    step = new formattingSettings.AutoDropdown({
        name: "step", displayNameKey: "Prop_GridlinesStep", value: "25"
    });
    color = new formattingSettings.ColorPicker({
        name: "color", displayNameKey: "Prop_GridlinesColor", value: { value: "" }
    });
    width = new formattingSettings.NumUpDown({
        name: "width", displayNameKey: "Prop_GridlinesWidth", value: 1
    });
    dashed = new formattingSettings.ToggleSwitch({
        name: "dashed", displayNameKey: "Prop_GridlinesDashed", value: true
    });
    name = "gridlines";
    displayNameKey = "Obj_Gridlines";
    slices = [this.show, this.step, this.color, this.width, this.dashed];
}

class LegendCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show", displayNameKey: "Prop_LegendShow", value: true
    });
    position = new formattingSettings.AutoDropdown({
        name: "position", displayNameKey: "Prop_LegendPosition", value: "bottom"
    });
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize", displayNameKey: "Prop_LegendFontSize", value: 0
    });
    color = new formattingSettings.ColorPicker({
        name: "color", displayNameKey: "Prop_LegendColor", value: { value: "" }
    });
    name = "legend";
    displayNameKey = "Obj_Legend";
    slices = [this.show, this.position, this.fontSize, this.color];
}

class SmallMultiplesCard extends Card {
    columns = new formattingSettings.NumUpDown({
        name: "columns", displayNameKey: "Prop_SmColumns", value: 0
    });
    gap = new formattingSettings.NumUpDown({
        name: "gap", displayNameKey: "Prop_SmGap", value: 8
    });
    titleSize = new formattingSettings.NumUpDown({
        name: "titleSize", displayNameKey: "Prop_SmTitleSize", value: 12
    });
    titleColor = new formattingSettings.ColorPicker({
        name: "titleColor", displayNameKey: "Prop_SmTitleColor", value: { value: "" }
    });
    titleBold = new formattingSettings.ToggleSwitch({
        name: "titleBold", displayNameKey: "Prop_SmTitleBold", value: true
    });
    titleAlign = new formattingSettings.AutoDropdown({
        name: "titleAlign", displayNameKey: "Prop_SmTitleAlign", value: "left"
    });
    background = new formattingSettings.ColorPicker({
        name: "background", displayNameKey: "Prop_SmBackground", value: { value: "" }
    });
    border = new formattingSettings.ToggleSwitch({
        name: "border", displayNameKey: "Prop_SmBorder", value: false
    });
    borderColor = new formattingSettings.ColorPicker({
        name: "borderColor", displayNameKey: "Prop_SmBorderColor", value: { value: "#E1DFDD" }
    });
    name = "smallMultiples";
    displayNameKey = "Obj_SmallMultiples";
    slices = [this.columns, this.gap, this.titleSize, this.titleColor, this.titleBold, this.titleAlign,
              this.background, this.border, this.borderColor];
}

class AccessibilityCard extends Card {
    highContrast = new formattingSettings.AutoDropdown({
        name: "highContrast", displayNameKey: "Prop_AccHighContrast", value: "auto"
    });
    focusColor = new formattingSettings.ColorPicker({
        name: "focusColor", displayNameKey: "Prop_AccFocusColor", value: { value: "#1F4E80" }
    });
    focusWidth = new formattingSettings.NumUpDown({
        name: "focusWidth", displayNameKey: "Prop_AccFocusWidth", value: 2
    });
    minTextSize = new formattingSettings.NumUpDown({
        name: "minTextSize", displayNameKey: "Prop_AccMinTextSize", value: 8
    });
    patterns = new formattingSettings.ToggleSwitch({
        name: "patterns", displayNameKey: "Prop_AccPatterns", value: false
    });
    name = "accessibility";
    displayNameKey = "Obj_Accessibility";
    slices = [this.highContrast, this.focusColor, this.focusWidth, this.minTextSize, this.patterns];
}

class BackgroundCard extends Card {
    color = new formattingSettings.ColorPicker({
        name: "color", displayNameKey: "Prop_BackgroundColor", value: { value: "" }
    });
    name = "background";
    displayNameKey = "Obj_Background";
    slices = [this.color];
}

/**
 * Un selector de color para un bloque concreto, atado a su propia identidad. Es lo que
 * permite "este bloque de este color": una regla no sirve para eso, porque evalua la misma
 * condicion para todos los elementos.
 */
export function makeBlockColorSlice(nombre: string, color: string, selector: any)
        : formattingSettings.ColorPicker {
    return new formattingSettings.ColorPicker({
        name: "blockFillColor",
        displayName: nombre,
        value: { value: color },
        selector
    });
}

export class LikertFormattingModel extends Model {
    style = new StyleCard();
    scale = new ScaleCard();
    colors = new ColorsCard();
    qtable = new QuestionTableCard();
    labels = new LabelsCard();
    boxes = new BoxesCard();
    benchmark = new BenchmarkCard();
    layout = new LayoutCard();
    valueAxis = new ValueAxisCard();
    categoryAxis = new CategoryAxisCard();
    gridlines = new GridlinesCard();
    legend = new LegendCard();
    smallMultiples = new SmallMultiplesCard();
    accessibility = new AccessibilityCard();
    background = new BackgroundCard();
    cards = [this.style, this.scale, this.colors, this.qtable, this.labels, this.boxes,
             this.benchmark, this.layout, this.valueAxis, this.categoryAxis, this.gridlines,
             this.legend, this.smallMultiples, this.accessibility, this.background];
}

// ── Objeto plano para el render ──────────────────────────────────────────────
// El panel es declarativo; el dibujo trabaja con valores simples y acotados. Separarlos
// evita que el render tenga que conocer la forma del modelo de formato.

export interface LikertSettings {
    style: { template: string; guide: boolean };
    scale: { negativeCount: number; neutralMode: "split" | "right" | "exclude"; asPercent: boolean };
    colors: { negativeColor: string; positiveColor: string; neutralColor: string };
    qtable: { blockWidth: number; blockFill: boolean; blockOpacity: number;
              blockFontFamily: string; blockFontSize: number; blockColor: string;
              statShow: boolean; statMode: "mean" | "positive" | "nps";
              statSize: number; statFill: string;
              questionAlign: "left" | "right"; questionFontFamily: string;
              questionFontSize: number; questionColor: string; separator: boolean };
    labels: { showValues: boolean; minSegment: number; decimals: number;
              questionWidth: number; labelGap: number; fontSize: number; textColor: string };
    boxes: { show: boolean; size: number; showNps: boolean; fontSize: number;
             textColor: string; npsPositive: string; npsNegative: string };
    benchmark: { show: boolean; value: number; color: string };
    layout: { rowHeightMode: "auto" | "fixed"; rowHeight: number;
              enableScroll: boolean; minRowHeight: number; segmentGap: number; rowGap: number };
    valueAxis: { show: boolean; showTitle: boolean; titleText: string; fontSize: number; color: string };
    categoryAxis: { showTitle: boolean; titleText: string; fontSize: number; color: string };
    gridlines: { show: boolean; step: number; color: string; width: number; dashed: boolean };
    legend: { show: boolean; position: "top" | "bottom"; fontSize: number; color: string };
    smallMultiples: { columns: number; gap: number; titleSize: number; titleColor: string; titleBold: boolean;
                      titleAlign: "left" | "center"; background: string; border: boolean; borderColor: string };
    accessibility: { highContrast: "auto" | "on"; focusColor: string; focusWidth: number;
                     minTextSize: number; patterns: boolean };
    background: { color: string };
}

const clamp = (v: number, lo: number, hi: number, def: number) =>
    isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def;
const color = (c: { value?: { value?: string } }, def: string) => c.value?.value ?? def;

export function toSettings(m: LikertFormattingModel): LikertSettings {
    const tpl = String(m.style.template.value ?? "clean");
    return {
        style: {
            template: tpl === "clean" || PRO_STYLES.indexOf(tpl) >= 0 ? tpl : "clean",
            guide: !!m.style.guide.value,
        },
        scale: {
            negativeCount: Math.max(0, Math.round(clamp(m.scale.negativeCount.value, 0, 30, 2))),
            neutralMode: String(m.scale.neutralMode.value ?? "split") as any,
            asPercent: !!m.scale.asPercent.value,
        },
        colors: {
            negativeColor: color(m.colors.negativeColor, "#BF616A"),
            neutralColor:  color(m.colors.neutralColor, "#D8DEE9"),
            positiveColor: color(m.colors.positiveColor, "#5E81AC"),
        },
        qtable: {
            blockWidth:         clamp(m.qtable.blockWidth.value, 0, 40, 14),
            blockFill:          !!m.qtable.blockFill.value,
            blockOpacity:       clamp(m.qtable.blockOpacity.value, 0, 100, 14),
            blockFontFamily:    String(m.qtable.blockFontFamily.value || "Segoe UI"),
            blockFontSize:      clamp(m.qtable.blockFontSize.value, 7, 28, 11),
            blockColor:         color(m.qtable.blockColor, "#2E3440"),
            statShow:           !!m.qtable.statShow.value,
            statMode:           String(m.qtable.statMode.value ?? "mean") as any,
            statSize:           clamp(m.qtable.statSize.value, 16, 90, 34),
            statFill:           color(m.qtable.statFill, "#FFFFFF"),
            questionAlign:      String(m.qtable.questionAlign.value ?? "left") as any,
            questionFontFamily: String(m.qtable.questionFontFamily.value || "Segoe UI"),
            questionFontSize:   clamp(m.qtable.questionFontSize.value, 7, 28, 10),
            questionColor:      color(m.qtable.questionColor, "#3B4252"),
            separator:          !!m.qtable.separator.value,
        },
        labels: {
            showValues:    !!m.labels.showValues.value,
            minSegment:    clamp(m.labels.minSegment.value, 0, 100, 5),
            decimals:      Math.round(clamp(m.labels.decimals.value, 0, 3, 0)),
            questionWidth: clamp(m.labels.questionWidth.value, 10, 60, 32),
            labelGap:      clamp(m.labels.labelGap.value, 0, 60, 8),
            fontSize:      clamp(m.labels.fontSize.value, 7, 24, 10),
            textColor:     color(m.labels.textColor, "#3B4252"),
        },
        boxes: {
            show:    !!m.boxes.show.value,
            size:    Math.round(clamp(parseFloat(String(m.boxes.size.value)), 1, 3, 2)),
            showNps: !!m.boxes.showNps.value,
            fontSize:    clamp(m.boxes.fontSize.value, 7, 28, 10),
            textColor:   color(m.boxes.textColor, "#3B4252"),
            npsPositive: color(m.boxes.npsPositive, "#A3BE8C"),
            npsNegative: color(m.boxes.npsNegative, "#BF616A"),
        },
        benchmark: {
            show:  !!m.benchmark.show.value,
            value: clamp(m.benchmark.value.value, 0, 100, 70),
            color: color(m.benchmark.color, "#4C566A"),
        },
        layout: {
            rowHeightMode: String(m.layout.rowHeightMode.value ?? "auto") === "fixed" ? "fixed" : "auto",
            rowHeight:    clamp(m.layout.rowHeight.value, 12, 120, 32),
            enableScroll: !!m.layout.enableScroll.value,
            minRowHeight: clamp(m.layout.minRowHeight.value, 12, 80, 26),
            segmentGap:   clamp(m.layout.segmentGap.value, 0, 6, 1),
            rowGap:       clamp(m.layout.rowGap.value, 0, 40, 6),
        },
        valueAxis: {
            show:      !!m.valueAxis.show.value,
            showTitle: !!m.valueAxis.showTitle.value,
            titleText: String(m.valueAxis.titleText.value ?? ""),
            fontSize:  clamp(m.valueAxis.fontSize.value, 6, 24, 9),
            color:     color(m.valueAxis.color, ""),
        },
        categoryAxis: {
            showTitle: !!m.categoryAxis.showTitle.value,
            titleText: String(m.categoryAxis.titleText.value ?? ""),
            fontSize:  clamp(m.categoryAxis.fontSize.value, 6, 24, 11),
            color:     color(m.categoryAxis.color, ""),
        },
        gridlines: {
            show:   !!m.gridlines.show.value,
            step:   clamp(parseFloat(String(m.gridlines.step.value)), 10, 50, 25),
            color:  color(m.gridlines.color, ""),
            width:  clamp(m.gridlines.width.value, 0.5, 4, 1),
            dashed: !!m.gridlines.dashed.value,
        },
        legend: {
            show: !!m.legend.show.value,
            position: String(m.legend.position.value ?? "bottom") as any,
            fontSize: clamp(m.legend.fontSize.value, 0, 24, 0),
            color: color(m.legend.color, ""),
        },
        smallMultiples: {
            columns:     Math.round(clamp(m.smallMultiples.columns.value, 0, 12, 0)),
            gap:         clamp(m.smallMultiples.gap.value, 0, 60, 8),
            titleSize:   clamp(m.smallMultiples.titleSize.value, 7, 28, 12),
            titleColor:  color(m.smallMultiples.titleColor, ""),
            titleBold:   !!m.smallMultiples.titleBold.value,
            titleAlign:  String(m.smallMultiples.titleAlign.value ?? "left") === "center" ? "center" : "left",
            background:  color(m.smallMultiples.background, ""),
            border:      !!m.smallMultiples.border.value,
            borderColor: color(m.smallMultiples.borderColor, "#E1DFDD"),
        },
        accessibility: {
            highContrast: String(m.accessibility.highContrast.value ?? "auto") === "on" ? "on" : "auto",
            focusColor:   color(m.accessibility.focusColor, "#1F4E80"),
            focusWidth:   clamp(m.accessibility.focusWidth.value, 1, 6, 2),
            minTextSize:  clamp(m.accessibility.minTextSize.value, 6, 16, 8),
            patterns:     !!m.accessibility.patterns.value,
        },
        background: {
            color: color(m.background.color, ""),
        },
    };
}

export const defaultSettings: LikertSettings = toSettings(new LikertFormattingModel());

/**
 * Lo que ve un usuario sin licencia. El resultado tiene que ser CORRECTO, no recortado: la
 * escala divergente completa sigue estando, con sus porcentajes y su centrado. Lo que se
 * retira son las lecturas de analista — Top/Bottom box, NPS y la referencia — y los estilos
 * de la colección (vuelve a Report theme). Small multiples y bloques se quitan en el modelo
 * de datos (visual.ts): sin ellos las filas se suman, no se pierden.
 */
export function freeSettings(s: LikertSettings): LikertSettings {
    return {
        ...s,
        style:     { ...s.style, template: "clean" },
        boxes:     { ...s.boxes, show: false, showNps: false },
        benchmark: { ...s.benchmark, show: false },
    };
}
