import json, os, datetime, re
R = os.path.join(os.path.dirname(__file__), '..')
tpl   = open(os.path.join(R,'src/template.html')).read()
app   = open(os.path.join(R,'src/app.js')).read()
chart = open(os.path.join(R,'vendor/chart.umd.min.js')).read()
logo  = open(os.path.join(R,'data/cprl_logo_b64.txt')).read().strip()
payload = open(os.path.join(R,'data/payload.json')).read()
build = datetime.date(2026,8,11).strftime('%-d %B %Y')

# guard: none of the tokens may appear inside injected content
for name, blob in [('payload',payload)]:
    assert '__PAYLOAD__' not in blob and '</script' not in blob.lower(), name

out = tpl
out = out.replace('__LOGO__', logo)
out = out.replace('__CHARTJS__', chart)
out = out.replace('__PAYLOAD__', payload)
out = out.replace('__APP__', app)
out = out.replace('__BUILD__', build)
assert '__' + 'PAYLOAD__' not in out and '__' + 'APP__' not in out and '__' + 'LOGO__' not in out
p = os.path.join(R,'NYC_Reads_ELA_Dashboard.html')
open(p,'w').write(out)
print('wrote', p, f'{os.path.getsize(p)/1e6:.2f} MB')
