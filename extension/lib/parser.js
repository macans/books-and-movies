/* Shared pure DOM parser, also exercised with linkedom in Node. */
(() => {
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const text = (el, selector) => clean(el.querySelector(selector)?.textContent);
  function subjectURL(raw, base) {
    try { const u = new URL(raw, base); return /^https:\/\/(book|movie)\.douban\.com\/subject\/\d+\/?$/.test(u.origin + u.pathname) ? u.origin + u.pathname.replace(/\/?$/, '/') : null; } catch { return null; }
  }
  function guard(doc) {
    const title = clean(doc.title || doc.querySelector('title')?.textContent);
    const body = clean(doc.body?.textContent).slice(0, 4000);
    if (/验证码|安全验证|异常请求|访问异常|403 Forbidden|429 Too Many|禁止访问|访问受限|机器人验证/.test(title + body) || doc.querySelector('#captcha_image, input[name="captcha-solution"]')) throw Error('豆瓣要求验证或限制访问，请在豆瓣页面处理后重新同步。');
    if (/登录豆瓣|登录 · 豆瓣|豆瓣登录/.test(title)) throw Error('需要登录豆瓣。请在豆瓣页面完成登录后重试。');
  }
  function identity(doc, rawURL) {
    guard(doc);
    const u=new URL(rawURL);
    if(!['book.douban.com','movie.douban.com'].includes(u.hostname)||u.protocol!=='https:')return null;
    const nav=doc.querySelector('#db-global-nav .nav-user-account');
    if(!nav)return null;
    const aliases=[...nav.querySelectorAll('a[href]')].map(a=>{
      try{const link=new URL(a.getAttribute('href'),u);return /^(www\.)?douban\.com$|^(book|movie)\.douban\.com$/.test(link.hostname)?link.pathname.match(/^\/people\/([A-Za-z0-9_-]{1,80})\/?$/)?.[1]:null;}catch{return null;}
    }).filter(Boolean);
    // /mine can render the signed-in shelf without redirecting to /people/ID.
    // Only this own-shelf route may use its collection navigation as identity.
    if(/^\/mine\/?$/.test(u.pathname)){
      const profile=doc.querySelector('#db-usr-profile')||doc;
      const own=[...profile.querySelectorAll('a[href]')].map(a=>{
        try{const link=new URL(a.getAttribute('href'),u);return link.origin===u.origin?link.pathname.match(/^\/people\/([A-Za-z0-9_-]{1,80})\/(?:collect|wish|do)\/?$/)?.[1]:null;}catch{return null;}
      }).filter(Boolean);
      const unique=[...new Set(own)];if(unique.length===1)aliases.unshift(unique[0]);
    }
    // This fallback is used only in the tab deliberately opened at /mine.
    const account=u.pathname.match(/^\/people\/([A-Za-z0-9_-]{1,80})\/?$/)?.[1]||aliases[0];
    return account?{account,aliases:[...new Set([account,...aliases])]}:null;
  }
  function collection(doc, rawURL) {
    guard(doc);
    const u = new URL(rawURL), match = u.pathname.match(/^\/people\/([^/]+)\/(collect|wish|do)\/?$/);
    if (!match || !['book.douban.com', 'movie.douban.com'].includes(u.hostname)) throw Error('不是受支持的豆瓣个人记录页。');
    const kind = u.hostname.startsWith('book') ? 'book' : 'movie';
    const items = [...doc.querySelectorAll('.subject-item, .grid-view > .item, .list-view > .item')];
    const records = items.map(item => {
      // Selector lists use document order, not selector priority: the first link
      // is often a cover image with neither text nor alt on signed-in shelves.
      const a = item.querySelector('h2 a[href*="/subject/"], .title a[href*="/subject/"]') || [...item.querySelectorAll('a[href*="/subject/"]')].find(a=>clean(a.getAttribute('title')||a.textContent||a.querySelector('img')?.getAttribute('alt')));
      const url = subjectURL(a?.getAttribute('href'), u.href);
      if (!url) return null;
      const title = clean(a.getAttribute('title') || a.textContent || item.querySelector('img')?.getAttribute('alt')).replace(/\s*\[可播放\].*$/, '');
      const ratingNode = item.querySelector('[class*="rating"][class*="-t"]');
      const rating = ratingNode?.className.match(/(?:^|\s)rating([1-5])-t(?:\s|$)/)?.[1];
      const date = text(item, '.date').match(/\d{4}-\d{2}-\d{2}/)?.[0] || null;
      const tags = text(item, '.tags').replace(/^标签[:：]?\s*/, '').split(/\s+/).filter(Boolean);
      return {id:url.match(/subject\/(\d+)/)[1],kind,title,url,status:match[2],rating:rating ? Number(rating) : null,date,tags,comment:text(item,'.comment'),meta:text(item,'.pub, .intro'),source:u.href,observedAt:new Date().toISOString()};
    }).filter(r => r && r.title);
    const heading = text(doc, 'h1');
    const total = Number(heading.match(/[（(](\d+)[)）]/)?.[1] ?? NaN);
    if (!records.length && total !== 0 && !/还没有|尚未|没有符合条件/.test(clean(doc.body?.textContent))) throw Error('未识别到记录，可能需要登录或豆瓣页面结构已改变；未清空旧数据。');
    let next = doc.querySelector('.paginator .next a, a[rel="next"]')?.getAttribute('href');
    if (next) { const n = new URL(next, u); next = n.origin === u.origin && n.pathname === u.pathname && Number(n.searchParams.get('start')) > Number(u.searchParams.get('start') || 0) ? n.href : null; }
    if (!next && records.length && Number.isFinite(total) && Number(u.searchParams.get('start') || 0) + records.length < total) throw Error('分页链接缺失，不能确认记录完整性。');
    return {kind,account:decodeURIComponent(match[1]),status:match[2],records,next:next || null,total:Number.isFinite(total)?total:null};
  }
  function subject(doc, rawURL) {
    guard(doc);
    const url = subjectURL(rawURL,rawURL);
    if (!url) throw Error('请输入豆瓣图书或电影的作品链接。');
    const kind = new URL(url).hostname.startsWith('book') ? 'book':'movie';
    const title = text(doc,'h1 [property="v:itemreviewed"]') || text(doc,'h1 span') || text(doc,'h1');
    if (!title) throw Error('无法识别作品，可能需要在豆瓣登录。');
    const info = doc.querySelector('#info');
    const lines = (info?.innerHTML || '').split(/<br\s*\/?\s*>/i).map(html => {
      const el = doc.createElement('div'); el.innerHTML = html; return clean(el.textContent);
    });
    const field = label => lines.find(s => s.startsWith(label + ':') || s.startsWith(label + ' :') || s.startsWith(label + '：'))?.replace(new RegExp('^' + label + '\\s*[:：]\\s*'), '') || '';
    const genres = [...doc.querySelectorAll('[property="v:genre"], #db-tags-section a, .tags-body a')].map(n=>clean(n.textContent));
    const authors = (field(kind === 'book' ? '作者' : '导演') || '').split(/\s+\/\s+/).filter(Boolean);
    const related = [...doc.querySelectorAll('#db-rec-section dl, .related_info .recommendations-bd dl')].map(dl=>{
      const a = [...dl.querySelectorAll('a')].find(a=>clean(a.textContent));
      const link = subjectURL(a?.getAttribute('href'),url);
      return link ? {id:link.match(/subject\/(\d+)/)[1],kind,title:clean(a.textContent),url:link,tags:[],meta:'',source:url,summary:'豆瓣相关作品；打开作品页可补充信息。'}:null;
    }).filter(Boolean);
    const cover = [doc.querySelector('#mainpic a')?.getAttribute('href'), doc.querySelector('meta[property="og:image"]')?.getAttribute('content'), doc.querySelector('#mainpic img')?.getAttribute('src')].find(v=>/^https:\/\/[^/]+\.doubanio\.com\//.test(v||'')) || '';
    const safeCover = /^https:\/\/[^/]+\.doubanio\.com\//.test(cover) ? cover : '';
    const introNodes = [...doc.querySelectorAll('#link-report .intro, .related_info .intro')];
    const summary = text(doc,'#link-report .all.hidden .intro, [property="v:summary"]') || clean(introNodes[0]?.textContent);
    const authorHeading = [...doc.querySelectorAll('h2')].find(n => /作者简介/.test(n.textContent));
    const authorIntro = clean(authorHeading?.nextElementSibling?.querySelector('.intro')?.textContent || authorHeading?.nextElementSibling?.textContent).replace(/\.intro p\{[^}]+\}/g,'');
    return {id:url.match(/subject\/(\d+)/)[1],kind,title,url,tags:[...new Set(genres)],creators:authors,meta:clean(info?.textContent),summary,cover:safeCover,
      originalTitle:field('原作名') || (kind==='movie' ? title.match(/(?:^|\s)([A-Za-z0-9][^\u3400-\u9fff]*)$/)?.[1] || '' : ''),
      subtitle:field('副标题'),publisher:field('出版社'),published:field('出版年'),pages:field('页数'),isbn:field('ISBN'),translators:field('译者'),
      year:text(doc,'h1 .year').replace(/[()]/g,''),duration:field('片长') || field('单集片长'),episodes:field('集数'),release:field('上映日期') || field('首播'),countries:field('制片国家/地区'),languages:field('语言'),cast:field('主演'),screenwriters:field('编剧'),aka:field('又名'),
      publicRating:text(doc,'[property="v:average"]'),authorIntro,toc:text(doc,'[id^="dir_"][id$="_full"]'),detailsVerified:true,source:url,observedAt:new Date().toISOString(),related};
  }
  globalThis.DoubanParser = {collection,subject,guard,subjectURL,identity};
})();
