# Certification Notes — Likert Survey Pro v1.0.0.0

**Visual GUID:** `likertSurveyProTCViz976FC0D15EE24876A338A1A985F3B2BC`
**Plan ID:** `likert-survey-pro-tcviz` (Service ID `tino_callarisa.likert-survey-pro.likert-survey-pro-tcviz`)
**Publisher:** TCViz (support@tcviz.com)
**Version:** 1.0.0.0 — first submission
**Submission date:** (fill on submission)

---

## Please read first — Pro preview

Without a licence, **in edit mode only**, Pro options render *working* under a "Pro preview"
watermark, with a banner naming the feature. This is intentional, not missing gating.

In reading view, before the licence has resolved, and wherever licences cannot be read
(Publish to Web, embedding, export), the **free** result is drawn with no watermark and no
notice. A published report therefore never uses an unpaid Pro feature.

The gate is the view mode reported by the host (`options.viewMode !== 0`), **not** Desktop
against Service. Both hosts behave identically: edit shows the preview, reading does not.

---

## Source Code

**Certification branch:** `certification`
GitHub: https://github.com/tinocallarisa-web/likert-survey-pro/tree/certification

The `certification` branch contains the exact source used to build the submitted `.pbiviz`.
`node_modules/`, `dist/` and `.tmp/` are in `.gitignore` and are not tracked.

---

## Required URLs

| Resource | URL |
|---|---|
| Support | https://tinocallarisa-web.github.io/likert-survey-pro/support.html |
| Privacy Policy | https://tinocallarisa-web.github.io/likert-survey-pro/privacy.html |
| Terms of Service | https://tinocallarisa-web.github.io/likert-survey-pro/terms.html |
| GitHub repo | https://github.com/tinocallarisa-web/likert-survey-pro |
| Demo video | https://www.youtube.com/watch?v=SzSs3gFReaY |

---

## Capabilities Flags

All five required flags are present in `capabilities.json`:

```json
"supportsHighlight": true,
"supportsSynchronizingFilterState": true,
"supportsLandingPage": true,
"supportsKeyboardFocus": true,
"supportsMultiVisualSelection": true,
"privileges": []
```

`"tooltips": { "supportedTypes": { "default": true, "canvas": true }, "roles": ["tooltips"] }`
and `"sorting": { "default": {} }` are also declared.

---

## Data Roles

| Role | Kind | Required | Description |
|---|---|---|---|
| `question` | Grouping | Yes | Question text. One diverging bar per value. |
| `response` | Grouping | Yes | Scale point. |
| `value` | Measure | Yes | Count of answers, or any measure distributed across the scale. |
| `order` | Measure | No | Numeric rank per scale point, 1 = leftmost. Fixes the order of the scale and feeds the mean. |
| `group` | Grouping | No | Block the question belongs to. Pro. |
| `tooltips` | Measure | No | Extra measures shown in the tooltip. |

**Data view mapping.** Categorical. `categories` selects `group` then `question`
(`dataReductionAlgorithm.top.count: 1000`); `values.group.by` is `response`
(`top.count: 30`), binding `value`, `order` and `tooltips`. Conditions cap each role at one
field.

The 30-point cap on the scale applies to both tiers and is a rendering limit, not a licence
gate: a Likert scale with more than 30 points is not a Likert scale.

---

## License Validation

- Validated through the official `IVisualLicenseManager`
  (`options.host.licenseManager`). No other mechanism, and no licence key field.
- `getAvailableServicePlans()` is called **once**, deferred after the first render.
  Resolution is non-blocking: the visual renders the free result immediately while the check
  completes. There is no spinner and no blocked state.
- Pro is granted when the plan's state is `Active` (1) or `Warning` (2, the payment grace
  period) **and** its identifier matches the plan. The one-month free trial configured on
  the Partner Center plan resolves as `Active`, so a trial user gets the full Pro
  experience through the same code path, with no separate branch. The match is done by
  `matchesPlan()` in `src/settings.ts`:

  ```ts
  export function matchesPlan(spIdentifier: unknown, planId: string): boolean {
      const sp = String(spIdentifier ?? "");
      return sp === planId || sp.endsWith("." + planId);
  }
  ```

  `getAvailableServicePlans()` returns the **full Service ID**
  (`publisher.offer.plan`), not the short Plan ID. Comparing with `===` against the short
  form never matches and leaves a paying customer on the free tier, so both forms are
  accepted.
