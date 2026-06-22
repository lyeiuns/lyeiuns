
// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════
const PROXY = 'https://lyeiuns-proxy.jeezlebron123.workers.dev/api'; // CF Worker API proxy
// ── CLOUDFLARE IMAGE PROXY ──────────────────────────────────────────────────
// After deploying your worker, replace YOUR-NAME below with your CF subdomain
// e.g. 'https://lyeiuns-proxy.bob123.workers.dev'
const CF_PROXY = 'https://lyeiuns-proxy.jeezlebron123.workers.dev';
const CSAPI = CF_PROXY + '/csapi'; // routed through our CF worker to avoid CORS
const API = PROXY; // route MangaDex through CF proxy (adds CORS headers)
const USE_CF_PROXY = true; // Cloudflare Worker deployed ✅

function proxyImg(url) {
  if(!url) return null;
  if(USE_CF_PROXY) return CF_PROXY + '/img?url=' + encodeURIComponent(url);
  return url; // direct until proxy is deployed
}
// MangaDex API removed - using CSAPI (comix.to) exclusively


const GENRES = [
  {id:'391b0423-d847-456f-aff0-8b0cfc03066b',name:'Action'},
  {id:'87cc87cd-a395-47af-b27a-93258283bbc6',name:'Adventure'},
  {id:'4d32cc48-9f00-4cca-9b5a-a839f0764984',name:'Comedy'},
  {id:'5ca48985-9a9d-4bd8-be29-80dc0303db72',name:'Crime'},
  {id:'b9af3a63-f058-46de-a9a0-e0c13906197a',name:'Drama'},
  {id:'cdc58593-87dd-415e-bbc0-2ec27bf404cc',name:'Fantasy'},
  {id:'cdad7e68-1419-41dd-bdce-27753074a640',name:'Historical'},
  {id:'aafb99c1-7f60-43fa-b75f-fc9502ce29c7',name:'Horror'},
  {id:'7064a261-a137-4d3a-8848-2d385de3a99c',name:'Isekai'},
  {id:'f8f62932-27da-4fe4-8ee1-6779a8c5edba',name:'Psychological'},
  {id:'423e2eae-a7a2-4a8b-ac03-a8351462d71d',name:'Romance'},
  {id:'256c8bd9-4904-4360-bf4f-508a76d67183',name:'Sci-Fi'},
  {id:'07251805-a27e-4d59-b488-f0bfbec15168',name:'Slice of Life'},
  {id:'69964a64-2f90-4d33-beeb-f3ed2875eb4c',name:'Sports'},
  {id:'7b2ce280-79ef-4c09-9b58-12b7c23a9b78',name:'Superhero'},
  {id:'31932a7e-5b8e-49a6-9f12-2afa39dc544f',name:'Thriller'},
  {id:'1fad68d1-5d06-4b7f-ae77-24d5f9a8f5b1',name:'Tragedy'},
];
const THEMES_MAP = [
  {id:'891cf039-b895-47f0-9229-bef4c96eccd4',name:'Martial Arts'},
  {id:'799c202e-7daa-44eb-9cf7-8a3c0441531e',name:'Mecha'},
  {id:'2d1f5d56-a1e5-4d0d-a961-2193588b08ec',name:'Military'},
  {id:'489dd859-9b61-4c37-af75-5b18e88daafc',name:'Ninja'},
  {id:'0bc90acb-ccc1-44ca-a34a-b9f855d7f8b6',name:'Reincarnation'},
  {id:'eabc5b4c-d38e-4d0e-9b16-f0a74ecd700e',name:'Survival'},
  {id:'5bd0e105-4481-44ca-b6e7-7544da56b1a3',name:'Time Travel'},
  {id:'292e862b-2d17-4062-90a2-0356caa4ae27',name:'Vampires'},
  {id:'b13b2a48-c720-44a9-9c77-39c9979373fb',name:'Villainess'},
  {id:'9467335a-1b83-4497-9231-765f1072e0ee',name:'Demons'},
  {id:'dd1f77c5-dea9-4e2b-97ae-224af09caf99',name:'Monsters'},
];

const THEMES_SETTINGS = {
  dark:  {bg:'#07070d',surface:'#0f0f18',surface2:'#16161f',border:'#23232f',text:'#ededf5',muted:'#64647a',tag:'#131320'},
  amoled:{bg:'#000000',surface:'#080808',surface2:'#111111',border:'#1a1a1a',text:'#ededf5',muted:'#5a5a6a',tag:'#0a0a0a'},
  light: {bg:'#f0f0f5',surface:'#ffffff',surface2:'#f5f5fa',border:'#dddde8',text:'#1a1a2e',muted:'#7070a0',tag:'#e8e8f5'},
};

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════
function load(key, def) { try { return JSON.parse(localStorage.getItem(key)) || def; } catch(e) { return def; } }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {} }

const S = {
  library: load('lyeiuns-library', []),
  history_items: load('lyeiuns-history', []),
  custom_lists: load('lyeiuns-lists', []),
  settings: load('lyeiuns-settings', {theme:'dark',accent:'#7c3aed',accent2:'#a855f7',direction:'ltr',imageFit:'width',fontSize:16,safeMode:true}),
  currentManga: null,
  currentChapters: [],
  currentChIdx: -1,
  pageHistory: [],
  filterCtx: 'home',
  pendingTags: [],
  pendingType: '',
  homeFilters: {tags:[],type:''},
  searchFilters: {tags:[],type:''},
  popularLang: '',
  bannerData: [],
  bannerIdx: 0,
  bannerTimer: null,
};

// ═══════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════
function getCover(m) {
  const r = (m.relationships||[]).find(x=>x.type==='cover_art');
  const fn = r && r.attributes && r.attributes.fileName;
  if(!fn) return null;
  // Route through the CF image proxy — MangaDex blocks direct hotlinking from other origins
  return CF_PROXY + '/img?url=' + encodeURIComponent(`https://uploads.mangadex.org/covers/${m.id}/${fn}.512.jpg`);
}
function getTitle(m) {
  const t = m.attributes?.title || {};
  // Prefer English, then romanized, then check altTitles
  if(t.en) return t.en;
  if(t['ja-ro']) return t['ja-ro'];
  if(t['ko-ro']) return t['ko-ro'];
  if(t['zh-ro']) return t['zh-ro'];
  // Check altTitles for English
  const alts = m.attributes?.altTitles || [];
  for(const alt of alts) {
    if(alt.en) return alt.en;
  }
  // Check altTitles for romanized
  for(const alt of alts) {
    if(alt['ja-ro'] || alt['ko-ro']) return alt['ja-ro'] || alt['ko-ro'];
  }
  // Fall back to any Latin script title
  const latinKeys = Object.keys(t).filter(k => !['ja','ko','zh','th','ar','he','ru'].includes(k));
  if(latinKeys.length) return t[latinKeys[0]];
  // Last resort - any title
  return Object.values(t)[0] || 'Unknown';
}

function getOriginalTitle(m) {
  const t = m.attributes?.title || {};
  // Return non-English original title if different from English
  const eng = getTitle(m);
  const orig = t.ja || t.ko || t.zh || null;
  return (orig && orig !== eng) ? orig : null;
}
function getType(m) {
  const o = m.attributes?.originalLanguage;
  if(o==='ko') return 'Manhwa';
  if(o==='zh'||o==='zh-hk') return 'Manhua';
  return 'Manga';
}
function timeAgo(d) {
  if(!d) return '';
  const days = Math.floor((Date.now()-new Date(d))/86400000);
  if(days===0) return 'Today';
  if(days===1) return 'Yesterday';
  if(days<7) return days+'d ago';
  if(days<30) return Math.floor(days/7)+'w ago';
  return Math.floor(days/30)+'mo ago';
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2500);
}
function esc(s) { return String(s).replace(/'/g,"\\'").replace(/"/g,'&quot;'); }

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
function showPage(name) {
  // Activate page
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  var pg = document.getElementById('page-' + name);
  if(pg) pg.classList.add('active');
  window.scrollTo(0, 0);

  // Bottom nav active state (ALL 5 tabs)
  ['home','search','library','profile','lists'].forEach(function(p) {
    var b = document.getElementById('bnav-' + p);
    if(b) b.classList.toggle('active', p === name);
  });

  // Side nav
  ['home','search','library','profile','lists'].forEach(function(p) {
    var b = document.getElementById('snav-' + p);
    if(b) b.classList.toggle('active', p === name);
  });

  // Bottom nav visibility
  var bNav = document.getElementById('bottom-nav');
  var inReader = (name === 'reader');
  if(bNav) { bNav.style.display = inReader ? 'none' : 'flex'; }

  // Reader-specific UI
  var rNav = document.getElementById('reader-nav');
  var rProg = document.getElementById('reader-progress');
  var sNav = document.getElementById('side-nav');
  if(rNav) rNav.classList.remove('visible');
  if(rProg) rProg.style.display = inReader ? 'block' : 'none';
  if(sNav) { sNav.style.opacity = inReader ? '0' : '1'; sNav.style.pointerEvents = inReader ? 'none' : 'all'; }

  // Reader header
  var rHdr = document.getElementById('reader-header-ui');
  if(rHdr) rHdr.classList.remove('visible');

  // Source bar
  var bar = document.getElementById('source-bar');
  if(bar) bar.style.display = inReader ? 'none' : 'flex';

  // Page-specific actions
  if(name === 'lists') renderLists();
  if(name === 'profile') { setTimeout(function(){ renderProfile(); }, 50); }
  if(name === 'library') renderLibrary();

  // Nav pill
  updateNavPill(name);
}

function navigate(page) {
  const cur = document.querySelector('.page.active')?.id?.replace('page-','');
  if(cur && cur!==page) S.pageHistory.push(cur);
  showPage(page);
}

function goBack() {
  const prev = S.pageHistory.pop();
  if(prev) showPage(prev);
  else showPage('home');
}

// ═══════════════════════════════════════════
// CARD RENDER
// ═══════════════════════════════════════════
function renderCard(m) {
  const cover = getCover(m);
  const title = getTitle(m);
  const type = getType(m);
  return `<div class="manga-card" onclick="openDetail('${esc(m.id)}')">
    <div class="manga-cover">
      ${cover?`<img src="${cover}" alt="" loading="lazy" onerror="this.src=this.src.includes('.512.')?this.src.replace('.512.','.256.'):this.parentElement.innerHTML='<div class=\'manga-cover-placeholder\'>${esc(title)}</div>'">`:`<div class="manga-cover-placeholder">${title}</div>`}
      <div class="manga-badge">${type}</div>
    </div>
    <div class="manga-info">
      <div class="manga-title">${title}</div>
      <div class="manga-sub">${m.attributes?.status||''}</div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════
// BANNER
// ═══════════════════════════════════════════
// ── MangaDex list helpers ───────────────────────────────────────────────────
const MD_BASE = API + '/manga?includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&hasAvailableChapters=true&availableTranslatedLanguage[]=en';
async function mdList(extra) {
  const res = await fetch(MD_BASE + (extra||''));
  if(!res.ok) throw new Error('status '+res.status);
  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}
function mdCard(m, badge) {
  const cov = getCover(m) || '';
  return '<div class="manga-card" onclick="openDetail(\'' + m.id + '\')">' +
    '<div class="manga-cover"><img src="' + cov + '" alt="" loading="lazy" onerror="this.style.opacity=0.3">' +
    (badge ? '<div class="manga-badge">' + badge + '</div>' : '') + '</div>' +
    '<div class="manga-info"><div class="manga-title">' + getTitle(m) + '</div>' +
    '<div class="manga-sub">' + getType(m) + '</div></div></div>';
}

async function loadBanner() {
  const el = document.getElementById('banner-carousel');
  if(!el) return;
  try {
    const items = await mdList('&order[followedCount]=desc&limit=8');
    if(!items.length) throw new Error('empty');
    S.bannerData = items;
    let cur = 0;
    function show(i) {
      const m = items[i];
      const cov = getCover(m) || '';
      el.innerHTML =
        '<div class="banner-slide" style="background-image:url(' + cov + ')" onclick="openDetail(\'' + m.id + '\')">' +
        '<div class="banner-overlay"></div><div class="banner-content">' +
        '<div class="banner-badge">' + getType(m) + '</div>' +
        '<div class="banner-title">' + getTitle(m) + '</div>' +
        '<button class="banner-btn" onclick="event.stopPropagation();openDetail(\'' + m.id + '\')">Read Now</button>' +
        '</div><div class="banner-dots">' + items.map((_,j)=>'<div class="banner-dot'+(j===i?' active':'')+'" onclick="event.stopPropagation();showBannerSlide('+j+')"></div>').join('') + '</div></div>';
    }
    window.showBannerSlide = function(i){ cur=i; show(i); };
    show(0);
    if(window._bt) clearInterval(window._bt);
    window._bt = setInterval(()=>{ cur=(cur+1)%items.length; show(cur); }, 5000);
  } catch(e) {
    console.error('Banner error:', e.message);
    el.innerHTML = '<div style="height:160px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px;text-align:center;padding:20px">Banner unavailable<br><span style="font-size:10px;opacity:0.5">'+e.message+'</span></div>';
  }
}
function goBanner(i) {
  S.bannerIdx=i;
  document.querySelectorAll('.banner-slide').forEach((s,j)=>s.classList.toggle('active',j===i));
  document.querySelectorAll('.banner-dot').forEach((d,j)=>d.classList.toggle('active',j===i));
  clearInterval(S.bannerTimer);
  S.bannerTimer=setInterval(()=>goBanner((S.bannerIdx+1)%S.bannerData.length),4500);
}

// ═══════════════════════════════════════════
// CONTINUE READING
// ═══════════════════════════════════════════
function renderContinue() {
  const sec=document.getElementById('continue-section');
  const grid=document.getElementById('continue-grid');
  if(!S.history_items.length){sec.style.display='none';return;}
  sec.style.display='block';
  grid.innerHTML=S.history_items.slice(0,4).map(h=>`
    <div class="continue-card" onclick="openDetail('${esc(h.id)}')">
      <img class="continue-cover" src="${h.cover||''}" alt="" onerror="this.style.display='none'">
      <div class="continue-info">
        <div class="continue-title">${h.title}</div>
        <div class="continue-ch">Chapter ${h.chapterNum}</div>
        <div class="continue-time">${timeAgo(new Date(h.ts).toISOString())}</div>
      </div>
      <div style="color:var(--accent2);font-size:20px;flex-shrink:0">›</div>
    </div>`).join('');
}

// ═══════════════════════════════════════════
// POPULAR / TABS
// ═══════════════════════════════════════════
function buildUrl(base, filters) {
  let url=base;
  if(filters.type) url+=`&originalLanguage[]=${filters.type}`;
  (filters.tags||[]).forEach(id=>{url+=`&includedTags[]=${id}`;});
  return url;
}

// Popular time period filter
let popularPeriod = 'all'; // 'week' | 'month' | 'all'

function setPopularPeriod(period, el) {
  popularPeriod = period;
  document.querySelectorAll('.pop-period-btn').forEach(b => b.classList.remove('active'));
  if(el) el.classList.add('active');
  loadPopular();
}

async function loadPopular(typeFilter) {
  const el = document.getElementById('popular-grid');
  if(!el) return;
  el.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading...</span></div>';
  try {
    let extra = '&order[followedCount]=desc&limit=30';
    if(S.popularLang) extra += '&originalLanguage[]=' + S.popularLang;
    const items = await mdList(extra);
    if(!items.length) throw new Error('empty');
    el.innerHTML = items.map(m=>mdCard(m,'Popular')).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty"><p>Failed to load</p><button onclick="loadPopular()" style="margin-top:8px;padding:6px 16px;background:var(--accent);border:none;color:white;cursor:pointer;border-radius:6px">↺ Retry</button></div>';
  }
}

async function loadRecent() {
  const el = document.getElementById('recent-grid');
  if(!el) return;
  try {
    const items = await mdList('&order[createdAt]=desc&limit=24');
    el.innerHTML = items.map(m=>mdCard(m,'New')).join('') || '<div class="empty"><p>Nothing here</p></div>';
  } catch(e) {}
}

function switchTab(lang,el) {
  document.querySelectorAll('.home-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  S.popularLang = lang==='all'?'':lang;
  loadPopular();
}

// ═══════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════
// Search result cache to avoid duplicate API calls
const searchCache = {};

async function doSearch(query) {
  if(!query || !query.trim()) return;
  navigate('search');
  const q = query.trim();
  document.getElementById('main-search').value = q;
  const el = document.getElementById('search-results');
  if(!el) return;

  // Use cached results if available (avoids double API call from suggestions)
  if(searchCache[q]) {
    el.innerHTML = searchCache[q];
    return;
  }

  el.innerHTML = '<div class="loading"><div class="spinner"></div><span>Searching...</span></div>';
  try {
    let url = API + '/manga?limit=24&title=' + encodeURIComponent(q) + '&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive';
    url = buildUrl(url, S.searchFilters);
    const res = await fetch(url);
    if(!res.ok) throw new Error('Status ' + res.status);
    const data = await res.json();
    const html = data.data && data.data.length
      ? data.data.map(renderCard).join('')
      : '<div class="empty"><div class="empty-icon">😶</div><h3>No results for "' + q + '"</h3><p>Try different keywords</p></div>';
    searchCache[q] = html;
    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = getChibiEmpty('shrug','Search Failed','Check connection and retry');
  }
}

// ═══════════════════════════════════════════
// DETAIL
// ═══════════════════════════════════════════
async function openDetail(id) {
  navigate('detail');
  document.getElementById('chapter-list').innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading...</span></div>';
  try {
    const res = await fetch(API + `/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist`);
    const data = await res.json();
    const m = data.data;
    S.currentManga = m;

    const cover = getCover(m);
    const title = getTitle(m);
    const origTitle = getOriginalTitle(m);
    const type = getType(m);
    const desc = m.attributes?.description?.en || Object.values(m.attributes?.description||{})[0] || 'No description available.';
    const tags = m.attributes?.tags?.slice(0,10).map(t => t.attributes?.name?.en || '').filter(Boolean) || [];
    const status = m.attributes?.status || '';
    const year = m.attributes?.year || '';
    const author = m.relationships?.find(r => r.type === 'author')?.attributes?.name || '';

    // Cover + backdrop
    const coverImg = document.getElementById('detail-cover-img');
    const backdrop = document.getElementById('detail-backdrop');
    if(coverImg) coverImg.src = cover || '';
    if(backdrop) backdrop.style.backgroundImage = cover ? `url(${cover})` : '';

    // Title with original below
    const titleEl = document.getElementById('detail-title');
    if(titleEl) {
      titleEl.innerHTML = esc(title) + (origTitle ? `<div style="font-size:13px;color:var(--muted);font-family:'Zen Kaku Gothic New',sans-serif;margin-top:4px;font-weight:400;letter-spacing:1px">${esc(origTitle)}</div>` : '');
    }

    // Type + meta
    const typeEl = document.getElementById('detail-type');
    if(typeEl) typeEl.textContent = type;

    // Author + year + status row
    const metaEl = document.getElementById('detail-meta');
    if(metaEl) {
      metaEl.innerHTML = [
        author ? `<span class="meta-pill">✍️ ${esc(author)}</span>` : '',
        year ? `<span class="meta-pill">📅 ${year}</span>` : '',
        status ? `<span class="meta-pill ${status === 'ongoing' ? 'green' : ''}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>` : '',
      ].filter(Boolean).join('');
    }

    // Description
    const descEl = document.getElementById('detail-desc');
    if(descEl) descEl.textContent = desc;

    // Tags
    const tagsEl = document.getElementById('detail-tags');
    if(tagsEl) tagsEl.innerHTML = tags.map(t => `<span class="tag">${t}</span>`).join('');

    // Reading status
    const sel = document.getElementById('reading-status-select');
    if(sel) sel.value = getReadingStatus ? getReadingStatus(id) : '';

    // Chapters
    const chapRes = await fetch(API + `/manga/${id}/feed?limit=500&translatedLanguage[]=en&order[chapter]=desc&contentRating[]=safe&contentRating[]=suggestive`);
    const chapData = await chapRes.json();
    // Keep only chapters actually hosted on MangaDex (drop external/licensed links with no pages)
    S.currentChapters = (chapData.data || []).filter(function(ch){
      const a = ch.attributes || {};
      if(a.externalUrl) return false;          // hosted on another official site, no pages here
      if(a.pages === 0) return false;          // no page images
      return true;
    });

    const chList = document.getElementById('chapter-list');
    if(!S.currentChapters.length) {
      const googleUrl = 'https://google.com/search?q=' + encodeURIComponent(title + ' manga read english');
      chList.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><h3>No English Chapters</h3><p>Try finding it on a scanlation site</p>' +
        '<a href="' + googleUrl + '" target="_blank" style="display:inline-block;margin-top:12px;padding:8px 20px;background:var(--manga-red);color:white;border-radius:0;font-family:Bebas Neue,sans-serif;letter-spacing:2px;font-size:14px;text-decoration:none">SEARCH GOOGLE</a></div>';
      return;
    }

    // Progress indicator
    const readCount = S.currentChapters.filter(ch => isChRead(ch.id)).length;
    const total = S.currentChapters.length;
    const progressHtml = readCount > 0
      ? `<div style="padding:8px 0 12px;font-size:11px;color:var(--muted);font-family:'Zen Kaku Gothic New',sans-serif">
          Read <span style="color:var(--manga-red);font-weight:600">${readCount}</span> of <span style="color:var(--text)">${total}</span> chapters
          <div style="height:2px;background:var(--border);margin-top:6px;border-radius:1px"><div style="height:100%;width:${Math.round(readCount/total*100)}%;background:var(--manga-red);border-radius:1px"></div></div>
        </div>` : `<div style="padding:4px 0 12px;font-size:11px;color:var(--muted)">${total} chapters available</div>`;

    chList.innerHTML = progressHtml + S.currentChapters.map(function(ch, i) {
      const read = isChRead(ch.id);
      const num = ch.attributes?.chapter || '?';
      const chTitle = ch.attributes?.title || '';
      const date = timeAgo(ch.attributes?.publishAt);
      const chId = esc(ch.id);
      const chNum = esc(num);
      return '<div class="chapter-item' + (read ? ' read' : '') + '" onclick="openChapter(&#39;' + chId + '&#39;,&#39;' + chNum + '&#39;,' + i + ')">' +
        '<div class="chapter-num">CH ' + num + '</div>' +
        '<div class="chapter-name">' + (chTitle || 'Chapter ' + num) + '</div>' +
        '<div class="chapter-date">' + date + '</div>' +
        '<div class="ch-read-dot"></div></div>';
    }).join('');

  } catch(e) {
    document.getElementById('chapter-list').innerHTML = '<div class="empty"><div class="empty-icon">😵</div><h3>Failed to load</h3><button onclick="openDetail(&#39;' + id + '&#39;)" style="margin-top:8px;padding:6px 20px;background:var(--accent);border:none;color:white;cursor:pointer;font-family:Bebas Neue,sans-serif;letter-spacing:2px">↺ RETRY</button></div>';
  }
}

