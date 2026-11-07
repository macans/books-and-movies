export const TYPES = {book:'书籍',movie:'影视'};
export const TOPICS = {
 '科技产业':/科技|芯片|半导体|硅谷|技术史|计算机|新能源|汽车|创新|智能|程序员|软件|架构|图灵|代码|源码|算法|并发|GPT|AI\b|C\+\+|Java|Python|STL|Hacker|Graphs|Networks/i,
 '人物传记':/传记|自传|马斯克|李飞飞|乔布斯|源代码|人生经历|人物/,
 '经济与社会':/经济|市场|贸易|制度|社会|现代化|政治|投资|金融|治理|商业|战争|历史/,
 '成长与心理':/心理|成长|自控|精力|习惯|沟通|认知|思维|学习|关系|强势|阅人/,
 '家庭与情感':/家庭|情感|亲情|爱情|妈妈|阿嬷|母亲|父亲|小鞋子/,
 '悬疑与犯罪':/悬疑|犯罪|推理|惊悚|教父|谎言|惊魂/,
 '现实与人性':/真实|现实|人性|纪实|纪录|普通人|小人物|社会|战争/,
 '科幻想象':/科幻|太空|未来|机器人|人工智能/,
 '喜剧与动画':/喜剧|动画|奇幻|喜感|幽默/,
 '文学':/文学|小说|散文|诗歌|红楼梦|挪威的森林|年少时光/,
 '数学与方法':/数学|微积分|几何|最优化|算法|Pyramid|Logic|Graphs/i,
};
export const key = r => `${r.kind}:${r.id}`;
export function normalize(r) {
 if(!r || !['book','movie'].includes(r.kind) || !/^\d+$/.test(String(r.id)) || !String(r.title||'').trim()) throw Error('记录缺少合法的类型、豆瓣 ID 或标题。');
 if(r.status && !['collect','wish','do'].includes(r.status)) throw Error('未知的记录状态。');
 if(r.rating != null && (!Number.isInteger(r.rating) || r.rating<1 || r.rating>5)) throw Error('个人评分须为 1–5 或 null。');
 const strings=v=>Array.isArray(v)?v.filter(t=>typeof t==='string').map(t=>t.slice(0,120)).slice(0,40):[];
 const cover=typeof r.cover==='string'&&(/^(?:artwork\/[\w.-]+\.(?:jpg|png|webp)|https:\/\/[^/]+\.doubanio\.com\/[^\s]+)$/.test(r.cover))?r.cover:'';
 return {...r,id:String(r.id),title:String(r.title).slice(0,300),url:`https://${r.kind}.douban.com/subject/${r.id}/`,cover,rating:r.rating??null,tags:strings(r.tags),subjectTags:strings(r.subjectTags),editorialTags:strings(r.editorialTags),creators:strings(r.creators),comment:String(r.comment||'').slice(0,5000),meta:String(r.meta||'').slice(0,5000),summary:String(r.summary||'').slice(0,8000)};
}
export function mergeRecords(old, incoming) {
 const map = new Map(old.map(r=>[key(r),r]));
 for (const raw of incoming) { const r=normalize(raw), prev=map.get(key(r));
  // History thumbnails must not replace artwork bundled with this exact edition.
  const cover=prev?.cover?.startsWith('artwork/')&&!r.cover.startsWith('artwork/')?prev.cover:r.cover||prev?.cover||'';
  map.set(key(r),{...prev,...r,cover,tags:r.tags.length?r.tags:prev?.tags||[],summary:r.summary||prev?.summary||'',meta:r.meta||prev?.meta||'',creators:r.creators.length?r.creators:prev?.creators||[],subjectTags:r.subjectTags.length?r.subjectTags:prev?.subjectTags||[],editorialTags:r.editorialTags.length?r.editorialTags:prev?.editorialTags||[]}); }
 return [...map.values()];
}
export function features(r) {
 const explicit=[...(r.tags||[]),...(r.subjectTags||[]),...(r.editorialTags||[])];
 const s=[r.title,r.meta,r.summary,...explicit].join(' ');
 return [...new Set([...explicit,...Object.entries(TOPICS).filter(([,rx])=>rx.test(s)).map(([t])=>t)])];
}
export function sentiment(r) {
 if(r.rating!=null) return {weight:(r.rating-3)/2,source:`个人评分 ${r.rating} 星`};
 if(r.status==='wish') return {weight:.15,source:'想读 / 想看，弱兴趣信号'};
 if(r.status==='do') return {weight:.2,source:'进行中，弱兴趣信号'};
 const s=r.comment||'';
 const bad=/不好看|没有可读性|组织.{0,3}乱|没什么感觉|浪费时间|不推荐|失望/.test(s);
 const good=/很好的|很真实|很容易懂|可读性很高|感人|有帮助|伟大|推荐|值得|很喜欢|很精彩/.test(s);
 return {weight:bad?-.65:good?.6:0,source:bad||good?'短评关键词推断（非星级）':'仅有完成记录，无明确好恶'};
}
export function profile(records, kind) {
 const rows=records.filter(r=>r.kind===kind), weights={}, exposure={};
 rows.forEach(r=>{const w=sentiment(r).weight;features(r).forEach(t=>{weights[t]=(weights[t]||0)+w;exposure[t]=(exposure[t]||0)+1;});});
 const topics=Object.keys(exposure).map(tag=>({tag,weight:weights[tag],count:exposure[tag]})).sort((a,b)=>b.weight-a.weight||b.count-a.count);
 return {kind,count:rows.length,rated:rows.filter(r=>r.rating!=null).length,commented:rows.filter(r=>r.comment).length,topics,rows};
}
export function evaluate(item, records) {
 const p=profile(records,item.kind), f=features(item), history=p.rows.find(r=>key(r)===key(item));
 const frequency=Object.fromEntries(p.topics.map(t=>[t.tag,t.count]));
 const weight=t=>(['剧情','美国','中国','日本','电影','经典','文学'].includes(t)?.2:1)*(1+Math.log((p.count+1)/((frequency[t]||0)+1)));
 const similarities=p.rows.filter(r=>key(r)!==key(item)&&!r.unavailable).map(r=>{
  const rf=features(r),shared=rf.filter(t=>f.includes(t)),union=[...new Set([...rf,...f])];
  const similarity=shared.reduce((n,t)=>n+weight(t),0)/(union.reduce((n,t)=>n+weight(t),0)||1);
  return {record:r,shared,signal:sentiment(r),similarity};
 }).filter(x=>x.shared.length).sort((a,b)=>Math.abs(b.signal.weight)*b.similarity-Math.abs(a.signal.weight)*a.similarity||b.similarity-a.similarity).slice(0,4);
 const pos=similarities.filter(x=>x.signal.weight>0),neg=similarities.filter(x=>x.signal.weight<0);
 const evidence=similarities.filter(x=>x.signal.weight!==0).length;
 const strength=similarities.filter(x=>x.signal.weight!==0).reduce((n,x)=>n+x.similarity,0);
 const value=similarities.reduce((n,x)=>n+x.similarity*x.signal.weight,0)/(strength||1);
 const hasInfo=Boolean(item.meta||item.summary);
 const score=Math.round(50+value*30*Math.min(1,strength/2)*(hasInfo?1:.25)+(history?.status==='wish'?3:0));
 const confidence=!hasInfo||evidence<2||strength<.5?'低':evidence>=3&&p.rated>=15&&strength>=1.5?'较高':'中';
 const verdict=history?.status==='collect'?'你已读 / 看过':history?.status==='do'?'你正在读 / 看':!hasInfo||!evidence?'信息不足，先了解':score>=62?'值得优先尝试':score<=42?'可以暂缓':'看当下的兴趣';
 const reasons=pos.map(x=>`与你${x.record.rating?`给 ${x.record.rating} 星的`:'有兴趣信号的'}《${x.record.title}》共享「${x.shared.slice(0,3).join('、')}」。`);
 if(!reasons.length)reasons.push('尚无足够的正向偏好证据；题材接近不代表一定喜欢。');
 const cautions=neg.map(x=>`《${x.record.title}》有负向反馈，而本作也涉及「${x.shared.slice(0,2).join('、')}」；需要核对具体差异。`);
 if(p.rows.some(r=>/组织.{0,3}乱|没有可读性/.test(r.comment))&&item.kind==='book')cautions.push('你在意内容结构：建议先看目录与试读，确认信息增量和组织方式。');
 if(p.rows.some(r=>/短半小时|拖沓|出戏/.test(r.comment))&&item.kind==='movie')cautions.push('你在意节奏和剧本可信度：先确认片长与叙事风格是否合乎当前心情。');
 if(confidence==='低')cautions.push('当前历史或作品信息不足，结论仅供探索；补充个人评分和作品详情后会更准确。');
 return {item,score,verdict,confidence,reasons,cautions,evidence:similarities,history,features:f};
}
export function recommend(catalog, records, kind, feedback={}, mode='match') {
 const excluded=new Set(records.filter(r=>r.status==='collect'||r.status==='do').map(key));
 const candidates=mergeRecords(catalog.filter(r=>r.kind===kind),records.filter(r=>r.kind===kind&&r.status==='wish'));
 const ranked=candidates.filter(r=>!r.unavailable&&!excluded.has(key(r))&&!['hide','save'].includes(feedback[key(r)])).map(r=>evaluate(r,records));
 ranked.sort((a,b)=>mode==='explore'?(a.evidence.length-b.evidence.length||b.score-a.score):(b.score-a.score||b.evidence.length-a.evidence.length));
 return ranked;
}
export function importBackup(data, expectedAccount) {
 if(data?.version!==1 || data.account!==expectedAccount || !Array.isArray(data.records)||data.records.length>30000) throw Error('备份格式或账号不匹配。需要 version: 1、正确 account 和 records 数组。');
 return data.records.map(normalize);
}

