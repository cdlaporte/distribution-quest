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
 *   parts:    ALWAYS exactly one part:
 *             [{ kind:'num', label, answer, tol, unit, placeholder } | { kind:'choice', label, options, correct }],
 *   hints:    [html, ...]   (progressive, last one nearly gives it away)
 *   solution: [html, ...]   (worked steps, final answers in <b>)
 *   desmos, signature, _meta (hidden data used by the tests)
 * }
 * opts: { type, hard, avoid: [signature, ...] }   hard → picks from the harder calculation types (still 1 part)
 * check(part, raw) -> boolean
 *
 * Tolerances (the teacher accepts rounding up or down): percents |x − exact| < 1, z-scores ±0.051,
 * x-values: whole numbers when σ (or b − a) is big enough, else 1 or 2 decimals (normTol / uniTol).
 *
 * Diagrams are inline SVG strings (no external refs), max 540 x 200, colors for a dark background.
 * Picture choices (shadeArea, shade35, uniInterp) are 150 x 70 inline SVGs with explicit width/height.
 * HTML uses only the classes: story, data, big, eq, hl, small, good, bad (plus plain table/th/td).
 * CATEGORY[section][type] is 'calc' or 'interp'; WEIGHTS keep random picks about 60/40.
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

  // ---- tolerances (teacher: rounding up OR down is fine) ----
  const PCT_TOL = 0.999; // every percent answer: |x − exact| < 1  (58.33 → 58, 59, 58.3 all pass)
  const Z_TOL = 0.051; // z-scores: 2-decimal or 1-decimal rounding of the exact value
  // x-values from a Normal model: whole numbers are fine when σ ≥ 2.5, else 1 or 2 decimals
  function normTol(v, sd) {
    if (Math.abs(v) >= 10 && sd >= 2.5) return 0.999;
    if (sd >= 0.4) return 0.051;
    return 0.006;
  }
  // x-values from U(a, b) (w = b − a)
  function uniTol(v, w) {
    if (Math.abs(v) >= 10 && w >= 5) return 0.999;
    return roundTo(Math.max(0.051, 0.01 * w), 4);
  }
  // no listed wrong answer — nor a student's rounding of it — can land inside the tolerance
  const clearOf = (ans, tol, wrongs) => wrongs.every((w) => !Number.isFinite(w) || Math.abs(w - ans) >= 2 * tol + 0.002);

  // =====================================================================
  // SVG helpers (dark background)
  // =====================================================================
  const C = {
    axis: '#e8e4ff', muted: '#b9b3e6', curve: '#9fd3ff', fill: 'rgba(159,211,255,0.12)',
    shade: 'rgba(255,210,63,0.55)', red: '#ff5c5c', dot: '#9fd3ff', bg: '#151228', gold: '#ffd23f',
    shadeOpt: 'rgba(255,210,63,0.6)',
  };
  const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
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

  // ---------------------------------------------------------------------
  // Small answer-choice pictures (150 × 70). A "spec" describes the shading:
  //   { t:'L', a }  left of a      { t:'R', a }  right of a
  //   { t:'B', a, b } between       { t:'O', a, b } outside (both tails)
  // ---------------------------------------------------------------------
  const MINI = { W: 150, H: 70, X0: 5, X1: 145, baseY: 48, topY: 5, span: 3.1, labelY: 63, font: 12 };
  const specCuts = (sp) => (sp.t === 'L' || sp.t === 'R' ? [sp.a] : [sp.a, sp.b]);
  function specRegions(sp, lo, hi) {
    if (sp.t === 'L') return [[lo, sp.a]];
    if (sp.t === 'R') return [[sp.a, hi]];
    if (sp.t === 'B') return [[sp.a, sp.b]];
    return [[lo, sp.a], [sp.b, hi]];
  }
  const specKey = (sp) => `${sp.t}|${specCuts(sp).map((v) => roundTo(v, 6)).join('|')}`;
  // label boxes [left, right] for the cut values of a picture, or null if they overlap / leave the picture
  function miniLabelBoxes(X, cuts, texts) {
    const boxes = cuts.map((v, i) => {
      const w = textW(texts[i], MINI.font);
      return [X(v) - w / 2, X(v) + w / 2];
    }).sort((p, q) => p[0] - q[0]);
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i][0] < 1 || boxes[i][1] > MINI.W - 1) return null;
      if (i && boxes[i][0] < boxes[i - 1][1] + 4) return null;
    }
    return boxes;
  }
  function miniFrame(kind, extra) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${MINI.W}" height="${MINI.H}" viewBox="0 0 ${MINI.W} ${MINI.H}" ` +
      `font-family="${FONT}" role="img" aria-label="${kind}"${extra || ''}>`;
  }
  // o: { mu, sd, spec, fmt(v) -> label }   returns null when the labels would not fit
  function miniNormalSVG(o) {
    const { W, X0, X1, baseY, topY, span } = MINI;
    const xmin = o.mu - span * o.sd, xmax = o.mu + span * o.sd;
    const X = (v) => X0 + ((v - xmin) / (xmax - xmin)) * (X1 - X0);
    const Y = (v) => baseY - (baseY - topY) * Math.exp(-0.5 * Math.pow((v - o.mu) / o.sd, 2));
    const cuts = specCuts(o.spec), texts = cuts.map(o.fmt);
    if (cuts.some((v) => v <= xmin || v >= xmax) || !miniLabelBoxes(X, cuts, texts)) return null;
    let s = miniFrame('Normal curve with a shaded region');
    specRegions(o.spec, xmin, xmax).forEach(([lo, hi]) => {
      let d = `M${r1(X(lo))} ${baseY}`;
      for (let i = 0; i <= 40; i++) {
        const v = lo + (hi - lo) * i / 40;
        d += ` L${r1(X(v))} ${r1(Y(v))}`;
      }
      s += `<path d="${d} L${r1(X(hi))} ${baseY} Z" fill="${C.shadeOpt}" stroke="none"/>`;
    });
    let d = '';
    for (let i = 0; i <= 60; i++) {
      const v = xmin + (xmax - xmin) * i / 60;
      d += (i ? ' L' : 'M') + r1(X(v)) + ' ' + r1(Y(v));
    }
    s += `<path d="${d}" fill="none" stroke="${C.curve}" stroke-width="2"/>`;
    s += L(X0, baseY, X1, baseY, C.axis, 1.2);
    cuts.forEach((v, i) => {
      s += L(X(v), baseY + 4, X(v), Y(v), C.axis, 1, ' stroke-dasharray="3 2"');
      s += T(X(v), MINI.labelY, texts[i], { size: MINI.font });
    });
    return s + '</svg>';
  }
  // o: { a, b, spec, fmt }  uniform density rectangle with shading
  function miniUniformSVG(o) {
    const { X0, X1, baseY } = MINI;
    const w = o.b - o.a, dmin = o.a - 0.12 * w, dmax = o.b + 0.12 * w, topY = 14;
    const X = (v) => X0 + ((v - dmin) / (dmax - dmin)) * (X1 - X0);
    const cuts = specCuts(o.spec), texts = cuts.map(o.fmt);
    if (!miniLabelBoxes(X, cuts, texts)) return null;
    let s = miniFrame('Uniform density curve with a shaded region');
    specRegions(o.spec, o.a, o.b).forEach(([lo, hi]) => {
      s += `<rect x="${r1(X(lo))}" y="${topY}" width="${r1(X(hi) - X(lo))}" height="${baseY - topY}" fill="${C.shadeOpt}" stroke="none"/>`;
    });
    s += `<rect x="${r1(X(o.a))}" y="${topY}" width="${r1(X(o.b) - X(o.a))}" height="${baseY - topY}" fill="none" stroke="${C.curve}" stroke-width="2"/>`;
    s += L(X0, baseY, X1, baseY, C.axis, 1.2);
    cuts.forEach((v, i) => {
      s += L(X(v), baseY + 4, X(v), topY, C.axis, 1, ' stroke-dasharray="3 2"');
      s += T(X(v), MINI.labelY, texts[i], { size: MINI.font });
    });
    return s + '</svg>';
  }
  // Build 4 picture options from specs (first = correct). Returns null if any picture fails / duplicates.
  function pictureOptions(specs, draw) {
    const svgs = specs.map(draw);
    if (svgs.some((x) => !x)) return null;
    if (new Set(specs.map(specKey)).size !== specs.length) return null;
    const order = shuffle(specs.map((_, i) => i));
    return { options: order.map((i) => svgs[i]), specs: order.map((i) => specs[i]), correct: order.indexOf(0) };
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
  /**
   * Single multiple-choice problem.
   * o: { section, type, title, top, q, label, right, wrong:[...] | (options+correct), hints, sol, meta (one meta part), signature, postSol }
   */
  function choiceProblem(o) {
    let options = o.options, correct = o.correct;
    if (!options) {
      options = shuffle([o.right].concat(o.wrong));
      correct = options.indexOf(o.right);
    }
    if (o.keepOrder) { options = [o.right].concat(o.wrong); correct = 0; }
    return compose({
      section: o.section, type: o.type, title: o.title, top: o.top,
      subs: [{ q: o.q, parts: [{ kind: 'choice', label: o.label || 'Choose one:', options, correct }], hints: o.hints, sol: o.sol }],
      postSol: o.postSol, meta: Object.assign({}, o.metaTop || {}, { parts: [o.meta] }), signature: o.signature,
    });
  }
  const distinctAll = (arr) => new Set(arr).size === arr.length;

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
    // o: { q, vf, c, n, label, solCount (html), countHint }
    const pct = 100 * o.c / o.n;
    const lo = Math.floor(pct + 1e-9), whole = Math.abs(pct - Math.round(pct)) < 1e-9;
    return {
      q: o.q,
      parts: [{ kind: 'num', label: o.label, unit: 'th percentile', answer: roundTo(pct, 4), tol: PCT_TOL, placeholder: 'e.g. 40' }],
      hints: [
        `A value’s <b>percentile</b> is the percent of the data that is <b>strictly less than</b> it. Don’t count ${o.vf} itself (or anything tied with it).`,
        `${o.countHint} There are <b>${o.n}</b> values in all.`,
        `There are <b>${o.c}</b> values below ${o.vf}. Compute ${eq(`${o.c} ÷ ${o.n} × 100`)}${whole ? '' : ' and round down to a whole number'}.`,
      ],
      sol: [
        o.solCount,
        `${eq(`${o.c} ÷ ${o.n} ${eqSign(o.c / o.n, 4)} ${trim(o.c / o.n, 4)}`)} → ${trim(pct, 2)}%`,
        whole
          ? `${o.vf} is at the <b>${ord(lo)} percentile</b>: ${lo}% of the data values are less than ${o.vf}.`
          : `${o.vf} is at about the <b>${ord(lo)} percentile</b> (rounding down; ${ord(lo + 1)} is fine too): about ${trim(pct, 1)}% of the data values are less than ${o.vf}.`,
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

  function gen31list(type) {
    for (;;) {
      const ctx = pick(LIST_CTX), n = int(10, 20), data = listData(ctx, n);
      const cands = uniqueIdx(data, 2, n - 2);
      if (cands.length < 3) continue;
      const fv = (v) => fmt(v, ctx.dec);
      const dataHTML = `<div class="data">${data.map(fv).join(', ')}</div>`;
      const i = pick(cands), v = data[i], vf = fv(v);
      let sub, mp;
      if (type === 'pctOfValue') {
        sub = pctSub({
          q: `Find the percentile for ${ctx.about(vf)}.`, vf, c: i, n, label: `${vf} is at the`,
          countHint: `Count how many values in the list are less than ${vf}.`,
          solCount: `Values below ${vf}: ${listHL(data, ctx.dec, i, i)} → <b>${i}</b> of the ${n} values.`,
        });
        mp = { q: 'pct', value: v };
      } else {
        const k = Math.round(100 * i / n);
        sub = valSub({
          q: `Which ${ctx.word} is at the <b>${ord(k)} percentile</b>?`, k, n, j: i, v, vf,
          label: `${cap(ctx.word)} =`, unit: ctx.unit,
          countHint: `Count ${i} values in from the smallest. The answer is the <b>next</b> value (value #${i + 1} in order).`,
          solFind: `${listHL(data, ctx.dec, i, i)} → the value with exactly ${i} values below it is <b>${vf}</b>.`,
        });
        mp = { q: 'val', k };
      }
      return compose({
        section: '3.1', type,
        title: type === 'pctOfValue' ? 'Find the percentile' : 'Value at a percentile',
        top: `<p class="story">${ctx.intro(n)}</p>${dataHTML}`,
        subs: [sub], meta: { data, parts: [mp] },
        signature: `3.1|${type}|${ctx.key}|${data.join(',')}|${i}`,
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

  function gen31dot(type) {
    for (;;) {
      const ctx = pick(DOT_CTX);
      const D = dotData(ctx);
      const { data, n } = D;
      const ex = ctx.extra ? ctx.extra() : [];
      const nm = pick(NAMES);
      const okVals = distinctVals(data).filter((v) => {
        const c = countBelow(data, v);
        return c >= 2 && c <= n - 2;
      });
      if (okVals.length < 3) continue;
      const v = pick(okVals), c = countBelow(data, v), vf = trim(v, 2);
      let sub, mp;
      if (type === 'dotplot') {
        sub = pctSub({
          q: ctx.redQ(nm, vf, ex), vf, c, n, label: 'The red dot is at the',
          countHint: `Count the dots to the <b>left</b> of the red dot’s stack (smaller values only).`,
          solCount: `Dots to the left of ${vf}: <span class="small">${belowBreakdown(data, v)}</span> → <b>${c}</b> of the ${n} dots.`,
        });
        mp = { q: 'pct', value: v };
      } else {
        const k = Math.round(100 * c / n);
        sub = valSub({
          q: ctx.valQ(nm, k, ex), k, n, j: c, v, vf, label: ctx.label, unit: ctx.unit,
          countHint: `Count ${c} dots in from the left (smallest values first). The <b>next</b> dot’s value is the answer.`,
          solFind: `Counting from the left: <span class="small">${belowBreakdown(data, v)}</span> → that is ${c} dots, so the next value, <b>${vf}</b>, has exactly ${c} values below it.`,
        });
        mp = { q: 'val', k };
      }
      const isPct = type === 'dotplot';
      const svg = dotplotSVG({ data, step: ctx.step, lo: D.lo, hi: D.hi, highlight: isPct ? v : null, caption: ctx.caption });
      return compose({
        section: '3.1', type,
        title: isPct ? 'Read the dotplot' : 'Dotplot detective',
        top: `<p class="story">${ctx.story(n)}</p>${svg}`,
        subs: [sub], meta: { data, parts: [mp] },
        postSol: isPct ? null : [`The ${ord(mp.k)}-percentile value, marked in red:${dotplotSVG({ data, step: ctx.step, lo: D.lo, hi: D.hi, highlight: v, caption: ctx.caption })}`],
        signature: `3.1|${type}|${ctx.key}|${data.join(',')}|${v}`,
      });
    }
  }

  // --- interpretation ---
  const INTERP = [
    (k) => {
      const nm = pick(NAMES), v = clamp(Math.round(52 + 0.42 * k + unif(-3, 3)), 40, 99);
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
      const nm = pick(NAMES), mm = Math.round(19 + 0.13 * k + unif(-1, 1)), ss = int(0, 59);
      const t = `${mm}:${String(ss).padStart(2, '0')}`;
      return {
        story: `${nm} ran a 5K race in ${t}. That time is at the ${hl(ord(k) + ' percentile')} of all finishing times in the race.`,
        correct: `${k}% of the runners finished in less time than ${nm}.`,
        wrong: [`${nm} finished ahead of ${k}% of the runners.`, `${100 - k}% of the runners finished in less time than ${nm}.`,
          `${nm} ran ${k}% faster than the average runner.`],
      };
    },
    (k) => {
      const sal = pick(SALADS), v = clamp(Math.round((120 + 3.6 * k + unif(-20, 20)) / 10) * 10, 80, 520);
      return {
        story: `The ${sal} Salad has ${v} calories, which is at the ${hl(ord(k) + ' percentile')} of calorie counts for the salads on the menu.`,
        correct: `${k}% of the salads on the menu have fewer calories than the ${sal} Salad.`,
        wrong: [`${k}% of the salads on the menu have more calories than the ${sal} Salad.`,
          `The ${sal} Salad has ${k}% of the calories of an average salad.`,
          `${100 - k}% of the salads on the menu have fewer calories than the ${sal} Salad.`],
      };
    },
    (k) => {
      const nm = pick(NAMES), v = Math.round(24 + 0.5 * k + unif(-3, 3));
      return {
        story: `${nm} types ${v} words per minute, which is at the ${hl(ord(k) + ' percentile')} for students in keyboarding class.`,
        correct: `${k}% of the students in the class type slower than ${v} words per minute.`,
        wrong: [`${k}% of the students in the class type faster than ${v} words per minute.`,
          `${nm} types ${k}% faster than the average student.`, `${nm} typed ${k}% of the words correctly.`],
      };
    },
    (k) => {
      const nm = pick(NAMES), v = Math.max(1, Math.round(2 + k / 9 + unif(-1, 1)));
      return {
        story: `Sir ${nm} brought back ${v} dragon eggs from the quest, which is at the ${hl(ord(k) + ' percentile')} among the knights of the guild.`,
        correct: `${k}% of the knights brought back fewer than ${v} eggs.`,
        wrong: [`${k}% of the knights brought back more than ${v} eggs.`, `Sir ${nm} brought back ${k}% of all the eggs.`,
          `${100 - k}% of the knights brought back fewer than ${v} eggs.`],
      };
    },
    (k) => {
      const nm = pick(NAMES), v = trim(Math.max(1, Math.round(2 + k / 11 + unif(-1, 1))) / 1, 1);
      return {
        story: `${nm} averages ${v} hours of screen time per day. That is at the ${hl(ord(k) + ' percentile')} for students in ${nm}’s grade.`,
        correct: `${k}% of students in the grade have less daily screen time than ${nm}.`,
        wrong: [`${k}% of students in the grade have more daily screen time than ${nm}.`, `${nm} spends ${k}% of the day looking at screens.`,
          `${100 - k}% of students in the grade have less daily screen time than ${nm}.`],
      };
    },
    (k) => {
      const nm = pick(NAMES), v = Math.round(200 + 7 * k + unif(-40, 40));
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

  // --- percent correct vs. percentile ---
  const TESTS = ['chemistry test', 'history test', 'math final', 'Spanish quiz', 'biology test', 'spell-casting exam', 'potions quiz'];
  function gen31pctVsPercent() {
    for (;;) {
      if (chance(0.6)) {
        const nm = pick(NAMES), test = pick(TESTS), pc = int(55, 97), k = int(10, 94);
        if (Math.min(Math.abs(pc - k), Math.abs(pc - (100 - k)), Math.abs(k - (100 - k))) < 6) continue;
        const right = `${k}% of the class scored lower than ${nm}.`;
        return choiceProblem({
          section: '3.1', type: 'pctVsPercent', title: 'Percent vs. percentile',
          top: `<p class="story">${nm} answered ${hl(pc + '%')} of the questions on a ${test} correctly. That score put ${nm} at the ${hl(ord(k) + ' percentile')} of the class.</p>`,
          q: 'Which statement is correct?',
          right,
          wrong: [`${pc}% of the class scored lower than ${nm}.`, `${nm} answered ${k}% of the questions correctly.`, `${100 - k}% of the class scored lower than ${nm}.`],
          hints: [
            'Percent correct and percentile are different. <b>Percent correct</b> compares you to the test: how many questions you got right.',
            'A <b>percentile</b> compares you to the other students: the percent of students who scored <b>lower</b> than you.',
            `${nm} is at the ${ord(k)} percentile, so ${k}% of the class scored lower.`,
          ],
          sol: [
            `${pc}% is ${nm}’s percent correct. It only tells how many questions ${nm} got right.`,
            `The ${ord(k)} percentile means ${k}% of the class scored lower than ${nm}.`,
            `Correct: <b>${right}</b>`,
          ],
          meta: { q: 'pctVsPercent', k, pc },
          signature: `3.1|pctVsPercent|A|${nm}|${pc}|${k}`,
        });
      }
      // two students, two different classes: higher percent correct does not mean higher percentile
      const nm = names(2), t = shuffle(TESTS).slice(0, 2);
      const pc = [int(80, 97), 0], k = [int(25, 72), 0];
      pc[1] = int(58, pc[0] - 7);
      k[1] = int(k[0] + 12, 95);
      if (chance(0.2)) { const tmp = k[0]; k[0] = k[1]; k[1] = tmp; } // sometimes the raw percent agrees
      const P = shuffle([0, 1]).map((i, j) => ({ n: nm[j], pc: pc[i], k: k[i], t: t[j] }));
      const best = P[0].k > P[1].k ? 0 : 1;
      const options = [P[0].n, P[1].n, 'They did equally well compared with their classes.'];
      return choiceProblem({
        section: '3.1', type: 'pctVsPercent', title: 'Percent vs. percentile',
        top: `<p class="story">${P[0].n} got ${P[0].pc}% correct on a ${P[0].t}. That is at the ${hl(ord(P[0].k) + ' percentile')} of ${P[0].n}’s class.</p>` +
          `<p class="story">${P[1].n} got ${P[1].pc}% correct on a ${P[1].t}. That is at the ${hl(ord(P[1].k) + ' percentile')} of ${P[1].n}’s class.</p>`,
        q: 'Who scored higher than a larger percent of their own class?',
        options, correct: best,
        hints: [
          'Percent correct tells how many questions someone got right. It does <b>not</b> compare them with their class.',
          'A percentile is the percent of the class that scored <b>lower</b>. Compare the percentiles, not the percents correct.',
          `${P[0].n}: ${P[0].k}% of the class scored lower. ${P[1].n}: ${P[1].k}% of the class scored lower.`,
        ],
        sol: [
          `${P[0].n} beat ${P[0].k}% of their class; ${P[1].n} beat ${P[1].k}% of theirs.`,
          `So <b>${P[best].n}</b> scored higher than a larger percent of their class${P[best].pc < P[1 - best].pc ? `, even with a lower percent correct (${P[best].pc}% vs. ${P[1 - best].pc}%)` : ''}.`,
        ],
        meta: { q: 'pctWho', ks: [P[0].k, P[1].k] },
        signature: `3.1|pctVsPercent|B|${P.map((x) => x.n + x.pc + '/' + x.k).join('|')}`,
      });
    }
  }

  // --- who is at the higher percentile in their own group? (two small data sets) ---
  const TWO_CTX = [
    { ctx: 'test', groups: ['Period 2', 'Period 3', 'Period 5', 'Period 6'], did: (nm, v, g) => `${nm} scored ${v} on the test in ${g}` },
    { ctx: 'quiz', groups: ['Period 1', 'Period 4', 'Period 5', 'Period 7'], did: (nm, v, g) => `${nm} scored ${v} on the quiz in ${g}` },
    { ctx: 'shotput', groups: ['1st-period gym', '4th-period gym', '6th-period gym'], did: (nm, v, g) => `${nm} threw ${v} feet in ${g}` },
    { ctx: 'jump', groups: ['the Tigers', 'the Hawks', 'the Wolves'], did: (nm, v, g) => `${nm} jumped ${v} meters for ${g}` },
    { ctx: 'coins', groups: ['the Iron Guild', 'the Frost Guild', 'the Ember Guild'], did: (nm, v, g) => `${nm} found ${v} coins with ${g}` },
    { ctx: 'plants', groups: ['Garden A', 'Garden B', 'Garden C'], did: (nm, v, g) => `${nm}’s bean plant grew to ${v} cm in ${g}` },
  ];
  function gen31higherPct() {
    for (let tries = 0; ; tries++) {
      const T = pick(TWO_CTX), ctx = LIST_CTX.find((c) => c.key === T.ctx);
      const gs = shuffle(T.groups).slice(0, 2), nm = names(2);
      const fv = (v) => fmt(v, ctx.dec);
      const P = [0, 1].map(() => {
        const n = int(8, 12), data = listData(ctx, n);
        const cands = uniqueIdx(data, 1, n - 2);
        const i = cands.length ? pick(cands) : -1;
        return { n, data, i, x: data[i], pct: 100 * i / n };
      });
      if (P.some((q) => q.i < 0) || Math.abs(P[0].pct - P[1].pct) < 8) continue;
      if (P[0].x === P[1].x) continue;
      const best = P[0].pct > P[1].pct ? 0 : 1;
      const rawBest = P[0].x > P[1].x ? 0 : 1;
      if (tries < 40 && rawBest === best && chance(0.7)) continue; // usually the bigger raw value is NOT the higher percentile
      const line = (q, g) => `<b>${g}:</b> ${q.data.map((v, j) => (j === q.i ? `<b>[${fv(v)}]</b>` : fv(v))).join(', ')}`;
      return choiceProblem({
        section: '3.1', type: 'higherPct', title: 'Higher percentile?',
        top: `<p class="story">${T.did(nm[0], fv(P[0].x), gs[0])}, and ${T.did(nm[1], fv(P[1].x), gs[1])}. All the results:</p>` +
          `<div class="data">${line(P[0], gs[0])}<br>${line(P[1], gs[1])}</div>`,
        q: 'Who is at the <b>higher percentile</b> in their own group?',
        options: [nm[0], nm[1], 'They are at the same percentile.'], correct: best,
        hints: [
          'Find each person’s percentile in <b>their own</b> group: count the values strictly less than theirs, then divide by that group’s size.',
          `${nm[0]}: ${P[0].i} of the ${P[0].n} values ${P[0].i === 1 ? 'is' : 'are'} below ${fv(P[0].x)}. ${nm[1]}: ${P[1].i} of the ${P[1].n} values ${P[1].i === 1 ? 'is' : 'are'} below ${fv(P[1].x)}.`,
          `${nm[0]}: ${eq(`${P[0].i} ÷ ${P[0].n} ≈ ${trim(P[0].pct, 1)}%`)}. ${nm[1]}: ${eq(`${P[1].i} ÷ ${P[1].n} ≈ ${trim(P[1].pct, 1)}%`)}.`,
        ],
        sol: [
          `${nm[0]}: ${P[0].i} of ${P[0].n} below → ${eq(`${P[0].i} ÷ ${P[0].n} ≈ ${trim(P[0].pct, 1)}%`)}`,
          `${nm[1]}: ${P[1].i} of ${P[1].n} below → ${eq(`${P[1].i} ÷ ${P[1].n} ≈ ${trim(P[1].pct, 1)}%`)}`,
          `<b>${nm[best]}</b> is at the higher percentile${rawBest !== best ? `, even though ${nm[rawBest]}’s value is bigger` : ''}.`,
        ],
        meta: { q: 'higherPct', groups: P.map((q) => ({ data: q.data, x: q.x })) },
        signature: `3.1|higherPct|${T.ctx}|${P.map((q) => q.data.join(',') + '@' + q.x).join('|')}`,
      });
    }
  }

  // --- what happens to a percentile if ... ---
  const WHATIF = [
    { key: 'newLow', effect: 'up', dc: 1, dn: 1, text: (nm, v, o) => `A new student joins the class, takes the quiz, and scores ${o.low}, which is lower than ${nm}’s ${v}.`,
      why: 'One more student is below, and the class grew by one.' },
    { key: 'newHigh', effect: 'down', dc: 0, dn: 1, text: (nm, v, o) => `A new student joins the class, takes the quiz, and scores ${o.high}, which is higher than ${nm}’s ${v}.`,
      why: 'The same number of students are below, but the class is bigger.' },
    { key: 'bonus', effect: 'same', dc: 0, dn: 0, text: (nm) => `The teacher adds 5 bonus points to <b>everyone’s</b> score, including ${nm}’s.`,
      why: 'Everyone moves up together, so the same students are still below.' },
    { key: 'topFix', effect: 'same', dc: 0, dn: 0, text: (nm, v, o) => `A grading fix changes the highest score in the class from ${o.top} to 100.`,
      why: 'The top score was already above, and it is still above.' },
    { key: 'passes', effect: 'down', dc: -1, dn: 0, text: (nm, v, o) => `A student who scored ${o.low} retakes the quiz and now scores ${o.high}, higher than ${nm}.`,
      why: 'One student who was below is now above, and the class size did not change.' },
    { key: 'drops', effect: 'up', dc: 1, dn: 0, text: (nm, v, o) => `A grading error is fixed: a student’s score changes from ${o.high} to ${o.low}, now lower than ${nm}’s.`,
      why: 'One student who was above is now below, and the class size did not change.' },
  ];
  const EFFECT_OPTS = { up: 'It goes up.', down: 'It goes down.', same: 'It stays the same.' };
  function gen31whatIf() {
    const nm = pick(NAMES), n = pick([20, 25]), c = int(5, n - 5), k = 100 * c / n;
    const v = int(70, 88), sc = pick(WHATIF);
    const o = { low: v - int(4, 15), high: Math.min(99, v + int(3, 9)), top: int(95, 99) };
    const c2 = c + sc.dc, n2 = n + sc.dn, k2 = 100 * c2 / n2;
    const options = [EFFECT_OPTS.up, EFFECT_OPTS.down, EFFECT_OPTS.same]; // natural fixed order
    return choiceProblem({
      section: '3.1', type: 'whatIf', title: 'What happens to the percentile?',
      top: `<p class="story">${nm} scored ${v} on a quiz. ${c} of the ${n} students in the class scored lower, so ${nm} is at the ${hl(ord(k) + ' percentile')}.</p>` +
        `<p>${sc.text(nm, v, o)}</p>`,
      q: `What happens to ${nm}’s percentile?`,
      options, correct: options.indexOf(EFFECT_OPTS[sc.effect]),
      hints: [
        `${nm}’s percentile = (number of students <b>below</b> ${nm}) ÷ (number of students in the class).`,
        'Ask two questions: Does the number of students below change? Does the class size change?',
        `After the change: ${c2} students below out of ${n2}.`,
      ],
      sol: [
        `Before: ${eq(`${c} ÷ ${n} = ${trim(k, 2)}%`)}. After: ${eq(`${c2} ÷ ${n2} ${eqSign(k2, 2)} ${trim(k2, 2)}%`)}.`,
        `${sc.why} So the percentile <b>${sc.effect === 'same' ? 'stays the same' : 'goes ' + sc.effect}</b>.`,
      ],
      meta: { q: 'whatIf', c, n, dc: sc.dc, dn: sc.dn, effect: sc.effect },
      signature: `3.1|whatIf|${sc.key}|${nm}|${n}|${c}|${v}`,
    });
  }

  function gen31(type) {
    if (type === 'pctOfValue' || type === 'valueAtPct') return gen31list(type);
    if (type === 'dotplot' || type === 'dotplotValue') return gen31dot(type);
    if (type === 'pctVsPercent') return gen31pctVsPercent();
    if (type === 'higherPct') return gen31higherPct();
    if (type === 'whatIf') return gen31whatIf();
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
      const isLess = kind === 'less';
      // wrong answers a student might give: forgetting to subtract a, or dividing by b
      const wrongs = (x) => (isLess ? [100 * x / b, 100 * x / w] : [100 * (b - x) / b]).concat([100 - 100 * (isLess ? x - a : b - x) / w]);
      const xs = uniGrid(ctx, a, b).filter((x) => Math.abs(100 * (x - a) / w - 50) >= 5 &&
        (a === 0 || clearOf(100 * (isLess ? x - a : b - x) / w, PCT_TOL, wrongs(x))));
      if (!xs.length) return null;
      const x = pick(xs);
      const wid = isLess ? x - a : b - x;
      const P = 100 * wid / w;
      const widExpr = isLess ? `${n(x)} − ${n(a)}` : `${n(b)} − ${n(x)}`;
      return {
        q: `What percent of the time will ${ctx.subj} ${isLess ? ctx.lt(f(x)) : ctx.gt(f(x))}?`,
        parts: [{ kind: 'num', label: 'Percent =', unit: '%', answer: roundTo(P, 4), tol: PCT_TOL }],
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
      let tries = 0;
      do {
        x1 = pick(g); x2 = pick(g);
        if (++tries > 200) return null;
      } while (!(x2 - x1 >= 0.15 * w && x2 - x1 <= 0.85 * w && (a === 0 || clearOf(100 * (x2 - x1) / w, PCT_TOL, [100 * (x2 - x1) / b]))));
      const wid = x2 - x1, P = 100 * wid / w;
      return {
        q: `What percent of the time will ${ctx.subj} ${ctx.btw(f(x1), f(x2))}?`,
        parts: [{ kind: 'num', label: 'Percent =', unit: '%', answer: roundTo(P, 4), tol: PCT_TOL }],
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
        // wrong answers: k% of b (ignoring a), or the wrong tail
        if (k !== 50 && Math.abs(roundTo(v, 2) - v) < 1e-9 && clearOf(v, uniTol(v, w), [k * b / 100, a + (100 - k) * w / 100])) ks.push(k);
      }
      if (!ks.length) return null;
      const k = pick(ks);
      const prod = k * w / 100, v = a + prod;
      return {
        q: `Find the ${ord(k)} percentile of the ${ctx.measurePl}.`,
        parts: [{ kind: 'num', label: `${ord(k)} percentile =`, unit: ctx.unit, answer: roundTo(v, 4), tol: uniTol(v, w) }],
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
        parts: [{ kind: 'num', label: 'Mean =', unit: ctx.unit, answer: roundTo(m, 4), tol: uniTol(m, w) }],
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
      parts: [{ kind: 'num', label: 'Height =', unit: '', answer: roundTo(h, 6), tol: h >= 0.05 - 1e-9 ? 0.006 : Math.max(0.0005, 0.03 / w) }],
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

  function gen32calc(type) {
    let ctx, a, b, w, sub;
    do {
      ctx = pick(UNI_CTX);
      const ab = pick(ctx.params);
      a = ab[0]; b = ab[1]; w = b - a;
      sub = uniSub(type, ctx, a, b);
    } while (!sub);
    const f = (v) => trim(v, 4) + (ctx.deg ? '°' : '');
    const hasHeight = type === 'height';
    const HT = heightText(w);
    const shaded = sub.shade ? sub : null;
    const diag = (shadeSub, sol) => uniformSVG({
      a, b, f, caption: ctx.caption, heightText: hasHeight && !sol ? 'height = ?' : `height = ${HT}`,
      shade: shadeSub ? shadeSub.shade : null,
      marks: shadeSub ? shadeSub.marks.map((m) => ({ v: m.v, label: sol ? m.solLabel : m.label })) : [],
    });
    const h1 = hasHeight
      ? `Sketch the density curve: a flat rectangle from ${f(a)} to ${f(b)}.${diag(null, false)}`
      : `Sketch the density curve: a rectangle from ${f(a)} to ${f(b)} with height ${eq(`1 ÷ (${trim(b)} − ${trim(a)}) = ${HT}`)}, so the total area is 1. <b>Area = probability.</b>${diag(null, false)}`;
    const p = compose({
      section: '3.2', type, title: {
        height: 'Height of the density curve', less: 'Uniform: less than', greater: 'Uniform: more than',
        between: 'Uniform: in between', percentile: 'Uniform percentile', mean: 'Mean of a uniform distribution',
      }[type],
      top: `<p class="story">${ctx.story(f(a), f(b), a, b)}</p>`,
      subs: [sub], preHints: [h1],
      preSol: hasHeight ? [] : [`Density curve: a rectangle from ${f(a)} to ${f(b)}, height = ${eq(`1 ÷ ${trim(w)} = ${HT}`)}.`],
      postSol: shaded ? [diag(shaded, true)] : null,
      meta: { a, b, parts: [sub.meta] },
      signature: `3.2|${type}|${ctx.key}|${a}|${b}|${sub.sig}`,
    });
    // put the shaded diagram on the second hint (the setup hint)
    if (shaded && p.hints.length >= 2) p.hints[1] += diag(shaded, false);
    return p;
  }
  // ---- 3.2 interpretation / multiple choice ----
  function uniPick() {
    const ctx = pick(UNI_CTX), ab = pick(ctx.params), a = ab[0], b = ab[1];
    const f = (v) => trim(v, 4) + (ctx.deg ? '°' : '');
    const U = (v) => f(v) + (ctx.unit && !ctx.deg ? ' ' + ctx.unit : '');
    return { ctx, a, b, w: b - a, f, U, story: `<p class="story">${ctx.story(f(a), f(b), a, b)}</p>` };
  }
  const uniSetup = (u) => `The density curve is a rectangle from ${u.f(u.a)} to ${u.f(u.b)} with height ${eq(`1 ÷ ${trim(u.w)} = ${heightText(u.w)}`)}. <b>Area = probability.</b>`;

  function gen32interp() {
    for (;;) {
      const u = uniPick(), { ctx, a, b, w, f } = u;
      const g = uniGrid(ctx, a, b);
      const variant = pick(['words', 'words', 'picture', 'compare']);
      if (variant === 'words') {
        const x = pick(g), isLess = chance(0.5);
        const P = roundTo(100 * (isLess ? x - a : b - x) / w, 4);
        if (Math.abs(P - 50) < 8) continue;
        const ph = isLess ? ctx.lt(f(x)) : ctx.gt(f(x)), op = isLess ? ctx.gt(f(x)) : ctx.lt(f(x));
        const ps = trim(P, 2), right = `About ${ps}% of the time, ${ctx.subj} will ${ph}.`;
        const wrong = [`About ${ps}% of the time, ${ctx.subj} will ${op}.`, `About ${trim(100 - P, 2)}% of the time, ${ctx.subj} will ${ph}.`,
          `About ${trim(P / 100, 4)}% of the time, ${ctx.subj} will ${ph}.`];
        if (!distinctAll([right].concat(wrong))) continue;
        return choiceProblem({
          section: '3.2', type: 'uniInterp', title: 'What does the probability mean?',
          top: `${u.story}<p>The probability that ${ctx.subj} will ${ph} is ${hl(trim(P / 100, 4))}.</p>`,
          q: 'What does this probability mean?', right, wrong,
          hints: [
            'A probability is the <b>proportion of the time</b> something happens in the long run. Change the decimal to a percent.',
            `${trim(P / 100, 4)} = ${ps}%. It is the area of the shaded part of the rectangle.`,
            `Read the direction carefully: the probability is for “${ph}”.`,
          ],
          sol: [`${trim(P / 100, 4)} as a percent is ${ps}%, and it describes how often ${ctx.subj} will ${ph}.`, `Correct: <b>${right}</b>`],
          meta: { q: 'uniWords', a, b, x, isLess, P },
          signature: `3.2|uniInterp|W|${ctx.key}|${a}|${b}|${x}|${isLess}`,
        });
      }
      if (variant === 'picture') {
        const x = pick(g), x2 = roundTo(a + b - x, 6);
        if (Math.abs(x - x2) < 0.25 * w) continue;
        const between = chance(0.35);
        let specs, ph;
        if (between) {
          const lo = Math.min(x, x2), hi = Math.max(x, x2);
          specs = [{ t: 'B', a: lo, b: hi }, { t: 'O', a: lo, b: hi }, { t: 'L', a: hi }, { t: 'R', a: lo }];
          ph = ctx.btw(f(lo), f(hi));
        } else {
          const isLess = chance(0.5);
          specs = isLess ? [{ t: 'L', a: x }, { t: 'R', a: x }, { t: 'L', a: x2 }, { t: 'R', a: x2 }] : [{ t: 'R', a: x }, { t: 'L', a: x }, { t: 'R', a: x2 }, { t: 'L', a: x2 }];
          ph = isLess ? ctx.lt(f(x)) : ctx.gt(f(x));
        }
        const po = pictureOptions(specs, (sp) => miniUniformSVG({ a, b, spec: sp, fmt: f }));
        if (!po) continue;
        const want = specs[0];
        const desc = want.t === 'L' ? `everything to the <b>left</b> of ${f(want.a)}` : want.t === 'R' ? `everything to the <b>right</b> of ${f(want.a)}`
          : `the part <b>between</b> ${f(want.a)} and ${f(want.b)}`;
        return choiceProblem({
          section: '3.2', type: 'uniInterp', title: 'Pick the shaded area',
          top: u.story,
          q: `Which picture shows the probability that ${ctx.subj} will ${ph}?`,
          label: 'Choose a picture:', options: po.options, correct: po.correct,
          hints: [
            '“Less than” means shade to the <b>left</b> of the value; “more than” means shade to the <b>right</b>.',
            'Read the numbers under each picture: the shading must start or stop at the value(s) in the question.',
            `You want ${desc}.`,
          ],
          sol: [`“${ph}” is ${desc}.`, `The correct picture:${po.options[po.correct]}`],
          meta: { q: 'uniPicture', a, b, want, specs: po.specs },
          signature: `3.2|uniInterp|P|${ctx.key}|${a}|${b}|${specKey(want)}`,
        });
      }
      // compare two intervals
      const d1 = pick(g.filter((v) => v > a && v - a <= 0.3 * w).map((v) => roundTo(v - a, 6)));
      if (!d1) continue;
      const same = chance(0.55);
      const d2 = same ? d1 : roundTo(d1 * pick([0.5, 2]), 6);
      if (!(d2 > 0) || d2 > 0.35 * w) continue;
      const mid = roundTo(Math.round(((a + b) / 2 - d1 / 2) / (d1 / 2)) * (d1 / 2), 6); // a middle interval
      const end = chance(0.5) ? a : roundTo(b - d2, 6);
      const I = shuffle([[mid, roundTo(mid + d1, 6)], [end, roundTo(end + d2, 6)]]);
      if (I.some(([lo, hi]) => lo < a - 1e-9 || hi > b + 1e-9) || Math.max(I[0][0], I[1][0]) < Math.min(I[0][1], I[1][1])) continue;
      const wA = I[0][1] - I[0][0], wB = I[1][1] - I[1][0];
      const options = [cap(ctx.btw(f(I[0][0]), f(I[0][1]))), cap(ctx.btw(f(I[1][0]), f(I[1][1]))), 'They are equally likely.'];
      const correct = Math.abs(wA - wB) < 1e-9 ? 2 : wA > wB ? 0 : 1;
      return choiceProblem({
        section: '3.2', type: 'uniInterp', title: 'Which is more likely?',
        top: u.story, q: `Which is more likely for ${ctx.subj}?`, options, correct,
        hints: [
          'In a uniform distribution the density curve is <b>flat</b>: no value is more likely than another.',
          'The probability of an interval is its area = width × height. Same height everywhere, so only the <b>width</b> matters.',
          `Widths: ${eq(`${trim(I[0][1])} − ${trim(I[0][0])} = ${trim(wA)}`)} and ${eq(`${trim(I[1][1])} − ${trim(I[1][0])} = ${trim(wB)}`)}.`,
        ],
        sol: [
          `Width of the first interval: ${trim(wA)}; width of the second: ${trim(wB)}. Each probability = width ÷ ${trim(w)}.`,
          correct === 2 ? 'Same width → same area → <b>they are equally likely</b>, even though one interval is near the middle.'
            : `The wider interval has more area, so <b>${options[correct]}</b> is more likely.`,
        ],
        meta: { q: 'uniCompare', a, b, intervals: I },
        signature: `3.2|uniInterp|C|${ctx.key}|${a}|${b}|${I.join('|')}`,
      });
    }
  }

  const hs = (h) => { const d = h < 0.01 ? 6 : h < 0.1 ? 5 : 4; return Math.abs(roundTo(h, d) - h) < 1e-12 ? trim(h, d) : '≈ ' + trim(h, d); };
  function gen32valid() {
    for (;;) {
      if (chance(0.55)) {
        const u = uniPick(), { a, b, w, f } = u, h = 1 / w;
        const rect = (lo, hi, ht) => `From ${f(lo)} to ${f(hi)}, height ${hs(ht)}`;
        const right = rect(a, b, h);
        const pool = [rect(a, b, w), rect(a, b, 1), rect(a, b, 2 / w)];
        if (a > 0) pool.push(rect(a, b, 1 / b), rect(0, b, h));
        const wrong = shuffle([...new Set(pool)].filter((o) => o !== right)).slice(0, 3);
        if (wrong.length < 3 || !distinctAll([right].concat(wrong))) continue;
        return choiceProblem({
          section: '3.2', type: 'validDensity', title: 'Draw the density curve',
          top: u.story, q: 'Which rectangle is the correct density curve for this distribution?', right, wrong,
          hints: [
            'A density curve must have a total area of exactly <b>1</b>.',
            `The rectangle runs from a = ${f(a)} to b = ${f(b)}, so its width is ${eq(`${trim(b)} − ${trim(a)} = ${trim(w)}`)}.`,
            `Height = 1 ÷ width = ${eq(`1 ÷ ${trim(w)}`)}.`,
          ],
          sol: [`Width = ${trim(w)}, so height = ${eq(`1 ÷ ${trim(w)} ${eqSign(h, 4)} ${trim(h, 4)}`)} (then width × height = 1).`, `Correct: <b>${right}</b>`],
          meta: { q: 'validGiven', a, b, options: [right].concat(wrong) },
          signature: `3.2|validDensity|G|${u.ctx.key}|${a}|${b}|${wrong.join('|')}`,
        });
      }
      // which of these rectangles could be ANY density curve?
      const W = [2, 4, 5, 8, 10, 20, 0.5, 2.5];
      const mk = (area) => {
        const w = pick(W), lo = pick([0, 0, 1, 2, 5, 10]), ht = area / w;
        return { lo, hi: roundTo(lo + w, 6), ht, area };
      };
      const rects = [mk(1)].concat(shuffle([0.5, 2, 0.25, 1.5, 4]).slice(0, 3).map(mk));
      if (rects.some((r) => Math.abs(roundTo(r.ht, 4) - r.ht) > 1e-12)) continue;
      const txt = rects.map((r) => `From ${trim(r.lo)} to ${trim(r.hi)}, height ${trim(r.ht, 4)}`);
      if (!distinctAll(txt)) continue;
      return choiceProblem({
        section: '3.2', type: 'validDensity', title: 'Valid density curve?',
        top: '<p class="story">A uniform density curve is a flat rectangle. Here are four rectangles.</p>',
        q: 'Which one could be a <b>density curve</b>?', right: txt[0], wrong: txt.slice(1),
        hints: [
          'Every density curve has a total area of exactly <b>1</b> (100% of the values).',
          'For a rectangle, area = width × height. Width = right end − left end.',
          `Check: ${rects.map((r) => `${trim(r.hi - r.lo)} × ${trim(r.ht, 4)}`).join(', ')}.`,
        ],
        sol: rects.map((r, i) => `${txt[i]}: area = ${eq(`${trim(r.hi - r.lo)} × ${trim(r.ht, 4)} = ${trim(r.area, 4)}`)}${i === 0 ? ' ← <b>area 1, valid</b>' : ''}`),
        meta: { q: 'validAny', rects: rects.map((r) => ({ lo: r.lo, hi: r.hi, ht: r.ht })), options: txt },
        signature: `3.2|validDensity|A|${txt.join('|')}`,
      });
    }
  }

  function gen32meanInterp() {
    for (;;) {
      const u = uniPick(), { ctx, a, b, f, U } = u, m = (a + b) / 2, pl = ctx.measurePl;
      if (chance(0.55)) {
        const right = chance(0.5) ? `If we recorded many ${pl}, their average would be about ${U(m)}.` : `About half of all ${pl} are less than ${U(m)}.`;
        const wrong = shuffle([`Every one of the ${pl} is exactly ${U(m)}.`, `${cap(U(m))} is the most likely value; values near ${f(a)} or ${f(b)} are rare.`,
          `About ${trim(m, 4)}% of the ${pl} are less than ${U(m)}.`, `Half of the ${pl} are exactly ${U(m)}.`]).slice(0, 3);
        if (Math.abs(m - 50) < 1e-9 || !distinctAll([right].concat(wrong))) continue;
        return choiceProblem({
          section: '3.2', type: 'interpMean', title: 'What does the mean tell us?',
          top: `${u.story}<p>The mean of this distribution is ${hl(U(m))}.</p>`, q: 'Which statement is correct?', right, wrong,
          hints: [
            'The mean is the long-run <b>average</b>: halfway between a and b for a uniform distribution.',
            'A uniform distribution is flat: every value from a to b is <b>equally likely</b>, so the mean is not “more likely” than other values.',
            'Because the rectangle is symmetric, half of the area is on each side of the mean.',
          ],
          sol: [`Mean = ${eq(`(${trim(a)} + ${trim(b)}) ÷ 2 = ${trim(m)}`)}: the balance point (and the middle) of the rectangle.`, `Correct: <b>${right}</b>`],
          meta: { q: 'meanWords', a, b, right },
          signature: `3.2|interpMean|W|${ctx.key}|${a}|${b}|${right}|${wrong.join('|')}`,
        });
      }
      const right = `All values from ${f(a)} to ${f(b)} are equally likely.`;
      return choiceProblem({
        section: '3.2', type: 'interpMean', title: 'Most likely value?',
        top: u.story, q: `Which ${ctx.unit && !ctx.deg ? 'time' : 'value'} is the <b>most likely</b>?`,
        right, wrong: [`${cap(U(m))} (the mean)`, `${cap(U(a))} (the smallest possible)`, `${cap(U(b))} (the largest possible)`],
        hints: [
          'Think about the shape of the density curve for a uniform distribution.',
          'The density curve is a <b>flat</b> rectangle: the same height everywhere from a to b.',
          'Equal height means equal likelihood for equal-width intervals anywhere in the range.',
        ],
        sol: ['A uniform density curve is flat, so no value is more likely than any other.', `Correct: <b>${right}</b> (the mean, ${U(m)}, is the average, not the most likely value).`],
        meta: { q: 'mostLikely' },
        signature: `3.2|interpMean|M|${ctx.key}|${a}|${b}`,
      });
    }
  }

  function gen32(type) {
    if (type === 'uniInterp') return gen32interp();
    if (type === 'validDensity') return gen32valid();
    if (type === 'interpMean') return gen32meanInterp();
    return gen32calc(type);
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
      intro: (A, B) => `${A.n} and ${B.n} each caught a fish at a different lake. Fish lengths at each lake:`,
      row: (P) => `<b>${P.G}</b>: mean ${P.m} cm, SD ${P.s} cm. ${P.n}’s fish: <b>${P.x} cm</b>`,
      solo: (A) => `The average length of a fish in ${A.g} is ${A.m} cm with a standard deviation of ${A.s} cm. ${A.n} catches a fish there that measures ${A.x} cm.`,
      ask: 'Who had the better catch relative to their lake?' },
    { key: 'milk', unit: 'kg', muDec: 2, sdDec: 2, xDec: 2, mu: [8, 12], sd: [1.5, 3.8], lower: false,
      groups: ['Big Ranch', 'Chico Ranch', 'Sunny Acres', 'Red Barn Farm', 'Hilltop Dairy'],
      names: ['Daisy', 'Bessie', 'Clover', 'Buttercup', 'Rosie', 'Maple', 'Hazel', 'Penny'],
      intro: () => 'Two cows from different ranches were milked on the same day. Daily milk per cow at each ranch:',
      row: (P) => `<b>${P.G}</b>: mean ${P.m} kg, SD ${P.s} kg. ${P.n} the cow: <b>${P.x} kg</b>`,
      solo: (A) => `On average, a cow at ${A.g} makes ${A.m} kg of milk a day with a standard deviation of ${A.s} kg. Last week ${A.n} the cow made ${A.x} kg in one day.`,
      ask: 'Which cow produced more milk relative to her ranch?' },
    { key: 'bus', unit: 'minutes', muDec: 2, sdDec: 2, xDec: 2, mu: [8, 14], sd: [2, 5], lower: true,
      groups: ['the high school stop', 'the library stop', 'the mall stop', 'the church stop', 'the park stop'],
      intro: (A, B) => `${A.n} and ${B.n} waited for buses at two different stops. Wait times at each stop:`,
      row: (P) => `<b>${P.G}</b>: mean ${P.m} min, SD ${P.s} min. ${P.n} waited <b>${P.x} min</b>`,
      solo: (A) => `The average wait for the bus at ${A.g} is ${A.m} minutes with a standard deviation of ${A.s} minutes. On Monday, ${A.n} waited ${A.x} minutes there.`,
      note: 'A <b>shorter</b> wait is better.', ask: 'Whose wait was better relative to their bus stop?' },
    { key: 'sales', unit: 'minutes', muDec: 2, sdDec: 2, xDec: 2, mu: [11, 15], sd: [2, 3.5], lower: true,
      groups: ['Company A', 'Company B', 'Company C', 'Company D'],
      intro: (A, B) => `${A.n} and ${B.n} work for different companies. Minutes to close a sale:`,
      row: (P) => `<b>${P.G}</b>: mean ${P.m} min, SD ${P.s} min. ${P.n} took <b>${P.x} min</b>`,
      solo: (A) => `Salespeople at ${A.g} close a sale in ${A.m} minutes on average, with a standard deviation of ${A.s} minutes. ${A.n} took ${A.x} minutes to close a sale.`,
      note: 'Closing a sale <b>faster</b> is better.', ask: 'Whose sales call was better relative to their company?' },
    { key: 'tests', unit: 'points', muDec: 1, sdDec: 1, xDec: 0, mu: [66, 82], sd: [4, 10], lower: false,
      groups: ['Ms. Ortiz’s class', 'Mr. Chen’s class', 'Mrs. Patel’s class', 'Mr. Brooks’s class'],
      intro: (A, B) => `${A.n} and ${B.n} took unit tests in different classes. Test scores in each class:`,
      row: (P) => `<b>${P.G}</b>: mean ${P.m}, SD ${P.s}. ${P.n} scored <b>${P.x}</b>`,
      solo: (A) => `On a unit test, ${A.g} averaged ${A.m} points with a standard deviation of ${A.s} points. ${A.n} scored ${A.x}.`,
      ask: 'Who did better relative to their class?' },
    { key: 'dash', unit: 'seconds', muDec: 2, sdDec: 2, xDec: 2, mu: [12.5, 14.5], sd: [0.4, 0.9], lower: true,
      groups: ['the Valley League', 'the Coastal League', 'the Metro League', 'the Summit League'],
      intro: (A, B) => `${A.n} and ${B.n} run the 100-meter dash in different leagues. Times in each league:`,
      row: (P) => `<b>${P.G}</b>: mean ${P.m} s, SD ${P.s} s. ${P.n} ran <b>${P.x} s</b>`,
      solo: (A) => `In ${A.g}, 100-meter dash times average ${A.m} seconds with a standard deviation of ${A.s} seconds. ${A.n} runs the dash in ${A.x} seconds.`,
      note: 'A <b>lower</b> time is better.', ask: 'Who ran better relative to their league?' },
    { key: 'golf', unit: 'strokes', muDec: 1, sdDec: 1, xDec: 0, mu: [72, 88], sd: [3, 6], lower: true,
      groups: ['Oak Hills', 'Seaside Links', 'Eagle Ridge', 'Pine Valley'],
      intro: (A, B) => `${A.n} and ${B.n} played golf on different courses. Scores on each course:`,
      row: (P) => `<b>${P.G}</b>: mean ${P.m} strokes, SD ${P.s}. ${P.n} shot <b>${P.x}</b>`,
      solo: (A) => `At ${A.g}, the average score is ${A.m} strokes with a standard deviation of ${A.s} strokes. ${A.n} shot ${A.x} there.`,
      note: 'In golf, a <b>lower</b> score is better.', ask: 'Who played better relative to their course?' },
    { key: 'pumpkin', unit: 'pounds', muDec: 1, sdDec: 1, xDec: 1, mu: [420, 650], sd: [50, 110], lower: false,
      groups: ['the Green Valley Fair', 'the Riverside County Fair', 'the Harvest Moon Festival', 'the Hillcrest Fair'],
      intro: (A, B) => `${A.n} and ${B.n} entered giant pumpkins at different fairs. Pumpkin weights at each fair:`,
      row: (P) => `<b>${P.G}</b>: mean ${P.m} lb, SD ${P.s} lb. ${P.n}’s pumpkin: <b>${P.x} lb</b>`,
      solo: (A) => `At ${A.g}, giant pumpkins average ${A.m} pounds with a standard deviation of ${A.s} pounds. ${A.n} entered a ${A.x}-pound pumpkin.`,
      ask: 'Whose pumpkin was more impressive relative to their fair?' },
    { key: 'gold', unit: 'coins', muDec: 1, sdDec: 1, xDec: 0, mu: [150, 300], sd: [20, 50], lower: false,
      groups: ['the Iron Guild', 'the Moonlight Guild', 'the Ember Guild', 'the Frost Guild'],
      intro: (A, B) => `${A.n} and ${B.n} raid dungeons for different guilds. Gold coins per raid in each guild:`,
      row: (P) => `<b>${P.G}</b>: mean ${P.m}, SD ${P.s}. ${P.n} brought back <b>${P.x} coins</b>`,
      solo: (A) => `Adventurers in ${A.g} bring back an average of ${A.m} gold coins per raid, with a standard deviation of ${A.s} coins. On the last raid, ${A.n} brought back ${A.x} coins.`,
      ask: 'Who had the better raid relative to their guild?' },
    { key: 'escape', unit: 'minutes', muDec: 1, sdDec: 1, xDec: 1, mu: [30, 60], sd: [5, 10], lower: true,
      groups: ['the Crystal Caverns', 'the Shadow Crypt', 'the Goblin Warrens', 'the Sunken Temple'],
      intro: (A, B) => `${A.n}’s party and ${B.n}’s party escaped from different dungeons. Escape times for each dungeon:`,
      row: (P) => `<b>${P.G}</b>: mean ${P.m} min, SD ${P.s} min. ${P.n}’s party: <b>${P.x} min</b>`,
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
      part: { kind: 'num', label: o.label, unit: '', answer: zr, tol: Z_TOL, placeholder: 'e.g. -1.25' },
      setup: `${eq(`z = (${o.xs} − ${o.ms}) ÷ ${o.ss}`)}`,
      calc: `${o.xs} − ${o.ms} = ${fmt(diff, dd)}, then ${fmt(diff, dd)} ÷ ${o.ss} → round to 2 decimals.`,
      calc1: `${o.xs} − ${o.ms} = ${fmt(diff, dd)}, then ${fmt(diff, dd)} ÷ ${o.ss} ≈ ${fmt(zr, 2)}.`,
      sol: `${o.who ? o.who + ': ' : ''}${eq(`z = (${o.xs} − ${o.ms}) ÷ ${o.ss} = ${fmt(diff, dd)} ÷ ${o.ss} ${eqSign(z, 2)} ${fmt(zr, 2)}`)}`,
      meta: { q: 'z', mu: o.m, sigma: o.s, x: o.x },
    };
  }
  const FORMULA = `Use ${eq('z = (x − μ) ÷ σ')}: subtract the mean, then divide by the standard deviation.`;
  const sdWords = (z) => `${trim(Math.abs(roundTo(z, 2)), 2)} standard deviation${Math.abs(roundTo(z, 2)) === 1 ? '' : 's'} ${z < 0 ? 'below' : 'above'} the mean`;

  const CMP_COLS = {
    fish: ['Lake', 'Fish (cm)'], milk: ['Ranch', 'Milk (kg)'], bus: ['Bus stop', 'Wait (min)'], sales: ['Company', 'Time (min)'],
    tests: ['Class', 'Score'], dash: ['League', 'Time (s)'], golf: ['Course', 'Strokes'], pumpkin: ['Fair', 'Weight (lb)'],
    gold: ['Guild', 'Coins'], escape: ['Dungeon', 'Time (min)'],
  };
  function gen33compare() {
    for (let tries = 0; ; tries++) {
      const ctx = pick(CMP_CTX);
      const gs = shuffle(ctx.groups).slice(0, 2);
      const nm = ctx.names ? shuffle(ctx.names).slice(0, 2) : names(2);
      const A = cmpPerson(ctx, -2.4, 2.4), B = cmpPerson(ctx, -2.4, 2.4);
      if (A.s <= 0 || B.s <= 0) continue;
      if ([A.z, B.z].some((z) => Math.abs(z) < 0.1 || Math.abs(z) > 2.6)) continue;
      const zA = roundTo(A.z, 2), zB = roundTo(B.z, 2);
      if (Math.abs(zA - zB) < 0.2) continue;
      const betterIdx = ctx.lower ? (zA < zB ? 0 : 1) : (zA > zB ? 0 : 1);
      const rawBetter = ctx.lower ? (A.x < B.x ? 0 : 1) : (A.x > B.x ? 0 : 1);
      if (A.x === B.x) continue;
      if (tries < 60 && rawBetter === betterIdx && chance(0.7)) continue; // usually make raw values misleading
      const F = (P, g, n) => ({ g, G: cap(g), n, m: trim(P.m, ctx.muDec), s: trim(P.s, ctx.sdDec), x: fmt(P.x, ctx.xDec) });
      const FA = F(A, gs[0], nm[0]), FB = F(B, gs[1], nm[1]);
      const sa = zSub({ label: '', x: A.x, m: A.m, s: A.s, xs: FA.x, ms: FA.m, ss: FA.s, who: nm[0] });
      const sb = zSub({ label: '', x: B.x, m: B.m, s: B.s, xs: FB.x, ms: FB.m, ss: FB.s, who: nm[1] });
      const better = nm[betterIdx];
      const dirText = ctx.lower
        ? `Here <b>lower is better</b>, so the <b>smaller</b> (more negative) z-score wins.`
        : 'Here higher is better, so the <b>larger</b> z-score wins.';
      const cols = CMP_COLS[ctx.key];
      const row = (P) => `<tr><td>${P.n}</td><td>${cap(P.g.replace(/^the /, ''))}</td><td>${P.m}</td><td>${P.s}</td><td><b>${P.x}</b></td></tr>`;
      return choiceProblem({
        section: '3.3', type: 'compare', title: 'Who did better?',
        top: `<p class="story">${ctx.intro(FA, FB)}</p>` +
          `<table><tr><th>Name</th><th>${cols[0]}</th><th>Mean</th><th>SD</th><th>${cols[1]}</th></tr>${row(FA)}${row(FB)}</table>` +
          (ctx.note ? `<p class="small">${ctx.note}</p>` : ''),
        q: `${ctx.ask} <span class="small">(Compare z-scores.)</span>`,
        label: 'Better relative to their group:', options: [nm[0], nm[1]], correct: betterIdx,
        hints: [
          `${FORMULA} Each one uses <b>their own</b> group’s mean and SD.`,
          `${nm[0]}: ${sa.setup}<br>${nm[1]}: ${sb.setup}`,
          `${nm[0]}: ${sa.calc1}<br>${nm[1]}: ${sb.calc1}<br>${dirText}`,
        ],
        sol: [
          sa.sol, sb.sol,
          `${dirText} ${fmt(sa.zr, 2)} vs. ${fmt(sb.zr, 2)} → <b>${better}</b> did better relative to their group.`,
        ],
        metaTop: { lowerBetter: !!ctx.lower },
        meta: { q: 'better', lowerBetter: !!ctx.lower, people: [sa.meta, sb.meta] },
        signature: `3.3|compare|${ctx.key}|${A.x}|${A.m}|${A.s}|${B.x}|${B.m}|${B.s}`,
      });
    }
  }

  function pickNorm34() {
    const ctx = pick(NORM_CTX);
    const ms = pick(ctx.p34);
    return { ctx, mu: ms[0], sd: ms[1] };
  }

  function gen33single() {
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
      if (Math.abs(z) < 0.1 || Math.abs(z) > 2.7) continue;
      const zs = zSub({ label: 'z =', x, m, s, xs, ms, ss });
      // dividing by the variance, or forgetting to divide, must not land within the tolerance
      if (!clearOf(zs.zr, Z_TOL, [(x - m) / (s * s), x - m, (m - x) / s])) continue;
      return compose({
        section: '3.3', type: 'single', title: 'Find the z-score',
        top: `<p class="story">${story}</p>`,
        subs: [{ q, parts: [zs.part], hints: [FORMULA, `Here x = ${xs}, μ = ${ms}, σ = ${ss}: ${zs.setup}`, zs.calc], sol: [zs.sol, `So the value is ${sdWords(z)}.`] }],
        meta: { parts: [zs.meta] },
        signature: `3.3|single|${sig}|${x}|${m}|${s}`,
      });
    }
  }

  function gen33unusual() {
    for (;;) {
      const N = pickNorm34(), ctx = N.ctx, mu = N.mu, sd = N.sd;
      const zTop = Math.min(3.2, ctx.zMax || 3.2);
      const far = gridVals(ctx, mu, sd, 2.2, zTop);
      const near = gridVals(ctx, mu, sd, 0.2, 1.75);
      if (!far.length || near.length < 3) continue;
      const ms = nf(ctx, mu), ss = nf(ctx, sd);
      const u = pick(far);
      const others = shuffle(near).slice(0, 3);
      if (new Set(others).size < 3) continue;
      const vals = shuffle([u].concat(others));
      const lo = mu - 2 * sd, hi = mu + 2 * sd;
      return choiceProblem({
        section: '3.3', type: 'unusual', title: 'Unusual or not?',
        top: `<p class="story">${ctx.story(ms, ss)}</p>`,
        q: `Which of these ${ctx.pl} would be considered <b>unusual</b> (more than 2 standard deviations from the mean)?`,
        label: 'Unusual value:', options: vals.map((v) => nu(ctx, nf(ctx, v))), correct: vals.indexOf(u),
        hints: [
          `Unusual means |z| > 2, where ${eq('z = (x − μ) ÷ σ')}.`,
          `Shortcut: 2 SDs below the mean is ${eq(`${ms} − 2(${ss}) = ${nf(ctx, lo)}`)} and 2 SDs above is ${eq(`${ms} + 2(${ss}) = ${nf(ctx, hi)}`)}.`,
          `Which choice is <b>outside</b> the interval from ${nf(ctx, lo)} to ${nf(ctx, hi)}?`,
        ],
        sol: vals.map((v) => {
          const z = (v - mu) / sd;
          return `${nu(ctx, nf(ctx, v))}: z = (${trim(v)} − ${trim(mu)}) ÷ ${trim(sd)} ≈ ${fmt(z, 2)}${v === u ? ' ← <b>|z| > 2, unusual</b>' : ''}`;
        }),
        meta: { q: 'whichUnusual', mu, sigma: sd, values: vals },
        signature: `3.3|unusual|${ctx.key}|${mu}|${sd}|${vals.join(',')}`,
      });
    }
  }

  function gen33findX() {
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
      const tol = normTol(x, sd);
      if (!clearOf(x, tol, [mu - z * sd, z * sd])) continue; // wrong direction / forgetting the mean
      const parts = [{ kind: 'num', label: `${cap(ctx.measure)} =`, unit, answer: x, tol }];
      const pd = Math.max(decOf(prod), 0);
      return compose({
        section: '3.3', type: 'findX', title: 'Work backward from z',
        top: `<p class="story">${ctx.story(ms, ss)}</p>`,
        subs: [{
          q: `${phr} What is the ${ctx.measure}?`,
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

  // ---- 3.3 interpretation ----
  const unitWord = (ctx) => (ctx.money ? 'dollars' : ctx.unit || 'points');
  function gen33words() {
    for (;;) {
      const N = pickNorm34(), ctx = N.ctx, mu = N.mu, sd = N.sd;
      const z = roundTo((chance(0.5) ? -1 : 1) * unif(0.3, 2.6), chance(0.6) ? 1 : 2);
      if (Math.abs(Math.abs(z) - 1) < 0.05 || Math.abs(z) < 0.3 || Math.abs(mu + z * sd) < 1e-9) continue;
      const dir = z < 0 ? 'below' : 'above', opp = z < 0 ? 'above' : 'below', az = trim(Math.abs(z), 2);
      const who = ctx.whose || `A ${ctx.sing}’s ${ctx.measure}`;
      const story = `<p class="story">${ctx.story(nf(ctx, mu), nf(ctx, sd))}</p><p>${who} has a z-score of ${hl(trim(z, 2))}.</p>`;
      if (chance(0.5)) {
        const right = `It is ${sdWords(z)}.`;
        return choiceProblem({
          section: '3.3', type: 'zWords', title: 'What does z mean?', top: story,
          q: 'Which statement correctly interprets this z-score?', right,
          wrong: [`It is ${sdWords(-z)}.`, `It is ${az} ${unitWord(ctx)} ${dir} the mean.`, `It is ${az}% ${dir} the mean.`],
          hints: [
            'A z-score counts <b>standard deviations</b> from the mean, not units and not percents.',
            'The <b>sign</b> tells the direction: negative = below the mean, positive = above the mean.',
            `z = ${trim(z, 2)}: ${az} standard deviations, ${dir} the mean.`,
          ],
          sol: [`|z| = ${az} standard deviations; the sign is ${z < 0 ? 'negative → below' : 'positive → above'} the mean.`,
            `Correct: <b>${right}</b> (That is ${az} × ${nf(ctx, sd)} = ${nu(ctx, nf(ctx, Math.abs(z) * sd))} ${dir} the mean.)`],
          meta: { q: 'zWords', z, right },
          signature: `3.3|zWords|W|${ctx.key}|${mu}|${sd}|${z}`,
        });
      }
      const d = roundTo(Math.abs(z) * sd, 6), U = (v) => nu(ctx, nf(ctx, v));
      const uw = ctx.money ? '' : ' ' + unitWord(ctx);
      const dist = (v, w) => (ctx.money ? `${nfx(ctx, v)} ${w} the mean` : `${trim(v, 4)}${uw} ${w} the mean`);
      const right = cap(dist(d, dir));
      const wrong = [cap(dist(Math.abs(z), dir)), cap(dist(d, opp)), cap(dist(sd, dir))];
      if (!distinctAll([right].concat(wrong))) continue;
      return choiceProblem({
        section: '3.3', type: 'zWords', title: 'How far from the mean?', top: story,
        q: `How far from the mean is this ${ctx.measure}?`, right, wrong,
        hints: [
          `z = ${trim(z, 2)} means ${sdWords(z)}.`,
          `One standard deviation is ${U(sd)}. Multiply: ${eq(`${az} × ${trim(sd)}`)}.`,
          `${eq(`${az} × ${trim(sd)} = ${trim(d, 4)}`)}, ${dir} the mean.`,
        ],
        sol: [`${az} standard deviations × ${U(sd)} each = ${U(d)}.`, `Negative/positive z → ${dir} the mean. Correct: <b>${right}</b>`],
        meta: { q: 'zDist', z, sigma: sd, right },
        signature: `3.3|zWords|D|${ctx.key}|${mu}|${sd}|${z}`,
      });
    }
  }

  const LOWER_WORD = { bus: 'wait', sales: 'time to close a sale', dash: 'time', golf: 'score', escape: 'escape time' };
  function gen33sign() {
    const v = pick(['zero', 'negative', 'lower', 'lower', 'two']);
    const nm = pick(NAMES), test = pick(TESTS);
    if (v === 'zero') {
      const right = `${nm}’s score is exactly equal to the class mean.`;
      return choiceProblem({
        section: '3.3', type: 'zSign', title: 'A z-score of 0', top: `<p class="story">${nm}’s score on a ${test} has a z-score of ${hl('0')}.</p>`,
        q: 'What does this tell you?', right,
        wrong: shuffle([`${nm} scored 0 points on the ${test}.`, `${nm} had the lowest score in the class.`, `Nobody in the class scored lower than ${nm}.`, `${nm}’s score was unusual.`]).slice(0, 3),
        hints: ['A z-score tells how many standard deviations a value is from the <b>mean</b>.', 'z = (x − μ) ÷ σ. When is that fraction equal to 0?', 'z = 0 exactly when x − μ = 0, that is, x = μ.'],
        sol: ['z = 0 means 0 standard deviations from the mean: x − μ = 0.', `Correct: <b>${right}</b>`],
        meta: { q: 'zZero' }, signature: `3.3|zSign|zero|${nm}|${test}`,
      });
    }
    if (v === 'negative') {
      const N = pickNorm34(), ctx = N.ctx, who = ctx.whose || `A ${ctx.sing}’s ${ctx.measure}`;
      const right = `It is below the mean ${ctx.measure}.`;
      return choiceProblem({
        section: '3.3', type: 'zSign', title: 'A negative z-score',
        top: `<p class="story">${ctx.story(nf(ctx, N.mu), nf(ctx, N.sd))}</p><p>${who} has a ${hl('negative')} z-score.</p>`,
        q: 'Which statement must be true?', right,
        wrong: [`The ${ctx.measure} itself is a negative number.`, `It is above the mean ${ctx.measure}.`, 'It is unusual (more than 2 standard deviations from the mean).'],
        hints: ['z = (x − μ) ÷ σ, and σ is always positive.', 'So z is negative exactly when x − μ is negative.', 'x − μ < 0 means x < μ.'],
        sol: ['A negative z-score means x − μ < 0, so the value is less than the mean. It does not have to be unusual (that needs |z| > 2).', `Correct: <b>${right}</b>`],
        meta: { q: 'zNeg' }, signature: `3.3|zSign|neg|${ctx.key}|${N.mu}`,
      });
    }
    if (v === 'lower') {
      const ctx = pick(CMP_CTX.filter((c) => c.lower)), g = pick(ctx.groups), w = LOWER_WORD[ctx.key];
      const z = roundTo((chance(0.6) ? -1 : 1) * unif(0.4, 2.2), 1);
      if (Math.abs(Math.abs(z) - 1) < 0.05) return gen33sign();
      const below = z < 0, az = trim(Math.abs(z), 2), u = ctx.unit === 'strokes' ? 'strokes' : ctx.unit;
      const who = ctx.key === 'escape' ? `${nm}’s party` : nm, whose = ctx.key === 'escape' ? `${nm}’s party’s` : `${nm}’s`;
      const right = below ? `${cap(whose)} ${w} was below the mean, which is good here.` : `${cap(whose)} ${w} was above the mean, which is bad here.`;
      const wrong = below
        ? [`${cap(whose)} ${w} was above the mean.`, `${cap(who)} did worse than average, because the z-score is negative.`, `${cap(whose)} ${w} was ${az} ${u} below the mean.`]
        : [`${cap(whose)} ${w} was below the mean.`, `${cap(who)} did better than average, because the z-score is positive.`, `${cap(whose)} ${w} was ${az} ${u} above the mean.`];
      return choiceProblem({
        section: '3.3', type: 'zSign', title: 'When lower is better',
        top: `<p class="story">At ${g}, ${whose} ${w} has a z-score of ${hl(fmt(z, 1))}.</p><p class="small">${ctx.note}</p>`,
        q: 'Which statement is correct?', right, wrong,
        hints: ['The sign of z only tells the direction: negative = below the mean, positive = above.', 'Whether that is good or bad depends on the context. Here, lower is better.',
          `z = ${fmt(z, 1)} is ${az} standard deviations (not ${u}) ${below ? 'below' : 'above'} the mean.`],
        sol: [`z = ${fmt(z, 1)} → ${below ? 'below' : 'above'} the mean. Since lower is better here, that is ${below ? 'good' : 'bad'}.`, `Correct: <b>${right}</b>`],
        meta: { q: 'zLower', z, right }, signature: `3.3|zSign|lower|${ctx.key}|${nm}|${z}`,
      });
    }
    // two students on the same test
    const [A, B] = names(2);
    const za = roundTo(unif(0.4, 2.2), 1), zb = roundTo(-unif(0.3, 1.8), 1);
    const P = chance(0.5) ? [[A, za], [B, zb]] : [[B, zb], [A, za]];
    const right = `${A} scored above the class mean and ${B} scored below it.`;
    return choiceProblem({
      section: '3.3', type: 'zSign', title: 'Comparing z-scores',
      top: `<p class="story">On the same ${test}, ${P[0][0]}’s z-score was ${hl(fmt(P[0][1], 1))} and ${P[1][0]}’s z-score was ${hl(fmt(P[1][1], 1))}.</p>`,
      q: 'Which statement is correct?', right,
      wrong: [`${B} scored higher than ${A}.`, `Both scored above the class mean.`, `${A}’s score was ${trim(za, 1)} points above the class mean.`],
      hints: ['Positive z = above the mean; negative z = below the mean.', 'On the same test (same mean and SD), a bigger z-score means a higher score.',
        `${A}: z = ${fmt(za, 1)} (above). ${B}: z = ${fmt(zb, 1)} (below). z counts standard deviations, not points.`],
      sol: [`${A}: ${fmt(za, 1)} > 0 → above the mean. ${B}: ${fmt(zb, 1)} < 0 → below the mean.`, `Correct: <b>${right}</b>`],
      meta: { q: 'zTwo', za, zb, right }, signature: `3.3|zSign|two|${A}|${B}|${za}|${zb}|${test}`,
    });
  }

  function gen33(type) {
    if (type === 'compare') return gen33compare();
    if (type === 'unusual') return gen33unusual();
    if (type === 'findX') return gen33findX();
    if (type === 'zWords') return gen33words();
    if (type === 'zSign') return gen33sign();
    return gen33single();
  }

  // =====================================================================
  // 3.4 NORMAL DISTRIBUTIONS WITH DESMOS
  // =====================================================================
  const PCTILE_KS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 55, 60, 65, 70, 75, 80, 85, 90, 95];
  const CUT_PS = [1, 2, 3, 5, 10, 15, 20, 25];
  const ND = (mu, sd) => `normaldist(${raw(mu)}, ${raw(sd)})`;

  function norm34Sub(kind, ctx, mu, sd) {
    const zMax = Math.min(2.9, ctx.zMax || 2.9);
    const U = (v) => nu(ctx, nf(ctx, v));
    const cdf = (v) => normalCdf((v - mu) / sd);
    const desmosArea = (lo, hi) => `In Desmos, type ${eq(ND(mu, sd))}. Check <b>Find Cumulative Probability</b>, then set <b>Min</b> = ${lo} and <b>Max</b> = ${hi}.`;
    const NEG_INF = '−∞ (type <i>-infinity</i>)', POS_INF = '∞ (type <i>infinity</i>)';
    const areaPart = (P) => ({ kind: 'num', label: 'Percent =', unit: '%', answer: roundTo(P, 4), tol: PCT_TOL, placeholder: 'e.g. 12.34' });
    if (kind === 'less' || kind === 'greater') {
      // |z| ≤ 2.05 keeps every area ≥ 2%, so a decimal typed instead of a percent cannot pass
      const x = pick(gridVals(ctx, mu, sd, 0.25, Math.min(zMax, 2.05)));
      const isLess = kind === 'less';
      const P = 100 * (isLess ? cdf(x) : 1 - cdf(x));
      const z = (x - mu) / sd;
      return {
        q: `What percent of ${ctx.pl} ${isLess ? ctx.lt(U(x)) : ctx.gt(U(x))}?`,
        parts: [areaPart(P)],
        hints: [
          isLess ? desmosArea(NEG_INF, raw(x)) : desmosArea(raw(x), POS_INF),
          `Desmos shows about <b>${fmt(P / 100, 4)}</b>. Multiply by 100 to get a percent.`,
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
          `Desmos shows about <b>${fmt(P / 100, 4)}</b>. Multiply by 100 to get a percent.`,
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
      do { k = pick(PCTILE_KS); v = mu + sd * invNorm(k / 100); }
      while (Math.abs((v - mu) / sd) > zMax || !clearOf(v, normTol(v, sd), [mu - (v - mu)])); // wrong tail
      const p = trim(k / 100, 2);
      return {
        q: `Find the <b>${ord(k)} percentile</b> of ${ctx.measures || ctx.measure + 's'}. (Round to 2 decimal places.)`,
        parts: [{ kind: 'num', label: `${ord(k)} percentile =`, unit, answer: roundTo(v, 2), tol: normTol(v, sd) }],
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
    } while (Math.abs((v - mu) / sd) > (ctx.zMax ? ctx.zMax + 0.2 : 2.9) || !clearOf(v, normTol(v, sd), [mu - (v - mu)]));
    const ps = trim(left / 100, 2);
    return {
      q: `Complete the sentence (round to 2 decimal places): “${dir === 'low' ? ctx.cutLow(p) : ctx.cutHigh(p)}”`,
      parts: [{ kind: 'num', label: 'Cutoff =', unit, answer: roundTo(v, 2), tol: normTol(v, sd) }],
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

  function gen34calc(type) {
    const N = pickNorm34(), ctx = N.ctx, mu = N.mu, sd = N.sd;
    const sub = norm34Sub(type, ctx, mu, sd);
    const h1 = `Sketch a Normal curve centered at μ = ${nf(ctx, mu)} with σ = ${nf(ctx, sd)}, and shade the region you want:` +
      normDiagram(ctx, mu, sd, sub, false);
    return compose({
      section: '3.4', type, desmos: true,
      title: { less: 'Desmos: area to the left', greater: 'Desmos: area to the right', between: 'Desmos: area in between',
        percentile: 'Desmos: find the percentile', cutoff: 'Desmos: find the cutoff' }[type],
      top: `<p class="story">${ctx.story(nf(ctx, mu), nf(ctx, sd))}</p>`,
      subs: [sub], preHints: [h1],
      bottom: `<p class="small">Use Desmos in your other tab.${['less', 'greater', 'between'].indexOf(type) >= 0 ? ' Answer as a percent (rounding is fine).' : ''}</p>`,
      postSol: ['Shaded region:' + normDiagram(ctx, mu, sd, sub, true)],
      meta: { mu, sigma: sd, parts: [sub.meta] },
      signature: `3.4|${type}|${ctx.key}|${mu}|${sd}|${sub.sig}`,
    });
  }

  // ---- shaded-area pictures (3.4 and 3.5) ----
  const aOf = (w) => (/^(SAT|[aeiouAEIOU])/.test(w) ? 'an' : 'a');
  const sdN = (k) => `${k} standard deviation${k === 1 ? '' : 's'}`;
  const specWords = (sp, f) => ({
    L: `everything to the <b>left</b> of ${f(sp.a)}`, R: `everything to the <b>right</b> of ${f(sp.a)}`,
    B: `the middle part <b>between</b> ${f(sp.a)} and ${f(sp.b)}`, O: `<b>both tails</b>: below ${f(sp.a)} and above ${f(sp.b)}`,
  }[sp.t]);
  const SHADE_HINTS = [
    '“Less than”, “at most”, “below” → shade to the <b>left</b>. “More than”, “at least”, “above” → shade to the <b>right</b>.',
    '“Between” or “within” → shade the <b>middle</b>. “Less than … or more than …” / “not between” → shade <b>both tails</b>.',
  ];
  function shadeProblem(o) {
    // o: { section, type, ctx, mu, sd, specs (first = correct), phrase, extraTop, hint3, sig }
    const f = (v) => nf(o.ctx, roundTo(v, 6));
    const po = pictureOptions(o.specs, (sp) => miniNormalSVG({ mu: o.mu, sd: o.sd, spec: sp, fmt: f }));
    if (!po) return null;
    const want = o.specs[0];
    return choiceProblem({
      section: o.section, type: o.type, title: 'Pick the shaded area',
      top: `<p class="story">${o.ctx.story(nf(o.ctx, o.mu), nf(o.ctx, o.sd))}</p>${o.extraTop || ''}`,
      q: `Which picture shows the proportion of ${o.ctx.pl} ${o.phrase}?`,
      label: 'Choose a picture:', options: po.options, correct: po.correct,
      hints: [SHADE_HINTS[0], o.hint2 || SHADE_HINTS[1], o.hint3 || `You want ${specWords(want, f)}.`],
      sol: [`“${o.phrase.replace(/^(that|whose) /, '')}” means ${specWords(want, f)}.`, `The correct picture:${po.options[po.correct]}`],
      metaTop: { mu: o.mu, sigma: o.sd },
      meta: { q: 'shade', mu: o.mu, sigma: o.sd, want, specs: po.specs },
      signature: `${o.section}|${o.type}|${o.ctx.key}|${o.mu}|${o.sd}|${specKey(want)}|${o.phrase}`,
    });
  }
  function gen34shade() {
    for (;;) {
      const N = pickNorm34(), ctx = N.ctx, mu = N.mu, sd = N.sd;
      const U = (v) => nu(ctx, nf(ctx, roundTo(v, 6))), F = (v) => nf(ctx, roundTo(v, 6));
      const g = gridVals(ctx, mu, sd, 0.5, 2.2);
      const t = pick(['L', 'R', 'L', 'R', 'B', 'O']);
      let specs, phrase;
      if (t === 'L' || t === 'R') {
        const v = pick(g), v2 = roundTo(2 * mu - v, 6);
        specs = t === 'L' ? [{ t: 'L', a: v }, { t: 'R', a: v }, { t: 'L', a: v2 }, { t: 'R', a: v2 }]
          : [{ t: 'R', a: v }, { t: 'L', a: v }, { t: 'R', a: v2 }, { t: 'L', a: v2 }];
        phrase = t === 'L'
          ? pick([`that ${ctx.lt(U(v))}`, `whose ${ctx.measure} is at most ${U(v)}`, `whose ${ctx.measure} is below ${U(v)}`])
          : pick([`that ${ctx.gt(U(v))}`, `whose ${ctx.measure} is at least ${U(v)}`, `whose ${ctx.measure} is above ${U(v)}`]);
      } else {
        let v1, v2, within = chance(0.35) && t === 'B';
        if (within) {
          const d = roundTo(Math.abs(pick(g) - mu), 6);
          v1 = roundTo(mu - d, 6); v2 = roundTo(mu + d, 6);
        } else {
          v1 = pick(g); v2 = pick(g);
        }
        if (!(v2 - v1 >= 1.2 * sd)) continue;
        specs = t === 'B' ? [{ t: 'B', a: v1, b: v2 }, { t: 'O', a: v1, b: v2 }, { t: 'L', a: v2 }, { t: 'R', a: v1 }]
          : [{ t: 'O', a: v1, b: v2 }, { t: 'B', a: v1, b: v2 }, { t: 'L', a: v1 }, { t: 'R', a: v2 }];
        phrase = t === 'B'
          ? (within ? `whose ${ctx.measure} is within ${U(v2 - mu)} of the mean` : `that ${ctx.btw(F(v1), U(v2))}`)
          : pick([`whose ${ctx.measure} is less than ${F(v1)} or more than ${U(v2)}`, `whose ${ctx.measure} is <b>not</b> between ${F(v1)} and ${U(v2)}`]);
        if (within) specs[0].within = true;
      }
      const p = shadeProblem({ section: '3.4', type: 'shadeArea', ctx, mu, sd, specs, phrase,
        hint3: specs[0].within ? `Within ${U(specs[0].b - mu)} of the mean ${nf(ctx, mu)} means from ${F(specs[0].a)} to ${F(specs[0].b)}.` : null });
      if (p) return p;
    }
  }

  // ---- which Desmos setup? ----
  function gen34setup() {
    for (;;) {
      const N = pickNorm34(), ctx = N.ctx, mu = N.mu, sd = N.sd;
      const U = (v) => nu(ctx, nf(ctx, v));
      const nd = ND(mu, sd), sw = ND(sd, mu), NI = '−∞', PI = '∞';
      const m = (lo, hi, d) => `${eq(d || nd)} Min = ${lo}, Max = ${hi}`;
      const ms = (lo, hi) => `${eq(nd)} Min = ${lo}, Max = ${hi}`;
      if (chance(0.55)) {
        const kind = pick(['less', 'greater', 'between']);
        const g = gridVals(ctx, mu, sd, 0.3, 2.2);
        let right, wrong, q, meta, plain;
        if (kind === 'between') {
          const x1 = pick(g), x2 = pick(g);
          if (!(x2 - x1 >= 0.8 * sd)) continue;
          right = m(raw(x1), raw(x2));
          wrong = [m(NI, raw(x2)), m(raw(x1), raw(x2), sw), m(raw(x2), PI)];
          q = `that ${ctx.btw(nf(ctx, x1), U(x2))}`;
          meta = { q: 'setupArea', kind, lo: x1, hi: x2 };
          plain = `“Between” → Min = ${raw(x1)} and Max = ${raw(x2)}.`;
        } else {
          const x = pick(g), isLess = kind === 'less';
          const near = x > mu ? [raw(mu), raw(x)] : [raw(x), raw(mu)];
          right = isLess ? m(NI, raw(x)) : m(raw(x), PI);
          wrong = [isLess ? m(raw(x), PI) : m(NI, raw(x)), isLess ? m(NI, raw(x), sw) : m(raw(x), PI, sw), ms(near[0], near[1])];
          q = `that ${isLess ? ctx.lt(U(x)) : ctx.gt(U(x))}`;
          meta = { q: 'setupArea', kind, lo: isLess ? -Infinity : x, hi: isLess ? x : Infinity };
          plain = isLess ? `“Less than” → everything to the left: Min = −∞, Max = ${raw(x)}.` : `“More than” → everything to the right: Min = ${raw(x)}, Max = ∞.`;
        }
        if (!distinctAll([right].concat(wrong))) continue;
        return choiceProblem({
          section: '3.4', type: 'desmosSetup', title: 'Which Desmos setup?',
          top: `<p class="story">${ctx.story(nf(ctx, mu), nf(ctx, sd))}</p>`,
          q: `In Desmos, which setup (with <b>Find Cumulative Probability</b> checked) gives the proportion of ${ctx.pl} ${q}?`,
          right, wrong,
          hints: [
            `${eq('normaldist(μ, σ)')}: the <b>mean comes first</b>, then the standard deviation.`,
            'Min and Max are the edges of the shaded region. A tail that goes on forever uses −∞ or ∞.',
            plain,
          ],
          sol: [`${eq(nd)} (mean ${raw(mu)}, SD ${raw(sd)}). ${plain}`, `Correct: <b>${right}</b>`],
          metaTop: { mu, sigma: sd }, meta: Object.assign({ mu, sigma: sd }, meta),
          signature: `3.4|desmosSetup|A|${ctx.key}|${mu}|${sd}|${right}`,
        });
      }
      // inverse cdf
      let left, q, meta, plain;
      const measures = ctx.measures || ctx.measure + 's';
      if (chance(0.45)) {
        const k = pick(PCTILE_KS.filter((x) => x !== 50));
        left = k / 100;
        q = `Which Desmos command finds the <b>${ord(k)} percentile</b> of ${measures}?`;
        meta = { q: 'setupInv', left, kind: 'percentile', k };
        plain = `The ${ord(k)} percentile has ${k}% = ${trim(left, 2)} of the area to its left.`;
      } else {
        const dir = chance(0.5) ? 'low' : 'high', p = pick(CUT_PS);
        left = dir === 'low' ? p / 100 : 1 - p / 100;
        q = `Which Desmos command completes the sentence “${dir === 'low' ? ctx.cutLow(p) : ctx.cutHigh(p)}”?`;
        meta = { q: 'setupInv', left, kind: 'cutoff', dir, p };
        plain = dir === 'low' ? `The bottom ${p}% is the area to the left: ${trim(left, 2)}.`
          : `The top ${p}% is on the right, so the area to the <b>left</b> of the cutoff is 1 − ${trim(p / 100, 2)} = ${trim(left, 2)}.`;
      }
      const inv = (d, x) => eq(`${d}.inversecdf(${x})`);
      const right = inv(nd, trim(left, 2));
      const wrong = [inv(nd, trim(1 - left, 2)), inv(nd, trim(100 * left, 2)), inv(sw, trim(left, 2))];
      if (!distinctAll([right].concat(wrong))) continue;
      return choiceProblem({
        section: '3.4', type: 'desmosSetup', title: 'Which Desmos command?',
        top: `<p class="story">${ctx.story(nf(ctx, mu), nf(ctx, sd))}</p>`, q, right, wrong,
        hints: [
          `${eq('normaldist(μ, σ).inversecdf(area)')} gives the value with that much area to its <b>left</b>. The mean comes first.`,
          'The area must be a decimal between 0 and 1 (for example 0.2, not 20).',
          plain,
        ],
        sol: [plain, `Correct: <b>${right}</b>`],
        metaTop: { mu, sigma: sd }, meta: Object.assign({ mu, sigma: sd }, meta),
        signature: `3.4|desmosSetup|I|${ctx.key}|${mu}|${sd}|${right}`,
      });
    }
  }

  // ---- interpret a Normal percentile / cutoff / area ----
  function gen34interp() {
    for (;;) {
      const N = pickNorm34(), ctx = N.ctx, mu = N.mu, sd = N.sd, pl = ctx.pl;
      const story = `<p class="story">${ctx.story(nf(ctx, mu), nf(ctx, sd))}</p>`;
      const measures = ctx.measures || ctx.measure + 's';
      const V = (v) => nu(ctx, nfx(ctx, v));
      const variant = pick(['pct', 'cut', 'area']);
      if (variant === 'pct') {
        const k = pick(PCTILE_KS.filter((x) => x !== 25 && x !== 50)), v = mu + sd * invNorm(k / 100);
        if (Math.abs((v - mu) / sd) > (ctx.zMax || 2.9)) continue;
        const lo = Math.min(v, mu), hi = Math.max(v, mu);
        const right = `${k}% of ${pl} ${ctx.lt(V(v))}.`;
        return choiceProblem({
          section: '3.4', type: 'normInterp', title: 'What does the percentile mean?',
          top: `${story}<p>The ${ord(k)} percentile of ${measures} is ${hl(V(v))}.</p>`,
          q: 'Which statement is correct?', right,
          wrong: [`${k}% of ${pl} ${ctx.gt(V(v))}.`, `${100 - k}% of ${pl} ${ctx.lt(V(v))}.`, `${k}% of ${pl} ${ctx.btw(nfx(ctx, lo), V(hi))}.`],
          hints: ['A percentile is a value with that percent of the data <b>below</b> it.', `So the ${ord(k)} percentile has ${k}% of the area to its <b>left</b>.`, `Look for “${k}% … ${ctx.lt('…')}”.`],
          sol: [`The ${ord(k)} percentile means ${k}% of the values are less than it.`, `Correct: <b>${right}</b>`],
          metaTop: { mu, sigma: sd }, meta: { q: 'interpPct', k, v, right },
          signature: `3.4|normInterp|P|${ctx.key}|${mu}|${sd}|${k}`,
        });
      }
      if (variant === 'cut') {
        const dir = chance(0.5) ? 'low' : 'high', p = pick(CUT_PS.filter((x) => x !== 50));
        const v = mu + sd * invNorm(dir === 'low' ? p / 100 : 1 - p / 100);
        if (Math.abs((v - mu) / sd) > (ctx.zMax ? ctx.zMax + 0.2 : 2.9)) continue;
        const sentence = (dir === 'low' ? ctx.cutLow(p) : ctx.cutHigh(p)).replace('$____', nfx(ctx, v)).replace('____', fmt(v, 2));
        const right = dir === 'low' ? `${cap(V(v))} is the ${ord(p)} percentile of ${measures}.` : `${100 - p}% of ${pl} ${ctx.lt(V(v))}.`;
        const wrong = dir === 'low'
          ? [`${cap(V(v))} is the ${ord(100 - p)} percentile of ${measures}.`, `${p}% of ${pl} ${ctx.gt(V(v))}.`, `${100 - p}% of ${pl} ${ctx.lt(V(v))}.`]
          : [`${p}% of ${pl} ${ctx.lt(V(v))}.`, `${100 - p}% of ${pl} ${ctx.gt(V(v))}.`, `${cap(V(v))} is the ${ord(p)} percentile of ${measures}.`];
        return choiceProblem({
          section: '3.4', type: 'normInterp', title: 'Same meaning?',
          top: `${story}<p>“${sentence}”</p>`, q: 'Which statement means the same thing?', right, wrong,
          hints: [
            `${dir === 'low' ? `The bottom ${p}%` : `The top ${p}%`} is a tail of the curve. Which side is it on?`,
            `${dir === 'low' ? `${p}% of the area is to the <b>left</b> of the cutoff.` : `${p}% is to the <b>right</b>, so ${100 - p}% is to the <b>left</b>.`}`,
            'A percentile is the percent of values <b>below</b> a value.',
          ],
          sol: [dir === 'low' ? `${p}% of ${pl} are below ${V(v)}, so ${V(v)} is the ${ord(p)} percentile.` : `${p}% are above ${V(v)}, so ${100 - p}% are below it.`, `Correct: <b>${right}</b>`],
          metaTop: { mu, sigma: sd }, meta: { q: 'interpCut', dir, p, v, right },
          signature: `3.4|normInterp|C|${ctx.key}|${mu}|${sd}|${dir}${p}`,
        });
      }
      const x = pick(gridVals(ctx, mu, sd, 0.3, 2.0)), isLess = chance(0.5);
      const P = 100 * (isLess ? normalCdf((x - mu) / sd) : 1 - normalCdf((x - mu) / sd));
      if (P < 2) continue;
      const ph = isLess ? ctx.lt(nu(ctx, nf(ctx, x))) : ctx.gt(nu(ctx, nf(ctx, x))), op = isLess ? ctx.gt(nu(ctx, nf(ctx, x))) : ctx.lt(nu(ctx, nf(ctx, x)));
      const dp = fmt(P / 100, 4), ps = fmt(P, 2);
      const right = `About ${ps}% of ${pl} ${ph}.`;
      const wrong = [`About ${ps}% of ${pl} ${op}.`, `About ${dp}% of ${pl} ${ph}.`, `About ${fmt(100 - P, 2)}% of ${pl} ${ph}.`];
      if (!distinctAll([right].concat(wrong))) continue;
      return choiceProblem({
        section: '3.4', type: 'normInterp', title: 'What does Desmos tell you?',
        top: `${story}<p>Desmos shows ${hl(dp)} for ${eq(ND(mu, sd))} with Min = ${isLess ? '−∞' : raw(x)} and Max = ${isLess ? raw(x) : '∞'}.</p>`,
        q: 'What does this number mean?', right, wrong,
        hints: ['Desmos gives the <b>area</b> (a proportion between 0 and 1). Multiply by 100 for a percent.',
          `Min = ${isLess ? '−∞' : raw(x)} and Max = ${isLess ? raw(x) : '∞'}: is that the area to the left or to the right of ${nf(ctx, x)}?`,
          `${dp} = ${ps}%, for ${pl} that ${ph}.`],
        sol: [`${dp} × 100 = ${ps}%. The region from ${isLess ? '−∞' : raw(x)} to ${isLess ? raw(x) : '∞'} is ${isLess ? 'below' : 'above'} ${nf(ctx, x)}.`, `Correct: <b>${right}</b>`],
        metaTop: { mu, sigma: sd }, meta: { q: 'interpArea', x, isLess, P, right },
        signature: `3.4|normInterp|A|${ctx.key}|${mu}|${sd}|${x}|${isLess}`,
      });
    }
  }

  function gen34(type) {
    if (type === 'shadeArea') return gen34shade();
    if (type === 'desmosSetup') return gen34setup();
    if (type === 'normInterp') return gen34interp();
    return gen34calc(type);
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
    const pctPart = (P) => ({ kind: 'num', label: pLabel, unit: '%', answer: P, tol: PCT_TOL, placeholder: 'e.g. 13.5' });
    // tails beyond 3σ (0.15% / 99.85%) are skipped: 0.3% and 99.7% (common slips) would land within the rounding tolerance
    const ks = [];
    for (let k = -Math.min(kMax, 2); k <= Math.min(kMax, 2); k++) if (k !== 0) ks.push(k);
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
      // skip 49.85% (mean to ±3σ): its complement 50.15% and the slip 50% sit within the tolerance
      do { k1 = int(-kMax, kMax); k2 = int(-kMax, kMax); } while (!(k2 > k1) || (k2 - k1 === 1 && chance(0.6)) || (k1 === 0 && k2 === 3) || (k1 === -3 && k2 === 0));
      const terms = betweenTerms(k1, k2);
      const P = sumTerms(terms);
      return {
        q: `${what} of ${ctx.pl} ${ctx.btw(f(k1), U(k2))}?`,
        parts: [pctPart(P)],
        locate: `${locate(k1)}<br>${locate(k2)}`,
        add: terms.length === 1 ? `Only one piece of the picture lies between ${f(k1)} and ${f(k2)}. How big is it?`
          : `Add the pieces between ${f(k1)} and ${f(k2)}: ${eq(termsStr(terms) + ' = ?')}`,
        sol: [
          `${locate(k1)} ${locate(k2)}`,
          terms.length === 1 ? `That is one piece of the 68–95–99.7 picture: <b>${trim(P, 2)}%</b>` : `Area between: ${eq(termsStr(terms))} = <b>${trim(P, 2)}%</b>`,
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
        parts: [{ kind: 'num', label: `${cap(ctx.measure)} =`, unit, answer: V(k), tol: normTol(V(k), sd) }],
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
    return null;
  }

  function gen35calc(type) {
    const ctx = pick(NORM_CTX);
    const ms = pick(ctx.p35), mu = ms[0], sd = ms[1];
    const kMax = ctx.kMax || 3;
    const svg = (extra) => normalSVG(Object.assign({ mu, sigma: sd, ticks: empTicks(ctx, mu, sd, kMax), caption: ctx.caption }, extra || {}));
    const sub = emp35Sub(type, ctx, mu, sd);
    const regionHint = `The 68–95–99.7 rule splits the curve into these pieces (they add up to 100%):${svg({ regions: true })}`;
    return compose({
      section: '3.5', type,
      title: { below: 'Empirical rule: below', above: 'Empirical rule: above', between: 'Empirical rule: in between',
        valueAtPct: 'Empirical rule: percentile' }[type],
      top: `<p class="story">${ctx.story(nf(ctx, mu), nf(ctx, sd))}</p>${svg()}`,
      subs: [{ q: sub.q, parts: sub.parts, hints: [sub.locate, regionHint, sub.add], sol: sub.sol }],
      bottom: `<p class="small">Use the empirical rule (68–95–99.7).${type !== 'valueAtPct' ? ' Answer as a percent.' : ''}</p>`,
      postSol: [`Shaded region:${svg({ shade: sub.shade, regions: true })}`],
      meta: { mu, sigma: sd, kMax, parts: [sub.meta] },
      signature: `3.5|${type}|${ctx.key}|${mu}|${sd}|${sub.sig}`,
    });
  }
  function empTicks(ctx, mu, sd, kMax) {
    const ticks = [];
    for (let k = -kMax; k <= kMax; k++) ticks.push({ v: mu + k * sd, label: nf(ctx, roundTo(mu + k * sd, 6)), prio: 2 - Math.abs(k) * 0.1 });
    return ticks;
  }
  function pick35() {
    const ctx = pick(NORM_CTX), ms = pick(ctx.p35);
    return { ctx, mu: ms[0], sd: ms[1], story: `<p class="story">${ctx.story(nf(ctx, ms[0]), nf(ctx, ms[1]))}</p>` };
  }
  const RULE = { 1: 68, 2: 95, 3: 99.7 };

  // ---- about what percent ... within / above / below k SDs? ----
  const SDPCT = [
    { key: 'within', ks: [1, 2, 3], ans: (k) => RULE[k], words: (k) => `within ${sdN(k)} of the mean`,
      wrong: (k) => ({ 1: [95, 34, 32, 84], 2: [68, 47.5, 5, 97.5], 3: [95, 68, 0.3] })[k],
      why: (k) => `The 68–95–99.7 rule: about ${RULE[k]}% of values are within ${sdN(k)} of the mean.` },
    { key: 'above', ks: [1, 2], ans: (k) => (k === 1 ? 16 : 2.5), words: (k) => `more than ${sdN(k)} above the mean`,
      wrong: (k) => (k === 1 ? [32, 34, 84, 68] : [5, 47.5, 97.5, 95]),
      why: (k) => `${RULE[k]}% are within ${sdN(k)}, so ${trim(100 - RULE[k], 2)}% are outside, split evenly between the two tails: ${trim((100 - RULE[k]) / 2, 2)}% above.` },
    { key: 'below', ks: [1, 2], ans: (k) => (k === 1 ? 16 : 2.5), words: (k) => `more than ${sdN(k)} below the mean`,
      wrong: (k) => (k === 1 ? [32, 34, 84, 68] : [5, 47.5, 97.5, 95]),
      why: (k) => `${RULE[k]}% are within ${sdN(k)}, so ${trim(100 - RULE[k], 2)}% are outside, split evenly between the two tails: ${trim((100 - RULE[k]) / 2, 2)}% below.` },
    { key: 'outside', ks: [1, 2], ans: (k) => 100 - RULE[k], words: (k) => `more than ${sdN(k)} away from the mean (in either direction)`,
      wrong: (k) => (k === 1 ? [16, 68, 34, 84] : [2.5, 95, 47.5, 97.5]),
      why: (k) => `${RULE[k]}% are within ${sdN(k)}, so 100% − ${RULE[k]}% = ${trim(100 - RULE[k], 2)}% are farther away.` },
    { key: 'meanUp', ks: [1, 2], ans: (k) => RULE[k] / 2, words: (k) => `between the mean and ${sdN(k)} above the mean`,
      wrong: (k) => (k === 1 ? [68, 16, 50, 84] : [95, 2.5, 50, 97.5]),
      why: (k) => `${RULE[k]}% are within ${sdN(k)} (on both sides), and the curve is symmetric, so half of that, ${trim(RULE[k] / 2, 2)}%, is on one side.` },
    { key: 'lessUp', ks: [1, 2], ans: (k) => 50 + RULE[k] / 2, words: (k) => `below the value that is ${sdN(k)} above the mean`,
      wrong: (k) => (k === 1 ? [68, 34, 16] : [95, 47.5, 2.5]),
      why: (k) => `50% are below the mean, plus ${trim(RULE[k] / 2, 2)}% between the mean and ${sdN(k)} above: 50% + ${trim(RULE[k] / 2, 2)}% = ${trim(50 + RULE[k] / 2, 2)}%.` },
  ];
  function gen35sdPct() {
    for (;;) {
      const S = pick35(), { ctx, mu, sd } = S, R = pick(SDPCT), k = pick(R.ks);
      if (k > (ctx.kMax || 3)) continue;
      const ans = R.ans(k), wrongs = shuffle(R.wrong(k).filter((w) => Math.abs(w - ans) > 0.5)).slice(0, 3);
      const pctS = (x) => `${trim(x, 2)}%`;
      const lo = mu - k * sd, hi = mu + k * sd;
      return choiceProblem({
        section: '3.5', type: 'sdPct', title: 'The 68–95–99.7 rule',
        top: S.story, q: `About what percent of ${ctx.pl} have ${aOf(ctx.measure)} ${ctx.measure} ${R.words(k)}?`,
        right: pctS(ans), wrong: wrongs.map(pctS),
        hints: [
          'About <b>68%</b> of values are within 1 SD of the mean, <b>95%</b> within 2 SDs, and <b>99.7%</b> within 3 SDs.',
          `Here ${sdN(k)} from the mean is from ${nf(ctx, roundTo(lo, 6))} to ${nf(ctx, roundTo(hi, 6))}. Sketch it and shade the part you want.`,
          'The curve is symmetric: whatever is not in the middle is split evenly between the two tails.',
        ],
        sol: [R.why(k), `So about <b>${pctS(ans)}</b> of ${ctx.pl} have ${aOf(ctx.measure)} ${ctx.measure} ${R.words(k)}.`],
        metaTop: { mu, sigma: sd }, meta: { q: 'sdPct', rel: R.key, k, ans },
        signature: `3.5|sdPct|${ctx.key}|${mu}|${sd}|${R.key}${k}|${wrongs.join(',')}`,
      });
    }
  }

  // ---- interpret the 68–95–99.7 rule in context ----
  function gen35rule() {
    for (;;) {
      const S = pick35(), { ctx, mu, sd } = S, kMax = ctx.kMax || 3;
      const k = int(1, Math.min(3, kMax));
      const F = (v) => nf(ctx, roundTo(v, 6)), U = (v) => nu(ctx, F(v));
      const lo = mu - k * sd, hi = mu + k * sd, pc = RULE[k];
      const other = [1, 2, 3].filter((j) => j !== k && j <= kMax);
      if (chance(0.5)) {
        const k2 = pick(other);
        const right = `About ${pc}% of ${ctx.pl} ${ctx.btw(F(lo), U(hi))}.`;
        const wrong = [
          `About ${RULE[k2]}% of ${ctx.pl} ${ctx.btw(F(lo), U(hi))}.`,
          `About ${pc}% of ${ctx.pl} ${ctx.lt(U(hi))}.`,
          `About ${pc}% of ${ctx.pl} ${ctx.btw(F(mu - k2 * sd), U(mu + k2 * sd))}.`,
        ];
        if (!distinctAll([right].concat(wrong))) continue;
        return choiceProblem({
          section: '3.5', type: 'ruleInterp', title: 'Which statement is true?',
          top: S.story, q: 'According to the empirical rule, which statement is true?', right, wrong,
          hints: [
            '68% within 1 SD, 95% within 2 SDs, 99.7% within 3 SDs — always measured on <b>both</b> sides of the mean.',
            `μ ± 1σ: ${F(mu - sd)} to ${F(mu + sd)}. μ ± 2σ: ${F(mu - 2 * sd)} to ${F(mu + 2 * sd)}.${kMax >= 3 ? ` μ ± 3σ: ${F(mu - 3 * sd)} to ${F(mu + 3 * sd)}.` : ''}`,
            `Check each statement: does its percent match its interval? (“Less than ${F(hi)}” also includes the lower tail.)`,
          ],
          sol: [`${F(lo)} to ${F(hi)} is μ ± ${k}σ, which holds about ${pc}% of the values.`, `Correct: <b>${right}</b>`],
          metaTop: { mu, sigma: sd }, meta: { q: 'ruleTrue', k, right },
          signature: `3.5|ruleInterp|T|${ctx.key}|${mu}|${sd}|${k}|${k2}`,
        });
      }
      const iv = (a, b) => `Between ${F(a)} and ${U(b)}`;
      const right = iv(lo, hi);
      const wrong = other.map((j) => iv(mu - j * sd, mu + j * sd)).concat([iv(mu, hi)]);
      if (wrong.length < 2 || !distinctAll([right].concat(wrong))) continue;
      return choiceProblem({
        section: '3.5', type: 'ruleInterp', title: 'The middle ' + pc + '%',
        top: S.story, q: `According to the empirical rule, the middle <b>${pc}%</b> of ${ctx.pl} have ${aOf(ctx.measure)} ${ctx.measure} …`, right, wrong,
        hints: [
          `The middle ${pc}% is centered at the mean and reaches ${sdN(k)} out on <b>each</b> side.`,
          `Lower end: ${eq(`${F(mu)} − ${k === 1 ? '' : k + ' × '}${F(sd)}`)}. Upper end: ${eq(`${F(mu)} + ${k === 1 ? '' : k + ' × '}${F(sd)}`)}.`,
          `${F(lo)} to ${F(hi)}.`,
        ],
        sol: [`Middle ${pc}% = within ${sdN(k)} of the mean: ${eq(`${F(mu)} ± ${k === 1 ? '' : k + ' × '}${F(sd)}`)}.`, `Correct: <b>${right}</b>`],
        metaTop: { mu, sigma: sd }, meta: { q: 'ruleMiddle', k, right },
        signature: `3.5|ruleInterp|M|${ctx.key}|${mu}|${sd}|${k}`,
      });
    }
  }

  // ---- which picture (described in standard deviations)? ----
  function gen35shade() {
    for (;;) {
      const S = pick35(), { ctx, mu, sd } = S, kMax = Math.min(2, ctx.kMax || 3);
      const k = int(1, kMax), k2 = k === 1 ? 2 : 1;
      const V = (j) => roundTo(mu + j * sd, 6);
      const R = pick(['within', 'above', 'below', 'outside', 'meanUp']);
      const specs = {
        within: [{ t: 'B', a: V(-k), b: V(k) }, { t: 'O', a: V(-k), b: V(k) }, { t: 'B', a: V(-k2), b: V(k2) }, { t: 'L', a: V(k) }],
        above: [{ t: 'R', a: V(k) }, { t: 'L', a: V(k) }, { t: 'O', a: V(-k), b: V(k) }, { t: 'R', a: V(k2) }],
        below: [{ t: 'L', a: V(-k) }, { t: 'R', a: V(-k) }, { t: 'O', a: V(-k), b: V(k) }, { t: 'L', a: V(-k2) }],
        outside: [{ t: 'O', a: V(-k), b: V(k) }, { t: 'B', a: V(-k), b: V(k) }, { t: 'R', a: V(k) }, { t: 'O', a: V(-k2), b: V(k2) }],
        meanUp: [{ t: 'B', a: V(0), b: V(k) }, { t: 'B', a: V(-k), b: V(k) }, { t: 'R', a: V(k) }, { t: 'B', a: V(0), b: V(k2) }],
      }[R];
      const words = {
        within: `within ${sdN(k)} of the mean`, above: `more than ${sdN(k)} above the mean`, below: `more than ${sdN(k)} below the mean`,
        outside: `more than ${sdN(k)} away from the mean`, meanUp: `between the mean and ${sdN(k)} above the mean`,
      }[R];
      const F = (v) => nf(ctx, roundTo(v, 6));
      const p = shadeProblem({
        section: '3.5', type: 'shade35', ctx, mu, sd, specs, phrase: `whose ${ctx.measure} is ${words}`,
        hint2: `First find the values: μ ± σ = ${F(V(-1))} and ${F(V(1))}; μ ± 2σ = ${F(V(-2))} and ${F(V(2))}.`,
      });
      if (p) return p;
    }
  }

  function gen35(type) {
    if (type === 'sdPct') return gen35sdPct();
    if (type === 'ruleInterp') return gen35rule();
    if (type === 'shade35') return gen35shade();
    return gen35calc(type);
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
  // calc = compute a number (or a choice that needs a computation); interp = interpretation / picture choice
  const CATEGORY = {
    '3.1': { pctOfValue: 'calc', valueAtPct: 'calc', dotplot: 'calc', dotplotValue: 'calc',
      interpret: 'interp', pctVsPercent: 'interp', higherPct: 'interp', whatIf: 'interp' },
    '3.2': { height: 'calc', less: 'calc', greater: 'calc', between: 'calc', percentile: 'calc', mean: 'calc',
      uniInterp: 'interp', validDensity: 'interp', interpMean: 'interp' },
    '3.3': { single: 'calc', compare: 'calc', unusual: 'calc', findX: 'calc', zWords: 'interp', zSign: 'interp' },
    '3.4': { less: 'calc', greater: 'calc', between: 'calc', percentile: 'calc', cutoff: 'calc',
      shadeArea: 'interp', desmosSetup: 'interp', normInterp: 'interp' },
    '3.5': { below: 'calc', above: 'calc', between: 'calc', valueAtPct: 'calc', sdPct: 'interp', ruleInterp: 'interp', shade35: 'interp' },
  };
  const TYPES = {};
  SECTIONS.forEach((sec) => { TYPES[sec] = Object.keys(CATEGORY[sec]); });
  // relative weights when the type is not forced (about 60% calc / 40% interp in every section)
  const WEIGHTS = {
    '3.1': { pctOfValue: 3, valueAtPct: 3, dotplot: 2, dotplotValue: 2, interpret: 2, pctVsPercent: 1.5, higherPct: 1.5, whatIf: 1.5 },
    '3.2': { height: 1, less: 2, greater: 2, between: 2, percentile: 2, mean: 1, uniInterp: 2.5, validDensity: 1.5, interpMean: 2 },
    '3.3': { single: 2.5, compare: 3, unusual: 1.5, findX: 2, zWords: 3, zSign: 3 },
    '3.4': { less: 2, greater: 2, between: 2, percentile: 2, cutoff: 2, shadeArea: 2.6, desmosSetup: 2, normInterp: 2 },
    '3.5': { below: 2, above: 2, between: 2, valueAtPct: 2, sdPct: 2, ruleInterp: 1.5, shade35: 1.8 },
  };
  // boss shields (opts.hard) draw from the harder calculation types; still exactly one part
  const HARD_TYPES = {
    '3.1': ['pctOfValue', 'valueAtPct', 'dotplot', 'dotplotValue', 'higherPct'],
    '3.2': ['less', 'greater', 'between', 'percentile', 'validDensity'],
    '3.3': ['single', 'compare', 'findX', 'unusual'],
    '3.4': ['less', 'greater', 'between', 'percentile', 'cutoff'],
    '3.5': ['below', 'above', 'between', 'valueAtPct', 'shade35'],
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
      p = GEN[section](type);
      if (!avoid.has(p.signature)) break;
    }
    return p;
  }

  const API = {
    SECTIONS, SECTION_INFO, TYPES, CATEGORY, generate, check, normalCdf, invNorm,
    parseNum,
    _internal: { CUM, REG, belowTerms, aboveTerms, betweenTerms, sumTerms, countBelow, roundTo, fmt, trim, ord, normalSVG, uniformSVG, dotplotSVG,
      miniNormalSVG, miniUniformSVG, MINI, COLORS: C, NORM_CTX, PCT_TOL, Z_TOL, normTol, uniTol, WEIGHTS, HARD_TYPES },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Problems = API;
})(typeof window !== 'undefined' ? window : globalThis);
