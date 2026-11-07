import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {parseHTML} from 'linkedom';
const {document,window}=parseHTML(readFileSync(new URL('../extension/panel.html',import.meta.url),'utf8'));
Object.assign(globalThis,{document,window,location:{hash:''},DOMParser:window.DOMParser});window.scrollTo=()=>{};
const candidate=id=>({id:String(id),kind:'book',title:'Sample Book '+id,url:`https://book.douban.com/subject/${id}/`,rating:null,summary:'已核实的计算机技术史资料。',meta:'Example Author / Example Press / 2024',creators:['Example Author'],originalCreators:'Example Author',originalTitle:'Sample Book '+id,cover:'artwork/example.jpg',detailsVerified:true,editorial:{about:'一本以技术历史为主题的示例作品，介绍计算机的发展与合作。',caution:'资料有限，先试读。',context:'介绍基于已核实的资料。',approach:'先检查目录和试读。'}});
const local={account:'sample',onboardingComplete:true,catalogVersion:2,records:[],catalog:[candidate(1),candidate(2)],feedback:{},feedbackAt:{},current:{}};
let handler;const watchers=[];const storage=o=>({get:async keys=>typeof keys==='string'?{[keys]:o[keys]}:Object.fromEntries(keys.filter(k=>k in o).map(k=>[k,o[k]])),set:async x=>{const changes=Object.fromEntries(Object.entries(x).map(([k,v])=>[k,{oldValue:o[k],newValue:v}]));Object.assign(o,x);watchers.forEach(fn=>fn(changes,'local'));},remove:async k=>delete o[k],setAccessLevel:async()=>{}});
globalThis.chrome={runtime:{id:'uitest',getURL:p=>'chrome-extension://uitest/'+p,onMessage:{addListener:h=>handler=h},sendMessage:m=>new Promise(resolve=>handler(m,{id:'uitest',url:'chrome-extension://uitest/panel.html'},resolve))},storage:{local:storage(local),session:storage({}),onChanged:{addListener:h=>watchers.push(h)}},sidePanel:{setPanelBehavior:async()=>{}},tabs:{onRemoved:{addListener:()=>{}},create:async()=>({})}};
await import('../extension/background.js');await import('../extension/panel.js');
const until=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}assert.fail('UI did not reach the expected state');};
const click=selector=>{const n=document.querySelector(selector);assert.ok(n,selector);n.dispatchEvent(new window.Event('click',{bubbles:true}));};
test('real panel flow keeps one pick, saves it, advances once and opens saved details + long guide',async()=>{
 await until(()=>document.querySelector('.pick-card'));
 assert.equal(document.querySelectorAll('#recommendation .pick-card').length,1);assert.equal(document.querySelector('.pick-card').dataset.item,'book:1');assert.equal(document.documentElement.lang,'en');assert.equal(document.querySelector('#stats'),null);
 click('[data-decision="save"]');await until(()=>document.querySelector('#recommendation .pick-card')?.dataset.item==='book:2');assert.equal(local.feedback['book:1'],'save');assert.equal(local.current.book,'book:2');
 click('[data-view="library"]');click('[data-detail="book:1"]');assert.equal(document.querySelector('#details').hidden,false);assert.match(document.querySelector('#detail-content').textContent,/Example Author/);
 click('#detail-content [data-deep]');await until(()=>document.querySelector('#deep-content .report'));
 assert.equal(document.querySelectorAll('.report-section').length,8);assert.equal(document.querySelector('#deep').hidden,false);assert.match(document.querySelector('#deep-content').textContent,/Sample Book 1/);
 click('[data-view="discover"]');assert.equal(document.querySelector('#recommendation .pick-card').dataset.item,'book:2');
});
