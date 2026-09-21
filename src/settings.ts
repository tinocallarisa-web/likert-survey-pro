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
 * getAvailableServicePlans() devuelve el Service ID COMPLETO (publisher.offer.plan), no el
 * Plan ID corto. Comparar con === contra el corto nunca casa, y deja en Free a quien pagó.
 */
export function matchesPlan(spIdentifier: unknown, planId: string): boolean {
    const sp = String(spIdentifier ?? "");
    return sp === planId || sp.endsWith("." + planId);
}

/** Un único sitio para el tope: duplicar una constante es como acaba divergiendo. */
export const FREE_MAX_RESPONSES = 30;

// ── Tarjetas del panel de formato ────────────────────────────────────────────

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
              this.blockFontSize, this.blockColor, this.questionAlign,
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
    name = "boxes";
    displayNameKey = "Obj_Boxes";
    slices = [this.show, this.size, this.showNps];
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
    slices = [this.enableScroll, this.minRowHeight, this.segmentGap, this.rowGap];
}

class LegendCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show", displayNameKey: "Prop_LegendShow", value: true
    });
    position = new formattingSettings.AutoDropdown({
        name: "position", displayNameKey: "Prop_LegendPosition", value: "bottom"
    });
    name = "legend";
    displayNameKey = "Obj_Legend";
    slices = [this.show, this.position];
}

/**
 * El control que genera el boton fx del color de bloque. Se crea aparte porque SOLO se
 * anade al panel con licencia: emitirlo siempre daria un fx que no hace nada en Free.
 * Selector comodin, que es lo que hace que Power BI materialice la regla en cada bloque.
 */
export function makeBlockRuleSlice(): formattingSettings.ColorPicker {
    return new formattingSettings.ColorPicker({
        name: "blockFillColor", displayNameKey: "Prop_QtableBlockFillColor",
        value: { value: "#5E81AC" },
        selector: dataViewWildcard.createDataViewWildcardSelector(
            dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals),
        altConstantSelector: null,
        instanceKind: CONSTANT_OR_RULE
    });
}

export class LikertFormattingModel extends Model {
    scale = new ScaleCard();
    colors = new ColorsCard();
    qtable = new QuestionTableCard();
    labels = new LabelsCard();
    boxes = new BoxesCard();
    benchmark = new BenchmarkCard();
    layout = new LayoutCard();
    legend = new LegendCard();
    cards = [this.scale, this.colors, this.qtable, this.labels, this.boxes,
             this.benchmark, this.layout, this.legend];
}

// ── Objeto plano para el render ──────────────────────────────────────────────
// El panel es declarativo; el dibujo trabaja con valores simples y acotados. Separarlos
// evita que el render tenga que conocer la forma del modelo de formato.

export interface LikertSettings {
    scale: { negativeCount: number; neutralMode: "split" | "right" | "exclude"; asPercent: boolean };
    colors: { negativeColor: string; positiveColor: string; neutralColor: string };
    qtable: { blockWidth: number; blockFill: boolean; blockOpacity: number;
              blockFontFamily: string; blockFontSize: number; blockColor: string;
              questionAlign: "left" | "right"; questionFontFamily: string;
              questionFontSize: number; questionColor: string; separator: boolean };
    labels: { showValues: boolean; minSegment: number; decimals: number;
              questionWidth: number; labelGap: number; fontSize: number; textColor: string };
    boxes: { show: boolean; size: number; showNps: boolean };
    benchmark: { show: boolean; value: number; color: string };
    layout: { enableScroll: boolean; minRowHeight: number; segmentGap: number; rowGap: number };
    legend: { show: boolean; position: "top" | "bottom" };
}

const clamp = (v: number, lo: number, hi: number, def: number) =>
    isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def;

export function toSettings(m: LikertFormattingModel): LikertSettings {
    return {
        scale: {
            negativeCount: Math.max(0, Math.round(clamp(m.scale.negativeCount.value, 0, 30, 2))),
            neutralMode: String(m.scale.neutralMode.value ?? "split") as any,
            asPercent: !!m.scale.asPercent.value,
        },
        colors: {
            negativeColor: m.colors.negativeColor.value?.value ?? "#BF616A",
            neutralColor:  m.colors.neutralColor.value?.value  ?? "#D8DEE9",
            positiveColor: m.colors.positiveColor.value?.value ?? "#5E81AC",
        },
        qtable: {
            blockWidth:         clamp(m.qtable.blockWidth.value, 0, 40, 14),
            blockFill:          !!m.qtable.blockFill.value,
            blockOpacity:       clamp(m.qtable.blockOpacity.value, 0, 100, 14),
            blockFontFamily:    String(m.qtable.blockFontFamily.value || "Segoe UI"),
            blockFontSize:      clamp(m.qtable.blockFontSize.value, 7, 28, 11),
            blockColor:         m.qtable.blockColor.value?.value ?? "#2E3440",
            questionAlign:      String(m.qtable.questionAlign.value ?? "left") as any,
            questionFontFamily: String(m.qtable.questionFontFamily.value || "Segoe UI"),
            questionFontSize:   clamp(m.qtable.questionFontSize.value, 7, 28, 10),
            questionColor:      m.qtable.questionColor.value?.value ?? "#3B4252",
            separator:          !!m.qtable.separator.value,
        },
        labels: {
            showValues:    !!m.labels.showValues.value,
            minSegment:    clamp(m.labels.minSegment.value, 0, 100, 5),
            decimals:      Math.round(clamp(m.labels.decimals.value, 0, 3, 0)),
            questionWidth: clamp(m.labels.questionWidth.value, 10, 60, 32),
            labelGap:      clamp(m.labels.labelGap.value, 0, 60, 8),
            fontSize:      clamp(m.labels.fontSize.value, 7, 24, 10),
            textColor:     m.labels.textColor.value?.value ?? "#3B4252",
        },
        boxes: {
            show:    !!m.boxes.show.value,
            size:    Math.round(clamp(parseFloat(String(m.boxes.size.value)), 1, 3, 2)),
            showNps: !!m.boxes.showNps.value,
        },
        benchmark: {
            show:  !!m.benchmark.show.value,
            value: clamp(m.benchmark.value.value, 0, 100, 70),
            color: m.benchmark.color.value?.value ?? "#4C566A",
        },
        layout: {
            enableScroll: !!m.layout.enableScroll.value,
            minRowHeight: clamp(m.layout.minRowHeight.value, 12, 80, 26),
            segmentGap:   clamp(m.layout.segmentGap.value, 0, 6, 1),
            rowGap:       clamp(m.layout.rowGap.value, 0, 40, 6),
        },
        legend: {
            show: !!m.legend.show.value,
            position: String(m.legend.position.value ?? "bottom") as any,
        },
    };
}

export const defaultSettings: LikertSettings = toSettings(new LikertFormattingModel());

/**
 * Lo que ve un usuario sin licencia. El resultado tiene que ser CORRECTO, no recortado: la
 * escala divergente completa sigue estando, con sus porcentajes y su centrado. Lo que se
 * retira son las lecturas de analista — Top/Bottom box, NPS y la referencia — no datos.
 */
export function freeSettings(s: LikertSettings): LikertSettings {
    return {
        ...s,
        boxes:     { ...s.boxes, show: false, showNps: false },
        benchmark: { ...s.benchmark, show: false },
    };
}
