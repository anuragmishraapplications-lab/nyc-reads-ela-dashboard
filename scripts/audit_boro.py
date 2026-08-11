import openpyxl
from collections import defaultdict
def load(level, sheet='ELA - All'):
    wb=openpyxl.load_workbook('data/%s-ela-results-public.xlsx'%level, read_only=True, data_only=True)
    ws=wb[sheet]; rows=list(ws.iter_rows(values_only=True)); hdr=list(rows[0])
    return [dict(zip(hdr,r)) for r in rows[1:]]
boro=load('borough'); dist=load('district')
M={}
for d in range(1,7): M['%02d'%d]='MANHATTAN'
for d in range(7,13): M['%02d'%d]='BRONX'
for d in list(range(13,24))+[32]: M['%02d'%d]='BROOKLYN'
for d in range(24,31): M['%02d'%d]='QUEENS'
M['31']='STATEN ISLAND'
ds=defaultdict(int)
for r in dist:
    if r['Grade']!='All Grades': continue
    ds[(M[r['District']],r['Year'])]+=r['Number Tested']
print(f"{'Borough':<15}{'Year':>6}{'BoroFile':>10}{'DistSum':>10}{'Diff':>8}")
for r in sorted(boro,key=lambda x:(x['Borough'],x['Year'])):
    if r['Grade']!='All Grades': continue
    k=(r['Borough'],r['Year'])
    print(f"{r['Borough']:<15}{r['Year']:>6}{r['Number Tested']:>10}{ds[k]:>10}{r['Number Tested']-ds[k]:>8}")