export function insights(records,kind) {
 const rows=records.filter(r=>r.kind===kind&&r.status==='collect'),out=[];
 const rules=kind==='book'?[
  [/组织.{0,4}乱|没有可读性|系统性学习/,'内容组织会影响你的评价','选择新书时，除了主题，也值得先检查目录和试读的结构。'],
  [/时效性|早知到|早知道/,'你在意技术知识的时效','技术类候选应同时核对出版时间、版本与当前适用范围。'],
  [/源码|基本特性|很容易懂|可读性很高/,'你重视可理解的技术细节','能讲清原理、连接概念和实践的内容，在你的短评中有正向线索。']
 ]:[
  [/硬伤|俗套|做作|没有剧情|故事设计的太大|有点出戏/,'剧情可信度是一个筛选条件','你对故事硬伤、刻意安排和缺乏情节有明确保留意见。'],
  [/短半小时|啰嗦|拖沓/,'节奏也会影响观看体验','即使认可作品，你仍会单独指出篇幅和节奏的问题。'],
  [/小人物|感人|很好的中文|细节处理/,'人物与细节能打动你','相比单纯题材接近，具体人物的可信度和情感表达更值得核对。']
 ];
 for(const [rx,title,description] of rules){const evidence=rows.filter(r=>rx.test(r.comment||'')).slice(0,3);if(evidence.length)out.push({title,description,evidence});}
 return out;
}
