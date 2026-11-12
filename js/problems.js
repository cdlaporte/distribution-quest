/*
 * Distribution Quest — problem generators for Intro to Statistics, Unit 3 (distributions).
 *
 *   3.1 Percentiles            (percentile = percent of values STRICTLY LESS than the value)
 *   3.2 Uniform distributions
 *   3.3 z-scores
 *   3.4 Normal distributions   (solved with real Desmos in another tab -> desmos: true)
 *   3.5 The empirical rule     (68–95–99.7)
 *
 * generate(section, opts) -> {
 *   section, type, title, promptHTML,
 *   parts:    [{ kind:'num', label, answer, tol, unit, placeholder } | { kind:'choice', label, options, correct }],
 *   hints:    [html, ...]   (progressive, last one nearly gives it away)
 *   solution: [html, ...]   (worked steps, final answers in <b>)
 *   desmos, signature, _meta (hidden data used by the tests)
 * }
 * opts: { type, hard, avoid: [signature, ...] }
 * check(part, raw) -> boolean
 *
 * Diagrams are inline SVG strings (no external refs), max 540 x 200, colors for a dark background.
 * HTML uses only the classes: story, data, big, eq, hl, small, good, bad.
 */
(function (root) {
  'use strict';

  // =====================================================================
  // random + number helpers
  // =====================================================================
  const rnd = () => Math.random();
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const chance = (p) => rnd() < p;
  const unif = (a, b) => a + rnd() * (b - a);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function gauss() {
    let u = 0;
    while (u === 0) u = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
  }
  // round half away from zero, safe against 2.675*100 = 267.4999…
  function roundTo(x, d) {
    const m = Math.pow(10, d);
    const r = Math.round(Number((Math.abs(x) * m).toFixed(6))) / m;
    return x < 0 ? -r : r;
  }
  const MINUS = '−';
  // fixed decimals, unicode minus
  function fmt(x, d) {
    let s = roundTo(x, d).toFixed(d);
    if (/^-0(\.0+)?$/.test(s)) s = s.slice(1);
    return s.replace('-', MINUS);
  }
  // up to d decimals, trailing zeros removed
  function trim(x, d) {
    let s = fmt(x, d === undefined ? 4 : d);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }
  function commas(s) {
    const p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return p.join('.');
  }
  function decOf(x) {
    const s = trim(x, 6);
    const i = s.indexOf('.');
    return i < 0 ? 0 : s.length - i - 1;
  }
  function ord(k) {
    const s = trim(k, 2);
    if (s.indexOf('.') >= 0) return s + 'th';
    const n = Math.abs(parseInt(s, 10)) % 100;
    if (n >= 11 && n <= 13) return s + 'th';
    return s + (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const eqSign = (exact, d) => (Math.abs(roundTo(exact, d) - exact) < 1e-9 ? '=' : '≈');
  // z rounded to 2 decimals would be ambiguous (…5 boundary)?
  const zAmbiguous = (z) => {
    const f = Math.abs(z) * 100 - Math.floor(Math.abs(z) * 100);
    return Math.abs(f - 0.5) < 0.04;
  };
  const eq = (s) => `<span class="eq">${s}</span>`;
  const hl = (s) => `<span class="hl">${s}</span>`;
  const LET = 'abcd';

  const NAMES = ['Ava', 'Liam', 'Maya', 'Noah', 'Zoe', 'Ethan', 'Priya', 'Mateo', 'Chloe', 'Jayden', 'Aisha', 'Lucas',
    'Sofia', 'Marcus', 'Emma', 'Diego', 'Leah', 'Kai', 'Nora', 'Omar', 'Grace', 'Elijah', 'Hana', 'Caleb', 'Isabel',
    'Tyler', 'Jasmine', 'Owen', 'Lila', 'Andre', 'Mia', 'Ryan', 'Carl', 'Gerome', 'Jermaine', 'Victor', 'Dennis',
    'Ruby', 'Felix', 'Amara', 'Wes', 'Tessa', 'Malik', 'June'];
  const names = (k) => shuffle(NAMES).slice(0, k);

  // =====================================================================
  // normal distribution math
  // =====================================================================
  // Hart (1968) / West (2005) double-precision cumulative normal; error < 1e-14.
  function normalCdf(z) {
    if (Number.isNaN(z)) return NaN;
    if (z === Infinity) return 1;
    if (z === -Infinity) return 0;
    const x = Math.abs(z);
    let c;
    if (x > 37) c = 0;
    else {
      const e = Math.exp(-x * x / 2);
      if (x < 7.07106781186547) {
        let n = 3.52624965998911e-02 * x + 0.700383064443688;
        n = n * x + 6.37396220353165;
        n = n * x + 33.912866078383;
        n = n * x + 112.079291497871;
        n = n * x + 221.213596169931;
        n = n * x + 220.206867912376;
        let d = 8.83883476483184e-02 * x + 1.75566716318264;
        d = d * x + 16.064177579207;
        d = d * x + 86.7807322029461;
        d = d * x + 296.564248779674;
        d = d * x + 637.333633378831;
        d = d * x + 793.826512519948;
        d = d * x + 440.413735824752;
        c = e * n / d;
      } else {
        let b = x + 0.65;
        b = x + 4 / b;
        b = x + 3 / b;
        b = x + 2 / b;
        b = x + 1 / b;
        c = e / b / 2.506628274631;
      }
    }
    return z > 0 ? 1 - c : c;
  }
  // Acklam's rational approximation + one Halley refinement step.
  function invNorm(p) {
    if (!(p > 0)) return p === 0 ? -Infinity : NaN;
    if (!(p < 1)) return p === 1 ? Infinity : NaN;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const plow = 0.02425;
    let x;
    if (p < plow) {
      const q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= 1 - plow) {
      const q = p - 0.5, r = q * q;
      x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      const q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    const e = normalCdf(x) - p;
    const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
    return x - u / (1 + x * u / 2);
  }

  // =====================================================================
  // answer checking
  // =====================================================================
  function parseNum(raw) {
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
    if (raw == null) return NaN;
    let s = String(raw).trim().toLowerCase();
    s = s.replace(/[−‒–—﹣－]/g, '-');
    s = s.replace(/[\s,$]/g, '');
    s = s.replace(/^[a-z]+=/, ''); // "z=", "x="
    s = s.replace(/[%°a-zµ.]*[%°a-zµ]+\.?$/, ''); // trailing units: %, th, mpg, oz, lbs., th percentile …
    if (/^[+-]?(\d+\.?\d*|\.\d+)\/[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) {
      const nd = s.split('/').map(Number);
      return nd[1] === 0 ? NaN : nd[0] / nd[1];
    }
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return Number(s);
  }
  function check(part, raw) {
    if (!part) return false;
    if (part.kind === 'choice') {
      if (raw === '' || raw == null) return false;
      return Number(raw) === part.correct;
    }
    const x = parseNum(raw);
    if (!Number.isFinite(x)) return false;
    return Math.abs(x - part.answer) <= part.tol + 1e-9;
  }

  // =====================================================================
  // SVG helpers (dark background)
  // =====================================================================
  const C = {
    axis: '#e8e4ff', muted: '#b9b3e6', curve: '#9fd3ff', fill: 'rgba(159,211,255,0.12)',
    shade: 'rgba(255,210,63,0.55)', red: '#ff5c5c', dot: '#9fd3ff', bg: '#151228', gold: '#ffd23f',
  };
  const r1 = (v) => Math.round(v * 10) / 10;
  function svgOpen(W, H, label) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" ` +
      `font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" ` +
      `style="display:block;max-width:100%;height:auto;margin:6px auto" role="img" aria-label="${label.replace(/"/g, '')}">`;
  }
  function T(x, y, s, o) {
    o = o || {};
    return `<text x="${r1(x)}" y="${r1(y)}" font-size="${o.size || 15}" fill="${o.fill || C.axis}" text-anchor="${o.anchor || 'middle'}"` +
      (o.weight ? ` font-weight="${o.weight}"` : '') +
      (o.halo ? ` stroke="${C.bg}" stroke-width="4" paint-order="stroke" stroke-linejoin="round"` : '') +
      `>${s}</text>`;
  }
  function L(x1, y1, x2, y2, stroke, w, extra) {
    return `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${stroke}" stroke-width="${w || 1.5}"${extra || ''}/>`;
  }
  const textW = (s, size) => String(s).replace(/<[^>]+>/g, '').length * (size || 15) * 0.56;
  // keep the highest-priority labels that do not overlap
  function placeLabels(items) {
    const kept = [];
    items.slice().sort((a, b) => (b.prio || 0) - (a.prio || 0)).forEach((it) => {
      const ok = kept.every((k) => Math.abs(k.x - it.x) >= (textW(k.text) + textW(it.text)) / 2 + 6);
      if (ok) kept.push(it);
    });
    return kept;
  }

  /**
   * Normal curve.
   * o: { mu, sigma, ticks:[{v,label,prio,fill}], shade:[lo,hi], regions:bool, areaLabel:{text}, caption, dashes:[v] }
   */
  function normalSVG(o) {
    const W = 540, mu = o.mu, sd = o.sigma, span = 3.6;
    const capH = o.caption ? 22 : 0;
    const H = 150 + capH + (o.regions ? 8 : 0);
    const baseY = H - 30 - capH, topY = 12;
    const X0 = 16, X1 = W - 16;
    const xmin = mu - span * sd, xmax = mu + span * sd;
    const X = (v) => X0 + ((v - xmin) / (xmax - xmin)) * (X1 - X0);
    const hc = baseY - topY;
    const Y = (v) => baseY - hc * Math.exp(-0.5 * Math.pow((v - mu) / sd, 2));
    let s = svgOpen(W, H, o.aria || 'Normal curve');
    if (o.shade) {
      const lo = Math.max(o.shade[0], xmin), hi = Math.min(o.shade[1], xmax);
      if (hi > lo) {
        let d = `M${r1(X(lo))} ${baseY}`;
        for (let i = 0; i <= 80; i++) {
          const v = lo + (hi - lo) * i / 80;
          d += ` L${r1(X(v))} ${r1(Y(v))}`;
        }
        d += ` L${r1(X(hi))} ${baseY} Z`;
        s += `<path d="${d}" fill="${C.shade}" stroke="none"/>`;
      }
    }
    let d = '';
    for (let i = 0; i <= 180; i++) {
      const v = xmin + (xmax - xmin) * i / 180;
      d += (i ? ' L' : 'M') + r1(X(v)) + ' ' + r1(Y(v));
    }
    s += `<path d="${d}" fill="none" stroke="${C.curve}" stroke-width="2.5"/>`;
    (o.dashes || []).forEach((v) => {
      if (v > xmin && v < xmax) s += L(X(v), baseY, X(v), Y(v), C.axis, 1.2, ' stroke-dasharray="4 3" opacity="0.8"');
    });
    s += L(X0, baseY, X1, baseY, C.axis, 1.5);
    const ticks = (o.ticks || []).filter((t) => t.v >= xmin && t.v <= xmax);
    ticks.forEach((t) => { s += L(X(t.v), baseY, X(t.v), baseY + 6, C.axis, 1.5); });
    placeLabels(ticks.map((t) => ({ x: X(t.v), text: t.label, prio: t.prio, fill: t.fill })))
      .forEach((k) => { s += T(k.x, baseY + 22, k.text, { fill: k.fill }); });
    if (o.regions) {
      const R = [[0.5, '34%', 0.4], [1.45, '13.5%', 0.05], [2.5, '2.35%', null], [3.27, '0.15%', null]];
      R.forEach(([z, label, frac]) => {
        [-1, 1].forEach((sg) => {
          const xv = mu + sg * z * sd;
          let y;
          if (frac !== null) y = baseY - hc * frac;
          else y = z < 3 ? baseY - 24 : baseY - 7;
          s += T(X(xv), y, label, { size: 14, halo: true, fill: z < 3 ? C.axis : C.muted });
        });
      });
    }
    if (o.areaLabel && o.shade) {
      const lo = Math.max(o.shade[0], mu - 2.3 * sd), hi = Math.min(o.shade[1], mu + 2.3 * sd);
      const xc = hi > lo ? (lo + hi) / 2 : clamp(o.shade[0] === -Infinity ? o.shade[1] : o.shade[0], mu - 2.3 * sd, mu + 2.3 * sd);
      const ht = baseY - Y(xc);
      const y = ht < 44 ? Y(xc) - 8 : (baseY + Y(xc)) / 2 + 6;
      s += T(X(xc), y, o.areaLabel.text, { size: 15, weight: 'bold', halo: true, fill: C.gold });
    }
    if (o.caption) s += T(W / 2, H - 8, o.caption, { size: 14, fill: C.muted });
    return s + '</svg>';
  }

  /**
   * Uniform density rectangle.
   * o: { a, b, f(v)->label, heightText, shade:[lo,hi], marks:[{v,label}], caption }
   */
  function uniformSVG(o) {
    const W = 540, a = o.a, b = o.b, w = b - a;
    const topY = 42, baseY = 124, H = o.caption ? 172 : 152;
    const X0 = 30, X1 = W - 16;
    const dmin = a - 0.14 * w, dmax = b + 0.14 * w;
    const X = (v) => X0 + ((v - dmin) / (dmax - dmin)) * (X1 - X0);
    let s = svgOpen(W, H, 'Uniform density curve');
    s += L(X0, baseY, X0, topY - 18, C.axis, 1.5);
    s += L(X0, topY, X(a), topY, C.muted, 1.2, ' stroke-dasharray="4 4"');
    s += `<rect x="${r1(X(a))}" y="${topY}" width="${r1(X(b) - X(a))}" height="${baseY - topY}" fill="${C.fill}" stroke="none"/>`;
    if (o.shade) {
      const lo = Math.max(o.shade[0], a), hi = Math.min(o.shade[1], b);
      s += `<rect x="${r1(X(lo))}" y="${topY}" width="${r1(X(hi) - X(lo))}" height="${baseY - topY}" fill="${C.shade}" stroke="none"/>`;
    }
    s += `<rect x="${r1(X(a))}" y="${topY}" width="${r1(X(b) - X(a))}" height="${baseY - topY}" fill="none" stroke="${C.curve}" stroke-width="2.5"/>`;
    (o.marks || []).forEach((m) => { s += L(X(m.v), baseY, X(m.v), topY, C.axis, 1.2, ' stroke-dasharray="4 3" opacity="0.8"'); });
    s += L(X0, baseY, X1, baseY, C.axis, 1.5);
    const ticks = [{ v: a, label: o.f(a), prio: 2 }, { v: b, label: o.f(b), prio: 2 }]
      .concat((o.marks || []).map((m) => ({ v: m.v, label: m.label, prio: 3, fill: C.gold })));
    ticks.forEach((t) => { s += L(X(t.v), baseY, X(t.v), baseY + 6, C.axis, 1.5); });
    placeLabels(ticks.map((t) => ({ x: X(t.v), text: t.label, prio: t.prio, fill: t.fill })))
      .forEach((k) => { s += T(k.x, baseY + 22, k.text, { fill: k.fill }); });
    s += T(X((a + b) / 2), topY - 10, o.heightText, { size: 15, halo: true });
    if (o.caption) s += T(W / 2, H - 8, o.caption, { size: 14, fill: C.muted });
    return s + '</svg>';
  }

  /**
   * Dotplot with optional red highlighted dot + arrow.
   * o: { data, step, lo, hi, highlight, caption }
   */
  function dotplotSVG(o) {
    const W = 540, X0 = 24, X1 = W - 24;
    const nSteps = Math.round((o.hi - o.lo) / o.step);
    const sp = (X1 - X0) / nSteps;
    const counts = {};
    o.data.forEach((v) => { const j = Math.round((v - o.lo) / o.step); counts[j] = (counts[j] || 0) + 1; });
    const maxStack = Math.max.apply(null, Object.keys(counts).map((k) => counts[k]));
    const r = Math.min(6.5, sp * 0.42, (96 / maxStack - 1.6) / 2);
    const dy = 2 * r + 1.6;
    const arrowSpace = o.highlight != null ? 30 : 6;
    const baseY = Math.round(8 + arrowSpace + maxStack * dy + 6);
    const H = baseY + (o.caption ? 52 : 30);
    const X = (j) => X0 + j * sp;
    let s = svgOpen(W, H, 'Dotplot');
    const hj = o.highlight != null ? Math.round((o.highlight - o.lo) / o.step) : null;
    Object.keys(counts).forEach((k) => {
      const j = Number(k), c = counts[k];
      for (let i = 0; i < c; i++) {
        const cy = baseY - 5 - r - i * dy;
        const red = j === hj && i === c - 1;
        s += `<circle cx="${r1(X(j))}" cy="${r1(cy)}" r="${r1(r)}" fill="${red ? C.red : C.dot}"/>`;
        if (red) {
          const yTop = cy - r - 26, yTip = cy - r - 4;
          s += L(X(j), yTop, X(j), yTip - 6, C.red, 2);
          s += `<polygon points="${r1(X(j) - 5)},${r1(yTip - 8)} ${r1(X(j) + 5)},${r1(yTip - 8)} ${r1(X(j))},${r1(yTip)}" fill="${C.red}"/>`;
        }
      }
    });
    s += L(X0 - 8, baseY, X1 + 8, baseY, C.axis, 1.5);
    const labelEvery = nSteps <= 20 ? 2 : 5;
    for (let j = 0; j <= nSteps; j++) {
      const v = roundTo(o.lo + j * o.step, 4);
      const major = Math.round(v / o.step) % labelEvery === 0;
      s += L(X(j), baseY, X(j), baseY + (major ? 8 : 4), C.axis, major ? 1.5 : 1);
      if (major) s += T(X(j), baseY + 24, trim(v, 2), { size: 14 });
    }
    if (o.caption) s += T(W / 2, H - 8, o.caption, { size: 14, fill: C.muted });
    return s + '</svg>';
  }

  // =====================================================================
  // problem assembly
  // =====================================================================
  /**
   * subs: [{ q, parts:[...], hints:[h1,h2,h3], sol:[...] }]  — hint i of every sub is merged into hint i.
   */
  function compose(o) {
    const multi = o.subs.length > 1;
    const lab = (i) => (multi ? `<b>(${LET[i]})</b> ` : '');
    let prompt = o.top || '';
    o.subs.forEach((s, i) => { if (s.q) prompt += `<p>${lab(i)}${s.q}</p>`; });
    if (o.bottom) prompt += o.bottom;
    const parts = [];
    o.subs.forEach((s, i) => s.parts.forEach((p) => {
      const q = Object.assign({ unit: '', placeholder: '' }, p);
      if (multi) q.label = `(${LET[i]}) ` + q.label;
      parts.push(q);
    }));
    const hints = (o.preHints || []).slice();
    const nH = Math.max.apply(null, o.subs.map((s) => s.hints.length));
    for (let h = 0; h < nH; h++) {
      const pieces = o.subs.map((s, i) => (s.hints[h] ? lab(i) + s.hints[h] : '')).filter(Boolean);
      if (pieces.length) hints.push(pieces.join('<br>'));
    }
    if (o.postHints) hints.push.apply(hints, o.postHints);
    const solution = (o.preSol || []).slice();
    o.subs.forEach((s, i) => s.sol.forEach((line, j) => solution.push((j === 0 ? lab(i) : '') + line)));
    if (o.postSol) solution.push.apply(solution, o.postSol);
    return {
      section: o.section, type: o.type, title: o.title, promptHTML: prompt, parts, hints, solution,
      desmos: !!o.desmos, signature: o.signature, _meta: o.meta,
    };
  }

  // =====================================================================
  // 3.1 PERCENTILES
  // =====================================================================
  const LIST_CTX = [
    { key: 'test', dec: 0, unit: '', word: 'score', m: [66, 80], s: [9, 14], lo: 30, hi: 100,
      intro: (n) => `Here are the test scores of ${n} students in a biology class:`,
      about: (v) => `the test with a score of ${v}` },
    { key: 'quiz', dec: 0, unit: '', word: 'score', m: [64, 76], s: [7, 11], lo: 40, hi: 100,
      intro: (n) => `The scores of ${n} students on a recent quiz were listed on the board:`,
      about: (v) => `a quiz score of ${v}` },
    { key: 'shotput', dec: 2, unit: 'feet', word: 'distance', m: [15, 17], s: [1.1, 1.6], lo: 11, hi: 22,
      intro: (n) => `The shot-put distances (in feet) of the ${n} students in your gym class are:`,
      about: (v) => `the throw of ${v} feet` },
    { key: 'dash', dec: 2, unit: 'seconds', word: 'time', m: [13, 14.2], s: [0.5, 0.8], lo: 11, hi: 17,
      intro: (n) => `The 100-meter dash times (in seconds) of ${n} runners on a track team are:`,
      about: (v) => `the runner whose time was ${v} seconds` },
    { key: 'plants', dec: 1, unit: 'cm', word: 'height', m: [15, 21], s: [2.5, 4], lo: 6, hi: 32,
      intro: (n) => `A science class measured the heights (in cm) of ${n} bean plants after three weeks:`,
      about: (v) => `the plant that is ${v} cm tall` },
    { key: 'reading', dec: 0, unit: 'minutes', word: 'reading time', m: [28, 40], s: [10, 16], lo: 0, hi: 95,
      intro: (n) => `Here is how many minutes each of ${n} students spent reading last night:`,
      about: (v) => `the student who read for ${v} minutes` },
    { key: 'coins', dec: 0, unit: 'coins', word: 'number of coins', m: [45, 70], s: [15, 25], lo: 3, hi: 150,
      intro: (n) => `After a dungeon raid, ${n} adventurers counted the gold coins in their pouches:`,
      about: (v) => `the adventurer with ${v} coins` },
    { key: 'jump', dec: 2, unit: 'meters', word: 'distance', m: [4.8, 5.5], s: [0.35, 0.55], lo: 3.5, hi: 7,
      intro: (n) => `The long-jump distances (in meters) of ${n} athletes at a track meet were:`,
      about: (v) => `the jump of ${v} meters` },
    { key: 'temps', dec: 0, unit: '°F', word: 'temperature', m: [50, 62], s: [6, 9], lo: 30, hi: 85,
      intro: (n) => `The daily high temperatures (°F) in a town for ${n} days in March were:`,
      about: (v) => `a day with a high of ${v}°F` },
    { key: 'pumpkins', dec: 1, unit: 'pounds', word: 'weight', m: [12, 16], s: [3, 4.5], lo: 3, hi: 32,
      intro: (n) => `The weights (in pounds) of ${n} pumpkins at a farm stand are:`,
      about: (v) => `the pumpkin that weighs ${v} pounds` },
    { key: 'eggs', dec: 1, unit: 'kg', word: 'weight', m: [8, 10], s: [1.5, 2.5], lo: 3, hi: 16,
      intro: (n) => `A wizard weighed (in kg) each of the ${n} dragon eggs found in a mountain cave:`,
      about: (v) => `the egg that weighs ${v} kg` },
  ];

  function listData(ctx, n) {
    const m = unif(ctx.m[0], ctx.m[1]), s = unif(ctx.s[0], ctx.s[1]);
    const out = [];
    while (out.length < n) {
      const v = roundTo(m + s * gauss(), ctx.dec);
      if (v >= ctx.lo && v <= ctx.hi) out.push(v);
    }
    return out.sort((a, b) => a - b);
  }
  // indices i (lo <= i <= hi) whose value appears exactly once
  function uniqueIdx(data, lo, hi) {
    const out = [];
    for (let i = Math.max(1, lo); i <= Math.min(data.length - 2, hi); i++) {
      if (data[i - 1] < data[i] && data[i] < data[i + 1]) out.push(i);
    }
    return out;
  }
  const countBelow = (data, v) => data.filter((x) => x < v - 1e-9).length;
  function listHL(data, dec, nBelow, target) {
    return data.map((x, i) => {
      const f = fmt(x, dec);
      if (i < nBelow) return hl(f);
      if (i === target) return `<b>[${f}]</b>`;
      return f;
    }).join(', ');
  }

  // --- percentile OF a value (answer = c/n·100) ---
  function pctSub(o) {
    // o: { q, vf, c, n, label, solCount (html), noun }
    const pct = 100 * o.c / o.n;
    const rounded = Math.round(pct);
    return {
      q: o.q,
      parts: [{ kind: 'num', label: o.label, unit: 'th percentile', answer: roundTo(pct, 2), tol: 0.5, placeholder: 'e.g. 40' }],
      hints: [
        `A value’s <b>percentile</b> is the percent of the data that is <b>strictly less than</b> it. Don’t count ${o.vf} itself (or anything tied with it).`,
        `${o.countHint} There are <b>${o.n}</b> values in all.`,
        `There are <b>${o.c}</b> values below ${o.vf}. Compute ${eq(`${o.c} ÷ ${o.n} × 100`)}.`,
      ],
      sol: [
        o.solCount,
        `${eq(`${o.c} ÷ ${o.n} ${eqSign(o.c / o.n, 4)} ${trim(o.c / o.n, 4)}`)} → ${trim(pct, 2)}%`,
        `${o.vf} is at about the <b>${ord(rounded)} percentile</b>: about ${rounded}% of the data values are less than ${o.vf}.`,
      ],
    };
  }
  // --- value AT the k-th percentile ---
  function valSub(o) {
    // o: { q, k, n, j, vf, v, label, unit, solFind, countHint }
    const exact = Math.abs(o.k * o.n / 100 - o.j) < 1e-9;
    return {
      q: o.q,
      parts: [{ kind: 'num', label: o.label, unit: o.unit, answer: o.v, tol: 1e-4, placeholder: '' }],
      hints: [
        `The ${ord(o.k)} percentile is the value that has about <b>${o.k}%</b> of the data <b>below</b> it.`,
        `${o.k}% of ${o.n} values is ${eq(`${trim(o.k / 100, 2)} × ${o.n} = ${trim(o.k * o.n / 100, 2)}`)}${exact ? '' : ` ≈ <b>${o.j}</b>`}. So find the value that has exactly <b>${o.j}</b> values below it.`,
        o.countHint,
      ],
      sol: [
        `We want ${o.k}% of ${o.n} = ${trim(o.k * o.n / 100, 2)}${exact ? '' : ` ≈ <b>${o.j}</b>`} values below.`,
        o.solFind,
        `Check: ${eq(`${o.j} ÷ ${o.n} ${eqSign(100 * o.j / o.n, 2)} ${trim(100 * o.j / o.n, 2)}%`)}${exact ? '' : ` ≈ ${o.k}%`}. So the ${ord(o.k)} percentile is <b>${o.vf}</b>.`,
      ],
    };
  }

  function gen31list(type, opts) {
    for (;;) {
      const ctx = pick(LIST_CTX), n = int(10, 20), data = listData(ctx, n);
      const cands = uniqueIdx(data, 2, n - 2);
      if (cands.length < 3) continue;
      const fv = (v) => fmt(v, ctx.dec);
      const dataHTML = `<div class="data">${data.map(fv).join(', ')}</div>`;
      const subs = [], metaParts = [];
      const kinds = type === 'pctOfValue' ? (opts.hard ? ['pct', 'val'] : ['pct']) : (opts.hard ? ['val', 'pct'] : ['val']);
      const used = [];
      for (const kind of kinds) {
        const pool = cands.filter((i) => used.every((u) => Math.abs(u - i) >= 2));
        if (!pool.length) break;
        const i = pick(pool);
        used.push(i);
        const v = data[i], vf = fv(v);
        if (kind === 'pct') {
          subs.push(pctSub({
            q: `Find the percentile for ${ctx.about(vf)}.`, vf, c: i, n, label: `${vf} is at the`, noun: 'values',
            countHint: `Count how many values in the list are less than ${vf}.`,
            solCount: `Values below ${vf}: ${listHL(data, ctx.dec, i, i)} → <b>${i}</b> of the ${n} values.`,
          }));
          metaParts.push({ q: 'pct', value: v });
        } else {
          const k = Math.round(100 * i / n);
          subs.push(valSub({
            q: `Which ${ctx.word} is at the <b>${ord(k)} percentile</b>?`, k, n, j: i, v, vf,
            label: `${cap(ctx.word)} =`, unit: ctx.unit,
            countHint: `Count ${i} values in from the smallest. The answer is the <b>next</b> value (value #${i + 1} in order).`,
            solFind: `${listHL(data, ctx.dec, i, i)} → the value with exactly ${i} values below it is <b>${vf}</b>.`,
          }));
          metaParts.push({ q: 'val', k });
        }
      }
      if (subs.length !== kinds.length) continue;
      return compose({
        section: '3.1', type,
        title: type === 'pctOfValue' ? 'Find the percentile' : 'Value at a percentile',
        top: `<p class="story">${ctx.intro(n)}</p>${dataHTML}`,
        subs, meta: { data, parts: metaParts },
        signature: `3.1|${type}|${ctx.key}|${data.join(',')}|${used.join(',')}`,
      });
    }
  }

  // --- dotplots ---
  const SALADS = ['Southwest', 'Garden', 'Caesar', 'Cobb', 'Greek', 'Harvest', 'Asian Sesame', 'Chef', 'Taco', 'Spinach Berry'];
  const TEAMS = ['Central', 'Westview', 'Lincoln', 'Riverside', 'Eastlake', 'Northfield', 'Oak Grove', 'Summit'];
  const DOT_CTX = [
    { key: 'pushups', step: 1, n: [20, 28], lo: 5, hi: 45, gen: () => 26 + 7 * gauss(), caption: 'Push-ups in one minute',
      story: (n) => `The dotplot shows how many push-ups each of the ${n} students in a gym class did in one minute.`,
      redQ: (nm, v) => `The red dot is ${nm}, who did ${v} push-ups. Find ${nm}’s percentile.`,
      valQ: (nm, k) => `${nm}’s push-up count is at the <b>${ord(k)} percentile</b>. How many push-ups did ${nm} do?`,
      label: 'Push-ups =', unit: 'push-ups', noun: 'students' },
    { key: 'books', step: 1, n: [18, 26], lo: 0, hi: 20, gen: () => -Math.log(1 - rnd()) * 4.5, caption: 'Books read over the summer',
      story: (n) => `The dotplot shows the number of books each of ${n} students read over the summer.`,
      redQ: (nm, v) => `The red dot is ${nm}, who read ${v} books. Find ${nm}’s percentile.`,
      valQ: (nm, k) => `${nm} is at the <b>${ord(k)} percentile</b> for summer reading. How many books did ${nm} read?`,
      label: 'Books =', unit: 'books', noun: 'students' },
    { key: 'quiz', step: 1, n: [22, 28], lo: 4, hi: 20, gen: () => 20.6 + Math.log(1 - rnd()) * 3.6, caption: 'Score on a 20-point quiz',
      story: (n) => `The dotplot shows the scores of ${n} students on a 20-point quiz.`,
      redQ: (nm, v) => `The red dot is ${nm}, who scored ${v}. Find ${nm}’s percentile.`,
      valQ: (nm, k) => `${nm}’s quiz score is at the <b>${ord(k)} percentile</b>. What did ${nm} score?`,
      label: 'Score =', unit: 'points', noun: 'students' },
    { key: 'salads', step: 10, n: [14, 19], lo: 60, hi: 440, gen: () => 250 + 100 * gauss(), caption: 'Calories',
      story: (n) => `The dotplot shows the number of calories in each of the ${n} salads on a restaurant’s menu.`,
      redQ: (nm, v, ex) => `The red dot is the ${ex[0]} Salad, which has ${v} calories. Find its percentile.`,
      valQ: (nm, k, ex) => `The ${ex[1]} Salad is at the <b>${ord(k)} percentile</b>. How many calories does it contain?`,
      label: 'Calories =', unit: 'calories', noun: 'salads', extra: () => shuffle(SALADS) },
    { key: 'goblins', step: 1, n: [20, 26], lo: 0, hi: 30, gen: () => -Math.log(1 - rnd()) * 7, caption: 'Goblins defeated on first quest',
      story: (n) => `Each of ${n} new adventurers went on a first quest. The dotplot shows how many goblins each one defeated.`,
      redQ: (nm, v) => `The red dot is ${nm}, who defeated ${v} goblins. Find ${nm}’s percentile.`,
      valQ: (nm, k) => `${nm} is at the <b>${ord(k)} percentile</b>. How many goblins did ${nm} defeat?`,
      label: 'Goblins =', unit: 'goblins', noun: 'adventurers' },
    { key: 'temps', step: 1, n: [30, 30], lo: 44, hi: 80, gen: () => 62 + 6 * gauss(), caption: 'Daily high temperature (°F)',
      story: () => 'The dotplot shows the daily high temperature in a town on each of the 30 days in April.',
      redQ: (nm, v, ex) => `The red dot is April ${ex[0]}, when the high was ${v}°F. Find the percentile for that day.`,
      valQ: (nm, k, ex) => `The high temperature on April ${ex[1]} was at the <b>${ord(k)} percentile</b>. What was the high that day?`,
      label: 'High =', unit: '°F', noun: 'days', extra: () => shuffle([3, 5, 8, 9, 12, 14, 17, 19, 21, 24, 26, 28]) },
    { key: 'points', step: 1, n: [16, 22], lo: 40, hi: 80, gen: () => 60 + 8 * gauss(), caption: 'Points scored per game',
      story: (n) => `The dotplot shows the points a high school basketball team scored in each of its ${n} games this season.`,
      redQ: (nm, v, ex) => `The red dot is the game against ${ex[0]}, when the team scored ${v} points. Find the percentile for that game.`,
      valQ: (nm, k, ex) => `In the game against ${ex[1]}, the team’s score was at the <b>${ord(k)} percentile</b>. How many points did they score?`,
      label: 'Points =', unit: 'points', noun: 'games', extra: () => shuffle(TEAMS) },
    { key: 'service', step: 1, n: [18, 25], lo: 0, hi: 30, gen: () => 4 + -Math.log(1 - rnd()) * 6, caption: 'Hours of community service',
      story: (n) => `The dotplot shows how many hours of community service each of the ${n} members of a club completed this semester.`,
      redQ: (nm, v) => `The red dot is ${nm}, who completed ${v} hours. Find ${nm}’s percentile.`,
      valQ: (nm, k) => `${nm} is at the <b>${ord(k)} percentile</b> for service hours. How many hours did ${nm} complete?`,
      label: 'Hours =', unit: 'hours', noun: 'club members' },
  ];

  function dotData(ctx) {
    for (;;) {
      const n = int(ctx.n[0], ctx.n[1]);
      const data = [];
      while (data.length < n) {
        const v = roundTo(Math.round(ctx.gen() / ctx.step) * ctx.step, 4);
        if (v >= ctx.lo && v <= ctx.hi) data.push(v);
      }
      data.sort((a, b) => a - b);
      const big = 5 * ctx.step;
      const lo = Math.floor(data[0] / big) * big, hi = Math.ceil(data[n - 1] / big) * big;
      const nSteps = Math.round((hi - lo) / ctx.step);
      const counts = {};
      data.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
      const maxStack = Math.max.apply(null, Object.keys(counts).map((k) => counts[k]));
      const distinct = Object.keys(counts).length;
      if (nSteps > 45 || nSteps < 10 || maxStack > 7 || distinct < 7 || hi === lo) continue;
      return { data, n, lo: hi - lo < 10 * ctx.step ? lo - 5 * ctx.step : lo, hi };
    }
  }
  function distinctVals(data) { return data.filter((v, i) => i === 0 || v !== data[i - 1]); }
  function belowBreakdown(data, v) {
    const groups = [];
    distinctVals(data).forEach((u) => {
      if (u < v) groups.push(`${data.filter((x) => x === u).length} at ${trim(u, 2)}`);
    });
    return groups.join(', ');
  }

  function gen31dot(type, opts) {
    for (;;) {
      const ctx = pick(DOT_CTX);
      const D = dotData(ctx);
      const { data, n } = D;
      const ex = ctx.extra ? ctx.extra() : [];
      const nm = names(2);
      const dv = distinctVals(data);
      const okVals = dv.filter((v) => {
        const c = countBelow(data, v);
        return c >= 2 && c <= n - 2;
      });
      if (okVals.length < 3) continue;
      const kinds = type === 'dotplot' ? (opts.hard ? ['pct', 'val'] : ['pct']) : (opts.hard ? ['val', 'pct'] : ['val']);
      const subs = [], metaParts = [];
      let red = null, ans = null;
      for (const kind of kinds) {
        const pool = okVals.filter((v) => v !== red && v !== ans);
        const v = pick(pool), c = countBelow(data, v), vf = trim(v, 2);
        if (kind === 'pct') {
          red = v;
          subs.push(pctSub({
            q: ctx.redQ(nm[0], vf, ex), vf, c, n, label: 'The red dot is at the', noun: ctx.noun,
            countHint: `Count the dots to the <b>left</b> of the red dot’s stack (smaller values only).`,
            solCount: `Dots to the left of ${vf}: <span class="small">${belowBreakdown(data, v)}</span> → <b>${c}</b> of the ${n} dots.`,
          }));
          metaParts.push({ q: 'pct', value: v });
        } else {
          ans = v;
          const k = Math.round(100 * c / n);
          subs.push(valSub({
            q: ctx.valQ(nm[1], k, ex), k, n, j: c, v, vf, label: ctx.label, unit: ctx.unit,
            countHint: `Count ${c} dots in from the left (smallest values first). The <b>next</b> dot’s value is the answer.`,
            solFind: `Counting from the left: <span class="small">${belowBreakdown(data, v)}</span> → that is ${c} dots, so the next value, <b>${vf}</b>, has exactly ${c} values below it.`,
          }));
          metaParts.push({ q: 'val', k });
        }
      }
      const svg = dotplotSVG({ data, step: ctx.step, lo: D.lo, hi: D.hi, highlight: red, caption: ctx.caption });
      const solSvg = ans !== null ? dotplotSVG({ data, step: ctx.step, lo: D.lo, hi: D.hi, highlight: ans, caption: ctx.caption }) : null;
      return compose({
        section: '3.1', type,
        title: type === 'dotplot' ? 'Read the dotplot' : 'Dotplot detective',
        top: `<p class="story">${ctx.story(n)}</p>${svg}`,
        subs, meta: { data, parts: metaParts },
        postSol: solSvg && red === null ? [`The ${ord(metaParts[0].k)}-percentile value, marked in red:${solSvg}`] : null,
        signature: `3.1|${type}|${ctx.key}|${data.join(',')}|${red}|${ans}`,
      });
    }
  }

  // --- interpretation ---
  const INTERP = [
    (k) => {
      const nm = pick(NAMES), v = int(68, 96);
      return {
        story: `${nm} scored ${v} on a chemistry test. That score is at the ${hl(ord(k) + ' percentile')} of the class.`,
        correct: `${k}% of the students in the class scored lower than ${v}.`,
        wrong: [`${nm} answered ${k}% of the questions correctly.`, `${k}% of the students in the class scored higher than ${v}.`,
          `${100 - k}% of the students in the class scored lower than ${v}.`],
      };
    },
    (k) => {
      const nm = pick(NAMES);
      return {
        story: `At a checkup, the doctor says that 4-year-old ${nm}’s height is at the ${hl(ord(k) + ' percentile')} for children that age.`,
        correct: `${k}% of 4-year-olds are shorter than ${nm}.`,
        wrong: [`${k}% of 4-year-olds are taller than ${nm}.`, `${nm} is ${k}% as tall as an average 4-year-old.`,
          `${100 - k}% of 4-year-olds are shorter than ${nm}.`],
      };
    },
    (k) => {
      const nm = pick(NAMES), mm = int(21, 32), ss = int(0, 59);
      const t = `${mm}:${String(ss).padStart(2, '0')}`;
      return {
        story: `${nm} ran a 5K race in ${t}. That time is at the ${hl(ord(k) + ' percentile')} of all finishing times in the race.`,
        correct: `${k}% of the runners finished in less time than ${nm}.`,
        wrong: [`${nm} finished ahead of ${k}% of the runners.`, `${100 - k}% of the runners finished in less time than ${nm}.`,
          `${nm} ran ${k}% faster than the average runner.`],
      };
    },
    (k) => {
      const sal = pick(SALADS), v = int(15, 45) * 10;
      return {
        story: `The ${sal} Salad has ${v} calories, which is at the ${hl(ord(k) + ' percentile')} of calorie counts for the salads on the menu.`,
        correct: `${k}% of the salads on the menu have fewer calories than the ${sal} Salad.`,
        wrong: [`${k}% of the salads on the menu have more calories than the ${sal} Salad.`,
          `The ${sal} Salad has ${k}% of the calories of an average salad.`,
          `${100 - k}% of the salads on the menu have fewer calories than the ${sal} Salad.`],
      };
    },
    (k) => {
      const nm = pick(NAMES), v = int(30, 75);
      return {
        story: `${nm} types ${v} words per minute, which is at the ${hl(ord(k) + ' percentile')} for students in keyboarding class.`,
        correct: `${k}% of the students in the class type slower than ${v} words per minute.`,
        wrong: [`${k}% of the students in the class type faster than ${v} words per minute.`,
          `${nm} types ${k}% faster than the average student.`, `${nm} typed ${k}% of the words correctly.`],
      };
    },
    (k) => {
      const nm = pick(NAMES), v = int(3, 14);
      return {
        story: `Sir ${nm} brought back ${v} dragon eggs from the quest, which is at the ${hl(ord(k) + ' percentile')} among the knights of the guild.`,
        correct: `${k}% of the knights brought back fewer than ${v} eggs.`,
        wrong: [`${k}% of the knights brought back more than ${v} eggs.`, `Sir ${nm} brought back ${k}% of all the eggs.`,
          `${100 - k}% of the knights brought back fewer than ${v} eggs.`],
      };
    },
    (k) => {
      const nm = pick(NAMES), v = trim(int(4, 14) / 2, 1);
      return {
        story: `${nm} averages ${v} hours of screen time per day. That is at the ${hl(ord(k) + ' percentile')} for students in ${nm}’s grade.`,
        correct: `${k}% of students in the grade have less daily screen time than ${nm}.`,
        wrong: [`${k}% of students in the grade have more daily screen time than ${nm}.`, `${nm} spends ${k}% of the day looking at screens.`,
          `${100 - k}% of students in the grade have less daily screen time than ${nm}.`],
      };
    },
    (k) => {
      const nm = pick(NAMES), v = int(180, 900);
      return {
        story: `${nm}’s giant pumpkin weighed ${v} pounds, which is at the ${hl(ord(k) + ' percentile')} for pumpkins entered at the county fair.`,
        correct: `${k}% of the pumpkins at the fair weighed less than ${nm}’s.`,
        wrong: [`${k}% of the pumpkins at the fair weighed more than ${nm}’s.`, `${nm}’s pumpkin weighed ${k}% as much as the heaviest pumpkin.`,
          `${100 - k}% of the pumpkins at the fair weighed less than ${nm}’s.`],
      };
    },
  ];
  function gen31interp() {
    let k;
    do { k = int(8, 95); } while (k === 50 || Math.abs(k - 50) < 4);
    const which = int(0, INTERP.length - 1);
    const it = INTERP[which](k);
    const opts = shuffle([it.correct].concat(it.wrong));
    return compose({
      section: '3.1', type: 'interpret', title: 'What does it mean?',
      top: `<p class="story">${it.story}</p>`,
      subs: [{
        q: 'Which statement correctly interprets this percentile?',
        parts: [{ kind: 'choice', label: 'Choose one:', options: opts, correct: opts.indexOf(it.correct) }],
        hints: [
          'A percentile tells you the percent of values that are <b>less than</b> this value.',
          `It is <b>not</b> a percent correct, and it is not “percent higher.” Look for “${k}% … below / less / fewer.”`,
          `Being at the ${ord(k)} percentile means <b>${k}%</b> of the group is below this value (and the rest are at or above it).`,
        ],
        sol: [
          `The ${ord(k)} percentile means ${k}% of the values in the group are less than this one.`,
          `So the correct statement is: <b>${it.correct}</b>`,
        ],
      }],
      meta: { k, parts: [{ q: 'interpret', k }] },
      signature: `3.1|interpret|${which}|${k}`,
    });
  }

  function gen31(type, opts) {
    if (type === 'pctOfValue' || type === 'valueAtPct') return gen31list(type, opts);
    if (type === 'dotplot' || type === 'dotplotValue') return gen31dot(type, opts);
    return gen31interp();
  }

  // =====================================================================
  // 3.2 UNIFORM DISTRIBUTIONS
  // =====================================================================
  const UNI_CTX = [
    { key: 'rng', fine: true, unit: '', subj: 'the generator', measurePl: 'random numbers', caption: 'Random number',
      story: (a, b, an, bn) => `A random number generator produces numbers spread uniformly across the interval from ${a} to ${b} (like ${(an + unif(0.05, 0.45) * (bn - an)).toFixed(5)} or ${(an + unif(0.55, 0.95) * (bn - an)).toFixed(5)}).`,
      lt: (x) => `produce a number less than ${x}`, gt: (x) => `produce a number greater than ${x}`, btw: (x, y) => `produce a number between ${x} and ${y}`,
      params: [[0, 4], [0, 5], [0, 2], [1, 6], [0, 10]] },
    { key: 'donut', unit: 'minutes', subj: 'a randomly selected child', measurePl: 'donut-eating times', caption: 'Time to eat a donut (minutes)',
      story: (a, b) => `The time it takes a nine-year-old to eat a donut is between ${a} and ${b} minutes, and every time in that range is equally likely. Let X = the eating time, so X ~ U(${a}, ${b}).`,
      lt: (x) => `take less than ${x} minutes to eat a donut`, gt: (x) => `take more than ${x} minutes to eat a donut`, btw: (x, y) => `take between ${x} and ${y} minutes to eat a donut`,
      params: [[0.5, 4], [1, 4], [0.5, 3]] },
    { key: 'furnace', unit: 'hours', subj: 'a furnace repair', measurePl: 'furnace repair times', caption: 'Repair time (hours)',
      story: (a, b) => `Ace Heating finds that the time a technician needs to fix a furnace is uniformly distributed between ${a} and ${b} hours.`,
      lt: (x) => `take less than ${x} hours`, gt: (x) => `take more than ${x} hours`, btw: (x, y) => `take between ${x} and ${y} hours`,
      params: [[1.5, 4], [1, 3], [2, 5]] },
    { key: 'enemy', unit: 'minutes', subj: 'the enemy', measurePl: 'enemy appearance times', caption: 'Time until the enemy appears (minutes)',
      story: (a, b) => `In a video game, an enemy appears at a random time. It is equally likely to appear at any time between ${a} and ${b} minutes after a timer starts.`,
      lt: (x) => `appear less than ${x} minutes after the timer starts`, gt: (x) => `appear more than ${x} minutes after the timer starts`,
      btw: (x, y) => `appear between ${x} and ${y} minutes after the timer starts`,
      params: [[0.25, 2.75], [0.5, 3], [0.25, 1.75]] },
    { key: 'bus', unit: 'minutes', subj: 'a student', measurePl: 'bus wait times', caption: 'Wait time (minutes)',
      story: (a, b) => `A bus comes to the stop every ${b} minutes. If you show up at a random time, your wait is uniformly distributed between ${a} and ${b} minutes.`,
      lt: (x) => `wait less than ${x} minutes`, gt: (x) => `wait more than ${x} minutes`, btw: (x, y) => `wait between ${x} and ${y} minutes`,
      params: [[0, 10], [0, 12], [0, 15], [0, 20]] },
    { key: 'spinner', unit: 'degrees', deg: true, subj: 'the spinner', measurePl: 'stopping angles', caption: 'Stopping angle (degrees)',
      story: (a, b) => `A game spinner is equally likely to stop at any angle from ${a} to ${b}.`,
      lt: (x) => `stop at an angle less than ${x}`, gt: (x) => `stop at an angle greater than ${x}`, btw: (x, y) => `stop at an angle between ${x} and ${y}`,
      params: [[0, 360]] },
    { key: 'pizza', unit: 'minutes', subj: 'an order', measurePl: 'delivery times', caption: 'Delivery time (minutes)',
      story: (a, b) => `An online pizza order takes anywhere from ${a} to ${b} minutes to arrive, and every time in that range is equally likely.`,
      lt: (x) => `arrive in less than ${x} minutes`, gt: (x) => `take more than ${x} minutes to arrive`, btw: (x, y) => `arrive between ${x} and ${y} minutes after it is placed`,
      params: [[20, 50], [15, 45], [25, 45], [30, 60]] },
    { key: 'dragon', unit: 'hours', subj: 'the dragon', measurePl: 'dragon nap lengths', caption: 'Nap length (hours)',
      story: (a, b) => `A sleeping dragon naps for a random amount of time that is uniformly distributed between ${a} and ${b} hours.`,
      lt: (x) => `nap for less than ${x} hours`, gt: (x) => `nap for more than ${x} hours`, btw: (x, y) => `nap for between ${x} and ${y} hours`,
      params: [[2, 6], [1.5, 4], [3, 8], [2.5, 5]] },
    { key: 'trap', unit: 'seconds', subj: 'the trapdoor', measurePl: 'trapdoor opening times', caption: 'Time until the trapdoor opens (seconds)',
      story: (a, b) => `A trapdoor in the dungeon springs open at a random time, uniformly distributed between ${a} and ${b} seconds after you step on its tile.`,
      lt: (x) => `open less than ${x} seconds after you step on it`, gt: (x) => `open more than ${x} seconds after you step on it`,
      btw: (x, y) => `open between ${x} and ${y} seconds after you step on it`,
      params: [[5, 25], [2, 12], [10, 30], [4, 10]] },
    { key: 'light', unit: 'seconds', subj: 'a driver', measurePl: 'wait times at the light', caption: 'Wait time (seconds)',
      story: (a, b) => `A red light lasts ${b} seconds. A driver who arrives at a random moment during the red light waits a time that is uniformly distributed between ${a} and ${b} seconds.`,
      lt: (x) => `wait less than ${x} seconds`, gt: (x) => `wait more than ${x} seconds`, btw: (x, y) => `wait between ${x} and ${y} seconds`,
      params: [[0, 60], [0, 45], [0, 90]] },
  ];

  function uniGrid(ctx, a, b) {
    const w = b - a;
    let steps;
    if (ctx.key === 'spinner') steps = [15, 10, 5];
    else if (w <= 3) steps = [0.25, 0.1, 0.05];
    else if (w <= 6) steps = [0.5, 0.25, 0.1];
    else if (w <= 15) steps = [1, 0.5];
    else if (w <= 40) steps = [1, 2, 5];
    else steps = [5, 1, 10];
    let s = pick(steps);
    if (ctx.fine && chance(0.5)) s = 0.01;
    const out = [];
    const j0 = Math.ceil((a + 0.1 * w) / s - 1e-9), j1 = Math.floor((b - 0.1 * w) / s + 1e-9);
    for (let j = j0; j <= j1; j++) out.push(roundTo(j * s, 4));
    return out;
  }
  function heightText(w) {
    const h = 1 / w;
    return `1/${trim(w, 4)} ${eqSign(h, 4)} ${trim(h, 4)}`;
  }

  function uniSub(kind, ctx, a, b) {
    const w = b - a;
    const f = (v) => trim(v, 4) + (ctx.deg ? '°' : '');
    const n = (v) => trim(v, 4);
    const W = n(w);
    const pctLine = (P) => `${eqSign(P, 2) === '=' ? '' : '≈ '}<b>${trim(P, 2)}%</b>`;
    if (kind === 'less' || kind === 'greater') {
      const xs = uniGrid(ctx, a, b).filter((x) => Math.abs(100 * (x - a) / w - 50) >= 5);
      const x = pick(xs);
      const isLess = kind === 'less';
      const wid = isLess ? x - a : b - x;
      const P = 100 * wid / w;
      const widExpr = isLess ? `${n(x)} − ${n(a)}` : `${n(b)} − ${n(x)}`;
      return {
        q: `What percent of the time will ${ctx.subj} ${isLess ? ctx.lt(f(x)) : ctx.gt(f(x))}?`,
        parts: [{ kind: 'num', label: 'Percent =', unit: '%', answer: roundTo(P, 2), tol: 0.5 }],
        hints: [
          `Shade the part of the rectangle ${isLess ? `to the <b>left</b> of ${f(x)} (from ${f(a)} to ${f(x)})` : `to the <b>right</b> of ${f(x)} (from ${f(x)} to ${f(b)})`}. Its width is ${eq(`${widExpr} = ${n(wid)}`)}.`,
          `Area = width × height = ${eq(`${n(wid)} × 1/${W} = ${n(wid)} ÷ ${W}`)}. Change that decimal to a percent.`,
        ],
        sol: [
          `Width of the shaded region: ${eq(`${widExpr} = ${n(wid)}`)}`,
          `Area: ${eq(`${n(wid)} ÷ ${W} ${eqSign(wid / w, 4)} ${trim(wid / w, 4)}`)} → ${pctLine(P)}`,
        ],
        shade: isLess ? [a, x] : [x, b], marks: [{ v: x, label: f(x), solLabel: f(x) }],
        meta: { q: kind, x }, sig: x,
      };
    }
    if (kind === 'between') {
      const g = uniGrid(ctx, a, b);
      let x1, x2;
      do { x1 = pick(g); x2 = pick(g); } while (!(x2 - x1 >= 0.15 * w && x2 - x1 <= 0.85 * w));
      const wid = x2 - x1, P = 100 * wid / w;
      return {
        q: `What percent of the time will ${ctx.subj} ${ctx.btw(f(x1), f(x2))}?`,
        parts: [{ kind: 'num', label: 'Percent =', unit: '%', answer: roundTo(P, 2), tol: 0.5 }],
        hints: [
          `Shade the part of the rectangle from ${f(x1)} to ${f(x2)}. Its width is ${eq(`${n(x2)} − ${n(x1)} = ${n(wid)}`)}.`,
          `Area = width × height = ${eq(`${n(wid)} × 1/${W} = ${n(wid)} ÷ ${W}`)}. Change that decimal to a percent.`,
        ],
        sol: [
          `Width of the shaded region: ${eq(`${n(x2)} − ${n(x1)} = ${n(wid)}`)}`,
          `Area: ${eq(`${n(wid)} ÷ ${W} ${eqSign(wid / w, 4)} ${trim(wid / w, 4)}`)} → ${pctLine(P)}`,
        ],
        shade: [x1, x2], marks: [{ v: x1, label: f(x1), solLabel: f(x1) }, { v: x2, label: f(x2), solLabel: f(x2) }],
        meta: { q: kind, x1, x2 }, sig: `${x1}-${x2}`,
      };
    }
    if (kind === 'percentile') {
      const ks = [];
      for (let k = 5; k <= 95; k += 5) {
        const v = a + k * w / 100;
        if (k !== 50 && Math.abs(roundTo(v, 2) - v) < 1e-9) ks.push(k);
      }
      const k = pick(ks);
      const prod = k * w / 100, v = a + prod;
      return {
        q: `Find the ${ord(k)} percentile of the ${ctx.measurePl}.`,
        parts: [{ kind: 'num', label: `${ord(k)} percentile =`, unit: ctx.unit, answer: roundTo(v, 4), tol: 0.011 }],
        hints: [
          `The ${ord(k)} percentile is the value with <b>${k}%</b> of the area to its <b>left</b>. So the shaded width × 1/${W} must equal ${trim(k / 100, 2)}.`,
          `Width = ${eq(`${trim(k / 100, 2)} × ${W} = ${n(prod)}`)}. Start at ${f(a)} and go ${n(prod)} to the right.`,
        ],
        sol: [
          `We need ${k}% of the area to the left: width = ${eq(`${trim(k / 100, 2)} × ${W} = ${n(prod)}`)}`,
          `Start at a = ${f(a)}: ${eq(`${n(a)} + ${n(prod)} = ${n(v)}`)}, so the ${ord(k)} percentile is <b>${f(v)}</b>${ctx.unit && !ctx.deg ? ' ' + ctx.unit : ''}.`,
        ],
        shade: [a, v], marks: [{ v, label: '?', solLabel: f(v) }],
        meta: { q: kind, k }, sig: `p${k}`,
      };
    }
    if (kind === 'mean') {
      const m = (a + b) / 2;
      return {
        q: `What is the mean (average) of the ${ctx.measurePl}?`,
        parts: [{ kind: 'num', label: 'Mean =', unit: ctx.unit, answer: roundTo(m, 4), tol: 0.011 }],
        hints: [
          'A uniform distribution is perfectly symmetric, so the mean is the balance point: right in the <b>middle</b> of the rectangle.',
          `Mean = ${eq(`(${n(a)} + ${n(b)}) ÷ 2`)}`,
        ],
        sol: [
          'The mean of a uniform distribution is halfway between a and b.',
          `Mean = ${eq(`(${n(a)} + ${n(b)}) ÷ 2`)} = <b>${f(m)}${ctx.unit && !ctx.deg ? ' ' + ctx.unit : ''}</b>`,
        ],
        shade: null, marks: [], meta: { q: kind }, sig: 'mean',
      };
    }
    // height
    const h = 1 / w;
    return {
      q: 'What is the <b>height</b> of the density curve? (Give a decimal.)',
      parts: [{ kind: 'num', label: 'Height =', unit: '', answer: roundTo(h, 4), tol: h >= 0.05 - 1e-9 ? 0.005 : Math.max(0.0005, 0.03 / w) }],
      hints: [
        `The total area under a density curve is always <b>1</b>. This rectangle is ${eq(`${n(b)} − ${n(a)} = ${W}`)} wide.`,
        `Width × height = 1, so ${eq(`height = 1 ÷ ${W}`)}.`,
      ],
      sol: [
        `Width = ${eq(`${n(b)} − ${n(a)} = ${W}`)}. The area must be 1, so height = 1 ÷ (b − a).`,
        `Height = ${eq(`1 ÷ ${W}`)} ${eqSign(h, 4)} <b>${trim(h, 4)}</b>`,
      ],
      shade: null, marks: [], meta: { q: 'height' }, sig: 'h',
    };
  }

  function gen32(type, opts) {
    const ctx = pick(UNI_CTX);
    const ab = pick(ctx.params), a = ab[0], b = ab[1], w = b - a;
    const f = (v) => trim(v, 4) + (ctx.deg ? '°' : '');
    const kinds = [type];
    if (opts.hard) {
      const extra = {
        less: ['percentile', 'mean'], greater: ['percentile', 'mean'], between: ['percentile', 'mean'],
        percentile: ['less', 'greater', 'between'], mean: ['percentile', 'between'], height: ['less', 'between', 'percentile'],
      }[type];
      kinds.push(pick(extra));
      if (type !== 'height' && type !== 'mean' && chance(0.4)) kinds.push(kinds.indexOf('mean') < 0 ? 'mean' : 'percentile');
    }
    const subs = kinds.map((k) => uniSub(k, ctx, a, b));
    const hasHeight = kinds.indexOf('height') >= 0;
    const HT = heightText(w);
    const shaded = subs.find((s) => s.shade);
    const diag = (shadeSub, sol) => uniformSVG({
      a, b, f, caption: ctx.caption, heightText: hasHeight && !sol ? 'height = ?' : `height = ${HT}`,
      shade: shadeSub ? shadeSub.shade : null,
      marks: shadeSub ? shadeSub.marks.map((m) => ({ v: m.v, label: sol ? m.solLabel : m.label })) : [],
    });
    const h1 = hasHeight
      ? `Sketch the density curve: a flat rectangle from ${f(a)} to ${f(b)}.${diag(null, false)}`
      : `Sketch the density curve: a rectangle from ${f(a)} to ${f(b)} with height ${eq(`1 ÷ (${trim(b)} − ${trim(a)}) = ${HT}`)}, so the total area is 1. <b>Area = probability.</b>${diag(null, false)}`;
    const post = shaded ? `${diag(shaded, true)}` : null;
    const p = compose({
      section: '3.2', type, title: {
        height: 'Height of the density curve', less: 'Uniform: less than', greater: 'Uniform: more than',
        between: 'Uniform: in between', percentile: 'Uniform percentile', mean: 'Mean of a uniform distribution',
      }[type],
      top: `<p class="story">${ctx.story(f(a), f(b), a, b)}</p>`,
      subs, preHints: [h1],
      preSol: hasHeight ? [] : [`Density curve: a rectangle from ${f(a)} to ${f(b)}, height = ${eq(`1 ÷ ${trim(w)} = ${HT}`)}.`],
      postSol: post ? [post] : null,
      meta: { a, b, parts: subs.map((s) => s.meta) },
      signature: `3.2|${type}|${ctx.key}|${a}|${b}|${subs.map((s) => s.sig).join('|')}`,
    });
    // put the shaded diagram on the second hint (the setup hint)
    if (shaded && p.hints.length >= 2) p.hints[1] += diag(shaded, false);
    return p;
  }

  // =====================================================================
  // NORMAL CONTEXTS (shared by 3.3, 3.4, 3.5)
  // =====================================================================
  const NORM_CTX = [
    { key: 'mpg', unit: 'mpg', short: 'mpg', pl: 'cars', sing: 'car', measure: 'fuel efficiency', measures: 'fuel-efficiency ratings', caption: 'Fuel efficiency (mpg)',
      story: (m, s) => `Suppose a Normal model describes the fuel efficiency of cars registered in New Hampshire. The mean is ${m} mpg and the standard deviation is ${s} mpg.`,
      lt: (v) => `get less than ${v}`, gt: (v) => `get more than ${v}`, btw: (a, b) => `get between ${a} and ${b}`,
      one: (v) => `a car that gets ${v}`,
      cutLow: (p) => `The <b>least fuel-efficient ${p}%</b> of cars get less than ____ mpg.`,
      cutHigh: (p) => `The <b>most fuel-efficient ${p}%</b> of cars get more than ____ mpg.`,
      p34: [[24, 6], [27, 5], [31, 4]], step: 1, p35: [[24, 6], [30, 4], [28, 5]] },
    { key: 'bike', money: true, unit: '', short: 'dollars', pl: 'bikes', sing: 'bike', measure: 'sale price', caption: 'Sale price (dollars)',
      story: (m, s) => `The online sale price of a certain professional mountain bike is approximately Normal with a mean of ${m} and a standard deviation of ${s}.`,
      lt: (v) => `sell for less than ${v}`, gt: (v) => `sell for more than ${v}`, btw: (a, b) => `sell for between ${a} and ${b}`,
      one: (v) => `a bike that sells for ${v}`,
      cutLow: (p) => `The <b>cheapest ${p}%</b> of these bikes sell for less than $____.`,
      cutHigh: (p) => `The <b>most expensive ${p}%</b> of these bikes sell for more than $____.`,
      p34: [[4200, 250], [3500, 300], [2800, 200]], step: 50, p35: [[4200, 250], [3500, 300]] },
    { key: 'iq', unit: '', short: '', pl: 'people aged 20 to 34', sing: 'person', measure: 'IQ score', caption: 'IQ score',
      story: (m, s) => `Scores on the Wechsler Adult Intelligence Scale (an IQ test) for people aged 20 to 34 are approximately Normal with μ = ${m} and σ = ${s}.`,
      lt: (v) => `have IQ scores below ${v}`, gt: (v) => `have IQ scores above ${v}`, btw: (a, b) => `have IQ scores between ${a} and ${b}`,
      one: (v) => `a person with an IQ score of ${v}`,
      cutLow: (p) => `The <b>lowest-scoring ${p}%</b> of people score below ____.`,
      cutHigh: (p) => `A club admits only people who score in the <b>top ${p}%</b>. To get in, you need a score of at least ____.`,
      p34: [[110, 25], [100, 15]], step: 5, p35: [[100, 15], [110, 25]] },
    { key: 'birth', unit: 'pounds', short: 'lb', pl: 'babies', sing: 'baby', measure: 'birth weight', caption: 'Birth weight (pounds)',
      story: (m, s) => `Birth weights of full-term babies are approximately Normal with a mean of ${m} pounds and a standard deviation of ${s} pounds.`,
      lt: (v) => `weigh less than ${v}`, gt: (v) => `weigh more than ${v}`, btw: (a, b) => `weigh between ${a} and ${b}`,
      one: (v) => `a baby who weighs ${v}`,
      cutLow: (p) => `The <b>lightest ${p}%</b> of babies weigh less than ____ pounds.`,
      cutHigh: (p) => `The <b>heaviest ${p}%</b> of babies weigh more than ____ pounds.`,
      p34: [[7.5, 1.1], [7.6, 1.2]], step: 0.5, p35: [[7.5, 1.1], [7.4, 1.2]] },
    { key: 'height', unit: 'inches', short: 'inches', pl: 'women', sing: 'woman', measure: 'height', caption: 'Height (inches)',
      story: (m, s) => `Heights of adult women in the U.S. are approximately Normal with a mean of ${m} inches and a standard deviation of ${s} inches.`,
      lt: (v) => `are shorter than ${v}`, gt: (v) => `are taller than ${v}`, btw: (a, b) => `are between ${a} and ${b} tall`,
      one: (v) => `a woman who is ${v} tall`,
      cutLow: (p) => `The <b>shortest ${p}%</b> of women are under ____ inches tall.`,
      cutHigh: (p) => `The <b>tallest ${p}%</b> of women are over ____ inches tall.`,
      p34: [[64.5, 2.5], [64, 2.8]], step: 0.5, p35: [[64.5, 2.5], [64, 2.5]] },
    { key: 'battery', unit: 'hours', short: 'hours', pl: 'full charges', sing: 'phone', measure: 'battery life', measures: 'battery lives', caption: 'Battery life (hours)',
      story: (m, s) => `A phone’s battery life on a full charge is approximately Normal with a mean of ${m} hours and a standard deviation of ${s} hours.`,
      lt: (v) => `last less than ${v}`, gt: (v) => `last more than ${v}`, btw: (a, b) => `last between ${a} and ${b}`,
      one: (v) => `a charge that lasts ${v}`,
      cutLow: (p) => `The <b>shortest-lasting ${p}%</b> of charges last less than ____ hours.`,
      cutHigh: (p) => `The <b>longest-lasting ${p}%</b> of charges last more than ____ hours.`,
      p34: [[18, 1.5], [11, 1.2], [20, 2]], step: 0.5, p35: [[18, 1.5], [20, 2]] },
    { key: 'pizza', unit: 'minutes', short: 'minutes', pl: 'deliveries', sing: 'delivery', measure: 'delivery time', whose: 'The time for one delivery', caption: 'Delivery time (minutes)',
      story: (m, s) => `Delivery times for a pizza shop are approximately Normal with a mean of ${m} minutes and a standard deviation of ${s} minutes.`,
      lt: (v) => `take less than ${v}`, gt: (v) => `take more than ${v}`, btw: (a, b) => `take between ${a} and ${b}`,
      one: (v) => `a delivery that takes ${v}`,
      cutLow: (p) => `The <b>fastest ${p}%</b> of deliveries take less than ____ minutes.`,
      cutHigh: (p) => `The <b>slowest ${p}%</b> of deliveries take more than ____ minutes.`,
      p34: [[32, 6], [28, 5], [35, 7]], step: 1, p35: [[30, 6], [32, 5]] },
    { key: 'cereal', unit: 'ounces', short: 'oz', pl: 'boxes', sing: 'box', measure: 'weight', caption: 'Weight of cereal box (ounces)',
      story: (m, s) => `The weights of “16-ounce” boxes of cereal are approximately Normal with a mean of ${m} ounces and a standard deviation of ${s} ounces.`,
      lt: (v) => `weigh less than ${v}`, gt: (v) => `weigh more than ${v}`, btw: (a, b) => `weigh between ${a} and ${b}`,
      one: (v) => `a box that weighs ${v}`,
      cutLow: (p) => `The <b>lightest ${p}%</b> of boxes weigh less than ____ ounces.`,
      cutHigh: (p) => `The <b>heaviest ${p}%</b> of boxes weigh more than ____ ounces.`,
      p34: [[16.2, 0.3], [16.3, 0.2]], step: 0.1, p35: [[16.3, 0.15], [16.2, 0.1]] },
    { key: 'dragon', unit: 'meters', short: 'meters', pl: 'fire dragons', sing: 'dragon', measure: 'wingspan', caption: 'Wingspan (meters)',
      story: (m, s) => `In the Ember Peaks, the wingspans of adult fire dragons are approximately Normal with a mean of ${m} meters and a standard deviation of ${s} meters.`,
      lt: (v) => `have wingspans shorter than ${v}`, gt: (v) => `have wingspans longer than ${v}`, btw: (a, b) => `have wingspans between ${a} and ${b}`,
      one: (v) => `a dragon with a wingspan of ${v}`,
      cutLow: (p) => `The <b>smallest ${p}%</b> of fire dragons have wingspans under ____ meters.`,
      cutHigh: (p) => `The <b>largest ${p}%</b> of fire dragons have wingspans over ____ meters.`,
      p34: [[14.5, 1.8], [12, 1.5]], step: 0.5, p35: [[14, 1.5], [12.5, 1.2]] },
    { key: 'heart', unit: 'bpm', short: 'bpm', pl: 'teens', sing: 'teen', measure: 'resting heart rate', caption: 'Resting heart rate (bpm)',
      story: (m, s) => `Resting heart rates of teenagers are approximately Normal with a mean of ${m} beats per minute (bpm) and a standard deviation of ${s} bpm.`,
      lt: (v) => `have resting heart rates below ${v}`, gt: (v) => `have resting heart rates above ${v}`, btw: (a, b) => `have resting heart rates between ${a} and ${b}`,
      one: (v) => `a teen with a resting heart rate of ${v}`,
      cutLow: (p) => `The <b>lowest ${p}%</b> of resting heart rates are below ____ bpm.`,
      cutHigh: (p) => `The <b>highest ${p}%</b> of resting heart rates are above ____ bpm.`,
      p34: [[72, 9], [75, 10]], step: 1, p35: [[72, 8], [70, 9]] },
    { key: 'sat', unit: '', short: 'points', pl: 'students', sing: 'student', measure: 'SAT math score', caption: 'SAT math score',
      story: (m, s) => `Scores on the SAT math section (out of 800) are approximately Normal with a mean of ${m} and a standard deviation of ${s}.`,
      lt: (v) => `scored less than ${v}`, gt: (v) => `scored more than ${v}`, btw: (a, b) => `scored between ${a} and ${b}`,
      one: (v) => `a student who scored ${v}`,
      cutLow: (p) => `The <b>lowest-scoring ${p}%</b> of students scored below ____.`,
      cutHigh: (p) => `A scholarship requires a score in the <b>top ${p}%</b>. Students need a score of at least ____.`,
      p34: [[528, 117], [520, 110]], step: 10, zMax: 2.3, p35: [[528, 117], [520, 110]], kMax: 2 },
    { key: 'sodium', unit: 'mg', short: 'mg', pl: 'meals', sing: 'meal', measure: 'sodium content', measures: 'sodium amounts', caption: 'Sodium per meal (mg)', that: 'that amount',
      story: (m, s) => `A study of restaurant takeout orders found that the sodium content of the meals is approximately Normal with a mean of ${m} mg and a standard deviation of ${s} mg.`,
      lt: (v) => `have less than ${v} of sodium`, gt: (v) => `have more than ${v} of sodium`, btw: (a, b) => `have between ${a} and ${b} of sodium`,
      one: (v) => `a meal with ${v} of sodium`,
      cutLow: (p) => `The <b>lowest-sodium ${p}%</b> of meals have less than ____ mg.`,
      cutHigh: (p) => `The <b>saltiest ${p}%</b> of meals have more than ____ mg.`,
      p34: [[2000, 500], [1800, 400]], step: 100, p35: [[2000, 500], [1800, 400]] },
    { key: 'chips', unit: 'ounces', short: 'oz', pl: 'bags', sing: 'bag', measure: 'weight', caption: 'Weight of a “9-ounce” bag of chips (ounces)',
      story: (m, s) => `The weights of “9-ounce” bags of a brand of potato chips can be modeled by a Normal distribution with mean μ = ${m} ounces and standard deviation σ = ${s} ounces.`,
      lt: (v) => `weigh less than ${v}`, gt: (v) => `weigh more than ${v}`, btw: (a, b) => `weigh between ${a} and ${b}`,
      one: (v) => `a bag that weighs ${v}`,
      cutLow: (p) => `The <b>lightest ${p}%</b> of bags weigh less than ____ ounces.`,
      cutHigh: (p) => `The <b>heaviest ${p}%</b> of bags weigh more than ____ ounces.`,
      p34: [[9.12, 0.05]], step: 0.01, p35: [[9.12, 0.05], [9.15, 0.04]] },
    { key: 'potion', unit: 'mL', short: 'mL', pl: 'potions', sing: 'potion', measure: 'volume', caption: 'Potion volume (mL)',
      story: (m, s) => `The Alchemists’ Guild fills bottles of healing potion. The volumes are approximately Normal with a mean of ${m} mL and a standard deviation of ${s} mL.`,
      lt: (v) => `contain less than ${v}`, gt: (v) => `contain more than ${v}`, btw: (a, b) => `contain between ${a} and ${b}`,
      one: (v) => `a potion that contains ${v}`,
      cutLow: (p) => `The <b>least-filled ${p}%</b> of potions contain less than ____ mL.`,
      cutHigh: (p) => `The <b>fullest ${p}%</b> of potions contain more than ____ mL.`,
      p34: [[250, 8], [500, 12]], step: 1, p35: [[250, 6], [500, 10]] },
    { key: 'busride', unit: 'minutes', short: 'minutes', pl: 'bus rides', sing: 'ride', measure: 'ride time', whose: 'The time of one bus ride', caption: 'Bus ride time (minutes)',
      story: (m, s) => `The times of morning bus rides to Lakeview High School are approximately Normal with a mean of ${m} minutes and a standard deviation of ${s} minutes.`,
      lt: (v) => `take less than ${v}`, gt: (v) => `take more than ${v}`, btw: (a, b) => `take between ${a} and ${b}`,
      one: (v) => `a ride that takes ${v}`,
      cutLow: (p) => `The <b>quickest ${p}%</b> of rides take less than ____ minutes.`,
      cutHigh: (p) => `The <b>longest ${p}%</b> of rides take more than ____ minutes.`,
      p34: [[26, 5], [22, 4]], step: 1, p35: [[26, 5], [24, 4]] },
    { key: 'bulb', unit: 'hours', short: 'hours', pl: 'bulbs', sing: 'bulb', measure: 'lifetime', caption: 'Bulb lifetime (hours)', that: 'that many hours',
      story: (m, s) => `The lifetimes of a brand of light bulb are approximately Normal with a mean of ${m} hours and a standard deviation of ${s} hours.`,
      lt: (v) => `burn out in less than ${v}`, gt: (v) => `last more than ${v}`, btw: (a, b) => `last between ${a} and ${b}`,
      one: (v) => `a bulb that lasts ${v}`,
      cutLow: (p) => `The <b>shortest-lived ${p}%</b> of bulbs burn out in less than ____ hours.`,
      cutHigh: (p) => `The <b>longest-lasting ${p}%</b> of bulbs last more than ____ hours.`,
      p34: [[1200, 90], [1000, 80]], step: 10, p35: [[1200, 75], [1000, 60]] },
    { key: 'act', unit: '', short: 'points', pl: 'students', sing: 'student', measure: 'ACT score', caption: 'ACT composite score',
      story: (m, s) => `Composite ACT scores are approximately Normal with a mean of ${m} and a standard deviation of ${s}.`,
      lt: (v) => `scored below ${v}`, gt: (v) => `scored above ${v}`, btw: (a, b) => `scored between ${a} and ${b}`,
      one: (v) => `a student with an ACT score of ${v}`,
      cutLow: (p) => `The <b>lowest-scoring ${p}%</b> of students scored below ____.`,
      cutHigh: (p) => `The <b>top ${p}%</b> of students scored above ____.`,
      p34: [[21, 5], [20.8, 5.8]], step: 1, zMax: 2.5, p35: [[21, 5]] },
  ];
  // value formatting helpers for a normal context
  const nf = (ctx, v, d) => (ctx.money ? '$' + commas(trim(v, d === undefined ? 4 : d)) : trim(v, d === undefined ? 4 : d));
  const nfx = (ctx, v) => (ctx.money ? '$' + commas(fmt(v, 2)) : fmt(v, 2)); // 2-decimal answers
  const nu = (ctx, s) => (ctx.money || !ctx.unit ? s : `${s} ${ctx.unit}`);
  const raw = (v) => trim(v, 4).replace(MINUS, '-');

  function gridVals(ctx, mu, sd, zMin, zMax) {
    const st = ctx.step, out = [];
    const j0 = Math.ceil((mu - zMax * sd) / st - 1e-9), j1 = Math.floor((mu + zMax * sd) / st + 1e-9);
    for (let j = j0; j <= j1; j++) {
      const v = roundTo(j * st, 4), z = (v - mu) / sd;
      if (Math.abs(z) >= zMin - 1e-9) out.push(v);
    }
    return out;
  }

  // =====================================================================
  // 3.3 z-SCORES
  // =====================================================================
  const CMP_CTX = [
    { key: 'fish', unit: 'cm', muDec: 2, sdDec: 2, xDec: 2, mu: [72, 95], sd: [2, 5], lower: false,
      groups: ['Lake Shata', 'Lake Capra', 'Mirror Lake', 'Lake Tahoma', 'Pine Lake', 'Silver Lake'],
      pair: (A, B) => `The average length of a fish in ${A.g} is ${A.m} cm with a standard deviation of ${A.s} cm. At ${B.g}, the average is ${B.m} cm with a standard deviation of ${B.s} cm. ${A.n} catches a fish at ${A.g} that measures ${A.x} cm, and ${B.n} catches one at ${B.g} that measures ${B.x} cm.`,
      solo: (A) => `The average length of a fish in ${A.g} is ${A.m} cm with a standard deviation of ${A.s} cm. ${A.n} catches a fish there that measures ${A.x} cm.`,
      ask: 'Who had the better catch relative to their lake?' },
    { key: 'milk', unit: 'kg', muDec: 2, sdDec: 2, xDec: 2, mu: [8, 12], sd: [1.5, 3.8], lower: false,
      groups: ['Big Ranch', 'Chico Ranch', 'Sunny Acres', 'Red Barn Farm', 'Hilltop Dairy'],
      names: ['Daisy', 'Bessie', 'Clover', 'Buttercup', 'Rosie', 'Maple', 'Hazel', 'Penny'],
      pair: (A, B) => `On average, a cow at ${A.g} makes ${A.m} kg of milk a day with a standard deviation of ${A.s} kg. A cow at ${B.g} makes ${B.m} kg a day on average with a standard deviation of ${B.s} kg. Last week ${A.n} (from ${A.g}) made ${A.x} kg in one day, and ${B.n} (from ${B.g}) made ${B.x} kg.`,
      solo: (A) => `On average, a cow at ${A.g} makes ${A.m} kg of milk a day with a standard deviation of ${A.s} kg. Last week ${A.n} the cow made ${A.x} kg in one day.`,
      ask: 'Which cow produced more milk relative to her ranch?' },
    { key: 'bus', unit: 'minutes', muDec: 2, sdDec: 2, xDec: 2, mu: [8, 14], sd: [2, 5], lower: true,
      groups: ['the stop near the high school', 'the stop near the library', 'the stop by the mall', 'the stop near the church', 'the stop by the park'],
      pair: (A, B) => `The average wait at ${A.g} is ${A.m} minutes with a standard deviation of ${A.s} minutes. At ${B.g}, the average wait is ${B.m} minutes with a standard deviation of ${B.s} minutes. On Monday, ${A.n} waited ${A.x} minutes at ${A.g}, and ${B.n} waited ${B.x} minutes at ${B.g}.`,
      solo: (A) => `The average wait for the bus at ${A.g} is ${A.m} minutes with a standard deviation of ${A.s} minutes. On Monday, ${A.n} waited ${A.x} minutes there.`,
      note: 'A <b>shorter</b> wait is better.', ask: 'Whose wait was better relative to their bus stop?' },
    { key: 'sales', unit: 'minutes', muDec: 2, sdDec: 2, xDec: 2, mu: [11, 15], sd: [2, 3.5], lower: true,
      groups: ['Company A', 'Company B', 'Company C', 'Company D'],
      pair: (A, B) => `Salespeople at ${A.g} close a sale in ${A.m} minutes on average, with a standard deviation of ${A.s} minutes. At ${B.g}, the average is ${B.m} minutes with a standard deviation of ${B.s} minutes. ${A.n} (${A.g}) took ${A.x} minutes to close a sale, and ${B.n} (${B.g}) took ${B.x} minutes.`,
      solo: (A) => `Salespeople at ${A.g} close a sale in ${A.m} minutes on average, with a standard deviation of ${A.s} minutes. ${A.n} took ${A.x} minutes to close a sale.`,
      note: 'Closing a sale <b>faster</b> is better.', ask: 'Whose sales call was better relative to their company?' },
    { key: 'tests', unit: 'points', muDec: 1, sdDec: 1, xDec: 0, mu: [66, 82], sd: [4, 10], lower: false,
      groups: ['Ms. Ortiz’s class', 'Mr. Chen’s class', 'Mrs. Patel’s class', 'Mr. Brooks’s class'],
      pair: (A, B) => `On a unit test, ${A.g} averaged ${A.m} points with a standard deviation of ${A.s} points, and ${B.g} averaged ${B.m} points with a standard deviation of ${B.s} points. ${A.n} (in ${A.g}) scored ${A.x}, and ${B.n} (in ${B.g}) scored ${B.x}.`,
      solo: (A) => `On a unit test, ${A.g} averaged ${A.m} points with a standard deviation of ${A.s} points. ${A.n} scored ${A.x}.`,
      ask: 'Who did better relative to their class?' },
    { key: 'dash', unit: 'seconds', muDec: 2, sdDec: 2, xDec: 2, mu: [12.5, 14.5], sd: [0.4, 0.9], lower: true,
      groups: ['the Valley League', 'the Coastal League', 'the Metro League', 'the Summit League'],
      pair: (A, B) => `In ${A.g}, 100-meter dash times average ${A.m} seconds with a standard deviation of ${A.s} seconds. In ${B.g}, the average is ${B.m} seconds with a standard deviation of ${B.s} seconds. ${A.n} runs ${A.x} seconds in ${A.g}, and ${B.n} runs ${B.x} seconds in ${B.g}.`,
      solo: (A) => `In ${A.g}, 100-meter dash times average ${A.m} seconds with a standard deviation of ${A.s} seconds. ${A.n} runs the dash in ${A.x} seconds.`,
      note: 'A <b>lower</b> time is better.', ask: 'Who ran better relative to their league?' },
    { key: 'golf', unit: 'strokes', muDec: 1, sdDec: 1, xDec: 0, mu: [72, 88], sd: [3, 6], lower: true,
      groups: ['Oak Hills Golf Course', 'Seaside Links', 'Eagle Ridge Course', 'Pine Valley Course'],
      pair: (A, B) => `At ${A.g}, the average score is ${A.m} strokes with a standard deviation of ${A.s} strokes. At ${B.g}, the average is ${B.m} strokes with a standard deviation of ${B.s} strokes. ${A.n} shot ${A.x} at ${A.g}, and ${B.n} shot ${B.x} at ${B.g}.`,
      solo: (A) => `At ${A.g}, the average score is ${A.m} strokes with a standard deviation of ${A.s} strokes. ${A.n} shot ${A.x} there.`,
      note: 'In golf, a <b>lower</b> score is better.', ask: 'Who played better relative to their course?' },
    { key: 'pumpkin', unit: 'pounds', muDec: 1, sdDec: 1, xDec: 1, mu: [420, 650], sd: [50, 110], lower: false,
      groups: ['the Green Valley Fair', 'the Riverside County Fair', 'the Harvest Moon Festival', 'the Hillcrest Fair'],
      pair: (A, B) => `At ${A.g}, giant pumpkins average ${A.m} pounds with a standard deviation of ${A.s} pounds. At ${B.g}, they average ${B.m} pounds with a standard deviation of ${B.s} pounds. ${A.n} entered a ${A.x}-pound pumpkin at ${A.g}, and ${B.n} entered a ${B.x}-pound pumpkin at ${B.g}.`,
      solo: (A) => `At ${A.g}, giant pumpkins average ${A.m} pounds with a standard deviation of ${A.s} pounds. ${A.n} entered a ${A.x}-pound pumpkin.`,
      ask: 'Whose pumpkin was more impressive relative to their fair?' },
    { key: 'gold', unit: 'coins', muDec: 1, sdDec: 1, xDec: 0, mu: [150, 300], sd: [20, 50], lower: false,
      groups: ['the Iron Guild', 'the Moonlight Guild', 'the Ember Guild', 'the Frost Guild'],
      pair: (A, B) => `Adventurers in ${A.g} bring back an average of ${A.m} gold coins per raid, with a standard deviation of ${A.s} coins. In ${B.g}, the average is ${B.m} coins with a standard deviation of ${B.s} coins. On their last raids, ${A.n} (${A.gp}) brought back ${A.x} coins and ${B.n} (${B.gp}) brought back ${B.x} coins.`,
      solo: (A) => `Adventurers in ${A.g} bring back an average of ${A.m} gold coins per raid, with a standard deviation of ${A.s} coins. On the last raid, ${A.n} brought back ${A.x} coins.`,
      ask: 'Who had the better raid relative to their guild?' },
    { key: 'escape', unit: 'minutes', muDec: 1, sdDec: 1, xDec: 1, mu: [30, 60], sd: [5, 10], lower: true,
      groups: ['the Crystal Caverns', 'the Shadow Crypt', 'the Goblin Warrens', 'the Sunken Temple'],
      pair: (A, B) => `Parties take an average of ${A.m} minutes to escape ${A.g}, with a standard deviation of ${A.s} minutes. Escaping ${B.g} takes ${B.m} minutes on average, with a standard deviation of ${B.s} minutes. ${A.n}’s party escaped ${A.g} in ${A.x} minutes, and ${B.n}’s party escaped ${B.g} in ${B.x} minutes.`,
      solo: (A) => `Parties take an average of ${A.m} minutes to escape ${A.g}, with a standard deviation of ${A.s} minutes. ${A.n}’s party escaped in ${A.x} minutes.`,
      note: 'A <b>faster</b> escape is better.', ask: 'Whose party did better relative to their dungeon?' },
  ];

  function cmpPerson(ctx, zLo, zHi) {
    const m = roundTo(unif(ctx.mu[0], ctx.mu[1]), ctx.muDec);
    const s = roundTo(unif(ctx.sd[0], ctx.sd[1]), ctx.sdDec);
    const x = roundTo(m + unif(zLo, zHi) * s, ctx.xDec);
    return { m, s, x, z: (x - m) / s };
  }
  // z-score sub-question (one num part)
  function zSub(o) {
    // o: { label, x, m, s, xs, ms, ss (formatted), who }
    const z = (o.x - o.m) / o.s, zr = roundTo(z, 2), diff = o.x - o.m;
    const dd = Math.max(decOf(o.x), decOf(o.m));
    return {
      z, zr,
      part: { kind: 'num', label: o.label, unit: '', answer: zr, tol: 0.011, placeholder: 'e.g. -1.25' },
      setup: `${eq(`z = (${o.xs} − ${o.ms}) ÷ ${o.ss}`)}`,
      calc: `${o.xs} − ${o.ms} = ${fmt(diff, dd)}, then ${fmt(diff, dd)} ÷ ${o.ss} → round to 2 decimals.`,
      sol: `${o.who ? o.who + ': ' : ''}${eq(`z = (${o.xs} − ${o.ms}) ÷ ${o.ss} = ${fmt(diff, dd)} ÷ ${o.ss} ${eqSign(z, 2)} ${fmt(zr, 2)}`)}`,
      meta: { q: 'z', mu: o.m, sigma: o.s, x: o.x },
    };
  }
  const FORMULA = `Use ${eq('z = (x − μ) ÷ σ')}: subtract the mean, then divide by the standard deviation.`;
  const sdWords = (z) => `${trim(Math.abs(roundTo(z, 2)), 2)} standard deviation${Math.abs(roundTo(z, 2)) === 1 ? '' : 's'} ${z < 0 ? 'below' : 'above'} the mean`;

  function gen33compare(opts) {
    for (let tries = 0; ; tries++) {
      const ctx = pick(CMP_CTX);
      const gs = shuffle(ctx.groups).slice(0, 2);
      const nm = ctx.names ? shuffle(ctx.names).slice(0, 2) : names(2);
      const A = cmpPerson(ctx, -2.4, 2.4), B = cmpPerson(ctx, -2.4, 2.4);
      if (A.s <= 0 || B.s <= 0) continue;
      if ([A.z, B.z].some((z) => Math.abs(z) < 0.1 || Math.abs(z) > 2.6 || zAmbiguous(z))) continue;
      const zA = roundTo(A.z, 2), zB = roundTo(B.z, 2);
      if (Math.abs(zA - zB) < 0.15) continue;
      const betterIdx = ctx.lower ? (zA < zB ? 0 : 1) : (zA > zB ? 0 : 1);
      const rawBetter = ctx.lower ? (A.x < B.x ? 0 : 1) : (A.x > B.x ? 0 : 1);
      if (tries < 60 && rawBetter === betterIdx && chance(0.7)) continue; // usually make raw values misleading
      const F = (P, g, n) => ({ g, gp: g.replace(/^the /, ''), n, m: trim(P.m, ctx.muDec), s: trim(P.s, ctx.sdDec), x: fmt(P.x, ctx.xDec) });
      const FA = F(A, gs[0], nm[0]), FB = F(B, gs[1], nm[1]);
      const sa = zSub({ label: `${nm[0]}’s z =`, x: A.x, m: A.m, s: A.s, xs: FA.x, ms: FA.m, ss: FA.s, who: nm[0] });
      const sb = zSub({ label: `${nm[1]}’s z =`, x: B.x, m: B.m, s: B.s, xs: FB.x, ms: FB.m, ss: FB.s, who: nm[1] });
      const better = nm[betterIdx];
      const dirText = ctx.lower
        ? `Here <b>lower is better</b>, so the <b>smaller</b> (more negative) z-score wins.`
        : 'Here higher is better, so the <b>larger</b> z-score wins.';
      return compose({
        section: '3.3', type: 'compare', title: 'Who did better?',
        top: `<p class="story">${ctx.pair(FA, FB)}${ctx.note ? ' ' + ctx.note : ''}</p>`,
        subs: [{
          q: `${ctx.ask} Compare their z-scores (round to 2 decimals).`,
          parts: [sa.part, sb.part, { kind: 'choice', label: ctx.ask, options: [nm[0], nm[1]], correct: betterIdx }],
          hints: [
            `${FORMULA} Each person uses <b>their own</b> group’s mean and SD.`,
            `${nm[0]}: ${sa.setup}<br>${nm[1]}: ${sb.setup}`,
            `${nm[0]}: ${sa.calc}<br>${nm[1]}: ${sb.calc}<br>${dirText}`,
          ],
          sol: [
            sa.sol, sb.sol,
            `${dirText} ${fmt(sa.zr, 2)} vs. ${fmt(sb.zr, 2)} → <b>${better}</b> did better relative to their group.`,
          ],
        }],
        meta: { lowerBetter: !!ctx.lower, parts: [sa.meta, sb.meta, { q: 'better', lowerBetter: !!ctx.lower }] },
        signature: `3.3|compare|${ctx.key}|${A.x}|${A.m}|${A.s}|${B.x}|${B.m}|${B.s}`,
      });
    }
  }

  const RANK_CTX = [
    { key: 'class', lower: false, mu: [68, 80], muDec: 0, sd: [2, 8], sdDec: 1, xDec: 0,
      intro: 'One student was chosen from each of four different stats classes. Here are their final scores, with each class’s mean and standard deviation:',
      line: (n, x, m, s) => `<b>${n}</b>: scored ${x} (class mean ${m}, SD ${s})`,
      best: 'did relatively <b>best</b> in their own class', worst: 'did relatively <b>worst</b> in their own class' },
    { key: 'race', lower: true, mu: [62, 75], muDec: 1, sd: [2, 5], sdDec: 1, xDec: 1,
      intro: 'Four runners ran the 400-meter race in different age groups. Here are their times (in seconds), with each age group’s mean and SD. <b>Lower times are better.</b>',
      line: (n, x, m, s) => `<b>${n}</b>: ${x} s (group mean ${m} s, SD ${s} s)`,
      best: 'ran relatively <b>best</b> for their age group', worst: 'ran relatively <b>worst</b> for their age group' },
    { key: 'joust', lower: false, mu: [40, 60], muDec: 1, sd: [4, 9], sdDec: 1, xDec: 0,
      intro: 'Four knights each competed in a different jousting tournament. Here are their points, with each tournament’s mean and standard deviation:',
      line: (n, x, m, s) => `<b>Sir ${n}</b>: ${x} points (tournament mean ${m}, SD ${s})`,
      best: 'did relatively <b>best</b> in their own tournament', worst: 'did relatively <b>worst</b> in their own tournament', sir: true },
    { key: 'pumpkin', lower: false, mu: [300, 600], muDec: 0, sd: [30, 90], sdDec: 0, xDec: 0,
      intro: 'Four growers entered giant pumpkins at four different county fairs. Here are their pumpkins’ weights (in pounds), with each fair’s mean and standard deviation:',
      line: (n, x, m, s) => `<b>${n}</b>: ${x} lb (fair mean ${m} lb, SD ${s} lb)`,
      best: 'grew the relatively <b>best</b> pumpkin for their fair', worst: 'grew the relatively <b>worst</b> pumpkin for their fair' },
  ];
  function gen33rank(opts) {
    for (let tries = 0; ; tries++) {
      const ctx = pick(RANK_CTX), nm = names(4), ask = chance(0.55) ? 'best' : 'worst';
      const ppl = nm.map(() => {
        const m = roundTo(unif(ctx.mu[0], ctx.mu[1]), ctx.muDec);
        const s = roundTo(unif(ctx.sd[0], ctx.sd[1]), ctx.sdDec);
        const x = roundTo(m + unif(-2.2, 2.3) * s, ctx.xDec);
        return { m, s, x, z: (x - m) / s, zr: roundTo((x - m) / s, 2) };
      });
      if (ppl.some((p) => p.s <= 0 || Math.abs(p.z) < 0.1 || Math.abs(p.z) > 2.6)) continue;
      // goodness: higher is better unless lower
      const good = ppl.map((p) => (ctx.lower ? -p.zr : p.zr));
      const order = good.map((g, i) => i).sort((i, j) => good[j] - good[i]); // best first
      const target = ask === 'best' ? order[0] : order[3];
      const runner = ask === 'best' ? order[1] : order[2];
      if (Math.abs(good[target] - good[runner]) < 0.12) continue;
      if (zAmbiguous(ppl[target].z)) continue;
      // raw scores should not give it away (most of the time)
      const rawGood = ppl.map((p) => (ctx.lower ? -p.x : p.x));
      const rawTarget = rawGood.indexOf(ask === 'best' ? Math.max.apply(null, rawGood) : Math.min.apply(null, rawGood));
      if (tries < 80 && rawTarget === target && chance(0.75)) continue;
      const nmF = (i) => (ctx.sir ? 'Sir ' : '') + nm[i];
      const F = ppl.map((p) => ({ m: trim(p.m, ctx.muDec), s: trim(p.s, ctx.sdDec), x: fmt(p.x, ctx.xDec) }));
      const zs = ppl.map((p, i) => zSub({ label: 'Their z =', x: p.x, m: p.m, s: p.s, xs: F[i].x, ms: F[i].m, ss: F[i].s, who: nmF(i) }));
      const tz = zs[target];
      const dirText = ctx.lower
        ? `Lower times are better, so the relatively ${ask} runner has the <b>${ask === 'best' ? 'smallest' : 'largest'}</b> z-score.`
        : `Higher is better, so the relatively ${ask} one has the <b>${ask === 'best' ? 'largest' : 'smallest'}</b> z-score.`;
      return compose({
        section: '3.3', type: 'rank', title: 'Relative ranking',
        top: `<p class="story">${ctx.intro}</p><div class="data">${ppl.map((p, i) => ctx.line(nm[i], F[i].x, F[i].m, F[i].s)).join('<br>')}</div>`,
        subs: [{
          q: `Who ${ask === 'best' ? ctx.best : ctx.worst}? Then give that person’s z-score.`,
          parts: [
            { kind: 'choice', label: `Relatively ${ask}:`, options: nm.map((_, i) => nmF(i)), correct: target },
            Object.assign({}, tz.part, { label: 'Their z-score =' }),
          ],
          hints: [
            `${FORMULA} Find a z-score for <b>each</b> of the four, using their own group’s mean and SD.`,
            zs.map((s, i) => `${nmF(i)}: ${s.setup}`).join('<br>'),
            `${zs.map((s, i) => `${nmF(i)}: z ≈ ${fmt(s.zr, 2)}`).join(', ')}.<br>${dirText}`,
          ],
          sol: zs.map((s) => s.sol).concat([`${dirText} → <b>${nmF(target)}</b>, with z ≈ <b>${fmt(tz.zr, 2)}</b>.`]),
        }],
        meta: { lowerBetter: !!ctx.lower, ask, people: ppl.map((p) => ({ mu: p.m, sigma: p.s, x: p.x })),
          parts: [{ q: 'rank' }, tz.meta] },
        signature: `3.3|rank|${ctx.key}|${ppl.map((p) => p.x + '/' + p.m + '/' + p.s).join('|')}|${ask}`,
      });
    }
  }

  function pickNorm34() {
    const ctx = pick(NORM_CTX);
    const ms = pick(ctx.p34);
    return { ctx, mu: ms[0], sd: ms[1] };
  }

  function gen33single(opts) {
    for (;;) {
      let story, q, x, m, s, xs, ms, ss, sig;
      if (chance(0.5)) {
        const ctx = pick(CMP_CTX);
        const P = cmpPerson(ctx, -2.6, 2.6);
        if (P.s <= 0) continue;
        x = P.x; m = P.m; s = P.s;
        xs = fmt(x, ctx.xDec); ms = trim(m, ctx.muDec); ss = trim(s, ctx.sdDec);
        const who = ctx.names ? pick(ctx.names) : pick(NAMES);
        story = ctx.solo({ g: pick(ctx.groups), n: who, m: ms, s: ss, x: xs });
        q = `Find the z-score for ${ctx.key === 'milk' ? who + '’s milk' : ctx.key === 'escape' ? who + '’s party' : who} (round to 2 decimals).`;
        sig = `cmp|${ctx.key}`;
      } else {
        const N = pickNorm34(), ctx = N.ctx;
        const zMax = Math.min(2.6, ctx.zMax || 2.6);
        x = pick(gridVals(ctx, N.mu, N.sd, 0.15, zMax)); m = N.mu; s = N.sd;
        story = ctx.story(nf(ctx, m), nf(ctx, s));
        q = `Find the z-score for ${ctx.one(nu(ctx, nf(ctx, x)))} (round to 2 decimals).`;
        // numbers inside the formula should not carry $ signs
        xs = trim(x); ms = trim(m); ss = trim(s);
        sig = `norm|${ctx.key}`;
      }
      const z = (x - m) / s;
      if (Math.abs(z) < 0.1 || Math.abs(z) > 2.7 || zAmbiguous(z)) continue;
      if (opts.hard && Math.abs(Math.abs(z) - 2) < 0.12) continue;
      const zs = zSub({ label: 'z =', x, m, s, xs, ms, ss });
      const parts = [zs.part];
      const metaParts = [zs.meta];
      const hints = [FORMULA, `Here x = ${xs}, μ = ${ms}, σ = ${ss}: ${zs.setup}`, zs.calc];
      const sol = [zs.sol, `So the value is ${sdWords(z)}.`];
      if (opts.hard) {
        const unusual = Math.abs(zs.zr) > 2;
        parts.push({ kind: 'choice', label: 'Is this value unusual (more than 2 SDs from the mean)?', options: ['Yes, |z| > 2', 'No, |z| ≤ 2'], correct: unusual ? 0 : 1 });
        metaParts.push({ q: 'unusualYN', mu: m, sigma: s, x });
        hints[2] += ' Then check whether |z| is bigger than 2.';
        sol.push(`|z| = ${trim(Math.abs(zs.zr), 2)} is ${unusual ? '<b>more than 2</b>, so it <b>is unusual</b>' : '<b>not more than 2</b>, so it is <b>not unusual</b>'}.`);
      }
      return compose({
        section: '3.3', type: 'single', title: 'Find the z-score',
        top: `<p class="story">${story}</p>`,
        subs: [{ q, parts, hints, sol }],
        meta: { parts: metaParts },
        signature: `3.3|single|${sig}|${x}|${m}|${s}`,
      });
    }
  }

  function gen33unusual(opts) {
    for (;;) {
      const N = pickNorm34(), ctx = N.ctx, mu = N.mu, sd = N.sd;
      const zTop = Math.min(3.2, ctx.zMax || 3.2);
      const far = gridVals(ctx, mu, sd, 2.2, zTop);
      const near = gridVals(ctx, mu, sd, 0.2, 1.75);
      if (!far.length || near.length < 3) continue;
      const ms = nf(ctx, mu), ss = nf(ctx, sd);
      const variantA = opts.hard || chance(0.55);
      if (variantA) {
        const u = pick(far);
        const others = shuffle(near).slice(0, 3);
        if (new Set(others).size < 3) continue;
        const vals = shuffle([u].concat(others));
        const lo = mu - 2 * sd, hi = mu + 2 * sd;
        const subs = [{
          q: `Which of these ${ctx.pl} would be considered <b>unusual</b> (more than 2 standard deviations from the mean)?`,
          parts: [{ kind: 'choice', label: 'Unusual value:', options: vals.map((v) => nu(ctx, nf(ctx, v))), correct: vals.indexOf(u) }],
          hints: [
            `Unusual means |z| > 2, where ${eq('z = (x − μ) ÷ σ')}.`,
            `Shortcut: 2 SDs below the mean is ${eq(`${ms} − 2(${ss}) = ${nf(ctx, lo)}`)} and 2 SDs above is ${eq(`${ms} + 2(${ss}) = ${nf(ctx, hi)}`)}.`,
            `Which choice is <b>outside</b> the interval from ${nf(ctx, lo)} to ${nf(ctx, hi)}?`,
          ],
          sol: vals.map((v) => {
            const z = (v - mu) / sd;
            return `${nu(ctx, nf(ctx, v))}: z = (${trim(v)} − ${trim(mu)}) ÷ ${trim(sd)} ≈ ${fmt(z, 2)}${v === u ? ' ← <b>|z| > 2, unusual</b>' : ''}`;
          }),
        }];
        const metaParts = [{ q: 'whichUnusual', mu, sigma: sd, values: vals }];
        if (opts.hard) {
          const zs = zSub({ label: 'Its z-score =', x: u, m: mu, s: sd, xs: trim(u), ms: trim(mu), ss: trim(sd) });
          if (zAmbiguous(zs.z)) continue;
          subs[0].parts.push(zs.part);
          subs[0].q += ' Then find its z-score.';
          metaParts.push(zs.meta);
        }
        return compose({
          section: '3.3', type: 'unusual', title: 'Unusual or not?',
          top: `<p class="story">${ctx.story(ms, ss)}</p>`, subs, meta: { parts: metaParts },
          signature: `3.3|unusual|A|${ctx.key}|${mu}|${sd}|${vals.join(',')}`,
        });
      }
      // variant B: one value, z + yes/no
      const x = chance(0.5) ? pick(far) : pick(gridVals(ctx, mu, sd, 0.3, 1.8));
      const zs = zSub({ label: 'z =', x, m: mu, s: sd, xs: trim(x), ms: trim(mu), ss: trim(sd) });
      if (zAmbiguous(zs.z)) continue;
      const unusual = Math.abs(zs.zr) > 2;
      return compose({
        section: '3.3', type: 'unusual', title: 'Unusual or not?',
        top: `<p class="story">${ctx.story(ms, ss)}</p>`,
        subs: [{
          q: `Would ${ctx.one(nu(ctx, nf(ctx, x)))} be <b>unusual</b>? (Unusual means more than 2 standard deviations from the mean.) Find its z-score first.`,
          parts: [zs.part, { kind: 'choice', label: 'Unusual?', options: ['Yes, |z| > 2', 'No, |z| ≤ 2'], correct: unusual ? 0 : 1 }],
          hints: [FORMULA, `${zs.setup}`, `${zs.calc} Then: is |z| bigger than 2?`],
          sol: [zs.sol, `|z| = ${trim(Math.abs(zs.zr), 2)}, which is ${unusual ? '<b>more than 2 → unusual</b>' : '<b>not more than 2 → not unusual</b>'}.`],
        }],
        meta: { parts: [zs.meta, { q: 'unusualYN', mu, sigma: sd, x }] },
        signature: `3.3|unusual|B|${ctx.key}|${mu}|${sd}|${x}`,
      });
    }
  }

  function gen33findX(opts) {
    for (;;) {
      const N = pickNorm34(), ctx = N.ctx, mu = N.mu, sd = N.sd;
      const zDec = decOf(sd) === 0 ? 2 : 1;
      const zMax = Math.min(2.8, ctx.zMax || 2.8);
      const z = roundTo(unif(0.25, zMax) * (chance(0.5) ? -1 : 1), zDec);
      if (Math.abs(z) < 0.2) continue;
      const x = roundTo(mu + z * sd, 6);
      if (x <= 0) continue;
      const ms = nf(ctx, mu), ss = nf(ctx, sd);
      const phr = chance(0.5)
        ? `${ctx.whose || `A ${ctx.sing}’s ${ctx.measure}`} has a z-score of <b>${fmt(z, zDec)}</b>.`
        : `${ctx.whose || `A ${ctx.sing}’s ${ctx.measure}`} is <b>${trim(Math.abs(z), 2)} standard deviations ${z < 0 ? 'below' : 'above'}</b> the mean.`;
      const prod = z * sd;
      const unit = ctx.money ? 'dollars' : ctx.short;
      const parts = [{ kind: 'num', label: `${cap(ctx.measure)} =`, unit, answer: x, tol: Math.max(0.011, 0.02 * sd) }];
      const pd = Math.max(decOf(prod), 0);
      return compose({
        section: '3.3', type: 'findX', title: 'Work backward from z',
        top: `<p class="story">${ctx.story(ms, ss)}</p>`,
        subs: [{
          q: `${phr} What is its ${ctx.measure}?`,
          parts,
          hints: [
            `Undo the z-score formula: ${eq('x = μ + z·σ')}. (A negative z means below the mean.)`,
            `${eq(`x = ${trim(mu)} + (${fmt(z, zDec)})(${trim(sd)})`)}`,
            `${eq(`(${fmt(z, zDec)})(${trim(sd)}) = ${fmt(prod, pd)}`)}. Now add that to ${trim(mu)}.`,
          ],
          sol: [
            `${eq(`x = μ + z·σ = ${trim(mu)} + (${fmt(z, zDec)})(${trim(sd)})`)}`,
            `${eq(`= ${trim(mu)} ${prod < 0 ? '−' : '+'} ${trim(Math.abs(prod), pd)} = ${trim(x)}`)} → <b>${nu(ctx, nf(ctx, x))}</b>`,
          ],
        }],
        meta: { parts: [{ q: 'x', mu, sigma: sd, z }] },
        signature: `3.3|findX|${ctx.key}|${mu}|${sd}|${z}`,
      });
    }
  }

  function gen33(type, opts) {
    if (type === 'compare') return gen33compare(opts);
    if (type === 'rank') return gen33rank(opts);
    if (type === 'unusual') return gen33unusual(opts);
    if (type === 'findX') return gen33findX(opts);
    return gen33single(opts);
  }

  // =====================================================================
  // 3.4 NORMAL DISTRIBUTIONS WITH DESMOS
  // =====================================================================
  const PCTILE_KS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 55, 60, 65, 70, 75, 80, 85, 90, 95];
  const CUT_PS = [1, 2, 3, 5, 10, 15, 20, 25];
  // accepts 2-decimal rounding and small z-rounding differences; rejects wrong tails / wrong methods
  const xTol = (sd) => Math.max(0.0025 * sd, Math.min(0.05, 0.04 * sd), 0.006);
  const ND = (mu, sd) => `normaldist(${raw(mu)}, ${raw(sd)})`;

  function norm34Sub(kind, ctx, mu, sd) {
    const zMax = Math.min(2.9, ctx.zMax || 2.9);
    const U = (v) => nu(ctx, nf(ctx, v));
    const cdf = (v) => normalCdf((v - mu) / sd);
    const desmosArea = (lo, hi) => `In Desmos, type ${eq(ND(mu, sd))}. Check <b>Find Cumulative Probability</b>, then set <b>Min</b> = ${lo} and <b>Max</b> = ${hi}.`;
    const NEG_INF = '−∞ (type <i>-infinity</i>)', POS_INF = '∞ (type <i>infinity</i>)';
    const areaPart = (P) => ({ kind: 'num', label: 'Percent =', unit: '%', answer: roundTo(P, 2), tol: 0.15, placeholder: 'e.g. 12.34' });
    if (kind === 'less' || kind === 'greater') {
      const x = pick(gridVals(ctx, mu, sd, 0.25, Math.min(zMax, 2.6)));
      const isLess = kind === 'less';
      const P = 100 * (isLess ? cdf(x) : 1 - cdf(x));
      const z = (x - mu) / sd;
      return {
        q: `What percent of ${ctx.pl} ${isLess ? ctx.lt(U(x)) : ctx.gt(U(x))}?`,
        parts: [areaPart(P)],
        hints: [
          isLess ? desmosArea(NEG_INF, raw(x)) : desmosArea(raw(x), POS_INF),
          `Desmos shows about <b>${fmt(P / 100, 4)}</b>. Multiply by 100 to get a percent (2 decimals).`,
        ],
        sol: [
          `Desmos: ${eq(ND(mu, sd))}, cumulative probability from ${isLess ? '−∞' : nf(ctx, x)} to ${isLess ? nf(ctx, x) : '∞'} → ${fmt(P / 100, 4)}`,
          `So about <b>${fmt(P, 2)}%</b> of ${ctx.pl} ${isLess ? ctx.lt(U(x)) : ctx.gt(U(x))}.`,
          `<span class="small">Sense check: z = (${trim(x)} − ${trim(mu)}) ÷ ${trim(sd)} ≈ ${fmt(z, 2)}, so ${U(x)} is ${sdWords(z)} — the shaded area should be ${(isLess ? z < 0 : z > 0) ? 'less' : 'more'} than half.</span>`,
        ],
        shade: isLess ? [-Infinity, x] : [x, Infinity], marks: [{ v: x, label: nf(ctx, x), solLabel: nf(ctx, x) }],
        meta: { q: kind, x }, sig: `${kind}${x}`,
      };
    }
    if (kind === 'between') {
      const g = gridVals(ctx, mu, sd, 0, zMax);
      let x1, x2, P;
      do {
        x1 = pick(g); x2 = pick(g);
        P = 100 * (cdf(x2) - cdf(x1));
      } while (!(x2 - x1 >= 0.9 * sd && P >= 8 && P <= 92));
      return {
        q: `What percent of ${ctx.pl} ${ctx.btw(nf(ctx, x1), U(x2))}?`,
        parts: [areaPart(P)],
        hints: [
          desmosArea(raw(x1), raw(x2)),
          `Desmos shows about <b>${fmt(P / 100, 4)}</b>. Multiply by 100 to get a percent (2 decimals).`,
        ],
        sol: [
          `Desmos: ${eq(ND(mu, sd))}, cumulative probability from ${nf(ctx, x1)} to ${nf(ctx, x2)} → ${fmt(P / 100, 4)}`,
          `So about <b>${fmt(P, 2)}%</b> of ${ctx.pl} ${ctx.btw(nf(ctx, x1), U(x2))}.`,
        ],
        shade: [x1, x2], marks: [{ v: x1, label: nf(ctx, x1), solLabel: nf(ctx, x1) }, { v: x2, label: nf(ctx, x2), solLabel: nf(ctx, x2) }],
        meta: { q: kind, x1, x2 }, sig: `b${x1}-${x2}`,
      };
    }
    const unit = ctx.money ? 'dollars' : ctx.short;
    if (kind === 'percentile') {
      let k, v;
      do { k = pick(PCTILE_KS); v = mu + sd * invNorm(k / 100); } while (Math.abs((v - mu) / sd) > zMax);
      const p = trim(k / 100, 2);
      return {
        q: `Find the <b>${ord(k)} percentile</b> of ${ctx.measures || ctx.measure + 's'}. (Round to 2 decimal places.)`,
        parts: [{ kind: 'num', label: `${ord(k)} percentile =`, unit, answer: roundTo(v, 2), tol: xTol(sd) }],
        hints: [
          `The ${ord(k)} percentile has <b>${k}%</b> of the area to its <b>left</b>. In Desmos type ${eq(`${ND(mu, sd)}.inversecdf(${p})`)}.`,
          `Desmos gives about ${nf(ctx, v, sd < 1 ? 2 : 1)}. Round to 2 decimal places.`,
        ],
        sol: [
          `${k}% of the area is to the left, so use ${eq(`${ND(mu, sd)}.inversecdf(${p})`)}.`,
          `The ${ord(k)} percentile is about <b>${nu(ctx, nfx(ctx, v))}</b>.`,
        ],
        shade: [-Infinity, v], marks: [{ v, label: '?', solLabel: nfx(ctx, v) }], area: `${k}%`,
        meta: { q: kind, k }, sig: `p${k}`,
      };
    }
    // cutoff
    let dir, p, left, v;
    do {
      dir = chance(0.5) ? 'low' : 'high';
      p = pick(CUT_PS);
      left = dir === 'low' ? p : 100 - p;
      v = mu + sd * invNorm(left / 100);
    } while (Math.abs((v - mu) / sd) > (ctx.zMax ? ctx.zMax + 0.2 : 2.9));
    const ps = trim(left / 100, 2);
    return {
      q: `Complete the sentence (round to 2 decimal places): “${dir === 'low' ? ctx.cutLow(p) : ctx.cutHigh(p)}”`,
      parts: [{ kind: 'num', label: 'Cutoff =', unit, answer: roundTo(v, 2), tol: xTol(sd) }],
      hints: [
        dir === 'low'
          ? `The bottom ${p}% means ${p}% of the area is to the <b>left</b> of the cutoff. Type ${eq(`${ND(mu, sd)}.inversecdf(${ps})`)}.`
          : `The top ${p}% means ${100 - p}% of the area is to the <b>left</b> of the cutoff (inversecdf always uses the left side). Type ${eq(`${ND(mu, sd)}.inversecdf(${ps})`)}.`,
        `Desmos gives about ${nf(ctx, v, sd < 1 ? 2 : 1)}. Round to 2 decimal places.`,
      ],
      sol: [
        dir === 'low'
          ? `Bottom ${p}% → left area ${ps}: ${eq(`${ND(mu, sd)}.inversecdf(${ps})`)}`
          : `Top ${p}% → left area = 1 − ${trim(p / 100, 2)} = ${ps}: ${eq(`${ND(mu, sd)}.inversecdf(${ps})`)}`,
        `Cutoff ≈ <b>${nu(ctx, nfx(ctx, v))}</b>`,
      ],
      shade: dir === 'low' ? [-Infinity, v] : [v, Infinity], marks: [{ v, label: '?', solLabel: nfx(ctx, v) }], area: `${p}%`,
      meta: { q: kind, dir, p }, sig: `c${dir}${p}`,
    };
  }

  function normDiagram(ctx, mu, sd, sub, sol) {
    const ticks = [{ v: mu, label: nf(ctx, mu), prio: 1 }];
    (sub.marks || []).forEach((m) => ticks.push({ v: m.v, label: sol ? m.solLabel : m.label, prio: 3, fill: C.gold }));
    return normalSVG({
      mu, sigma: sd, ticks, shade: sub.shade, dashes: (sub.marks || []).map((m) => m.v),
      areaLabel: sub.area ? { text: sub.area } : null, caption: ctx.caption,
    });
  }

  function gen34(type, opts) {
    const N = pickNorm34(), ctx = N.ctx, mu = N.mu, sd = N.sd;
    const kinds = [type];
    if (opts.hard) {
      const others = TYPES['3.4'].filter((t) => t !== type);
      kinds.push(pick(others));
    }
    const subs = kinds.map((k) => norm34Sub(k, ctx, mu, sd));
    const h1 = `Sketch a Normal curve centered at μ = ${nf(ctx, mu)} with σ = ${nf(ctx, sd)}, and shade the region you want${subs.length > 1 ? ' (shown for part a)' : ''}:` +
      normDiagram(ctx, mu, sd, subs[0], false);
    return compose({
      section: '3.4', type, desmos: true,
      title: { less: 'Desmos: area to the left', greater: 'Desmos: area to the right', between: 'Desmos: area in between',
        percentile: 'Desmos: find the percentile', cutoff: 'Desmos: find the cutoff' }[type],
      top: `<p class="story">${ctx.story(nf(ctx, mu), nf(ctx, sd))}</p>`,
      subs, preHints: [h1],
      bottom: `<p class="small">Use Desmos in your other tab.${kinds.some((k) => ['less', 'greater', 'between'].indexOf(k) >= 0) ? ' Give percents to 2 decimal places.' : ''}</p>`,
      postSol: subs.map((s, i) => (subs.length > 1 ? `<b>(${LET[i]})</b> ` : '') + 'Shaded region:' + normDiagram(ctx, mu, sd, s, true)).slice(0, 1),
      meta: { mu, sigma: sd, parts: subs.map((s) => s.meta) },
      signature: `3.4|${type}|${ctx.key}|${mu}|${sd}|${subs.map((s) => s.sig).join('|')}`,
    });
  }

  // =====================================================================
  // 3.5 THE EMPIRICAL RULE
  // =====================================================================
  // percent of a Normal distribution below mu + k*sigma
  const CUM = { '-3': 0.15, '-2': 2.5, '-1': 16, '0': 50, '1': 84, '2': 97.5, '3': 99.85 };
  // percent between mu + k*sigma and mu + (k+1)*sigma
  const REG = { '-3': 2.35, '-2': 13.5, '-1': 34, '0': 34, '1': 13.5, '2': 2.35 };
  const sumTerms = (terms) => terms.reduce((s, t) => s + Math.round(t * 100), 0) / 100;
  function belowTerms(k) {
    const t = [];
    if (k > 0) { t.push(50); for (let j = 0; j < k; j++) t.push(REG[j]); }
    else { t.push(0.15); for (let j = -3; j < k; j++) t.push(REG[j]); }
    return t;
  }
  function aboveTerms(k) {
    const t = [];
    if (k < 0) { t.push(50); for (let j = -1; j >= k; j--) t.push(REG[j]); }
    else { t.push(0.15); for (let j = 2; j >= k; j--) t.push(REG[j]); }
    return t;
  }
  function betweenTerms(k1, k2) {
    const t = [];
    for (let j = k1; j < k2; j++) t.push(REG[j]);
    return t;
  }
  const termsStr = (t) => t.map((x) => trim(x, 2)).join(' + ');
  const kWords = (k) => (k === 0 ? 'the mean' : `${Math.abs(k)} SD${Math.abs(k) > 1 ? 's' : ''} ${k > 0 ? 'above' : 'below'} the mean`);

  function emp35Sub(kind, ctx, mu, sd) {
    const kMax = ctx.kMax || 3;
    const V = (k) => roundTo(mu + k * sd, 6);
    const f = (k) => nf(ctx, V(k));
    const U = (k) => nu(ctx, f(k));
    const locate = (k) => (k === 0 ? `${f(k)} is the <b>mean</b>.` : `${f(k)} = ${nf(ctx, mu)} ${k < 0 ? '−' : '+'} ${Math.abs(k) === 1 ? '' : Math.abs(k) + ' × '}${nf(ctx, sd)}, which is <b>${kWords(k)}</b>.`);
    const prop = chance(0.35);
    const what = prop ? 'What proportion' : 'What percent';
    const pLabel = prop ? 'Proportion (as a percent) =' : 'Percent =';
    const pctPart = (P) => ({ kind: 'num', label: pLabel, unit: '%', answer: P, tol: 0.05, placeholder: 'e.g. 13.5' });
    const ks = [];
    for (let k = -kMax; k <= kMax; k++) if (k !== 0) ks.push(k);
    if (kind === 'below' || kind === 'above') {
      const k = pick(ks);
      const isBelow = kind === 'below';
      const terms = isBelow ? belowTerms(k) : aboveTerms(k);
      const P = sumTerms(terms);
      return {
        q: `${what} of ${ctx.pl} ${isBelow ? ctx.lt(U(k)) : ctx.gt(U(k))}?`,
        parts: [pctPart(P)],
        locate: `Find ${f(k)} on the curve: ${locate(k)}`,
        add: terms.length === 1
          ? `Only the tiny tail piece beyond 3 SDs is ${isBelow ? 'to the left' : 'to the right'} of ${f(k)}. How big is that piece?`
          : `Add the pieces ${isBelow ? 'to the <b>left</b>' : 'to the <b>right</b>'} of ${f(k)}: ${eq(termsStr(terms) + ' = ?')}`,
        sol: [
          `${locate(k)}`,
          terms.length === 1
            ? `Only the tail beyond 3 SDs is ${isBelow ? 'below' : 'above'} it: <b>0.15%</b>`
            : `Area ${isBelow ? 'below' : 'above'} it: ${eq(termsStr(terms))} = <b>${trim(P, 2)}%</b>`,
        ],
        shade: isBelow ? [-Infinity, V(k)] : [V(k), Infinity],
        meta: { q: kind, k }, sig: `${kind}${k}`,
      };
    }
    if (kind === 'between') {
      let k1, k2;
      do { k1 = int(-kMax, kMax); k2 = int(-kMax, kMax); } while (!(k2 > k1) || (k2 - k1 === 1 && chance(0.6)));
      const terms = betweenTerms(k1, k2);
      const P = sumTerms(terms);
      return {
        q: `${what} of ${ctx.pl} ${ctx.btw(f(k1), U(k2))}?`,
        parts: [pctPart(P)],
        locate: `${locate(k1)}<br>${locate(k2)}`,
        add: `Add the pieces between ${f(k1)} and ${f(k2)}: ${eq(termsStr(terms) + ' = ?')}`,
        sol: [
          `${locate(k1)} ${locate(k2)}`,
          `Area between: ${eq(termsStr(terms))} = <b>${trim(P, 2)}%</b>`,
        ],
        shade: [V(k1), V(k2)],
        meta: { q: kind, k1, k2 }, sig: `btw${k1}${k2}`,
      };
    }
    const unit = ctx.money ? 'dollars' : ctx.short;
    if (kind === 'valueAtPct') {
      const k = pick(ks);
      const pct = CUM[k];
      return {
        q: `Estimate the ${ctx.measure} at the <b>${ord(pct)} percentile</b> of the distribution.`,
        parts: [{ kind: 'num', label: `${cap(ctx.measure)} =`, unit, answer: V(k), tol: Math.max(1e-6, 0.01 * sd) }],
        locate: `The ${ord(pct)} percentile has <b>${trim(pct, 2)}%</b> of the data below it. Which tick mark has exactly that much area to its left?`,
        add: `Area to the left of each tick, from μ − 3σ up to μ + 3σ: 0.15%, 2.5%, 16%, 50%, 84%, 97.5%, 99.85%.`,
        sol: [
          belowTerms(k).length === 1
            ? `Only the 0.15% tail is to the left of μ − 3σ.`
            : `Area to the left of μ ${k < 0 ? '−' : '+'} ${Math.abs(k) === 1 ? '' : Math.abs(k)}σ is ${eq(`${termsStr(belowTerms(k))} = ${trim(pct, 2)}%`)}.`,
          `So the ${ord(pct)} percentile is ${kWords(k)}: ${eq(`${nf(ctx, mu)} ${k < 0 ? '−' : '+'} ${Math.abs(k) === 1 ? '' : Math.abs(k) + ' × '}${nf(ctx, sd)}`)} = <b>${U(k)}</b>`,
        ],
        shade: [-Infinity, V(k)],
        meta: { q: kind, k }, sig: `v${k}`,
      };
    }
    // kSD: two parts
    const k = pick(ks);
    const isBelow = chance(0.5);
    const terms = isBelow ? belowTerms(k) : aboveTerms(k);
    const P = sumTerms(terms);
    const that = ctx.that || 'that';
    return {
      q: `What ${ctx.measure} is <b>${Math.abs(k)} standard deviation${Math.abs(k) > 1 ? 's' : ''} ${k > 0 ? 'above' : 'below'}</b> the mean? Then: ${what.toLowerCase()} of ${ctx.pl} ${isBelow ? ctx.lt(that) : ctx.gt(that)}?`,
      parts: [
        { kind: 'num', label: `${cap(ctx.measure)} =`, unit, answer: V(k), tol: Math.max(1e-6, 0.01 * sd) },
        pctPart(P),
      ],
      locate: `${k > 0 ? 'Add' : 'Subtract'} ${Math.abs(k)} SD${Math.abs(k) > 1 ? 's' : ''}: ${eq(`${nf(ctx, mu)} ${k < 0 ? '−' : '+'} ${Math.abs(k)} × ${nf(ctx, sd)}`)}.`,
      add: `That value is the μ ${k < 0 ? '−' : '+'} ${Math.abs(k) === 1 ? '' : Math.abs(k)}σ tick. ` + (terms.length === 1
        ? `Only the tiny tail beyond 3 SDs is ${isBelow ? 'to its left' : 'to its right'}.`
        : `Add the pieces ${isBelow ? 'to its <b>left</b>' : 'to its <b>right</b>'}: ${eq(termsStr(terms) + ' = ?')}`),
      sol: [
        `${eq(`${nf(ctx, mu)} ${k < 0 ? '−' : '+'} ${Math.abs(k)} × ${nf(ctx, sd)}`)} = <b>${U(k)}</b>`,
        terms.length === 1
          ? `Only the tail beyond 3 SDs is ${isBelow ? 'below' : 'above'} ${f(k)}: <b>0.15%</b>`
          : `Area ${isBelow ? 'below' : 'above'} ${f(k)}: ${eq(termsStr(terms))} = <b>${trim(P, 2)}%</b>`,
      ],
      shade: isBelow ? [-Infinity, V(k)] : [V(k), Infinity],
      meta2: [{ q: 'kValue', k }, { q: isBelow ? 'below' : 'above', k }], sig: `k${k}${isBelow}`,
    };
  }

  function gen35(type, opts) {
    const ctx = pick(NORM_CTX);
    const ms = pick(ctx.p35), mu = ms[0], sd = ms[1];
    const kMax = ctx.kMax || 3;
    const ticks = [];
    for (let k = -kMax; k <= kMax; k++) ticks.push({ v: mu + k * sd, label: nf(ctx, roundTo(mu + k * sd, 6)), prio: 2 - Math.abs(k) * 0.1 });
    const svg = (extra) => normalSVG(Object.assign({ mu, sigma: sd, ticks, caption: ctx.caption }, extra || {}));
    const kinds = [type];
    if (opts.hard) {
      const others = TYPES['3.5'].filter((t) => t !== type && t !== 'kSD');
      kinds.push(pick(others));
    }
    const subs = kinds.map((k) => emp35Sub(k, ctx, mu, sd));
    const subsC = subs.map((s) => ({ q: s.q, parts: s.parts, hints: [s.locate, s.add], sol: s.sol }));
    const regionHint = `The 68–95–99.7 rule splits the curve into these pieces (they add up to 100%):${svg({ regions: true })}`;
    const metaParts = [];
    subs.forEach((s) => { if (s.meta2) metaParts.push.apply(metaParts, s.meta2); else metaParts.push(s.meta); });
    const p = compose({
      section: '3.5', type,
      title: { below: 'Empirical rule: below', above: 'Empirical rule: above', between: 'Empirical rule: in between',
        valueAtPct: 'Empirical rule: percentile', kSD: 'Standard deviation steps' }[type],
      top: `<p class="story">${ctx.story(nf(ctx, mu), nf(ctx, sd))}</p>${svg()}`,
      subs: subsC,
      bottom: `<p class="small">Use the empirical rule (68–95–99.7).${kinds.some((k) => k !== 'valueAtPct') ? ' Answer as a percent.' : ''}</p>`,
      postSol: [`Shaded region${subs.length > 1 ? ' for part (a)' : ''}:${svg({ shade: subs[0].shade, regions: true })}`],
      meta: { mu, sigma: sd, kMax, parts: metaParts },
      signature: `3.5|${type}|${ctx.key}|${mu}|${sd}|${subs.map((s) => s.sig).join('|')}`,
    });
    // hints: [locate, regions picture, add-up]
    p.hints = [p.hints[0], regionHint, p.hints[1]];
    return p;
  }

  // =====================================================================
  // registry + public API
  // =====================================================================
  const SECTIONS = ['3.1', '3.2', '3.3', '3.4', '3.5'];
  const SECTION_INFO = {
    '3.1': { name: 'Percentiles', icon: '📊', color: '#ff9f5a' },
    '3.2': { name: 'Uniform Distributions', icon: '🎲', color: '#4fe3d6' },
    '3.3': { name: 'z-Scores', icon: '🎯', color: '#c792ff' },
    '3.4': { name: 'Normal Distributions (Desmos)', icon: '💻', color: '#7cf27f' },
    '3.5': { name: 'The Empirical Rule', icon: '🔔', color: '#ffd23f' },
  };
  const TYPES = {
    '3.1': ['pctOfValue', 'valueAtPct', 'dotplot', 'dotplotValue', 'interpret'],
    '3.2': ['height', 'less', 'greater', 'between', 'percentile', 'mean'],
    '3.3': ['single', 'compare', 'rank', 'unusual', 'findX'],
    '3.4': ['less', 'greater', 'between', 'percentile', 'cutoff'],
    '3.5': ['below', 'above', 'between', 'valueAtPct', 'kSD'],
  };
  // relative weights when the type is not forced
  const WEIGHTS = {
    '3.1': { pctOfValue: 3, valueAtPct: 3, dotplot: 2, dotplotValue: 2, interpret: 2 },
    '3.2': { height: 1, less: 2, greater: 2, between: 2, percentile: 2, mean: 1 },
    '3.3': { single: 2, compare: 3, rank: 2, unusual: 2, findX: 2 },
    '3.4': { less: 2, greater: 2, between: 2, percentile: 2, cutoff: 2 },
    '3.5': { below: 2, above: 2, between: 2, valueAtPct: 2, kSD: 1 },
  };
  // types used for boss shields (they get an extra part when opts.hard)
  const HARD_TYPES = {
    '3.1': ['pctOfValue', 'valueAtPct', 'dotplot', 'dotplotValue'],
    '3.2': ['less', 'greater', 'between', 'percentile', 'height'],
    '3.3': ['compare', 'rank', 'unusual', 'single'],
    '3.4': ['less', 'greater', 'between', 'percentile', 'cutoff'],
    '3.5': ['below', 'above', 'between', 'valueAtPct', 'kSD'],
  };
  const GEN = { '3.1': gen31, '3.2': gen32, '3.3': gen33, '3.4': gen34, '3.5': gen35 };

  function pickType(section, hard) {
    const pool = hard ? HARD_TYPES[section] : TYPES[section];
    const w = pool.map((t) => WEIGHTS[section][t] || 1);
    let r = rnd() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) {
      r -= w[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function generate(section, opts) {
    opts = opts || {};
    section = String(section);
    if (!GEN[section]) throw new Error('Unknown section: ' + section);
    if (opts.type && TYPES[section].indexOf(opts.type) < 0) throw new Error(`Unknown type ${opts.type} for section ${section}`);
    const avoid = new Set(opts.avoid || []);
    let p = null;
    for (let tries = 0; tries < 30; tries++) {
      const type = opts.type || pickType(section, !!opts.hard);
      p = GEN[section](type, { hard: !!opts.hard });
      if (!avoid.has(p.signature)) break;
    }
    return p;
  }

  const API = {
    SECTIONS, SECTION_INFO, TYPES, generate, check, normalCdf, invNorm,
    parseNum,
    _internal: { CUM, REG, belowTerms, aboveTerms, betweenTerms, sumTerms, countBelow, roundTo, fmt, trim, ord, normalSVG, uniformSVG, dotplotSVG, NORM_CTX },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Problems = API;
})(typeof window !== 'undefined' ? window : globalThis);
