import json, os
P=json.load(open('data/payload.json'))
Y=P['years']; G=P['grades']; C=P['cats']; DS=P['districts']
def idx(rows): 
    d={}
    for r in rows: d[(r[0],r[1],r[2],r[3])]=r
    return d
city=idx(P['city']); dist=idx(P['dist']); boro=idx(P['boro'])
yi={y:i for i,y in enumerate(Y)}; gi={g:i for i,g in enumerate(G)}; ci={c:i for i,c in enumerate(C)}
AG=gi['All Grades']; ALL=ci['All Students']
def pct(r,k): 
    n=r[4]; return None if not n else (r[6+k])/n*100   # k=0..3 -> L1..L4
def prof(r):
    n=r[4]; return None if not n else (r[8]+r[9])/n*100

print('== Citywide All Grades, All Students')
print(f"{'yr':>5}{'N':>9}{'%L1':>8}{'%L2':>8}{'%L3':>8}{'%L4':>8}{'%L3+4':>8}{'mean':>8}")
for y in Y:
    r=city[(0,AG,yi[y],ALL)]
    print(f"{y:>5}{r[4]:>9}{pct(r,0):>8.2f}{pct(r,1):>8.2f}{pct(r,2):>8.2f}{pct(r,3):>8.2f}{prof(r):>8.2f}{r[5]:>8.1f}")

print('\n== CLAIM: 26.1% -> 24.3% L1 (2024->2026)')
a=pct(city[(0,AG,yi[2024],ALL)],0); b=pct(city[(0,AG,yi[2026],ALL)],0)
print(f"  2024={a:.4f}  2026={b:.4f}  delta={b-a:+.4f}  -> {'MATCH' if round(a,1)==26.1 and round(b,1)==24.3 else 'MISMATCH'}")

print('\n== CLAIM: 27 of 32 districts declined in %L1, 2024->2026')
rows=[]
for i,d in enumerate(DS):
    r24=dist[(i,AG,yi[2024],ALL)]; r26=dist[(i,AG,yi[2026],ALL)]
    dl1=pct(r26,0)-pct(r24,0); dpr=prof(r26)-prof(r24)
    rows.append((d,dl1,dpr))
dec=[r for r in rows if r[1]<0]
print(f"  districts with L1 decline: {len(dec)} of {len(rows)}")
print('  4 largest L1 declines:')
for d,dl1,dpr in sorted(rows,key=lambda x:x[1])[:6]:
    print(f"    D{d}  dL1={dl1:+.2f}  dProf={dpr:+.2f}")
print('\n== CLAIM: districts 23,16,5 are Phase 1 elementary')
p1=set(P['phase']['elem1'])
for d in [23,16,5,7]:
    print(f"  D{d:02d}: elem1={d in p1}  elem2={d in set(P['phase']['elem2'])}  ms1={d in set(P['phase']['ms1'])}")

print('\n== "Green-green" districts (L1 down AND proficiency up), 2024->2026')
gg=[r for r in rows if r[1]<0 and r[2]>0]
print(f"  count={len(gg)}: "+', '.join('D%s'%r[0] for r in sorted(gg)))
print('\n== Same, baseline 2023')
rows23=[]
for i,d in enumerate(DS):
    r0=dist[(i,AG,yi[2023],ALL)]; r26=dist[(i,AG,yi[2026],ALL)]
    rows23.append((d,pct(r26,0)-pct(r0,0),prof(r26)-prof(r0)))
gg23=[r for r in rows23 if r[1]<0 and r[2]>0]
print(f"  L1 declines: {sum(1 for r in rows23 if r[1]<0)}/32 ; green-green={len(gg23)}: "+', '.join('D%s'%r[0] for r in sorted(gg23)))
