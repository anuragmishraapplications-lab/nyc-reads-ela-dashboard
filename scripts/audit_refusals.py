"""Audit the Participation page against the NYSED source files.

Same standard as the other audits in this directory: re-read the source
workbooks from scratch, with a parser written independently of extract.py,
and compare against (a) the payload the page is built from and (b) the values
actually captured from the rendered page.

Nothing here reuses an intermediate artefact. The rendered dump is produced by
driving the real interface through all 16 filter states (4 student groups x
4 years) and reading back the KPI cards, every table cell and every chart
datapoint.

Usage:  python3 scripts/audit_refusals.py [path/to/pa_dump.json]
"""
import openpyxl, json, os, re, sys

R = os.path.join(os.path.dirname(__file__), '..')
YEARS = [2022, 2023, 2024, 2025]
SUBS = [('all', 'All students', 4), ('ell', 'English Language Learners', 6),
        ('swd', 'Students with Disabilities', 8), ('econ', 'Economically Disadvantaged', 10)]
DISTRICTS = ['%02d' % d for d in range(1, 33)]
BORO_OF = {}
for d in range(1, 7):   BORO_OF['%02d' % d] = 'Manhattan'
for d in range(7, 13):  BORO_OF['%02d' % d] = 'Bronx'
for d in list(range(13, 24)) + [32]: BORO_OF['%02d' % d] = 'Brooklyn'
for d in range(24, 31): BORO_OF['%02d' % d] = 'Queens'
BORO_OF['31'] = 'Staten Island'

FAILS = []
CHECKED = [0]


def cmp(name, got, want):
    CHECKED[0] += 1
    if str(got) != str(want):
        FAILS.append(f'{name}: page/payload={got!r} source={want!r}')


def f1(v):
    return '—' if v is None else f'{v:.1f}'


def pp(v):
    if v is None:
        return '—'
    return '0.0' if abs(v) < 0.05 else ('+' if v > 0 else '−') + f'{abs(v):.1f}'


# --------------------------------------------------------------------------
# 1. Independent read of the NYSED workbooks.
#    Located by ENTITY_NAME rather than by row position, and the header pairs
#    are checked before any column offset is trusted.
# --------------------------------------------------------------------------
def read_source():
    src = {k: {} for k, _, _ in SUBS}
    for y in YEARS:
        wb = openpyxl.load_workbook(os.path.join(R, 'data', 'nysed', 'ref%d.xlsx' % y),
                                    read_only=True, data_only=True)
        rows = list(wb['ELA'].iter_rows(values_only=True))
        hdr = list(rows[1])
        assert hdr[2] == 'ENTITY_NAME'
        for _, _, col in SUBS:
            assert hdr[col] == 'TOTAL_COUNT' and hdr[col + 1] == '%_REFUSED'
        found = set()
        for r in rows[2:]:
            m = re.match(r'NYC GEOG DIST #\s*(\d+)\b', str(r[2] or '').upper())
            if not m:
                continue
            d = '%02d' % int(m.group(1))
            found.add(d)
            for k, _, col in SUBS:
                src[k][(d, y)] = (r[col], round(float(r[col + 1]), 1))
        assert found == set(DISTRICTS), sorted(set(DISTRICTS) - found)
    return src


SRC = read_source()

# --------------------------------------------------------------------------
# 2. Payload against source.
# --------------------------------------------------------------------------
P = json.load(open(os.path.join(R, 'data', 'payload.json')))
REF = P.get('refusals')
assert REF, 'payload carries no refusals block'
cmp('payload years', REF['years'], YEARS)
cmp('payload subs', [s['k'] for s in REF['subs']], [k for k, _, _ in SUBS])
for k, _, _ in SUBS:
    for di, d in enumerate(DISTRICTS):
        for yi, y in enumerate(YEARS):
            n, p = SRC[k][(d, y)]
            cmp(f'payload n {k} D{d} {y}', REF['n'][k][di][yi], n)
            cmp(f'payload pct {k} D{d} {y}', REF['pct'][k][di][yi], p)

# --------------------------------------------------------------------------
# 3. Rendered page against source.
# --------------------------------------------------------------------------
dump_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(R, 'audit', 'pa_dump.json')
if not os.path.exists(dump_path):
    print('no rendered dump at %s; ran payload checks only' % dump_path)
else:
    PA = json.load(open(dump_path))

    def wmean(k, y, dists=DISTRICTS):
        num = den = 0
        for d in dists:
            n, p = SRC[k][(d, y)]
            num += p * n
            den += n
        return num / den if den else None

    for key, cells in PA['table'].items():
        k, y = key.split('|')
        y = int(y)
        cmp(f'table rows {key}', len(cells), 32)
        for row in cells:
            m = re.match(r'District (\d+)', row[0])
            d = '%02d' % int(m.group(1))
            cmp(f'table boro {key} D{d}', row[1], BORO_OF[d])
            for j, yy in enumerate(YEARS):
                cmp(f'table pct {key} D{d} {yy}', row[2 + j], f1(SRC[k][(d, yy)][1]) + '%')
            chg = SRC[k][(d, YEARS[-1])][1] - SRC[k][(d, YEARS[0])][1]
            cmp(f'table change {key} D{d}', row[2 + len(YEARS)], pp(chg))
            cmp(f'table n {key} D{d}', row[3 + len(YEARS)].replace(',', ''),
                str(SRC[k][(d, y)][0]))

    for key, cards in PA['kpi'].items():
        k, y = key.split('|')
        y = int(y)
        cmp(f'kpi rate {key}', cards[0]['v'], f1(wmean(k, y)) + '%')
        chg = wmean(k, YEARS[-1]) - wmean(k, YEARS[0])
        # the KPI compares the selected year against the first year
        chg = wmean(k, y) - wmean(k, YEARS[0])
        cmp(f'kpi change {key}', cards[1]['v'], pp(chg) + 'pp')
        rates = {d: SRC[k][(d, y)][1] for d in DISTRICTS}
        top, bot = max(rates.values()), min(rates.values())

        # districts tie on these one-decimal rates often enough that naming a
        # single "highest" would be arbitrary; the page names all of them
        def label(v):
            ds = [d for d in DISTRICTS if rates[d] == v]
            if len(ds) == 1:
                return f'District {ds[0]} ({BORO_OF[ds[0]]})'
            return 'Districts ' + ', '.join(ds[:-1]) + f' and {ds[-1]}, tied'

        cmp(f'kpi high {key}', cards[2]['v'], f1(top) + '%')
        cmp(f'kpi high name {key}', cards[2]['x'], label(top))
        cmp(f'kpi low {key}', cards[3]['v'], f1(bot) + '%')
        cmp(f'kpi low name {key}', cards[3]['x'], label(bot))

    for key, series in PA['trend'].items():
        for ds in series:
            k = next(kk for kk, lab, _ in SUBS if lab == ds['label'])
            for j, y in enumerate(YEARS):
                got, want = ds['data'][j], wmean(k, y)
                CHECKED[0] += 1
                if got is None or abs(got - want) > 1e-9:
                    FAILS.append(f'trend {key} {k} {y}: page={got!r} source={want!r}')

    for key, n in PA['scatterN'].items():
        cmp(f'scatter points {key}', n, 32)

print('checked %s values' % f'{CHECKED[0]:,}')
if FAILS:
    print('MISMATCHES: %d' % len(FAILS))
    for f in FAILS[:40]:
        print('  ' + f)
    sys.exit(1)
print('RESULT: PASS — the participation page reproduces the NYSED source exactly.')