function readFirst() {
  if(!S.currentChapters.length) return;
  const last=S.currentChapters[S.currentChapters.length-1];
  openChapter(last.id,last.attributes?.chapter||'?',S.currentChapters.length-1);
}

// ═══════════════════════════════════════════
// READER
// ═══════════════════════════════════════════
async function openChapter(chapterId,chapterNum,idx) {
  S.currentChIdx=idx;
  navigate('reader');
  const title=S.currentManga?getTitle(S.currentManga):'';
  document.getElementById('reader-title').textContent=`${title} — Ch. ${chapterNum}`;
  document.getElementById('reader-ch-info').textContent=`CH ${chapterNum}`;
  document.getElementById('prev-btn').disabled=idx>=S.currentChapters.length-1;
  document.getElementById('next-btn').disabled=idx<=0;
  document.getElementById('reader-images').innerHTML='<div class="loading"><div class="spinner"></div><span>Loading pages...</span></div>';
  document.getElementById('reader-progress').style.width='0%';

  // save history
  if(S.currentManga){
    const entry={id:S.currentManga.id,title:getTitle(S.currentManga),cover:getCover(S.currentManga),chapterNum,ts:Date.now()};
    S.history_items=S.history_items.filter(h=>h.id!==entry.id);
    S.history_items.unshift(entry);
    if(S.history_items.length>20) S.history_items=S.history_items.slice(0,20);
    save('lyeiuns-history',S.history_items);
    renderContinue();
  }

  try {
    const _ch = (S.currentChapters||[]).find(function(c){return c.id===chapterId;});
    if(_ch && _ch.attributes && _ch.attributes.externalUrl){
      document.getElementById('reader-images').innerHTML='<div class="empty"><p>This chapter is hosted on an official external site.</p><a href="'+_ch.attributes.externalUrl+'" target="_blank" style="display:inline-block;margin-top:12px;padding:8px 20px;background:var(--manga-red);color:#fff;text-decoration:none">OPEN OFFICIAL PAGE</a></div>';
      return;
    }
    const res=await fetch(API + `/at-home/server/${chapterId}`);
    const data=await res.json();
    const pages=data.chapter?.data||[];
    if(!pages.length){document.getElementById('reader-images').innerHTML='<div class="empty"><p>No pages</p></div>';return;}
    const base=data.baseUrl,hash=data.chapter?.hash;
    document.getElementById('reader-images').style.direction=S.settings.direction||'ltr';
    document.getElementById('reader-images').innerHTML=pages.map(p=>`<img src="${CF_PROXY}/img?url=${encodeURIComponent(base+'/data/'+hash+'/'+p)}" alt="" loading="lazy">`).join('');
    // scroll progress
    window.onscroll=function(){
      const prog=document.getElementById('reader-progress');
      if(prog&&prog.style.display!=='none'){
        const pct=Math.min(100,(window.scrollY/(document.documentElement.scrollHeight-window.innerHeight))*100);
        prog.style.width=pct+'%';
      }
    };
    // zoom on dblclick
    document.getElementById('reader-images').ondblclick=function(e){
      if(e.target.tagName==='IMG'){document.getElementById('zoom-img').src=e.target.src;document.getElementById('zoom-overlay').classList.add('open');}
    };
  } catch(e){document.getElementById('reader-images').innerHTML='<div class="empty"><p>Failed to load chapter</p></div>';}
}

function navChapter(dir) {
  const newIdx=S.currentChIdx-dir;
  if(newIdx<0||newIdx>=S.currentChapters.length) return;
  const ch=S.currentChapters[newIdx];
  openChapter(ch.id,ch.attributes?.chapter||'?',newIdx);
}

// ═══════════════════════════════════════════
// LIBRARY
// ═══════════════════════════════════════════
function addToLibrary() {
  if(!S.currentManga) return;
  if(S.library.find(m=>m.id===S.currentManga.id)){toast('Already in library!');return;}
  S.library.push(S.currentManga);
  save('lyeiuns-library',S.library);
  toast('Added to library ✓');
  renderLibrary();
}
function filterLib(type,el) {
  document.querySelectorAll('.filter-pill').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  renderLibrary(type);
}
function renderLibrary(filter) {
  if(filter === undefined) filter = 'all';
  var grid = document.getElementById('library-grid');
  if(!grid) return;
  document.querySelectorAll('.lib-filter-tab').forEach(function(t){ t.classList.toggle('active', t.dataset.filter===filter); });
  var countEl = document.getElementById('lib-count');
  if(countEl) countEl.textContent = S.library.length + (S.library.length!==1?' titles':' title');
  var items = S.library.slice().sort(function(a,b){
    var ha=S.history_items.find(function(h){return h.id===a.id;});
    var hb=S.history_items.find(function(h){return h.id===b.id;});
    return (hb?(new Date(hb.readAt||0)).getTime():0)-(ha?(new Date(ha.readAt||0)).getTime():0);
  });
  if(filter!=='all') items=items.filter(function(m){return getType(m).toLowerCase()===filter;});
  if(!items.length){grid.innerHTML=getChibiEmpty('library','Library Empty','Save titles to read them here');return;}
  grid.innerHTML=items.map(function(m){
    var cover=getCover(m), title=getTitle(m), type=getType(m), id=m.id;
    var eId=esc(id);
    var lastRead=S.history_items.filter(function(h){return h.id===id;}).slice(-1)[0];
    var prog=lastRead
      ? '<div style="margin-top:6px"><div style="font-size:10px;color:var(--muted);margin-bottom:3px">Last: Ch. '+lastRead.chapter+'</div><div style="height:2px;background:var(--border)"><div style="height:100%;width:25%;background:var(--manga-red)"></div></div></div>'
      : '<div style="margin-top:6px;font-size:10px;color:var(--muted)">Not started</div>';
    var coverHtml=cover
      ? '<img src="'+cover+'" style="width:56px;height:76px;object-fit:cover;flex-shrink:0" onerror="this.style.background=\'var(--surface2)\'">'
      : '<div style="width:56px;height:76px;background:var(--surface2);flex-shrink:0"></div>';
    var row='<div style="background:var(--surface);border:1px solid var(--border);margin-bottom:10px;overflow:hidden">';
    row+='<div style="display:flex;gap:12px;padding:12px;cursor:pointer" onclick="openDetail('+JSON.stringify(id)+')">';
    row+=coverHtml;
    row+='<div style="flex:1;min-width:0"><div style="font-size:9px;letter-spacing:1px;color:var(--manga-red);margin-bottom:3px">'+type+'</div>';
    row+='<div style="font-size:14px;font-weight:600;color:var(--text);line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'+title+'</div>';
    row+=prog+'</div></div>';
    row+='<div style="padding:0 12px 12px;display:flex;gap:8px">';
    row+='<button onclick="openDetail('+JSON.stringify(id)+')" style="flex:1;padding:8px;background:var(--manga-red);border:none;color:white;font-size:13px;letter-spacing:2px;cursor:pointer">'+(lastRead?'CONTINUE':'START')+'</button>';
    row+='<button onclick="removeFromLibrary('+JSON.stringify(id)+')" style="padding:8px 12px;background:var(--surface2);border:1px solid var(--border);color:var(--muted);font-size:12px;cursor:pointer">✕</button>';
    row+='</div></div>';
    return row;
  }).join('');
}

function removeFromLibrary(id){S.library=S.library.filter(function(m){return m.id!==id;});save('lyeiuns-library',S.library);renderLibrary();toast('Removed from library');}

function renderLists() {
  renderExternalTitles();
  const el=document.getElementById('lists-container');
  if(!S.custom_lists.length){el.innerHTML=getChibiEmpty('sleep','No Lists Yet','Create a list to organise your reading');return;}
  el.innerHTML=S.custom_lists.map((l,i)=>`
    <div class="list-card">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div><div class="list-card-title">${l.name}</div><div class="list-card-count">${l.items.length} title${l.items.length!==1?'s':''}</div></div>
        <button onclick="deleteList(${i})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;padding:4px 8px">✕</button>
      </div>
      ${l.items.length?`<div class="manga-grid" style="margin-top:12px;grid-template-columns:repeat(auto-fill,minmax(80px,1fr))">${l.items.slice(0,6).map(m=>`<div class="manga-card" onclick="openDetail('${esc(m.id)}')"><div class="manga-cover" style="border-radius:6px"><img src="${getCover(m)||''}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"></div></div>`).join('')}</div>`:''}
    </div>`).join('');
}
function showCreateListForm(){document.getElementById('create-list-form').style.display='block';document.getElementById('new-list-name').focus();}
function hideCreateListForm(){document.getElementById('create-list-form').style.display='none';document.getElementById('new-list-name').value='';}
function createList(){
  const name=document.getElementById('new-list-name').value.trim();
  if(!name) return;
  S.custom_lists.push({name,items:[]});
  save('lyeiuns-lists',S.custom_lists);
  renderLists();
  hideCreateListForm();
  toast(`"${name}" created!`);
}
function deleteList(i){
  if(!confirm(`Delete "${S.custom_lists[i].name}"?`)) return;
  S.custom_lists.splice(i,1);
  save('lyeiuns-lists',S.custom_lists);
  renderLists();
}
function addToList() {
  if(!S.currentManga) { toast('Open a manga first'); return; }
  if(!S.custom_lists.length) {
    toast('Create a list first in the Lists tab');
    navigate('lists');
    return;
  }
  // Show list picker modal
  const title = getTitle(S.currentManga);
  const listItems = S.custom_lists.map(function(l, i) {
    const inList = l.items && l.items.find(function(m){ return m.id === S.currentManga.id; });
    return '<div class="list-pick-item" onclick="addToListIdx(' + i + ')" style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);cursor:pointer">' +
      '<div><div style="font-size:14px;font-weight:600;color:var(--text)">' + l.name + '</div>' +
      '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + (l.items ? l.items.length : 0) + ' titles</div></div>' +
      '<div style="font-size:18px">' + (inList ? '✅' : '＋') + '</div></div>';
  }).join('');
  
  const modal = document.getElementById('list-pick-modal');
  const body = document.getElementById('list-pick-body');
  const titleEl = document.getElementById('list-pick-title');
  if(titleEl) titleEl.textContent = 'Add "' + title + '" to list';
  if(body) body.innerHTML = listItems + '<div onclick="navigate(&quot;lists&quot;)" style="text-align:center;padding:14px;color:var(--accent2);cursor:pointer;font-size:13px">+ Create new list</div>';
  if(modal) modal.classList.add('open');
}

function addToListIdx(idx) {
  if(!S.currentManga || !S.custom_lists[idx]) return;
  const list = S.custom_lists[idx];
  if(!list.items) list.items = [];
  if(list.items.find(function(m){ return m.id === S.currentManga.id; })) {
    toast('Already in "' + list.name + '"');
    return;
  }
  list.items.push(S.currentManga);
  save('lyeiuns-lists', S.custom_lists);
  toast('Added to "' + list.name + '" ✓');
  closeListPicker();
}

function closeListPicker() {
  const modal = document.getElementById('list-pick-modal');
  if(modal) modal.classList.remove('open');
}

