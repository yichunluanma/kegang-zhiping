"""Package only explicit project files; omit secrets, runtime data and repository internals."""
from pathlib import Path
import hashlib, json, zipfile

root=Path(__file__).resolve().parent.parent
out=root/'08-交付包'
version=json.loads((root/'01-应用源码/package.json').read_text(encoding='utf-8'))['version']
files=[]
for path in root.rglob('*'):
    if not path.is_file(): continue
    rel=path.relative_to(root)
    if rel.parts[0] not in {'01-应用源码','02-开发过程记录','03-技术文档','04-演示视频材料','05-测试与验证','06-报名与提交清单','07-课程样例','09-使用说明'} and str(rel) not in {'README.md','启动课纲智评.cmd','停止课纲智评.cmd','.gitignore','.gitattributes'}: continue
    if path.name == '.env' or '__pycache__' in rel.parts: continue
    if 'node_modules' in rel.parts and '.bin' in rel.parts: continue  # unused npm CLI wrappers, including PowerShell shims
    if 'data' in rel.parts and path.name != '.gitkeep': continue
    files.append(path)
for path in [out/'README.md',out/'build_delivery.py',out/'verify_delivery.mjs',out/'课纲智评-开发历史.bundle']:
    if path.exists(): files.append(path)
files=sorted(files)
records=[{'path':str(p.relative_to(root)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
manifest=out/'文件校验清单.json'
manifest.write_text(json.dumps({'version':version,'scope':'Payload only; excludes manifest itself','files':records},ensure_ascii=False,indent=2),encoding='utf-8')
archive=out/f'课纲智评-v{version}-离线运行包.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
    for p in files+[manifest]: z.write(p,str(p.relative_to(root)).replace('\\','/'))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert not any(p.endswith('/.env') or p.endswith('.sqlite') or p.endswith('.log') for p in z.namelist())
    for entry in records: assert hashlib.sha256(z.read(entry['path'])).hexdigest()==entry['sha256']
print(f'Package verified: {len(records)} files, {archive.stat().st_size} bytes')
