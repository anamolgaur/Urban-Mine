import numpy as np, json, collections, sys
from sklearn.linear_model import LogisticRegression
from tokenizers import Tokenizer
import onnxruntime as ort
z=np.load('/tmp/bench/all.npz'); meta=z['meta']; src,grp,lab=meta[:,0],meta[:,1],meta[:,2].copy()
n=lambda x:x/np.linalg.norm(x,axis=-1,keepdims=True)
MERGE_SCREENS = '--split-screens' not in sys.argv
if MERGE_SCREENS: lab[np.isin(lab,['crt_monitor','lcd_monitor'])]='screen'
VIEW=sys.argv[1] if len(sys.argv)>1 and not sys.argv[1].startswith('--') else 'both'
X={'crop':n(z['crop']),'pad':n(z['pad']),'both':n(n(z['crop'])+n(z['pad']))}[VIEW]
rng=np.random.default_rng(0)
# split: inet train->train, inet val->test; habib & giz: 50/50 by item
test=np.zeros(len(lab),bool); test[src=='inet-val']=True
for s in ['habib','giz']:
    idx=np.where(src==s)[0]; rng.shuffle(idx); test[idx[:len(idx)//2]]=True
train=~test & (src!='inet-val')
# text prototypes
tok=Tokenizer.from_file('/tmp/clip/tokenizer.json'); txt=ort.InferenceSession('/tmp/clip/onnx/text_model.onnx')
def etext(ss):
    ids=[(tok.encode(s).ids[:77]+[0]*77)[:77] for s in ss]
    return n(txt.run(None,{'input_ids':np.array(ids,dtype=np.int64)})[0])
P=json.load(open('/tmp/bench/prompts.json'))
if MERGE_SCREENS: P['screen']=P.pop('crt_monitor')+P.pop('lcd_monitor')
T={k:n(etext(v).mean(0)) for k,v in P.items()}
classes=sorted(set(lab)|set(T))
# modality gap from classes that have images
have=[c for c in classes if (train&(lab==c)).sum()>20 and c in T and c!='other']
gap=np.mean([X[train&(lab==c)].mean(0)-T[c] for c in have],0)
spread=np.mean([X[train&(lab==c)].std(0) for c in have],0)
Xs,ys=[X[train]],[lab[train]]
for c in classes:
    if c in T and (train&(lab==c)).sum()<20:
        proto=n(T[c]+gap); Xs.append(n(proto+rng.normal(0,1,(80,512))*spread)); ys.append(np.array([c]*80))
Xt,yt=np.concatenate(Xs),np.concatenate(ys)
clf=LogisticRegression(C=float(dict(a.split('=') for a in sys.argv if a.startswith('C=')).get('C',2)),max_iter=3000,class_weight='balanced').fit(Xt,yt)
pr=clf.predict_proba(X); cl=clf.classes_
top=cl[pr.argmax(1)]; conf=pr.max(1); top2=cl[np.argsort(-pr,1)[:,:2]]
# zero-shot baseline
names=list(T); Z=X@np.stack([T[k] for k in names]).T; zs=np.array(names)[Z.argmax(1)]
for name,mask in [('ImageNet val',src=='inet-val'),('shop photos (habib)',test&(src=='habib')),('SCRAPYARD (giz)',test&(src=='giz'))]:
    m=mask; acc=(top[m]==lab[m]).mean(); t2=np.mean([lab[i] in top2[i] for i in np.where(m)[0]]); za=(zs[m]==lab[m]).mean()
    sure=m&(conf>=0.6); print(f'{name:22s} n={m.sum():4d}  zero-shot {za:.0%}  trained {acc:.0%}  in top-2 {t2:.0%}  | when confident (>=60%): {sure.sum()/m.sum():.0%} of photos, {((top==lab)&sure).sum()/max(1,sure.sum()):.0%} right')
allm=test
print('per class (test):'); 
for c in classes:
    m=allm&(lab==c)
    if m.sum(): print(f'  {c:12s} n={m.sum():3d} right {(top[m]==c).mean():.0%}  ->',collections.Counter(top[m&(top!=c)]).most_common(3))
np.savez('/tmp/bench/model_'+VIEW+'.npz',W=clf.coef_,b=clf.intercept_,classes=cl)
