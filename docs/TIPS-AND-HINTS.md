# Likert Survey Pro — Tips & Hints (v1.0.0.0)

**TCViz** · support@tcviz.com
Demo video: https://www.youtube.com/watch?v=SzSs3gFReaY

---

## Getting Started

Likert Survey Pro draws survey answers as **diverging stacked bars**: every bar is centred
on the neutral response, so disagreement grows to the left of a shared axis and agreement to
the right. On a normal stacked bar every bar starts at zero and you cannot see which
questions lean negative without reading the numbers.

**Minimum to get a working chart:**

1. Add the visual to the canvas.
2. Drag your question text to **Question**.
3. Drag the answer text to **Response**.
4. Drag a count of answers — or any measure — to **Value**.
5. **Drag the numeric rank of each scale point to `Scale order`.** See the warning below.

> ⚠️ **`Scale order` is not optional in practice.** Without a defined order, Power BI hands
> the responses over alphabetically — *Agree, Disagree, Neutral, Strongly agree, Strongly
> disagree* — which is not a scale. A diverging chart built on that order is meaningless,
> and **the visual cannot detect it**, so it would draw it wrong without saying so. Either
> fill in `Scale order` with 1…5 (1 = leftmost, the most negative), or set **Sort by column**
> on the response column in the model. The field well keeps it inside the visual.

**Quick check:** remove `Scale order` and watch the scale scramble. Put it back and it
should snap into place. That is the proof the well is doing its job.

---

## Field Wells

| Field | Required | Kind | What it does |
|---|---|---|---|
| **Question** | Yes | Grouping | One diverging bar per value. Up to 1,000. |
| **Response** | Yes | Grouping | The scale point. Up to 30. |
| **Value** | Yes | Measure | Count of answers, or any measure to distribute across the scale. |
| **Scale order** | Strongly recommended | Measure | Numeric rank per scale point, 1 = leftmost. Fixes the order of the scale, and feeds the mean. |
| **Group** *(Pro)* | No | Grouping | The block a question belongs to, drawn as a labelled section. |
| **Tooltips** | No | Measure | Extra measures in the hover tooltip, in their model format. |

**Data shape.** One row per question × response, with the count in `Value`. If your source
is one row per respondent, group it first — in Power Query or with a measure. The visual
does not pivot raw responses.

---

## Format Pane Settings

### Scale

- **Negative points** — how many scale points sit to the left of the centre. Default 2, for
  a 5-point scale. On a 7-point scale set 3.
- **Neutral point** — the one setting that changes what the chart says:
  - *Split across the centre* (default): half the neutral segment on each side. The axis
    sits at true indifference.
  - *Count as positive*: the neutral joins agreement. Use it when your scale has no true
    midpoint, or when "not dissatisfied" counts as a pass.
  - *Leave out of the bar*: the neutral is dropped and **the percentages recalculate over
    the remaining answers**, so they add to 100% without it. This is the option that makes a
    weak question look decisive — use it deliberately.
- **Show as percentage** — on, every bar is the same length and questions with different
  response counts stay comparable. Off, bar length shows volume.

### Colors

- **Negative / Neutral / Positive** — the three anchors of the diverging ramp. Every
  intermediate point is interpolated, so a 7-point scale needs no extra pickers.
- **Scale point → fx** — conditional formatting on the scale colour. **One fx button for the
  whole scale, not one per response.**

### Questions and blocks

- Font, size and colour for the question labels and for the block headers.
- **Block colours** — one picker per block.

### Labels

- **Hide labels under (%)** — the threshold below which a segment's number is dropped. Raise
  it when bars get busy; a label that does not fit is worse than no label.
- **Decimals** — 0 for a summary, 1 when differences are small.

### Boxes, NPS and Benchmark *(Pro)*

- **Top box / bottom box** — the share at each end, printed beside the bar, with the depth
  under your control.
- **NPS** — top minus bottom, drawn as a pill with its own colours and size.
- **Benchmark** — a vertical line across every question, at a value you set. Use it for last
  wave's score or a company target.

### Layout

- **Row gap** and **column gap** — the space between bars, and between the question column
  and the chart. Tighten both when you have twenty questions on one page.

---

## Free vs Pro

