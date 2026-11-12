/*
 * Distribution Quest — art.
 * Everything is drawn in code: pixel sprites (built from little pixel "painters"
 * with automatic outlines), Mr. Laporte's portrait (ported from Study Hall
 * Simulator), room tilesets, and boss art.
 */
(function () {
  'use strict';
  const DQ = (window.DQ = window.DQ || {});
  const TAU = Math.PI * 2;
  const OUTLINE = '#1a1424';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ------------------------------------------------------------------
  // Pixel painter: draw into a small grid with simple shapes, then the
  // grid is outlined and turned into a crisp, scaled-up canvas.
  // ------------------------------------------------------------------
  function painter(w, h) {
    const g = [];
    for (let y = 0; y < h; y++) g.push(new Array(w).fill(null));
    const api = {
      w, h, g,
      px(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; },
      get(x, y) { return x >= 0 && y >= 0 && x < w && y < h ? g[y][x] : null; },
      rect(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) api.px(x + i, y + j, c); },
      ell(cx, cy, rx, ry, c) {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
          if (e <= 1) api.px(x, y, typeof c === 'function' ? c(x, y, e) : c);
        }
      },
      // a lit ellipse with 4 tones (light from the upper left)
      ball(cx, cy, rx, ry, tones) {
        api.ell(cx, cy, rx, ry, (x, y, e) => {
          const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
          const l = -nx * 0.55 - ny * 0.75 + (1 - e) * 0.5;
          if (l > 0.75 && tones[3]) return tones[3];
          if (l > 0.15) return tones[2];
          if (l > -0.45 || e < 0.55) return tones[1];
          return tones[0];
        });
      },
      line(x0, y0, x1, y1, c) {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let i = 0; i <= n; i++) api.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
      },
      rows(x, y, rows, pal) {
        rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c) api.px(x + i, y + j, c); } });
      },
    };
    return api;
  }
  function bake(p, scale, outline) {
    const w = p.w + 2, h = p.h + 2;
    const grid = [];
    for (let y = 0; y < h; y++) {
      grid.push([]);
      for (let x = 0; x < w; x++) grid[y].push(p.get(x - 1, y - 1));
    }
    const c = document.createElement('canvas');
    c.width = w * scale; c.height = h * scale;
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let col = grid[y][x];
      if (!col && outline !== false) {
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy] && grid[y + dy][x + dx] && grid[y + dy][x + dx] !== 'glow');
        if (n) col = outline || OUTLINE;
      }
      if (col && col !== 'glow') { g.fillStyle = col; g.fillRect(x * scale, y * scale, scale, scale); }
    }
    return c;
  }
  function sprite(w, h, scale, draw, outline) {
    const p = painter(w, h);
    draw(p);
    return bake(p, scale, outline);
  }
  function fromRows(rows, pal, scale, outline) {
    const p = painter(rows[0].length, rows.length);
    p.rows(0, 0, rows, pal);
    return bake(p, scale, outline);
  }
  const cache = new Map();
  function cached(key, make) {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
  }
  function blit(ctx, img, x, y, flip, alpha) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (alpha != null) ctx.globalAlpha *= alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }
  function shadow(ctx, x, y, rx, ry, a) {
    ctx.fillStyle = `rgba(0,0,0,${a == null ? 0.35 : a})`;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
  }
  // Soft additive light. Each color is rendered once into a small canvas and
  // then stretched, which is far cheaper than a new gradient every frame.
  const glowCache = new Map();
  function glowSprite(color) {
    let c = glowCache.get(color);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, color);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      if (glowCache.size > 400) glowCache.clear();
      glowCache.set(color, c);
    }
    return c;
  }
  function glow(ctx, x, y, r, color, a) {
    if (r <= 0) return;
    const prevOp = ctx.globalCompositeOperation, prevA = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = prevA * (a == null ? 0.5 : Math.max(0, Math.min(1, a)));
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = prevOp;
    ctx.globalAlpha = prevA;
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    return '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  }
  const tones = (c) => [shade(c, -0.45), shade(c, -0.18), c, shade(c, 0.45)];

  // ------------------------------------------------------------------
  // Mr. Laporte's portrait — 32x32, ported from Study Hall Simulator.
  // opts: { expr, hair (0..100), mane (0..1), talk (bool), t, bg }
  // ------------------------------------------------------------------
  const HAIR_COL = '#6b4423', HAIR_HI = '#8b5a2b', HAIR_DK = '#4a2e17';
  const BROW_COL = '#4a2e17';
  const MOUTH_COL = '#6e2c1f', MOUTH_IN = '#4a1414', TEETH = '#f8f4ec';
  const GOLD = '#ffd23f', GOLD_HI = '#fff4a8', GOLD_DK = '#d38b12';
  const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
  const HAIR_PIXELS = (() => {
    const out = [];
    for (let y = 2; y < 15; y++) for (let x = 0; x < 32; x++) {
      const dx = Math.abs(x + 0.5 - 16);
      const inHair = (dx / 9.6) ** 2 + ((y + 0.5 - 14) / 11) ** 2 <= 1;
      const hairline = dx < 2 ? 7 : dx < 3 ? 6 : dx < 4 ? 5 : dx < 6 ? 4 : dx < 7 ? 6 : 12;
      if (!inHair || y >= hairline) continue;
      const side = clamp((dx - 1) / 7, 0, 1);
      const low = clamp((y - 2) / 10, 0, 1);
      const vert = side * low + (1 - side) * (1 - low);
      const keep = clamp(0.6 * side + 0.28 * vert + 0.12 * hash(x, y), 0.02, 0.97);
      let col = HAIR_COL;
      if (y === hairline - 1 || dx > 7.5) col = HAIR_DK;
      else if (y <= 4 && x % 3 === 0) col = HAIR_HI;
      out.push({ x, y, keep, col, idx: y * 32 + x });
    }
    return out;
  })();
  // Spikes of the legendary golden mane: [baseX, baseY, tipX, tipY, half-width]
  const MANE_SPIKES = [
    [16, 6, 16, -6, 3.2], [12, 6, 8, -4, 3], [20, 6, 24, -4, 3], [9, 8, 2, 0, 3], [23, 8, 30, 0, 3],
    [7, 11, -1, 8, 2.6], [25, 11, 33, 8, 2.6], [14, 6, 12, -6, 2.4], [18, 6, 21, -6, 2.4],
    [7, 15, 1, 22, 2.4], [25, 15, 31, 22, 2.4], [8, 13, 0, 15, 2.2], [24, 13, 32, 15, 2.2],
  ];

  const FACES = {
    calm: ['normal', 'flat', 'smile'],
    happy: ['happy', 'raised', 'grin'],
    excited: ['wide', 'raised', 'grin'],
    annoyed: ['lidded', 'low', 'flat'],
    serious: ['normal', 'low', 'flat'],
    furious: ['squint', 'angry', 'yell'],
    shocked: ['wide', 'raised', 'o'],
    defeated: ['down', 'sad', 'frown'],
    smug: ['lidded', 'angry', 'grin'],
    crying: ['closed', 'sad', 'yell'],
  };

  function buildFace(o) {
    const g = [], fig = [];
    for (let y = 0; y < 32; y++) { g.push(new Array(32).fill(null)); fig.push(new Array(32).fill(false)); }
    const set = (x, y, c, figure = true) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x > 31 || y > 31) return;
      g[y][x] = c;
      if (figure) fig[y][x] = true;
    };
    const row = (x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(x, y, c); };
    const expr = o.expr || 'calm';
    const t = o.t || 0;
    const mane = o.mane || 0;
    const hairFrac = (o.hair == null ? 100 : o.hair) / 100;
    const red = expr === 'furious';
    const skin = red ? '#f2a48a' : '#f6cfa6';
    const skinSh = red ? '#dc8668' : '#e2ae88';

    // Background
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if (o.bg === 'aura') {
        const d = Math.hypot(x - 15.5, y - 13) / 22;
        const h = (t * 160 + d * 260 + Math.atan2(y - 13, x - 15.5) * 30) % 360;
        g[y][x] = `hsl(${h},90%,${Math.round(30 + 25 * (1 - d))}%)`;
      } else if (o.bg === 'dungeon') {
        g[y][x] = y < 21 ? ((x + (y >> 2)) % 6 === 0 || y % 4 === 0 ? '#2a2540' : '#332d4f') : y === 21 ? '#1d1930' : '#26213b';
      } else {
        g[y][x] = y < 21 ? ((x + y) % 8 === 0 ? '#41607f' : '#3b5875') : y === 21 ? '#27394d' : '#2f4760';
      }
    }
    for (let y = 21; y < 27; y++) row(12, 19, y, skinSh);
    // Navy and gray striped quarter-zip
    const STRIPES = [['#24395e', '#1a2a47'], ['#8f9399', '#6e7277']];
    const COLLAR = '#a3a7ad', COLLAR_EDGE = '#55595f', COLLAR_FOLD = '#c6cacf';
    const sweaterW = [7, 9, 11, 12, 12, 12];
    for (let y = 26; y < 32; y++) {
      const hw = sweaterW[y - 26];
      const [col, sh] = STRIPES[Math.floor((y - 26) / 2) % 2];
      for (let x = 0; x < 32; x++) { const dx = Math.abs(x + 0.5 - 16); if (dx <= hw) set(x, y, dx > hw - 1.5 ? sh : col); }
    }
    row(13, 18, 25, '#d5dbdf'); row(14, 17, 26, '#ecf0f1'); row(15, 16, 27, '#ecf0f1');
    for (const [y, x0, x1] of [[26, 10, 13], [27, 11, 13], [28, 12, 13], [29, 13, 13]]) {
      const c = y === 26 ? COLLAR_FOLD : COLLAR;
      row(x0, x1, y, c); row(31 - x1, 31 - x0, y, c);
      set(x0, y, COLLAR_EDGE); set(31 - x0, y, COLLAR_EDGE);
    }
    set(15, 28, '#d0d4d6'); set(16, 28, '#d0d4d6');
    for (let y = 29; y < 32; y++) { set(15, y, '#3a3d42'); set(16, y, '#b9bec2'); }
    // Ears
    for (const ex of [6, 25]) {
      for (let y = 13; y <= 16; y++) set(ex, y, skin);
      set(ex === 6 ? 5 : 26, 14, skin); set(ex === 6 ? 5 : 26, 15, skin);
      set(ex, 14, skinSh); set(ex, 15, skinSh);
    }
    // Head
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const e = ((x + 0.5 - 16) / 8.5) ** 2 + ((y + 0.5 - 14) / 10) ** 2;
      if (e <= 1) set(x, y, e > 0.7 && x + 0.5 > 16 ? skinSh : skin);
    }
    set(16, 15, skinSh); set(16, 16, skinSh); set(15, 17, skinSh); set(16, 17, skinSh);
    const stub = (x, y) => set(x, y, (x + y) % 2 ? '#a07a5e' : '#b88f70');
    for (let x = 13; x <= 18; x++) if ((x + 18) % 2 === 0) stub(x, 18);
    for (let x = 12; x <= 19; x++) stub(x, 19);
    stub(12, 20); stub(12, 21); stub(19, 20); stub(19, 21); stub(13, 21); stub(18, 21); stub(15, 21); stub(16, 21);
    for (let x = 13; x <= 18; x++) stub(x, 22);
    for (let x = 14; x <= 17; x++) stub(x, 23);

    const browCol = mane > 0.6 ? GOLD_DK : BROW_COL;
    const pupilCol = mane > 0.6 ? '#13c6b8' : '#1b1b1b';
    const blink = (t % 3.7) < 0.13;
    const eyes = (style) => {
      for (const [x0, pupil] of [[10, 11], [19, 20]]) {
        if (style === 'closed') { row(x0, x0 + 2, 14, BROW_COL); continue; }
        if (style === 'happy') { row(x0, x0 + 2, 13, BROW_COL); set(x0, 14, BROW_COL); set(x0 + 2, 14, BROW_COL); continue; }
        if (style === 'wide') { for (let y = 12; y <= 14; y++) row(x0, x0 + 2, y, '#ffffff'); set(x0 + 1, 13, pupilCol); continue; }
        const top = style === 'squint' ? 14 : 13;
        for (let y = top; y <= 14; y++) row(x0, x0 + 2, y, '#ffffff');
        for (let y = top; y <= 14; y++) set(pupil, y, pupilCol);
        if (style === 'lidded') row(x0, x0 + 2, 13, skinSh);
        if (style === 'down') set(pupil, 13, '#ffffff');
      }
    };
    const brows = (style) => {
      const L = [10, 11, 12], R = [21, 20, 19];
      const ys = { flat: [11, 11, 11], low: [12, 12, 12], angry: [11, 12, 13], raised: [10, 9, 10], sad: [12, 11, 10] }[style];
      for (let i = 0; i < 3; i++) { set(L[i], ys[i], browCol); set(R[i], ys[i], browCol); }
    };
    const mouth = (style) => {
      const D = MOUTH_COL;
      switch (style) {
        case 'smile': set(13, 20, D); row(14, 17, 21, D); set(18, 20, D); break;
        case 'flat': row(13, 18, 21, D); break;
        case 'yell':
          row(13, 18, 20, D); set(13, 21, D); row(14, 17, 21, TEETH); set(18, 21, D);
          set(13, 22, D); row(14, 17, 22, MOUTH_IN); set(18, 22, D); row(14, 17, 23, D);
          break;
        case 'o':
          set(15, 20, D); set(16, 20, D);
          set(14, 21, D); set(15, 21, MOUTH_IN); set(16, 21, MOUTH_IN); set(17, 21, D);
          set(14, 22, D); set(15, 22, MOUTH_IN); set(16, 22, MOUTH_IN); set(17, 22, D);
          set(15, 23, D); set(16, 23, D);
          break;
        case 'grin': set(12, 20, D); set(19, 20, D); set(13, 21, D); row(14, 17, 21, TEETH); set(18, 21, D); row(14, 17, 22, D); break;
        case 'open': row(14, 17, 20, D); set(13, 21, D); row(14, 17, 21, MOUTH_IN); set(18, 21, D); row(14, 17, 22, D); break;
        case 'frown': row(14, 17, 21, D); set(13, 22, D); set(18, 22, D); break;
        default: break;
      }
    };
    let [eyeStyle, browStyle, mouthStyle] = FACES[expr] || FACES.calm;
    if (o.talk) {
      // talking: the mouth flaps between its normal shape and open shapes
      const f = Math.floor(t * 11) % 4;
      if (f === 1) mouthStyle = expr === 'furious' || expr === 'crying' ? 'yell' : 'open';
      else if (f === 2) mouthStyle = expr === 'calm' || expr === 'happy' ? 'o' : mouthStyle === 'yell' ? 'open' : 'o';
      else if (f === 3) mouthStyle = 'flat';
    }
    const canBlink = ['normal', 'lidded', 'squint', 'down'].includes(eyeStyle);
    eyes(blink && canBlink ? 'closed' : eyeStyle);
    brows(browStyle);
    mouth(mouthStyle);

    // Hair
    if (mane > 0) {
      for (const hp of HAIR_PIXELS) {
        const yy = hp.y;
        set(hp.x, yy, yy <= 4 && hp.x % 3 === 0 ? GOLD_HI : hp.col === HAIR_DK ? GOLD_DK : GOLD);
      }
      // the mane grows in: spikes extend from the head
      for (const [bx, by, tx, ty, hw] of MANE_SPIKES) {
        const ex = bx + (tx - bx) * mane, ey = by + (ty - by) * mane;
        const len = Math.hypot(ex - bx, ey - by);
        const steps = Math.ceil(len * 2) + 1;
        for (let i = 0; i <= steps; i++) {
          const f = i / steps;
          const cx = bx + (ex - bx) * f, cy = by + (ey - by) * f;
          const w = hw * (1 - f * 0.92);
          for (let a = -w; a <= w; a += 0.5) {
            const nx = -(ey - by) / (len || 1), ny = (ex - bx) / (len || 1);
            const x = cx + nx * a, y = cy + ny * a;
            if (y > 9 && Math.abs(x - 16) < 8 && y < 14) continue; // keep the face clear
            set(x, y, a < -w * 0.3 ? GOLD_HI : a > w * 0.5 ? GOLD_DK : GOLD);
          }
        }
      }
    } else {
      for (const hp of HAIR_PIXELS) if (hairFrac >= 1 - hp.keep) set(hp.x, hp.y, hp.col);
      if (hairFrac < 0.6) for (const [x, y] of [[12, 6], [13, 5], [14, 5]]) if (g[y][x] === skin) set(x, y, '#fff1dc');
    }

    const out = g.map((r) => r.slice());
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if (fig[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fig[y + dy] && fig[y + dy][x + dx])) out[y][x] = OUTLINE;
    }
    const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < 32 && y < 32) out[y][x] = c; };
    if (expr === 'furious' && Math.floor(t * 4) % 2) for (const [x, y] of [[25, 2], [27, 2], [26, 3], [25, 4], [27, 4]]) put(x, y, '#e74c3c');
    if (expr === 'shocked' || expr === 'furious') {
      const dy = Math.floor(t * 3) % 3;
      put(26, 7 + dy, '#d6f0ff'); put(25, 8 + dy, '#aee3ff'); put(26, 8 + dy, '#aee3ff'); put(25, 9 + dy, '#7fc8f8'); put(26, 9 + dy, '#7fc8f8');
    }
    if (expr === 'defeated' || expr === 'crying') {
      const n = expr === 'crying' ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const dy = Math.floor(t * 6 + k * 2.3) % 9;
        put(10, 15 + dy, '#7fc8f8'); put(11, 15 + ((dy + 4) % 9), '#aee3ff');
        put(21, 15 + ((dy + 2) % 9), '#7fc8f8'); put(20, 15 + ((dy + 6) % 9), '#aee3ff');
      }
    }
    if (mane > 0.6 && Math.floor(t * 8) % 3 === 0) {
      const sx = Math.floor(hash(Math.floor(t * 8), 3) * 32), sy = Math.floor(hash(Math.floor(t * 8), 7) * 10);
      put(sx, sy, '#ffffff'); put(sx + 1, sy, '#bff8ff'); put(sx, sy + 1, '#bff8ff');
    }
    return out;
  }
  const pcv = document.createElement('canvas');
  pcv.width = pcv.height = 32;
  const pctx = pcv.getContext('2d');
  function drawPortrait(ctx, x, y, size, opts) {
    const grid = buildFace(opts || {});
    for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { pctx.fillStyle = grid[j][i]; pctx.fillRect(i, j, 1, 1); }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pcv, Math.round(x), Math.round(y), size, size);
    ctx.restore();
  }

  // ------------------------------------------------------------------
  // Characters
  // ------------------------------------------------------------------
  const LAP_PAL = {
    h: HAIR_COL, H: HAIR_DK, i: HAIR_HI, k: '#f6cfa6', s: '#e2ae88', e: '#1b1b1b', w: '#ffffff', b: '#c9a07e', m: '#6e2c1f',
    n: '#24395e', N: '#1a2a47', g: '#8f9399', G: '#6e7277', c: '#b3b7bd', u: '#ecf0f1', z: '#3a3d42',
    p: '#4b4f5c', P: '#363944', o: '#3a2618', O: '#22160d', r: '#f2a48a',
  };
  // Mr. Laporte, front view (14 x 23), legs drawn separately for the walk cycle
  const LAP_TOP = [
    '....iihhii....',
    '...hhkhhkhh...',
    '..Hhkkhhkkhh..',
    '..Hkkkhhkkkh..',
    '..skkkkkkkks..',
    '.sHHkkkkkHHks.',
    '.skwekkkkwekk.',
    '..kkkkksskkk..',
    '..kkbbbbbbkk..',
    '..kbbmmmmbbk..',
    '...kbbbbbbk...',
    '....sbbbbs....',
    '.....ssss.....',
    '..nnccuuccnn..',
    '.nnnnczzcnnnn.',
    'gggggggzgggggg',
    'gGggggzgggggGg',
    'nNnnnnnznnnnNn',
    'nkNnnnnznnnNkn',
    '.k.ggggzggg.k.',
    '...gggggggg...',
  ];
  const LAP_LEGS = [
    ['...pppppppp...', '...pp....pp...', '...pp....pp...', '..ooo....ooo..'],
    ['...pppppppp...', '...pp....pp...', '..pp......pp..', '.ooo......ooo.'],
    ['...pppppppp...', '....pp..pp....', '....pp..pp....', '...ooo..ooo...'],
  ];
  function laporteSprite(frame, bald) {
    return cached('lap' + frame + (bald ? 'b' : ''), () => {
      let top = LAP_TOP.slice();
      if (bald) top = top.map((r, j) => (j < 4 ? r.replace(/[hHi]/g, (c, i) => (j === 0 ? '.' : 'k')) : r));
      if (bald) top[0] = '..............', top[1] = '....kkkkkk....';
      return fromRows(top.concat(LAP_LEGS[frame]), LAP_PAL, 3);
    });
  }
  // the golden mane drawn on top of the sprite in-game (animated)
  function drawManeSprite(ctx, x, y, t, grow) {
    const g = grow == null ? 1 : grow;
    ctx.save();
    ctx.translate(x, y);
    const spikes = [[0, -1, 26], [-0.45, -0.9, 22], [0.45, -0.9, 22], [-0.85, -0.5, 20], [0.85, -0.5, 20], [-1, 0.1, 18], [1, 0.1, 18], [-0.2, -1, 24], [0.2, -1, 24], [-0.95, 0.6, 16], [0.95, 0.6, 16]];
    for (const pass of [0, 1]) {
      for (const [dx, dy, len] of spikes) {
        const wob = Math.sin(t * 9 + dx * 5) * 2;
        const L = len * g;
        const bx = dx * 10, by = dy * 8;
        const tx = bx + dx * L + wob, ty = by + dy * L - 4 * g;
        const nx = -dy, ny = dx;
        ctx.beginPath();
        ctx.moveTo(bx + nx * 7, by + ny * 7);
        ctx.lineTo(tx, ty);
        ctx.lineTo(bx - nx * 7, by - ny * 7);
        ctx.closePath();
        if (pass === 0) { ctx.strokeStyle = OUTLINE; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.stroke(); }
        else { ctx.fillStyle = GOLD; ctx.fill(); }
      }
      if (pass === 0) { ctx.beginPath(); ctx.ellipse(0, 0, 16, 12, 0, 0, TAU); ctx.lineWidth = 6; ctx.stroke(); }
      else { ctx.fillStyle = GOLD; ctx.beginPath(); ctx.ellipse(0, 0, 16, 12, 0, 0, TAU); ctx.fill(); }
    }
    ctx.fillStyle = GOLD_HI;
    for (const [dx, dy, len] of spikes.slice(0, 5)) {
      const L = len * g * 0.6;
      ctx.beginPath(); ctx.moveTo(dx * 10 - 2, dy * 8); ctx.lineTo(dx * 10 + dx * L, dy * 8 + dy * L - 3); ctx.lineTo(dx * 10 + 2, dy * 8); ctx.fill();
    }
    ctx.restore();
  }

  // The hero: a student in a hoodie with a backpack and a glowing calculator
  const HERO_PAL = {
    h: '#3b2a20', H: '#2a1d16', k: '#dfae86', s: '#c48f68', v: '#8e5bd6', V: '#6a3fb0', L: '#c7a6ff', e: '#1b1b1b', w: '#ffffff',
    t: '#2bb5a0', T: '#1d8676', l: '#7fe6d4', b: '#e8833a', B: '#b85f22', j: '#3b4a74', J: '#2a3555', o: '#e9e9ef', O: '#9fa3b5',
  };
  const HERO_FRONT = [
    '...hhhhhh...',
    '..hhhhhhhh..',
    '.hhkhhhhkhh.',
    '.hkkkkkkkkh.',
    '.hkwekkwekh.',
    '..kkkkkkkk..',
    '..kkkmmkkk..',
    '...tlttlt...',
    '.bttttttttb.',
    'kbtTttttTtbk',
    'k.tTttttTt.k',
    '..tttttttt..',
    '..jjjjjjjj..',
  ];
  const HERO_BACK = [
    '...hhhhhh...',
    '..hhhhhhhh..',
    '.hhhhhhhhhh.',
    '.hhhhhhhhhh.',
    '.hHhhhhhhHh.',
    '..hhhhhhhh..',
    '..ssssssss..',
    '..bbbbbbbb..',
    '.tbBBBBBBbt.',
    'ktbBbbbbBbtk',
    'k.bBBBBBBb.k',
    '..tbbbbbbt..',
    '..jjjjjjjj..',
  ];
  const HERO_LEGS = [
    ['..jj....jj..', '..oo....oo..'],
    ['..jj.....jj.', '.oo......oo.'],
    ['...jj..jj...', '...oo..oo...'],
  ];
  const GIRL_FRONT = [
    '..hhhhhhhh..',
    '.hhhhhhhhhh.',
    '.hhkhhhhkhh.',
    'hhkkkkkkkkhh',
    'hhkwekkwekhh',
    'hhkkkkkkkkhh',
    'hhskkmmkkshh',
    '.hvLvvvvLvh.',
    '.bvvvvvvvvb.',
    'kbvVvvvvVvbk',
    'k.vVvvvvVv.k',
    '..vvvvvvvv..',
    '..jjjjjjjj..',
  ];
  const GIRL_BACK = [
    '..hhhhhhhh..',
    '.hhhhhhhhhh.',
    '.hhhhhhhhhh.',
    'hhhhhhhhhhhh',
    'hhHhhhhhhHhh',
    'hhhhhhhhhhhh',
    'hhhhhhhhhhhh',
    '.hbbbbbbbbh.',
    '.vbBBBBBBbv.',
    'kvbBbbbbBbvk',
    'k.bBBBBBBb.k',
    '..vbbbbbbv..',
    '..jjjjjjjj..',
  ];
  const HERO_MOUTH = { m: '#a8584a' };
  function heroSprite(back, frame, kind) {
    const girl = kind === 'girl';
    return cached('hero' + (girl ? 'g' : 'b') + (back ? 'b' : 'f') + frame, () => fromRows(
      (girl ? (back ? GIRL_BACK : GIRL_FRONT) : (back ? HERO_BACK : HERO_FRONT)).concat(HERO_LEGS[frame]), Object.assign({}, HERO_PAL, HERO_MOUTH), 3));
  }

  // The substitute teacher (Sub Plans): gray hair, glasses, mustache, tweed jacket, coffee mug
  const SUB_PAL = { g: '#cfcfcf', G: '#2a2a2a', k: '#f0c9a8', s: '#d9a888', w: '#ffffff', M: '#b0b0b0', m: '#7a3a2a', t: '#8a6a4a', T: '#6a4f36', c: '#e2dccc', r: '#b03030', o: '#eef0f6', O: '#9aa3b5', p: '#4a4a55', b: '#2a1d14' };
  const SUB_ROWS = [
    '....gggggg....',
    '...gggggggg...',
    '..gkkkkkkkkg..',
    '..gkkkkkkkkg..',
    '..kGGGkkGGGk..',
    '..kGwGGGGwGk..',
    '..kGGGkkGGGk..',
    '..kkkkssskkk..',
    '..kkMMMMMMkk..',
    '...kkmmmmkk...',
    '....kkkkkk....',
    '.....ssss.....',
    '..ttcwrrwctt..',
    '.tttcwrrwcttt.',
    'tTtttwrrwtttTt',
    'tTtttwrrwtttTt',
    'tk.tttrrttt.oO',
    '...tttttttt.oo',
    '...pppppppp...',
    '...pp....pp...',
    '...pp....pp...',
    '..bbb....bbb..',
  ];
  const subSprite = () => cached('sub', () => fromRows(SUB_ROWS, SUB_PAL, 3));

  // Security guard (red uniform)
  const GUARD_PAL = { c: '#c0392b', C: '#8e2a20', v: '#f1c40f', k: '#e0ac69', s: '#c48a4f', e: '#1b1b1b', r: '#e74c3c', R: '#a93226', p: '#2c3e50', o: '#151515', w: '#ffffff' };
  const GUARD_TOP = [
    '...cccccc...',
    '..cCCvvCCc..',
    '.cccccccccc.',
    '..kkkkkkkk..',
    '..kekkkkek..',
    '..kkkkkkkk..',
    '...kssssk...',
    '.rrrrwwrrrr.',
    'rRrrrwwrrrRr',
    'rRrrvrrrrrRr',
    'kRrrrrrrrrRk',
    '..rrrrrrrr..',
    '..pppppppp..',
  ];
  function guardSprite(frame) { return cached('guard' + frame, () => fromRows(GUARD_TOP.concat(HERO_LEGS[frame].map((r) => r.replace(/j/g, 'p').replace(/o/g, 'o'))), GUARD_PAL, 3)); }

  // ------------------------------------------------------------------
  // Enemies (tinted per floor)
  // ------------------------------------------------------------------
  function slimeSprite(color, f) {
    return cached('slime' + color + f, () => sprite(18, 15, 3, (p) => {
      const sq = [0, 1, 2][f];
      const T = tones(color);
      p.ball(9, 9 + sq * 0.5, 8 + sq * 0.6, 6 - sq * 0.5, T);
      p.ell(9, 3.5 + sq, 2, 2, T[2]);
      p.px(8, 2 + sq, T[3]);
      p.rect(5, 7 + sq, 2, 3, '#ffffff'); p.rect(11, 7 + sq, 2, 3, '#ffffff');
      p.rect(6, 8 + sq, 1, 2, '#1b1b1b'); p.rect(12, 8 + sq, 1, 2, '#1b1b1b');
      p.px(4, 10 + sq, shade(color, -0.1)); p.px(14, 10 + sq, shade(color, -0.1));
      p.rect(8, 11 + sq * 0.5, 3, 1, T[0]);
      p.px(4, 6 + sq, T[3]); p.px(5, 5 + sq, T[3]);
    }));
  }
  function batSprite(color, f) {
    return cached('bat' + color + f, () => sprite(22, 12, 3, (p) => {
      const T = tones(color);
      const up = f === 0;
      for (const s of [-1, 1]) {
        for (let i = 0; i < 9; i++) {
          const x = 11 + s * (3 + i);
          const top = up ? 1 + Math.floor(i * 0.3) : 4 + Math.floor(i * 0.4);
          const bot = up ? 5 + (i % 3 === 2 ? -1 : 0) : 9 - (i % 3 === 2 ? 1 : 0);
          for (let y = top; y <= bot; y++) p.px(x, y, y === top ? T[1] : T[0]);
        }
      }
      p.ball(11, 6, 3.5, 4, T);
      p.px(9, 2, T[1]); p.px(13, 2, T[1]);
      p.px(10, 5, '#ff3b3b'); p.px(12, 5, '#ff3b3b');
      p.px(10, 8, '#ffffff'); p.px(12, 8, '#ffffff');
    }));
  }
  function ghostSprite(color, f, flag) {
    return cached('ghost' + color + f + (flag ? 'F' : ''), () => sprite(16, 18, 3, (p) => {
      const T = tones(color);
      p.ball(8, 7, 7, 7, T);
      p.rect(1, 7, 14, 6, T[1]);
      p.rect(1, 7, 3, 6, T[2]);
      for (let x = 1; x < 15; x++) {
        const h = 13 + ((x + f * 2) % 4 < 2 ? 2 : 0);
        for (let y = 13; y < h + 1; y++) p.px(x, y, x < 4 ? T[2] : T[1]);
      }
      p.rect(4, 6, 2, 3, '#1b1430'); p.rect(10, 6, 2, 3, '#1b1430');
      p.px(4, 6, '#ffffff'); p.px(10, 6, '#ffffff');
      p.ell(8, 11, 1.5, 1.2, '#1b1430');
      if (flag) {
        p.rect(14, 0, 1, 12, '#8a6a4a');
        p.rect(15, 0, 1, 1, '#fff'); // the flag gets drawn bigger in game
      }
    }));
  }
  function archerSprite(f, aim) {
    return cached('archer' + f + (aim ? 'a' : ''), () => sprite(16, 20, 3, (p) => {
      const B = '#ece5d0', Bs = '#b9b09a', D = '#2a2236';
      p.ball(7, 4, 4, 4, ['#a39a84', Bs, B, '#ffffff']);
      p.rect(5, 3, 2, 2, D); p.rect(8, 3, 2, 2, D);
      p.px(5, 3, aim ? '#ff4040' : '#7fd1ff'); p.px(8, 3, aim ? '#ff4040' : '#7fd1ff');
      p.rect(6, 7, 3, 1, Bs);
      p.rect(4, 9, 7, 6, '#5b3d7a');
      p.rect(4, 9, 7, 1, '#7a56a3');
      for (let y = 10; y < 15; y += 2) p.rect(5, y, 5, 1, B);
      p.rect(3, 9, 1, 5, B); p.rect(11, 9, 1, 4, B);
      const lx = f ? 1 : 0;
      p.rect(5 - lx, 15, 1, 4, B); p.rect(9 + lx, 15, 1, 4, B);
      // bow
      const bc = aim ? '#ff7a59' : '#b8834f';
      for (let y = 4; y <= 16; y++) { const dx = Math.round(Math.sin(((y - 4) / 12) * Math.PI) * 2.5); p.px(12 + dx, y, bc); }
      p.line(12, 4, 12, 16, aim ? '#ffd0c0' : '#e8e0c8');
    }));
  }
  function boarSprite(color, f) {
    return cached('boar' + color + f, () => sprite(22, 16, 3, (p) => {
      const T = tones(color);
      p.ball(11, 8, 9, 6, T);
      p.ball(4, 9, 4, 4, T);
      p.rect(1, 9, 2, 3, '#e8a6a0'); p.px(1, 10, '#6b3a36'); p.px(2, 10, '#6b3a36');
      p.px(4, 7, '#1b1b1b'); p.px(4, 6, '#ffffff');
      p.px(1, 12, '#fffbe8'); p.px(2, 13, '#fffbe8'); p.px(3, 12, '#fffbe8');
      for (let x = 8; x < 18; x += 2) p.px(x, 2, T[0]);
      const k = f ? 1 : 0;
      p.rect(6 + k, 13, 2, 3, T[0]); p.rect(15 - k, 13, 2, 3, T[0]); p.rect(10 - k, 13, 2, 3, T[0]); p.rect(18, 12, 1, 2, T[0]);
      p.px(20, 6, T[1]); p.px(21, 5, T[1]);
    }));
  }
  function eyeSprite(color) {
    return cached('eye' + color, () => sprite(20, 20, 3, (p) => {
      p.ball(10, 10, 9, 9, ['#c9c0d8', '#e8e2f0', '#ffffff', '#ffffff']);
      for (const [a, l] of [[0.3, 6], [1.9, 5], [3.4, 6], [4.6, 5], [5.6, 6]]) {
        for (let i = 0; i < l; i++) p.px(10 + Math.cos(a) * (9 - i * 0.7), 10 + Math.sin(a) * (9 - i * 0.7) + (i % 2), '#e0607a');
      }
    }));
  }

  // ------------------------------------------------------------------
  // Pickups / objects
  // ------------------------------------------------------------------
  const coinSprite = (f) => cached('coin' + f, () => sprite(9, 9, 3, (p) => {
    const w = [4, 3, 1.4, 3][f];
    p.ell(4.5, 4.5, w, 4, (x, y, e) => (x + 0.5 < 4.5 && e > 0.4 ? '#fff0a0' : e > 0.6 ? '#c89411' : '#ffd23f'));
    if (w > 2) p.rect(4, 2, 1, 5, '#c89411');
  }));
  const heartSprite = (half) => cached('heart' + half, () => sprite(11, 10, 3, (p) => {
    const R = '#ff4f6d', D = '#c22a48', L = '#ffb0be';
    const rows = ['.RRR...RRR.', 'RRLRR.RRRRR', 'RLRRRRRRRRD', 'RRRRRRRRRRD', 'RRRRRRRRRDD', '.RRRRRRRRD.', '..RRRRRRD..', '...RRRRD...', '....RRD....', '.....D.....'];
    p.rows(0, 0, rows, { R, D, L });
    if (half) for (let y = 0; y < 10; y++) for (let x = 6; x < 11; x++) if (p.get(x, y)) p.px(x, y, '#3a2a40');
  }));
  const edamameSprite = () => cached('edamame', () => sprite(11, 8, 3, (p) => {
    // one dry-roasted edamame bean: oval, khaki green with toasted speckles and a seam
    p.ball(5.5, 4, 5.2, 3.6, ['#5f6b25', '#8e9c3c', '#b9c463', '#e6ebae']);
    p.line(2, 4, 8, 3, '#6f7a2c');
    p.px(3, 2, '#a07a3a'); p.px(7, 5, '#a07a3a'); p.px(5, 6, '#8a6a30');
    p.px(3, 1, '#f4f6d0'); p.px(4, 1, '#f4f6d0');
  }));
  const beanSprite = () => cached('bean', () => sprite(4, 3, 3, (p) => p.ball(2, 1.5, 2, 1.5, ['#5f6b25', '#8e9c3c', '#b9c463', '#e6ebae'])));

  function chestSprite(kind, open) {
    return cached('chest' + kind + open, () => sprite(22, 18, 3, (p) => {
      const wood = kind === 'gold' ? ['#7a4a12', '#b0731f', '#e0a33a', '#ffd27a'] : kind === 'boss' ? ['#4a1d5c', '#6e2c8a', '#9b4dc4', '#d29cff'] : ['#4a2d16', '#6e4423', '#94612f', '#c08a4f'];
      const band = kind === 'gold' ? '#fff0a0' : '#c9ced8';
      const bandD = kind === 'gold' ? '#c89411' : '#7d8496';
      if (open) {
        p.rect(1, 2, 20, 6, '#1a1020');
        p.rect(1, 0, 20, 3, wood[2]); p.rect(1, 0, 20, 1, wood[3]);
        p.rect(3, 4, 16, 3, '#ffd23f'); p.px(6, 4, '#fff7c2'); p.px(12, 5, '#fff7c2');
      } else {
        p.rect(1, 1, 20, 7, wood[2]); p.rect(1, 1, 20, 1, wood[3]); p.rect(1, 6, 20, 2, wood[1]);
      }
      p.rect(1, 8, 20, 9, wood[1]); p.rect(1, 8, 20, 1, wood[2]); p.rect(1, 15, 20, 2, wood[0]);
      for (const x of [3, 17]) { p.rect(x, open ? 8 : 1, 2, open ? 9 : 16, band); p.rect(x + 1, open ? 8 : 1, 1, open ? 9 : 16, bandD); }
      if (!open) {
        p.rect(9, 6, 4, 5, '#2b2b38'); p.rect(10, 7, 2, 3, kind === 'boss' ? '#d29cff' : '#ffd23f'); p.px(10, 9, '#2b2b38');
      }
    }));
  }

  // ------------------------------------------------------------------
  // Bosses (procedural pixel art, a few animation frames each)
  // ------------------------------------------------------------------
  function rankenstein(f, flash) {
    return cached('rank' + f + flash, () => sprite(34, 40, 3, (p) => {
      const S = flash ? ['#ffffff', '#ffffff', '#ffffff', '#ffffff'] : ['#3f5a3c', '#5f8a55', '#86b273', '#b5dc9c'];
      const coat = flash ? '#fff' : '#3a3550', coatD = flash ? '#fff' : '#272338';
      const arm = f % 2;
      // body / coat
      p.rect(6, 17, 22, 17, coat); p.rect(6, 31, 22, 3, coatD); p.rect(6, 17, 3, 17, coatD);
      p.rect(16, 18, 2, 16, coatD);
      // arms
      p.rect(1, 18 + arm, 5, 14, coat); p.rect(28, 18 - arm, 5, 14, coat);
      p.ball(3.5, 33 + arm, 3, 2.6, S); p.ball(30.5, 32 - arm, 3, 2.6, S);
      // legs
      p.rect(9, 34, 6, 5, '#26222f'); p.rect(19, 34, 6, 5, '#26222f');
      p.rect(8, 38, 8, 2, '#111'); p.rect(18, 38, 8, 2, '#111');
      // chest dotplot
      const cols = [2, 4, 3, 1, 5, 2];
      cols.forEach((n, i) => { for (let k = 0; k < n; k++) p.px(10 + i * 2.4, 29 - k * 2, flash ? '#fff' : ['#5ab0ff', '#ffd23f', '#ff6b6b', '#5fd38a', '#c9a7ff', '#7fd1ff'][i]); });
      p.rect(9, 30, 16, 1, flash ? '#fff' : '#e8e4ff');
      // head (flat top)
      p.rect(8, 2, 18, 14, S[2]); p.rect(8, 12, 18, 4, S[1]); p.rect(23, 2, 3, 14, S[1]); p.rect(8, 2, 18, 1, S[3]);
      p.rect(7, 0, 20, 3, flash ? '#fff' : '#1f1b29'); p.rect(9, 3, 4, 1, flash ? '#fff' : '#1f1b29'); p.rect(19, 3, 5, 1, flash ? '#fff' : '#1f1b29');
      // stitches
      for (let x = 10; x < 20; x += 2) { p.px(x, 5, S[0]); p.px(x + 1, 4, S[0]); p.px(x + 1, 6, S[0]); }
      // eyes
      p.rect(11, 8, 3, 3, '#fff'); p.rect(19, 8, 3, 3, '#fff'); p.px(12, 9, '#c0392b'); p.px(20, 9, '#c0392b');
      p.rect(10, 7, 5, 1, S[0]); p.rect(18, 7, 5, 1, S[0]);
      // mouth with teeth
      p.rect(12, 13, 9, 2, '#2a1a1a'); for (let x = 13; x < 21; x += 2) p.px(x, 13, '#f0ead8');
      // bolts
      p.rect(4, 11, 4, 3, '#9aa3ad'); p.rect(26, 11, 4, 3, '#9aa3ad'); p.px(4, 11, '#d6dde6'); p.px(29, 11, '#d6dde6');
    }));
  }
  function monolith(f, flash) {
    return cached('mono' + f + flash, () => sprite(30, 36, 3, (p) => {
      const S = flash ? ['#fff', '#fff', '#fff', '#fff'] : ['#7a5a2a', '#b38a4a', '#d9b06a', '#f4d89a'];
      p.rect(2, 2, 26, 32, S[2]); p.rect(2, 2, 26, 2, S[3]); p.rect(24, 2, 4, 32, S[1]); p.rect(2, 30, 26, 4, S[0]);
      // carved grid
      for (let x = 6; x < 24; x += 6) p.rect(x, 4, 1, 26, S[1]);
      for (let y = 8; y < 30; y += 7) p.rect(2, y, 22, 1, S[1]);
      // glowing runes "1/(b-a)"
      const R = flash ? '#fff' : f ? '#7ff5ff' : '#3fd7ff';
      p.rect(8, 6, 1, 4, R); p.rect(11, 8, 4, 1, R); p.rect(17, 6, 1, 1, R); p.rect(16, 7, 3, 3, R);
      // face
      p.rect(7, 14, 5, 4, '#2a1f10'); p.rect(18, 14, 5, 4, '#2a1f10');
      p.rect(9, 15, 2, 2, R); p.rect(20, 15, 2, 2, R);
      p.rect(9, 22, 12, 2, '#2a1f10'); p.rect(10, 22, 10, 1, f ? R : '#2a1f10');
    }));
  }
  function zed(f, flash) {
    return cached('zed' + f + flash, () => sprite(30, 36, 3, (p) => {
      const S = flash ? ['#fff', '#fff', '#fff', '#fff'] : ['#1f5a3a', '#2f8a55', '#4fc27a', '#9ef0b8'];
      const robe = flash ? ['#fff', '#fff', '#fff'] : ['#2a1f55', '#3f2f80', '#5a46b0'];
      // robe
      for (let y = 15; y < 35; y++) { const w = 6 + (y - 15) * 0.45; p.rect(15 - w, y, w * 2, 1, y > 31 ? robe[0] : robe[1]); p.rect(15 - w, y, 2, 1, robe[2]); }
      for (let y = 18; y < 34; y += 4) p.rect(14, y, 2, 2, '#ffd23f');
      // tail
      for (let i = 0; i < 9; i++) p.px(24 + i * 0.7, 32 - Math.sin(i * 0.6 + f) * 2, S[1]);
      // head: lizard snout
      p.ball(15, 9, 7, 6, S);
      p.ball(15, 12, 6, 3.4, S);
      p.px(12, 13, S[0]); p.px(18, 13, S[0]);
      p.rect(10, 7, 3, 3, '#fff7a8'); p.rect(18, 7, 3, 3, '#fff7a8'); p.rect(11, 7, 1, 3, '#1b1b1b'); p.rect(19, 7, 1, 3, '#1b1b1b');
      // wizard hat with a Z
      for (let y = -0; y < 6; y++) p.rect(15 - (6 - y) * 1.2, y - 0, (6 - y) * 2.4, 1, robe[1]);
      p.rect(7, 4, 16, 2, robe[2]);
      p.rect(13, 0, 4, 1, '#ffd23f'); p.px(15, 1, '#ffd23f'); p.px(14, 2, '#ffd23f'); p.rect(13, 3, 4, 1, '#ffd23f');
      // staff
      p.rect(3, 8, 1, 26, '#8a6a4a');
      p.ball(3.5, 6, 3, 3, flash ? ['#fff', '#fff', '#fff', '#fff'] : ['#1b6fd1', '#3f9bff', '#9fd3ff', '#ffffff']);
      p.rect(4, 18 + f, 3, 2, S[2]);
    }));
  }
  function bell(f, flash) {
    return cached('bell' + f + flash, () => sprite(38, 38, 3, (p) => {
      const S = flash ? ['#fff', '#fff', '#fff', '#fff'] : ['#6a3f12', '#a8661f', '#d99a3a', '#ffe08a'];
      // bell curve silhouette: width follows a normal curve shape
      for (let y = 4; y < 33; y++) {
        const u = (y - 4) / 29;
        const w = 4 + 15 * (1 - Math.exp(-u * u * 4.5)) + u * 2;
        for (let x = Math.round(19 - w); x <= Math.round(19 + w); x++) {
          const nx = (x - 19) / w;
          p.px(x, y, nx < -0.55 ? S[3] : nx < 0.1 ? S[2] : nx < 0.65 ? S[1] : S[0]);
        }
      }
      p.rect(1, 31, 36, 3, S[1]); p.rect(1, 31, 36, 1, S[3]); p.rect(1, 33, 36, 1, S[0]);
      p.rect(16, 0, 6, 4, S[1]); p.rect(17, 0, 4, 1, S[3]);
      // engraved bell curve
      for (let x = 8; x <= 30; x++) { const z = (x - 19) / 4; p.px(x, 27 - Math.round(7 * Math.exp(-z * z / 2)), flash ? '#fff' : '#ffe08a'); }
      // face
      p.rect(12, 14, 4, 4, '#2a1606'); p.rect(22, 14, 4, 4, '#2a1606');
      p.rect(13, 15, 2, 2, f ? '#ff5f3f' : '#ffd23f'); p.rect(23, 15, 2, 2, f ? '#ff5f3f' : '#ffd23f');
      p.rect(9, 12, 6, 1, '#2a1606'); p.rect(23, 12, 6, 1, '#2a1606');
      // clapper
      p.ball(19 + (f ? 3 : -3), 35, 2.5, 2.5, ['#333', '#555', '#888', '#bbb']);
    }));
  }
  function emperor(f, flash) {
    return cached('emp' + f + flash, () => sprite(36, 40, 3, (p) => {
      const R = flash ? ['#fff', '#fff', '#fff', '#fff'] : ['#3a0f3f', '#5e1a66', '#8a2b95', '#c66bd1'];
      // cape
      for (let y = 12; y < 39; y++) { const w = 9 + (y - 12) * 0.32; p.rect(18 - w, y, w * 2, 1, y > 35 ? R[0] : R[1]); }
      p.rect(9, 12, 3, 27, R[2]);
      // robe front with 3 bands 68 / 95 / 99.7
      p.rect(13, 16, 10, 22, flash ? '#fff' : '#efe6ff');
      p.rect(13, 20, 10, 2, flash ? '#fff' : '#ffd23f'); p.rect(13, 27, 10, 2, flash ? '#fff' : '#ff9f43'); p.rect(13, 34, 10, 2, flash ? '#fff' : '#ff5f6d');
      // head
      p.ball(18, 9, 6, 6, flash ? ['#fff', '#fff', '#fff', '#fff'] : ['#b08a7a', '#d8b0a0', '#f2cdbf', '#fff0e8']);
      p.rect(14, 8, 3, 2, '#fff'); p.rect(19, 8, 3, 2, '#fff'); p.px(15, 9, '#7a1fa0'); p.px(20, 9, '#7a1fa0');
      p.rect(14, 12, 8, 3, flash ? '#fff' : '#e8e4f0'); p.rect(16, 15, 4, 2, flash ? '#fff' : '#e8e4f0'); // beard
      // crown with three gems
      p.rect(11, 1, 14, 3, '#ffd23f'); p.px(11, 0, '#ffd23f'); p.px(18, 0, '#ffd23f'); p.px(24, 0, '#ffd23f');
      p.px(13, 2, '#5fd38a'); p.px(18, 2, '#5ab0ff'); p.px(23, 2, '#ff5f6d');
      // scepter
      p.rect(31, 10, 1, 24, '#ffd23f');
      p.ell(31.5, 8, 3, 3, (x, y, e) => (e < 0.3 ? '#fff' : e < 0.6 ? (f ? '#ff9ff3' : '#c66bd1') : '#7a1fa0'));
      p.rect(27, 20 + f, 4, 3, flash ? '#fff' : '#f2cdbf');
    }));
  }

  // ------------------------------------------------------------------
  // Room tilesets
  // ------------------------------------------------------------------
  const THEMES = [
    { id: 'catacombs', name: 'The Ranked Catacombs', sec: '3.1', floorA: '#2b2a3f', floorB: '#302f47', grout: '#1d1c2c', wall: '#1a1828', wallFace: '#3a3754', wallTop: '#55517a', wallHi: '#7a75a6', rock: '#6a6688', accent: '#7fd1ff', light: 'rgba(255,170,90,1)', ambient: 'dust', bg: '#0d0c16' },
    { id: 'flatlands', name: 'The Flatlands', sec: '3.2', floorA: '#b98d55', floorB: '#c39760', grout: '#9c7444', wall: '#5a3f22', wallFace: '#8a6236', wallTop: '#c49a5c', wallHi: '#ecc98a', rock: '#a87a44', accent: '#ffd27a', light: 'rgba(255,220,150,1)', ambient: 'sand', bg: '#2a1c0e' },
    { id: 'swamp', name: 'Standard Deviation Swamp', sec: '3.3', floorA: '#24402f', floorB: '#284735', grout: '#183022', wall: '#0f1f16', wallFace: '#2b4a35', wallTop: '#3f6b4b', wallHi: '#6aa077', rock: '#5c4a32', accent: '#8dff9e', light: 'rgba(170,255,140,1)', ambient: 'firefly', bg: '#07120b' },
    { id: 'belltower', name: 'The Bell Tower', sec: '3.4', floorA: '#3a2a22', floorB: '#423026', grout: '#24180f', wall: '#1c120c', wallFace: '#5a3a24', wallTop: '#8a5a32', wallHi: '#c98a4a', rock: '#a8661f', accent: '#ffb84d', light: 'rgba(255,190,110,1)', ambient: 'note', bg: '#120a06' },
    { id: 'abyss', name: 'The 68-95-99.7 Abyss', sec: '3.5', floorA: '#22163a', floorB: '#271a42', grout: '#150d26', wall: '#0b0614', wallFace: '#2e1d4f', wallTop: '#4a2f7a', wallHi: '#8a6ad1', rock: '#5a3f9a', accent: '#d29cff', light: 'rgba(200,140,255,1)', ambient: 'ember', bg: '#06030d' },
  ];
  const LOUNGE_THEME = { id: 'lounge', name: "Teachers' Lounge", floorA: '#6b4a3a', floorB: '#6b4a3a', grout: '#5a3c2f', wall: '#2a2f3a', wallFace: '#c9c2a8', wallTop: '#e8e0c4', wallHi: '#fffbe8', rock: '#888', accent: '#ffe27a', light: 'rgba(255,240,200,1)', ambient: 'steam', bg: '#1a120e' };

  function rnd(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // Draw a whole room background (floor, walls, obstacles, decorations) once.
  // tiles: 2D array; kinds: 0 floor, 1 wall, 2 rock, 3 pit
  function renderRoom(room, theme, T, COLS, ROWS) {
    const c = document.createElement('canvas');
    c.width = COLS * T; c.height = ROWS * T;
    const g = c.getContext('2d');
    const R = rnd(room.seed || 7);
    const t = room.tiles;
    g.fillStyle = theme.bg; g.fillRect(0, 0, c.width, c.height);
    // floor
    for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) {
      const x = cc * T, y = r * T;
      if (theme.id === 'lounge') {
        // carpet with a pattern
        g.fillStyle = (r + cc) % 2 ? '#5d3f52' : '#634457'; g.fillRect(x, y, T, T);
        g.fillStyle = 'rgba(255,220,160,0.08)'; g.fillRect(x + T / 2 - 3, y + T / 2 - 3, 6, 6);
        continue;
      }
      g.fillStyle = (r + cc) % 2 ? theme.floorA : theme.floorB;
      g.fillRect(x, y, T, T);
      // subtle per-tile variation
      g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${(R() * 0.05).toFixed(3)})`;
      g.fillRect(x, y, T, T);
      g.fillStyle = theme.grout;
      if (theme.id === 'flatlands') {
        g.fillRect(x, y, T, 1); g.fillRect(x, y, 1, T);
        g.fillStyle = 'rgba(255,240,200,0.12)';
        for (let i = 0; i < 3; i++) { const yy = y + 8 + i * 14 + Math.floor(R() * 4); g.fillRect(x + 4, yy, T - 8, 2); }
      } else if (theme.id === 'swamp') {
        if (R() < 0.35) { g.fillStyle = 'rgba(80,140,90,0.35)'; g.beginPath(); g.ellipse(x + R() * T, y + R() * T, 8 + R() * 10, 4 + R() * 5, 0, 0, TAU); g.fill(); }
      } else {
        g.fillRect(x, y + T - 3, T, 3); g.fillRect(x + T - 3, y, 3, T);
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, y, T - 3, 2);
        if (theme.id === 'abyss' && R() < 0.12) { g.fillStyle = 'rgba(210,156,255,0.35)'; g.fillRect(x + 10 + R() * 20, y + 10 + R() * 20, 3, 3); }
        if (theme.id === 'belltower' && R() < 0.15) { g.strokeStyle = 'rgba(255,190,110,0.15)'; g.lineWidth = 2; g.beginPath(); g.arc(x + T / 2, y + T / 2, 12, 0, TAU); g.stroke(); }
      }
      if (R() < 0.18) { // cracks / pebbles
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
        g.beginPath(); let px = x + R() * T, py = y + R() * T; g.moveTo(px, py);
        for (let i = 0; i < 3; i++) { px += (R() - 0.5) * 18; py += (R() - 0.5) * 18; g.lineTo(px, py); }
        g.stroke();
      }
    }
    // decorations on the floor
    for (const d of room.deco || []) drawDeco(g, theme, d, R);
    // pits
    for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) if (t[r][cc] === 3) {
      const x = cc * T, y = r * T;
      g.fillStyle = '#030206'; g.fillRect(x, y, T, T);
      const up = r > 0 && t[r - 1][cc] !== 3;
      if (up) { const gr = g.createLinearGradient(0, y, 0, y + 22); gr.addColorStop(0, theme.wallFace); gr.addColorStop(1, '#030206'); g.fillStyle = gr; g.fillRect(x, y, T, 22); }
      if (theme.id === 'abyss' || theme.id === 'flatlands') { g.fillStyle = 'rgba(210,156,255,0.4)'; if (R() < 0.6) g.fillRect(x + R() * T, y + 20 + R() * 20, 2, 2); }
    }
    // walls
    for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) if (t[r][cc] === 1) drawWall(g, theme, cc, r, T, t, R, ROWS, COLS);
    // obstacles
    for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) if (t[r][cc] === 2) drawRock(g, theme, cc * T, r * T, T, R);
    // inner shadow along the walls
    const sh = g.createLinearGradient(0, T, 0, T + 26);
    sh.addColorStop(0, 'rgba(0,0,0,0.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.fillRect(T, T, c.width - 2 * T, 26);
    return c;
  }
  function drawWall(g, th, cc, r, T, t, R, ROWS, COLS) {
    const x = cc * T, y = r * T;
    const below = r + 1 < ROWS && t[r + 1][cc] !== 1;
    g.fillStyle = th.wall; g.fillRect(x, y, T, T);
    if (th.id === 'lounge') {
      g.fillStyle = below ? '#d8d0b4' : '#b8b094'; g.fillRect(x, y, T, T);
      if (below) { g.fillStyle = '#7a5a3a'; g.fillRect(x, y + T - 10, T, 10); }
      g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(x + (cc % 2) * 24, y, 2, T);
      return;
    }
    // bricks
    const bh = 12;
    for (let yy = 0; yy < T; yy += bh) {
      const off = ((yy / bh + r) % 2) * 12;
      for (let xx = -off; xx < T; xx += 24) {
        const v = R();
        g.fillStyle = v < 0.33 ? th.wallFace : v < 0.66 ? shade(th.wallFace, 0.06) : shade(th.wallFace, -0.08);
        g.fillRect(x + Math.max(0, xx) + 1, y + yy + 1, Math.min(22, T - Math.max(0, xx) - 1, xx + 22), bh - 2);
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(x + Math.max(0, xx) + 1, y + yy + 1, Math.min(22, T - Math.max(0, xx) - 1, xx + 22), 2);
      }
    }
    if (below) {
      // the front face of a wall gets a lit top edge and darker base
      g.fillStyle = th.wallTop; g.fillRect(x, y, T, 6);
      g.fillStyle = th.wallHi; g.fillRect(x, y, T, 2);
      const gr = g.createLinearGradient(0, y + T - 14, 0, y + T);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = gr; g.fillRect(x, y + T - 14, T, 14);
      if (th.id === 'swamp' && R() < 0.5) { g.fillStyle = '#3f8a4a'; for (let i = 0; i < 4; i++) g.fillRect(x + R() * T, y + T - 6 - R() * 18, 3, 10 + R() * 8); }
    } else {
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, T, T);
    }
  }
  function drawRock(g, th, x, y, T, R) {
    const cx = x + T / 2, cy = y + T / 2;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(cx, y + T - 4, T * 0.45, 8, 0, 0, TAU); g.fill();
    const tn = tones(th.rock);
    if (th.id === 'catacombs') {
      // tombstone with a percentile carved on it
      g.fillStyle = OUTLINE; rrect(g, x + 5, y + 1, T - 10, T - 3, 16); g.fill();
      g.fillStyle = tn[2]; rrect(g, x + 8, y + 4, T - 16, T - 9, 13); g.fill();
      g.fillStyle = tn[1]; g.fillRect(x + T - 16, y + 12, 8, T - 18);
      g.fillStyle = tn[3]; g.fillRect(x + 12, y + 7, 12, 3);
      g.fillStyle = tn[0]; g.font = 'bold 13px monospace'; g.textAlign = 'center';
      g.fillText(['P50', 'P25', 'P75', 'P90', 'P10', 'RIP'][Math.floor(R() * 6)], cx, cy + 6);
    } else if (th.id === 'flatlands') {
      g.fillStyle = OUTLINE; g.fillRect(x + 2, y + 6, T - 4, T - 8);
      g.fillStyle = tn[2]; g.fillRect(x + 5, y + 9, T - 10, T - 14);
      g.fillStyle = tn[3]; g.fillRect(x + 5, y + 9, T - 10, 5);
      g.fillStyle = tn[1]; g.fillRect(x + 5, y + T - 12, T - 10, 7);
      g.fillStyle = tn[0]; g.fillRect(x + 14, y + 20, T - 28, 2);
    } else if (th.id === 'swamp') {
      // mossy stump
      g.fillStyle = OUTLINE; g.beginPath(); g.ellipse(cx, cy + 4, T * 0.42, T * 0.38, 0, 0, TAU); g.fill();
      g.fillStyle = '#5c4a32'; g.beginPath(); g.ellipse(cx, cy + 6, T * 0.36, T * 0.3, 0, 0, TAU); g.fill();
      g.fillStyle = '#8a6f4a'; g.beginPath(); g.ellipse(cx, cy - 2, T * 0.36, T * 0.22, 0, 0, TAU); g.fill();
      g.strokeStyle = '#6b5538'; g.lineWidth = 2; for (const rr of [5, 10]) { g.beginPath(); g.ellipse(cx, cy - 2, rr, rr * 0.6, 0, 0, TAU); g.stroke(); }
      g.fillStyle = '#4fae5a'; g.beginPath(); g.ellipse(cx - 8, cy - 8, 9, 5, -0.3, 0, TAU); g.fill();
    } else if (th.id === 'belltower') {
      // bronze pillar
      g.fillStyle = OUTLINE; g.fillRect(x + 7, y - 6, T - 14, T + 2);
      const gr = g.createLinearGradient(x + 9, 0, x + T - 9, 0);
      gr.addColorStop(0, tn[3]); gr.addColorStop(0.4, tn[2]); gr.addColorStop(1, tn[0]);
      g.fillStyle = gr; g.fillRect(x + 10, y - 3, T - 20, T - 4);
      g.fillStyle = tn[1]; g.fillRect(x + 5, y - 8, T - 10, 6); g.fillRect(x + 5, y + T - 10, T - 10, 6);
    } else {
      // glowing crystal obelisk
      g.fillStyle = OUTLINE; g.beginPath(); g.moveTo(cx, y - 10); g.lineTo(x + T - 8, cy); g.lineTo(cx + 6, y + T - 2); g.lineTo(cx - 6, y + T - 2); g.lineTo(x + 8, cy); g.closePath(); g.fill();
      g.fillStyle = tn[2]; g.beginPath(); g.moveTo(cx, y - 6); g.lineTo(x + T - 12, cy); g.lineTo(cx + 4, y + T - 5); g.lineTo(cx - 4, y + T - 5); g.lineTo(x + 12, cy); g.closePath(); g.fill();
      g.fillStyle = tn[3]; g.beginPath(); g.moveTo(cx, y - 6); g.lineTo(x + 12, cy); g.lineTo(cx - 2, cy + 4); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,220,255,0.6)'; g.fillRect(cx - 1, y + 4, 2, 10);
    }
  }
  function drawDeco(g, th, d, R) {
    const { x, y, k } = d;
    g.save();
    g.globalAlpha = 0.9;
    if (th.id === 'catacombs') {
      if (k === 0) { // bones
        g.fillStyle = '#d8d2bd'; g.save(); g.translate(x, y); g.rotate(d.a || 0.5); g.fillRect(-9, -1.5, 18, 3); g.fillRect(-11, -3, 4, 6); g.fillRect(7, -3, 4, 6); g.restore();
      } else if (k === 1) { // a little dotplot drawn in chalk
        g.fillStyle = 'rgba(230,230,255,0.25)'; g.fillRect(x - 20, y + 6, 40, 2);
        [1, 3, 2, 1].forEach((n, i) => { for (let j = 0; j < n; j++) { g.beginPath(); g.arc(x - 14 + i * 9, y + 1 - j * 6, 2.5, 0, TAU); g.fill(); } });
      } else { g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(x, y, 12, 6, 0, 0, TAU); g.fill(); }
    } else if (th.id === 'flatlands') {
      if (k === 0) { g.fillStyle = '#7a9a3a'; for (let i = 0; i < 3; i++) g.fillRect(x + i * 4 - 4, y - i * 3, 3, 8 + i * 3); }
      else if (k === 1) { g.fillStyle = 'rgba(255,240,200,0.25)'; g.fillRect(x - 16, y - 10, 32, 20); g.strokeStyle = 'rgba(90,60,30,0.4)'; g.strokeRect(x - 16, y - 10, 32, 20); }
      else { g.fillStyle = '#8a6a3a'; g.beginPath(); g.ellipse(x, y, 5, 3, 0, 0, TAU); g.fill(); }
    } else if (th.id === 'swamp') {
      if (k === 0) { g.fillStyle = '#3f8a4a'; g.beginPath(); g.arc(x, y, 9, 0.3, TAU - 0.3); g.lineTo(x, y); g.fill(); g.fillStyle = '#ff9fd0'; g.fillRect(x - 2, y - 2, 4, 4); }
      else if (k === 1) { g.fillStyle = '#2f5a3a'; for (let i = 0; i < 4; i++) g.fillRect(x + i * 5 - 8, y - 12 - (i % 2) * 5, 2, 14 + (i % 2) * 5); }
      else { g.fillStyle = 'rgba(30,60,90,0.45)'; g.beginPath(); g.ellipse(x, y, 20, 9, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(160,220,255,0.2)'; g.fillRect(x - 8, y - 3, 10, 2); }
    } else if (th.id === 'belltower') {
      if (k === 0) { g.fillStyle = 'rgba(255,190,110,0.3)'; g.font = 'bold 22px serif'; g.fillText('♪', x, y); }
      else if (k === 1) { g.strokeStyle = 'rgba(160,100,40,0.6)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 10, 0, TAU); g.stroke(); for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; g.fillStyle = 'rgba(160,100,40,0.6)'; g.fillRect(x + Math.cos(a) * 12 - 2, y + Math.sin(a) * 12 - 2, 4, 4); } }
      else { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 14, y - 2, 28, 4); }
    } else if (th.id === 'abyss') {
      if (k === 0) { g.strokeStyle = 'rgba(210,156,255,0.35)'; g.lineWidth = 2; for (const rr of [8, 14, 20]) { g.beginPath(); g.arc(x, y, rr, 0, TAU); g.stroke(); } }
      else if (k === 1) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x, y, 2, 2); g.fillRect(x + 9, y - 6, 1, 1); }
      else { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y, 16, 7, 0.4, 0, TAU); g.fill(); }
    }
    g.restore();
  }
  function rrect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }

  // Wall torches (animated flame)
  function drawTorch(ctx, x, y, t, color) {
    ctx.fillStyle = '#3a2618'; ctx.fillRect(x - 3, y, 6, 14);
    ctx.fillStyle = '#6b4a2a'; ctx.fillRect(x - 5, y - 2, 10, 4);
    const f = Math.sin(t * 13 + x) * 2;
    ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.ellipse(x, y - 8 + f * 0.3, 6, 10 + f, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(x, y - 6, 3.5, 6 + f * 0.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff8d0'; ctx.beginPath(); ctx.ellipse(x, y - 4, 1.6, 3, 0, 0, TAU); ctx.fill();
    glow(ctx, x, y - 6, 120 + f * 4, color || 'rgba(255,170,90,1)', 0.22);
  }


  // ---- new enemies ----
  function knightSprite(color, f) {
    return cached('knight' + color + f, () => sprite(18, 22, 3, (p) => {
      const M = ['#4a5060', '#7a8294', '#aab3c6', '#e3e9f5'];
      const T = tones(color);
      // plume
      p.rect(8, 0, 3, 3, T[2]); p.px(9, 0, T[3]);
      // helmet
      p.ball(9, 6, 5, 4.5, M);
      p.rect(5, 6, 9, 2, '#1b1b1b'); p.px(7, 6, '#ff5f5f'); p.px(11, 6, '#ff5f5f');
      // armored body
      p.ball(9, 13, 6, 5, M);
      p.rect(6, 12, 7, 2, T[1]); p.rect(6, 12, 7, 1, T[2]);
      const k = f ? 1 : 0;
      p.rect(6 - k, 17, 2, 4, M[0]); p.rect(11 + k, 17, 2, 4, M[0]);
      // sword
      p.rect(16, 6, 1, 10, '#d8dde8'); p.rect(15, 15, 3, 1, '#c89411');
    }));
  }
  function spiderSprite(color, f) {
    return cached('spider' + color + f, () => sprite(24, 16, 3, (p) => {
      const T = tones(color);
      for (let i = 0; i < 4; i++) {
        const y = 5 + i * 2, k = (i + f) % 2;
        p.line(9, y, 2, y - 3 + k * 4, T[0]); p.line(2, y - 3 + k * 4, 0, y + 2 + k, T[0]);
        p.line(15, y, 22, y - 3 + (1 - k) * 4, T[0]); p.line(22, y - 3 + (1 - k) * 4, 24, y + 2 + k, T[0]);
      }
      p.ball(12, 9, 6, 5, T);
      p.ball(12, 4, 3.5, 3, T);
      p.px(11, 3, '#ff3b3b'); p.px(13, 3, '#ff3b3b'); p.px(10, 4, '#ff3b3b'); p.px(14, 4, '#ff3b3b');
      p.px(11, 6, '#ffffff'); p.px(13, 6, '#ffffff');
    }));
  }

  // Freshmen for the study-hall stampede (a callback to Study Hall Simulator)
  const FRESH_TOP = [
    '..hhhhhh..',
    '.hhhhhhhh.',
    '.hkkkkkkh.',
    '.kkekkekk.',
    '..kkmmkk..',
    '.ssssssss.',
    'ssssssssss',
    'kssSssSssk',
    'k.ssssss.k',
    '..jjjjjj..',
  ];
  const FRESH_LEGS = [['..jj..jj..', '..oo..oo..'], ['.jj....jj.', 'oo......oo']];
  const FRESH_HAIR = ['#2b1d14', '#6b4423', '#c9a24a', '#111111', '#8a3b1e', '#4a2e17'];
  const FRESH_SKIN = [['#f6cfa6', '#e2ae88'], ['#dfae86', '#c48f68'], ['#b07a52', '#93623e'], ['#7a5236', '#5f3f28']];
  const FRESH_SHIRT = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#e84393', '#34495e'];
  function freshmanSprite(look, frame) {
    const i = look % 48;
    return cached('fresh' + i + frame, () => {
      const [k] = FRESH_SKIN[i % 4];
      const shirt = FRESH_SHIRT[Math.floor(i / 4) % 8];
      return fromRows(FRESH_TOP.concat(FRESH_LEGS[frame]), { h: FRESH_HAIR[(i * 7) % 6], k, e: '#1b1b1b', m: '#7a3a2a', s: shirt, S: shade(shirt, -0.25), j: '#3b4a74', o: '#e9e9ef' }, 3);
    });
  }

  DQ.Art = {
    OUTLINE, TAU, painter, bake, sprite, fromRows, cached, blit, shadow, glow, shade, tones, rrect,
    drawPortrait, buildFace, laporteSprite, drawManeSprite, heroSprite, guardSprite, subSprite, knightSprite, spiderSprite, freshmanSprite,
    slimeSprite, batSprite, ghostSprite, archerSprite, boarSprite, eyeSprite,
    coinSprite, heartSprite, edamameSprite, beanSprite, chestSprite,
    bosses: { rankenstein, monolith, zed, bell, emperor },
    THEMES, LOUNGE_THEME, renderRoom, drawTorch, GOLD, GOLD_HI, GOLD_DK,
  };
})();
