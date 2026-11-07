import test from 'node:test';import assert from 'node:assert/strict';
const local={},session={},tabs=new Map();let handler,removed,nextId=1;
const storage=o=>({get:async keys=>typeof keys==='string'?{[keys]:o[keys]}:Object.fromEntries(keys.filter(k=>k in o).map(k=>[k,o[k]])),set:async x=>{Object.assign(o,x);},remove:async k=>{delete o[k];},clear:async()=>{for(const k of Object.keys(o))delete o[k];},setAccessLevel:async()=>{}});
globalThis.chrome={storage:{local:storage(local),session:storage(session)},runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:h=>{handler=h;}}},sidePanel:{setPanelBehavior:async()=>{}},permissions:{contains:async()=>false},tabs:{create:async options=>{const tab={id:nextId++,...options};tabs.set(tab.id,tab);return tab;},update:async(id,o)=>Object.assign(tabs.get(id),o),sendMessage:async()=>({ok:true}),onRemoved:{addListener:h=>{removed=h;}}}};
await import('../extension/background.js');
const ui={id:'test',url:'chrome-extension://test/panel.html'};
const call=(m,s=ui)=>new Promise(resolve=>handler(m,s,resolve));
const reset=()=>{for(const k of Object.keys(local))delete local[k];local.account='sample';local.accountVerified=true;local.catalogVersion=2;};
test('background rejects page-initiated administrative messages',async()=>{reset();const r=await call({type:'RESET'},{id:'test',url:'https://book.douban.com/subject/1/',tab:{id:9}});assert.equal(r.ok,false);});
test('sync progress survives messages; account mismatch is rejected; cancellation preserves records',async()=>{
 reset();assert.equal((await call({type:'SYNC_START',kind:'book'})).ok,true);const job=local.job;const sender={id:'test',url:'https://book.douban.com/people/sample/collect',tab:{id:job.tabId}};
 const data={account:'sample',kind:'book',status:'collect',records:[{kind:'book',id:'1',title:'测试',status:'collect',rating:4}],total:1,next:null};
 assert.equal((await call({type:'SYNC_BATCH',jobId:job.id,data:{...data,account:'other'}},sender)).ok,false);
 assert.equal((await call({type:'SYNC_BATCH',jobId:job.id,data},sender)).ok,true);assert.equal(local.records.length,1);assert.equal(local.coverage['book:collect'].complete,true);
 assert.equal((await call({type:'SYNC_START',kind:'movie'})).ok,false);
 await call({type:'SYNC_STOP'});assert.equal(local.records.length,1);assert.equal(local.job.state,'stopped');
 assert.equal((await call({type:'SYNC_BATCH',jobId:job.id,data},sender)).ok,false);
});
test('import errors leave existing records untouched',async()=>{reset();local.records=[{kind:'book',id:'1',title:'Keep',status:'collect',rating:4}];const r=await call({type:'IMPORT',data:{version:1,account:'other',records:[]}});assert.equal(r.ok,false);assert.equal(local.records[0].title,'Keep');});
test('model calls require opt-in and do not make network requests by default',async()=>{reset();const r=await call({type:'AI_ANALYZE',item:{kind:'book',id:'1',title:'Test'}});assert.equal(r.ok,false);assert.match(r.error,/Enable a provider/);});
test('last page with a count mismatch stays partial',async()=>{reset();await call({type:'SYNC_START',kind:'book'});const job=local.job,sender={id:'test',url:'https://book.douban.com/people/sample/collect',tab:{id:job.tabId}};await call({type:'SYNC_BATCH',jobId:job.id,data:{account:'sample',kind:'book',status:'collect',records:[{kind:'book',id:'1',title:'测试',status:'collect',rating:4}],total:2,next:null}},sender);assert.equal(local.coverage['book:collect'].complete,false);await call({type:'SYNC_END',jobId:job.id},sender);assert.equal(local.job.state,'partial');});
test('persisted discovery and decisions are atomic; duplicate clicks cannot advance twice',async()=>{reset();local.catalog=[1,2].map(id=>({kind:'book',id:String(id),title:'Example '+id,detailsVerified:true,cover:'artwork/example.jpg',summary:'Verified summary'}));const first=await call({type:'DISCOVER',kind:'book'});assert.equal(first.data.item.id,'1');assert.equal((await call({type:'DISCOVER',kind:'book'})).data.item.id,'1');const next=await call({type:'DECIDE',kind:'book',key:'book:1',value:'save'});assert.equal(next.data.item.id,'2');assert.equal(local.feedback['book:1'],'save');assert.equal((await call({type:'DECIDE',kind:'book',key:'book:1',value:'hide'})).ok,false);assert.equal(local.current.book,'book:2');});
test('source fetch and search validate identifiers before making requests',async()=>{reset();assert.equal((await call({type:'FETCH_SOURCE',kind:'book',id:'https://evil.test'})).ok,false);assert.equal((await call({type:'SEARCH',kind:'music',query:'test'})).ok,false);});
test('remote search results have canonical source links before opening a new title',async t=>{
 reset();
 t.mock.method(globalThis,'fetch',async url=>({ok:true,url,json:async()=>[
  {id:'123',title:'Sample new book',author_name:'Example Author',pic:'https://img1.doubanio.com/view/subject/example.jpg',url:'https://untrusted.example/'},
  {id:'invalid',title:'Ignore this'}
 ]}));
 const result=await call({type:'SEARCH',kind:'book',query:'Sample'});
 assert.equal(result.ok,true);assert.equal(result.data.length,1);
 assert.equal(result.data[0].url,'https://book.douban.com/subject/123/');
 assert.equal(result.data[0].rating,null);assert.deepEqual(result.data[0].creators,[]);
 assert.equal(result.data[0].cover,'https://img1.doubanio.com/view/subject/example.jpg');
});
test('fresh installs start without an account or personal history',async()=>{
 reset();delete local.account;delete local.accountVerified;
 const r=await call({type:'INIT'});assert.equal(r.data.account,'');assert.deepEqual(r.data.records,[]);assert.equal(r.data.onboardingComplete,false);
 assert.equal((await call({type:'SYNC_START',kind:'all'})).ok,false);
});
test('a legacy local history recovers only its own explicit profile identity',async()=>{
 reset();delete local.account;local.records=[{kind:'book',id:'1',title:'Legacy sample',source:'https://book.douban.com/people/legacy-example/collect'}];
 const r=await call({type:'INIT'});assert.equal(r.data.account,'legacy-example');assert.equal(r.data.onboardingComplete,true);
});
test('connection accepts identity only from its own login tab and prevents mixing accounts',async()=>{
 reset();delete local.account;
 await call({type:'CONNECT_START'});const id=local.connection.tabId;
 const identity={account:'example-reader',aliases:['example-reader','12345']};
 await call({type:'READY',identity},{id:'test',tab:{id:id+1},url:'https://book.douban.com/people/example-reader/'});
 assert.equal(local.connection.state,'waiting');
 await call({type:'READY',identity},{id:'test',tab:{id},url:'https://book.douban.com/people/example-reader/'});
 assert.equal(local.account,'example-reader');assert.equal(local.accountVerified,true);
 local.records=[{kind:'book',id:'1',title:'My book',rating:4}];
 await call({type:'CONNECT_START'});
 await call({type:'READY',identity:{account:'someone-else'}},{id:'test',tab:{id:local.connection.tabId},url:'https://book.douban.com/people/someone-else/'});
 assert.equal(local.connection.state,'error');assert.equal(local.account,'example-reader');assert.equal(local.records.length,1);
});
test('both-media onboarding reads books then movies serially and preserves available history on error',async()=>{
 reset();await call({type:'SYNC_START',kind:'all'});const first=local.job.tabId;
 let job=local.job,sender={id:'test',url:'https://book.douban.com/people/sample/collect',tab:{id:first}};
 await call({type:'SYNC_BATCH',jobId:job.id,data:{account:'sample',kind:'book',status:'collect',records:[{kind:'book',id:'1',title:'A sample book',status:'collect',rating:null}],total:1,next:null}},sender);
 await call({type:'SYNC_END',jobId:job.id},sender);
 assert.equal(local.job.kind,'movie');assert.equal(local.job.state,'running');assert.notEqual(local.job.tabId,first);
 assert.equal((await call({type:'SYNC_END',jobId:job.id},sender)).ok,false);
 job=local.job;sender={id:'test',url:'https://movie.douban.com/people/sample/collect',tab:{id:job.tabId}};
 await call({type:'SYNC_END',jobId:job.id,error:'Verification required'},sender);
 assert.equal(local.job.state,'error');assert.equal(local.records.length,1);
 assert.equal((await call({type:'FINISH_SETUP'})).ok,true);assert.equal(local.onboardingComplete,true);
});
test('clear local data removes the account, history, feedback and model session key',async()=>{
 reset();local.records=[{kind:'book',id:'1',title:'Sample'}];local.feedback={'book:1':'save'};session.apiKey='fake-test-key';
 await call({type:'RESET'});assert.deepEqual(local,{});assert.equal(session.apiKey,undefined);
});
