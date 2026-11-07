import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {parseHTML} from 'linkedom';
const {document,window}=parseHTML(readFileSync(new URL('../extension/panel.html',import.meta.url),'utf8'));
Object.assign(globalThis,{document,window,location:{hash:''},DOMParser:window.DOMParser});window.scrollTo=()=>{};
const item={kind:'book',id:'1',title:'Synthetic example',creators:['Example Author'],url:'https://book.douban.com/subject/1/',cover:'artwork/example.jpg',detailsVerified:true,summary:'A synthetic summary.'};
let state={account:'',accountVerified:false,onboardingComplete:false,records:[],catalog:[item],feedback:{},feedbackAt:{},current:{},model:{enabled:false,endpoint:'',model:''}},calls=[];
globalThis.chrome={runtime:{id:'onboarding-test',sendMessage:async m=>{calls.push(m);if(m.type==='INIT')return {ok:true,data:structuredClone(state)};if(m.type==='FINISH_SETUP')state.onboardingComplete=true;if(m.type==='DISCOVER')return {ok:true,data:{item}};return {ok:true,data:{}};}},storage:{onChanged:{addListener:()=>{}}}};
await import('../extension/panel.js');
const until=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}assert.fail('Setup did not reach expected state');};
test('a clean user sees connection guidance and can explicitly explore without claimed preferences',async()=>{
 await until(()=>!document.querySelector('#setup').hidden);
 assert.equal(document.querySelector('#sync-history').disabled,true);
 assert.equal(calls.some(c=>c.type==='DISCOVER'),false);
 assert.match(document.querySelector('#connection-state').textContent,/Chrome profile/);
 document.querySelector('#finish-setup').click();await until(()=>document.querySelector('#recommendation .pick-card'));
 assert.equal(document.querySelector('#discover').hidden,false);assert.equal(state.onboardingComplete,true);
 assert.match(document.querySelector('#recommendation').textContent,/没有足够明确/);
});