// ═══════════════════════════════════════════
// FILTER MODAL
// ═══════════════════════════════════════════
function openFilterModal(ctx) {
  S.filterCtx=ctx;
  const cur=ctx==='home'?S.homeFilters:S.searchFilters;
  S.pendingTags=[...cur.tags];
  S.pendingType=cur.type||'';
  // build tags
  document.getElementById('genre-tags-container').innerHTML=GENRES.map(t=>`<div class="genre-tag${S.pendingTags.includes(t.id)?' selected':''}" data-id="${t.id}" onclick="toggleTag(this)">${t.name}</div>`).join('');
  document.getElementById('theme-tags-container').innerHTML=THEMES_MAP.map(t=>`<div class="genre-tag${S.pendingTags.includes(t.id)?' selected':''}" data-id="${t.id}" onclick="toggleTag(this)">${t.name}</div>`).join('');
  document.querySelectorAll('.type-pill').forEach(p=>p.classList.toggle('selected',p.dataset.lang===S.pendingType));
  updateGenreCount();
  document.getElementById('filter-modal').classList.add('open');
}
function closeFilterModal(){document.getElementById('filter-modal').classList.remove('open');}
function toggleTag(el){
  const id=el.dataset.id;
  if(el.classList.contains('selected')){el.classList.remove('selected');S.pendingTags=S.pendingTags.filter(t=>t!==id);}
  else{el.classList.add('selected');S.pendingTags.push(id);}
  updateGenreCount();
}
function selectType(el){
  document.querySelectorAll('.type-pill').forEach(p=>p.classList.remove('selected'));
  el.classList.add('selected');
  S.pendingType=el.dataset.lang;
}
function updateGenreCount(){
  const n=S.pendingTags.length;
  document.getElementById('genre-count').textContent=n>0?`(${n} selected)`:'';
}
function clearFilters(){
  S.pendingTags=[];S.pendingType='';
  document.querySelectorAll('.genre-tag').forEach(el=>el.classList.remove('selected'));
  document.querySelectorAll('.type-pill').forEach(p=>p.classList.remove('selected'));
  document.querySelector('.type-pill[data-lang=""]').classList.add('selected');
  updateGenreCount();
}
function applyFilters(){
  const f={tags:[...S.pendingTags],type:S.pendingType};
  if(S.filterCtx==='home'){S.homeFilters=f;loadPopular();}
  else{S.searchFilters=f;const q=document.getElementById('main-search').value;if(q.trim())doSearch(q);}
  closeFilterModal();
}

// ═══════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════
function applyTheme() {
  const st=S.settings;
  const t=THEMES_SETTINGS[st.theme]||THEMES_SETTINGS.dark;
  const r=document.documentElement.style;
  r.setProperty('--bg',t.bg);r.setProperty('--surface',t.surface);r.setProperty('--surface2',t.surface2);
  r.setProperty('--border',t.border);r.setProperty('--text',t.text);r.setProperty('--muted',t.muted);
  r.setProperty('--tag-bg',t.tag);r.setProperty('--accent',st.accent);r.setProperty('--accent2',st.accent2);
  if(document.body) document.body.className=st.theme==='light'?'theme-light':'';
}
function openSettings(){
  const st=S.settings;
  document.querySelectorAll('.theme-card').forEach(c=>c.classList.remove('active'));
  const tc=document.getElementById('theme-'+st.theme);if(tc)tc.classList.add('active');
  document.querySelectorAll('.color-swatch').forEach(s=>s.classList.toggle('active',s.dataset.a===st.accent));
  const dLtr=document.getElementById('dir-ltr'),dRtl=document.getElementById('dir-rtl');
  if(dLtr)dLtr.classList.toggle('active',st.direction==='ltr');
  if(dRtl)dRtl.classList.toggle('active',st.direction==='rtl');
  const fSlider=document.getElementById('font-slider');if(fSlider)fSlider.value=st.fontSize;
  const fVal=document.getElementById('font-size-val');if(fVal)fVal.textContent=st.fontSize+'px';
  const safe=document.getElementById('safe-toggle');if(safe)safe.classList.toggle('on',st.safeMode);
  document.getElementById('settings-overlay').classList.add('open');
}
function closeSettings(){document.getElementById('settings-overlay').classList.remove('open');}
function setTheme(t){
  S.settings.theme=t;save('lyeiuns-settings',S.settings);applyTheme();
  document.querySelectorAll('.theme-card').forEach(c=>c.classList.remove('active'));
  const tc=document.getElementById('theme-'+t);if(tc)tc.classList.add('active');
}
function setAccent(el){
  S.settings.accent=el.dataset.a;S.settings.accent2=el.dataset.a2;
  save('lyeiuns-settings',S.settings);applyTheme();
  document.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('active'));
  el.classList.add('active');
}
function setSetting(key,val,el,group){
  S.settings[key]=val;save('lyeiuns-settings',S.settings);
  document.querySelectorAll(`[id^="${group}-"]`).forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
}
function setFontSize(v){
  S.settings.fontSize=parseInt(v);save('lyeiuns-settings',S.settings);
  document.getElementById('font-size-val').textContent=v+'px';
}
function toggleSafe(){
  S.settings.safeMode=!S.settings.safeMode;save('lyeiuns-settings',S.settings);
  document.getElementById('safe-toggle').classList.toggle('on',S.settings.safeMode);
  toast(S.settings.safeMode?'Safe mode on':'Safe mode off');
}

// ═══════════════════════════════════════════
// SIDE NAV HOVER
// ═══════════════════════════════════════════
const sideNav = document.getElementById('side-nav');
if(sideNav){
  sideNav.addEventListener('mouseenter',()=>sideNav.classList.add('expanded'));
  sideNav.addEventListener('mouseleave',()=>sideNav.classList.remove('expanded'));
}

// ═══════════════════════════════════════════
// INTRO
// ═══════════════════════════════════════════
// old enter-btn handler removed





// Library status dropdown filter
let currentLibType = 'all';
let currentLibStatus = '';

const _origFilterLib2 = window.filterLib;
window.filterLib = function(type, el) {
  currentLibType = type;
  // reset status dropdown when type changes
  const statusSel = document.getElementById('lib-status-filter');
  if(statusSel) { statusSel.value = ''; currentLibStatus = ''; }
  document.querySelectorAll('.lib-pill').forEach(p => p.classList.remove('active'));
  if(el) el.classList.add('active');
  renderLibraryFiltered();
}

function filterLibByStatus(status) {
  currentLibStatus = status;
  // reset type to all when filtering by status
  currentLibType = 'all';
  document.querySelectorAll('.lib-pill').forEach(p => p.classList.remove('active'));
  document.querySelector('.lib-pill[data-filter="all"]')?.classList.add('active');
  renderLibraryFiltered();
}

function renderLibraryFiltered() {
  const statuses = load('lyeiuns-statuses', {});
  const sortEl = document.getElementById('lib-sort');
  const sort = sortEl?.value || 'added';
  let items = [...S.library];

  // apply type filter
  if(currentLibType === 'manga' || currentLibType === 'manhwa' || currentLibType === 'manhua') {
    items = items.filter(m => getType(m).toLowerCase() === currentLibType);
  }

  // apply status filter
  if(currentLibStatus) {
    items = items.filter(m => statuses[m.id] === currentLibStatus);
  }

  // sort
  if(sort === 'title') items.sort((a,b) => getTitle(a).localeCompare(getTitle(b)));
  else if(sort === 'read') {
    items.sort((a,b) => {
      const ha = S.history_items.find(h=>h.id===a.id)?.ts||0;
      const hb = S.history_items.find(h=>h.id===b.id)?.ts||0;
      return hb - ha;
    });
  }

  const grid = document.getElementById('library-grid');
  const countEl = document.getElementById('lib-count');
  if(countEl) countEl.textContent = items.length + ' title' + (items.length!==1?'s':'');

  if(libViewMode==='list') grid.classList.add('list-view');
  else grid.classList.remove('list-view');

  if(!items.length) {
    grid.innerHTML='<div class="empty"><div class="empty-icon">📚</div><h3>Empty</h3><p>Nothing matches this filter</p></div>';
    return;
  }

  grid.innerHTML = items.map(m => {
    const cover=getCover(m), title=getTitle(m), type=getType(m);
    const st = statuses[m.id];
    const statusLabels = {reading:'Reading',completed:'Done','on-hold':'On Hold',dropped:'Dropped',plan:'Plan'};
    const badgeHtml = st ? `<div class="status-badge ${st}">${statusLabels[st]||st}</div>` : '';
    return `<div class="manga-card" onclick="openDetail('${esc(m.id)}')">
      <div class="manga-cover" style="position:relative">
        ${cover?`<img src="${cover}" alt="" loading="lazy" onerror="this.src=this.src.includes('.512.')?this.src.replace('.512.','.256.'):this.parentElement.innerHTML='<div class=\'manga-cover-placeholder\'>${esc(title)}</div>'">`:`<div class="manga-cover-placeholder">${title}</div>`}
        <div class="manga-badge">${type}</div>
        ${badgeHtml}
      </div>
      <div class="manga-info">
        <div class="manga-title">${title}</div>
        <div class="manga-sub">${m.attributes?.status||''}</div>
      </div>
    </div>`;
  }).join('');
}

// ── LIBRARY VIEW TOGGLE ──
let libViewMode = 'grid';
function toggleLibView() {
  libViewMode = libViewMode === 'grid' ? 'list' : 'grid';
  const grid = document.getElementById('library-grid');
  const icon = document.getElementById('lib-view-icon');
  if(libViewMode === 'list') {
    grid.classList.add('list-view');
    if(icon) icon.innerHTML = '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>';
  } else {
    grid.classList.remove('list-view');
    if(icon) icon.innerHTML = '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>';
  }
}

// Update filterLib to also deactivate all pills first
const _origFilterLib = filterLib;
window.filterLib = function(type, el) {
  document.querySelectorAll('.lib-pill').forEach(p => p.classList.remove('active'));
  if(el) el.classList.add('active');
  _origFilterLib(type, el);
}


// ═══════════════════════════════════════════
// TOP 10
// ═══════════════════════════════════════════
async function loadTop10() {
  const el = document.getElementById('top10-scroll');
  if(!el) return;
  el.innerHTML = Array(6).fill('<div class="top10-skeleton"><div class="skeleton top10-skeleton-cover"></div><div style="flex:1"><div class="skeleton skel-line" style="height:14px;margin-bottom:6px"></div><div class="skeleton skel-line" style="width:60%;height:10px"></div></div></div>').join('');
  try {
    const items = await mdList('&order[followedCount]=desc&limit=10');
    el.innerHTML = items.map((m,i)=>{
      const cov = getCover(m) || '';
      return '<div class="top10-item" onclick="openDetail(\'' + m.id + '\')">' +
        '<div class="top10-rank">' + String(i+1).padStart(2,'0') + '</div>' +
        (cov ? '<img class="top10-cover" src="' + cov + '" alt="" loading="lazy">' : '<div class="top10-cover" style="background:var(--surface2)"></div>') +
        '<div class="top10-info"><div class="top10-title">' + getTitle(m) + '</div>' +
        '<div class="top10-meta">' + getType(m) + ((m.attributes&&m.attributes.year)?(' · '+m.attributes.year):'') + '</div></div></div>';
    }).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty"><p>Failed to load</p></div>';
  }
}

// ═══════════════════════════════════════════
// FEATURED MANHWA
// ═══════════════════════════════════════════
async function loadFeatured() {
  try {
    const items = await mdList('&order[followedCount]=desc&limit=12');
    if(!items.length) return;
    const m = items[Math.floor(Math.random()*Math.min(items.length,12))];
    const cov = getCover(m) || '';
    const d = (m.attributes && m.attributes.description) || {};
    const desc = d.en || Object.values(d)[0] || '';
    const els = {
      cover: document.getElementById('featured-cover'),
      title: document.getElementById('featured-title'),
      desc:  document.getElementById('featured-desc'),
      btn:   document.getElementById('featured-btn'),
      tags:  document.getElementById('featured-tags'),
      card:  document.getElementById('featured-card'),
    };
    if(els.cover) els.cover.src = cov;
    if(els.title) els.title.textContent = getTitle(m);
    if(els.desc)  els.desc.textContent  = String(desc).slice(0,160);
    if(els.tags)  els.tags.innerHTML    = '<span class="feat-tag">\u26a1 FEATURED</span>';
    if(els.btn)   { els.btn.textContent='READ NOW'; els.btn.onclick=()=>openDetail(m.id); }
    if(els.card)  { els.card.onclick=()=>openDetail(m.id); if(cov) els.card.style.backgroundImage='url('+cov+')'; }
  } catch(e) {}
}



// ═══════════════════════════════════════════
// PWA INSTALL
// ═══════════════════════════════════════════
let deferredPrompt = null;

// Check if already installed
const isInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function dismissInstall() {
  document.getElementById('install-banner').style.display = 'none';
  save('lyeiuns-install-dismissed', Date.now());
}

function installApp() {
  if(deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(choice => {
      if(choice.outcome === 'accepted') {
        document.getElementById('install-banner').style.display = 'none';
        toast('Installing LYEIUNS... ✓');
      }
      deferredPrompt = null;
    });
  }
}

// Show banner after a delay if not dismissed recently
function checkInstallBanner() {
  if(isInstalled) return;
  const dismissed = load('lyeiuns-install-dismissed', 0);
  const oneDayAgo = Date.now() - 86400000;
  if(dismissed && dismissed > oneDayAgo) return;

  setTimeout(() => {
    const banner = document.getElementById('install-banner');
    if(!banner) return;

    if(isIOS()) {
      // iOS — show manual instruction
      banner.style.display = 'block';
      document.getElementById('ios-install-hint').style.display = 'block';
      document.getElementById('install-btn').style.display = 'none';
    } else if(deferredPrompt) {
      // Android/Chrome — show install button
      banner.style.display = 'block';
    }
  }, 3000);
}

// Catch the install prompt on Android/Chrome
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  checkInstallBanner();
});

window.addEventListener('appinstalled', () => {
  document.getElementById('install-banner').style.display = 'none';
  toast('LYEIUNS installed! 🎉');
});

// Check on load
window.addEventListener('load', checkInstallBanner);

// ═══════════════════════════════════════════
// DUAL SOURCE: MANGADEX + COMICK
// ═══════════════════════════════════════════
const COMICK = 'https://api.comick.fun';
let activeSource = 'both'; // 'both' | 'mdex' | 'comick'

function setSource(src) {
  activeSource = src;
  document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('src-' + src)?.classList.add('active');
  toast(`Source: ${src === 'both' ? 'MangaDex + Comick' : src === 'mdex' ? 'MangaDex' : 'Comick'}`);
  // reload current page data with new source
  const page = document.querySelector('.page.active')?.id?.replace('page-','');
  if(page === 'home') { loadPopular(); loadRecent(); }
  if(page === 'search') {
    const q = document.getElementById('main-search')?.value;
    if(q?.trim()) doSearch(q);
  }
}

// ── COMICK SEARCH ────────────────────────────────────────────────────────────
async function comickSearch(query, limit=24) {
  const url = `${COMICK}/v1.0/search?q=${encodeURIComponent(query)}&limit=${limit}&page=1`;
  const res = await fetch(url);
  const data = await res.json();
  return (data || []).map(comickToManga);
}

async function comickPopular(limit=12) {
  const url = `${COMICK}/v1.0/search?sort=follow&limit=${limit}&page=1`;
  const res = await fetch(url);
  const data = await res.json();
  return (data || []).map(comickToManga);
}

async function comickRecent(limit=12) {
  const url = `${COMICK}/v1.0/search?sort=uploaded&limit=${limit}&page=1`;
  const res = await fetch(url);
  const data = await res.json();
  return (data || []).map(comickToManga);
}

// Convert Comick format to our MangaDex-like format
function comickToManga(c) {
  return {
    id: 'comick_' + (c.slug || c.hid || c.id),
    _comickHid: c.hid,
    _comickSlug: c.slug,
    _source: 'comick',
    attributes: {
      title: { en: c.title || c.slug },
      description: { en: c.desc || c.brief_desc || '' },
      status: c.status === 1 ? 'ongoing' : c.status === 2 ? 'completed' : 'unknown',
      originalLanguage: c.country === 'kr' ? 'ko' : c.country === 'cn' ? 'zh' : 'ja',
      tags: (c.genres || []).map(g => ({ attributes: { name: { en: g.name || g } } })),
      year: c.year,
      rating: c.bayesian_rating ? { bayesian: c.bayesian_rating } : null,
      follows: c.follow_count,
      lastChapter: c.last_chapter,
    },
    relationships: c.cover_url ? [{
      type: 'cover_art',
      _directUrl: c.cover_url,
    }] : [],
    _source: 'comick',
  };
}

// Patch getCover to handle Comick direct URLs
const _origGetCover = getCover;
window.getCover = function(m) {
  if(m?._source === 'comick') {
    const rel = m.relationships?.find(r => r.type === 'cover_art');
    return rel?._directUrl || null;
  }
  return _origGetCover(m);
}

// ── COMICK DETAIL ─────────────────────────────────────────────────────────────
async function comickGetDetail(hid) {
  const url = `${COMICK}/comic/${hid}`;
  const res = await fetch(url);
  const data = await res.json();
  return data;
}

async function comickGetChapters(hid) {
  const url = `${COMICK}/comic/${hid}/chapters?lang=en&limit=300`;
  const res = await fetch(url);
  const data = await res.json();
  return (data?.chapters || []).map(ch => ({
    id: 'comick_ch_' + ch.hid,
    _comickHid: ch.hid,
    _source: 'comick',
    attributes: {
      chapter: ch.chap,
      title: ch.title || '',
      publishAt: ch.created_at,
    }
  }));
}

async function comickGetPages(chHid) {
  const url = `${COMICK}/chapter/${chHid}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data?.chapter?.md_images || []).map(img =>
    `https://meo.comick.pictures/${img.b2key}`
  );
}

// comick routing moved into final openDetail

