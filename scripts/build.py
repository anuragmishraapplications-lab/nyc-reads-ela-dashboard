import json, os, datetime, re
R = os.path.join(os.path.dirname(__file__), '..')
tpl   = open(os.path.join(R,'src/template.html')).read()
app   = open(os.path.join(R,'src/app.js')).read()
chart = open(os.path.join(R,'vendor/chart.umd.min.js')).read()
logo_nycreads = open(os.path.join(R,'data/nycreads_logo_b64.txt')).read().strip()
logo_cprl     = open(os.path.join(R,'data/cprl_formal_b64.txt')).read().strip()
payload = open(os.path.join(R,'data/payload.json')).read()
build = datetime.date(2026,8,11).strftime('%-d %B %Y')

# guard: none of the tokens may appear inside injected content
for name, blob in [('payload',payload)]:
    assert '__PAYLOAD__' not in blob and '</script' not in blob.lower(), name

out = tpl
out = out.replace('__LOGO_NYCREADS__', logo_nycreads)
out = out.replace('__LOGO_CPRL__', logo_cprl)
out = out.replace('__CHARTJS__', chart)
out = out.replace('__PAYLOAD__', payload)
out = out.replace('__APP__', app)
out = out.replace('__BUILD__', build)
for tok in ('PAYLOAD','APP','LOGO_NYCREADS','LOGO_CPRL','BUILD','CHARTJS'):
    assert '__' + tok + '__' not in out, 'unreplaced token: ' + tok
p = os.path.join(R,'NYC_Reads_ELA_Dashboard.html')
open(p,'w').write(out)
print('wrote', p, f'{os.path.getsize(p)/1e6:.2f} MB')
