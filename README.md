# Likert Survey Pro

Diverging stacked bars for Likert and survey data, centred on the neutral response.
Version 1.1.0.0.

**Built for Microsoft certification: no network access.** `privileges` is `[]`: the visual makes no HTTP
requests, opens no sockets, stores nothing and needs no companion service. No data leaves
the report.

- **Support and documentation** — https://tinocallarisa-web.github.io/likert-survey-pro/support.html
- **Privacy** — https://tinocallarisa-web.github.io/likert-survey-pro/privacy.html
- **Terms** — https://tinocallarisa-web.github.io/likert-survey-pro/terms.html
- **Changelog** — https://tinocallarisa-web.github.io/likert-survey-pro/changelog.html

## Field wells

| Well | Type | What it does |
|---|---|---|
| Question | Grouping | One diverging bar per value. A hierarchy here gives drilldown |
| Response | Grouping | The scale point: Strongly disagree … Strongly agree (up to 30) |
| Value | Measure | Count of responses, or any measure to distribute across the scale |
| Scale order | Measure | Numeric rank per scale point, 1 = leftmost. This is what fixes the order of the scale |
| Group [Pro] | Grouping | Block the questions belong to, drawn as a labelled section |
| Small multiples (Pro) | Grouping | One Likert chart per value, with the same questions |
| Tooltips | Measure | Extra measures in the tooltip |

> **Fill in Scale order.** Without a defined order Power BI hands the responses over
> alphabetically — *Agree, Disagree, Neutral, Strongly agree, Strongly disagree* — which is
> not a scale, and a diverging chart built on it means nothing. The visual cannot detect
> this, so it would draw it wrong without saying so. Sorting the response column in the
> model with **Sort by column** works too, but that needs the model configured; the well
> keeps it inside the visual.

Rows (question × group × panel) arrive in blocks of 1,000; in the service the visual requests
more (up to 21,000), in Desktop it uses the first 1,000, and a note says when rows were left out.

## Free vs Pro

**Free** — the full diverging scale centred on the neutral point, the three ways of
handling that neutral point, percentages or values with dynamic format strings, the diverging
colour ramp, conditional formatting on the scale colour, row height Automatic or Fixed,
drilldown, value axis, axis titles and gridlines, legend, tooltips, cross-filtering,
bookmarks, keyboard navigation, the Accessibility card (high contrast, focus, minimum text size,
patterns), on-object formatting, the setup guide, Report theme, layouts by size and 12 languages.

**Pro** — Top/Bottom box, NPS (top minus bottom), the benchmark line, question groups (with
block colours and score), small multiples and the six collection styles (Boardroom, Ledger,
Editorial, Signal, Aurora, Terrace).

The free tier gives a **correct** result, not a cut-down one: no question, scale point or
respondent is hidden. Without a licence, small multiples are added together into one chart.

Without a licence, while editing the report, Pro features render working under the shared
*Pro preview* watermark (small multiples: the first 4 panels) and Power BI shows its own
purchase notice. In reading view — and wherever Power BI cannot check licences, such as Publish
to Web, embedding or export — the free result is drawn with no watermark, so a published report
never uses an unpaid feature.

## Build

```bash
npm install
npm run eslint          # requisito de certificación
npx tsc --noEmit
node build-test.js --free   # el único modo que muestra la vista previa Pro y los avisos
node build-test.js          # Pro forzado (añadir --events para el contador de eventos, --verbose)
# producción: solo tras probar en Desktop y con confirmación de Tino

python tools/i18n.py                    # 12 idiomas: stringResources/ y src/strings.ts (falla si falta una traducción)
python tools/simulador/harness.py pro   # tras build-test.js: capturas y comprobaciones (eventos, filas, F11, fetch, on-object, marcadores)
python tools/simulador/harness.py free  # tras build-test.js --free: Free, vista previa, todas las identidades
python C:\tcviz\utillaje\sincronizar_comun.py likert-survey-pro   # marca de agua y paleta comunes
node scripts/build-changelog.js         # docs/changelog.html desde CHANGELOG.md
python C:\tcviz\utillaje\ficha_html.py .   # docs/APPSOURCE-DESCRIPTION.html desde la ficha
node scripts/check-listing-length.js    # mide los textos contra los límites de Partner Center
```

`src/comun/` and `style/comun/` are copies of `C:\tcviz\utillaje\comun` (watermark and palette):
never edit them here.

## Repository layout

The `certification` branch is what Microsoft reviews; it must match the submitted package.
`docs/` holds the published pages and the release deliverables, and is what GitHub Pages
serves. Certification notes live in `docs/CERTIFICATION-NOTES.md`, with the 2,500-character
version to paste into Partner Center in `docs/CERTIFICATION-NOTES-SHORT.txt`.