async function openComickDetail(id) {
  navigate('detail');
  document.getElementById('chapter-list').innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading...</span></div>';
  try {
    // find manga from cache or re-search
    const slug = id.replace('comick_','');
    const url = `${COMICK}/comic/${slug}`;
    const res = await fetch(url);
    const raw = await res.json();
    const comic = raw?.comic || raw;

    const m = comickToManga({
      ...comic,
      cover_url: comic.cover_url || (comic.md_covers?.[0] ? `https://meo.comick.pictures/${comic.md_covers[0].b2key}` : null),
    });
    S.currentManga = m;
    m.id = id;

    const cover = getCover(m);
    const title = getTitle(m);
    const type = getType(m);
    const desc = comic.desc || comic.brief_desc || 'No description available.';
    const tags = (comic.genres || comic.md_tags || []).slice(0,8).map(g => g.name || g).filter(Boolean);
    const status = comic.status === 1 ? 'ongoing' : 'completed';

    document.getElementById('detail-cover-img').src = cover || '';
    document.getElementById('detail-backdrop').style.backgroundImage = cover ? `url(${cover})` : '';
    document.getElementById('detail-title').textContent = title;
    document.getElementById('detail-type').textContent = type + ' · via Comick';
    document.getElementById('detail-desc').textContent = desc;
    document.getElementById('detail-author').innerHTML = comic.author ? `By <span>${comic.author}</span>` : '';
    document.getElementById('detail-tags').innerHTML = tags.map(t => `<span class="tag">${t}</span>`).join('');
    document.getElementById('detail-meta').innerHTML = `
      <div class="meta-pill ${status==='ongoing'?'green':''}">${status.charAt(0).toUpperCase()+status.slice(1)}</div>
      ${comic.year ? `<div class="meta-pill">${comic.year}</div>` : ''}
      ${comic.bayesian_rating ? `<div class="meta-pill">⭐ ${parseFloat(comic.bayesian_rating).toFixed(1)}</div>` : ''}
      <div class="meta-pill yellow">Comick</div>
    `;
    document.getElementById('detail-stats').innerHTML = `
      ${comic.follow_count ? `<div class="detail-stat"><div class="detail-stat-val">${comic.follow_count>=1000?(comic.follow_count/1000).toFixed(1)+'K':comic.follow_count}</div><div class="detail-stat-label">Follows</div></div>` : ''}
      ${comic.last_chapter ? `<div class="detail-stat"><div class="detail-stat-val">${comic.last_chapter}</div><div class="detail-stat-label">Chapters</div></div>` : ''}
    `;

    // load chapters
    const hid = comic.hid || slug;
    const chapUrl = `${COMICK}/comic/${hid}/chapters?lang=en&limit=300&page=1`;
    const chapRes = await fetch(url);
    const chapData = await chapRes.json();
    S.currentChapters = (chapData?.chapters || []).reverse().map(ch => ({
      id: 'comick_ch_' + ch.hid,
      _comickHid: ch.hid,
      _source: 'comick',
      attributes: { chapter: ch.chap, title: ch.title||'', publishAt: ch.created_at }
    })).reverse();

    if(!S.currentChapters.length) {
      document.getElementById('chapter-list').innerHTML = '<div class="empty"><p>No English chapters found</p></div>';
      return;
    }
    document.getElementById('chapter-list').innerHTML = S.currentChapters.map((ch,i) => `
      <div class="chapter-item${isChRead(ch.id)?' read':''}" onclick="openChapter('${esc(ch.id)}','${esc(ch.attributes?.chapter||'?')}',${i})">
        <div class="chapter-num">CH ${ch.attributes?.chapter||'?'}</div>
        <div class="chapter-name">${ch.attributes?.title||'Chapter '+ch.attributes?.chapter}</div>
        <div class="chapter-date">${timeAgo(ch.attributes?.publishAt)}</div>
        <span class="ch-source comick">Comick</span>
      </div>`).join('');
  } catch(e) {
    document.getElementById('chapter-list').innerHTML = '<div class="empty"><p>Failed to load from Comick</p></div>';
    console.error(e);
  }
}

// ── PATCH openChapter for Comick chapters ────────────────────────────────────
const _origOpenCh2 = window.openChapter;
window.openChapter = async function(chapterId, chapterNum, idx) {
  if(chapterId.startsWith('comick_ch_')) {
    await openComickChapter(chapterId, chapterNum, idx);
    return;
  }
  await _origOpenCh2(chapterId, chapterNum, idx);
}