- `isLicenseUnsupportedEnv` and `isLicenseInfoAvailable` are honoured: where the licence
  cannot be read, the free experience renders and **no purchase prompt is shown**.
- **No licensing UI of its own.** When a free user turns on a Pro option, the visual calls
  Power BI's `notifyFeatureBlocked` with the feature name and then `notifyLicenseRequired`,
  which carry the purchase path, and calls `clearLicenseNotification` when the licence
  resolves to Pro. Both calls are wrapped so a host that does not implement them cannot
  break rendering.

---

## Privacy and Network

**The visual makes zero external network calls.** No telemetry, no analytics, no CDN loads,
no cookies and no storage.

- `privileges` is `[]`. The certification audit
  (`pbiviz package --certification-audit`) reports *"No external requests found in the
  visual."*
- Fonts are system fonts, resolved locally by the browser.
- All data is processed in memory inside the Power BI sandbox and nothing is kept beyond the
  render call.
- Format settings are stored in the `.pbix` by the platform, through standard `objects`
  storage.

---

## XSS and DOM construction

- **There is no `innerHTML` or `outerHTML` anywhere in `src/`**, and no
  `eslint-disable powerbi-visuals/no-inner-outer-html` suppression. ESLint
  (`eslint-plugin-powerbi-visuals`) passes clean, both standalone and in the packaging step.
- The chart is SVG built with `document.createElementNS()`. Every string that comes from
  the data — question text, response labels, formatted values, tooltip content — is written
  with `.textContent`, which the browser never interprets as markup.
- Tooltip content is passed to Power BI's own `tooltipService`, not rendered by the visual.
- Colours reaching SVG attributes come from format-pane `ColorPicker` slices and from the
  conditional-formatting rule, both produced by the host, not from free text in the data.

**Verification:** setting a Question or Response value to `<script>alert('XSS')</script>`
displays that text literally in the label, with no script execution.

---

## Accessibility

- **Keyboard.** Roving `tabindex`: exactly one segment carries `tabindex="0"` and the rest
  `-1`, so the chart is a single tab stop and does not trap the user. `ArrowLeft` /
  `ArrowRight` move between segments, `Home` / `End` jump to the first and last, `Enter` and
  `Space` select (with `Ctrl`/`Cmd` for multi-select), `Escape` clears, and `Shift+F10` opens
  the Power BI context menu positioned on the focused segment.
- **Screen readers.** The chart root carries `aria-label`; each segment carries an
  `aria-label` of the form *"<question>, <response>: <share>%"*. Decorative elements —
  the watermark, the mean circles, the NPS pill — are `aria-hidden="true"`, since their
  numbers are already reachable in the segment labels and tooltips.
- **High contrast.** `colorPalette.isHighContrast` is read on every render. When it is
  active the diverging ramp is replaced by the theme's `foreground` and `foregroundSelected`,
  so negative and positive segments stay distinguishable without relying on the palette.
  See *Known gaps* below for what this does not yet cover.

---

## Power BI feature support

- **Cross-filtering** through `selectionManager.select()`, with `Ctrl`/`Cmd` for multi-select
  and a click on empty space to clear. `supportsMultiVisualSelection` is declared.
- **Highlighting.** `supportsHighlight` is declared and honoured: segments outside the
  highlight are drawn at reduced opacity rather than removed.
- **Report page tooltips**, declared with `canvas: true`, with identities passed to
  `tooltipService.show()`.
- **Number formatting.** Values are formatted with `valueFormatter.create()`, using the
  column's own `source.format` from the model and `host.locale`, rebuilt on every `update()`
  rather than cached.
- **Landing page.** `supportsLandingPage` is declared and the visual draws a prompt naming
  the three required wells when `Value` is missing, instead of an empty canvas or an error.
- **Format pane** uses `getFormattingModel()` (`powerbi-visuals-utils-formattingmodel`), not
  the deprecated `enumerateObjectInstances`.
- **Conditional formatting** on the scale colour is declared on the formatting-model slice
  with `instanceKind: 3` (ConstantOrRule) and a
  `dataViewWildcard.createDataViewWildcardSelector(InstancesAndTotals)` selector, so a single
  `fx` button governs the whole scale rather than one per response.
