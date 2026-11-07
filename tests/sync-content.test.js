import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import '../extension/lib/parser.js';
const collection=(id,status)=>`<html><head><title>Books</title></head><body><div id="db-global-nav"><div class="nav-user-account"><a href="https://www.douban.com/people/example/">My profile</a></div></div><h1>Books (1)</h1><li class="subject-item"><h2><a href="https://book.douban.com/subject/${id}/" title="Example ${status}">Example</a></h2><div class="pub">Example Author / Example Press</div></li></body></html>`;
let listener,batches=[],requests=[],end,finish,fail=false;
const {document,window}=parseHTML(collection(1,'collect'));
Object.assign(globalThis,{document,DOMParser:window.DOMParser,location:new URL('https://book.douban.com/people/example/collect')});
globalThis.chrome={runtime:{id:'sync-test',onMessage:{addListener:h=>listener=h},sendMessage:async m=>{if(m.type==='SYNC_BATCH')batches.push(m.data);if(m.type==='SYNC_END'){end=m;finish?.();}return {ok:true};}}};
await import('../extension/content.js');
function start(){return new Promise(resolve=>{finish=resolve;listener({type:'SYNC',id:'job',account:'example',aliases:['example']},{id:'sync-test'},()=>{});});}
function mocks(t){
 const realTimer=globalThis.setTimeout;
 t.mock.method(globalThis,'setTimeout',(fn,ms,...args)=>realTimer(fn,ms===1800?1:ms,...args));
 t.mock.method(globalThis,'fetch',async url=>{requests.push(url);return {ok:!fail,status:fail?429:200,url,text:async()=>collection(url.endsWith('/wish')?2:3,url.endsWith('/wish')?'wish':'do')};});
}
test('content synchronization reads all statuses serially from the connected account without invented stars',async t=>{
 mocks(t);await start();await Promise.resolve();
 assert.equal(end.error,undefined);assert.deepEqual(batches.map(b=>b.status),['collect','wish','do']);
 assert.deepEqual(requests,['https://book.douban.com/people/example/wish','https://book.douban.com/people/example/do']);
 assert.ok(batches.every(b=>b.account==='example'&&b.records[0].rating===null));
});
test('a rate limit stops subsequent collection requests and preserves completed batches',async t=>{
 mocks(t);batches=[];requests=[];fail=true;await start();
 assert.match(end.error,/429/);assert.equal(batches.length,1);assert.equal(requests.length,1);
});
