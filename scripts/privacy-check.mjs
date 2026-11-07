import {readFileSync,readdirSync,existsSync,lstatSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {DEFAULTS} from '../extension/lib/store.js';
import assert from 'node:assert/strict';
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
const allowed=JSON.parse(readFileSync('scripts/release-files.json'));
assert.equal(DEFAULTS.account,'','A public build must not have a default personal account.');
assert.deepEqual(DEFAULTS.records,[]);assert.deepEqual(DEFAULTS.feedback,{});
const extensionFiles=walk('extension').filter(p=>!p.endsWith('/.DS_Store'));
assert.deepEqual(extensionFiles.map(p=>p.slice(10)).sort(),allowed.slice().sort(),'Unexpected files in extension. Update the reviewed release allowlist.');
let files=[...extensionFiles,...walk('scripts'),...walk('tests'),...walk('install'),...walk('.github'),...['README.md','PRIVACY.md','LICENSE','NOTICE','AGENTS.md','.gitignore','package.json','package-lock.json','install.sh','install-macos.command','install-windows.cmd'].filter(existsSync)];
try{
 const tracked=execFileSync('git',['ls-files','-z'],{stdio:['ignore','pipe','ignore']}).toString().split('\0').filter(Boolean);
 files=[...new Set([...files,...tracked])];
}catch{/* Checks also run from a GitHub source ZIP without .git. */}
const blocked=/^(?:private|dist|\.tools|node_modules|\.local-data)\/|(?:^|\/)(?:bootstrap\.json|\.env(?:\..*)?|[^/]*credentials[^/]*\.json)$|\.(?:pem|key|p12|zip)$/i;
const secret=/(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{40,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,}|AKIA[0-9A-Z]{16})/;
for(const path of files){
 assert.ok(!blocked.test(path),`Private file would be published: ${path}`);
 assert.ok(!lstatSync(path).isSymbolicLink(),`Symlinks are not allowed in releases: ${path}`);
 if(/\.(png|jpg|webp)$/.test(path))continue;
 const text=readFileSync(path,'utf8');
 assert.ok(!/\/Users\/[^/\s]+\//.test(text),`Personal home path in ${path}`);
 assert.ok(!secret.test(text),`Possible credential in ${path}`);
}
const catalog=JSON.parse(readFileSync('extension/data/catalog.json'));
function check(value){
 if(Array.isArray(value)){value.forEach(check);return;}
 if(value&&typeof value==='object')for(const [k,v] of Object.entries(value)){
  if(['account','rating','comment','status','date'].includes(k))assert.ok(v==null||v===''||(Array.isArray(v)&&!v.length),`Personal field in public catalog: ${k}`);
  check(v);
 }
 if(typeof value==='string')assert.ok(!/https?:\/\/[^\s]*douban\.com\/people\//.test(value),'Personal profile URL in public catalog');
}
check(catalog);
console.log(`Privacy checks passed: ${files.length} public files; no default account, personal catalog records, private payloads or detected credentials.`);
