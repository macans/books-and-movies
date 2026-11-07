import {readFileSync,existsSync,readdirSync} from 'node:fs';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
const root='extension/',m=JSON.parse(readFileSync(root+'manifest.json'));
assert.equal(m.manifest_version,3);assert.ok(!m.permissions.includes('cookies'));
const files=[m.background.service_worker,m.side_panel.default_path,m.options_page,...Object.values(m.icons),...m.content_scripts.flatMap(x=>x.js)];for(const p of files)assert.ok(existsSync(root+p),`missing ${p}`);
for(const p of readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')))execFileSync(process.execPath,['--check',root+p]);
const {document}=parseHTML(readFileSync(root+'panel.html','utf8'));const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);assert.equal(ids.length,new Set(ids).size);assert.equal(document.querySelectorAll('script:not([src]), [onclick], [onerror]').length,0);
for(const el of document.querySelectorAll('script[src],link[rel=stylesheet]'))assert.ok(existsSync(root+(el.getAttribute('src')||el.getAttribute('href'))));
const catalog=JSON.parse(readFileSync(root+'data/catalog.json'));assert.ok(catalog.length);console.log('Manifest references, JavaScript syntax, HTML and catalog checks passed.');
