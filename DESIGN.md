# World Tracker design principles

How World Tracker presents data. Read this before any UI work (app, games, static pages, share cards, embeds).
The site shows a lot of numbers; the job is to make them effortless to read and compare. When a change breaks one
of these rules, fix the change, not the rule; when a rule is wrong, change it here first, with the reason.

## 1. Comparisons: the eye never travels

The core rule, from Mishiko: when two countries are compared, the difference must be visible at a glance.

- **Paired values sit next to each other**: in the same row, one directly above the other or side by side
  within a few centimetres, never at opposite edges of the screen or card. No mirrored (butterfly) layouts where A's
  number is far left and B's far right.
- **Same scale**: both bars of a pair share one scale (the larger value fills the bar); both lines of a chart share
  one axis. A bar's length must mean the same thing for both countries.
- **Say the difference**: next to every pair, the difference in words or numbers: "8.2× less", "+19", "0.5 pp
  lower", "3.2 years more". The reader shouldn't do arithmetic.
- **Mark the winner**: the better value is green and bold (higher, or lower where lower is better: inflation,
  debt). Neither is marked where "better" doesn't apply (median age, density, age groups).
- **One country, one color, everywhere**: country A (selected) is red, country B (compared) is blue: map fill,
  bars, chart lines, name underlines, swatches. Red never means "worse", because red is A.
- **The key is always visible**: names with flags, underlined in their colors, in a header that doesn't scroll away.

## 2. Hierarchy: numbers loud, labels quiet

- One headline number per view (Power Level score, the value being guessed). It's the biggest thing on screen.
- Values are bright and bold; labels are dim and small; units and years are smaller still.
- Details on demand: sections are collapsible, years and sources live in tooltips, trend charts open on click.
  Never remove data to declutter: hide it one click away instead.

## 3. Numbers

- Human units: 341.8 M, $29.2 tn, $85.8 k. The full number only where precision matters (static pages, tooltips).
- Tabular (equal-width) digits so numbers in a column line up; right-align number columns.
- Consistent precision per metric everywhere (population 1 decimal in M, life expectancy 1 decimal, scores 1
  decimal for Power Level, whole numbers for pillars).
- Every number has a year and a source within reach. Missing data says "No data" / "Not enough data"; nothing
  is guessed or forced (Power Level needs 5 of 6 pillars).

## 4. Country identity

- A flag before every country name, everywhere: panel, list, search, games, static pages, cards.
- Country names are the common ones (South Korea, not Republic of Korea; scripts/displayNames.json).

## 5. Charts

- Plain and direct: few gridlines, first and last year on the axis, values readable by pointing.
- Pointing reads out a year; dragging measures a change (start → end, ▲/▼ %, pp or years). Green up, red down
  in change readouts only (there they're directions, not countries).
- Two countries on one chart use their A/B colors on one shared axis.

## 6. Share cards and anything that leaves the site

Share cards, link previews and embeds are how the site spreads, so they get the most care.

- Legible as a thumbnail (~500 px wide in a feed): huge scores, few elements, high contrast, nothing below ~14 px
  at 1200×630.
- The comparison rules of §1 apply in full: pairs adjacent, difference written, winner marked.
- Always branded (WORLD TRACKER + address) and always true to the data on the site.
- The comparison card is the "fight poster" (src/share/comparisonCard.ts, chosen by Mishiko after many rounds):
  - Header: both flags whole and darkened (they are backgrounds), each fading slowly into a deep red or navy
    tint through a blurred copy of itself; split by a diagonal; nothing else on the split line.
  - Names, score and rank meet at the VS badge (pink-to-blue ring), A right-aligned on the left, B left-aligned on
    the right, a red/blue key line under each name. Winner's score teal.
  - Scoreboard: "categories won" tally, then rows of bar · value · category · value · bar. The winner's value is
    a teal pill, its bar solid with the gap at its end; the loser's bar is solid but dimmer (never hollow).
  - Card palette is fixed (A #ff5c8a, B #4cc9ff, better #5eead4, Outfit font), independent of map styles.
- Check every card change by rendering real pairs (long names, unscored countries, tiny values) and looking at them.

## 7. Layout and interaction

- Things stay where they are: the same control sits in the same place on every page (the Map | Play switch is
  pinned and tested). Moving between pages never makes the user search for the way back.
- Every action works by touch: no hover-only features, targets at least ~40 px on phones, gestures that don't
  fight scrolling (sideways drag on charts, vertical scroll still works).
- Text never smaller than 11 px; contrast stays readable on the satellite map.

## 8. Consistency

- The same thing is drawn by the same component everywhere: a comparison row looks the same in the info panel, the
  embed and the share card. New views reuse these components instead of drawing their own variant.
- Copy is plain and short: sentence case, no jargon, verbs on buttons ("Compare", "Share", "Copy link").

## Checklist before shipping UI

- [ ] Can someone see which country is ahead on each number without moving their eyes across the screen?
- [ ] Is every pair on one scale, with the difference written next to it?
- [ ] Red = A, blue = B, green = better, nowhere else?
- [ ] Flag before every country name?
- [ ] Works by touch on a 390 px wide phone and on a sideways phone?
- [ ] Readable as a small thumbnail (cards)?
- [ ] Missing data says so instead of hiding or guessing?
