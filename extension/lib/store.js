import {mergeRecords,key} from './engine.js';
export const DEFAULTS={account:'',accountAliases:[],accountVerified:false,onboardingComplete:false,connection:null,job:null,records:[],catalog:[],feedback:{},feedbackAt:{},current:{},viewKind:'book',coverage:{},catalogVersion:0,model:{endpoint:'',model:'',enabled:false}};
export async function readState(){
 const stored=await chrome.storage.local.get(Object.keys(DEFAULTS)),s={...DEFAULTS,...stored};
 const ids=new Set(s.records.map(key));
 s.records=mergeRecords(s.catalog.filter(r=>ids.has(key(r))),s.records);
 // Earlier local builds sometimes stored history without persisting its account.
 // Recover only a single explicit profile identity from that local history.
 if(!s.account&&s.records.length){
  const accounts=[...new Set(s.records.map(r=>String(r.source||'').match(/^https:\/\/(?:book|movie)\.douban\.com\/people\/([A-Za-z0-9_-]{1,80})\//)?.[1]).filter(Boolean))];
  if(accounts.length===1)s.account=accounts[0];
 }
 // Existing installations keep their locally stored history and choices.
 if(stored.onboardingComplete===undefined&&s.account&&s.records.length)s.onboardingComplete=true;
 return s;
}
export async function ensureCatalog(){
 const s=await readState();
 if(s.catalogVersion!==2){const res=await fetch(chrome.runtime.getURL('data/catalog.json'));if(!res.ok)throw Error('Could not load the collection.');const catalog=await res.json();await chrome.storage.local.set({catalog:mergeRecords(s.catalog,catalog),catalogVersion:2});}
}
