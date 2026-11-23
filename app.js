(function () {
  const { CHAPTERS, LESSONS } = window.COURSE;
  const ORDER = CHAPTERS.flatMap((c) => c.lessons.map(([id]) => id));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('sd:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('sd:' + k, JSON.stringify(v)); } catch {} },
  };
  const state = { lesson: null, step: 0, done: new Set(store.get('done', [])), open: new Set(store.get('open', ['foundations', 'scaling'])) };
  const $ = (s) => document.querySelector(s);
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

  const ICONS = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    window: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
    sheets: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    left: '<path d="m15 6-6 6 6 6"/>',
    right: '<path d="m9 6 6 6-6 6"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    replay: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="M7 5v14l12-7z"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
    sparkles: '<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    dots: '<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  };
  // a topic glyph per chapter (24×24, stroked)
  const CH_ICONS = {
    foundations: '<circle cx="12" cy="12" r="8"/><path d="m15 9-2 4-4 2 2-4z"/>',
    scaling: '<path d="M4 20V10M10 20V6M16 20v-8M20 4l-4 4M20 4h-4M20 4v4"/>',
    data: '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
    communication: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8"/>',
    reliability: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    architecture: '<rect x="3" y="14" width="7" height="6" rx="1"/><rect x="14" y="14" width="7" height="6" rx="1"/><rect x="8.5" y="4" width="7" height="6" rx="1"/><path d="M12 10v2M6.5 14v-2h11v2"/>',
    security: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2"/>',
    shipping: '<path d="M12 3c3 2 5 5.5 5 9l-2.5 3h-5L7 12c0-3.5 2-7 5-9z"/><circle cx="12" cy="9.5" r="1.6"/><path d="M9.5 15 8 20l4-2 4 2-1.5-5"/>',
    design: '<path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  };
  const chGlyph = (id, size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CH_ICONS[id] || ICONS.book}</svg>`;
  // folder: back + tab, then a front panel that tilts open when the chapter is expanded
  const folderIcon = (id, tone) => `<span class="ch-ico ch-ico--folder" style="--tone:${tone}"><svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true">
      <path class="f-back" d="M1.5 3.2A1.7 1.7 0 0 1 3.2 1.5h4.6l1.9 2h9.1a1.7 1.7 0 0 1 1.7 1.7v10.6a1.7 1.7 0 0 1-1.7 1.7H3.2a1.7 1.7 0 0 1-1.7-1.7z"/>
      <path class="f-paper" d="M4 5.5h14v4H4z"/>
      <path class="f-front" d="M1.5 6.4h19v9.4a1.7 1.7 0 0 1-1.7 1.7H3.2a1.7 1.7 0 0 1-1.7-1.7z"/></svg>
      <span class="ch-ico__glyph">${chGlyph(id, 9)}</span></span>`;
  const CH_STYLES = [['folder', 'Folders', 'folder'], ['topic', 'Topic icons', 'grid'], ['dot', 'Colour dots', 'dots']];
  let chStyle = (() => { try { const v = localStorage.getItem('sd:chIcon'); return CH_STYLES.some((x) => x[0] === v) ? v : 'folder'; } catch { return 'folder'; } })();
  const chIcon = (ch) => chStyle === 'folder' ? folderIcon(ch.id, ch.tone)
    : chStyle === 'topic' ? `<span class="ch-ico ch-ico--topic" style="--tone:${ch.tone}">${chGlyph(ch.id, 13)}</span>`
    : `<span class="chapter__dot" style="background:${ch.tone}"></span>`;
  const icon = (n, size = 16, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
  const CALLOUT = { warn: ['alert', 'Watch out'], tip: ['bulb', 'Good to know'], insight: ['sparkles', 'Key idea'], next: ['arrow', 'Coming up'] };
  const KIND = { concept: 'Concept', problem: 'Problem', technique: 'Technique', recap: 'Recap' };
  const LEGEND = { req: 'request', res: 'response', err: 'failed', msg: 'message', hit: 'cache hit' };
  const NAV = [['Learn', 'book', true], ['Practice', 'settings'], ['Design Lab', 'window'], ['Cheatsheets', 'sheets']];

  const logo = `<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 10.6V15.4M8.2 19.4V15.4H23.8V18.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
      <rect x="9" y="2.4" width="14" height="8.6" rx="2.6" fill="#fcd4ad" stroke="currentColor" stroke-width="1.8"/>
      <rect x="2" y="19.4" width="12.4" height="9" rx="2.6" fill="#a9c5e8" stroke="currentColor" stroke-width="1.8"/>
      <path d="M18 20.4V27.2A5.8 2.2 0 0 0 29.6 27.2V20.4Z" fill="#cbbae6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <ellipse cx="23.8" cy="20.4" rx="5.8" ry="2.2" fill="#ece4f6" stroke="currentColor" stroke-width="1.8"/></svg>`;

  $('#app').innerHTML = `
  <div class="window">
    <header class="topbar">
      <button class="menu-btn" id="menu-btn" aria-label="Open the course menu">${icon('menu', 20, 2.2)}</button>
      <a class="brand" href="#/">${logo}<span class="brand__name">System <span>Design</span></span></a>
      <nav class="nav">${NAV.map(([l, i, a]) => `<button class="nav__item ${a ? 'is-active' : ''}" data-nav="${l}">${icon(i, 16)}<span>${l}</span></button>`).join('')}</nav>
      <button class="search" id="search-open" aria-label="Search the course">${icon('search', 16)}<span class="search__hint">Search lessons…</span><kbd>${isMac ? '⌘K' : 'Ctrl K'}</kbd></button>
      <button class="icon-btn" id="font-btn" aria-label="Change font"></button>
      <button class="icon-btn" id="theme-btn" aria-label="Toggle theme"></button>
    </header>
    <div class="body">
      <aside class="sidebar" id="sidebar">
        <div class="tree-root">
          <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true"><path d="M1 3a2 2 0 0 1 2-2h4.3l2 2.2H17a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2Z" fill="currentColor"/></svg>
          <span>Course</span><span class="tree-root__meta">${ORDER.length} lessons</span>
          <button class="ch-style" id="ch-style" type="button"></button>
        </div>
        <nav class="course" id="course"></nav>
        <section class="card progress" id="progress"></section>
      </aside>
      <main class="sheet">
        <div class="lesson-head" id="head"></div>
        <section class="card stage" id="stage">
          <div class="stage__hud"><span class="pill"><span class="pulse"></span><span id="hud-text">Live traffic</span></span></div>
          <div class="stage__tools">
            <button class="tool" id="replay" title="Replay this step (R)">${icon('replay', 14)}<span>Replay</span></button>
            <button class="tool" id="pause" title="Pause traffic (Space)"></button>
            <button class="tool" id="expand" title="Full screen" aria-label="Full screen">${icon('expand', 14)}</button>
          </div>
          <div class="stage__canvas" id="canvas"></div>
          <div class="stage__legend" id="legend"></div>
        </section>
        <section class="card timeline" id="timeline"></section>
      </main>
      <aside class="rail">
        <section class="card guide" id="guide"></section>
        <section class="card goals" id="goals"></section>
      </aside>
    </div>
    <div class="view" id="view" hidden></div>
  </div>
  <div class="sx" id="sx" hidden>
    <div class="sx__box" role="dialog" aria-label="Search">
      <input class="sx__input" id="sx-input" placeholder="Search lessons…" autocomplete="off" />
      <div class="sx__list" id="sx-list"></div>
    </div>
  </div>
  <div class="toast" id="toast"></div>`;

  const stage = new window.Stage($('#canvas'));

  // ---------- sidebar ----------
  function renderCourse() {
    $('#course').innerHTML = CHAPTERS.map((ch) => {
      const done = ch.lessons.filter(([id]) => state.done.has(id)).length;
      return `<div class="chapter ${state.open.has(ch.id) ? 'is-open' : ''}" data-ch="${ch.id}">
        <button class="chapter__btn" data-toggle="${ch.id}">
          <span class="chapter__chev">${icon('chev', 13, 2.6)}</span>
          ${chIcon(ch)}
          <span>${ch.title}</span><span class="chapter__count">${done}/${ch.lessons.length}</span>
        </button>
        <ul class="chapter__list">${ch.lessons.map(([id, title]) => {
          const l = LESSONS[id];
          const cls = ['lesson-link', state.lesson === id ? 'is-current' : '', state.done.has(id) ? 'is-done' : ''].join(' ');
          return `<li><a class="${cls}" href="#/${id}"><span class="check">${state.done.has(id) ? icon('check', 10, 3.5) : ''}</span><span>${title}</span>${l.placeholder ? '<span class="soon">soon</span>' : ''}</a></li>`;
        }).join('')}</ul></div>`;
    }).join('');
    const n = state.done.size, pct = Math.round((n / ORDER.length) * 100);
    $('#progress').innerHTML = `<div class="progress__row"><span class="eyebrow">Your progress</span><span class="progress__num">${pct}%</span></div>
      <div class="bar"><span style="width:${pct}%"></span></div>
      <div style="margin-top:6px;color:var(--muted);font-size:11.5px">${n} of ${ORDER.length} lessons complete</div>`;
  }
  function paintChStyle() {
    const i = CH_STYLES.findIndex((x) => x[0] === chStyle);
    const next = CH_STYLES[(i + 1) % CH_STYLES.length];
    const b = $('#ch-style');
    b.innerHTML = icon(CH_STYLES[i][2], 13);
    b.title = `Chapter icons: ${CH_STYLES[i][1]} — click for ${next[1].toLowerCase()}`;
    b.setAttribute('aria-label', b.title);
  }
  $('#ch-style').onclick = () => {
    chStyle = CH_STYLES[(CH_STYLES.findIndex((x) => x[0] === chStyle) + 1) % CH_STYLES.length][0];
    try { localStorage.setItem('sd:chIcon', chStyle); } catch {}
    paintChStyle();
    renderCourse();
  };
  paintChStyle();
  $('#course').addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle]');
    if (t) {
      const id = t.dataset.toggle;
      state.open.has(id) ? state.open.delete(id) : state.open.add(id);
      store.set('open', [...state.open]);
      renderCourse();
    }
    if (e.target.closest('a')) $('#sidebar').classList.remove('is-open');
  });

  // ---------- lesson ----------
  function openLesson(id, step = 0) {
    const l = LESSONS[id];
    if (!l) return;
    const changed = state.lesson !== id;
    state.lesson = id;
    state.open.add(l.chapter);
    if (changed) {
      const ch = CHAPTERS.find((c) => c.id === l.chapter);
      $('#head').innerHTML = `<div><span class="eyebrow">${ch.title}</span><h1 class="title">${l.title}</h1><p class="subtitle">${l.subtitle}</p></div>
        <div class="tags">${l.tags.map(([t, tone]) => `<span class="tag tag--${tone}">${t}</span>`).join('')}</div>`;
      $('#legend').innerHTML = l.legend.map((k) => `<span><i class="lg lg--${k}"></i>${LEGEND[k]}</span>`).join('');
      renderTimeline(l);
      document.title = `${l.title} — System Design`;
    }
    renderCourse();
    goStep(Math.max(0, Math.min(step, l.steps.length - 1)), changed);
  }

  function renderTimeline(l) {
    $('#timeline').innerHTML = `<div class="timeline__head"><span class="eyebrow">In this lesson</span><span class="timeline__count" id="tl-count"></span></div>
      <div class="timeline__track"><div class="timeline__rail"><span id="tl-fill"></span></div>
      <ol class="timeline__steps">${l.steps.map((s, i) => `<li class="tone-${s.chapter}"><button data-step="${i}" title="${s.title}"><span class="timeline__dot">${i + 1}</span><span class="timeline__label">${s.short}</span></button></li>`).join('')}</ol></div>`;
  }
  $('#timeline').addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (b) go(+b.dataset.step);
  });

  let prevMetrics = {};
  function goStep(i, fresh) {
    const l = LESSONS[state.lesson];
    const s = l.steps[i];
    state.step = i;
    store.set('last', [state.lesson, i]);
    // timeline
    document.querySelectorAll('.timeline__steps li').forEach((li, n) => {
      li.classList.toggle('is-current', n === i);
      li.classList.toggle('is-done', n < i);
    });
    $('#tl-fill').style.width = `${l.steps.length > 1 ? (i / (l.steps.length - 1)) * 100 : 100}%`;
    $('#tl-count').textContent = `Step ${i + 1} of ${l.steps.length}`;
    // guide
    const last = i === l.steps.length - 1;
    const nextLesson = ORDER[ORDER.indexOf(state.lesson) + 1];
    const c = s.callout;
    $('#guide').innerHTML = `<div class="guide__scroll tone-${s.chapter}">
        <span class="guide__kind">${KIND[s.chapter]}</span>
        <h2>${s.title}</h2>
        ${s.body.map((p) => (p.trim().startsWith('<ul') ? p : `<p>${p}</p>`)).join('')}
        ${c ? `<div class="callout callout--${c.kind}"><span class="callout__icon">${icon(CALLOUT[c.kind][0], 14)}</span><div><span class="callout__title">${CALLOUT[c.kind][1]}</span>${c.text}</div></div>` : ''}
        ${s.changes ? `<span class="eyebrow">What changed</span><ul class="changes">${s.changes.map((t) => {
          const k = t[0] === '+' ? 'add' : t[0] === '-' ? 'del' : 'mod';
          return `<li class="${k}"><b>${t[0]}</b><span>${t.slice(1).trim()}</span></li>`;
        }).join('')}</ul>` : ''}
      </div>
      <div class="guide__foot">
        <button class="btn" id="prev" ${i === 0 ? 'disabled' : ''} aria-label="Previous step">${icon('left', 15, 2.4)}</button>
        <button class="btn btn--primary" id="next">${last ? (nextLesson ? `Complete · next lesson` : 'Complete course') : 'Next step'} ${icon('right', 15, 2.4)}</button>
      </div>`;
    $('#prev').onclick = () => go(i - 1);
    $('#next').onclick = () => {
      if (!last) return go(i + 1);
      state.done.add(state.lesson);
      store.set('done', [...state.done]);
      toast(`✓ ${l.title} complete`);
      if (nextLesson) location.hash = `#/${nextLesson}`;
      else renderCourse();
    };
    // metrics
    const m = s.metrics || {};
    const keys = Object.keys(m);
    $('#goals').innerHTML = `<span class="eyebrow">System metrics</span>${keys.length ? `<div class="metrics">${keys.map((k) => {
      const cls = (s.bad || []).includes(k) ? 'is-bad' : (s.good || []).includes(k) ? 'is-good' : '';
      const flash = !fresh && prevMetrics[k] !== undefined && prevMetrics[k] !== m[k] ? 'flash' : '';
      return `<div class="metric ${cls} ${flash}"><small>${k}</small><b>${m[k]}</b></div>`;
    }).join('')}</div>` : '<p style="color:var(--muted);margin:8px 0 0">No metrics for this step.</p>'}`;
    prevMetrics = m;
    stage.setScene(s.scene);
  }

  function go(i) {
    const l = LESSONS[state.lesson];
    if (i < 0 || i >= l.steps.length) return;
    history.replaceState(null, '', `#/${state.lesson}/${i + 1}`);
    goStep(i, false);
  }

  // ---------- routing ----------
  let activeView = null, viewName = null;
  function setNav(label) {
    document.querySelectorAll('[data-nav]').forEach((b) => b.classList.toggle('is-active', b.dataset.nav === label));
  }
  function showView(name) {
    if (viewName === name) return;
    activeView?.destroy?.();
    viewName = name;
    stage.paused = true;
    $('.body').hidden = true;
    $('#view').hidden = false;
    $('#view').scrollTop = 0;
    activeView = window.VIEWS[name].render($('#view')) || {};
    setNav(window.VIEWS[name].nav);
    document.title = `${window.VIEWS[name].nav} — System Design`;
  }
  function hideView() {
    if (!viewName) return;
    activeView?.destroy?.();
    activeView = null; viewName = null;
    $('#view').hidden = true;
    $('#view').innerHTML = '';
    $('.body').hidden = false;
    setNav('Learn');
    setPaused(false);
    if (state.lesson) document.title = `${LESSONS[state.lesson].title} — System Design`;
  }

  function route() {
    const [, id, step] = location.hash.split('/');
    if (id && window.VIEWS[id]) return showView(id);
    hideView();
    if (id && LESSONS[id]) return openLesson(id, step ? +step - 1 : 0);
    const last = store.get('last', null);
    const target = last && LESSONS[last[0]] ? last : ['request-lifecycle', 0];
    history.replaceState(null, '', `#/${target[0]}/${target[1] + 1}`);
    openLesson(target[0], target[1]);
  }
  window.addEventListener('hashchange', route);

  // ---------- tools ----------
  function setPaused(p) {
    stage.paused = p;
    $('#pause').innerHTML = p ? `${icon('play', 14)}<span>Play</span>` : `${icon('pause', 14)}<span>Pause</span>`;
    $('#stage').classList.toggle('is-paused', p);
    $('#hud-text').textContent = p ? 'Paused' : 'Live traffic';
  }
  $('#pause').onclick = () => setPaused(!stage.paused);
  $('#replay').onclick = () => stage.replay();
  $('#expand').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : $('#stage').requestFullscreen?.());
  setPaused(false);

  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    store.set('theme', t);
    try { localStorage.setItem('sd:theme', t); } catch {}
    $('#theme-btn').innerHTML = icon(t === 'dark' ? 'sun' : 'moon', 17);
    document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#0c0a14' : '#f7f5fc';
  }

  // font: sans (default) → serif headings → mono → sans
  const FONTS = [['sans', 'Aa', 'Sans'], ['serif', 'Ag', 'Serif headings'], ['mono', '{}', 'Mono']];
  function setFont(f) {
    if (f === 'sans') delete document.documentElement.dataset.font;
    else document.documentElement.dataset.font = f;
    try { localStorage.setItem('sd:font', f); } catch {}
    const [, glyph, name] = FONTS.find((x) => x[0] === f);
    const btn = $('#font-btn');
    btn.textContent = glyph;
    btn.title = `Font: ${name} (click to switch)`;
  }
  $('#font-btn').onclick = () => {
    const cur = document.documentElement.dataset.font || 'sans';
    setFont(FONTS[(FONTS.findIndex((x) => x[0] === cur) + 1) % FONTS.length][0]);
  };
  setFont(document.documentElement.dataset.font || 'sans');
  $('#theme-btn').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

  const NAV_ROUTE = { Learn: null, Practice: 'practice', 'Design Lab': 'lab', Cheatsheets: 'cheatsheets' };
  document.querySelectorAll('[data-nav]').forEach((b) => (b.onclick = () => {
    const r = NAV_ROUTE[b.dataset.nav];
    if (r) location.hash = `#/${r}`;
    else location.hash = state.lesson ? `#/${state.lesson}/${state.step + 1}` : '#/';
  }));
  $('#menu-btn').onclick = () => $('#sidebar').classList.toggle('is-open');

  let toastTimer;
  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2200);
  }

  // ---------- search ----------
  let sxIndex = 0, sxResults = [];
  function openSearch() {
    $('#sx').hidden = false;
    $('#sx-input').value = '';
    renderSearch('');
    $('#sx-input').focus();
  }
  const closeSearch = () => ($('#sx').hidden = true);
  function renderSearch(q) {
    q = q.trim().toLowerCase();
    sxResults = ORDER.map((id) => LESSONS[id]).filter((l) => !q || l.title.toLowerCase().includes(q) || l.subtitle.toLowerCase().includes(q) || l.steps.some((s) => s.title.toLowerCase().includes(q)));
    sxIndex = 0;
    $('#sx-list').innerHTML = sxResults.length
      ? sxResults.map((l, i) => `<a class="sx__item ${i === 0 ? 'is-active' : ''}" href="#/${l.id}">${icon('book', 14)}<span>${l.title}</span><small>${CHAPTERS.find((c) => c.id === l.chapter).title}${l.placeholder ? ' · soon' : ''}</small></a>`).join('')
      : '<div class="sx__empty">No lessons match.</div>';
  }
  $('#search-open').onclick = openSearch;
  $('#sx').addEventListener('click', (e) => { if (e.target.id === 'sx' || e.target.closest('a')) closeSearch(); });
  $('#sx-input').addEventListener('input', (e) => renderSearch(e.target.value));
  $('#sx-input').addEventListener('keydown', (e) => {
    const items = [...document.querySelectorAll('.sx__item')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sxIndex = (sxIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((it, i) => it.classList.toggle('is-active', i === sxIndex));
      items[sxIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && sxResults[sxIndex]) {
      location.hash = `#/${sxResults[sxIndex].id}`;
      closeSearch();
    } else if (e.key === 'Escape') closeSearch();
  });

  // ---------- keyboard ----------
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); return $('#sx').hidden ? openSearch() : closeSearch(); }
    if (!$('#sx').hidden || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (viewName) return activeView?.key?.(e);
    if (e.key === 'ArrowRight') go(state.step + 1);
    else if (e.key === 'ArrowLeft') go(state.step - 1);
    else if (e.key === ' ') { e.preventDefault(); setPaused(!stage.paused); }
    else if (e.key.toLowerCase() === 'r') stage.replay();
  });

  route();
})();
