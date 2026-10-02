# Changelog — Likert Survey Pro

All notable changes to this visual are documented here.
Versioning follows `MAJOR.MINOR.PATCH.BUILD` in `pbiviz.json` and semver in `package.json`.

---

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
