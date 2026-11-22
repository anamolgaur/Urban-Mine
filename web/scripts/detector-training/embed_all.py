import onnxruntime as ort, numpy as np, io, glob, os, random, json, pyarrow.parquet as pq, urllib.request
from PIL import Image
random.seed(7)
so=ort.SessionOptions(); so.intra_op_num_threads=2
vis=ort.InferenceSession('/tmp/clip/onnx/vision_model_fp16.onnx',so)
def crop(im):
    w,h=im.size; s=256/min(w,h); im=im.resize((max(256,round(w*s)),max(256,round(h*s))),Image.BILINEAR); w,h=im.size
    l,t=(w-256)//2,(h-256)//2; return im.crop((l,t,l+256,t+256))
def pad(im):
    w,h=im.size; s=256/max(w,h); im=im.resize((max(1,round(w*s)),max(1,round(h*s))),Image.BILINEAR)
    c=Image.new('RGB',(256,256),(128,128,128)); c.paste(im,((256-im.size[0])//2,(256-im.size[1])//2)); return c
arr=lambda im:(np.asarray(im,dtype=np.float32)/255).transpose(2,0,1)
items=[]  # (source, group, label, loader)
for line in open('/tmp/inet/classes.txt'):
    c,lab=line.split()
    for split,n in [('train',80),('val',25)]:
        t=pq.read_table(f'/tmp/inet/{c}.{split}.parquet'); col=t.column('image').to_pylist()
        for k in random.sample(range(len(col)),min(n,len(col))):
            items.append(('inet-'+split,c,lab,col[k]['bytes']))
for f in glob.glob('/tmp/giz/more/*'):
    lab=os.path.basename(f).split('__')[0]; items.append(('giz','giz_'+lab,{'tv':'crt_monitor','computer':'other'}.get(lab,lab),open(f,'rb').read()))
g=[x['rfilename'] for x in json.load(urllib.request.urlopen("https://huggingface.co/api/datasets/habibCSEBRUR/electronic-gadgets-image-dataset"))['siblings']]
import urllib.parse, concurrent.futures as cf
want=[]
for folder,n,lab in [('smartphone',150,'phone'),('power_bank',60,'other'),('smartwatch',40,'other'),('bluetooth_speaker',30,'other'),('keyboard',30,'other'),('wireless_mouse',20,'other')]:
    fs=[f for f in g if f.startswith(folder+'/') and f.lower().endswith(('.jpg','.jpeg','.png','.webp'))]
    want+= [(folder,lab,f) for f in random.sample(fs,min(n,len(fs)))]
def get(x):
    try: return x,urllib.request.urlopen("https://huggingface.co/datasets/habibCSEBRUR/electronic-gadgets-image-dataset/resolve/main/"+urllib.parse.quote(x[2]),timeout=60).read()
    except Exception: return x,None
with cf.ThreadPoolExecutor(16) as ex:
    for (folder,lab,f),b in ex.map(get,want):
        if b: items.append(('habib','habib_'+folder,lab,b))
print('items',len(items),flush=True)
E1,E2,meta=[],[],[]
B=[]
def flush():
    if not B: return
    x1=np.stack([a for a,_ in B]); x2=np.stack([b for _,b in B])
    E1.append(vis.run(None,{'pixel_values':x1})[0]); E2.append(vis.run(None,{'pixel_values':x2})[0]); B.clear()
for i,(src,grp,lab,b) in enumerate(items):
    try: im=Image.open(io.BytesIO(b)).convert('RGB')
    except Exception: continue
    B.append((arr(crop(im)),arr(pad(im)))); meta.append((src,grp,lab))
    if len(B)==32: flush()
    if i%320==0: print(i,flush=True)
flush()
np.savez('/tmp/bench/all.npz',crop=np.concatenate(E1),pad=np.concatenate(E2),meta=np.array(meta))
print('done',flush=True)
