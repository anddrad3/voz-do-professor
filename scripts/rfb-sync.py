"""Bounded public RFB discovery. Standard library only; no QSA/contact ingestion.
Uses HTTP ranges over ZIP, never stores multi-GB source files on free hosting.
Catalog is deliberately partial; see docs/automacao.md.
"""
import argparse, csv, hashlib, io, json, re, sqlite3, time, urllib.request, urllib.parse, xml.etree.ElementTree as ET, zipfile
from datetime import datetime, timezone
BASE='https://arquivos.receitafederal.gov.br/public.php/dav/files/YggdBLfdninEJX9/'
def now(): return datetime.now(timezone.utc).isoformat()
def dav(url):
    req=urllib.request.Request(url,data=b'<d:propfind xmlns:d="DAV:"><d:prop><d:getcontentlength/></d:prop></d:propfind>',method='PROPFIND',headers={'Depth':'1','Content-Type':'application/xml'})
    with urllib.request.urlopen(req,timeout=30) as r: root=ET.fromstring(r.read(2*1024*1024))
    return [(urllib.parse.unquote(n.findtext('{DAV:}href') or ''), int(n.findtext('.//{DAV:}getcontentlength') or '0')) for n in root.findall('{DAV:}response')]
class RangeFile(io.RawIOBase):
    def __init__(self,url,size,budget,deadline): self.url=url;self.size=size;self.pos=0;self.used=0;self.budget=budget;self.deadline=deadline;self.cache=b'';self.cache_start=-1
    def readable(self):return True
    def seekable(self):return True
    def tell(self):return self.pos
    def seek(self,offset,whence=0):
        self.pos=offset if whence==0 else self.pos+offset if whence==1 else self.size+offset
        if self.pos<0:raise ValueError('negative seek')
        return self.pos
    def read(self,n=-1):
        if n<0:n=self.size-self.pos
        out=bytearray()
        while n>0 and self.pos<self.size:
            if time.monotonic()>self.deadline:raise RuntimeError('Limite de tempo do lote; catálogo parcial preservado.')
            if not(self.cache_start<=self.pos<self.cache_start+len(self.cache)):
                start=self.pos;end=min(self.size-1,start+1024*1024-1)
                if self.used+end-start+1>self.budget:raise RuntimeError('Limite de tráfego do lote; catálogo parcial preservado.')
                req=urllib.request.Request(self.url,headers={'Range':f'bytes={start}-{end}','User-Agent':'VozDoProfessor/2.0'})
                with urllib.request.urlopen(req,timeout=30) as r:
                    if r.status!=206:raise RuntimeError('Fonte não aceitou consulta parcial; download integral bloqueado.')
                    expected=f'bytes {start}-{end}/{self.size}'
                    if r.headers.get('Content-Range')!=expected:raise RuntimeError('Resposta Range divergente.')
                    self.cache=r.read(end-start+2)
                if len(self.cache)!=end-start+1:raise RuntimeError('Tamanho de bloco divergente.')
                self.cache_start=start;self.used+=len(self.cache)
            offset=self.pos-self.cache_start;chunk=self.cache[offset:offset+min(n,len(self.cache)-offset)];out.extend(chunk);self.pos+=len(chunk);n-=len(chunk)
        return bytes(out)
def rows(url,size,budget,deadline):
    remote=RangeFile(url,size,budget,deadline)
    with zipfile.ZipFile(remote) as archive:
        names=archive.namelist()
        if len(names)!=1:raise RuntimeError('Leiaute ZIP inesperado.')
        with archive.open(names[0]) as f:
            yield from csv.reader(io.TextIOWrapper(f,encoding='latin1',newline=''),delimiter=';')
