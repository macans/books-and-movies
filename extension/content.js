(() => {
 let running=false,cancelled=false,controller;
 const send=msg=>chrome.runtime.sendMessage(msg);
 async function page(){
  try {
   if(/^\/subject\/\d+\/?$/.test(location.pathname)){const item=DoubanParser.subject(document,location.href);await send({type:'SUBJECT',item});}
   const identity=DoubanParser.identity(document,location.href);
   await send({type:'READY',identity});
  }catch{await send({type:'READY',error:true}).catch(()=>{});}
 }
 chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(sender.id!==chrome.runtime.id)return;
  if(msg.type==='CANCEL'){cancelled=true;controller?.abort();reply({ok:true});}
  if(msg.type==='CAPTURE'){
   try{reply({ok:true,data:location.pathname.startsWith('/subject/')?{item:DoubanParser.subject(document,location.href)}:DoubanParser.collection(document,location.href)});}catch(e){reply({ok:false,error:e.message});}
  }
  if(msg.type==='IDENTITY'){
   try{reply({ok:true,data:{identity:DoubanParser.identity(document,location.href),url:location.href}});}catch{reply({ok:false});}
  }
  if(msg.type==='SYNC'&&!running){running=true;cancelled=false;reply({ok:true});sync(msg).finally(()=>{running=false;});}
 });
 async function sync(job){
  try{
   DoubanParser.guard(document);
   if(!document.querySelector('#db-global-nav .nav-user-account'))throw Error('Sign in to Douban before refreshing your history.');
   const currentAccount=location.pathname.match(/^\/people\/([^/]+)\/collect\/?$/)?.[1];
   if(!(job.aliases||[job.account]).includes(currentAccount))throw Error('The account on this page does not match the connected account.');
   for(const status of ['collect','wish','do']){
    let url=`${location.origin}/people/${encodeURIComponent(currentAccount)}/${status}`, seen=new Set();
    while(url){
     if(cancelled)throw Error('同步已停止，已读取的数据仍保留。');
     if(seen.has(url)||seen.size>=1000)throw Error('分页循环或页数异常，同步已停止。');seen.add(url);
     let doc=document;
     if(url!==location.href.replace(/\/$/,'')){
      controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
      try{
       const res=await fetch(url,{credentials:'same-origin',signal:controller.signal});
       if(!res.ok)throw Error(`Douban returned HTTP ${res.status}.`);
       const ru=new URL(res.url);
       if(ru.origin!==location.origin||ru.pathname.replace(/\/$/,'')!==new URL(url).pathname)throw Error('Douban requires sign-in or verification.');
       const html=await res.text();doc=new DOMParser().parseFromString(html,'text/html');
      }finally{clearTimeout(timer);}
     }
     if(cancelled)throw Error('Refresh stopped.');
     const data=DoubanParser.collection(doc,url);
     const response=await send({type:'SYNC_BATCH',jobId:job.id,data});if(!response?.ok)throw Error(response?.error||'同步任务已结束。');
     url=data.next;
     await new Promise(resolve=>setTimeout(resolve,1800));
    }
   }
   await send({type:'SYNC_END',jobId:job.id});
  }catch(e){await send({type:'SYNC_END',jobId:job.id,error:e.message}).catch(()=>{});}
 }
 page();
})();
