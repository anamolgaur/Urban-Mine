import numpy as np, json, collections, sys, onnxruntime as ort
from sklearn.linear_model import LogisticRegression
from tokenizers import Tokenizer
n=lambda x:x/np.linalg.norm(x,axis=-1,keepdims=True)
z=np.load('models_emb.npz'); X,L=z['X'],z['labels']
M=[m for m in json.load(open('resale_models.json')) if m['type']=='phone']; ids=[m['id'] for m in M]; B={m['id']:m['brand'] for m in M}
tok=Tokenizer.from_file('/tmp/clip/tokenizer.json'); txt=ort.InferenceSession('/tmp/clip/onnx/text_model.onnx')
def etext(ss): return n(txt.run(None,{'input_ids':np.array([(tok.encode(s).ids[:77]+[0]*77)[:77] for s in ss],dtype=np.int64)})[0])
T={m['id']:n(etext([t.format(m['brand']+' '+m['model']) for t in ["a photo of a {}.","a photo of the back of a {} smartphone.","the {} phone."]]).mean(0)) for m in M}
have=[i for i in ids if (L==i).sum()>=3]
gap=np.mean([X[L==i].mean(0)-T[i] for i in have],0); spread=np.mean([X[L==i].std(0) for i in have],0)
rng=np.random.default_rng(0)
def fit(mask):
    xs,ys=[X[mask]],[L[mask]]
    for i in ids:
        if (L[mask]==i).sum()<3: xs.append(n(n(T[i]+gap)+rng.normal(0,1,(12,512))*spread)); ys.append(np.array([i]*12))
    return LogisticRegression(C=float(sys.argv[1]) if len(sys.argv)>1 else 10,max_iter=3000,class_weight='balanced').fit(np.concatenate(xs),np.concatenate(ys))
r=collections.Counter(); N=len(L)
for k in range(N):
    tr=np.arange(N)!=k
    if (L[tr]==L[k]).sum()==0: continue
    c=fit(tr); p=c.predict_proba(X[k:k+1])[0]; o=c.classes_[np.argsort(-p)]
    r['n']+=1; r['top1']+=o[0]==L[k]; r['top3']+=L[k] in o[:3]; r['brand']+=B[o[0]]==B[L[k]]
    r['conf>=.5']+=p.max()>=.5; r['right_when_conf']+=(p.max()>=.5) and o[0]==L[k]
print({k:(f'{v/r["n"]:.0%}' if k not in('n','right_when_conf') else v) for k,v in r.items()}, 'precision when confident: %.0f%%'%(100*r['right_when_conf']/max(1,r['conf>=.5'])))
if '--export' in sys.argv:
    c=fit(np.ones(N,bool))
    json.dump({'classes':list(c.classes_),'W':np.round(c.coef_,5).tolist(),'b':np.round(c.intercept_,5).tolist(),'brand':B,
               'note':'Phone model from looks (MobileCLIP-S0 embedding). Trained on Wikimedia Commons photos; models without photos use text prompts. Leave-one-out: brand ~85%, model in top 3 ~60%. Use as suggestions only; text on the label wins.'},
              open('/tmp/urbanmine/repo/web/public/models/phone_model_head.v1.json','w'),separators=(',',':'))
    print('exported')
