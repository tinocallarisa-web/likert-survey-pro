# AppSource Listing — Likert Survey Pro

Copy ready to paste into Partner Center, English only. **The marketplace description is the
documentation most people read** — update it on every release.

Limits measured in Partner Center: *Search results summary* 100 characters, *Description* 5,000
characters (truncated silently, and the "What's new" block goes inside it). Check with
`node scripts/check-listing-length.js`.

---

## Offer name

```
Likert Survey Pro
```

---

## Search results summary

```
Likert charts for Power BI: diverging stacked bars centred on the neutral response.
```

---

## Description

```
Survey results read wrong on a normal stacked bar. Every bar starts at zero, so agreement and disagreement pile up in the same direction and you cannot see at a glance which questions lean negative.

Likert Survey Pro centres every bar on the neutral response. Disagreement grows to the left of a shared axis, agreement to the right, and the comparison between ten questions becomes something you read in a second instead of decoding.

Built for employee engagement, customer satisfaction, patient experience, course evaluation, 360 feedback and any questionnaire answered on a scale.

THE SCALE, HANDLED PROPERLY

• Diverging stacked bars centred on the neutral point, with the number of negative points under your control
• Three ways to treat the neutral response: split it across the centre, count it as positive, or leave it out of the bar entirely — and the percentages recalculate
• Percentages or absolute values, so short and long questions stay comparable
• A Scale order field well fixes the order of the scale inside the visual, without touching the model
• Diverging colour ramp, plus conditional formatting on the scale colour
• Data labels with a threshold that hides the ones too small to read

NATIVE INTEGRATION

• Click a segment to cross-filter the report; Ctrl + click to add; click outside to clear
• Filters from other visuals are reflected in the bars
• Tooltips with the question, the response, the value and the share, plus extra measures in their model format
• Report page tooltips

ACCESSIBLE

• Keyboard navigation: Tab to the chart, arrow keys between segments, Enter to select, Escape to clear, Shift + F10 for the context menu
• Screen reader labels on every segment
• High contrast mode: the scale is redrawn in the system colours so the bars stay legible

PRO

• Top box and bottom box: the share at each end of the scale, beside the bar
• NPS, shown as a pill with its own colours and size
• A benchmark line across every question, to compare against a target or a previous wave
• Question groups: blocks drawn as labelled sections, with each block's mean in a circle
• Per-block colours

FREE AND PRO

The free tier gives a correct result, not a cut-down one: no question, no scale point and no respondent is hidden, and nothing is watermarked in a published report. What Pro adds are the analyst readings on top. While you edit a report without a licence, Pro features render working under a "Pro preview" watermark, so you can see exactly what you would get. Reading view shows the free result.

Pro comes with a one-month free trial, and can be bought monthly or annually.

PRIVACY

The visual makes no network requests of any kind: no analytics, no telemetry, no external scripts. Your data never leaves the report. Licences are checked through Microsoft's own licensing API.

GETTING STARTED

1. Add Question, Response and Value.
2. Add Scale order — a numeric rank per scale point, 1 = leftmost. Without it Power BI hands the responses over alphabetically and a diverging chart built on that means nothing.
3. Pro: add Group to draw the questions as blocks.

Documentation, video and sample data: https://tinocallarisa-web.github.io/likert-survey-pro/support.html
Support: support@tcviz.com

WHAT'S NEW IN 1.0.0.1

First release.
```

---

## URLs to keep in sync

| Field | URL |
|---|---|
| Support / documentation | https://tinocallarisa-web.github.io/likert-survey-pro/support.html |
| Privacy policy | https://tinocallarisa-web.github.io/likert-survey-pro/privacy.html |
| Terms / licence | https://tinocallarisa-web.github.io/likert-survey-pro/terms.html |
| Video | https://www.youtube.com/watch?v=SzSs3gFReaY |

Canonical YouTube URL only (policy 100.3.3.3). `youtu.be`, `/shorts/` and `/embed/` are
rejected. **Correcting it here does not correct the offer** — the field Microsoft reviews is
only in Partner Center.

