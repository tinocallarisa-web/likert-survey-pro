# Likert Survey Pro

Diverging stacked bars for Likert and survey data, centred on the neutral response.

**Certified, with no network access.** `privileges` is `[]`: the visual makes no HTTP
requests, opens no sockets, stores nothing and needs no companion service. No data leaves
the report.

- **Support and documentation** — https://tinocallarisa-web.github.io/likert-survey-pro/support.html
- **Privacy** — https://tinocallarisa-web.github.io/likert-survey-pro/privacy.html
- **Terms** — https://tinocallarisa-web.github.io/likert-survey-pro/terms.html

## Field wells

| Well | Type | What it does |
|---|---|---|
| Question | Grouping | One diverging bar per value |
| Response | Grouping | The scale point. **Sort this column in the model** to fix the order of the scale |
| Value | Measure | Count of responses, or any measure to distribute across the scale |
| Scale order | Measure | Numeric rank per scale point, 1 = leftmost. This is what fixes the order of the scale |
| Group [Pro] | Grouping | Block the questions belong to, drawn as a labelled section |
| Tooltips | Measure | Extra measures in the tooltip |

> **Fill in Scale order.** Without a defined order Power BI hands the responses over
> alphabetically — *Agree, Disagree, Neutral, Strongly agree, Strongly disagree* — which is
> not a scale, and a diverging chart built on it means nothing. The visual cannot detect
> this, so it would draw it wrong without saying so. Sorting the response column in the
> model with **Sort by column** works too, but that needs the model configured; the well
> keeps it inside the visual.

## Free vs Pro

**Free** — the full diverging scale centred on the neutral point, the three ways of
handling that neutral point, percentages or values, the diverging colour ramp, conditional
formatting on the scale colour, legend, tooltips, cross-filtering, drill-through selection,
keyboard navigation and high contrast.

**Pro** — Top/Bottom box, NPS (top minus bottom), the benchmark line and question groups.

The free tier gives a **correct** result, not a cut-down one: no question, scale point or
respondent is hidden. What Pro adds are the analyst readings on top.

Without a licence, while editing the report, Pro features render working under a
*Pro preview* watermark and Power BI shows its own purchase notice. In reading view — and
wherever Power BI cannot check licences, such as Publish to Web, embedding or export — the
free result is drawn with no watermark, so a published report never uses an unpaid feature.

## Build

```bash
npm install
npm run eslint          # requisito de certificación
npx tsc --noEmit --skipLibCheck
node build-test.js --free   # el único modo que muestra la vista previa Pro y los avisos
node build-test.js          # Pro forzado
npm run package             # producción, solo tras probar
```

## Repository layout

The `certification` branch is what Microsoft reviews; it must match the submitted package.
`docs/` holds the published pages and the release deliverables, and is what GitHub Pages
serves. Certification notes live in `docs/CERTIFICATION-NOTES.md`, with the 2,500-character
version to paste into Partner Center in `docs/CERTIFICATION-NOTES-SHORT.txt`.
