import onnxruntime as ort, numpy as np, glob, json, os, collections, sys
from PIL import Image
from tokenizers import Tokenizer
from sklearn.linear_model import LogisticRegression
n=lambda x:x/np.linalg.norm(x,axis=-1,keepdims=True)
tok=Tokenizer.from_file('/tmp/clip/tokenizer.json'); txt=ort.InferenceSession('/tmp/clip/onnx/text_model.onnx'); vis=ort.InferenceSession('/tmp/clip/onnx/vision_model_fp16.onnx')
def etext(ss): return n(txt.run(None,{'input_ids':np.array([(tok.encode(s).ids[:77]+[0]*77)[:77] for s in ss],dtype=np.int64)})[0])
def views(p):
    im=Image.open(p).convert('RGB'); w,h=im.size; s=256/min(w,h); a=im.resize((max(256,round(w*s)),max(256,round(h*s)))); W,H=a.size; a=a.crop(((W-256)//2,(H-256)//2,(W-256)//2+256,(H-256)//2+256))
    s=256/max(w,h); b0=im.resize((max(1,round(w*s)),max(1,round(h*s)))); b=Image.new('RGB',(256,256),(128,128,128)); b.paste(b0,((256-b0.size[0])//2,(256-b0.size[1])//2))
    return [(np.asarray(x,dtype=np.float32)/255).transpose(2,0,1) for x in (a,b)]
REN={'rs-dell-latitude':'rs-latitude','rs-hp-elitebook':'rs-elitebook'}
files=sorted(glob.glob('/tmp/laptop_img/*.jpg')); L=np.array([REN.get(os.path.basename(f).split('__')[0],os.path.basename(f).split('__')[0]) for f in files])
cache='/tmp/bench/laptop_emb.npz'
if os.path.exists(cache) and len(np.load(cache)['L'])==len(L): X=np.load(cache)['X']
else:
    E=np.concatenate([vis.run(None,{'pixel_values':np.stack([v for f in files[i:i+8] for v in views(f)])})[0] for i in range(0,len(files),8)])
    X=n(n(E[0::2])+n(E[1::2])); np.savez(cache,X=X,L=L)
M={'rs-latitude':('Dell','Latitude business laptop'),'rs-thinkpad':('Lenovo','ThinkPad laptop'),'rs-elitebook':('HP','EliteBook laptop'),'rs-mba-m1':('Apple','MacBook Air'),
   'rs-vivobook':('Asus','VivoBook laptop'),'rs-ideapad':('Lenovo','IdeaPad laptop'),'rs-pavilion':('HP','Pavilion laptop'),'rs-inspiron':('Dell','Inspiron laptop'),'rs-aspire':('Acer','Aspire laptop')}
ids=list(M); T={i:n(etext([t.format(M[i][0]+' '+M[i][1]) for t in ["a photo of a {}.","a photo of an open {}.","the {}."]]).mean(0)) for i in ids}
print(collections.Counter(L))
have=[i for i in ids if (L==i).sum()>=3]; gap=np.mean([X[L==i].mean(0)-T[i] for i in have],0); spread=np.mean([X[L==i].std(0) for i in have],0)
rng=np.random.default_rng(0)
def fit(mask,C):
    xs,ys=[X[mask]],[L[mask]]
    for i in ids:
        if (L[mask]==i).sum()<3: xs.append(n(n(T[i]+gap)+rng.normal(0,1,(12,512))*spread)); ys.append(np.array([i]*12))
    return LogisticRegression(C=C,max_iter=3000,class_weight='balanced').fit(np.concatenate(xs),np.concatenate(ys))
C=float(sys.argv[1]) if len(sys.argv)>1 else 10
r=collections.Counter(); per=collections.defaultdict(lambda:[0,0])
for k in range(len(L)):
    tr=np.arange(len(L))!=k; c=fit(tr,C); p=c.predict_proba(X[k:k+1])[0]; o=c.classes_[np.argsort(-p)]
    r['n']+=1; r['top1']+=o[0]==L[k]; r['top3']+=L[k] in o[:3]; r['brand']+=M[o[0]][0]==M[L[k]][0]; r['conf']+=p.max()>=.5; r['rc']+=(p.max()>=.5) and o[0]==L[k]
    per[L[k]][0]+=o[0]==L[k]; per[L[k]][1]+=1
print(f"C={C}  model first {r['top1']/r['n']:.0%}  in top 3 {r['top3']/r['n']:.0%}  brand {r['brand']/r['n']:.0%}  confident {r['conf']/r['n']:.0%} -> right {r['rc']/max(1,r['conf']):.0%}")
print('  per family:', {k:f'{a}/{b}' for k,(a,b) in per.items()})
if '--export' in sys.argv:
    c=fit(np.ones(len(L),bool),C)
    json.dump({'classes':list(c.classes_),'W':np.round(c.coef_,5).tolist(),'b':np.round(c.intercept_,5).tolist(),'brand':{i:M[i][0] for i in ids},
      'note':'Laptop family from looks (MobileCLIP-S0). Trained on Wikimedia Commons photos. Suggestions only; label text wins.'},
      open('/tmp/urbanmine/repo/web/public/models/laptop_model_head.v1.json','w'),separators=(',',':')); print('exported')
