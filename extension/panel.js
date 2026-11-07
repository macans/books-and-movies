import {key,mergeRecords,evaluate} from './lib/engine.js';
import {DEFAULTS} from './lib/store.js';
import {brief,facts,deepDive,savedItems} from './lib/reports.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state={...DEFAULTS},kind='book',filter='all',current=null,detail=null,reportItem=null,matches=[],pickRequest=0,searchRequest=0,toastTimer;
const inExtension=Boolean(globalThis.chrome?.runtime?.id);
async function api(type,data={}){
 if(!inExtension)throw Error('Open Books & Movies from the installed Chrome extension.');
 let timer;
 try{
  const r=await Promise.race([
   chrome.runtime.sendMessage({type,...data}),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The request timed out. Open the Douban source page and use “Use current Douban page”, or try again later.')),type==='AI_ANALYZE'?60000:35000);})
  ]);
  if(!r?.ok)throw Error(r?.error||'Something went wrong. Please try again.');return r.data;
 }finally{clearTimeout(timer);}
}
function toast(s){clearTimeout(toastTimer);$('#toast').textContent=s;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,6000);}
async function action(fn,b){if(b)b.disabled=true;try{await fn();}catch(e){toast(e.message);}finally{if(b)b.disabled=false;if(['sync-history','connect-douban','finish-setup'].includes(b?.id))renderSetup();}}
function view(id){if(!['setup','discover','library','details','deep','settings'].includes(id))id='discover';if(!state.onboardingComplete&&id!=='settings')id='setup';$$('.view').forEach(n=>n.hidden=n.id!==id);$$('nav button').forEach(n=>{const active=n.dataset.view===(id==='details'?'library':id);n.classList.toggle('active',active);n.setAttribute('aria-current',active?'page':'false');});location.hash=id;if(id==='library')renderLibrary();}
function choices(selector,value,prop){$$(selector).forEach(b=>{const yes=b.dataset[prop]===value;b.classList.toggle('active',yes);b.setAttribute('aria-pressed',String(yes));});}
async function refresh(){state=await api('INIT');$('#saved-indicator').textContent=Object.values(state.feedback).filter(v=>v==='save').length||'';renderLibrary();renderSetup();}
function renderSetup(){
 const connection=state.connection,job=state.job,running=job?.state==='running',waiting=connection?.state==='waiting';
 $('#connection-state').textContent=waiting?'Finish signing in in the Douban tab, then return here.':connection?.state==='error'?connection.message:state.accountVerified?`Connected to ${state.account}.`:state.account?'Your local history is available. Reconnect to refresh it.':'Your connection stays in this Chrome profile.';
 $('#connect-douban').textContent=state.account?'Reconnect Douban ↗':'Connect Douban ↗';$('#connect-douban').disabled=running;
 $('#check-douban').hidden=!waiting;
 $('#history-state').textContent=job?.message||'Books and movies are read one after another. Keep the Douban tabs open until this finishes.';
 $('#sync-history').disabled=!state.accountVerified||!$('#history-consent').checked||running;
 $('#sync-history').textContent=job?'Refresh my history':'Use my history';$('#stop-history').hidden=!running;
 $('#open-history').hidden=!job?.tabId||!['running','error','partial'].includes(job.state);
 $('#finish-setup').disabled=running;$('#finish-setup').textContent=state.records.length?'Start discovering':job?.state==='done'?'Start discovering':'Explore without history';
 $('#settings-connection').textContent=state.account?`History for ${state.account} stays in this Chrome profile. Refresh it when your reading or viewing changes.`:'Connect your own Douban account to personalize your picks.';
}
function getItem(k){return mergeRecords(state.records,state.catalog).find(r=>key(r)===k);}
function sourceLink(item,label='View on Douban ↗'){return `<a href="${esc(item.url)}" target="_blank" rel="noreferrer">${label}</a>`;}
function picture(item,cls=''){
 const bundled=state.catalog.find(r=>key(r)===key(item)&&r.cover?.startsWith('artwork/'))?.cover;
 const cover=bundled||item.cover;
 return cover?`<img class="${cls}" src="${esc(cover)}" alt="${esc(item.title)} ${item.kind==='book'?'cover':'poster'}" referrerpolicy="no-referrer">`:'<span class="cover-fallback">Artwork unavailable</span>';
}
function quickFacts(item){return (item.kind==='book'?[item.published,item.pages?`${item.pages} pages`:'',item.publisher]:[item.year,item.duration,item.countries]).filter(Boolean).map(v=>`<span>${esc(v)}</span>`).join('');}
function metadata(item){return `<dl>${facts(item).map(([label,value])=>`<dt>${label}</dt><dd>${esc(value)}</dd>`).join('')}</dl>`;}
function evidenceMarkup(item){const r=evaluate(item,state.records);return `<details class="report-evidence"><summary>What this is based on</summary>${r.evidence.map(({record:x,signal,shared})=>`<div class="evidence">${sourceLink(x,esc(x.title)+' ↗')}<small>${esc(x.rating?`Your rating: ${x.rating}/5`:x.status==='wish'?'On your wish list · a tentative signal':'A signal from your comment')} · ${esc(shared.slice(0,3).join(' / '))}</small>${x.comment?`<blockquote lang="zh-CN">${esc(x.comment)}</blockquote>`:''}</div>`).join('')||'<p class="muted small">No close preference evidence yet. Treat this as an exploration.</p>'}</details>`;}
function card(item,mode='pick'){
 const saved=state.feedback[key(item)]==='save',intro=brief(item,state.records);
 return `<article class="pick-card" data-item="${key(item)}"><div class="cover-stage">${picture(item)}</div><div class="pick-body"><div class="kicker">${item.kind==='book'?'A BOOK TO GET LOST IN':'A STORY TO SPEND TIME WITH'} <span class="hairline"></span></div><h2 class="title" lang="zh-CN">${esc(item.title)}</h2>${item.originalTitle&&item.originalTitle!==item.title?`<p class="original-title">${esc(item.originalTitle)}</p>`:''}<p class="creator">${esc(item.creators?.join(' / ')||'Creator details unavailable')}${item.originalCreators?`<small>${esc(item.originalCreators)}</small>`:''}</p><div class="quick-facts">${quickFacts(item)}</div><div class="brief">${intro.map(s=>`<section class="brief-section"><h3>${s.label}</h3><p lang="zh-CN">${esc(s.text)}</p></section>`).join('')}</div><div class="source-line">${sourceLink(item)}<button data-deep="${key(item)}">Read the full introduction ↗</button></div></div>
 ${mode==='pick'?`<div class="detail-more"><details><summary>Edition & details</summary>${metadata(item)}</details></div><div class="decision-bar"><span class="decision-note">Does this feel like your kind of thing?</span><button class="secondary" data-decision="hide">Skip <span aria-hidden="true">→</span></button><button class="primary" data-decision="save"><span aria-hidden="true">♡</span> Interested</button></div>`:`<div class="detail-more"><details open><summary>Edition & details</summary>${metadata(item)}</details>${evidenceMarkup(item)}</div><div class="decision-bar"><span class="decision-note">${saved?'Kept for whenever you’re ready.':'Make room for a good possibility.'}</span><button class="secondary" data-library-toggle="${key(item)}">${saved?'Remove from My List':'Interested'}</button><button class="primary" data-deep="${key(item)}">Deep Dive ↗</button></div>`}</article>`;
}
async function hydrate(item,force=false){
 if(!force&&item.detailsVerified&&item.cover)return item;
 const {html}=await api('FETCH_SOURCE',{kind:item.kind,id:item.id});let parsed;
 try{parsed=DoubanParser.subject(new DOMParser().parseFromString(html,'text/html'),item.url);}catch{throw Error('Douban needs verification or this page is unavailable. Open the source page, then use “Use current Douban page”.');}
 if(!parsed.summary)throw Error('This page does not contain enough verified information for an introduction.');
 const updated={...item,...parsed};
 if(item.cover?.startsWith('artwork/'))updated.cover=item.cover;
 if(item.originalCreators)updated.originalCreators=item.originalCreators;
 if(item.editorial)updated.editorial=item.editorial;
 if(item.kind==='book'&&/^[\x00-\x7f]+$/.test(item.title)){updated.originalTitle ||= item.title;updated.originalCreators ||= updated.creators.filter(n=>/[A-Za-z]/.test(n)).join(' / ');}
 await api('SAVE_SUBJECT',{item:updated});await refresh();return getItem(key(updated))||updated;
}
function showPickError(item,error){$('#recommendation').innerHTML=`<div class="empty"><p class="eyebrow">YOUR PICK IS STILL HERE</p><h2>${esc(item?.title||'Unable to load your pick')}</h2><p>${esc(error.message)}</p><div class="button-row"><button id="retry-pick" class="secondary">Try again</button>${item?sourceLink(item,'Open source ↗'):''}</div>${item?'<button class="text-button" data-decision="hide">Skip this title</button>':''}</div>`;}
async function loadPick(supplied){
 const token=++pickRequest,requestedKind=kind;$('#recommendation').setAttribute('aria-busy','true');
 try{const item=supplied===undefined?(await api('DISCOVER',{kind:requestedKind})).item:supplied;if(token!==pickRequest)return;current=item;
 if(!item){$('#recommendation').innerHTML='<div class="empty"><p class="eyebrow">A LITTLE PAUSE</p><h2>You’ve explored these picks.</h2><p>Bring another title to Deep Dive. Verified titles and related works become part of future discoveries.</p><button class="primary" data-view="deep">Explore a title ↗</button></div>';return;}
 if(!item.detailsVerified||!item.cover)$('#recommendation').innerHTML=`<div class="empty">Checking the details for ${esc(item.title)}…</div>`;
 const ready=await hydrate(item);if(token!==pickRequest||kind!==requestedKind)return;current=ready;$('#recommendation').innerHTML=card(ready);
 }catch(e){if(token===pickRequest)showPickError(current,e);}finally{if(token===pickRequest)$('#recommendation').setAttribute('aria-busy','false');}
}
function renderLibrary(){const rows=savedItems(state,filter,$('#library-search').value);$('#library-list').innerHTML=rows.length?rows.map(r=>`<button class="library-row" data-detail="${key(r)}">${picture(r)}<span><span class="row-kind">${r.kind==='book'?'BOOK':'MOVIE'}</span><h3>${esc(r.title)}</h3><p class="row-meta">${esc(r.originalTitle||r.creators?.join(' / '))}</p></span><span class="row-arrow" aria-hidden="true">↗</span></button>`).join(''):`<div class="empty"><h2>${$('#library-search').value?'No matching titles.':'Your next favourites live here.'}</h2><p>${$('#library-search').value?'Try another title or author.':'Choose “Interested” on a recommendation to keep it. Open any saved title for its full details.'}</p></div>`;}
function showDetail(item){detail=item;$('#detail-content').innerHTML=card(item,'detail');view('details');window.scrollTo({top:0,behavior:'instant'});}
async function showReport(item){
 const token=++searchRequest;reportItem=item;view('deep');$('#deep-content').innerHTML=`<div class="empty">Preparing the full picture for ${esc(item.title)}…</div>`;
 try{const ready=await hydrate(item);if(token!==searchRequest)return;reportItem=ready;const report=deepDive(ready,state.records);
 $('#deep-content').innerHTML=`<article class="report"><div class="report-head">${picture(ready)}<div><p class="eyebrow">YOUR PERSONAL GUIDE</p><h2 lang="zh-CN">${esc(ready.title)}</h2><p>${esc(ready.originalTitle||ready.creators?.join(' / '))}</p></div></div><div class="report-body">${report.limited?'<p class="notice">Source details are limited. This guide separates verified information from reading or viewing advice.</p>':''}${report.sections.map((s,i)=>`<section class="report-section"><h3>${String(i+1).padStart(2,'0')} / ${s.label}</h3><p lang="zh-CN">${esc(s.text)}</p></section>`).join('')}${evidenceMarkup(ready)}<div id="model-result" aria-live="polite"></div></div><div class="report-actions">${sourceLink(ready)}<button class="secondary" data-library-toggle="${key(ready)}">${state.feedback[key(ready)]==='save'?'Saved in My List':'Interested'}</button>${state.model.enabled?'<button id="model-guide" class="primary">Generate model guide ↗</button>':''}</div></article>`;
 }catch(e){if(token===searchRequest)$('#deep-content').innerHTML=`<div class="empty"><h2>Let’s check the source.</h2><p>${esc(e.message)}</p>${sourceLink(item,'Open source ↗')}<p class="small">With the source page active, open this extension’s side panel and choose “Use current Douban page”.</p></div>`;throw e;}
}
async function search(e){
 e.preventDefault();const q=$('#query').value.trim();if(!q)return;const token=++searchRequest;
 $('#search-results').innerHTML='<p class="notice">Looking for the right edition…</p>';
 if(/^https?:/i.test(q)){const url=DoubanParser.subjectURL(q,q);if(!url)throw Error('Use a book.douban.com or movie.douban.com subject link.');const k=new URL(url).hostname.startsWith('book')?'book':'movie',id=url.match(/subject\/(\d+)/)[1],found=getItem(`${k}:${id}`);$('#search-results').innerHTML='';await showReport(found||{kind:k,id,title:'This title',url});return;}
 const k=$('#search-kind').value,local=mergeRecords(state.records,state.catalog).filter(r=>r.kind===k&&[r.title,r.originalTitle,...r.creators||[]].join(' ').toLowerCase().includes(q.toLowerCase()));
 let remote=[],error='';try{remote=await api('SEARCH',{kind:k,query:q});}catch(e){error=e.message;}
 if(token!==searchRequest)return;matches=mergeRecords(remote,local).slice(0,16);
 $('#search-results').innerHTML=`<p class="small muted">${matches.length?'Choose the exact title or edition.':'No matching title found. Try a different spelling or paste a Douban link.'}</p>${matches.map((r,i)=>`<button class="search-result" data-match="${i}"><span><strong>${esc(r.title)}</strong><small>${esc(r.meta?.slice(0,160)||r.originalTitle||'Open verified details')}</small></span><span>↗</span></button>`).join('')}${error?`<p class="notice">${esc(error)} You can still open a local match or paste a Douban link.</p>`:''}`;
}
document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;
 if(b.dataset.view)view(b.dataset.view);
 if(b.dataset.kind){kind=b.dataset.kind;choices('[data-kind]',kind,'kind');action(async()=>{await api('SET_KIND',{kind});await loadPick();});}
 if(b.dataset.filter){filter=b.dataset.filter;choices('[data-filter]',filter,'filter');renderLibrary();}
 if(b.dataset.detail){const item=getItem(b.dataset.detail);if(item)showDetail(item);}
 if(b.dataset.deep){const item=getItem(b.dataset.deep);if(item)action(()=>showReport(item),b);}
 if(b.dataset.match!==undefined)action(()=>showReport(matches[Number(b.dataset.match)]),b);
 if(b.dataset.decision)action(async()=>{
  const item=current;if(!item)return;const forKind=kind;$$('[data-decision]').forEach(n=>n.disabled=true);const {item:next}=await api('DECIDE',{kind:forKind,key:key(item),value:b.dataset.decision});await refresh();if(kind===forKind)await loadPick(next);toast(b.dataset.decision==='save'?'Added to My List.':'Skipped. Your next pick is ready.');
 },b);
 if(b.dataset.libraryToggle)action(async()=>{
  const k=b.dataset.libraryToggle,saved=state.feedback[k]==='save',isRemoval=saved&&!$('#details').hidden;
  if(saved&&!isRemoval){view('library');return;}
  await api('FEEDBACK',{key:k,value:isRemoval?'hide':'save'});await refresh();
  if(detail&&key(detail)===k&&!$('#details').hidden)showDetail(detail);
  if(reportItem&&key(reportItem)===k&&!$('#deep').hidden)b.textContent=isRemoval?'Interested':'Saved in My List';
  toast(isRemoval?'Removed from My List.':'Added to My List.');
 },b);
 if(b.id==='retry-pick')loadPick();
 if(b.id==='model-guide')action(async()=>{const item=reportItem,target=$('#model-result');target.innerHTML='<p class="notice">Writing your model guide…</p>';try{const r=await api('AI_ANALYZE',{item});if(reportItem!==item)return;target.innerHTML='<h3 class="eyebrow">MODEL INTERPRETATION</h3><div class="model-guide" lang="zh-CN"></div>';target.querySelector('.model-guide').textContent=r.text;}catch(e){target.textContent=e.message;throw e;}},b);
});
$('#library-search').oninput=renderLibrary;
$('#search-form').onsubmit=e=>action(()=>search(e),$('#search-button'));
$('#back-library').onclick=()=>view('library');$('#settings-button').onclick=()=>view('settings');
$('#expand').onclick=()=>action(()=>chrome.tabs.create({url:chrome.runtime.getURL('panel.html')}));
$('#capture').onclick=e=>action(async()=>{const r=await api('CAPTURE');if(!r.item)throw Error('Open a specific book or movie page first.');await refresh();await showReport(getItem(key(r.item))||r.item);},e.currentTarget);
$('#history-consent').onchange=renderSetup;
$('#connect-douban').onclick=e=>action(async()=>{await api('CONNECT_START');await refresh();},e.currentTarget);
$('#check-douban').onclick=e=>action(async()=>{await api('CONNECT_CHECK');await refresh();},e.currentTarget);
$('#sync-history').onclick=e=>action(async()=>{if(!$('#history-consent').checked)throw Error('Choose whether to use your history first.');await api('SYNC_START',{kind:'all'});await refresh();},e.currentTarget);
$('#stop-history').onclick=e=>action(async()=>{await api('SYNC_STOP');await refresh();},e.currentTarget);
$('#open-history').onclick=e=>action(()=>api('OPEN_SYNC_TAB'),e.currentTarget);
$('#finish-setup').onclick=e=>action(async()=>{await api('FINISH_SETUP');await refresh();view('discover');await loadPick();},e.currentTarget);
$('#clear-data').onclick=e=>action(async()=>{if(!window.confirm('Clear all Books & Movies data from this Chrome profile? This cannot be undone.'))return;await api('RESET');current=detail=reportItem=null;$('#history-consent').checked=false;$('#deep-content').textContent='';$('#search-results').textContent='';$('#detail-content').textContent='';$('#query').value='';$('#endpoint').value='';$('#model-name').value='';$('#api-key').value='';$('#model-consent').checked=false;await refresh();view('setup');},e.currentTarget);
$('#save-model').onclick=e=>action(async()=>{
 const enabled=$('#model-consent').checked,endpoint=$('#endpoint').value.trim(),model=$('#model-name').value.trim(),apiKey=$('#api-key').value.trim();
 if(enabled){let u;try{u=new URL(endpoint);}catch{throw Error('Enter a full HTTPS endpoint.');}if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('Use an HTTPS endpoint without credentials or query parameters.');if(!model)throw Error('Enter a model name.');const allowed=await chrome.permissions.request({origins:[u.origin+'/*']});if(!allowed)throw Error('Access to this provider was not granted.');}
 await api('SAVE_MODEL',{enabled,endpoint,model,apiKey});$('#api-key').value='';await refresh();toast('Connection saved.');
},e.currentTarget);
window.addEventListener('hashchange',()=>view(location.hash.slice(1)));
async function start(){try{await refresh();kind=state.viewKind||'book';choices('[data-kind]',kind,'kind');$('#endpoint').value=state.model.endpoint;$('#model-name').value=state.model.model;$('#model-consent').checked=state.model.enabled;view(location.hash.slice(1));if(state.onboardingComplete)await loadPick();}catch(e){$('#recommendation').innerHTML=`<div class="empty">${esc(e.message)}</div>`;toast(e.message);}}
if(inExtension)chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(['feedback','catalog','connection','job','records','account'].some(k=>changes[k]))refresh().catch(()=>{});});
start();