## Images

| Asset | File | Notes |
|---|---|---|
| Offer screenshot | `docs/infographic.html` -> `likert-survey-pro-infographic.png` | **1366x768 is mandatory.** Open the page and press *Download PNG* (html2canvas), the same way every other visual in the portfolio does it. The badge in the corner reads FIT or OVERFLOW before you export. |
| Offer icon | `likert-300x300.png` from `test_visuales/iconos/salida/` | Uploaded by hand: the 300x300 does not travel inside the package. |
| Package icon | `assets/icon.png`, 36x36 | Embedded in the `.pbiviz` as `content.iconBase64`. |

## Suggested categories and keywords

- Categories (max 2): **Comparison**, **Part-to-whole** — each bar is one question's 100%
  split across the scale, which is part-to-whole. *Distribution* describes the shape of a
  continuous variable and would put the offer in front of people looking for a histogram.
- Industries (max 2): **Professional services**, **Education**
- EULA: our own `terms.html`, not Microsoft's standard contract — ours describes the Free/Pro split
- Support/privacy/terms pages verified live 2026-09-21
- Offer ID: `likert-survey-pro` · Offer alias: Likert Survey Pro
- Search keywords (max 3): `likert scale`, `survey results`, `diverging stacked bar`

## Plan

| Field | Value |
|---|---|
| Plan ID | `likert-survey-pro-tcviz` — Service ID `tino_callarisa.likert-survey-pro.likert-survey-pro-tcviz`, matched by `SP_IDENTIFIER` in `src/settings.ts` via `matchesPlan()` |
| Plan name | Likert Survey Pro |
| Plan description | Unlocks top and bottom box, NPS, the benchmark line, question groups with per-block means and per-block colours. |

---

## YouTube

### Title

```
Likert Survey Pro for Power BI — diverging stacked bars for survey data
```

### Description

```
Survey results read wrong on a normal stacked bar: every bar starts at zero, so you cannot see at a glance which questions lean negative. Likert Survey Pro centres each bar on the neutral response, so agreement and disagreement grow away from a shared axis and the comparison becomes visual.

Free — the full diverging scale, three ways of handling the neutral point (split, count as positive, leave out), percentages or values, the diverging colour ramp, conditional formatting on the scale colour, legend, tooltips, cross-filtering, keyboard navigation and high contrast. The free tier gives a correct result, not a cut-down one: no question, scale point or respondent is hidden.

Pro — Top/Bottom box, NPS, a benchmark line and question groups, with the block mean shown in each group.

No network access. The visual makes no HTTP requests, stores nothing and needs no companion service. No data leaves your report.

CHAPTERS
0:00 The problem with stacked bars for survey data
0:00 Field wells, and why Scale order matters
0:00 The neutral point: three options
0:00 Pro preview: Top/Bottom box, NPS, benchmark
0:00 Question groups and block means
0:00 With a Pro licence

LINKS
Get it on AppSource: [pegar al publicar la oferta]
Documentation: https://tinocallarisa-web.github.io/likert-survey-pro/support.html
Changelog: https://tinocallarisa-web.github.io/likert-survey-pro/changelog.html
Support: support@tcviz.com

More Power BI custom visuals: https://tcviz.com
```

Los tiempos de CHAPTERS están a `0:00` a propósito: hay que ajustarlos al montaje final.
YouTube exige que el primero sea `0:00` y que haya al menos tres.

### Tags

```
likert scale, likert chart power bi, survey visualization, diverging stacked bar, power bi custom visual, power bi survey results, employee engagement survey, net promoter score, nps power bi, top box bottom box, survey analysis, employee satisfaction, questionnaire analysis, power bi visuals, data visualization
```

### Thumbnail

El gráfico divergente a todo lo ancho, con el eje central marcado y tres o cuatro barras
claramente desequilibradas. Es lo único que lo distingue de un apilado normal a 300 píxeles.
