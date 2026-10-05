#!/usr/bin/env python3
"""Read-only acceptance receipt checker; writes only its own validation receipt."""
import json,hashlib,sys,copy
from pathlib import Path
from html.parser import HTMLParser
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
class DOM(HTMLParser):
 def __init__(self,text):
  super().__init__();self.nodes=[];self.stack=[];self.feed(text)
 def handle_starttag(self,tag,attrs):
  n={'tag':tag,'attrs':dict(attrs),'text':''};self.nodes.append(n)
  if tag not in ['input','meta','link','br','hr','img']:self.stack.append(n)
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,-1,-1):
   if self.stack[i]['tag']==tag:self.stack=self.stack[:i];break
 def handle_data(self,data):
  for n in self.stack:n['text']+=data

def descriptions(nodes):
 inert=[n for n in nodes if n['attrs'].get('aria-disabled')=='true' and n['tag'] in ['button','textarea','input','select']]
 assert inert,'no inert controls: vacuous probe'
 for n in inert:
  a=n['attrs'];assert 'disabled' not in a,a.get('id')
  ids=a.get('aria-describedby','').split();assert ids,a.get('id')
  for ident in ids:
   matches=[x for x in nodes if x['attrs'].get('id')==ident]
   assert len(matches)==1 and matches[0]['text'].strip(),ident
 return len(inert)

def geometry(s):
 r=s.get('rect',{});return bool(r.get('width',0)>0 and r.get('height',0)>0 and s.get('inViewport') is True and s.get('clipped') is False and s.get('occluded') is False and (s.get('visible') is True or s.get('focusVisible') is True) and s.get('outline') not in [None,'none'] and float(str(s.get('width','0')).replace('px',''))>0)

def binding(receipt):
 assert receipt.get('sourceHashes'),'missing source inventory'
 for name,expected in receipt['sourceHashes'].items():
  path=(ROOT/name).resolve()
  assert path.is_relative_to(ROOT),name
  assert digest(path)==expected,'source drift: '+name
 for name in ['desktop','inspector']:
  assert digest(HERE/(name+'-source.html'))==receipt['htmlHashes'][name],'HTML drift: '+name
 assert receipt['response']['status']==403,'expected actual HTTP refusal'
 assert json.loads(receipt['response']['body'])['ok'] is False
 assert 'document-outside-project-root' in receipt['response']['body']

receipt=json.loads((HERE/'source-receipt.json').read_text())
binding(receipt)
for label,mutate in [('sourceFingerprint',lambda r:r['sourceHashes'].update({next(iter(r['sourceHashes'])):'0'*64})),('htmlFingerprint',lambda r:r['htmlHashes'].update({'desktop':'0'*64})),('refusalStatus',lambda r:r['response'].update({'status':200}))]:
 mutant=copy.deepcopy(receipt);mutate(mutant)
 try:binding(mutant)
 except AssertionError:pass
 else:raise AssertionError(label+' negative control escaped')
html=HERE/'desktop-source.html';nodes=DOM(html.read_text()).nodes
count=descriptions(nodes)
mutant=copy.deepcopy(nodes)
next(n for n in mutant if n['attrs'].get('aria-disabled')=='true' and n['tag']=='button')['attrs']['aria-describedby']='keyboard-ux-nonexistent'
try:descriptions(mutant)
except AssertionError:negative=True
else:raise AssertionError('description negative control escaped')
base=ROOT/'apps/desktop-shell/test/visual-postpr-evidence/retry'
records=[];first=None
for filename in ['repair-pass2.json','repair-pass1-inspector.json']:
 p=base/filename;rows=json.loads(p.read_text());samples=[(r,s) for r in rows for s in r.get('focusSamples',r.get('focus',[]))]
 bad=[{'scenario':r['scenario'],'id':s.get('id'),'direction':s.get('direction'),'clipped':s.get('clipped'),'occluded':s.get('occluded')} for r,s in samples if not geometry(s)]
 first=first or next((s for r,s in samples if geometry(s)),None)
 keys={(r['scenario'],r.get('scheme',''),s.get('id') or s.get('key')) for r,s in samples}
 records.append({'path':str(p.relative_to(ROOT)),'sha256':digest(p),'scenarios':len(rows),'samples':len(samples),'uniqueScenarioControls':len(keys),'invalidSamples':bad,'artifactBinding':'historical receipt; current source equivalence NOT established'})
assert first is not None
mutant=copy.deepcopy(first);mutant['rect']['width']=0
assert not geometry(mutant),'zero-geometry negative control escaped'
mutant=copy.deepcopy(first);mutant['occluded']=True
assert not geometry(mutant),'occlusion negative control escaped'
criteria=['artifact identity','inert sequential keyboard reachability','description target resolution','inert Enter/Space no action','real refusal diagnostic with nonzero geometry','dismissal and restored usable focus','forward/reverse modal containment','visible focus outline','minimum-window ancestor clipping','minimum-window five-point occlusion']
result={'taskid':'keyboard-ux','status':'PARTIAL_NOT_ACCEPTED','sourceHtmlSha256':digest(html),'currentSourceStaticInertControls':count,'uniqueAcceptanceCriteria':criteria,'criteriaCount':len(criteria),'historicalCountCorrection':'1795 = 581 repeated samples * 3 checks + 52 state predicates; not unique requirements. Original unique requirement count cannot be reconstructed from aggregate. This extension defines 10 unique predicates, not 10 passing claims.','receipts':records,'negativeControls':{'missingDescriptionTarget':'REJECTED','zeroGeometry':'REJECTED','occlusion':'REJECTED'},'browserChecks':'NOT RUN; source DOM cannot prove tab order, focus, geometry or modal behavior'}
result['artifactBinding']={'status':'MATCH','sourceFiles':len(receipt['sourceHashes']),'receiptSha256':digest(HERE/'source-receipt.json'),'htmlHashes':receipt['htmlHashes'],'responseStatus':receipt['response']['status']}
result['negativeControls'].update({'sourceFingerprint':'REJECTED','htmlFingerprint':'REJECTED','refusalStatus':'REJECTED'})
(HERE/'validation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':result['status'],'staticInertControls':count,'receipts':[(r['samples'],len(r['invalidSamples'])) for r in records],'negativeControls':result['negativeControls']}))
if '--require-acceptance' in sys.argv:sys.exit(1)
