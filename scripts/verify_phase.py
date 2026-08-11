import json
P=json.load(open('data/payload.json'))
Y=P['years']; G=P['grades']; C=P['cats']; DS=P['districts']
yi={y:i for i,y in enumerate(Y)}; gi={g:i for i,g in enumerate(G)}; ci={c:i for i,c in enumerate(C)}
ALL=ci['All Students']
dist={}
for r in P['dist']: dist[(r[0],r[1],r[2],r[3])]=r

def agg(dnums, grades, year, cat=ALL):
    n=c1=c2=c3=c4=0
    for d in dnums:
        i=DS.index('%02d'%d)
        for g in grades:
            r=dist.get((i,gi[str(g)],yi[year],cat))
            if r is None: continue
            n+=r[4]; c1+=r[6]; c2+=r[7]; c3+=r[8]; c4+=r[9]
    return n,c1,c2,c3,c4

e1=P['phase']['elem1']; e2=P['phase']['elem2']
ms1=P['phase']['ms1']; msN=[d for d in range(1,33) if d not in ms1]

def show(label, dnums, grades):
    print(f"\n{label}  (n districts={len(dnums)}, grades {grades})")
    print(f"{'yr':>6}{'N':>9}{'%L1':>8}{'%L3+4':>8}{'dL1v23':>9}{'dPRv23':>9}")
    base=None
    for y in [2023,2024,2025,2026]:
        n,c1,c2,c3,c4=agg(dnums,grades,y)
        l1=c1/n*100; pr=(c3+c4)/n*100
        if base is None: base=(l1,pr)
        print(f"{y:>6}{n:>9}{l1:>8.2f}{pr:>8.2f}{l1-base[0]:>+9.2f}{pr-base[1]:>+9.2f}")

print("="*62)
print("ELEMENTARY GRADES 3-5  (K-5 curriculum -> tested grades 3,4,5)")
show("Phase 1 Elementary (SY23-24 launch)", e1, [3,4,5])
show("Phase 2 Elementary (SY24-25 launch)", e2, [3,4,5])
print("="*62)
print("MIDDLE GRADES 6-8  (MS Phase 1 launched SY25-26 -> first shows in 2026)")
show("Phase 1 Middle School (8 districts)", ms1, [6,7,8])
show("Not yet MS-treated (24 districts)", msN, [6,7,8])
print("="*62)
print("PLACEBO CHECK: grades 6-8 for elem phase groups (should show no elem dose effect)")
show("Phase 1 Elem districts, grades 6-8", e1, [6,7,8])
show("Phase 2 Elem districts, grades 6-8", e2, [6,7,8])
