import onnxruntime as ort, numpy as np, glob, json, os, collections, sys
from PIL import Image
from tokenizers import Tokenizer
n=lambda x:x/np.linalg.norm(x,axis=-1,keepdims=True)
tok=Tokenizer.from_file('/tmp/clip/tokenizer.json'); txt=ort.InferenceSession('/tmp/clip/onnx/text_model.onnx'); vis=ort.InferenceSession('/tmp/clip/onnx/vision_model_fp16.onnx')
def etext(ss): return n(txt.run(None,{'input_ids':np.array([(tok.encode(s).ids[:77]+[0]*77)[:77] for s in ss],dtype=np.int64)})[0])
def views(p):
    im=Image.open(p).convert('RGB'); w,h=im.size; s=256/min(w,h); a=im.resize((max(256,round(w*s)),max(256,round(h*s)))); W,H=a.size; a=a.crop(((W-256)//2,(H-256)//2,(W-256)//2+256,(H-256)//2+256))
    s=256/max(w,h); b0=im.resize((max(1,round(w*s)),max(1,round(h*s)))); b=Image.new('RGB',(256,256),(128,128,128)); b.paste(b0,((256-b0.size[0])//2,(256-b0.size[1])//2))
    return [(np.asarray(x,dtype=np.float32)/255).transpose(2,0,1) for x in (a,b)]
files=sorted(glob.glob('/tmp/models_img/*.jpg')); labels=[os.path.basename(f).split('__')[0] for f in files]
E2=vis.run(None,{'pixel_values':np.stack([v for f in files for v in views(f)])})[0]
X=n(n(E2[0::2])+n(E2[1::2]))
M=[m for m in json.load(open('/tmp/bench/resale_models.json')) if m['type']=='phone']
TEMPL=json.loads(sys.argv[1]) if len(sys.argv)>1 else ["a photo of a {}.","a photo of the back of a {} smartphone.","the {} phone."]
T=np.stack([n(etext([t.format(f"{m['brand']} {m['model']}") for t in TEMPL]).mean(0)) for m in M])
S=X@T.T; ids=[m['id'] for m in M]; brand={m['id']:m['brand'] for m in M}
fam=lambda i: i.replace('-max','').replace('-pro','').replace('-plus','').replace('-ultra','').replace('-fe','').replace('-lite','')
r=collections.Counter()
for lab,s in zip(labels,S):
    o=[ids[k] for k in np.argsort(-s)]
    r['top1']+=o[0]==lab; r['top3']+=lab in o[:3]; r['brand']+=brand[o[0]]==brand[lab]; r['family']+=fam(o[0])==fam(lab)
N=len(labels); print({k:f'{v/N:.0%}' for k,v in r.items()}, 'n=',N, 'models=',len(set(labels)))
np.savez('/tmp/bench/models_emb.npz',X=X,labels=np.array(labels))