- **Allow Interactions.** `host.allowInteractions` is checked before selection, keyboard
  activation and the context menu.

---

## Features — Free tier

Available with no licence and in every reading view:

- Diverging stacked bars centred on the neutral response, with the number of negative points
  configurable
- All three neutral-point modes, with percentages recalculated when the neutral is excluded
- Percentages or absolute values
- Diverging colour ramp and conditional formatting on the scale colour
- Data labels with a hide-under-percentage threshold
- Legend, tooltips and report page tooltips
- Cross-filtering, multi-select and the context menu
- Keyboard navigation and screen-reader labels
- Per-block colours
- Format pane: all cards. Pro options are visible and marked `[Pro]`; they apply only with a
  licence.

## Features — Pro tier

- Top box and bottom box beside each bar, with configurable depth
- NPS, drawn as a pill with its own colours and size
- Benchmark line across every question
- Question groups drawn as labelled blocks, with the block mean in a circle

---

## Testing Instructions

### Free tier (no active plan)

1. Install the visual. Add Question, Response, Value and Scale order. The diverging scale
   renders, centred.
2. Remove `Value`: the landing page appears — not an error and not a blank canvas.
3. **In edit mode**, turn on Top/Bottom box, NPS or Benchmark, or drag a field to Group. Each
   renders **working** under the "Pro preview" watermark, a banner names the feature, and
   after roughly ten seconds Power BI's own Upgrade bar appears.
4. Switch to reading view: the free result is drawn, with no watermark and no notice.
5. Click a segment: other visuals filter. `Ctrl`+click adds. Clicking empty space clears.
6. Tab to the chart, move with the arrow keys, `Enter` to select, `Escape` to clear,
   `Shift+F10` for the context menu.
7. Resize the visual very narrow: the question column is capped and the bars remain visible.
8. Set Negative points to 0 and then to the full width of the scale: the chart must not break
   or overflow its area.

### Pro tier (active `likert-survey-pro-tcviz` plan, or its one-month free trial)

1. The same Pro options render with **no watermark and no notice**. The trial behaves
   exactly as a paid licence: it arrives as state `Active` on the same plan.
2. Add a Group field: blocks are drawn as labelled sections, each with its mean in a circle.
3. The block mean is weighted by responses, computed from `Scale order` — or, when that well
   is empty, from the position in the scale.

### XSS

Set a Question or Response value to `<script>alert('XSS')</script>`. The text must appear
literally in the label with no alert.

---

## Known gaps

1. **High contrast is partial.** The scale colours switch to the theme's `foreground` and
   `foregroundSelected`, so segments stay legible and the negative/positive split is
   preserved. The axis line, row separators, block chrome and label text still use fixed
   colours, and all negative points share one theme colour rather than being distinguished
   from each other. Full theme-colour coverage and a non-colour encoding for the scale
   points are planned for the next release.
2. **Bookmarks are not restored into the visual.** Selection made in the chart
   cross-filters the report correctly, but `registerOnSelectCallback` is not implemented, so
   a bookmark that carries a selection does not paint it back onto the segments. It is on
   the list for the next release.
3. **`Scale order` is undetectable when absent.** With the well empty the visual falls back
   to the position of each response in the order Power BI supplies, which is alphabetical
   unless the model sorts it. A diverging chart on an alphabetical scale is wrong, and the
   visual cannot tell. It is documented prominently in the support page and the sample
   report; detecting it is not possible from the data alone.

---

## Build Verification Checklist

- [x] `isPro` resolved by `licenseManager`, never hardcoded in the submitted package
- [x] `guid` has no `_test` suffix
- [x] `npx tsc --noEmit --skipLibCheck` passes cleanly
- [x] `npm run eslint` passes with no suppressions
- [x] `npm audit`: 0 vulnerabilities
- [x] No `console.log` or `debugger` in `src/`
- [x] No `innerHTML` or `outerHTML` in `src/`
- [x] `capabilities.json` has all five required flags and `"privileges": []`
- [x] Certification audit reports no external requests
- [x] `pbiviz.json` version matches the package version
- [x] `assets/icon.png` present and embedded in the package
- [ ] `privacy.html`, `terms.html` and `support.html` reachable at their published URLs
- [ ] Video URL pasted into Partner Center in canonical form
      (`https://www.youtube.com/watch?v=…`, never `youtu.be`)