def institution(row,municipalities,date):
    if len(row)<30:raise ValueError('Leiaute de estabelecimentos incompatível.')
    codes=[row[11]]+(row[12] or '').split(',')
    if row[5]!='02' or not any(re.fullmatch(r'85\d{5}',c) for c in codes):return None
    cnpj=''.join(row[:3]).upper()
    if not re.fullmatch(r'[A-Z0-9]{12}\d{2}',cnpj):return None
    title=row[4].strip() or f'Estabelecimento de educação {cnpj}'
    return {'title':title[:240],'body':'Estabelecimento ativo com atividade de educação (CNAE 85) na base pública da Receita Federal. Presença no diretório não indica vaga aberta.','country':'BR','city':municipalities.get(row[20],''),'state':row[19],'cnpj':cnpj,'cnae':next(c for c in codes if c.startswith('85')),'network':'Não informada','active':True,'sourceName':'Receita Federal / CNPJ','sourceUrl':'https://www.gov.br/receitafederal/dados','sourceDate':date+'-01','automatic':True,'attribution':'Dados públicos da Receita Federal. Catálogo parcial em lotes limitados.','locationBasis':'Município cadastral informado pela Receita Federal.','lat':None,'lng':None,'tags':['CNAE 85','Base pública'],'crosscheck':'Não cruzado','address':'','phone':'','website':'','recruitmentUrl':'','recruitmentVerified':False,'inepCode':'','provenance':[]}
def run(db_path,limit=500,budget_mb=24,seconds=120):
    db=sqlite3.connect(db_path,timeout=30);db.execute('PRAGMA busy_timeout=30000')
    id='rfb-'+str(int(time.time()));db.execute('INSERT INTO imports(id,source,started_at,status,summary) VALUES(?,?,?,?,?)',(id,'rfb',now(),'running','{}'));db.commit()
    count=0;status='completed';summary={};deadline=time.monotonic()+seconds
    try:
        months=sorted({m.group(1) for path,_ in dav(BASE) if (m:=re.search(r'/(20\d{2}-\d{2})/?$',path))},reverse=True)
        selected=None
        for month in months[:3]:
            files={p.rsplit('/',1)[-1]:size for p,size in dav(BASE+month+'/') if size>0}
            if all(f'Estabelecimentos{i}.zip' in files for i in range(10)) and 'Municipios.zip' in files:selected=(month,files);break
        if not selected:raise RuntimeError('Nenhum mês com todos os arquivos esperados.')
        month,files=selected
        old=db.execute("SELECT value FROM metadata WHERE key='rfb-cursor'").fetchone()
        cursor=json.loads(old[0]) if old else {};part=cursor.get('part',0) if cursor.get('month')==month else 0
        municipalities={r[0]:r[1] for r in rows(BASE+month+'/Municipios.zip',files['Municipios.zip'],2*1024*1024,deadline)}
        file=f'Estabelecimentos{part}.zip';summary={'month':month,'shard':part,'coverage':'partial','maxCompressedMB':budget_mb}
        try:
            for row in rows(BASE+month+'/'+file,files[file],budget_mb*1024*1024,deadline):
                data=institution(row,municipalities,month)
                if not data:continue
                rid='rfb-'+data['cnpj'];serialized=json.dumps(data,ensure_ascii=False)
                db.execute("INSERT INTO records(id,kind,data,status,reviewer,updated_at) VALUES(?,'school',?,'published','Receita Federal / importação automática',?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,revision=records.revision+1 WHERE records.data<>excluded.data AND records.status<>'archived'",(rid,serialized,now()))
                count+=1
                if count>=limit:break
        except RuntimeError as e:status='partial';summary['note']=str(e)
        summary['stored']=count
        # Rotate shards each day; this is a bounded sample, never advertised as a full census.
        db.execute("INSERT INTO metadata VALUES('rfb-cursor',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",(json.dumps({'month':month,'part':(part+1)%10}),))
        db.execute("DELETE FROM records WHERE id IN (SELECT id FROM records WHERE id LIKE 'rfb-%' ORDER BY updated_at DESC LIMIT -1 OFFSET 3000)")
        db.execute("DELETE FROM records WHERE id LIKE 'rfb-%' AND json_extract(data,'$.sourceDate') < date('now','-100 days')")
    except Exception as e:status='failed';summary.update(error=str(e),stored=count)
    db.execute('UPDATE imports SET status=?,finished_at=?,summary=? WHERE id=?',(status,now(),json.dumps(summary,ensure_ascii=False),id));db.commit();db.close();print(json.dumps({'status':status,**summary},ensure_ascii=False))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--database',required=True);p.add_argument('--limit',type=int,default=500);p.add_argument('--budget-mb',type=int,default=24);p.add_argument('--seconds',type=int,default=120);a=p.parse_args();run(a.database,a.limit,a.budget_mb,a.seconds)
