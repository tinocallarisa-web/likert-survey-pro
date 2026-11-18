# Changelog — Likert Survey Pro

All notable changes to this visual are documented here.
Versioning follows `MAJOR.MINOR.PATCH.BUILD` in `pbiviz.json` and semver in `package.json`.

---

## [1.1.0.0] — 2026-11-18 — test build, not yet submitted

### Added — free
- **Row height: Automatic or Fixed** (Layout card). Automatic is the default: the rows share the
  height of the visual and the bars grow up to 64 px, so ten questions in a tall visual fill it
  instead of leaving the bottom half empty. Fixed gives every row the height you type; when they
  do not fit, the chart scrolls, or a note says how many questions are not shown. Block bands,
  question text, labels and the right-hand columns follow the row.
- **Drilldown** on the Question field: a hierarchy or several fields, with the drill buttons of
  the visual header. *Expand all down* labels each bar *Parent · Child*.
- **Value axis** (percent marks either side of the centre and a title), **category axis title**
  over the question column, and **gridlines** every 10, 20, 25 or 50 %, all configurable.
- **Accessibility card**: high contrast Automatic or On, focus colour and width, minimum text
  size, and patterns on the scale points (direction = side, density = distance from neutral,
  dots = neutral). In high contrast the bars use the system colours with those patterns. The
  focused segment now has a visible outline.
- **On-object formatting**: bars, questions, legend, axes, gridlines, panel titles and background.
- **Report theme** style (default): text and block colours follow the report theme.
- **Setup guide** in three steps while editing (fields, try features on your data, pick a style),
  and a new start screen with links to the guide, product page and video.
- **Layouts by size** (large, medium, small): compact legend, narrow block column and right-hand
  columns removed before the bars shrink.
- **Dynamic format strings**: values and tooltips use the format of each value.
- **Fetch More Data**: in the Power BI service the visual requests rows in blocks of 1,000 (up to
  21,000). When rows are left out, a note and the warning icon say how many were used.
- **Bookmarks and selection**: a bookmark's selection is painted back on the chart; a selected
  segment is highlighted and the rest dimmed. Clicking a question selects the whole row and
  clicking a legend item selects that answer across questions. A selection carries every row it
  adds up. Up and down arrows move between questions.
- **12 languages** for the format pane, field wells and the visual's own texts.
- Legend text size and colour; background colour.

### Added — Pro
- **Small multiples**: one Likert chart per value of the new *Small multiples* field, sharing
  the questions and their order. Without a licence, while editing, the first 4 panels show under
  the watermark.
- **The six collection styles**: Boardroom, Ledger, Editorial, Signal, Aurora and Terrace, the
  same as KPI Card, Pareto, Treemap and the rest of TCViz.

### Changed
- The Pro preview watermark is the one shared by every TCViz visual.
- Text colours you have not set follow the report theme instead of a fixed dark grey; the
  diverging scale keeps its colours. Reports that set colours by hand look the same.
- The licence check also accepts a private `partner` plan.
- `allowInteractions` is read from `hostCapabilities`, so turning interactions off in the host
  stops clicks from filtering.
- Without the Small multiples feature, panels are added together into one chart (the correct
  total) rather than repeating each question.

### Fixed
- **Leave out of the bar** did not remove the neutral point in 1.0.0.1. It now does, on scales
  with a middle point.
- Long question labels lost their last letters (column width +20 px, committed separately).

### Certification
- API 5.11.1. Unused `d3` and `tooltiputils` removed. `npm audit`: 0 vulnerabilities. ESLint clean.
- Still `privileges: []`; no `fetch`, `XMLHttpRequest`, `innerHTML` or storage.

## [1.0.0.1] — 2026-10-02

First published version. Resubmission of 1.0.0.0 after certification review.

### Fixed
- **Rendering events: exactly one pair per `update()`.** When the licence resolved after the
  first render, the visual repainted by calling `update()` again, which emitted a second
  `renderingStarted` / `renderingFinished` pair for a single host update (Microsoft policy
  1200.1.2). The repaint now runs the render without emitting events; only the host's
  `update()` emits them, once. Verified with an on-screen event counter in a test build:
  loading, licence resolution, resize, formatting changes, Pro preview, cross-filtering and
  page switches all stay 1:1.
- **Top/bottom box and NPS columns aligned.** The NPS pill was drawn right after the
  top/bottom box text, whose width changes per row ("8% / 76%" against "39% / 37%"), so the
  pills zig-zagged. The text is now right-aligned in its own column and every pill starts at
  the same x with the same width. The space reserved on the right is measured on the real
  texts instead of estimated, so "100% / 100%" no longer overflows.

## [1.0.0.0] — 2026-09-21 — submitted, not published

First version. Returned by certification (1200.1.2, see 1.0.0.1); Partner Center keeps the
number, so the first published version is 1.0.0.1.

### Added
- Diverging stacked bars centred on the neutral response, one bar per question.
- **Neutral handling**: split across the centre, counted as positive, or left out of the bar.
  Leaving it out changes each question's total, so the percentages are recalculated.
- Percentages or raw values, with a threshold to hide labels on small segments.
- **Conditional formatting (fx) on the scale point colour**: one rule for the whole scale,
  overridden per response by a colour set by hand.
- Diverging colour ramp between the two ends, through the neutral colour.
- Cross-filtering with dimming, report tooltips, context menu, multi-visual selection.
- Keyboard: roving tabindex so the chart is a single Tab stop; arrows, Home/End, Enter,
  Escape, Shift+F10.
- High contrast through `host.colorPalette`.
- Landing page, and `host.allowInteractions` honoured.
- English and Spanish, with every data role, card and property carrying its `displayNameKey`.
- **Pro**: Top/Bottom box, NPS (top minus bottom), benchmark line and question groups.
  Without a licence, in edit mode, they render under a "Pro preview" watermark.
- A colour picker per block, seeded from the report theme. A rule cannot do this: a rule
  evaluates one condition for every element, so it cannot express "this block in this
  colour".
  Without a licence, in edit mode, they render under a "Pro preview" watermark.

### Certification
- `privileges: []`. No `fetch`, `XMLHttpRequest`, `WebSocket`, `eval` or `innerHTML`.
- Format pane built with `getFormattingModel`, not the deprecated
  `enumerateObjectInstances`.
- `npm audit`: 0 vulnerabilities. ESLint with `eslint-plugin-powerbi-visuals`: no errors.
