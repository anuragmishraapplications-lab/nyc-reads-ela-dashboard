import json
P=json.load(open('data/payload.json'))
Y=P['years']; G=P['grades']; C=P['cats']
yi={y:i for i,y in enumerate(Y)}; gi={g:i for i,g in enumerate(G)}; ci={c:i for i,c in enumerate(C)}
city={}
for r in P['city']: city[(r[1],r[2],r[3])]=r
def agg(grades,year,cat=ci['All Students']):
    n=c1=c3=c4=0
    for g in grades:
        r=city.get((gi[str(g)],yi[year],cat))
        if not r: return None
        n+=r[4]; c1+=r[6]; c3+=r[8]; c4+=r[9]
    return n, c1/n*100, (c3+c4)/n*100

print("TEST MODE GROUPS (from NOTES: CBT for gr5&8 from 2024; gr4&6 added 2025)")
groups={'CBT from 2024 (gr 5,8)':[5,8],'CBT from 2025 (gr 4,6)':[4,6],'Paper throughout (gr 3,7)':[3,7]}
print(f"{'group':<26}"+''.join(f"{y:>16}" for y in [2023,2024,2025,2026]))
for lab,gs in groups.items():
    row=f"{lab:<26}"
    for y in [2023,2024,2025,2026]:
        n,l1,pr=agg(gs,y); row+=f"  L1{l1:>5.1f} P{pr:>5.1f}"
    print(row)
print("\nChange vs 2023 (pp):")
for lab,gs in groups.items():
    b=agg(gs,2023)
    row=f"{lab:<26}"
    for y in [2024,2025,2026]:
        n,l1,pr=agg(gs,y); row+=f"  dL1{l1-b[1]:>+5.1f} dP{pr-b[2]:>+5.1f}"
    print(row)

print("\n\nCITYWIDE SUBGROUP GAPS, All Grades (%L3+4)")
def sub(cat,year):
    r=city.get((gi['All Grades'],yi[year],ci[cat]))
    return None if not r else ((r[8]+r[9])/r[4]*100, r[6]/r[4]*100, r[4])
pairs=[('White','Black'),('White','Hispanic'),('Not Econ Disadv','Econ Disadv'),
       ('Not SWD','SWD'),('Never ELL','Current ELL')]
print(f"{'gap':<32}"+''.join(f"{y:>9}" for y in [2023,2024,2025,2026])+f"{'d 23-26':>9}")
for a,b in pairs:
    vals=[]
    for y in [2023,2024,2025,2026]:
        pa=sub(a,y)[0]; pb=sub(b,y)[0]; vals.append(pa-pb)
    print(f"{a+' - '+b:<32}"+''.join(f"{v:>9.2f}" for v in vals)+f"{vals[-1]-vals[0]:>+9.2f}")
