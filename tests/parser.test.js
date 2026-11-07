import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';import '../extension/lib/parser.js';
const doc=html=>parseHTML(`<html><head><title>测试记录</title></head><body>${html}</body></html>`).document;
const base='https://book.douban.com/people/sample/collect';
const item=`<li class="subject-item"><h2><a href="https://book.douban.com/subject/123/" title="测试书">测试书 : 副标题</a></h2><div class="pub">测试作者 / 测试出版社</div><span class="rating5-t"></span><span class="date">2025-01-02 读过</span><span class="tags">标签: 科技 传记</span><p class="comment">很容易懂</p></li>`;
test('parses book record including personal rating, tags, date and comment',()=>{const r=DoubanParser.collection(doc(`<h1>读过的书(1)</h1><ul>${item}</ul>`),base);assert.equal(r.records[0].rating,5);assert.equal(r.records[0].title,'测试书');assert.deepEqual(r.records[0].tags,['科技','传记']);assert.equal(r.records[0].date,'2025-01-02');assert.equal(r.records[0].comment,'很容易懂');assert.equal(r.total,1);});
test('a blank cover link before the title cannot hide a signed-in collection record',()=>{
 const r=DoubanParser.collection(doc('<h1>Books (1)</h1><li class="subject-item"><div class="pic"><a href="https://book.douban.com/subject/123/"><img src="cover.jpg"></a></div><div class="info"><h2><a href="https://book.douban.com/subject/123/">Synthetic book title</a></h2><div class="pub">Example Author</div><span class="rating4-t"></span></div></li>'),base);
 assert.equal(r.records.length,1);assert.equal(r.records[0].title,'Synthetic book title');assert.equal(r.records[0].rating,4);
});
test('movie parser does not confuse public 10-point rating with personal star',()=>{const r=DoubanParser.collection(doc('<h1>看过的影视(1)</h1><div class="grid-view"><div class="item"><li class="title"><a href="https://movie.douban.com/subject/456/">测试片</a></li><span class="rating_nums">9.2</span><span class="date">2025-01-01</span></div></div>'),'https://movie.douban.com/people/sample/collect');assert.equal(r.records[0].rating,null);});
test('pagination relative links are resolved and monotonic',()=>{const r=DoubanParser.collection(doc(`<h1>读过的书(2)</h1>${item}<div class="paginator"><span class="next"><a href="?start=1">后页</a></span></div>`),base);assert.equal(r.next,base+'?start=1');});
test('missing pagination is explicit failure, never silently complete',()=>assert.throws(()=>DoubanParser.collection(doc(`<h1>读过的书(30)</h1>${item}`),base),/分页/));
test('empty collections are supported; structure changes fail safely',()=>{assert.equal(DoubanParser.collection(doc('<h1>读过的书(0)</h1>'),base).records.length,0);assert.throws(()=>DoubanParser.collection(doc('<h1>Unknown</h1>'),base),/未识别/);});
test('challenge blocks are explicit errors',()=>assert.throws(()=>DoubanParser.collection(doc('<h1>安全验证</h1>'),base),/验证/));
test('subject parser returns safe related items and summary',()=>{const r=DoubanParser.subject(doc('<h1><span property="v:itemreviewed">测试电影</span></h1><div id="info"><span property="v:genre">剧情</span></div><div id="link-report"><span property="v:summary">无剧透简介</span></div><div id="db-rec-section"><dl><a href="https://movie.douban.com/subject/789/">相关片</a></dl></div>'),'https://movie.douban.com/subject/456/');assert.equal(r.title,'测试电影');assert.equal(r.summary,'无剧透简介');assert.equal(r.related.length,1);});
test('non-Douban URLs are rejected',()=>assert.equal(DoubanParser.subjectURL('https://evil.test/subject/1/'),null));
test('book edition metadata includes original title and excludes translators from author',()=>{const r=DoubanParser.subject(doc('<h1><span>示例书</span></h1><div id="info"><span><span class="pl">作者</span>: Example Author</span><br><span class="pl">译者:</span> Translator<br><span class="pl">原作名:</span> The Example<br><span class="pl">页数:</span> 320<br><span class="pl">出版社:</span> Example Press<br></div><div id="link-report"><div class="intro">简介</div></div><div id="mainpic"><a href="https://img3.doubanio.com/view/subject/l/public/example.jpg"><img src="small.jpg"></a></div>'),'https://book.douban.com/subject/123/');assert.equal(r.originalTitle,'The Example');assert.deepEqual(r.creators,['Example Author']);assert.equal(r.translators,'Translator');assert.equal(r.pages,'320');assert.match(r.cover,/example.jpg$/);});
test('movie poster uses og image when the main image link goes to a gallery',()=>{const r=DoubanParser.subject(doc('<meta property="og:image" content="https://img3.doubanio.com/view/photo/public/example.jpg"><h1><span property="v:itemreviewed">示例 Example</span><span class="year">(2001)</span></h1><div id="mainpic"><a href="https://movie.douban.com/subject/456/photos"></a></div><div id="info"><span class="pl">导演</span>: Test Director<br><span class="pl">片长:</span> 100分钟<br></div>'),'https://movie.douban.com/subject/456/');assert.match(r.cover,/example.jpg$/);assert.equal(r.duration,'100分钟');assert.equal(r.year,'2001');});
test('movie summary supports the current report container and preserves numeric original titles',()=>{
 const {document}=parseHTML('<html><body><h1><span property="v:itemreviewed">示例电影 12 Sample People</span></h1><div id="link-report-intra"><span property="v:summary">十二个人讨论一个案例，尝试厘清证据。</span></div></body></html>');
 const item=DoubanParser.subject(document,'https://movie.douban.com/subject/123/');
 assert.equal(item.originalTitle,'12 Sample People');assert.equal(item.summary,'十二个人讨论一个案例，尝试厘清证据。');
});
test('own-account connection requires a signed-in navigation and supports numeric aliases',()=>{
 const d=doc('<div id="db-global-nav"><div class="nav-user-account"><a href="https://www.douban.com/people/12345/">My profile</a></div></div>');
 assert.deepEqual(DoubanParser.identity(d,'https://book.douban.com/people/example-reader/'),{account:'example-reader',aliases:['example-reader','12345']});
 assert.equal(DoubanParser.identity(doc('<h1>A public profile</h1>'),'https://book.douban.com/people/12345/'),null);
 assert.equal(DoubanParser.identity(d,'https://untrusted.example/people/12345/'),null);
});
test('the signed-in mine page can identify its own shelf without a redirect',()=>{
 const d=doc('<div id="db-global-nav"><div class="nav-user-account"><a href="https://accounts.douban.com/">Settings</a></div></div><div id="db-usr-profile"><a href="/people/example-reader/collect">Read</a><a href="/people/example-reader/wish">Wanted</a></div>');
 assert.deepEqual(DoubanParser.identity(d,'https://book.douban.com/mine'),{account:'example-reader',aliases:['example-reader']});
});
