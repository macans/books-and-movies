import {key,recommend,features} from './engine.js';

export function chooseCurrent(state,kind){
 if(!['book','movie'].includes(kind))throw Error('Choose Books or Movies.');
 const ranked=recommend(state.catalog,state.records,kind,state.feedback);
 const pinned=ranked.find(r=>key(r.item)===state.current?.[kind]);
 if(pinned)return pinned.item;
 const interested=state.catalog.filter(r=>r.kind===kind&&state.feedback[key(r)]==='save');
 const affinity=r=>interested.reduce((n,x)=>n+features(x).filter(t=>features(r.item).includes(t)).length,0)*.5;
 ranked.sort((a,b)=>Number(Boolean(b.item.detailsVerified&&b.item.cover))-Number(Boolean(a.item.detailsVerified&&a.item.cover)) || (b.score+affinity(b))-(a.score+affinity(a)));
 return ranked[0]?.item||null;
}

export function decide(state,kind,itemKey,value,now=Date.now()){
 if(!['save','hide'].includes(value)||!['book','movie'].includes(kind)||state.current?.[kind]!==itemKey)throw Error('This pick has already changed. Please use the current card.');
 return {feedback:{...state.feedback,[itemKey]:value},feedbackAt:{...state.feedbackAt,[itemKey]:now},current:{...state.current,[kind]:null}};
}
