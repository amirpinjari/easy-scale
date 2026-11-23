/* Isometric diagram engine: draws entities as iso blocks, links between them,
   and animates request "dots" flowing along routes. No dependencies. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const S = 34; // px per grid unit
  const COS = 0.866;
  const REDUCED = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const LINK_Z = 0.05; // links and travelling dots share this height, so dots ride on the line
  const P = (x, y, z = 0) => [(x - y) * COS * S, (x + y) * 0.5 * S - z * S];

  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const pts = (arr) => arr.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
  const shade = (c, pct) => `fill: color-mix(in srgb, ${c} ${100 - pct}%, var(--ink) ${pct}%)`;

  // ---------- shapes (drawn around local origin 0,0) ----------
  // rounded rectangle in the ground plane, as a closed loop of grid points
  function rrect(x0, y0, x1, y1, r, n = 8) {
    r = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
    const out = [];
    for (const [cx, cy, a0] of [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]]) {
      for (let i = 0; i <= n; i++) {
        const a = ((a0 + (90 * i) / n) * Math.PI) / 180;
        out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    }
    return out;
  }
  const mix = (c, pct) => `color-mix(in srgb, ${c} ${100 - pct}%, var(--ink) ${pct}%)`;

  // a slab with rounded corners: shaded curved walls + rounded top
  function roundBox(g, w, d, h, color, r, opts = {}) {
    const x0 = -w / 2, x1 = w / 2, y0 = -d / 2, y1 = d / 2;
    const loop = rrect(x0, y0, x1, y1, r);
    const n = loop.length;
    const ptsAt = (arr, z) => pts(arr.map(([x, y]) => P(x, y, z)));
    el('polygon', { points: ptsAt(rrect(x0 + 0.2, y0 + 0.2, x1 + 0.35, y1 + 0.35, r), 0), style: 'fill: var(--line); opacity:.7' }, g);
    // walls: every edge facing the viewer, shaded by which way it faces
    for (let i = 0; i < n; i++) {
      const a = loop[i], b = loop[(i + 1) % n];
      const nx = b[1] - a[1], ny = a[0] - b[0]; // outward normal
      if (nx + ny <= 0) continue;
      const c = mix(color, Math.round(12 + 12 * (nx / (Math.abs(nx) + Math.abs(ny) || 1))));
      el('polygon', { points: pts([P(a[0], a[1], 0), P(b[0], b[1], 0), P(b[0], b[1], h), P(a[0], a[1], h)]), style: `fill:${c}; stroke:${c}`, 'stroke-width': 0.6 }, g);
    }
    // outline: bottom front curve + two silhouette edges
    const sx = loop.map(([x, y]) => P(x, y)[0]);
    const li = sx.indexOf(Math.min(...sx)), ri = sx.indexOf(Math.max(...sx));
    const chain = (from, to, dir) => { const out = []; for (let i = from; ; i = (i + dir + n) % n) { out.push(loop[i]); if (i === to) break; } return out; };
    const fwd = chain(li, ri, 1), back = chain(li, ri, -1);
    const lowY = (c) => c.reduce((acc, [x, y]) => acc + P(x, y)[1], 0) / c.length;
    const front = lowY(fwd) > lowY(back) ? fwd : back;
    const line = { fill: 'none', stroke: 'var(--edge)', 'stroke-width': 1.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
    el('polyline', { points: ptsAt(front, 0), ...line }, g);
    for (const i of [li, ri]) el('line', { x1: P(...loop[i], 0)[0], y1: P(...loop[i], 0)[1], x2: P(...loop[i], h)[0], y2: P(...loop[i], h)[1], ...line }, g);
    // server slots + status LEDs on the front-left face (inside the straight part)
    if (opts.slots) {
      const ra = Math.min(r, w / 2, d / 2);
      for (let i = 1; i <= opts.slots; i++) {
        const z = (h * i) / (opts.slots + 1);
        const a = P(x0 + ra + 0.05, y1, z), b = P(x1 - ra - 0.05, y1, z);
        el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: 'var(--edge)', 'stroke-width': 1.2, 'stroke-linecap': 'round', opacity: 0.6 }, g);
        const led = P(x1 - ra - 0.15, y1, z + 0.12);
        el('circle', { cx: led[0], cy: led[1], r: 1.8, class: 'led', style: 'fill: var(--green-3)' }, g);
      }
    }
    el('polygon', { points: ptsAt(loop, h), style: `fill:${color}`, stroke: 'var(--edge)', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, g);
    if (opts.segments) {
      for (let i = 1; i < opts.segments; i++) {
        const x = x0 + (w * i) / opts.segments;
        el('polyline', { points: pts([P(x, y0, h), P(x, y1, h), P(x, y1, 0)]), fill: 'none', stroke: 'var(--edge)', 'stroke-width': 1, opacity: 0.55, 'stroke-linecap': 'round' }, g);
      }
    }
    return P(0, 0, h);
  }

  // dotted ground pad that marks out each resource's spot
  function pad(g, r, state) {
    const k = r * 1.08;
    el('polygon', {
      points: pts(rrect(-k, -k, k, k, k * 0.42, 6).map(([x, y]) => P(x, y, 0))),
      class: `pad${state === 'down' ? ' pad--down' : ''}`,
      fill: 'none', 'stroke-width': 1.3, 'stroke-dasharray': '2.5 4.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }, g);
  }

  function box(g, w, d, h, color, opts = {}) {
    // every block gets rounded corners unless a caller asks for { round: 0 }
    const r = opts.round ?? Math.min(w, d) * 0.2;
    if (r > 0) return roundBox(g, w, d, h, color, r, opts);
    const x0 = -w / 2, x1 = w / 2, y0 = -d / 2, y1 = d / 2;
    const stroke = { stroke: 'var(--edge)', 'stroke-width': 1.4, 'stroke-linejoin': 'round' };
    // shadow
    el('polygon', { points: pts([P(x0 + 0.2, y0 + 0.2), P(x1 + 0.35, y0 + 0.2), P(x1 + 0.35, y1 + 0.35), P(x0 + 0.2, y1 + 0.35)]), style: 'fill: var(--line); opacity:.7' }, g);
    el('polygon', { points: pts([P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, h), P(x0, y1, h)]), style: shade(color, 12), ...stroke }, g);
    el('polygon', { points: pts([P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, h), P(x1, y0, h)]), style: shade(color, 24), ...stroke }, g);
    el('polygon', { points: pts([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)]), style: `fill:${color}`, ...stroke }, g);
    if (opts.slots) {
      for (let i = 1; i <= opts.slots; i++) {
        const z = (h * i) / (opts.slots + 1);
        el('line', { x1: P(x0 + 0.2, y1, z)[0], y1: P(x0 + 0.2, y1, z)[1], x2: P(x1 - 0.2, y1, z)[0], y2: P(x1 - 0.2, y1, z)[1], stroke: 'var(--edge)', 'stroke-width': 1.2, 'stroke-linecap': 'round', opacity: 0.6 }, g);
        const led = P(x1 - 0.35, y1, z + 0.12);
        el('circle', { cx: led[0], cy: led[1], r: 1.8, class: 'led', style: 'fill: var(--green-3)' }, g);
      }
    }
    if (opts.segments) {
      for (let i = 1; i < opts.segments; i++) {
        const x = x0 + (w * i) / opts.segments;
        el('polyline', { points: pts([P(x, y0, h), P(x, y1, h), P(x, y1, 0)]), fill: 'none', stroke: 'var(--edge)', 'stroke-width': 1, opacity: 0.55 }, g);
      }
    }
    return P(0, 0, h);
  }

  function cylinder(g, r, h, color) {
    const rx = r * S * 1.2247, ry = r * S * 0.7071;
    const top = P(0, 0, h), bot = P(0, 0, 0);
    const stroke = { stroke: 'var(--edge)', 'stroke-width': 1.4 };
    el('ellipse', { cx: bot[0] + 5, cy: bot[1] + 4, rx, ry, style: 'fill: var(--line); opacity:.7' }, g);
    el('path', { d: `M${-rx},${top[1]} V${bot[1]} A${rx},${ry} 0 0 0 ${rx},${bot[1]} V${top[1]}`, style: shade(color, 14), ...stroke }, g);
    for (const f of [0.33, 0.66]) {
      const y = top[1] + (bot[1] - top[1]) * f;
      el('path', { d: `M${-rx},${y} A${rx},${ry} 0 0 0 ${rx},${y}`, fill: 'none', stroke: 'var(--edge)', 'stroke-width': 1, opacity: 0.5 }, g);
    }
    el('ellipse', { cx: top[0], cy: top[1], rx, ry, style: `fill:${color}`, ...stroke }, g);
    return top;
  }

  function people(g, n = 3) {
    const spots = [[-0.45, 0.3], [0.35, -0.35], [0.1, 0.55], [-0.6, -0.4]].slice(0, n);
    spots.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    for (const [x, y] of spots) {
      const [px, py] = P(x, y, 0.25);
      el('path', { d: `M${px - 7},${py} a7,7 0 0 1 14,0 Z`, style: 'fill: var(--orange)', stroke: 'var(--edge)', 'stroke-width': 1.3 }, g);
      el('circle', { cx: px, cy: py - 12, r: 5, style: 'fill: var(--orange)', stroke: 'var(--edge)', 'stroke-width': 1.3 }, g);
    }
  }

  function glyph(g, at, text) {
    el('text', { x: at[0], y: at[1] + 4, 'text-anchor': 'middle', class: 'ent-label', style: 'font-size:12px' }, g).textContent = text;
  }

  const KINDS = {
    users: { draw: (g) => { box(g, 1.9, 1.9, 0.25, 'var(--green)', { round: 0.5 }); people(g, 3); return P(0, 0, 1); }, r: 1.2 },
    client: { draw: (g) => { box(g, 1.3, 0.9, 0.12, 'var(--card)'); const s = el('g', {}, g); el('polygon', { points: pts(rrect(-0.6, 0.12, 0.6, 1.0, 0.14, 5).map(([x, z]) => P(x, -0.4, z))), style: 'fill: var(--blue)', stroke: 'var(--edge)', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, s); return P(0, -0.4, 1.0); }, r: 0.9 },
    server: { draw: (g) => box(g, 1.3, 1.3, 1.7, 'var(--blue)', { slots: 3 }), r: 0.9 },
    big: { draw: (g) => box(g, 2, 2, 2.6, 'var(--blue)', { slots: 5 }), r: 1.3 },
    worker: { draw: (g) => box(g, 1.2, 1.2, 1.3, 'var(--green)', { slots: 2 }), r: 0.85 },
    lb: { draw: (g) => { const t = box(g, 1.9, 1.3, 0.6, 'var(--orange)'); glyph(g, t, '⇄'); return t; }, r: 1.1 },
    db: { draw: (g) => cylinder(g, 0.85, 1.4, 'var(--violet)'), r: 1 },
    cache: { draw: (g) => { const t = box(g, 1.3, 1.3, 0.8, 'var(--red)'); glyph(g, t, 'ϟ'); return t; }, r: 0.9 },
    queue: { draw: (g) => box(g, 3, 0.9, 0.55, 'var(--orange)', { segments: 6 }), r: 1.3 },
    dns: { draw: (g) => { const t = box(g, 1.1, 1.1, 0.7, 'var(--mint)'); glyph(g, t, '@'); return t; }, r: 0.8 },
    cdn: { draw: (g) => { const t = cylinder(g, 0.7, 0.5, 'var(--mint)'); glyph(g, t, '◎'); return t; }, r: 0.9 },
    store: { draw: (g) => box(g, 1.6, 1.6, 1, 'var(--violet)', { segments: 3 }), r: 1 },
    box: { draw: (g) => box(g, 1.3, 1.3, 0.9, 'var(--card)'), r: 0.9 },
    // AWS-flavoured shapes
    ec2: { draw: (g) => box(g, 1.3, 1.3, 1.7, 'var(--orange)', { slots: 3 }), r: 0.9 },
    task: { draw: (g) => { const t = box(g, 1.15, 1.15, 1.1, 'var(--orange)', { slots: 1 }); glyph(g, t, '▣'); return t; }, r: 0.85 },
    lambda: { draw: (g) => { const t = box(g, 1.4, 1.4, 1.0, 'var(--orange)'); glyph(g, t, 'λ'); return t; }, r: 0.95 },
    apigw: { draw: (g) => { const t = box(g, 1.9, 1.3, 0.6, 'var(--violet)'); glyph(g, t, '{ }'); return t; }, r: 1.1 },
    alb: { draw: (g) => { const t = box(g, 1.9, 1.3, 0.6, 'var(--violet)'); glyph(g, t, '⇄'); return t; }, r: 1.1 },
    waf: { draw: (g) => { const t = box(g, 1.3, 1.3, 0.9, 'var(--red)'); glyph(g, t, '⛨'); return t; }, r: 0.9 },
    cf: { draw: (g) => { const t = cylinder(g, 0.75, 0.5, 'var(--violet)'); glyph(g, t, '◎'); return t; }, r: 0.95 },
    s3: { draw: (g) => { const t = cylinder(g, 0.8, 1.1, 'var(--green)'); glyph(g, t, 'S3'); return t; }, r: 0.95 },
    ecr: { draw: (g) => { const t = box(g, 1.3, 1.3, 0.8, 'var(--blue)'); glyph(g, t, '⧉'); return t; }, r: 0.9 },
    rds: { draw: (g) => cylinder(g, 0.85, 1.4, 'var(--blue)'), r: 1 },
    sqs: { draw: (g) => box(g, 3, 0.9, 0.55, 'var(--red)', { segments: 6 }), r: 1.3 },
  };

  const TONES = {
    green: ['var(--green)', 'var(--green-ink)'],
    amber: ['var(--orange)', 'var(--amber-ink)'],
    red: ['var(--red)', 'var(--red-ink)'],
    violet: ['var(--violet)', 'var(--violet-ink)'],
    blue: ['var(--blue)', 'var(--blue-ink)'],
    sand: ['var(--card)', 'var(--muted)'],
  };
  const DOT = {
    req: 'var(--green-3)', res: 'var(--violet-2)', err: 'var(--red-2)', msg: 'var(--orange-2)', hit: 'var(--blue-2)',
  };

  // ---------- Stage ----------
  class Stage {
    constructor(container) {
      this.root = container;
      this.svg = el('svg', { 'aria-hidden': 'true' }, container);
      this.gLinks = el('g', {}, this.svg);
      this.gLinkLabels = el('g', {}, this.svg);
      this.gFx = el('g', { class: 'fx' }, this.svg); // landing dust, under the blocks
      this.gEnts = el('g', {}, this.svg);
      this.gDots = el('g', { class: 'dots' }, this.svg);
      this.gTags = el('g', {}, this.svg);
      this.ents = new Map();
      this.dots = [];
      this.flows = [];
      this.paused = false;
      this.vb = null;
      this.vbTarget = null;
      this.zoom = 1; // user zoom on top of the auto-fit (1 = fit)
      this.pan = [0, 0]; // user pan, in diagram units
      this.snap = false; // jump straight to the view (while dragging)
      this.onZoom = null;
      this.linkSeen = new Set();
      this.last = performance.now();
      this.onTick = null;
      requestAnimationFrame((t) => this.loop(t));
    }

    setScene(scene, opts = {}) {
      this.scene = scene;
      // queues show a live "waiting" counter only when a flow actually buffers into them
      this.countIds = new Set();
      for (const f of scene.flows || []) {
        if (f.sink) { const last = f.route[f.route.length - 1]; if (typeof last === 'string') this.countIds.add(last); }
        if (f.pull) this.countIds.add(f.route[0]);
      }
      const ents = scene.entities || {};
      // remove gone
      for (const [id, e] of this.ents) {
        if (!ents[id]) {
          this.ents.delete(id);
          this.liftOut(e);
        }
      }
      // add / update
      const born = [];
      for (const id in ents) {
        // lesson coords are screen-aligned (x → right, y → down); convert to iso grid
        const raw = ents[id];
        const spec = { ...raw, x: (raw.x + 2.2 * raw.y) / 2, y: (2.2 * raw.y - raw.x) / 2 };
        let e = this.ents.get(id);
        const sig = `${spec.kind}|${spec.label}|${spec.sub || ''}|${spec.state || ''}`;
        if (!e) {
          const g = el('g', { class: 'ent' }, this.gEnts);
          e = { id, g, sig: null, count: 0, landAt: 0 };
          this.ents.set(id, e);
          born.push(e);
        } else if (e.spec && e.spec.kind !== spec.kind) born.push(e); // swapped for a different service: drop the new one in
        e.spec = spec;
        if (e.sig !== sig) { this.drawEnt(e); e.sig = sig; }
        e.count = spec.count || 0;
        this.place(e);
      }
      // new blocks drop in from above, left to right
      born.sort((a, b) => P(a.spec.x, a.spec.y)[0] - P(b.spec.x, b.spec.y)[0]).forEach((e, i) => this.dropIn(e, i * 75));
      // depth sort
      [...this.ents.values()].sort((a, b) => a.spec.x + a.spec.y - (b.spec.x + b.spec.y)).forEach((e) => this.gEnts.appendChild(e.g));
      this.drawLinks(scene.links || {});
      this.drawTags();
      // flows (keepDots: let in-flight dots finish, for smooth live updates)
      if (!opts.keepDots) {
        this.dots.forEach((d) => d.node.remove());
        this.dots = [];
      }
      const prev = opts.keepDots ? this.flows : [];
      this.flows = (scene.flows || []).map((f, i) => ({ ...f, acc: prev[i] ? prev[i].acc : 0.6, rr: prev[i] ? prev[i].rr : 0 }));
      this.fit();
    }

    // ---- zoom & pan ----
    view() {
      const [x, y, w, h] = this.vbTarget;
      const z = this.zoom, cx = x + w / 2 + this.pan[0], cy = y + h / 2 + this.pan[1];
      return [cx - w / (2 * z), cy - h / (2 * z), w / z, h / z];
    }
    clampPan() {
      const [, , w, h] = this.vbTarget;
      const mx = (w / 2) * Math.max(0.6, 1 - 1 / this.zoom + 0.35), my = (h / 2) * Math.max(0.6, 1 - 1 / this.zoom + 0.35);
      this.pan = [Math.max(-mx, Math.min(mx, this.pan[0])), Math.max(-my, Math.min(my, this.pan[1]))];
    }
    toDiagram(clientX, clientY) {
      const pt = this.svg.createSVGPoint();
      pt.x = clientX; pt.y = clientY;
      const m = this.svg.getScreenCTM();
      return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
    }
    setZoom(z, at) {
      if (!this.vbTarget) return;
      const nz = Math.max(Stage.MIN_ZOOM, Math.min(Stage.MAX_ZOOM, z));
      if (at) {
        // keep the point under the cursor still while zooming
        const [x, y, w, h] = this.vbTarget;
        const bx = x + w / 2, by = y + h / 2;
        const cx = bx + this.pan[0], cy = by + this.pan[1];
        const r = this.zoom / nz;
        this.pan = [at.x + (cx - at.x) * r - bx, at.y + (cy - at.y) * r - by];
      }
      this.zoom = nz;
      if (nz === 1 && !at) this.pan = [0, 0];
      this.clampPan();
      this.zooming = true;
      clearTimeout(this._zt);
      this._zt = setTimeout(() => (this.zooming = false), 300);
      if (this.onZoom) this.onZoom(this.zoom);
    }
    resetView() { this.pan = [0, 0]; this.setZoom(1); }
    // wheel / pinch / drag / double-click / keyboard. Plain wheel scrolls the page;
    // Ctrl/⌘ + wheel or a trackpad pinch zooms.
    enableZoom() {
      if (this._zoomOn) return;
      this._zoomOn = true;
      const el = this.root;
      el.classList.add('is-zoomable');
      el.tabIndex = 0;
      el.addEventListener('wheel', (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022));
        this.setZoom(this.zoom * f, this.toDiagram(e.clientX, e.clientY));
      }, { passive: false });
      const pts = new Map();
      let last = null, pinch = null;
      el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        el.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: this.zoom };
        }
        last = [e.clientX, e.clientY];
        el.classList.add('is-grabbing');
      });
      el.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2 && pinch) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          this.setZoom(pinch.z * (d / pinch.d), this.toDiagram((a[0] + b[0]) / 2, (a[1] + b[1]) / 2));
          return;
        }
        const r = this.svg.getBoundingClientRect();
        const v = this.vb || this.view();
        const scale = Math.max(v[2] / r.width, v[3] / r.height); // diagram units per pixel (meet)
        this.pan[0] -= (e.clientX - last[0]) * scale;
        this.pan[1] -= (e.clientY - last[1]) * scale;
        this.clampPan();
        this.snap = true;
        last = [e.clientX, e.clientY];
      });
      const up = (e) => {
        pts.delete(e.pointerId);
        if (pts.size < 2) pinch = null;
        if (!pts.size) { this.snap = false; el.classList.remove('is-grabbing'); }
        else last = [...pts.values()][0];
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('dblclick', (e) => this.setZoom(this.zoom * (e.shiftKey ? 1 / 1.8 : 1.8), this.toDiagram(e.clientX, e.clientY)));
      el.addEventListener('keydown', (e) => {
        if (e.key === '+' || e.key === '=') { e.preventDefault(); this.setZoom(this.zoom * 1.25); }
        else if (e.key === '-' || e.key === '_') { e.preventDefault(); this.setZoom(this.zoom / 1.25); }
        else if (e.key === '0') { e.preventDefault(); this.resetView(); }
        else if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          const step = this.vbTarget[2] * 0.08 / this.zoom;
          if (e.key === 'ArrowLeft') this.pan[0] -= step; if (e.key === 'ArrowRight') this.pan[0] += step;
          if (e.key === 'ArrowUp') this.pan[1] -= step; if (e.key === 'ArrowDown') this.pan[1] += step;
          this.clampPan();
        }
      });
    }

    // ---- entrance / exit motion ----
    dropIn(e, delay) {
      const g = e.g;
      const done = () => (g.style.transition = 'transform .7s cubic-bezier(.3,.7,.2,1), opacity .4s');
      if (REDUCED() || !g.animate) { e.landAt = 0; done(); return; }
      const [sx, sy] = P(e.spec.x, e.spec.y);
      const T = (dy, sq = 1) => `translate(${sx}px, ${sy + dy}px) scale(${2 - sq}, ${sq})`; // squash at the base
      const D = 860, hit = 0.55;
      const op = e.spec.state === 'dim' ? 0.35 : 1;
      g.style.transition = 'none';
      const a = g.animate([
        { transform: T(-170, 1.06), opacity: 0, easing: 'cubic-bezier(.55,0,1,.45)' },
        { transform: T(-60, 1.04), opacity: op, offset: 0.3, easing: 'cubic-bezier(.55,0,1,.45)' },
        { transform: T(0, 0.84), opacity: op, offset: hit, easing: 'cubic-bezier(.2,.7,.4,1)' },
        { transform: T(-13, 1.04), opacity: op, offset: 0.73, easing: 'cubic-bezier(.6,0,.8,.4)' },
        { transform: T(0, 0.95), opacity: op, offset: 0.87, easing: 'ease-out' },
        { transform: T(0, 1), opacity: op },
      ], { duration: D, delay, fill: 'backwards' });
      a.onfinish = done;
      a.oncancel = done;
      e.landAt = performance.now() + delay + D * hit;
      setTimeout(() => this.dust(sx, sy, e.r || 0.9), delay + D * hit);
    }
    dust(sx, sy, r) {
      if (!this.gFx.isConnected) return;
      for (const [k, d, w] of [[1, 0, 1.8], [1.35, 70, 1.2]]) {
        const ring = el('ellipse', { cx: sx, cy: sy, rx: r * S * 0.95 * k, ry: r * S * 0.5 * k, fill: 'none', stroke: 'var(--edge)', 'stroke-width': w }, this.gFx);
        ring.style.transformBox = 'fill-box';
        ring.style.transformOrigin = 'center';
        const a = ring.animate([{ transform: 'scale(.45)', opacity: 0.45 }, { transform: 'scale(1.15)', opacity: 0 }], { duration: 520, delay: d, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' });
        a.onfinish = () => ring.remove();
      }
      // a few specks kicked up sideways
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + 0.4;
        const dx = Math.cos(ang) * r * S * 1.25, dy = Math.sin(ang) * r * S * 0.6;
        const p = el('circle', { cx: sx, cy: sy, r: 1.8, style: 'fill: var(--edge)' }, this.gFx);
        const a = p.animate([{ transform: 'translate(0,0)', opacity: 0.6 }, { transform: `translate(${dx}px, ${dy - 10}px)`, opacity: 0 }], { duration: 480, easing: 'cubic-bezier(.2,.8,.3,1)' });
        a.onfinish = () => p.remove();
      }
    }
    liftOut(e) {
      const g = e.g;
      if (REDUCED() || !g.animate) { g.remove(); return; }
      const [sx, sy] = P(e.spec.x, e.spec.y);
      g.style.transition = 'none';
      const a = g.animate([
        { transform: `translate(${sx}px, ${sy}px) scale(1, 1)`, opacity: 1 },
        { transform: `translate(${sx}px, ${sy + 4}px) scale(1.04, .94)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${sx}px, ${sy - 70}px) scale(.96, 1.04)`, opacity: 0 },
      ], { duration: 420, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
      a.onfinish = () => g.remove();
    }

    place(e) {
      const [sx, sy] = P(e.spec.x, e.spec.y);
      e.g.style.transform = `translate(${sx}px, ${sy}px)`;
      e.g.style.opacity = e.spec.state === 'dim' ? 0.35 : 1;
    }

    drawEnt(e) {
      const g = e.g, spec = e.spec;
      g.innerHTML = '';
      const kind = KINDS[spec.kind] || KINDS.box;
      if (!spec.noPad) pad(g, kind.r, spec.state);
      const body = el('g', {}, g);
      if (spec.state === 'down') body.style.filter = 'grayscale(1) opacity(.6)';
      const top = kind.draw(body) || P(0, 0, 1);
      e.top = top;
      e.r = kind.r;
      if (spec.state === 'down') {
        el('text', { x: top[0], y: top[1] - 4, 'text-anchor': 'middle', style: 'font: 800 22px var(--font); fill: var(--red-2)' }, g).textContent = '✕';
      }
      // label under the block
      const lp = P(0, 0, 0);
      const ly = lp[1] + kind.r * S * 0.62 + 18;
      const t = el('text', { x: 0, y: ly, 'text-anchor': 'middle', class: 'ent-label' }, g);
      t.textContent = spec.label || '';
      if (spec.sub) el('text', { x: 0, y: ly + 13, 'text-anchor': 'middle', class: 'ent-sub' }, g).textContent = spec.sub;
    }

    drawTags() {
      this.gTags.innerHTML = '';
      for (const e of this.ents.values()) {
        const tags = [...(e.spec.tags || [])];
        if (this.countIds.has(e.id) || e.spec.showCount) tags.unshift({ text: `${e.count} waiting`, tone: e.count > 8 ? 'red' : e.count > 3 ? 'amber' : 'sand', live: true });
        const tagSig = tags.filter((t) => !t.live).map((t) => `${t.text.replace(/[\d.,]+/g, '#')}:${t.tone}`).join('|');
        const pop = tagSig !== e.tagSig && !REDUCED();
        e.tagSig = tagSig;
        if (!tags.length) continue;
        const wait = pop ? Math.max(0, (e.landAt || 0) - performance.now()) + 120 : 0;
        const g = el('g', {}, this.gTags);
        g.style.transition = 'transform .7s cubic-bezier(.3,.7,.2,1)';
        const [sx, sy] = P(e.spec.x, e.spec.y);
        g.style.transform = `translate(${sx}px, ${sy}px)`;
        let y = (e.top ? e.top[1] : -40) - 14;
        for (let i = tags.length - 1; i >= 0; i--) {
          const tag = tags[i];
          const [bg, fg] = TONES[tag.tone] || TONES.sand;
          const w = tag.text.length * 6.3 + 16;
          const tg = el('g', {}, g);
          el('rect', { x: -w / 2, y: y - 15, width: w, height: 19, rx: 9.5, style: `fill:${bg}`, stroke: 'var(--edge)', 'stroke-width': 1.2 }, tg);
          const tx = el('text', { x: 0, y: y - 2, 'text-anchor': 'middle', class: 'tag-text', style: `fill:${fg}` }, tg);
          tx.textContent = tag.text;
          if (tag.live) e.liveTag = { tx, rect: tg.firstChild };
          if (pop && tg.animate) {
            tg.style.transformBox = 'fill-box';
            tg.style.transformOrigin = 'center bottom';
            tg.animate([{ transform: 'translateY(8px) scale(.55)', opacity: 0 }, { transform: 'translateY(-2px) scale(1.06)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: wait + (tags.length - 1 - i) * 70, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' });
          }
          y -= 23;
        }
      }
    }

    drawLinks(links) {
      this.gLinks.innerHTML = '';
      this.gLinkLabels.innerHTML = '';
      this.links = links;
      const now = performance.now();
      const seen = new Set();
      for (const id in links) {
        const l = links[id];
        const a = this.ents.get(l.from), b = this.ents.get(l.to);
        if (!a || !b) continue;
        const key = `${l.from}>${l.to}|${l.style || 'solid'}`;
        seen.add(key);
        const fresh = !this.linkSeen.has(key) && !REDUCED();
        const wait = fresh ? Math.max(0, Math.max(a.landAt || 0, b.landAt || 0) - now) + 80 : 0;
        const pa = P(a.spec.x, a.spec.y, LINK_Z), pb = P(b.spec.x, b.spec.y, LINK_Z);
        const style = l.style || 'solid';
        const attrs = { x1: pa[0], y1: pa[1], x2: pb[0], y2: pb[1], 'stroke-linecap': 'round' };
        if (style === 'off') Object.assign(attrs, { stroke: 'var(--line-strong)', 'stroke-width': 1.5, 'stroke-dasharray': '2 6' });
        else if (style === 'broken') Object.assign(attrs, { stroke: 'var(--red-2)', 'stroke-width': 2, 'stroke-dasharray': '6 6' });
        else if (style === 'dashed') Object.assign(attrs, { stroke: 'var(--edge)', 'stroke-width': 1.6, 'stroke-dasharray': '6 5', opacity: 0.7 });
        else Object.assign(attrs, { stroke: 'var(--edge)', 'stroke-width': 1.8, opacity: 0.55 });
        const halo = el('line', { ...attrs, stroke: 'var(--sheet)', 'stroke-width': 7, opacity: 1, 'stroke-dasharray': '' }, this.gLinks);
        const line = el('line', attrs, this.gLinks);
        if (fresh && line.animate) {
          // solid links draw themselves from source to target; dashed ones fade in
          if (style === 'solid') {
            line.setAttribute('pathLength', '1');
            line.setAttribute('stroke-dasharray', '1');
            line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 520, delay: wait, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'backwards' });
          } else line.animate([{ opacity: 0 }, { opacity: attrs.opacity ?? 1 }], { duration: 450, delay: wait, fill: 'backwards' });
          halo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: wait, fill: 'backwards' });
        }
        const labelFrom = this.gLinkLabels.childNodes.length;
        if (l.label) {
          const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
          const w = l.label.length * 6 + 12;
          const tone = TONES[l.labelTone];
          el('rect', { x: mx - w / 2, y: my - 10, width: w, height: 17, rx: 5, style: `fill:${tone ? tone[0] : 'var(--sheet)'}`, stroke: 'var(--line-strong)' }, this.gLinkLabels);
          el('text', { x: mx, y: my + 3, 'text-anchor': 'middle', class: 'link-label', style: tone ? `fill:${tone[1]}` : '' }, this.gLinkLabels).textContent = l.label;
          if (fresh) [...this.gLinkLabels.childNodes].slice(labelFrom).forEach((n) => n.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 350, delay: wait + 380, fill: 'backwards' }));
        }
      }
      this.linkSeen = seen;
    }

    fit() {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const e of this.ents.values()) {
        const [sx, sy] = P(e.spec.x, e.spec.y);
        const ntags = (e.spec.tags || []).length + (this.countIds.has(e.id) || e.spec.showCount ? 1 : 0);
        const top = (e.top ? e.top[1] : -60) - 20 - ntags * 23;
        x0 = Math.min(x0, sx - 75); x1 = Math.max(x1, sx + 75);
        y0 = Math.min(y0, sy + top); y1 = Math.max(y1, sy + 70);
      }
      if (!isFinite(x0)) { x0 = -200; y0 = -150; x1 = 200; y1 = 150; }
      const pad = 40;
      this.vbTarget = [x0 - pad, y0 - pad - 20, x1 - x0 + pad * 2, y1 - y0 + pad * 2 + 30];
      if (!this.vb) this.vb = [...this.vbTarget];
    }

    // --- flows ---
    entPoint(id) {
      const e = this.ents.get(id);
      return e ? { x: e.spec.x, y: e.spec.y, r: e.r || 0.9, e } : null;
    }

    buildPath(ids) {
      const pts3 = ids.map((id) => this.entPoint(id)).filter(Boolean);
      const path = [];
      for (let i = 0; i < pts3.length - 1; i++) {
        const a = pts3[i], b = pts3[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        const ta = Math.min(0.45, (a.r * 0.75) / len), tb = Math.min(0.45, (b.r * 0.75) / len);
        const A = P(a.x + dx * ta, a.y + dy * ta, LINK_Z), B = P(a.x + dx * (1 - tb), a.y + dy * (1 - tb), LINK_Z);
        if (path.length) path.push({ hop: true, A: path[path.length - 1].B, B: A, at: a.e.id });
        path.push({ A, B, to: b.e.id });
      }
      for (const s of path) s.len = Math.hypot(s.B[0] - s.A[0], s.B[1] - s.A[1]);
      return path;
    }

    resolveRoute(f) {
      return f.route.map((step) => {
        if (!Array.isArray(step)) return step;
        const live = step.filter((id) => this.ents.get(id)?.spec.state !== 'down' || f.blind);
        const pool = live.length ? live : step;
        if (f.pick === 'random') return pool[Math.floor(Math.random() * pool.length)];
        if (f.pick === 'weighted' && f.weights) {
          const tot = step.reduce((s, id) => s + (f.weights[id] || 1), 0);
          let r = Math.random() * tot;
          for (const id of step) { r -= f.weights[id] || 1; if (r <= 0) return id; }
        }
        return pool[f.rr++ % pool.length];
      });
    }

    spawn(f) {
      if (f.pull) {
        const q = this.ents.get(f.route[0]);
        if (!q || q.count <= 0) return;
        q.count--;
      }
      let ids = this.resolveRoute(f);
      let kind = f.kind || 'req';
      let fate = null;
      // cache hit: stop early at the hit entity
      if (f.hit && Math.random() < f.hit.p) {
        const i = ids.indexOf(f.hit.at);
        if (i >= 0) { ids = ids.slice(0, i + 1); fate = 'hit'; }
      }
      // failure: stop at first 'down' entity
      const di = ids.findIndex((id, i) => i > 0 && this.ents.get(id)?.spec.state === 'down');
      if (di > 0) { ids = ids.slice(0, di + 1); fate = 'fail'; }
      if (f.drop && Math.random() < f.drop.p) {
        const i = ids.indexOf(f.drop.at);
        if (i >= 0) { ids = ids.slice(0, i + 1); fate = 'fail'; }
      }
      const path = this.buildPath(ids);
      if (!path.length) return;
      const node = el('circle', { r: f.size || 5.5, stroke: 'var(--edge)', 'stroke-width': 1.5, style: `fill:${DOT[kind]}` }, this.gDots);
      this.dots.push({ f, ids, path, seg: 0, t: 0, kind, fate, back: false, node, wait: 0 });
    }

    loop(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      // viewBox tween
      if (this.vb && this.vbTarget) {
        const want = this.view();
        const k = this.snap ? 1 : Math.min(1, dt * (this.zooming ? 12 : 5));
        for (let i = 0; i < 4; i++) this.vb[i] += (want[i] - this.vb[i]) * k;
        this.svg.setAttribute('viewBox', this.vb.map((v) => v.toFixed(1)).join(' '));
        this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
      if (!this.paused) {
        for (const f of this.flows) {
          if (f.once && f.spawned >= f.once) continue;
          f.acc += dt * (f.rate || 1);
          while (f.acc >= 1) {
            f.acc -= 1;
            this.spawn(f);
            f.spawned = (f.spawned || 0) + 1;
            if (f.once && f.spawned >= f.once) break;
          }
        }
        this.stepDots(dt);
      }
      // live queue tag
      for (const e of this.ents.values()) {
        if (e.liveTag) {
          e.liveTag.tx.textContent = `${e.count} waiting`;
          const tone = TONES[e.count > 8 ? 'red' : e.count > 3 ? 'amber' : 'sand'];
          e.liveTag.rect.setAttribute('style', `fill:${tone[0]}`);
          e.liveTag.tx.setAttribute('style', `fill:${tone[1]}`);
        }
      }
      requestAnimationFrame((t) => this.loop(t));
    }

    stepDots(dt) {
      const keep = [];
      for (const d of this.dots) {
        const speed = (d.f.speed || 1) * 210;
        if (d.wait > 0) { d.wait -= dt; keep.push(d); this.drawDot(d); continue; }
        let seg = d.path[d.seg];
        d.t += (speed * dt) / Math.max(seg.len, 1) * (seg.hop ? 2.5 : 1);
        if (d.t >= 1) {
          // carry the overshoot into the next segment so dots don't stall at each node
          const next = d.path[d.seg + 1];
          d.t = next ? Math.min(0.99, ((d.t - 1) * Math.max(seg.len, 1)) / Math.max(next.len, 1)) : 0;
          // arrived at a node: apply per-node delay
          const at = seg.to || seg.at;
          const delay = d.f.delay && !d.back ? d.f.delay[seg.to] : 0;
          d.seg++;
          if (delay) d.wait = delay;
          if (d.seg >= d.path.length) {
            if (d.fate === 'fail') { this.burst(d); continue; }
            if (d.f.sink && !d.back) {
              const q = this.ents.get(d.ids[d.ids.length - 1]);
              if (q) q.count = Math.min(q.count + 1, 99);
              d.node.remove();
              continue;
            }
            if ((d.f.bounce || d.fate === 'hit') && !d.back) {
              d.back = true;
              d.path = this.buildPath([...d.ids].reverse());
              d.seg = 0;
              d.kind = d.fate === 'hit' ? 'hit' : (d.f.backKind || 'res');
              d.node.setAttribute('style', `fill:${DOT[d.kind]}`);
              d.wait = d.f.work || 0.08;
              keep.push(d);
              this.drawDot(d);
              continue;
            }
            if (this.onArrive) this.onArrive(d);
            d.node.remove();
            continue;
          }
        }
        keep.push(d);
        this.drawDot(d);
      }
      this.dots = keep;
    }

    drawDot(d) {
      const seg = d.path[Math.min(d.seg, d.path.length - 1)];
      const t = d.wait > 0 ? 0 : d.t;
      const x = seg.A[0] + (seg.B[0] - seg.A[0]) * t;
      const y = seg.A[1] + (seg.B[1] - seg.A[1]) * t;
      d.node.setAttribute('cx', x.toFixed(1));
      d.node.setAttribute('cy', y.toFixed(1));
    }

    burst(d) {
      const x = +d.node.getAttribute('cx'), y = +d.node.getAttribute('cy');
      d.node.setAttribute('style', `fill:${DOT.err}`);
      const ring = el('circle', { cx: x, cy: y, r: 6, fill: 'none', stroke: 'var(--red-2)', 'stroke-width': 2 }, this.gDots);
      const a = ring.animate([{ r: 6, opacity: 1 }, { r: 20, opacity: 0 }], { duration: 500 });
      a.onfinish = () => ring.remove();
      d.node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400 }).onfinish = () => d.node.remove();
    }

    replay() {
      this.dots.forEach((d) => d.node.remove());
      this.dots = [];
      for (const e of this.ents.values()) e.count = e.spec.count || 0;
      this.flows.forEach((f) => { f.acc = 0.6; f.rr = 0; f.spawned = 0; });
    }
  }

  Stage.MIN_ZOOM = 0.4;
  Stage.MAX_ZOOM = 5;
  window.Stage = Stage;
})();
