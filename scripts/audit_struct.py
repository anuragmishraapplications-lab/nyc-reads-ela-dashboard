import openpyxl
from collections import defaultdict
def load(level, sheet='ELA - All'):
    wb=openpyxl.load_workbook('data/%s-ela-results-public.xlsx'%level, read_only=True, data_only=True)
    ws=wb[sheet]; rows=list(ws.iter_rows(values_only=True)); hdr=list(rows[0])
    return hdr,[dict(zip(hdr,r)) for r in rows[1:]]

hc,city=load('citywide'); hb,boro=load('borough'); hd,dist=load('district')
print('districts:',sorted(set(r['District'] for r in dist)))
print('boroughs:',sorted(set(r['Borough'] for r in boro)))
print('years city:',sorted(set(r['Year'] for r in city)))
print('years boro:',sorted(set(r['Year'] for r in boro)))
print('years dist:',sorted(set(r['Year'] for r in dist)))
print('grades dist:',sorted(set(str(r['Grade']) for r in dist)))
# completeness: every district x year x grade present?
exp=set()
for d in sorted(set(r['District'] for r in dist)):
    for y in sorted(set(r['Year'] for r in dist)):
        for g in [3,4,5,6,7,8,'All Grades']:
            exp.add((d,y,g))
have=set((r['District'],r['Year'],r['Grade']) for r in dist)
print('district missing cells:',len(exp-have), sorted(exp-have)[:20])

def key(r,g=None): return None
# All Grades == sum of 3..8 ?
def check_allgrades(rows, idcols, label):
    idx=defaultdict(dict)
    for r in rows:
        k=tuple(r[c] for c in idcols)+(r['Year'],r['Category'])
        idx[k][r['Grade']]=r
    bad=0; worst=0
    for k,g in idx.items():
        if 'All Grades' not in g: continue
        ag=g['All Grades']
        if ag['Number Tested']=='s': continue
        parts=[g[x] for x in [3,4,5,6,7,8] if x in g]
        if any(p['Number Tested']=='s' for p in parts): continue
        s=sum(p['Number Tested'] for p in parts)
        if s!=ag['Number Tested']:
            bad+=1; worst=max(worst,abs(s-ag['Number Tested']))
    print(label,'AllGrades!=sum(3-8):',bad,'of',len(idx),'worst diff',worst)
check_allgrades(city,[],'citywide')
check_allgrades(boro,['Borough'],'borough')
check_allgrades(dist,['District'],'district')

# borough sum vs city
cm={(r['Grade'],r['Year']):r for r in city}
bs=defaultdict(int)
for r in boro: bs[(r['Grade'],r['Year'])]+=r['Number Tested']
print('\nGrade Year  City   BoroSum  Diff')
for k in sorted(cm, key=lambda x:(str(x[0]),x[1])):
    if k[0]!='All Grades': continue
    print(k, cm[k]['Number Tested'], bs[k], cm[k]['Number Tested']-bs[k])
# district sum vs borough
ds=defaultdict(int)
for r in dist: ds[(r['Grade'],r['Year'])]+=r['Number Tested']
print('\nAllGrades: BoroSum vs DistSum')
for y in sorted(set(r['Year'] for r in dist)):
    print(y, bs[('All Grades',y)], ds[('All Grades',y)], bs[('All Grades',y)]-ds[('All Grades',y)])
