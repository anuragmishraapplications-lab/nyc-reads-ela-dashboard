# QC record

Build of 13 August 2026. Every check below was run against the shipped file, with the
browser driving the real interface. The numeric checks re-read the original NYCPS
`.xlsx` files from scratch rather than reusing any intermediate artefact.

## Numbers

| # | Check | Coverage | Result |
|---|---|---|---|
| 1 | Source file integrity | all 30,728 rows in the three NYCPS files | **Pass.** Level counts sum to Number Tested exactly; published `%` equals count/tested to 5.7e-6 pp; `% Level 3+4` equals Level 3 plus Level 4 |
| 2 | Aggregation engine | **40,698** combinations: every level x geography x grade band x year x student group | **Pass.** SHA-256 over aggregated student counts is identical to an independent recomputation from the source files |
| 3 | Rendered values | **9,560** values across 130 filter states: KPI cards, chart datapoints, table cells, and the sign and direction of every change | **Pass.** 0 mismatches |
| 4 | Charts, tables and exports | **4,062** values: diverging grade chart, 2022 reference chart, district scatter and ranked bars, cohort panel, borough matrix, phase contrast table, gap chart, provider slope chart, per-grade format table, and all seven CSV exports in full | **Pass.** 0 mismatches |

Cross-check: all 28,523 unsuppressed cells were also compared against the source files'
own published percentage columns, which the dashboard never reads. Agreement to
4.3e-6 pp, which is the float precision of the source.

## Structure and behaviour

| Check | Result |
|---|---|
| All 7 pages render, every chart instantiates, no empty tables | Pass |
| No unreplaced build tokens, no TODO or FIXME in output | Pass |
| No personal email addresses in the file | Pass, 0 found |
| No superintendent or deputy names in the file | Pass |
| PNG export produces image data | Pass |
| CSV export produces rows on every page | Pass |
| No external script tags, all images inlined | Pass, file is self-contained |
| Filters narrow correctly (borough spot-check) | Pass, 32 to 7 for Queens, matches independent count |
| Suppressed cells render as `s`, never as 0 | Pass |

## Reproduced against the team's working document

- Citywide Level 1, 2024 to 2026: 26.1% to 24.3%
- 27 of 32 districts reduced their Level 1 share
- Largest falls: Districts 23, 7, 16 and 5
- Districts 23, 16 and 5 confirmed as Elementary Phase 1

## Known limits, carried in the tool itself

1. **2023 is a break, not a step.** NYSED re-aligned the test and rescaled the mean scale
   score (601.6 in 2022 to 449.6 in 2023). 2022 appears once as a reference point and is
   never differenced against later years.
2. **The three NYCPS files do not reconcile.** For 2026 the districts total 299,906
   tested, the boroughs 301,227 and the citywide file 304,450. District 75 and
   out-of-district placements are attributed differently and the rule changed in 2025.
   Each level is read only from its own file.
3. **2025 is off-trend everywhere.** A change measured from 2025 reads very differently
   from the same change measured from 2023 or 2024, which is why the baseline is a user
   control and every figure states which baseline it used.
4. **Suppression is not only about small groups.** Where one category is too small to
   publish, NYSED withholds the next smallest so it cannot be recovered by subtraction.
   This removes some very large cells, including citywide Female for all grades in 2025,
   covering 149,821 tested students. Affected views carry a warning and lines break
   rather than bridging the gap.
5. **Cohort size moves a lot.** Tested counts range from -15.4% to +10.0% across
   districts between 2024 and 2026, and the change correlates with the measured
   proficiency gain at r = -0.48. This is surfaced on the district page rather than left
   to be discovered.
6. **No causal claims.** Phase, provider and curriculum groups were not randomly
   assigned, did not start level, and vary in size from 1 to 11 districts.

## Open items before wider circulation

1. **NYCPS approval for the district-level curriculum and provider assignments.** These
   are currently visible on the public URL. Setting `VENDOR_APPROVED = false` is already
   in place and drives the pending note under Sources; a single flag in `src/app.js`
   removes the page entirely if that is preferred while approval is outstanding.
2. **Source wording** for the three sources, pending Julie's confirmation.
3. **Phase column discrepancy.** The supplied SY2025-26 chart disagrees with the NYC
   Reads launch timeline for seven districts (10, 13, 14, 24, 28, 29, 30). The tool keeps
   the launch timeline, which the 2026-27 workbook corroborates for all 32 districts. The
   disagreement is displayed on the providers page.
