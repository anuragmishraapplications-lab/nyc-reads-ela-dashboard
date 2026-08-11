# NYC Reads — ELA Results Explorer

Interactive dashboard of NYCPS public ELA results (grades 3–8, 2018–2026) for CPRL /
the Robertson Foundation ask.

**Deliverable:** `NYC_Reads_ELA_Dashboard.html` — one file, 1.5 MB, opens by
double-clicking. No server, no install, no network needed (Chart.js and all data are
embedded; only webfonts load from Google and fall back cleanly to system serif/sans).

## Pages

| Page | What it answers |
|---|---|
| Citywide overview | Where the city stands in 2026 and how far it has moved from a baseline you pick (2023, 2024 or 2025). Level distribution by year and by grade. |
| District explorer | All 32 districts on any grade band and any student group. Scatter of Δ Level 1 against Δ proficiency with the "improved on both" quadrant shaded, ranked bars, sortable table, CSV. |
| Boroughs | Borough trends and distributions; every district as a bar coloured by borough; borough × grade matrix. |
| NYC Reads phases | Elementary Phase 1 vs Phase 2 on tested grades 3–5, the middle-school wave on grades 6–8, group-contrast table, and a placebo check. |
| Subgroups & gaps | Every reported student group at city / borough / district level, plus five paired proficiency gaps over time. |
| Test format | The paper-to-computer transition, grouped by the year each grade moved. |
| Data & method | Sources, definitions, the checks that were run, and the limits that follow. |

Every chart has a **PNG** button; every page has a **Download CSV** button that exports
exactly the view on screen (so results can be dropped straight into a deck).

**Phase markers.** Time-series charts carry dashed rules at the first year each NYC Reads
wave could appear in results. A spring test sits at the end of that school year, so a wave
launched in SY 2023–24 first shows up in the 2024 results — the marker goes on 2024, not
2023. Years before any wave reached a tested grade are tinted and labelled "before NYC
Reads". Each chart shows only the waves that reach the grades it plots: the grades 3–5
charts carry the elementary waves, the grades 6–8 charts carry the middle-school wave. The
test-format page marks the paper-to-computer transitions instead. A **Phase markers**
checkbox on each page turns them off for a clean export.

## How the numbers are produced

- The source files publish both counts and percentages. This tool loads the **counts**
  and derives every percentage as `count / tested`. Nothing is copied from a published
  percentage column, so no figure is a rounded value of a rounded value.
- Grade bands and district groups are aggregated by **summing student counts**, then
  dividing — every aggregate is weighted by students tested. District percentages are
  never averaged.
- Changes are simple differences in percentage points, and are never taken across the
  2023 standards change.

## Rebuilding

```bash
python3 scripts/extract.py   # .xlsx -> data/payload.json, asserts every invariant
python3 scripts/build.py     # template + app.js + payload + Chart.js -> single HTML
```

`extract.py` refuses to emit a row that violates its invariants, so a bad build fails
loudly rather than shipping wrong numbers.

## Verification

Two independent audits, both run against the **shipped file** with the browser driving
the real UI. Each re-reads the original `.xlsx` files from scratch rather than reusing
any intermediate artefact.

```bash
python3 scripts/audit_engine.py   # 40,698 combinations
python3 scripts/audit_render.py   # 8,324 rendered values
```

| Audit | Coverage | Result |
|---|---|---|
| `audit_raw.py` | Internal consistency of all 30,728 source rows | counts sum to tested; `%` = count/tested; `L3+4 = L3+L4`; max deviation 5.7e-6 pp |
| `audit_engine.py` | Every level × geography × grade band × year × student group = **40,698** combinations pulled out of the live page | **0 mismatches.** Max deviation 5e-7 pp on percentages, 9.8e-7 on mean scale score. Also cross-checks all 28,523 cells against the files' own published `%` columns (agreement to 4.3e-6 pp, the source's float precision). |
| `audit_render.py` | **8,324** values actually rendered — KPI cards, chart datapoints, table cells, signs and directions of every change — across 114 filter states | **0 mismatches** |

Claims in the team's working doc were reproduced exactly: citywide Level 1 26.1% → 24.3%
(2024→2026); 27 of 32 districts down on Level 1; largest falls in Districts 23, 7, 16
and 5; and 23, 16, 5 confirmed as Elementary Phase 1.

## Things the data will not support

- **2023 is a wall.** NYSED re-aligned the test in 2023 and rescaled the mean scale score
  (601.6 in 2022 → 449.6 in 2023). 2022 appears once, as an isolated reference point.
- **The three files do not reconcile.** In 2026 the districts total 299,906 tested, the
  boroughs 301,227 and the citywide file 304,450 — D75 and out-of-district placements are
  attributed differently, and the rule changed in 2025. Each level is read only from its
  own file.
- **2025 is off-trend** everywhere, up sharply then partly reversing in 2026. That is why
  the baseline is a control rather than a fixed choice.
- **Suppression is not only about small groups.** Where one category is too small to
  publish, NYSED also withholds the next smallest so it cannot be recovered by
  subtraction. This removes some very large cells — citywide Female, all grades, 2025 is
  suppressed across 149,821 tested students. Affected views carry an explicit warning and
  lines break rather than bridging the gap.
- **No causal claims.** Phase groups were not randomly assigned and did not start level.
  On elementary grades 3–5 the Phase 1 and Phase 2 waves move almost identically
  (−2.0pp vs −2.4pp from 2023), and the placebo contrast on grades 6–8 is about the same
  size — so the elementary contrast is not distinguishable from a general difference
  between those sets of districts. That is reported as found.

## Not included

Professional-learning provider and curriculum by district were requested but no source
file was available, so no such field appears anywhere. Mathematics, Science, charter
schools and the school-level file are out of scope.

## Layout

```
NYC_Reads_ELA_Dashboard.html   the deliverable
src/template.html              markup + CSS (CPRL palette, Crimson Text / Hind)
src/app.js                     aggregation engine + all seven pages
scripts/extract.py             .xlsx -> payload.json, with invariant assertions
scripts/build.py               assembles the single file
scripts/audit_*.py             the audits above
data/                          source .xlsx, payload.json, CPRL logo
audit/                         captured dumps from the live page
```
