import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {execFileSync} from 'node:child_process';
test('installer prepares a persistent clean folder and backs up an update without launching a browser',()=>{
 const base=mkdtempSync(join(tmpdir(),'books-movies-install-')),target=join(base,'Folder with spaces');
 const env={...process.env,BOOKS_MOVIES_INSTALL_DIR:target};
 const install=()=>process.platform==='win32'?execFileSync('cmd.exe',['/d','/c','install-windows.cmd','--prepare-only'],{cwd:resolve('.'),env,stdio:'pipe'}):execFileSync('/bin/sh',['install.sh','--prepare-only'],{env,stdio:'pipe'});
 try{
  install();assert.equal(JSON.parse(readFileSync(join(target,'extension/manifest.json'))).name,'Books & Movies');
  assert.equal(readFileSync(join(target,'extension/lib/store.js'),'utf8'),readFileSync('extension/lib/store.js','utf8'));
  assert.ok(!readdirSync(join(target,'extension/data')).includes('bootstrap.json'));
  install();assert.equal(readdirSync(target).filter(n=>n.startsWith('extension.previous.')).length,1);
  assert.ok(readFileSync(join(target,'INSTALL.html'),'utf8').includes('Load unpacked'));
 }finally{rmSync(base,{recursive:true,force:true});}
});
