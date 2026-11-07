import {evaluate,features,insights,key} from './engine.js';
const clip=(s,n)=>String(s||'').length>n?String(s).slice(0,n-1)+'…':String(s||'');
const shortTitle=r=>clip(r.title.split(' : ')[0],25);
export function brief(item,records){
 const report=evaluate(item,records),positive=report.evidence.filter(e=>e.signal.weight>0);
 const one=positive[0],two=positive[1];
 let why=one?`你${one.record.rating?`给《${shortTitle(one.record)}》评了${one.record.rating}星`:`对《${shortTitle(one.record)}》留下过兴趣线索`}，本作与它的联系在于${one.shared.slice(0,2).join('、')}。${two?`《${shortTitle(two.record)}》也提供了相近的线索。`:''}这是题材与内容层面的判断，实际体验仍要看具体表达。`:'它可以作为一次兴趣探索。目前没有足够明确的相近偏好证据，不能仅凭题材或大众评价断言你会喜欢。';
 const themes=features(item).filter(x=>!['剧情','美国','中国','经典'].includes(x)).slice(0,3);
 let about=item.editorial?.about||`《${item.title}》由${item.creators?.join('、')||'资料页列出的创作者'}${item.kind==='book'?'撰写':'执导'}。${themes.length?`资料涉及${themes.join('、')}等内容。`:''}${item.summary?`公开简介提供的切入点是「${clip(item.summary.replace(/\s+/g,''),38)}」。`:''}目前尚缺足够的已核实细节，建议先查阅作品原页再判断。`;
 let caution=item.editorial?.caution||(report.cautions[0]||'题材相近并不保证体验一致。建议结合目录与试读，或预告片和片长，判断它是否适合你现在的兴趣与时间安排。');
 about=clip(about,135);why=clip(why,100);caution=clip(caution,70);
 if((about+why+caution).length<205)why+='可以先把注意力放在作品实际提出的问题和展开方式，再决定是否投入完整的阅读或观看时间。';
 if((about+why+caution).length>300)why=clip(why,300-about.length-caution.length);
 return [{label:'The story',text:about},{label:'Why you',text:why},{label:'Before you start',text:caution}];
}
export function facts(item){
 return (item.kind==='book'?[
 ['Author',item.creators?.join(' / ')],['Original name',item.originalCreators],['Original title',item.originalTitle],['Publisher',item.publisher],['Published',item.published],['Length',item.pages?`${item.pages} pages`:''],['Translator',item.translators],['ISBN',item.isbn]
 ]:[['Director',item.creators?.join(' / ')],['Original name',item.originalCreators],['Original title',item.originalTitle],['Year',item.year],['Runtime',item.duration],['Episodes',item.episodes],['Country',item.countries],['Language',item.languages],['Cast',item.cast],['Release',item.release]]).filter(([,v])=>v&&v!=='-');
}
export function deepDive(item,records){
 const r=evaluate(item,records),isBook=item.kind==='book',verb=isBook?'阅读':'观看';
 const relevant=r.evidence.filter(e=>e.signal.weight!==0),positive=relevant.filter(e=>e.signal.weight>0),negative=relevant.filter(e=>e.signal.weight<0);
 const personal=insights(records,item.kind);
 const name=`《${item.title}》`,topic=features(item).filter(t=>!['剧情','电影','美国','中国','经典'].includes(t)).slice(0,4).join('、');
 const description=item.editorial?.about||brief(item,records)[0].text;
 const context=item.editorial?.context||`目前能够确认的内容线索是${topic||'作品页面给出的简介与基本资料'}。${item.summary?`简介的开端写道：「${clip(item.summary.replace(/\s+/g,''),38)}」。`:''}这只能用来确定作品的入口，不能据此推断全部内容、章节安排、结局或创作者意图。下面把已经确认的信息与针对你的阅读建议分开：事实以作品原页为依据，偏好判断来自你明确留下的评价。若需要逐章或逐段的内容概述，还需要更充分的资料。`;
 const meta=isBook?`${name}${item.creators?.length?`的作者是${item.creators.join('、')}`:''}。${item.originalCreators?`作者原文姓名为${item.originalCreators}。`:''}${item.originalTitle?`原作名为${item.originalTitle}。`:''}${item.publisher?`当前链接对应${item.publisher}${item.published?'于'+item.published+'出版':''}的版本`:''}${item.pages?`，共${item.pages}页`:''}。${item.translators?`译者信息为${item.translators}。`:''}选择时请以这个版本的目录、译文和篇幅为准；同名书或不同版本之间可能存在差异，不能把另一版本的资料直接套用。`:
 `${name}${item.year?`是${item.year}年的作品`:''}，${item.creators?.length?`导演为${item.creators.join('、')}`:'导演信息以原页为准'}。${item.originalTitle?`原片名为${item.originalTitle}。`:''}${item.duration?`标注片长为${item.duration}。`:''}${item.countries?`制片国家或地区为${item.countries}。`:''}${item.languages?`对白语言包括${item.languages}。`:''}${item.cast?`主要演员包括${clip(item.cast,80)}。`:''}这些信息可以帮助你确认具体版本和时间投入；同名改编、重拍以及不同剪辑版本应分开判断。`;
 const evidence=positive.slice(0,3).map(e=>{
  const x=e.record;return `你${x.rating?`给《${shortTitle(x)}》评了${x.rating}星`:`对《${shortTitle(x)}》表达过兴趣`}，与本作相连的线索是${e.shared.slice(0,3).join('、')}。${x.comment?`你当时写过「${clip(x.comment,48)}」。`:''}`;
 }).join('');
 const fit=evidence?`${evidence}这些记录使它成为值得考虑的候选，但相似题材并不保证相同体验：你可能喜欢的是某部作品清楚的结构、可信的人物或具体细节，而不是它所属类别中的所有作品。这里把个人评分当作较明确的好恶表达，把愿望单当作较弱的兴趣信号，不把“想读／想看”解释成已经喜欢。`:'目前没有足够明确的相近正向记录，所以不应把这部作品包装成已经确定适合你的选择。它更适合被视为一次有边界的探索：先确定自己对核心问题是否好奇，再用试读或预告验证表达方式。大众评价可以提供背景，却不能代替你的判断；类型标签也只能缩小范围，无法说明具体的节奏、论证或人物是否合你的口味。';
 const concerns=`${item.editorial?.caution||r.cautions[0]||'目前没有发现明确的负向偏好证据，这并不等于作品没有缺点。'}${negative.length?negative.slice(0,2).map(e=>`你对《${shortTitle(e.record)}》有过负向评价，而它与本作共享${e.shared.slice(0,2).join('、')}，需要留意具体差异。`).join(''):''}${personal[0]?`你的既往短评还提示：${personal[0].description}`:''}${isBook?'如果目录组织、论证深度或新信息的比例达不到预期，即使主题感兴趣，也可以换一本更聚焦的书。':'如果人物动机、叙事节奏或表达方式不合当前心情，即使题材吸引你，也可以暂缓观看。'}不必为了名气、评分或完成清单而坚持。`;
 const approach=item.editorial?.approach||(isBook?'先确认目录是否覆盖你最关心的问题，再选一节完整试读。读完后用自己的话复述作者提出了什么问题、用了什么证据、结论适用于什么条件；如果只能记住口号，或者核心信息与你已经掌握的内容高度重复，就值得暂缓。':'先看无剧透预告与基本资料，确认语言、片长和内容类型是否适合当下。开始观看后，关注人物的目标是否清楚、冲突如何形成、行动是否与既有性格一致；先建立自己的感受，再阅读影评，避免被预设解读替代体验。');
 const questions=isBook?'可以带着三个具体问题决定是否继续。第一，它补上了你已有知识的哪个空白，还是仅仅把熟悉的材料换一种讲法？第二，关键观点有没有可追踪的事实、案例或推理，哪些地方需要查证？第三，你能否将一个概念用自己的例子说明，同时说清适用边界？这三个问题比“有没有干货”更具体，也有助于区分信息、解释与作者的价值判断。遇到暂时不同意的观点，可以先记录证据，再决定是否接受。':'可以带着三个具体问题判断观看价值。第一，人物的选择是否由前面的细节支撑，还是主要依靠剧情需要推动？第二，影片的节奏与信息安排是否帮助你理解冲突，而不是只制造短暂刺激？第三，看完后留下的是具体人物、一个需要继续思考的问题，还是只有情节答案？这些问题不要求影片必须符合某种固定标准，而是帮你区分自己喜欢的是悬念、人物、情绪还是表达方式。';
 const conclusion=`结合现有线索，${r.confidence==='低'?'我的建议是先小范围尝试，暂不作强推荐':r.score>=62?'可以把它放到近期优先考虑的位置':r.score<=42?'可以暂缓，先寻找与你当前需求更贴近的作品':'它值得保留，但是否现在开始取决于你对核心内容的兴趣'}。${isBook?'如果试读后能明确指出一个新的问题或解释，继续阅读就有具体理由；若仍说不清期待获得什么，可以先放回书单。':'如果故事的入口已经引起你的好奇，而且可以接受它的时间与表达方式，就值得安排一次完整观看；否则可以先留在片单里。'}“感兴趣”只是保留一个未来选择，不是必须完成的承诺。以上建议会随着你之后的选择和明确反馈调整，也允许你对不同作品有看似矛盾但真实的喜好。`;
 const limits=`${item.detailsVerified?'基本信息来自已读取的豆瓣作品页。':'当前作品资料仍不完整。'}${item.editorial?'内容部分是依据简介与资料整理的无关键剧透概述，偏好部分是基于相关记录的分析判断。':'尚无充分资料支持完整的内容概述；本页侧重已知事实与选择建议，不将未知内容编写成结论。'}${isBook?'这里没有声称逐页核验全书，具体论点仍应通过试读和原文检验。':'这里没有将剧情片当作现实事件的完整记录，也不提前揭示关键转折。'}作品原页可用于核对版本、主创和最新资料。`;
 const sections=[['At a glance',meta.replace(/。\s*。/g,'。')],['What it explores',description+' '+context],['Why it may fit you',fit],['What may not work',concerns],['How to approach it',approach],['Questions worth keeping',questions],['The recommendation',conclusion],['Sources & boundaries',limits]].map(([label,text])=>({label,text}));
 return {sections,evidence:r.evidence,characters:sections.reduce((n,s)=>n+s.text.length,0),limited:!item.editorial};
}
export function savedItems(state,kind='all',query=''){
 const q=query.toLowerCase();return state.catalog.filter(r=>state.feedback[key(r)]==='save'&&(kind==='all'||r.kind===kind)&&[r.title,r.originalTitle,...r.creators||[]].join(' ').toLowerCase().includes(q)).sort((a,b)=>(state.feedbackAt[key(b)]||0)-(state.feedbackAt[key(a)]||0));
}
