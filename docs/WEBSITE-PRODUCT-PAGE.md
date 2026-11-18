# Website product page — Likert Survey Pro 1.1.0.0

Entry for `C:\tcviz\web\src\data.jsx` (array `PRODUCTS`, id `likert-survey-pro`). **Replace the
current entry only when Microsoft publishes 1.1** (skill `tcviz-publicada`): until then the web
must keep describing 1.0.0.1, which is what buyers install. Keep `price`, `appSource`,
`screenshot` and `infographic` as they are today (prices frozen until December); bump the `?v=`
of the images only if new captures are made.

Corrections against the 1.0 entry, checked against the code:
- Per-block colours stay under Pro: the colour picker itself is not gated, but blocks only exist with
  the Group field, which is Pro (`buildRows` drops the group without a licence). Same in `terms.html`.
- New fields: Small multiples (Pro). Question accepts a hierarchy (drilldown).
- No "certified" claim: `certified: false` stays.

```js
  {
    id: "likert-survey-pro",
    guide: "/guides/likert-survey-pro.html",
    docs: "https://tinocallarisa-web.github.io/likert-survey-pro/support.html",
    certified: false,
    screenshot: "/logos/screenshots/likert-survey-pro.png?v=3",
    infographic: "/logos/screenshots/likert-survey-pro-infographic.png?v=4",
    appSource: "https://marketplace.microsoft.com/en-us/product/power-bi-visuals/tino_callarisa.likert-survey-pro?tab=Overview",
    youtube: "https://www.youtube.com/watch?v=SzSs3gFReaY",
    name: "Likert Survey Pro",
    icon: "/logos/icons/likert-survey-pro.png",
    tagline: "Survey results read wrong on a normal stacked bar. Centre every bar on the neutral response and the answer is obvious.",
    category: "Analytics",
    price: 9.99,
    version: "1.1.0.0",
    updated: "<fecha de publicación>",
    downloads: 0,
    rating: 0,
    tags: ["Survey", "Likert", "Diverging", "NPS", "Feedback"],
    summary: "Every bar on a normal stacked chart starts at zero, so agreement and disagreement pile up in the same direction and you cannot see which questions lean negative. Likert Survey Pro centres every bar on the neutral response: disagreement grows to the left of a shared axis, agreement to the right, and the comparison between ten questions becomes something you read in a second. Rows fill the visual, a hierarchy drills down, and an Accessibility card adds patterns, focus and minimum text size. Pro adds Top/Bottom box, NPS, a benchmark line, question groups, small multiples and the six collection styles.",
    features: [
      "Diverging stacked bars centred on the neutral point, with the number of negative points under your control",
      "Three ways to treat the neutral response: split it across the centre, count it as positive, or leave it out \u2014 and the percentages recalculate",
      "Percentages or values, with dynamic format strings from your measure",
      "A Scale order field well fixes the order of the scale inside the visual, without touching the model",
      "Diverging colour ramp, conditional formatting (fx) on the scale colour, and a colour per block",
      "Row height Automatic (rows fill the visual, bars up to 64 px) or Fixed, with scrolling or a note when rows do not fit",
      "Drilldown on Question, value axis, axis titles and gridlines",
      "Cross-filtering from segments, questions and the legend; bookmarks keep the selection",
      "On-object formatting, a setup guide while you edit, Report theme, layouts for small tiles and 12 languages",
      "Accessibility card: high contrast, focus colour and width, minimum text size and patterns on the scale points"
    ],
    dataRoles: [
      { role: "Question", kind: "Grouping (dimension)", required: "\u2705 Yes", desc: "One bar per question; a hierarchy drills down" },
      { role: "Response", kind: "Grouping (dimension)", required: "\u2705 Yes", desc: "The points of the scale" },
      { role: "Value", kind: "Numeric measure", required: "\u2705 Yes", desc: "Count or share of each response" },
      { role: "Scale order", kind: "Numeric measure", required: "\u274c No", desc: "Fixes the order of the scale without touching the model" },
      { role: "Group", kind: "Grouping (dimension)", required: "\u274c No", desc: "Blocks drawn as labelled sections (Pro)" },
      { role: "Small multiples", kind: "Grouping (dimension)", required: "\u274c No", desc: "One Likert chart per region, year or team (Pro)" },
      { role: "Tooltips", kind: "Any field", required: "\u274c No", desc: "Extra measures in the tooltip" }
    ],
    quickStart: [
      "Add Question, Response and Value \u2014 the diverging scale renders centred.",
      "Add Scale order so the scale reads from most negative to most positive.",
      "Set how many points count as negative, and how the neutral response is treated.",
      "Follow the setup guide to try styles, Top/Bottom box, NPS, the benchmark and patterns on your data."
    ],
    freemium: {
      free: "A correct result, not a cut-down one: no question, no scale point and no respondent is hidden, and nothing is watermarked in a published report. Diverging bars, neutral handling, percentages or values, scale order, colours, data labels, row height, drilldown, axis and gridlines, tooltips, cross-filtering, bookmarks, on-object formatting, the Accessibility card, Report theme and 12 languages.",
      pro: [
        "Top box and bottom box: the share at each end of the scale, beside the bar",
        "NPS, shown as a pill with its own colours",
        "A benchmark line across every question, to compare against a target or a previous wave",
        "Question groups: blocks drawn as labelled sections, with each block\u2019s score in a circle and its own colour",
        "Small multiples: one Likert chart per value, with the same questions",
        "The six collection styles: Boardroom, Ledger, Editorial, Signal, Aurora and Terrace"
      ]
    },
    formattingPane: [
      { group: "Style template", items: ["Report theme (free) or one of six collection styles (Pro); setup guide"] },
      { group: "Scale", items: ["Negative points, neutral handling (split / positive / excluded), percentages or values"] },
      { group: "Colours", items: ["Diverging ramp, conditional formatting on the scale colour"] },
      { group: "Labels and layout", items: ["Data labels and their threshold, row height Automatic or Fixed, scroll, gaps"] },
      { group: "Axes", items: ["Value axis with percent marks and title, category axis title, gridlines"] },
      { group: "Pro readings", items: ["Top box, bottom box, NPS pill, benchmark line, question groups, small multiples"] },
      { group: "Accessibility", items: ["High contrast, focus colour and width, minimum text size, patterns, keyboard, screen reader labels"] }
    ],
    tips: [
      { title: "Getting Started", body: "Add Question, Response and Value, then Scale order. The setup guide in the corner shows what is missing and lets you try features on your own data." },
      { title: "The neutral response", body: "Three treatments: split it across the centre, count it as positive, or leave it out of the bar. The percentages recalculate in each case, so pick the one your methodology uses." },
      { title: "Tall or small visuals", body: "Row height Automatic lets the rows fill the visual; in a small tile the legend turns compact and the side columns step aside before the bars shrink." },
      { title: "Comparing regions (Pro)", body: "Put region or team in Small multiples: every panel lists the same questions in the same order, so a row reads across the grid." }
    ],
    changelog: [
      ["1.1.0.0", "<fecha de publicación>", "Row height, drilldown, axes and gridlines, Accessibility card, on-object formatting, setup guide, 12 languages; Pro small multiples and styles."],
      ["1.0.0.1", "2026-10-02", "First published version."]
    ]
  },
```