async function openComickChapter(chapterId, chapterNum, idx) {
  S.currentChIdx = idx;
  navigate('reader');
  const title = S.currentManga ? getTitle(S.currentManga) : '';
  document.getElementById('reader-title').textContent = `${title} — Ch. ${chapterNum}`;
  document.getElementById('reader-ch-info').textContent = `CH ${chapterNum}`;
  document.getElementById('prev-btn').disabled = idx >= S.currentChapters.length - 1;
  document.getElementById('next-btn').disabled = idx <= 0;
  document.getElementById('reader-images').innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading pages...</span></div>';
  document.getElementById('reader-progress').style.width = '0%';

  markChRead(chapterId);
  if(S.currentManga) {
    const entry = { id: S.currentManga.id, title: getTitle(S.currentManga), cover: getCover(S.currentManga), chapterNum, ts: Date.now() };
    S.history_items = S.history_items.filter(h => h.id !== entry.id);
    S.history_items.unshift(entry);
    save('lyeiuns-history', S.history_items);
    renderContinue();
  }

  try {
    const hid = chapterId.replace('comick_ch_','');
    const url = `${COMICK}/chapter/${hid}`;
    const res = await fetch(url);
    const data = await res.json();
    const pages = (data?.chapter?.md_images || []).map(img =>
      `https://meo.comick.pictures/${img.b2key}`
    );

    if(!pages.length) {
      document.getElementById('reader-images').innerHTML = '<div class="empty"><p>No pages found</p></div>';
      return;
    }
    document.getElementById('reader-images').style.direction = S.settings.direction || 'ltr';
    document.getElementById('reader-images').innerHTML = pages.map(p =>
      `<img src="${p}" alt="" loading="lazy">`
    ).join('');
    setReaderMode(readerMode);
    window.scrollTo(0, 0);
    document.getElementById('reader-progress').style.width = '0%';
    window.onscroll = function() {
      const prog = document.getElementById('reader-progress');
      if(prog && prog.style.display !== 'none') {
        const pct = Math.min(100, (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
        prog.style.width = pct + '%';
      }
    };
    document.getElementById('reader-images').ondblclick = function(e) {
      if(e.target.tagName==='IMG') { document.getElementById('zoom-img').src=e.target.src; document.getElementById('zoom-overlay').classList.add('open'); }
    };
    const toolbar = document.getElementById('reader-toolbar');
    if(toolbar) toolbar.style.display = 'flex';
    updateChapterNav();
  } catch(e) {
    document.getElementById('reader-images').innerHTML = '<div class="empty"><p>Failed to load from Comick</p></div>';
  }
}

function updateChapterNav() {
  const prev = document.getElementById('prev-btn');
  const next = document.getElementById('next-btn');
  const info = document.getElementById('reader-ch-info');
  if(prev) prev.disabled = S.currentChIdx >= S.currentChapters.length - 1;
  if(next) next.disabled = S.currentChIdx <= 0;
  const ch = S.currentChapters[S.currentChIdx];
  if(info && ch) info.textContent = `CH ${ch.attributes?.chapter||'?'}`;
}

// ── PATCH doSearch for dual source ───────────────────────────────────────────
const _origDoSearch2 = window.doSearch;
window.doSearch = async function(query) {
  if(!query||!query.trim()) return;
  navigate('search');
  const q = query.trim();
  document.getElementById('main-search').value = q;
  const el = document.getElementById('search-results');
  if(!el) return;
  el.innerHTML = '<div class="loading"><div class="spinner"></div><span>Searching...</span></div>';
  try {
    const res = await fetch(CSAPI+'/api/search', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({query:q, source:'all'})
    });
    if(!res.ok) throw new Error('status '+res.status);
    const csData = await res.json();
    const allResults = Array.isArray(csData) ? csData : (csData.results?[csData]:[]);
    let html = '';
    allResults.forEach(function(sr) {
      const sName = sr.source||'External';
      const badge = sName.substring(0,3).toUpperCase();
      (sr.results||[]).slice(0,8).forEach(function(item) {
        const cov = item.coverImage ? CF_PROXY+'/img?url='+encodeURIComponent(item.coverImage) : '';
        const title = item.title||'Unknown';
        html += '<div class="manga-card" onclick="openExternalFromAPI('+JSON.stringify(item.url)+','+JSON.stringify(title)+','+JSON.stringify(cov)+')">' +
          '<div class="manga-cover" style="position:relative">' +
          (cov?'<img src="'+cov+'" alt="" loading="lazy">':'<div class="manga-cover-placeholder">'+title+'</div>') +
          '<div class="manga-badge">'+sName+'</div>' +
          '<div style="position:absolute;bottom:4px;left:4px;background:rgba(230,57,70,0.9);color:white;font-size:8px;padding:2px 5px;letter-spacing:1px">'+badge+'</div>' +
          '</div><div class="manga-info"><div class="manga-title">'+title+'</div>' +
          '<div class="manga-sub">Ch. '+(item.latestChapter||'?')+'</div></div></div>';
      });
    });
    el.innerHTML = html || '<div class="empty"><div class="empty-icon">😶</div><h3>No results for "'+q+'"</h3><p>Try different keywords</p></div>';
  } catch(e) {
    el.innerHTML = '<div class="empty"><p>Search failed: '+e.message+'</p></div>';
  }
}



// ── PATCH loadPopular for dual source ────────────────────────────────────────
const _origLoadPop2 = window.loadPopular;
window.loadPopular = async function() {
  if(activeSource === 'mdex' || activeSource === 'both') {
    await _origLoadPop2();
    return;
  }
  // Comick only
  skeletonGrid('popular-grid', 12);
  try {
    const items = await comickPopular(12);
    const el = document.getElementById('popular-grid');
    el.innerHTML = items.length ? items.map(m => {
      const cover=getCover(m),title=getTitle(m),type=getType(m);
      return `<div class="manga-card" onclick="openDetail('${esc(m.id)}')">
        <div class="manga-cover"><img src="${cover||''}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=manga-cover-placeholder>${esc(title)}</div>'"><div class="manga-badge">${type}</div></div>
        <div class="manga-info"><div class="manga-title">${title}</div><div class="manga-sub">${m.attributes?.status||''}</div></div>
      </div>`;
    }).join('') : '<div class="empty"><p>Failed to load</p></div>';
  } catch(e) { document.getElementById('popular-grid').innerHTML = '<div class="empty"><p>Failed</p></div>'; }
}

// source-bar handling moved into showPage

// ═══════════════════════════════════════════
// SKELETON LOADING
// ═══════════════════════════════════════════
function skeletonGrid(containerId, count=12) {
  const el = document.getElementById(containerId);
  if(!el) return;
  el.innerHTML = Array(count).fill(0).map(()=>`
    <div class="skeleton-card">
      <div class="skeleton skel-cover"></div>
      <div class="skeleton skel-line"></div>
      <div class="skeleton skel-line short"></div>
    </div>`).join('');
}

// ═══════════════════════════════════════════
// NEW THIS WEEK
// ═══════════════════════════════════════════
async function loadWeek() {
  const el = document.getElementById('week-grid');
  if(!el) return;
  try {
    const items = await mdList('&order[latestUploadedChapter]=desc&limit=24');
    el.innerHTML = items.map(m=>mdCard(m,'Updated')).join('') || '<div class="empty"><p>Nothing this week</p></div>';
  } catch(e) {
    el.innerHTML = '<div class="empty"><p>Failed</p></div>';
  }
}

async function fetchSuggestions(query) {
  if(query.length < 2) return;
  try {
    const url = `${API}/manga?limit=6&title=${encodeURIComponent(query)}&includes[]=cover_art&contentRating[]=safe`;
    const res = await fetch(url);
    const data = await res.json();
    if(!data.data?.length) { hideSuggestions(); return; }
    const el = document.getElementById('search-suggestions');
    el.innerHTML = data.data.map(m=>`
      <div class="sugg-item" onmousedown="selectSuggestion('${esc(m.id)}','${esc(getTitle(m))}')">
        <svg class="sugg-icon" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        ${getTitle(m)} <span style="color:var(--muted);font-size:11px;margin-left:auto">${getType(m)}</span>
      </div>`).join('');
    el.classList.add('open');
  } catch(e) { hideSuggestions(); }
}
function selectSuggestion(id, title) {
  document.getElementById('main-search').value = title;
  hideSuggestions();
  openDetail(id);
}
function hideSuggestions() {
  const el = document.getElementById('search-suggestions');
  if(el) el.classList.remove('open');
}

// ═══════════════════════════════════════════
// UPDATE CHECKER
// ═══════════════════════════════════════════
async function checkUpdates() {
  if(!S.library.length) { toast('Your library is empty!'); return; }
  const btn = document.getElementById('check-updates-btn');
  btn.classList.add('checking');
  btn.innerHTML = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="animation:spin 0.7s linear infinite"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg> Checking...';
  let updated = 0;
  try {
    for(const manga of S.library.slice(0,20)) {
      const res = await fetch(API + `/manga/${manga.id}/feed?limit=1&translatedLanguage[]=en&order[chapter]=desc&contentRating[]=safe&contentRating[]=suggestive`);
      const data = await res.json();
      const latest = data.data?.[0];
      if(latest) {
        const hist = S.history_items.find(h=>h.id===manga.id);
        if(!hist || latest.attributes?.chapter > hist.chapterNum) {
          updated++;
          // add badge to card
          const cards = document.querySelectorAll('.manga-card');
          cards.forEach(card=>{
            if(card.getAttribute('onclick')?.includes(manga.id) && !card.querySelector('.update-badge')) {
              const badge = document.createElement('div');
              badge.className='update-badge';
              badge.textContent='NEW';
              card.querySelector('.manga-cover').appendChild(badge);
            }
          });
        }
      }
    }
    toast(updated>0 ? `${updated} title${updated>1?'s':''} have new chapters!` : 'All caught up! ✓');
  } catch(e) { toast('Check failed, try again'); }
  btn.classList.remove('checking');
  btn.innerHTML = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg> Check Updates';
}

// ═══════════════════════════════════════════
// NIGHT MODE / BRIGHTNESS
// ═══════════════════════════════════════════
let nightOn = false;
function toggleNight() {
  nightOn = !nightOn;
  document.getElementById('night-toggle')?.classList.toggle('on', nightOn);
  const overlay = document.getElementById('night-overlay');
  if(overlay) overlay.style.background = nightOn ? 'rgba(255,140,0,0.08)' : 'rgba(0,0,0,0)';
  if(!nightOn) { setBrightness(0); const s=document.getElementById('brightness-slider'); if(s)s.value=0; const s2=document.getElementById('brightness-slider-s');if(s2)s2.value=0; }
}
function setBrightness(val) {
  const pct = Math.round(parseInt(val));
  const overlay = document.getElementById('night-overlay');
  if(overlay) overlay.style.background = `rgba(0,0,0,${pct/100})`;
  const bv = document.getElementById('brightness-val'); if(bv) bv.textContent = pct+'%';
  const bvs = document.getElementById('brightness-val-s'); if(bvs) bvs.textContent = pct+'%';
  // sync sliders
  const s1 = document.getElementById('brightness-slider'); if(s1&&s1.value!=val) s1.value=val;
  const s2 = document.getElementById('brightness-slider-s'); if(s2&&s2.value!=val) s2.value=val;
}

// ═══════════════════════════════════════════
// PROFILE / STATS
// ═══════════════════════════════════════════
function updateStreak() {
  const today = new Date().toDateString();
  const streakData = load('lyeiuns-streak', {date:'',count:0});
  const yesterday = new Date(Date.now()-86400000).toDateString();
  if(streakData.date===today) return streakData.count;
  if(streakData.date===yesterday) { streakData.count++; }
  else if(streakData.date!==today) { streakData.count=1; }
  streakData.date=today;
  save('lyeiuns-streak',streakData);
  return streakData.count;
}

function renderProfile() {
  var chapCount = S.history_items.length;
  var streak = updateStreak() || 0;
  var timeHrs = Math.round(chapCount * 7 / 60);
  var el;
  el = document.getElementById('pp-chapters'); if(el) el.textContent = chapCount;
  el = document.getElementById('pp-library'); if(el) el.textContent = S.library.length;
  el = document.getElementById('pp-streak'); if(el) el.textContent = streak;
  el = document.getElementById('pp-time'); if(el) el.textContent = timeHrs < 1 ? (chapCount*7)+' MIN' : timeHrs+' HRS';
  // Genre DNA
  var genreCount = {};
  S.library.forEach(function(m) {
    ((m.attributes && m.attributes.tags) || []).forEach(function(t) {
      var n = t.attributes && t.attributes.name && t.attributes.name.en;
      if(n) genreCount[n] = (genreCount[n]||0)+1;
    });
  });
  var genres = Object.entries(genreCount).sort(function(a,b){return b[1]-a[1];}).slice(0,6);
  var maxG = genres.length ? genres[0][1] : 1;
  var ge = document.getElementById('pp-genres');
  if(ge) ge.innerHTML = genres.length ? genres.map(function(g){
    var pct = Math.round(g[1]/maxG*100);
    return '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:12px;color:var(--text)">'+g[0]+'</span><span style="font-size:11px;color:var(--muted)">'+g[1]+'</span></div><div style="height:4px;background:var(--border);border-radius:2px"><div style="height:100%;width:'+pct+'%;background:var(--manga-red);border-radius:2px"></div></div></div>';
  }).join('') : '<div style="color:var(--muted);font-size:12px">Save manga to see your genres</div>';
  // Recently read
  var recent = S.history_items.slice(-6).reverse();
  var re2 = document.getElementById('pp-recent');
  if(re2) {
    if(recent.length) {
      re2.innerHTML = recent.map(function(h) {
        var hId = h.id || '';
        return '<div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--surface);border:1px solid var(--border);margin-bottom:8px;cursor:pointer" onclick="openDetail('+JSON.stringify(hId)+')">' +
          (h.cover ? '<img src="'+h.cover+'" style="width:44px;height:60px;object-fit:cover;flex-shrink:0">' : '<div style="width:44px;height:60px;background:var(--surface2);flex-shrink:0"></div>') +
          '<div style="min-width:0;flex:1"><div style="font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(h.title||'Unknown')+'</div>' +
          '<div style="font-size:11px;color:var(--muted);margin-top:3px">Ch. '+(h.chapter||'?')+' · '+timeAgo(h.readAt)+'</div></div>' +
          '<div style="font-size:11px;color:var(--manga-red)">READ ›</div></div>';
      }).join('');
    } else {
      re2.innerHTML = '<div style="color:var(--muted);font-size:12px">No reading history yet</div>';
    }
  }
  // Legacy stat elements
  var sc=document.getElementById('stat-chapters'); if(sc) sc.textContent=chapCount;
  var sl=document.getElementById('stat-library'); if(sl) sl.textContent=S.library.length;
  var ss=document.getElementById('stat-streak'); if(ss) ss.textContent=streak;
}

function getReadingStatus(mangaId) {
  const statuses = load('lyeiuns-statuses', {});
  return statuses[mangaId] || '';
}
function setReadingStatus(status) {
  if(!S.currentManga) return;
  const statuses = load('lyeiuns-statuses', {});
  const id = S.currentManga.id;
  if(status) statuses[id] = status; else delete statuses[id];
  save('lyeiuns-statuses', statuses);
  // update badge on detail page
  updateDetailStatusBadge(status);
  // auto-add to library if not there
  if(status && !S.library.find(m=>m.id===id)) {
    S.library.push(S.currentManga);
    save('lyeiuns-library', S.library);
    renderLibrary();
  }
  toast(status ? `Marked as ${status.replace('-',' ')} ✓` : 'Status removed');
}
function updateDetailStatusBadge(status) {
  const badge = document.getElementById('detail-status-badge');
  if(!badge) return;
  if(!status) { badge.style.display='none'; return; }
  const labels = {reading:'Reading',completed:'Completed','on-hold':'On Hold',dropped:'Dropped',plan:'Plan to Read'};
  badge.textContent = labels[status]||status;
  badge.className = `status-badge ${status}`;
  badge.style.display = 'block';
}

// ═══════════════════════════════════════════
// CHAPTER READ TRACKING
// ═══════════════════════════════════════════
function isChRead(chapterId) {
  const read = load('lyeiuns-read-chs', {});
  return !!read[chapterId];
}
function markChRead(chapterId) {
  const read = load('lyeiuns-read-chs', {});
  read[chapterId] = Date.now();
  save('lyeiuns-read-chs', read);
}

// ═══════════════════════════════════════════
// READER MODE (scroll vs long strip)
// ═══════════════════════════════════════════
let readerMode = 'scroll';
function setReaderMode(mode) {
  readerMode = mode;
  const ri = document.getElementById('reader-images');
  document.getElementById('tool-scroll')?.classList.toggle('active', mode==='scroll');
  document.getElementById('tool-strip')?.classList.toggle('active', mode==='strip');
  if(mode==='strip') {
    ri.classList.add('long-strip');
  } else {
    ri.classList.remove('long-strip');
  }
}

// ═══════════════════════════════════════════
// SHARE
// ═══════════════════════════════════════════
function shareTitle() {
  if(!S.currentManga) return;
  const title = getTitle(S.currentManga);
  const url = `https://mangadex.org/title/${S.currentManga.id}`;
  if(navigator.share) {
    navigator.share({ title: title, text: `Check out ${title} on MangaDex!`, url });
  } else {
    navigator.clipboard?.writeText(url).then(()=>toast('Link copied! ✓'));
  }
}

// advanced search consolidated


// ═══════════════════════════════════════════
// LIBRARY SORT (patch renderLibrary)
// ═══════════════════════════════════════════
const _origRenderLib = renderLibrary;
window.renderLibrary = function(filter='all') {
  renderLibraryFiltered(); return;
  const grid = document.getElementById('library-grid');
  const statuses = load('lyeiuns-statuses', {});
  const sortEl = document.getElementById('lib-sort');
  const sort = sortEl?.value || 'added';

  let items = [...S.library];

  // filter by type or status
  if(filter==='manga'||filter==='manhwa'||filter==='manhua') {
    items = items.filter(m=>getType(m).toLowerCase()===filter);
  } else if(filter==='reading'||filter==='completed'||filter==='on-hold'||filter==='dropped'||filter==='plan') {
    items = items.filter(m=>statuses[m.id]===filter);
  }

  // sort
  if(sort==='title') items.sort((a,b)=>getTitle(a).localeCompare(getTitle(b)));
  else if(sort==='read') {
    items.sort((a,b)=>{
      const ha = S.history_items.find(h=>h.id===a.id)?.ts||0;
      const hb = S.history_items.find(h=>h.id===b.id)?.ts||0;
      return hb-ha;
    });
  }

  const countEl = document.getElementById('lib-count');
  if(countEl) countEl.textContent = items.length + ' title' + (items.length!==1?'s':'');
  if(!items.length) {
    grid.innerHTML=getChibiEmpty('library','Library Empty','Tap Save on any title');
    return;
  }

  // render with status badges
  if(libViewMode==='list') grid.classList.add('list-view'); else grid.classList.remove('list-view');
  grid.innerHTML = items.map(m=>{
    const cover=getCover(m), title=getTitle(m), type=getType(m);
    const st = statuses[m.id];
    const statusLabels = {reading:'Reading',completed:'Done','on-hold':'On Hold',dropped:'Dropped',plan:'Plan'};
    const badgeHtml = st ? `<div class="status-badge ${st}">${statusLabels[st]||st}</div>` : '';
    return `<div class="manga-card" onclick="openDetail('${esc(m.id)}')">
      <div class="manga-cover" style="position:relative">
        ${cover?`<img src="${cover}" alt="" loading="lazy" onerror="this.src=this.src.includes('.512.')?this.src.replace('.512.','.256.'):this.parentElement.innerHTML='<div class=\'manga-cover-placeholder\'>${esc(title)}</div>'">`:`<div class="manga-cover-placeholder">${title}</div>`}
        <div class="manga-badge">${type}</div>
        ${badgeHtml}
      </div>
      <div class="manga-info">
        <div class="manga-title">${title}</div>
        <div class="manga-sub">${m.attributes?.status||''}</div>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════
// DETAIL PAGE UPGRADE (patch openDetail)
// ═══════════════════════════════════════════
const _origOpenDetail = openDetail;
window.openDetail = async function(id) {
  // Route comick titles to comick handler
  if(id && id.startsWith('comick_') && !id.startsWith('comick_ch_')) {
    await openComickDetail(id);
    return;
  }
  navigate('detail');
  document.getElementById('chapter-list').innerHTML='<div class="loading"><div class="spinner"></div><span>Loading...</span></div>';
  try {
    const res = await fetch(API + `/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist`);
    const data = await res.json();
    const m = data.data;
    S.currentManga = m;
    const cover=getCover(m), title=getTitle(m), type=getType(m);
    const desc = m.attributes?.description?.en || Object.values(m.attributes?.description||{})[0] || 'No description available.';
    const tags = m.attributes?.tags?.slice(0,8).map(t=>t.attributes?.name?.en||'')||[];
    const status = m.attributes?.status||'';
    const year = m.attributes?.year||'';
    const rating = m.attributes?.rating?.bayesian;
    const follows = m.attributes?.follows;
    const chCount = m.attributes?.lastChapter;

    // author
    const author = m.relationships?.find(r=>r.type==='author');
    const authorName = author?.attributes?.name||'';

    document.getElementById('detail-cover-img').src = cover||'';
    document.getElementById('detail-backdrop').style.backgroundImage = cover?`url(${cover})`:'';
    document.getElementById('detail-title').textContent = title;
    document.getElementById('detail-type').textContent = type;
    document.getElementById('detail-desc').textContent = desc;
    document.getElementById('detail-author').innerHTML = authorName ? `By <span>${authorName}</span>` : '';
    document.getElementById('detail-tags').innerHTML = tags.map(t=>`<span class="tag">${t}</span>`).join('');

    // meta pills
    const pills = [];
    if(status) pills.push(`<div class="meta-pill ${status==='ongoing'?'green':status==='completed'?'':'yellow'}">${status.charAt(0).toUpperCase()+status.slice(1)}</div>`);
    if(year) pills.push(`<div class="meta-pill">${year}</div>`);
    if(rating) pills.push(`<div class="meta-pill">⭐ ${parseFloat(rating).toFixed(1)}</div>`);
    document.getElementById('detail-meta').innerHTML = pills.join('');

    // stats row
    const stats = [];
    if(follows) stats.push(`<div class="detail-stat"><div class="detail-stat-val">${follows>=1000?(follows/1000).toFixed(1)+'K':follows}</div><div class="detail-stat-label">Follows</div></div>`);
    if(chCount) stats.push(`<div class="detail-stat"><div class="detail-stat-val">${chCount}</div><div class="detail-stat-label">Chapters</div></div>`);
    document.getElementById('detail-stats').innerHTML = stats.join('');

    // reading status
    const currentStatus = getReadingStatus(id);
    const sel = document.getElementById('reading-status-select');
    if(sel) sel.value = currentStatus;
    updateDetailStatusBadge(currentStatus);

    // chapters
    const chapRes = await fetch(API + `/manga/${id}/feed?limit=96&translatedLanguage[]=en&order[chapter]=desc&contentRating[]=safe&contentRating[]=suggestive`);
    const chapData = await chapRes.json();
    S.currentChapters = chapData.data||[];
    if(!S.currentChapters.length) { document.getElementById('chapter-list').innerHTML='<div class="empty"><p>No English chapters found</p></div>'; return; }
    document.getElementById('chapter-list').innerHTML = S.currentChapters.map((ch,i)=>`
      <div class="chapter-item${isChRead(ch.id)?' read':''}" onclick="openChapter('${esc(ch.id)}','${esc(ch.attributes?.chapter||'?')}',${i})">
        <div class="chapter-num">CH ${ch.attributes?.chapter||'?'}</div>
        <div class="chapter-name">${ch.attributes?.title||`Chapter ${ch.attributes?.chapter||'?'}`}</div>
        <div class="chapter-date">${timeAgo(ch.attributes?.publishAt)}</div>
        <div class="ch-read-dot"></div>
      </div>`).join('');
  } catch(e) { document.getElementById('chapter-list').innerHTML='<div class="empty"><p>Failed to load</p></div>'; }
}

// ═══════════════════════════════════════════
// PATCH openChapter to mark chapters as read
// ═══════════════════════════════════════════
const _origOpenCh = openChapter;
window.openChapter = async function(chapterId, chapterNum, idx) {
  // mark as read
  markChRead(chapterId);
  // apply long strip mode
  await _origOpenCh(chapterId, chapterNum, idx);
  setReaderMode(readerMode);
  // show toolbar
  const toolbar = document.getElementById('reader-toolbar');
  if(toolbar) toolbar.style.display = 'flex';
  // refresh chapter list read states
  document.querySelectorAll('.chapter-item').forEach(el=>{
    const onclick = el.getAttribute('onclick')||'';
    const idMatch = onclick.match(/openChapter\('([^']+)'/);
    if(idMatch && isChRead(idMatch[1])) el.classList.add('read');
    else el.classList.remove('read');
  });
  // update reading status to reading if not set
  if(S.currentManga && !getReadingStatus(S.currentManga.id)) {
    setReadingStatus('reading');
    const sel = document.getElementById('reading-status-select');
    if(sel) sel.value = 'reading';
  }
}

// profile rendering moved into showPage

// year select populated via JS after DOM ready
document.addEventListener('DOMContentLoaded', function() {
  const sel = document.getElementById('filter-year');
  if(sel) {
    const currentYear = new Date().getFullYear();
    for(let y=currentYear; y>=2000; y--) {
      const opt = document.createElement('option');
      opt.value=String(y); opt.textContent=String(y);
      sel.appendChild(opt);
    }
  }
});

// ═══════════════════════════════════════════
// PATCH showPage to handle profile + skeleton
// ═══════════════════════════════════════════
const _origNav = navigate;
window.navigate = function(page) {
  _origNav(page);
  if(page==='profile') renderProfile();
  if(page==='home') renderContinue();
}

// Also patch showPage to sync all 6 nav items including profile
// profile bnav sync moved into showPage


// patch loadPopular to use skeleton
const _origLoadPop = loadPopular;
window.loadPopular = async function() {
  skeletonGrid('popular-grid',12);
  await _origLoadPop();
}
const _origLoadRecent = loadRecent;
window.loadRecent = async function() {
  skeletonGrid('recent-grid',12);
  await _origLoadRecent();
}


// ── BOTTOM NAV PILL ──
function updateNavPill(name) {
  const pill = document.getElementById('bnav-pill');
  const nav = document.getElementById('bottom-nav');
  if(!pill || !nav) return;
  const pages = ['home','search','library','profile','lists'];
  const idx = pages.indexOf(name);
  if(idx === -1) { pill.style.opacity = '0'; return; }
  const btns = nav.querySelectorAll('.bnav-btn');
  if(!btns[idx]) return;
  const navRect = nav.getBoundingClientRect();
  const btnRect = btns[idx].getBoundingClientRect();
  pill.style.left = (btnRect.left - navRect.left - 4) + 'px';
  pill.style.width = (btnRect.width + 8) + 'px';
  pill.style.opacity = '1';
}

// ── CHIBI EMPTY STATE ──
function getChibiEmpty(type, title, subtitle) {
  const shapes = {
    library: '<ellipse cx="60" cy="95" rx="28" ry="22" fill="#a855f7"/><ellipse cx="60" cy="62" rx="30" ry="28" fill="#f9e4ff"/><ellipse cx="60" cy="38" rx="30" ry="16" fill="#7c3aed"/><ellipse cx="34" cy="55" rx="8" ry="14" fill="#7c3aed"/><ellipse cx="86" cy="55" rx="8" ry="14" fill="#7c3aed"/><ellipse cx="47" cy="64" rx="6" ry="5" fill="white"/><ellipse cx="73" cy="64" rx="6" ry="5" fill="white"/><ellipse cx="48" cy="65" rx="3.5" ry="3.5" fill="#4a1d8e"/><ellipse cx="74" cy="65" rx="3.5" ry="3.5" fill="#4a1d8e"/><ellipse cx="40" cy="70" rx="5" ry="3" fill="#f9a8d4" opacity="0.5"/><ellipse cx="80" cy="70" rx="5" ry="3" fill="#f9a8d4" opacity="0.5"/><path d="M54 74 Q60 78 66 74" stroke="#7c3aed" stroke-width="1.5" fill="none"/>',
    shrug: '<ellipse cx="55" cy="90" rx="24" ry="20" fill="#a855f7"/><ellipse cx="30" cy="80" rx="9" ry="5" fill="#c084fc" transform="rotate(-50 30 80)"/><ellipse cx="80" cy="80" rx="9" ry="5" fill="#c084fc" transform="rotate(50 80 80)"/><ellipse cx="55" cy="55" rx="28" ry="26" fill="#f9e4ff"/><ellipse cx="55" cy="33" rx="28" ry="13" fill="#5b21b6"/><ellipse cx="28" cy="48" rx="7" ry="13" fill="#5b21b6"/><ellipse cx="82" cy="48" rx="7" ry="13" fill="#5b21b6"/><rect x="36" y="54" width="12" height="5" rx="2.5" fill="#4a1d8e"/><rect x="62" y="54" width="12" height="5" rx="2.5" fill="#4a1d8e"/><line x1="48" y1="70" x2="62" y2="70" stroke="#a855f7" stroke-width="2"/>',
    sleep: '<rect x="15" y="72" width="100" height="12" rx="3" fill="#7c3aed" opacity="0.8"/><rect x="20" y="62" width="90" height="12" rx="3" fill="#a855f7" opacity="0.8"/><rect x="25" y="52" width="80" height="12" rx="3" fill="#c084fc" opacity="0.8"/><ellipse cx="65" cy="52" rx="32" ry="16" fill="#a855f7" transform="rotate(-5 65 52)"/><ellipse cx="32" cy="44" rx="22" ry="20" fill="#f9e4ff"/><ellipse cx="32" cy="27" rx="22" ry="11" fill="#7c3aed"/><path d="M22 44 Q26 41 30 44" stroke="#4a1d8e" stroke-width="2" fill="none"/><path d="M34 44 Q38 41 42 44" stroke="#4a1d8e" stroke-width="2" fill="none"/>',
  };
  const s = shapes[type] || shapes.shrug;
  const vb = type === 'sleep' ? '0 0 130 100' : type === 'library' ? '0 0 120 130' : '0 0 110 120';
  const w = type === 'sleep' ? 130 : type === 'library' ? 120 : 110;
  const h = type === 'sleep' ? 100 : type === 'library' ? 130 : 120;
  const cls = type === 'sleep' ? 'chibi-sleep' : 'chibi-float';
  return '<div class="chibi-empty"><svg width="' + w + '" height="' + h + '" viewBox="' + vb + '" fill="none" class="' + cls + '">' + s + '</svg><h3>' + title + '</h3><p>' + subtitle + '</p></div>';
}


// ══ MANGA INTRO ══
(function() {
  var visited = false;
  save('lyeiuns-visited', false);
  // Cinematic timing: split starts at 5.5s
  setTimeout(function() {
    var intro = document.getElementById('intro');
    if(intro) intro.classList.add('split');
    // Hide after 1.3s split animation completes
    setTimeout(function() {
      var i2 = document.getElementById('intro');
      if(i2) i2.classList.add('hidden');
    }, 1300);
  }, 5500);
})();

function skipIntro() {
  var intro = document.getElementById('intro');
  if(!intro || intro.classList.contains('hidden')) return;
  intro.classList.add('split');
  setTimeout(function() {
    intro.classList.add('hidden');
  }, 700);
}


// ── READER TAP NAVIGATION ──
let longStripMode = false;
let pageCountTimer = null;

function readerTapLeft() {
  const imgs = document.querySelectorAll('#reader-images img');
  if(!imgs.length || longStripMode) return;
  readerImgIndex = Math.min(imgs.length - 1, readerImgIndex + 1);
  imgs[readerImgIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
  showPageCount(readerImgIndex + 1, imgs.length);
}

function readerTapRight() {
  const imgs = document.querySelectorAll('#reader-images img');
  if(!imgs.length || longStripMode) return;
  readerImgIndex = Math.max(0, readerImgIndex - 1);
  imgs[readerImgIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
  showPageCount(readerImgIndex + 1, imgs.length);
}

function showPageCount(current, total) {
  const el = document.getElementById('reader-page-counter');
  if(!el) return;
  el.textContent = current + ' / ' + total;
  el.classList.add('show');
  clearTimeout(pageCountTimer);
  pageCountTimer = setTimeout(function() { el.classList.remove('show'); }, 2000);
}

function toggleLongStrip() {
  longStripMode = !longStripMode;
  const images = document.getElementById('reader-images');
  const btn = document.getElementById('mode-strip');
  const tapL = document.getElementById('tap-left');
  const tapR = document.getElementById('tap-right');
  if(images) images.classList.toggle('long-strip', longStripMode);
  if(btn) btn.classList.toggle('active', longStripMode);
  if(tapL) tapL.style.display = longStripMode ? 'none' : '';
  if(tapR) tapR.style.display = longStripMode ? 'none' : '';
}

// Reader scroll progress
// ══ READER INTERACTION SYSTEM ══
var readerNavMode = 'double';
var readerLongStrip = false;
var readerNightOn = false;
var readerTapCount = 0;
var readerTapTimer = null;
var readerHideTimer = null;
var readerImgIndex = 0;
var _readerPctTimer = null;

function readerShowControls() {
  var h = document.getElementById('reader-header-ui');
  var n = document.getElementById('reader-nav');
  if(h) h.classList.add('visible');
  if(n) n.classList.add('visible');
  clearTimeout(readerHideTimer);
  if(readerNavMode !== 'always') {
    readerHideTimer = setTimeout(function(){ readerHideControls(); }, 4000);
  }
}
function readerHideControls() {
  if(readerNavMode === 'always') return;
  var h = document.getElementById('reader-header-ui');
  var n = document.getElementById('reader-nav');
  if(h) h.classList.remove('visible');
  if(n) n.classList.remove('visible');
}
function readerToggleControls() {
  var h = document.getElementById('reader-header-ui');
  if(h && h.classList.contains('visible')) readerHideControls();
  else readerShowControls();
}

function readerHandleTap(e) {
  if(!e || !e.target) return;
  var t = e.target;
  if(t.closest) {
    if(t.closest('#reader-nav') || t.closest('#reader-header-ui') ||
       t.closest('#reader-settings-panel')) return;
    if(t.closest('#tap-left')) { readerTapLeft(); return; }
    if(t.closest('#tap-right')) { readerTapRight(); return; }
  }
  readerTapCount++;
  clearTimeout(readerTapTimer);
  readerTapTimer = setTimeout(function() {
    var count = readerTapCount;
    readerTapCount = 0;
    if(count === 1 && readerNavMode === 'single') {
      readerToggleControls();
    } else if(count === 2) {
      readerToggleControls();
      var img = (e.target && e.target.tagName === 'IMG') ? e.target : null;
      if(img) {
        img.style.transition = 'transform 0.15s ease';
        img.style.transform = 'scale(1.05)';
        setTimeout(function(){ img.style.transform = 'scale(1)'; }, 150);
        setTimeout(function(){ img.style.transition = ''; }, 320);
      }
    } else if(count >= 3) {
      openReaderSettings();
    }
  }, 350);
}

function readerTapLeft() {
  if(readerLongStrip) return;
  var imgs = document.querySelectorAll('#reader-images img');
  if(!imgs || !imgs.length) return;
  readerImgIndex = Math.min(imgs.length - 1, readerImgIndex + 1);
  imgs[readerImgIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function readerTapRight() {
  if(readerLongStrip) return;
  var imgs = document.querySelectorAll('#reader-images img');
  if(!imgs || !imgs.length) return;
  readerImgIndex = Math.max(0, readerImgIndex - 1);
  imgs[readerImgIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openReaderSettings() {
  var panel = document.getElementById('reader-settings-panel');
  if(!panel) return;
  panel.style.display = 'flex';
  var st = document.getElementById('rs-strip-toggle');
  var nt = document.getElementById('rs-night-toggle');
  var pt = document.getElementById('rs-perf-toggle');
  if(st) st.classList.toggle('on', readerLongStrip);
  if(nt) nt.classList.toggle('on', readerNightOn);
  if(pt) pt.classList.toggle('on', !!window.readerPerfMode);
  document.querySelectorAll('.rs-mode-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset && b.dataset.mode === readerNavMode);
  });
}
function closeReaderSettings() {
  var p = document.getElementById('reader-settings-panel');
  if(p) p.style.display = 'none';
}
function setReaderNavMode(mode) {
  readerNavMode = mode;
  document.querySelectorAll('.rs-mode-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset && b.dataset.mode === mode);
  });
  if(mode === 'always') readerShowControls();
  closeReaderSettings();
}
function readerToggleLongStrip() {
  readerLongStrip = !readerLongStrip;
  var imgs = document.getElementById('reader-images');
  if(imgs) imgs.classList.toggle('long-strip', readerLongStrip);
  var t = document.getElementById('rs-strip-toggle');
  if(t) t.classList.toggle('on', readerLongStrip);
}
function readerToggleNight() {
  readerNightOn = !readerNightOn;
  var o = document.getElementById('night-overlay');
  if(o) o.style.background = readerNightOn ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)';
  var t = document.getElementById('rs-night-toggle');
  if(t) t.classList.toggle('on', readerNightOn);
}
function toggleReaderPerf() {
  window.readerPerfMode = !window.readerPerfMode;
  var t = document.getElementById('rs-perf-toggle');
  if(t) t.classList.toggle('on', !!window.readerPerfMode);
}
function toggleLongStrip() { readerToggleLongStrip(); }
function toggleNight() { readerToggleNight(); }

// Scroll progress
window.addEventListener('scroll', function() {
  var page = document.querySelector('.page.active');
  if(!page || page.id !== 'page-reader') return;
  var fill = document.getElementById('reader-prog-fill');
  var badge = document.getElementById('reader-pct-badge');
  var pct = Math.min(100, Math.round(
    (window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)) * 100
  ));
  if(fill) fill.style.width = pct + '%';
  if(badge) {
    badge.textContent = pct + '%';
    badge.style.opacity = '1';
    clearTimeout(_readerPctTimer);
    _readerPctTimer = setTimeout(function(){ if(badge) badge.style.opacity = '0'; }, 2000);
  }
}, { passive: true });




// ══ SCANLATION URL MANAGER ══
// Supported sites and their patterns
const SCANLATION_SITES = {
  'asuracomic.net':   { name: 'Asura Scans',   type: 'asura' },
  'asurascans.com':   { name: 'Asura Scans',   type: 'asura' },
  'bato.to':          { name: 'Bato.to',        type: 'bato'  },
  'battwo.com':       { name: 'Bato.to',        type: 'bato'  },
  'flamecomics.me':   { name: 'Flame Comics',   type: 'flame' },
  'flamecomics.xyz':  { name: 'Flame Comics',   type: 'flame' },
  'reaperscans.com':  { name: 'Reaper Scans',   type: 'reaper'},
  'luminousscans.com':{ name: 'Luminous Scans', type: 'generic'},
  'mangabuddy.com':   { name: 'MangaBuddy',     type: 'generic'},
};

function detectSite(url) {
  try {
    var host = new URL(url).hostname.replace('www.','');
    return SCANLATION_SITES[host] || { name: host, type: 'generic' };
  } catch(e) { return null; }
}

async function addScanlationUrl() {
  var input = document.getElementById('scanlation-url-input');
  var status = document.getElementById('scanlation-url-status');
  var url = (input ? input.value : '').trim();
  
  if(!url) { if(status) status.textContent = '⚠️ Please enter a URL'; return; }
  if(!url.startsWith('http')) { if(status) status.textContent = '⚠️ Must be a full URL starting with https://'; return; }
  
  var site = detectSite(url);
  if(!status) return;
  status.style.color = 'var(--muted)';
  status.textContent = '⏳ Fetching manga info...';

  try {
    // Fetch the page through our CF proxy
    var proxyUrl = CF_PROXY + '/scrape?url=' + encodeURIComponent(url);
    var res = await fetch(proxyUrl);
    if(!res.ok) throw new Error('Proxy returned ' + res.status);
    var html = await res.text();
    
    // Parse title and cover from the HTML
    var parsed = parseScanlationPage(html, url, site);
    if(!parsed) throw new Error('Could not parse page - site may not be supported yet');
    
    // Save to external titles in localStorage
    var externals = load('lyeiuns-external', []);
    // Check if already added
    if(externals.find(function(e){ return e.url === url; })) {
      status.style.color = 'orange';
      status.textContent = '⚠️ Already added!';
      return;
    }
    externals.unshift({ url, title: parsed.title, cover: parsed.cover, site: site.name, chapters: parsed.chapters, addedAt: Date.now() });
    save('lyeiuns-external', externals);
    
    status.style.color = '#4ade80';
    status.textContent = '✅ Added: ' + parsed.title + ' (' + parsed.chapters.length + ' chapters found)';
    if(input) input.value = '';
    renderExternalTitles();
  } catch(e) {
    status.style.color = '#e63946';
    status.textContent = '❌ ' + e.message + '. Try copying the exact manga page URL.';
  }
}

function parseScanlationPage(html, sourceUrl, site) {
  // Use DOMParser to extract info from fetched HTML
  var parser = new DOMParser();
  var doc = parser.parseFromString(html, 'text/html');
  
  // Title - try common selectors across scanlation sites
  var title = '';
  var titleSelectors = ['h1.entry-title','h1.manga-title','.seriestuheader h1','.post-title h1','h1[class*="title"]','h1[class*="manga"]','h1[class*="series"]','h1','og:title'];
  for(var sel of titleSelectors) {
    var el = sel.startsWith('og:') 
      ? doc.querySelector('meta[property="og:title"]')
      : doc.querySelector(sel);
    if(el) { 
      title = sel.startsWith('og:') ? (el.getAttribute('content')||'') : el.textContent.trim();
      if(title) break; 
    }
  }
  
  // Cover image
  var cover = '';
  var coverSelectors = ['meta[property="og:image"]','img.manga-cover','img.wp-post-image','.thumb img','.summary_image img','img[class*="cover"]'];
  for(var csel of coverSelectors) {
    var cel = doc.querySelector(csel);
    if(cel) {
      cover = cel.getAttribute('content') || cel.getAttribute('src') || cel.getAttribute('data-src') || '';
      if(cover) break;
    }
  }
  // Make cover absolute URL
  if(cover && cover.startsWith('/')) {
    try { cover = new URL(cover, sourceUrl).href; } catch(e) {}
  }
  
  // Chapter list - try common patterns
  var chapters = [];
  var chSelectors = ['.wp-manga-chapter a','li.chapter a','.chapter-li a','.chapter-list a','a[href*="chapter"]','a[href*="ch-"]'];
  for(var chSel of chSelectors) {
    var links = doc.querySelectorAll(chSel);
    if(links.length > 0) {
      links.forEach(function(link) {
        var href = link.getAttribute('href') || '';
        if(href && href.startsWith('/')) { try { href = new URL(href, sourceUrl).href; } catch(e){} }
        var chTitle = link.textContent.trim();
        var numMatch = chTitle.match(/chapter\s*([\d.]+)/i) || href.match(/chapter[/-]([\d.]+)/i) || href.match(/ch[/-]([\d.]+)/i);
        if(href && numMatch) {
          chapters.push({ num: numMatch[1], title: chTitle, url: href });
        }
      });
      if(chapters.length > 0) break;
    }
  }
  
  if(!title) return null;
  return { title, cover, chapters };
}

function renderExternalTitles() {
  var externals = load('lyeiuns-external', []);
  var section = document.getElementById('external-titles-section');
  var grid = document.getElementById('external-titles-grid');
  if(!section || !grid) return;
  
  if(!externals.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  
  grid.innerHTML = externals.map(function(ext, i) {
    var coverHtml = ext.cover 
      ? '<img src="' + CF_PROXY + '/img?url=' + encodeURIComponent(ext.cover) + '" style="width:56px;height:76px;object-fit:cover;flex-shrink:0" onerror="this.style.opacity=0">'
      : '<div style="width:56px;height:76px;background:var(--surface2);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px">📖</div>';
    return '<div style="background:var(--surface);border:1px solid var(--border);padding:12px;display:flex;gap:12px;align-items:center">' +
      coverHtml +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:9px;letter-spacing:1px;color:var(--manga-red);margin-bottom:3px">' + (ext.site||'External') + '</div>' +
        '<div style="font-size:14px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (ext.title||'Unknown') + '</div>' +
        '<div style="font-size:11px;color:var(--muted);margin-top:3px">' + (ext.chapters ? ext.chapters.length : 0) + ' chapters</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">' +
        '<button onclick="openExternalTitle(' + i + ')" style="background:var(--manga-red);border:none;color:white;padding:6px 12px;font-size:12px;letter-spacing:1px;cursor:pointer;touch-action:manipulation">READ</button>' +
        '<button onclick="refreshExternalTitle(' + i + ')" style="background:var(--surface2);border:1px solid var(--border);color:var(--muted);padding:6px 12px;font-size:11px;cursor:pointer;touch-action:manipulation">↺ SYNC</button>' +
        '<button onclick="removeExternalTitle(' + i + ')" style="background:none;border:1px solid var(--border);color:var(--muted);padding:6px 12px;font-size:11px;cursor:pointer;touch-action:manipulation">✕</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function openExternalTitle(idx) {
  var externals = load('lyeiuns-external', []);
  var ext = externals[idx];
  if(!ext || !ext.chapters || !ext.chapters.length) { toast('No chapters found'); return; }
  
  // Build a fake manga object for the reader
  S.currentManga = {
    id: 'external_' + idx,
    _external: true,
    _extData: ext,
    attributes: { title: { en: ext.title }, tags: [], altTitles: [] },
    relationships: ext.cover ? [{ type: 'cover_art', _directUrl: ext.cover }] : []
  };
  
  // Build chapter list (newest first)
  S.currentChapters = ext.chapters.slice().reverse().map(function(ch, i) {
    return {
      id: 'ext_ch_' + i,
      _externalUrl: ch.url,
      _source: 'external',
      attributes: { chapter: ch.num, title: ch.title || ('Chapter ' + ch.num), publishAt: new Date().toISOString() }
    };
  });
  
  navigate('detail');
  var coverImg = document.getElementById('detail-cover-img');
  var backdrop = document.getElementById('detail-backdrop');
  if(coverImg) coverImg.src = ext.cover ? CF_PROXY + '/img?url=' + encodeURIComponent(ext.cover) : '';
  if(backdrop && ext.cover) backdrop.style.backgroundImage = 'url(' + CF_PROXY + '/img?url=' + encodeURIComponent(ext.cover) + ')';
  var titleEl = document.getElementById('detail-title');
  if(titleEl) titleEl.textContent = ext.title || 'Unknown';
  var typeEl = document.getElementById('detail-type');
  if(typeEl) typeEl.textContent = ext.site || 'External';
  var descEl = document.getElementById('detail-desc');
  if(descEl) descEl.textContent = 'From ' + (ext.site || 'external site') + ' · ' + ext.chapters.length + ' chapters';
  var metaEl = document.getElementById('detail-meta');
  if(metaEl) metaEl.innerHTML = '<span class="meta-pill" style="border-color:var(--manga-red);color:var(--manga-red)">🌐 External</span>';
  var chList = document.getElementById('chapter-list');
  if(chList) {
    chList.innerHTML = S.currentChapters.map(function(ch, i) {
      return '<div class="chapter-item' + (isChRead(ch.id) ? ' read' : '') + '" onclick="openChapter(' + JSON.stringify(ch.id) + ',' + JSON.stringify(ch.attributes.chapter) + ',' + i + ')">' +
        '<div class="chapter-num">CH ' + ch.attributes.chapter + '</div>' +
        '<div class="chapter-name">' + (ch.attributes.title || '') + '</div>' +
        '<div class="chapter-date"></div>' +
        '<div class="ch-read-dot"></div>' +
      '</div>';
    }).join('');
  }
}

async function openExternalChapter(chapterId, chapterNum, idx) {
  S.currentChIdx = idx;
  navigate('reader');
  var ch = S.currentChapters[idx];
  if(!ch || !ch._externalUrl) { toast('Chapter URL not found'); return; }
  
  var titleEl = document.getElementById('reader-title');
  var chInfo = document.getElementById('reader-ch-info');
  var prevBtn = document.getElementById('prev-btn');
  var nextBtn = document.getElementById('next-btn');
  var imgContainer = document.getElementById('reader-images');
  
  if(titleEl) titleEl.textContent = (S.currentManga ? getTitle(S.currentManga) : '') + ' — Ch. ' + chapterNum;
  if(chInfo) chInfo.textContent = 'CH ' + chapterNum;
  if(prevBtn) prevBtn.disabled = idx >= S.currentChapters.length - 1;
  if(nextBtn) nextBtn.disabled = idx <= 0;
  if(imgContainer) imgContainer.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading pages...</span></div>';

  markChRead(chapterId);

  try {
    // Fetch the chapter page through our proxy
    var proxyUrl = CF_PROXY + '/scrape?url=' + encodeURIComponent(ch._externalUrl);
    var res = await fetch(proxyUrl);
    if(!res.ok) throw new Error('Failed to fetch chapter');
    var html = await res.text();
    
    // Parse images from chapter page
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    var pages = [];
    
    // Common image selectors across scanlation sites
    var imgSelectors = ['.reading-content img','.chapter-img img','#readerarea img','.page-break img','.wp-manga-chapter-img','.reader-area img','img[class*="page"]','img[data-src]'];
    for(var sel of imgSelectors) {
      var imgs = doc.querySelectorAll(sel);
      if(imgs.length > 1) {
        imgs.forEach(function(img) {
          var src = img.getAttribute('data-lazy-src') || img.getAttribute('data-src') || img.getAttribute('src') || '';
          if(src && src.match(/\.(jpg|jpeg|png|webp|gif)/i)) pages.push(src);
        });
        if(pages.length > 0) break;
      }
    }
    
    if(!pages.length) throw new Error('No images found on chapter page');
    
    if(imgContainer) {
      imgContainer.innerHTML = pages.map(function(src) {
        var proxied = CF_PROXY + '/img?url=' + encodeURIComponent(src);
        return '<img src="' + proxied + '" alt="" loading="lazy" style="width:100%;display:block" onerror="this.style.opacity=0.3">';
      }).join('');
    }
    window.scrollTo(0, 0);
  } catch(e) {
    if(imgContainer) imgContainer.innerHTML = '<div class="empty"><div class="empty-icon">😵</div><h3>Failed to load</h3><p>' + e.message + '</p><p style="margin-top:8px;font-size:11px;color:var(--muted)">Some sites block scraping. Try opening directly: <a href="' + ch._externalUrl + '" target="_blank" style="color:var(--manga-red)">' + ch._externalUrl + '</a></p></div>';
  }
}

async function refreshExternalTitle(idx) {
  var externals = load('lyeiuns-external', []);
  var ext = externals[idx];
  if(!ext) return;
  var status = document.getElementById('scanlation-url-status');
  if(status) { status.style.color = 'var(--muted)'; status.textContent = '⏳ Refreshing ' + ext.title + '...'; }
  try {
    var proxyUrl = CF_PROXY + '/scrape?url=' + encodeURIComponent(ext.url);
    var res = await fetch(proxyUrl);
    var html = await res.text();
    var site = detectSite(ext.url);
    var parsed = parseScanlationPage(html, ext.url, site);
    if(parsed && parsed.chapters.length) {
      externals[idx].chapters = parsed.chapters;
      externals[idx].title = parsed.title || ext.title;
      save('lyeiuns-external', externals);
      if(status) { status.style.color = '#4ade80'; status.textContent = '✅ Synced! ' + parsed.chapters.length + ' chapters'; }
      renderExternalTitles();
    } else {
      if(status) { status.style.color = 'orange'; status.textContent = '⚠️ No new chapters found'; }
    }
  } catch(e) {
    if(status) { status.style.color = '#e63946'; status.textContent = '❌ Sync failed: ' + e.message; }
  }
}

function removeExternalTitle(idx) {
  var externals = load('lyeiuns-external', []);
  externals.splice(idx, 1);
  save('lyeiuns-external', externals);
  renderExternalTitles();
  toast('Removed');
}


async function openComickFromSearch(slug, title, cover) {
  navigate('detail');
  var chList = document.getElementById('chapter-list');
  if(chList) chList.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading from Comick...</span></div>';

  try {
    // Get comic details
    var res = await fetch('https://api.comick.fun/comic/' + slug + '?tachiyomi=true');
    var data = await res.json();
    var comic = data.comic || data;

    // Get chapters
    var chapRes = await fetch('https://api.comick.fun/comic/' + (comic.hid || slug) + '/chapters?lang=en&limit=300&page=1');
    var chapData = await chapRes.json();
    var chapters = (chapData.chapters || []).reverse();

    S.currentManga = {
      id: 'comick_' + slug,
      _comickHid: comic.hid || slug,
      _source: 'comick',
      attributes: {
        title: { en: comic.title || title },
        description: { en: comic.desc || '' },
        status: comic.status === 1 ? 'ongoing' : 'completed',
        tags: (comic.genres || []).map(function(g){ return { attributes: { name: { en: g.name || g } } }; }),
        altTitles: []
      },
      relationships: cover ? [{ type: 'cover_art', _directUrl: cover }] : []
    };

    S.currentChapters = chapters.map(function(ch, i) {
      return {
        id: 'comick_ch_' + (ch.hid || i),
        _comickHid: ch.hid,
        _source: 'comick',
        attributes: { chapter: ch.chap || String(i+1), title: ch.title || '', publishAt: ch.created_at || '' }
      };
    }).reverse();

    // Render detail page
    var coverUrl = cover || (comic.cover_url ? CF_PROXY + '/img?url=' + encodeURIComponent(comic.cover_url) : '');
    var coverEl = document.getElementById('detail-cover-img');
    var backdrop = document.getElementById('detail-backdrop');
    if(coverEl) coverEl.src = coverUrl;
    if(backdrop && coverUrl) backdrop.style.backgroundImage = 'url(' + coverUrl + ')';
    var titleEl = document.getElementById('detail-title');
    if(titleEl) titleEl.textContent = comic.title || title;
    var typeEl = document.getElementById('detail-type');
    if(typeEl) typeEl.textContent = 'via Comick.io';
    var descEl = document.getElementById('detail-desc');
    if(descEl) descEl.textContent = comic.desc || 'No description available.';
    var metaEl = document.getElementById('detail-meta');
    if(metaEl) metaEl.innerHTML = '<span class="meta-pill" style="border-color:#e63946;color:#e63946">🌐 Comick</span>' +
      (comic.status === 1 ? '<span class="meta-pill green">Ongoing</span>' : '') +
      (comic.year ? '<span class="meta-pill">' + comic.year + '</span>' : '');

    if(!S.currentChapters.length) {
      if(chList) chList.innerHTML = '<div class="empty"><p>No English chapters on Comick</p></div>';
      return;
    }

    if(chList) {
      chList.innerHTML = S.currentChapters.map(function(ch, i) {
        return '<div class="chapter-item' + (isChRead(ch.id) ? ' read' : '') + '" onclick="openChapter(' + JSON.stringify(ch.id) + ',' + JSON.stringify(ch.attributes.chapter) + ',' + i + ')">' +
          '<div class="chapter-num">CH ' + ch.attributes.chapter + '</div>' +
          '<div class="chapter-name">' + (ch.attributes.title || 'Chapter ' + ch.attributes.chapter) + '</div>' +
          '<div class="chapter-date">' + timeAgo(ch.attributes.publishAt) + '</div>' +
          '<div class="ch-read-dot"></div></div>';
      }).join('');
    }
  } catch(e) {
    if(chList) chList.innerHTML = '<div class="empty"><p>Failed to load from Comick: ' + e.message + '</p></div>';
  }
}

async function openComickChapterDirect(chapterId, chapterNum, idx) {
  S.currentChIdx = idx;
  navigate('reader');
  var ch = S.currentChapters[idx];
  if(!ch || !ch._comickHid) { toast('Chapter not found'); return; }

  var titleEl = document.getElementById('reader-title');
  var chInfo = document.getElementById('reader-ch-info');
  var prevBtn = document.getElementById('prev-btn');
  var nextBtn = document.getElementById('next-btn');
  var imgContainer = document.getElementById('reader-images');

  if(titleEl) titleEl.textContent = (S.currentManga ? getTitle(S.currentManga) : '') + ' — Ch. ' + chapterNum;
  if(chInfo) chInfo.textContent = 'CH ' + chapterNum;
  if(prevBtn) prevBtn.disabled = idx >= S.currentChapters.length - 1;
  if(nextBtn) nextBtn.disabled = idx <= 0;
  if(imgContainer) imgContainer.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading pages...</span></div>';

  markChRead(chapterId);

  try {
    var res = await fetch('https://api.comick.fun/chapter/' + ch._comickHid + '?tachiyomi=true');
    var data = await res.json();
    var images = data.chapter && data.chapter.md_images ? data.chapter.md_images : [];
    var pages = images.map(function(img) {
      return 'https://meo.comick.pictures/' + img.b2key;
    });

    if(!pages.length) throw new Error('No pages found');

    if(imgContainer) {
      imgContainer.innerHTML = pages.map(function(src) {
        return '<img src="' + CF_PROXY + '/img?url=' + encodeURIComponent(src) + '" alt="" loading="lazy" style="width:100%;display:block">';
      }).join('');
    }
    window.scrollTo(0, 0);
  } catch(e) {
    if(imgContainer) imgContainer.innerHTML = '<div class="empty"><p>Failed: ' + e.message + '</p></div>';
  }
}





// Multi-source chapter picker
async function loadChaptersForSource(url, sourceBtn) {
  const chList = document.getElementById('chapter-list');
  if(!chList) return;
  // Mark active
  document.querySelectorAll('.source-btn').forEach(function(b){ b.classList.remove('active'); });
  if(sourceBtn) sourceBtn.classList.add('active');
  chList.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading chapters...</span></div>';
  try {
    const res = await fetch(CSAPI + '/api/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    });
    if(!res.ok) throw new Error('status ' + res.status);
    const data = await res.json();
    const chapters = (data.chapters || []).sort(function(a,b){ return parseFloat(b.number||0)-parseFloat(a.number||0); });
    if(!chapters.length) { chList.innerHTML = '<div class="empty"><p>No chapters from this source</p></div>'; return; }

    // Rebuild currentChapters for this source
    S.currentChapters = chapters.map(function(ch, i) {
      return {
        id: 'extapi_ch_' + i,
        _externalUrl: ch.url,
        _source: data.source || 'External',
        attributes: { chapter: String(ch.number || i+1), title: ch.title || '', publishAt: '' }
      };
    });

    chList.innerHTML = S.currentChapters.map(function(ch, i) {
      return '<div class="chapter-item' + (isChRead(ch.id) ? ' read' : '') + '" onclick="openChapter(' + JSON.stringify(ch.id) + ',' + JSON.stringify(ch.attributes.chapter) + ',' + i + ')">' +
        '<div class="chapter-num">CH ' + ch.attributes.chapter + '</div>' +
        '<div class="chapter-name">' + (ch.attributes.title || '') + '</div>' +
        '<div class="chapter-date"></div><div class="ch-read-dot"></div></div>';
    }).join('');
  } catch(e) {
    chList.innerHTML = '<div class="empty"><p>Failed: ' + e.message + '</p></div>';
  }
}

async function openExternalFromAPI(url, title, cover) {
  if(!url) { toast('No URL'); return; }
  navigate('detail');
  const coverEl = document.getElementById('detail-cover-img');
  const backdrop = document.getElementById('detail-backdrop');
  const titleEl = document.getElementById('detail-title');
  const typeEl = document.getElementById('detail-type');
  const descEl = document.getElementById('detail-desc');
  const metaEl = document.getElementById('detail-meta');
  const chList = document.getElementById('chapter-list');
  const pickerEl = document.getElementById('source-picker-container');
  if(coverEl) coverEl.src = cover||'';
  if(backdrop && cover) backdrop.style.backgroundImage = 'url('+cover+')';
  if(titleEl) titleEl.textContent = title||'Unknown';
  if(typeEl) typeEl.textContent = 'External';
  if(descEl) descEl.textContent = 'Finding chapters...';
  if(metaEl) metaEl.innerHTML = '<span class="meta-pill" style="border-color:#e63946;color:#e63946">🌐 Comix</span>';
  if(pickerEl) pickerEl.innerHTML = '';
  if(chList) chList.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading chapters...</span></div>';

  S.currentManga = {
    id: 'ext_'+Date.now(),
    _externalUrl: url,
    attributes: { title:{en:title}, tags:[], altTitles:[] },
    relationships: cover ? [{type:'cover_art', _directUrl:cover}] : []
  };
  S.currentChapters = [];

  // Load chapters from comix.to immediately
  await loadChaptersForSource(url, null);

  // Then search for other sources in background
  try {
    const searchRes = await fetch(CSAPI+'/api/search', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({query:title, source:'all'})
    });
    const searchData = await searchRes.json();
    const allSources = Array.isArray(searchData) ? searchData : [];
    
    const sourceUrls = [{name:'Comix', url:url}];
    allSources.forEach(function(sr) {
      const results = sr.results||[];
      const match = results.find(r=>r.title&&title&&r.title.toLowerCase().includes(title.toLowerCase().substring(0,8))) || results[0];
      if(match && match.url && match.url !== url) {
        sourceUrls.push({name: sr.source||'External', url: match.url});
      }
    });

    if(sourceUrls.length > 1 && pickerEl) {
      pickerEl.innerHTML = '<div class="source-picker">' +
        sourceUrls.map((s,i)=>'<button class="source-btn'+(i===0?' active':'')+'" onclick="loadChaptersForSource('+JSON.stringify(s.url)+', this)">'+s.name+'</button>').join('') +
        '</div>';
    }
  } catch(e) {}
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
applyTheme();
renderLibrary();
renderContinue();
updateStreak();
// Activate home page and bottom nav
showPage("home");
// Stagger API calls to avoid MangaDex rate limiting
setTimeout(function(){ updateNavPill("home"); }, 100);
setTimeout(function(){ loadBanner(); }, 0);
setTimeout(function(){ loadPopular(); }, 400);
setTimeout(function(){ loadFeatured(); }, 800);
setTimeout(function(){ loadTop10(); }, 1200);
setTimeout(function(){ loadRecent(); }, 1600);
setTimeout(function(){ loadWeek(); }, 2000);

// ═══════════════════════════════════════════════════════════════════════════
//  ASURA SCANS — Phase 2 · Step 1 (browse + chapter list only; no reading yet)
//  Browse: scrape /series-ranking.  Chapters: parse the series page.
//  Fully isolated from the MangaDex code above.
// ═══════════════════════════════════════════════════════════════════════════
const ASURA = 'https://asurascans.com';

async function asuraScrape(url){
  const res = await fetch(CF_PROXY + '/scrape?url=' + encodeURIComponent(url));
  if(!res.ok) throw new Error('scrape ' + res.status);
  return await res.text();
}
function asuraImg(url){ return CF_PROXY + '/img?url=' + encodeURIComponent(url); }

// Parse /series-ranking → [{slug,title,cover,rating}]
function asuraParseList(html){
  const out = [], seen = {};
  const re = /<a[^>]+href="(?:https?:\/\/asurascans\.com)?\/comics\/([^"\/?#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while((m = re.exec(html))){
    const slug = m[1], inner = m[2];
    if(seen[slug]) continue;
    const cov = (inner.match(/https:\/\/cdn\.asurascans\.com\/[^"'\s)]+\.webp/i) || [null])[0];
    if(!cov) continue; // skip nav links with no cover
    let title = (inner.match(/alt="([^"]+)"/i) || [null,null])[1];
    if(!title){
      const txt = inner.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      title = (txt.split(/\s{2,}/)[0] || txt || slug);
    }
    const rating = (inner.match(/\b(\d{1,2}\.\d)\b/) || [null,null])[1];
    seen[slug] = 1;
    out.push({ slug, title: title.trim(), cover: cov, rating });
  }
  return out;
}

function asuraCard(s, i){
  return '<div class="manga-card" onclick="openAsuraByIdx('+i+')">' +
    '<div class="manga-cover"><img src="'+asuraImg(s.cover)+'" alt="" loading="lazy" onerror="this.style.opacity=0.3">' +
    '<div class="manga-badge">ASURA</div></div>' +
    '<div class="manga-info"><div class="manga-title">'+(s.title||s.slug)+'</div>' +
    '<div class="manga-sub">'+(s.rating?('★ '+s.rating):'Manhwa')+'</div></div></div>';
}

async function loadAsura(){
  const el = document.getElementById('asura-grid');
  if(!el) return;
  try {
    const html = await asuraScrape(ASURA + '/series-ranking');
    const list = asuraParseList(html);
    if(!list.length) throw new Error('no series parsed');
    S.asuraList = list;
    el.innerHTML = list.slice(0,30).map(function(s,i){ return asuraCard(s,i); }).join('');
  } catch(e){
    el.innerHTML = '<div class="empty"><p>Asura unavailable</p><span style="font-size:11px;opacity:0.5">'+e.message+'</span></div>';
  }
}

function openAsuraByIdx(i){
  const s = (S.asuraList||[])[i];
  if(s) openAsuraSeries(s.slug, s.title);
}

// Parse a series page → array of chapter numbers (desc). Fallback: build 1..count.
function asuraParseSeries(html){
  const nums = {};
  const re = /\/comics\/[^"\/]+\/chapter\/(\d+(?:\.\d+)?)/gi;
  let m;
  while((m = re.exec(html))){ nums[m[1]] = 1; }
  let chapters = Object.keys(nums).map(parseFloat).filter(function(n){return !isNaN(n);}).sort(function(a,b){return b-a;});
  if(chapters.length <= 1){
    const cm = html.match(/([\d,]+)\s*(?:<[^>]*>\s*)*Chapters/i) || html.match(/Chapters[\s\S]{0,40}?([\d,]+)/i);
    const n = cm ? parseInt(cm[1].replace(/,/g,''),10) : 0;
    if(n > 1){ chapters = []; for(let k=n;k>=1;k--) chapters.push(k); }
  }
  return chapters;
}

async function openAsuraSeries(slug, title){
  const ov = document.getElementById('asura-overlay');
  const head = document.getElementById('asura-detail-head');
  const list = document.getElementById('asura-chapters');
  if(!ov) return;
  ov.style.display = 'block';
  window.scrollTo(0,0);
  head.innerHTML = '<div style="font-family:Bebas Neue,sans-serif;font-size:28px;letter-spacing:1px">'+(title||slug)+'</div>' +
                   '<div style="color:var(--muted,#888);font-size:12px;margin-top:4px">Asura Scans</div>';
  list.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading chapters...</span></div>';
  try {
    const html = await asuraScrape(ASURA + '/comics/' + slug);
    const chapters = asuraParseSeries(html);
    if(!chapters.length) throw new Error('no chapters found');
    S.asuraCurrent = { slug, title, chapters };
    list.innerHTML = chapters.map(function(n){
      return '<div onclick="openAsuraChapter(\''+slug+'\','+n+')" style="padding:12px 14px;border:1px solid var(--border,#2a2420);border-radius:8px;margin-bottom:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">' +
        '<span>Chapter '+n+'</span><span style="color:var(--muted,#888);font-size:11px">ASURA</span></div>';
    }).join('');
  } catch(e){
    list.innerHTML = '<div class="empty"><p>Couldn\u0027t load chapters</p><span style="font-size:11px;opacity:0.5">'+e.message+'</span></div>';
  }
}

function closeAsuraDetail(){
  const ov = document.getElementById('asura-overlay');
  if(ov) ov.style.display = 'none';
}

// ── Step 2: READING ─────────────────────────────────────────────────────────
// Pages live under ONE of two folders depending on the series:
//   cdn.asurascans.com/asura-images/chapters/<slug>/<num>/NNN.webp
//   cdn.asurascans.com/asura-images/chapters-restored/<slug>/<num>/NNN.webp
// We detect which folder works for page 1, then load 001,002... until a 404.
function asuraPageUrl(folder, slug, chap, pageNum){
  const nnn = String(pageNum).padStart(3,'0');
  const raw = 'https://cdn.asurascans.com/asura-images/' + folder + '/' + slug + '/' + chap + '/' + nnn + '.webp';
  return CF_PROXY + '/img?url=' + encodeURIComponent(raw);
}

// Check if a page exists (via image load). Resolves true/false.
function asuraPageExists(url){
  return new Promise(function(resolve){
    const img = new Image();
    let done = false;
    const finish = function(ok){ if(!done){ done = true; resolve(ok); } };
    img.onload = function(){ finish(img.naturalWidth > 0); };
    img.onerror = function(){ finish(false); };
    img.src = url;
    setTimeout(function(){ finish(false); }, 15000);
  });
}

async function openAsuraChapter(slug, num){
  const head = document.getElementById('asura-detail-head');
  const list = document.getElementById('asura-chapters');
  if(!list) return;
  window.scrollTo(0,0);
  if(head) head.innerHTML = '<div style="font-family:Bebas Neue,sans-serif;font-size:24px;letter-spacing:1px">Chapter ' + num + '</div>' +
    '<button onclick="backToAsuraChapters()" style="margin-top:10px;background:var(--surface,#1a1410);border:1px solid var(--border,#2a2420);color:#fff;padding:6px 14px;border-radius:8px;cursor:pointer">← Chapter list</button>';
  list.innerHTML = '<div class="loading"><div class="spinner"></div><span>Finding pages...</span></div>';

  // Detect which folder this series uses (test page 1 in each).
  let folder = null;
  const candidates = ['chapters', 'chapters-restored'];
  for(let i=0;i<candidates.length;i++){
    if(await asuraPageExists(asuraPageUrl(candidates[i], slug, num, 1))){ folder = candidates[i]; break; }
  }
  if(!folder){
    list.innerHTML = '<div class="empty"><p>No pages found for this chapter.</p>' +
      '<button onclick="backToAsuraChapters()" style="margin-top:10px;padding:6px 16px;background:var(--manga-red,#e63946);border:none;color:#fff;border-radius:6px;cursor:pointer">← Back</button></div>';
    return;
  }

  // Set up the reader container; pages will be appended as they're confirmed.
  list.innerHTML = '<div id="asura-reader" style="max-width:800px;margin:0 auto"></div>' +
    '<div id="asura-reader-status" style="text-align:center;padding:16px;color:var(--muted,#888);font-size:12px">Loading pages…</div>';
  const reader = document.getElementById('asura-reader');

  // Probe pages in parallel BATCHES; render each batch in order, stop when a batch has a gap.
  const BATCH = 8;       // pages probed at once
  const MAX = 300;
  let total = 0;
  let start = 1;
  let stop = false;
  while(!stop && start <= MAX){
    const batch = [];
    for(let p = start; p < start + BATCH; p++) batch.push(p);
    // Check all pages in this batch at the same time
    const results = await Promise.all(batch.map(function(p){
      return asuraPageExists(asuraPageUrl(folder, slug, num, p)).then(function(ok){ return { p: p, ok: ok }; });
    }));
    // Append pages in order until the first missing one
    for(let i=0;i<results.length;i++){
      if(results[i].ok){
        const img = document.createElement('img');
        img.src = asuraPageUrl(folder, slug, num, results[i].p);
        img.loading = 'lazy';
        img.style.cssText = 'width:100%;display:block';
        reader.appendChild(img);
        total++;
      } else {
        stop = true; // first gap = end of chapter
        break;
      }
    }
    start += BATCH;
  }

  const status = document.getElementById('asura-reader-status');
  if(status){
    status.innerHTML = total
      ? '<button onclick="backToAsuraChapters()" style="padding:10px 24px;background:var(--manga-red,#e63946);border:none;color:#fff;border-radius:8px;cursor:pointer">← Chapter list</button>'
      : 'No pages found.';
  }
}

function backToAsuraChapters(){
  const c = S.asuraCurrent;
  if(c){ openAsuraSeries(c.slug, c.title); }
  else { closeAsuraDetail(); }
}

// Kick off Asura section after the MangaDex loaders
setTimeout(function(){ loadAsura(); }, 2400);

// ═══════════════════════════════════════════════════════════════════════════
//  WEEB CENTRAL — Phase 3 (browse + chapter list + reading)
//  Browse:   scrape homepage, parse /series/<id>/<slug> links (covers deterministic).
//  Chapters: scrape /series/<id>/full-chapter-list.
//  Pages:    scrape /chapters/<id>/images?... → real scans.lastation.us URLs.
//  Fully isolated from MangaDex + Asura.
// ═══════════════════════════════════════════════════════════════════════════
const WC = 'https://weebcentral.com';

async function wcScrape(url){
  const res = await fetch(CF_PROXY + '/scrape?url=' + encodeURIComponent(url));
  if(!res.ok) throw new Error('scrape ' + res.status);
  return await res.text();
}
function wcImg(url){ return CF_PROXY + '/img?url=' + encodeURIComponent(url); }
function wcCover(id){ return 'https://temp.compsci88.com/cover/fallback/' + id + '.jpg'; }
function wcTitleFromSlug(slug){
  try { slug = decodeURIComponent(slug); } catch(e){}
  return slug.replace(/-/g,' ').replace(/\s+/g,' ').trim();
}

// Parse homepage → unique [{id,title,slug}]
function wcParseList(html){
  const out = [], seen = {};
  const re = /weebcentral\.com\/series\/([0-9A-Z]{26})\/([^"'?#\s]+)/g;
  let m;
  while((m = re.exec(html))){
    const id = m[1], slug = m[2];
    if(seen[id]) continue;
    seen[id] = 1;
    out.push({ id: id, slug: slug, title: wcTitleFromSlug(slug) });
  }
  return out;
}

function wcCard(s, i){
  return '<div class="manga-card" onclick="openWCByIdx('+i+')">' +
    '<div class="manga-cover"><img src="'+wcImg(wcCover(s.id))+'" alt="" loading="lazy" onerror="this.style.opacity=0.3">' +
    '<div class="manga-badge">WEEB</div></div>' +
    '<div class="manga-info"><div class="manga-title">'+(s.title||s.slug)+'</div>' +
    '<div class="manga-sub">Manga</div></div></div>';
}

async function loadWeebCentral(){
  const el = document.getElementById('wc-grid');
  if(!el) return;
  try {
    const html = await wcScrape(WC + '/');
    const list = wcParseList(html);
    if(!list.length) throw new Error('no series parsed');
    S.wcList = list;
    el.innerHTML = list.slice(0,30).map(function(s,i){ return wcCard(s,i); }).join('');
  } catch(e){
    el.innerHTML = '<div class="empty"><p>Weeb Central unavailable</p><span style="font-size:11px;opacity:0.5">'+e.message+'</span></div>';
  }
}

function openWCByIdx(i){
  const s = (S.wcList||[])[i];
  if(s) openWCSeries(s.id, s.title);
}

// Parse full-chapter-list → [{id,label}] (newest first as returned)
function wcParseChapters(html){
  const out = [], seen = {};
  const re = /\/chapters\/([0-9A-Z]{26})"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while((m = re.exec(html))){
    const id = m[1];
    if(seen[id]) continue;
    seen[id] = 1;
    let label = m[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    if(!label) label = 'Chapter';
    out.push({ id: id, label: label });
  }
  return out;
}

async function openWCSeries(id, title){
  const ov = document.getElementById('wc-overlay');
  const head = document.getElementById('wc-detail-head');
  const list = document.getElementById('wc-chapters');
  if(!ov) return;
  ov.style.display = 'block';
  window.scrollTo(0,0);
  head.innerHTML = '<div style="font-family:Bebas Neue,sans-serif;font-size:28px;letter-spacing:1px">'+(title||'')+'</div>' +
                   '<div style="color:var(--muted,#888);font-size:12px;margin-top:4px">Weeb Central</div>';
  list.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading chapters...</span></div>';
  try {
    const html = await wcScrape(WC + '/series/' + id + '/full-chapter-list');
    const chapters = wcParseChapters(html);
    if(!chapters.length) throw new Error('no chapters found');
    S.wcCurrent = { id: id, title: title, chapters: chapters };
    list.innerHTML = chapters.map(function(c){
      return '<div onclick="openWCChapter(\''+c.id+'\',\''+c.label.replace(/'/g,"\\'")+'\')" style="padding:12px 14px;border:1px solid var(--border,#2a2420);border-radius:8px;margin-bottom:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">' +
        '<span>'+c.label+'</span><span style="color:var(--muted,#888);font-size:11px">WEEB</span></div>';
    }).join('');
  } catch(e){
    list.innerHTML = '<div class="empty"><p>Couldn\u0027t load chapters</p><span style="font-size:11px;opacity:0.5">'+e.message+'</span></div>';
  }
}

function closeWCDetail(){
  const ov = document.getElementById('wc-overlay');
  if(ov) ov.style.display = 'none';
}

function backToWCChapters(){
  const c = S.wcCurrent;
  if(c){ openWCSeries(c.id, c.title); }
  else { closeWCDetail(); }
}

// Extract real page-image URLs from the images-endpoint HTML.
function wcParsePages(html){
  const out = [], seen = {};
  const re = /https?:\/\/[^"'\s)]+?\/manga\/[^"'\s)]+?\.(?:png|jpg|jpeg|webp)/gi;
  let m;
  while((m = re.exec(html))){
    const u = m[0];
    if(seen[u]) continue;
    seen[u] = 1;
    out.push(u);
  }
  return out;
}

async function openWCChapter(chapId, label){
  const head = document.getElementById('wc-detail-head');
  const list = document.getElementById('wc-chapters');
  if(!list) return;
  window.scrollTo(0,0);
  if(head) head.innerHTML = '<div style="font-family:Bebas Neue,sans-serif;font-size:24px;letter-spacing:1px">'+(label||'Chapter')+'</div>' +
    '<button onclick="backToWCChapters()" style="margin-top:10px;background:var(--surface,#1a1410);border:1px solid var(--border,#2a2420);color:#fff;padding:6px 14px;border-radius:8px;cursor:pointer">← Chapter list</button>';
  list.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading pages...</span></div>';
  try {
    const url = WC + '/chapters/' + chapId + '/images?is_prev=False&current_page=1&reading_style=long_strip';
    const html = await wcScrape(url);
    const pages = wcParsePages(html);
    if(!pages.length) throw new Error('no pages found');
    list.innerHTML = '<div style="max-width:800px;margin:0 auto">' +
      pages.map(function(u){ return '<img src="'+wcImg(u)+'" alt="" loading="lazy" style="width:100%;display:block">'; }).join('') +
      '<div style="text-align:center;padding:24px"><button onclick="backToWCChapters()" style="padding:10px 24px;background:var(--manga-red,#e63946);border:none;color:#fff;border-radius:8px;cursor:pointer">← Chapter list</button></div></div>';
  } catch(e){
    list.innerHTML = '<div class="empty"><p>Couldn\u0027t load pages</p><span style="font-size:11px;opacity:0.5">'+e.message+'</span>' +
      '<div style="margin-top:10px"><button onclick="backToWCChapters()" style="padding:6px 16px;background:var(--manga-red,#e63946);border:none;color:#fff;border-radius:6px;cursor:pointer">← Back</button></div></div>';
  }
}

// Kick off Weeb Central section after Asura
setTimeout(function(){ loadWeebCentral(); }, 3000);

// ═══════════════════════════════════════════════════════════════════════════
//  BLENDED SCANLATION HOMEPAGE — Phase 3
//  Expandable source registry. To add a NEW source later, append one entry
//  with: id, label, load() returning [{title,cover,open}], and you're done —
//  the blend picks it up automatically.
// ═══════════════════════════════════════════════════════════════════════════
const SCAN_SOURCES = [
  {
    id: 'asura',
    label: 'ASURA',
    load: async function(){
      const html = await asuraScrape(ASURA + '/series-ranking');
      const list = asuraParseList(html).slice(0,20);
      S.asuraList = list; // keep index map in sync for openAsuraByIdx
      return list.map(function(s, i){
        return { title: s.title || s.slug, cover: asuraImg(s.cover), label: 'ASURA',
                 open: (function(idx){ return function(){ openAsuraByIdx(idx); }; })(i) };
      });
    }
  },
  {
    id: 'weeb',
    label: 'WEEB',
    load: async function(){
      const html = await wcScrape(WC + '/');
      const list = wcParseList(html).slice(0,20);
      S.wcList = list;
      return list.map(function(s, i){
        return { title: s.title || s.slug, cover: wcImg(wcCover(s.id)), label: 'WEEB',
                 open: (function(idx){ return function(){ openWCByIdx(idx); }; })(i) };
      });
    }
  }
  // ── To add a source later, add { id, label, load } here. ──
];

// Interleave arrays round-robin so the blend mixes sources evenly.
function blendInterleave(lists){
  const out = [], max = Math.max.apply(null, lists.map(function(l){return l.length;}).concat([0]));
  for(let i=0;i<max;i++){
    for(let s=0;s<lists.length;s++){
      if(lists[s][i]) out.push(lists[s][i]);
    }
  }
  return out;
}

function blendCard(item, i){
  return '<div class="manga-card" onclick="blendOpen('+i+')">' +
    '<div class="manga-cover"><img src="'+item.cover+'" alt="" loading="lazy" onerror="this.style.opacity=0.3">' +
    '<div class="manga-badge">'+item.label+'</div></div>' +
    '<div class="manga-info"><div class="manga-title">'+item.title+'</div>' +
    '<div class="manga-sub">'+item.label+'</div></div></div>';
}

function blendOpen(i){
  const item = (S.blendItems||[])[i];
  if(item && typeof item.open === 'function') item.open();
}

async function loadBlend(){
  const el = document.getElementById('blend-grid');
  if(!el) return;
  try {
    // Load every source in parallel; if one fails, the others still show.
    const results = await Promise.all(SCAN_SOURCES.map(function(src){
      return src.load().catch(function(e){ console.error(src.id+' blend load failed:', e.message); return []; });
    }));
    const blended = blendInterleave(results);
    if(!blended.length) throw new Error('no sources returned items');
    S.blendItems = blended;
    el.innerHTML = blended.slice(0,30).map(function(item,i){ return blendCard(item,i); }).join('');
  } catch(e){
    el.innerHTML = '<div class="empty"><p>Trending unavailable</p><span style="font-size:11px;opacity:0.5">'+e.message+'</span></div>';
  }
}

// Load the blend early (it's the headline section)
setTimeout(function(){ loadBlend(); }, 2000);
