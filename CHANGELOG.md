# Changelog — Likert Survey Pro

All notable changes to this visual are documented here.
Versioning follows `MAJOR.MINOR.PATCH.BUILD` in `pbiviz.json` and semver in `package.json`.

---

## [1.0.0.0] — unreleased

First version.

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