| Feature | Free | Pro |
|---|---|---|
| Diverging stacked bars, centred | ✅ | ✅ |
| All three neutral-point modes | ✅ | ✅ |
| Percentages or values | ✅ | ✅ |
| Diverging colour ramp | ✅ | ✅ |
| Conditional formatting on scale colour | ✅ | ✅ |
| Legend, tooltips, report page tooltips | ✅ | ✅ |
| Cross-filtering, multi-select, context menu | ✅ | ✅ |
| Keyboard navigation | ✅ | ✅ |
| Data labels and threshold | ✅ | ✅ |
| Per-block colours | ✅ | ✅ |
| Top box / bottom box | — | ✅ |
| NPS pill | — | ✅ |
| Benchmark line | — | ✅ |
| Question groups (blocks) | — | ✅ |
| Block mean circle | — | ✅ |

**The free tier gives a correct result, not a cut-down one.** No question, no scale point and
no respondent is hidden, and nothing is watermarked in a published report. What Pro adds are
the analyst readings on top.

**While you are editing the report without a licence**, Pro options render *working* under a
*Pro preview* watermark, and Power BI shows its own notice with the purchase option. In
reading view — and wherever Power BI cannot check licences, such as Publish to Web, embedding
or export — the free result is drawn with no watermark, so a published report never uses a
Pro feature you have not paid for.

**There is a one-month free trial.** Start it from the Upgrade option in Power BI's own
notice, or from the plan on Microsoft AppSource. During the trial every Pro feature behaves
exactly as a paid licence — no watermark, no notice — and when it ends the report falls back
to the free result rather than breaking.

To unlock Pro, use the Upgrade option in Power BI's own notice, or buy the plan on Microsoft
AppSource. The visual draws no licensing UI of its own and has no licence key field.

---

## Tips and Best Practices

**Word every question in the same direction.** If some items are positive ("I am treated with
respect") and others negative ("I often feel overloaded"), agreement means the opposite thing
in each, the colours lie, and any mean over the scale is nonsense. Reverse-code the negative
items in the model before they reach the visual.

**Choose the neutral mode once, and say which one you used.** The three modes give three
different percentages from the same data. Moving between them to find the friendliest number
is how a survey stops being evidence. Put the choice in the report, not just in the format
pane.

**Sort by the top box, not alphabetically.** The point of a diverging chart is the ranking.
Sort the question axis by a top-box measure so the best and worst items sit at the ends.

**Use percentage for comparison, values for weight.** A question answered by 40 people and
one answered by 400 look identical in percentage. If that matters, put the response count in
Tooltips so the reader can check.

**Blocks earn their keep above about eight questions.** Below that they add chrome. Above it
they are the difference between a chart and a wall.

**Set the benchmark to the previous wave.** A single line turns "72% agree" into "up from
65%", which is the sentence people act on.

**Know how the block mean is weighted.** It is weighted by responses, not by questions, so a
block where one item got far more answers is pulled towards that item. That is usually what
you want, but it is worth knowing before you quote the number.

---

## Example Configurations

### Employee engagement survey

- Question → item text · Response → agreement scale · Value → count of answers
- Scale order → 1–5 · Group → dimension (Engagement, Management, Workplace)
- Pro: top box over the two most positive points, benchmark at last year's favourable score

### Customer satisfaction

- Question → touchpoint · Response → satisfaction scale · Value → responses
- Neutral point = *Leave out of the bar*, to report satisfied against dissatisfied only
- Tooltips → response count, so small samples stay visible

### Course evaluation

- Question → statement · Response → 7-point agreement scale · Negative points = 3
- Show as percentage on, sorted by top box

---

## Troubleshooting

**The scale is in the wrong order**
`Scale order` is empty, or it is not resolving to a number per response — it is read as the
first numeric value in the group, so a text column will not work. Alternative: set *Sort by
column* on the response column in the model.

**Everything is one colour**
Only one scale point has data, or the Response field has a single distinct value. Check that
the response column is not being filtered elsewhere on the page.

**The mean circle looks wrong**
The mean is computed from `Scale order` — or, when that well is empty, from the position in
the scale — weighted by responses. It does not read any average column in your data. If a
block reads low, check that its items are not reverse-worded.

**Percentages do not add up to 100**
You are using *Leave out of the bar* on the neutral point. That is what it does: the total is
recalculated over the remaining answers.

**Labels have disappeared**
*Hide labels under (%)* is above those segments' share, or the segment is narrower than the
text. Lower the threshold or widen the visual.

**Only 30 scale points show**
That is the cap, and it applies to Free and Pro alike. A scale with more than 30 points is
not a Likert scale.

**Clicking a segment breaks my slicers**
Click an empty area to deselect. Selection in the chart cross-filters the page; clearing it
restores the slicer-driven state.
