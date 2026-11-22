import json,urllib.request,urllib.parse,time,glob,sys
UA={'User-Agent':'UrbanMineHackathonBench/1.0 (student project)'}
def get(u,tries=5):
    for i in range(tries):
        try: return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40).read()
        except Exception as e:
            if '429' in str(e): time.sleep(6*(i+1)); continue
            return None
plan={'rs-dell-latitude':(['Dell Latitude laptop','Dell Latitude E6420','Dell Latitude 5490'],['latitude']),
      'rs-thinkpad':(['ThinkPad T480','ThinkPad T440','ThinkPad E14','ThinkPad laptop','ThinkPad X1 Carbon'],['thinkpad']),
      'rs-hp-elitebook':(['HP EliteBook','HP ProBook','EliteBook 840'],['elitebook','probook']),
      'rs-mba-m1':(['MacBook Air M1','MacBook Air 2020','MacBook Air'],['macbook air','macbookair']),
      'rs-vivobook':(['Asus VivoBook','VivoBook laptop','Asus VivoBook 15'],['vivobook']),
      'rs-ideapad':(['Lenovo IdeaPad','IdeaPad laptop','IdeaPad Slim'],['ideapad']),
      'rs-pavilion':(['HP Pavilion laptop','HP Pavilion 15','HP Pavilion x360'],['pavilion']),
      'rs-inspiron':(['Dell Inspiron laptop','Dell Inspiron 15','Inspiron 14'],['inspiron']),
      'rs-aspire':(['Acer Aspire laptop','Acer Aspire 5','Acer Aspire One'],['aspire'])}
CAP=16
for lab,(qs,keys) in plan.items():
    n=len(glob.glob(f'{lab}__*.jpg'))
    for q in qs:
        if n>=CAP: break
        j=get('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(dict(action='query',format='json',generator='search',gsrnamespace=6,gsrsearch=q+' filetype:bitmap',gsrlimit=20,prop='imageinfo',iiprop='url',iiurlwidth=400))); time.sleep(1.5)
        if not j: continue
        for p in json.loads(j).get('query',{}).get('pages',{}).values():
            t=p['title'].lower().replace('_',' ')
            if not any(k in t or k in t.replace(' ','') for k in keys): continue
            if any(x in t for x in ['motherboard','logo','screenshot','battery','charger','adapter','disassembl','inside','dock','keyboard']): continue
            if glob.glob(f"{lab}__*{abs(hash(p['title']))%10**8}.jpg"): continue
            u=p['imageinfo'][0].get('thumburl'); b=get(u) if u else None; time.sleep(0.8)
            if b and len(b)>5000: open(f"{lab}__{n}_{abs(hash(p['title']))%10**8}.jpg",'wb').write(b); n+=1
            if n>=CAP: break
    print(lab,n,flush=True)
