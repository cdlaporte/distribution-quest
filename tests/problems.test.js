// Run with:  node tests/problems.test.js            (add --samples to print 2 sample problems per type)
// Generates thousands of problems of every type, checks their shape, and independently
// re-computes every answer from the hidden _meta data. Exits with code 1 on any failure.
'use strict';
const assert = require('assert');
const P = require('../js/problems.js');

const N = Number(process.env.N) || 2000; // problems per type
const N_HARD = Number(process.env.N_HARD) || 1500; // hard problems per section
let failures = 0;
let problemsChecked = 0;

function test(name, fn) {
  try {
    fn();
    console.log('ok   ' + name);
  } catch (e) {
    failures++;
    console.log('FAIL ' + name + '\n     ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n     ') : e));
  }
}

// ---------------------------------------------------------------------------
// independent math (deliberately NOT using the module's normalCdf / invNorm)
// ---------------------------------------------------------------------------
const pdf = (z) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
function Phi(z) { // Simpson's rule on [0, |z|]
  if (z === Infinity) return 1;
  if (z === -Infinity) return 0;
  const a = Math.abs(z);
  if (a > 12) return z > 0 ? 1 : 0;
  const n = 4000, h = a / n;
  let s = pdf(0) + pdf(a);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * pdf(i * h);
  const area = s * h / 3;
  return z >= 0 ? 0.5 + area : 0.5 - area;
}
function PhiInv(p) { // bisection on Phi
  let lo = -10, hi = 10;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (Phi(m) < p) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}
const round = (x, d) => { const m = 10 ** d; return Math.sign(x) * Math.round(Math.abs(x) * m + 1e-9) / m; };
const EMP = { '-3': 0.15, '-2': 2.5, '-1': 16, '0': 50, '1': 84, '2': 97.5, '3': 99.85 };
const below = (data, v) => data.filter((x) => x < v - 1e-9).length;
const atOrBelow = (data, v) => data.filter((x) => x <= v + 1e-9).length;
const near = (a, b, eps, msg) => assert(Math.abs(a - b) <= (eps || 1e-9), `${msg || ''} expected ${b}, got ${a}`);
const passes = (part, x) => P.check(part, typeof x === 'number' ? String(x) : x);

// ---------------------------------------------------------------------------
// shape checks
// ---------------------------------------------------------------------------
const I = P._internal;
const PCT_TOL = I.PCT_TOL, Z_TOL = I.Z_TOL;
const MINI = I.MINI;
const SHADE = I.COLORS.shadeOpt;
function htmlStrings(p) {
  return [p.title, p.promptHTML].concat(p.hints, p.solution, p.parts.map((q) => q.label),
    p.parts.filter((q) => q.kind === 'choice').reduce((a, q) => a.concat(q.options), []));
}
let maxSvgHeight = 0;
const strip = (h) => h.replace(/<svg[\s\S]*?<\/svg>/g, ' [diagram] ').replace(/<div class="data">[\s\S]*?<\/div>/g, ' [data] ')
  .replace(/<table>[\s\S]*?<\/table>/g, ' [table] ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
function checkSvg(svg, maxW, maxH) {
  assert(!/undefined|NaN|Infinity|null/.test(svg), 'bad number in svg');
  assert(/xmlns="http:\/\/www.w3.org\/2000\/svg"/.test(svg), 'svg xmlns');
  assert(!/(href|src)=/.test(svg), 'svg has external reference');
  for (const tag of ['text', 'path', 'line', 'rect', 'circle', 'polygon']) {
    const open = (svg.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
    const closed = (svg.match(new RegExp('<' + tag + '[^>]*/>', 'g')) || []).length + (svg.match(new RegExp('</' + tag + '>', 'g')) || []).length;
    assert.strictEqual(open, closed, `unclosed <${tag}>`);
  }
  const head = svg.match(/^<svg[^>]*>/)[0];
  const w = Number((head.match(/ width="(\d+)"/) || [])[1]), ht = Number((head.match(/ height="(\d+)"/) || [])[1]);
  assert(w > 0 && ht > 0, 'svg needs explicit width and height');
  assert(w <= maxW && ht <= maxH, `svg too big ${w}x${ht} (max ${maxW}x${maxH})`);
  return { w, ht };
}
function checkShape(p, section, type) {
  assert.strictEqual(p.section, section, 'section');
  if (type) assert.strictEqual(p.type, type, 'type');
  assert(P.TYPES[section].includes(p.type), 'type listed in TYPES');
  assert(typeof p.title === 'string' && p.title.length > 2 && p.title.length < 45, 'title: ' + p.title);
  assert(typeof p.promptHTML === 'string' && p.promptHTML.length > 20, 'prompt');
  assert(Array.isArray(p.parts) && p.parts.length === 1, `exactly one part (got ${p.parts.length})`);
  assert(Array.isArray(p.hints) && p.hints.length >= 2 && p.hints.length <= 4, 'hints count ' + p.hints.length);
  assert(Array.isArray(p.solution) && p.solution.length >= 2, 'solution');
  assert.strictEqual(p.desmos, section === '3.4' && P.CATEGORY['3.4'][p.type] === 'calc', 'desmos flag');
  assert(typeof p.signature === 'string' && p.signature.length > 5, 'signature');
  assert(p._meta && Array.isArray(p._meta.parts) && p._meta.parts.length === 1, 'one meta part');
  // Chromebook modal budget: <= ~330 chars of prompt text and at most one diagram <= 200 px tall
  assert(strip(p.promptHTML).length <= 330, `prompt too long (${strip(p.promptHTML).length}): ${strip(p.promptHTML)}`);
  assert((p.promptHTML.match(/<svg[\s>]/g) || []).length <= 1, 'at most one diagram in the prompt');
  for (const h of htmlStrings(p)) {
    assert(typeof h === 'string' && h.length > 0, 'empty html string');
    assert(!/undefined|NaN|Infinity|null|\[object/.test(h.replace(/<svg[\s\S]*?<\/svg>/g, '')), `bad text in ${p.type}: ${h}`);
    const nOpen = (h.match(/<svg[\s>]/g) || []).length, nClose = (h.match(/<\/svg>/g) || []).length;
    assert.strictEqual(nOpen, nClose, 'unbalanced <svg>');
    for (const svg of h.match(/<svg[\s\S]*?<\/svg>/g) || []) {
      const isOption = new RegExp(`^<svg[^>]* width="${MINI.W}"`).test(svg); // 150x70 picture (an option, or one shown in a solution)
      const { ht } = isOption ? checkSvg(svg, 170, 80) : checkSvg(svg, 560, 200);
      if (!isOption) maxSvgHeight = Math.max(maxSvgHeight, ht);
    }
    for (const tag of ['b', 'p', 'span', 'div', 'i', 'table', 'tr', 'td', 'th']) {
      const open = (h.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
      const close = (h.match(new RegExp('</' + tag + '>', 'g')) || []).length;
      assert.strictEqual(open, close, `unbalanced <${tag}> in: ${h}`);
    }
  }
  const classes = (p.promptHTML + p.hints.join('') + p.solution.join('') + htmlStrings(p).join('')).match(/class="([^"]*)"/g) || [];
  for (const c of classes) {
    for (const name of c.slice(7, -1).split(/\s+/)) {
      assert(['story', 'data', 'big', 'eq', 'hl', 'small', 'good', 'bad'].includes(name), 'unknown class ' + name);
    }
  }
  for (const m of p.promptHTML.match(/<div class="data">[\s\S]*?<\/div>/g) || []) {
    m.slice(18, -6).split('<br>').forEach((line) => {
      assert(line.replace(/<b>[^<]*:<\/b>/, '').replace(/<[^>]+>/g, '').split(',').length <= 20, 'data list too long');
    });
  }
  const part = p.parts[0];
  assert(typeof part.label === 'string', 'label');
  if (part.kind === 'num') {
    assert(Number.isFinite(part.answer), 'answer finite');
    assert(Number.isFinite(part.tol) && part.tol > 0, 'tol');
    assert(typeof part.unit === 'string', 'unit string');
    assert(passes(part, String(part.answer)), `own answer ${part.answer} must pass`);
    assert(passes(part, part.answer.toFixed(6)), 'own answer (fixed) must pass');
    assert(!passes(part, String(part.answer + part.tol * 1.5 + 0.001)), 'beyond tol must fail');
    assert(!passes(part, String(part.answer - part.tol * 1.5 - 0.001)), 'beyond tol must fail');
    if (part.unit === '%' || part.unit === 'th percentile') {
      assert.strictEqual(part.tol, PCT_TOL, 'percent tolerance');
      assert(part.answer >= 2 && part.answer <= 99.7, 'percent range ' + part.answer);
      assert(passes(part, fl(part.answer)) || part.answer % 1 > 0.999, 'rounding down passes');
      assert(passes(part, ce(part.answer)), 'rounding up passes');
      assert(!passes(part, part.answer / 100), 'a proportion typed instead of a percent must fail');
    }
  } else {
    assert.strictEqual(part.kind, 'choice', 'kind');
    assert(Array.isArray(part.options) && part.options.length >= 2 && part.options.length <= 4, 'options');
    assert.strictEqual(new Set(part.options).size, part.options.length, 'unique options');
    assert(part.options.every((o) => typeof o === 'string' && o.length > 0 && o.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').length <= 110), 'option text');
    const nSvg = part.options.filter((o) => /<svg/.test(o)).length;
    if (!nSvg) assert(new Set(part.options.map((o) => o.replace(/<[^>]+>/g, '').trim())).size === part.options.length, 'options read differently');
    assert(nSvg === 0 || nSvg === part.options.length, 'all or none of the options are pictures');
    part.options.forEach((o) => assert(!/<(div|p|table|ul|ol|h\d)[\s>]/.test(o), 'no block elements inside a choice button'));
    if (nSvg) part.options.forEach((o) => { assert(/^<svg[\s\S]*<\/svg>$/.test(o), 'picture option is a single svg'); checkSvg(o, 170, 80); });
    assert(Number.isInteger(part.correct) && part.correct >= 0 && part.correct < part.options.length, 'correct index');
    part.options.forEach((o, i) => assert.strictEqual(P.check(part, i), i === part.correct, 'choice check'));
    assert(P.check(part, String(part.correct)), 'choice check with string index');
    assert(!P.check(part, ''), 'empty choice fails');
  }
}

// ---------------------------------------------------------------------------
// picture checks: recompute the shaded x-ranges of a 150x70 option picture
// ---------------------------------------------------------------------------
function shadedRanges(svg) {
  const out = [];
  const re = new RegExp(`<(path|rect) ([^>]*)fill="${SHADE.replace(/[().]/g, '\\$&')}"`, 'g');
  let m;
  while ((m = re.exec(svg))) {
    const attrs = m[2];
    if (m[1] === 'rect') {
      const x = Number(attrs.match(/x="([-\d.]+)"/)[1]), w = Number(attrs.match(/width="([-\d.]+)"/)[1]);
      out.push([x, x + w]);
    } else {
      const xs = attrs.match(/d="([^"]*)"/)[1].match(/[ML]([-\d.]+) /g).map((t) => Number(t.slice(1)));
      out.push([Math.min(...xs), Math.max(...xs)]);
    }
  }
  return out.sort((a, b) => a[0] - b[0]);
}
function expectedRanges(spec, lo, hi, X) {
  const R = { L: [[lo, spec.a]], R: [[spec.a, hi]], B: [[spec.a, spec.b]], O: [[lo, spec.a], [spec.b, hi]] }[spec.t];
  return R.map(([a, b]) => [X(a), X(b)]);
}
function checkPictures(part, mp, kind) {
  let X, lo, hi;
  if (kind === 'normal') {
    const xmin = mp.mu - MINI.span * mp.sigma, xmax = mp.mu + MINI.span * mp.sigma;
    X = (v) => MINI.X0 + ((v - xmin) / (xmax - xmin)) * (MINI.X1 - MINI.X0);
    lo = xmin; hi = xmax;
  } else {
    const w = mp.b - mp.a, dmin = mp.a - 0.12 * w, dmax = mp.b + 0.12 * w;
    X = (v) => MINI.X0 + ((v - dmin) / (dmax - dmin)) * (MINI.X1 - MINI.X0);
    lo = mp.a; hi = mp.b;
  }
  const key = (sp) => sp.t + (sp.t === 'L' || sp.t === 'R' ? [sp.a] : [sp.a, sp.b]).map((v) => Math.round(v * 1e6) / 1e6).join('|');
  assert.strictEqual(mp.specs.length, part.options.length);
  assert.strictEqual(mp.specs.filter((sp) => key(sp) === key(mp.want)).length, 1, 'exactly one picture matches the question');
  assert.strictEqual(key(mp.specs[part.correct]), key(mp.want), 'correct picture is the wanted one');
  part.options.forEach((svg, i) => {
    const got = shadedRanges(svg), want = expectedRanges(mp.specs[i], lo, hi, X);
    assert.strictEqual(got.length, want.length, 'number of shaded regions');
    got.forEach((g, j) => assert(Math.abs(g[0] - want[j][0]) < 0.3 && Math.abs(g[1] - want[j][1]) < 0.3, `shaded range ${g} vs ${want[j]}`));
  });
}
function questionText(p) { return strip(p.promptHTML).replace(/^[\s\S]*Which picture shows/, ''); }
const fl = (x) => Math.floor(x + 1e-9), ce = (x) => Math.ceil(x - 1e-9);
// the ways a student might round a (wrong) value at the precision this tolerance allows
function roundingsFor(tol, x) {
  if (tol >= 0.9) return [x, fl(x), ce(x), round(x, 1)];
  if (tol >= 0.05) return [x, round(x, 1), round(x, 2)];
  return [x, round(x, 2), round(x, 3)];
}

// ---------------------------------------------------------------------------
// independent recomputation of every answer from _meta
// ---------------------------------------------------------------------------
function recompute(p) {
  const m = p._meta;
  const mp = m.parts[0], part = p.parts[0];
  const tag = `${p.section}/${p.type}/${mp.q}`;
  const right = part.kind === 'choice' ? part.options[part.correct] : null;
  switch (p.section) {
    case '3.1': {
      const data = m.data;
      if (mp.q === 'pct') {
        const c = below(data, mp.value), n = data.length;
        assert(n <= 40, 'small data set');
        const exact = 100 * c / n;
        near(part.answer, exact, 1e-4, tag);
        assert(data.includes(mp.value), 'value in data');
        [fl(exact), ce(exact), Math.round(exact), round(exact, 1), round(exact, 2) + '%'].forEach((x) => assert(passes(part, x), `rounding ${x} passes`));
        const wrong = 100 * atOrBelow(data, mp.value) / n;
        roundingsFor(part.tol, wrong).forEach((x) => assert(!passes(part, x), `'at or below' (${x}) must fail`));
      } else if (mp.q === 'val') {
        const n = data.length;
        const distinct = [...new Set(data)];
        const matches = distinct.filter((v) => Math.abs(100 * below(data, v) / n - mp.k) < 1);
        assert.strictEqual(matches.length, 1, `exactly one value at the ${mp.k}th percentile`);
        near(part.answer, matches[0], 1e-9, tag);
        const close = distinct.filter((v) => Math.abs(100 * below(data, v) / n - mp.k) < 2.5);
        assert.strictEqual(close.length, 1, 'no near-ties for the k-th percentile');
        const wrongVals = distinct.filter((v) => Math.abs(100 * atOrBelow(data, v) / n - mp.k) < 1 && v !== matches[0]);
        wrongVals.forEach((v) => assert(!passes(part, v), 'at-or-below value must fail'));
        assert(mp.k > 0 && mp.k < 100);
      } else if (mp.q === 'interpret') {
        assert(right.startsWith(mp.k + '% of'), 'correct interpretation starts with k%: ' + right);
        assert(/lower|shorter|fewer|less|slower/.test(right), 'correct interpretation says less: ' + right);
      } else if (mp.q === 'pctVsPercent') {
        assert(right.startsWith(`${mp.k}% of the class scored lower`), right);
        assert(part.options.some((o) => o.startsWith(`${mp.pc}% of the class`)), 'percent-correct distractor present');
      } else if (mp.q === 'pctWho') {
        assert(Math.abs(mp.ks[0] - mp.ks[1]) >= 10, 'clearly different percentiles');
        assert.strictEqual(part.correct, mp.ks[0] > mp.ks[1] ? 0 : 1);
      } else if (mp.q === 'higherPct') {
        const pct = mp.groups.map((g) => {
          assert.strictEqual(g.data.filter((v) => v === g.x).length, 1, 'value appears once');
          assert(g.data.length <= 12);
          return 100 * below(g.data, g.x) / g.data.length;
        });
        assert(Math.abs(pct[0] - pct[1]) >= 8, 'clearly different');
        assert.strictEqual(part.correct, pct[0] > pct[1] ? 0 : 1);
      } else if (mp.q === 'whatIf') {
        const before = mp.c / mp.n, after = (mp.c + mp.dc) / (mp.n + mp.dn);
        const eff = Math.abs(after - before) < 1e-12 ? 'same' : after > before ? 'up' : 'down';
        assert.strictEqual(eff, mp.effect);
        assert.strictEqual(right, { up: 'It goes up.', down: 'It goes down.', same: 'It stays the same.' }[eff]);
      } else throw new Error('unknown meta ' + tag);
      break;
    }
    case '3.2': {
      const a = mp.a !== undefined ? mp.a : m.a, b = mp.b !== undefined ? mp.b : m.b, w = b - a;
      if (mp.q === 'uniPicture') { checkPictures(part, Object.assign({ a, b }, mp), 'uniform'); break; }
      if (mp.q === 'uniWords') {
        const P0 = 100 * (mp.isLess ? mp.x - a : b - mp.x) / w;
        near(mp.P, P0, 1e-4, tag);
        assert(right.startsWith(`About ${I.trim(P0, 2)}% of the time`), right);
        assert(/less than/.test(right) === mp.isLess, 'direction');
        break;
      }
      if (mp.q === 'uniCompare') {
        const [w1, w2] = mp.intervals.map(([lo, hi]) => { assert(lo >= a - 1e-9 && hi <= b + 1e-9 && hi > lo); return hi - lo; });
        assert.strictEqual(part.correct, Math.abs(w1 - w2) < 1e-9 ? 2 : w1 > w2 ? 0 : 1);
        break;
      }
      if (mp.q === 'validGiven' || mp.q === 'validAny') {
        const parse = (o) => {
          const g = o.match(/^From ([\d.]+)°? to ([\d.]+)°?, height (≈ )?([\d.]+)$/);
          assert(g, 'rectangle text ' + o);
          return { lo: Number(g[1]), hi: Number(g[2]), area: (Number(g[2]) - Number(g[1])) * Number(g[4]) };
        };
        const R = part.options.map(parse);
        const ok = R.map((r) => Math.abs(r.area - 1) < 0.002 && (mp.q === 'validAny' || (Math.abs(r.lo - a) < 1e-9 && Math.abs(r.hi - b) < 1e-9)));
        assert.strictEqual(ok.filter(Boolean).length, 1, 'exactly one valid rectangle');
        assert(ok[part.correct], 'the valid rectangle is correct');
        break;
      }
      if (mp.q === 'meanWords') {
        assert.strictEqual(right, mp.right);
        assert(right.includes(I.trim((a + b) / 2, 4)) && /average|half/.test(right), right);
        break;
      }
      if (mp.q === 'mostLikely') { assert(/^All values/.test(right)); break; }
      let exp;
      if (mp.q === 'less') exp = 100 * (mp.x - a) / w;
      else if (mp.q === 'greater') exp = 100 * (b - mp.x) / w;
      else if (mp.q === 'between') { assert(mp.x1 < mp.x2 && mp.x1 > a && mp.x2 < b); exp = 100 * (mp.x2 - mp.x1) / w; }
      else if (mp.q === 'percentile') exp = a + mp.k / 100 * w;
      else if (mp.q === 'mean') exp = (a + b) / 2;
      else if (mp.q === 'height') exp = 1 / w;
      else throw new Error('unknown meta ' + tag);
      if (['less', 'greater', 'between'].includes(mp.q)) {
        near(part.answer, exp, 1e-4, tag);
        [Math.round(exp), fl(exp), ce(exp), round(exp, 1), round(exp / 100, 4) * 100].forEach((x) => assert(passes(part, x), `percent rounding ${x} passes`));
        if (mp.q !== 'between') roundingsFor(part.tol, 100 - exp).forEach((x) => assert(!passes(part, x), 'complement must fail'));
        if (a > 0) {
          const wrongs = mp.q === 'less' ? [100 * mp.x / b, 100 * mp.x / w] : mp.q === 'greater' ? [100 * (b - mp.x) / b] : [100 * (mp.x2 - mp.x1) / b];
          wrongs.forEach((wv) => roundingsFor(part.tol, wv).forEach((x) => assert(!passes(part, x), `ignoring a (${x}) must fail`)));
        }
      } else if (mp.q === 'height') {
        near(part.answer, exp, 1e-6, tag);
        assert(passes(part, round(exp, 3)), '3-decimal height passes');
        if (exp >= 0.05) assert(passes(part, round(exp, 2)) && part.tol <= 0.006 + 1e-12, '2-decimal height passes');
        assert(passes(part, `1/${w}`), 'fraction 1/w passes');
        assert(!passes(part, w), 'width must fail');
        if (a > 0 && Math.abs(1 / b - exp) > 0.02) assert(!passes(part, 1 / b), '1/b must fail');
      } else {
        near(part.answer, exp, 1e-6, tag);
        assert.strictEqual(part.tol, I.uniTol(exp, w), 'uniform x tolerance');
        assert(passes(part, round(exp, 2)) && passes(part, round(exp, 1)), 'decimal roundings pass');
        if (part.tol > 0.9) assert(passes(part, Math.floor(exp)) && passes(part, Math.ceil(exp)), 'whole-number rounding passes');
        if (mp.q === 'percentile') {
          const wrongs = [a + (1 - mp.k / 100) * w].concat(a > 0 ? [mp.k / 100 * b] : []);
          wrongs.forEach((wv) => roundingsFor(part.tol, wv).forEach((x) => assert(!passes(part, x), `wrong percentile value ${x} must fail`)));
        }
      }
      break;
    }
    case '3.3': {
      if (mp.q === 'z') {
        const z = (mp.x - mp.mu) / mp.sigma;
        near(part.answer, round(z, 2), 1e-9, tag);
        assert.strictEqual(part.tol, Z_TOL);
        [z, z.toFixed(3), round(z, 2), round(z, 1), round(round(z, 2), 1)].forEach((x) => assert(passes(part, x), `z rounding ${x} passes`));
        roundingsFor(part.tol, -z).forEach((x) => assert(!passes(part, x), 'sign swap must fail'));
        roundingsFor(part.tol, (mp.x - mp.mu) / (mp.sigma * mp.sigma)).forEach((x) => assert(!passes(part, x), 'dividing by variance must fail'));
        assert(!passes(part, mp.x - mp.mu), 'forgetting to divide must fail');
      } else if (mp.q === 'better') {
        const zs = mp.people.map((q) => round((q.x - q.mu) / q.sigma, 2));
        assert(Math.abs(zs[0] - zs[1]) >= 0.2 - 1e-9, 'z-scores clearly different');
        const want = mp.lowerBetter ? (zs[0] < zs[1] ? 0 : 1) : (zs[0] > zs[1] ? 0 : 1);
        assert.strictEqual(part.options.length, 2, 'two people only');
        assert.strictEqual(part.correct, want, 'better choice');
        assert.strictEqual(m.lowerBetter, mp.lowerBetter);
        if (mp.lowerBetter) assert(/better/.test(p.promptHTML), 'lower-is-better note present');
        assert(/<table>/.test(p.promptHTML) && (p.promptHTML.match(/<tr>/g) || []).length === 3, 'compact 2-row table');
      } else if (mp.q === 'whichUnusual') {
        const zs = mp.values.map((v) => (v - mp.mu) / mp.sigma);
        const unusual = zs.map((z, i) => (Math.abs(z) > 2 ? i : -1)).filter((i) => i >= 0);
        assert.strictEqual(unusual.length, 1, 'exactly one unusual value');
        assert.strictEqual(part.correct, unusual[0]);
        zs.forEach((z, i) => assert(i === unusual[0] ? Math.abs(z) >= 2.15 : Math.abs(z) <= 1.8, 'not borderline'));
      } else if (mp.q === 'x') {
        const x = mp.mu + mp.z * mp.sigma;
        near(part.answer, x, 1e-6, tag);
        assert.strictEqual(part.tol, I.normTol(x, mp.sigma));
        assert(passes(part, round(x, 2)), '2-decimal x passes');
        if (part.tol >= 0.05) assert(passes(part, round(x, 1)), '1-decimal x passes');
        if (part.tol > 0.9) assert(passes(part, Math.round(x)), 'whole x passes');
        roundingsFor(part.tol, mp.mu - mp.z * mp.sigma).forEach((v) => assert(!passes(part, v), 'wrong direction must fail'));
      } else if (mp.q === 'zWords') {
        assert.strictEqual(right, mp.right);
        assert(right.includes(I.trim(Math.abs(mp.z), 2) + ' standard deviation') && right.includes(mp.z < 0 ? 'below' : 'above'), right);
      } else if (mp.q === 'zDist') {
        assert.strictEqual(right, mp.right);
        const d = Math.abs(mp.z) * mp.sigma;
        assert(right.replace(/,/g, '').includes(String(Math.round(d * 1e4) / 1e4)) || right.includes(d.toFixed(2)), `${right} has ${d}`);
        assert(right.includes(mp.z < 0 ? 'below' : 'above'));
      } else if (mp.q === 'zZero') {
        assert(/exactly equal to the class mean/.test(right));
      } else if (mp.q === 'zNeg') {
        assert(/^It is below the mean/.test(right));
      } else if (mp.q === 'zLower' || mp.q === 'zTwo') {
        assert.strictEqual(right, mp.right);
        if (mp.q === 'zLower') assert(right.includes(mp.z < 0 ? 'below the mean, which is good' : 'above the mean, which is bad'));
        else assert(mp.za > 0 && mp.zb < 0);
      } else throw new Error('unknown meta ' + tag);
      break;
    }
    case '3.4': {
      const mu = m.mu, sd = m.sigma, cdf = (x) => Phi((x - mu) / sd);
      if (mp.q === 'shade') {
        checkPictures(part, mp, 'normal');
        const q = questionText(p);
        const L = /less than|at most|below|shorter than|under/.test(q), R = /more than|at least|above|taller than|over|longer than/.test(q);
        if (mp.want.t === 'L') assert(L && !R, 'left-tail wording: ' + q);
        if (mp.want.t === 'R') assert(R && !L, 'right-tail wording: ' + q);
        if (mp.want.t === 'B') assert(/between|within/.test(q) && !/not/.test(q), 'between wording: ' + q);
        if (mp.want.t === 'O') assert(/ or |not/.test(q), 'outside wording: ' + q);
        break;
      }
      if (mp.q === 'setupArea') {
        const s = right.replace(/<[^>]+>/g, '');
        const fv = (v) => (v === -Infinity ? '−∞' : v === Infinity ? '∞' : String(Math.round(v * 1e6) / 1e6));
        assert(s.startsWith(`normaldist(${mu}, ${sd})`), s);
        assert(s.endsWith(`Min = ${fv(mp.lo)}, Max = ${fv(mp.hi)}`), s);
        break;
      }
      if (mp.q === 'setupInv') {
        const s = right.replace(/<[^>]+>/g, '');
        assert.strictEqual(s, `normaldist(${mu}, ${sd}).inversecdf(${Math.round(mp.left * 100) / 100})`);
        if (mp.kind === 'cutoff') assert.strictEqual(mp.left, mp.dir === 'low' ? mp.p / 100 : 1 - mp.p / 100);
        break;
      }
      if (mp.q === 'interpPct') {
        near(mp.v, mu + sd * PhiInv(mp.k / 100), 1e-4, tag);
        assert.strictEqual(right, mp.right);
        assert(right.startsWith(`${mp.k}% of`) && !/between/.test(right), right);
        break;
      }
      if (mp.q === 'interpCut') {
        near(mp.v, mu + sd * PhiInv(mp.dir === 'low' ? mp.p / 100 : 1 - mp.p / 100), 1e-4, tag);
        assert.strictEqual(right, mp.right);
        assert(mp.dir === 'low' ? right.includes(I.ord(mp.p) + ' percentile') : right.startsWith(`${100 - mp.p}% of`), right);
        break;
      }
      if (mp.q === 'interpArea') {
        const P0 = 100 * (mp.isLess ? cdf(mp.x) : 1 - cdf(mp.x));
        near(mp.P, P0, 1e-5, tag);
        assert(right.startsWith(`About ${I.fmt(P0, 2)}% of`), right);
        break;
      }
      if (['less', 'greater', 'between'].includes(mp.q)) {
        let exp;
        if (mp.q === 'less') exp = 100 * cdf(mp.x);
        else if (mp.q === 'greater') exp = 100 * (1 - cdf(mp.x));
        else exp = 100 * (cdf(mp.x2) - cdf(mp.x1));
        near(part.answer, exp, 1e-3, tag);
        [Math.round(exp), round(exp, 1), round(exp, 2), round(exp / 100, 4) * 100].forEach((x) => assert(passes(part, x), `percent ${x} passes`));
        if (exp % 1 < 0.99) assert(passes(part, Math.floor(exp)), 'rounding down passes');
        if (mp.q !== 'between') roundingsFor(part.tol, 100 - exp).forEach((x) => assert(!passes(part, x), 'complement must fail'));
        assert(exp >= 2 && exp <= 98, 'reasonable area ' + exp);
      } else {
        let left;
        if (mp.q === 'percentile') left = mp.k / 100;
        else left = mp.dir === 'low' ? mp.p / 100 : 1 - mp.p / 100;
        const x = mu + sd * PhiInv(left);
        near(part.answer, round(x, 2), 0.0100001, tag);
        assert.strictEqual(part.tol, I.normTol(part.answer, sd));
        assert(part.tol <= 0.41 * sd, 'x tolerance is at most 0.4 SD');
        assert(passes(part, x) && passes(part, round(x, 2)), 'unrounded / 2-decimal x passes');
        if (part.tol >= 0.05) assert(passes(part, round(x, 1)), '1-decimal x passes');
        if (part.tol > 0.9) assert(passes(part, Math.round(x)), 'whole-number x passes');
        roundingsFor(part.tol, mu + sd * PhiInv(1 - left)).forEach((v) => assert(!passes(part, v), `wrong tail ${v} must fail`));
      }
      break;
    }
    case '3.5': {
      const mu = m.mu, sd = m.sigma;
      if (mp.q === 'shade') {
        checkPictures(part, mp, 'normal');
        [mp.want.a, mp.want.b].filter((v) => v !== undefined).forEach((v) => {
          const k = (v - mu) / sd;
          assert(Math.abs(k - Math.round(k)) < 1e-6 && Math.abs(k) <= 2 + 1e-6, 'cut values are on the empirical-rule ticks');
        });
        break;
      }
      if (mp.q === 'sdPct') {
        const W = {
          within: EMP[mp.k] - EMP[-mp.k], above: 100 - EMP[mp.k], below: EMP[-mp.k], outside: 100 - (EMP[mp.k] - EMP[-mp.k]),
          meanUp: EMP[mp.k] - 50, lessUp: EMP[mp.k],
        }[mp.rel];
        near(mp.ans, W, 1e-9, tag);
        assert.strictEqual(right, `${round(W, 2)}%`);
        part.options.forEach((o, i) => { if (i !== part.correct) assert(Math.abs(parseFloat(o) - W) > 0.5, 'distractor too close'); });
        break;
      }
      if (mp.q === 'ruleTrue' || mp.q === 'ruleMiddle') {
        assert.strictEqual(right, mp.right);
        const fmtV = (v) => { const r = Math.round(v * 1e6) / 1e6; return [String(r), r.toLocaleString('en-US')]; };
        const has = (v) => fmtV(v).some((s) => right.includes(s));
        assert(has(mu - mp.k * sd) && has(mu + mp.k * sd), `interval μ ± ${mp.k}σ in ${right}`);
        if (mp.q === 'ruleTrue') assert(right.includes(`About ${{ 1: 68, 2: 95, 3: 99.7 }[mp.k]}%`));
        break;
      }
      assert(Math.abs(mp.k || 0) <= m.kMax && Math.abs(mp.k1 || 0) <= m.kMax && Math.abs(mp.k2 || 0) <= m.kMax);
      if (mp.q === 'below') near(part.answer, EMP[mp.k], 1e-9, tag);
      else if (mp.q === 'above') near(part.answer, 100 - EMP[mp.k], 1e-9, tag);
      else if (mp.q === 'between') near(part.answer, EMP[mp.k2] - EMP[mp.k1], 1e-9, tag);
      else if (mp.q === 'valueAtPct') {
        near(part.answer, mu + mp.k * sd, 1e-6, tag);
        assert.strictEqual(part.tol, I.normTol(part.answer, sd));
        roundingsFor(part.tol, mu - mp.k * sd).forEach((v) => assert(!passes(part, v), 'wrong side must fail'));
        roundingsFor(part.tol, mu + (mp.k + Math.sign(mp.k)) * sd).forEach((v) => assert(!passes(part, v), 'next tick must fail'));
        assert(new RegExp(String(EMP[mp.k]).replace('.', '\\.') + 'th percentile').test(p.promptHTML), 'percentile named in prompt');
      } else throw new Error('unknown meta ' + tag);
      if (['below', 'above', 'between'].includes(mp.q)) {
        const A = part.answer;
        assert(![0.15, 99.85, 49.85].includes(A), 'tail-collision variants are skipped');
        assert(!passes(part, A + 1) && !passes(part, A - 1), 'off by a full 1 must fail');
        [fl(A), ce(A), round(A, 1)].forEach((x) => assert(passes(part, x), `rounding ${x} passes`));
        if (A === 34) assert(!passes(part, 68), '68 instead of 34 must fail');
        if (A === 47.5) assert(!passes(part, 95), '95 instead of 47.5 must fail');
        if (A === 16 || A === 2.5) assert(!passes(part, 2 * A), 'both tails instead of one must fail');
        if (A === 13.5) assert(!passes(part, 27), 'two pieces instead of one must fail');
        roundingsFor(part.tol, 100 - A).forEach((x) => assert(!passes(part, x), 'complement must fail'));
        if (mp.q === 'below' || mp.q === 'above') assert(mp.k !== 0, 'no trivial 50%');
        [mp.k, mp.k1, mp.k2].filter((k) => k !== undefined).forEach((k) => {
          const v = Math.round((mu + k * sd) * 1e6) / 1e6;
          assert(Number.isInteger(k) && Math.abs(k) <= 3, 'k on a tick');
          assert(p.promptHTML.includes(String(v)) || p.promptHTML.includes(v.toLocaleString('en-US')), `value ${v} appears in prompt`);
        });
      }
      break;
    }
    default: throw new Error('unknown section');
  }
}

// ---------------------------------------------------------------------------
// 1. normalCdf / invNorm vs independent numerical integration
// ---------------------------------------------------------------------------
test('normalCdf matches Simpson integration to 1e-7 on [-6, 6]', () => {
  let worst = 0;
  for (let z = -6; z <= 6.0001; z += 0.01) worst = Math.max(worst, Math.abs(P.normalCdf(z) - Phi(z)));
  assert(worst < 1e-7, 'worst error ' + worst);
  assert.strictEqual(P.normalCdf(Infinity), 1);
  assert.strictEqual(P.normalCdf(-Infinity), 0);
  near(P.normalCdf(0), 0.5, 1e-15);
});
test('invNorm inverts normalCdf and matches bisection to 1e-5', () => {
  let worst = 0;
  for (let p = 0.0005; p < 0.9996; p += 0.0005) {
    const x = P.invNorm(p);
    near(P.normalCdf(x), p, 1e-9, 'roundtrip');
    worst = Math.max(worst, Math.abs(x - PhiInv(p)));
  }
  assert(worst < 1e-5, 'worst ' + worst);
  near(P.invNorm(0.975), 1.959963985, 1e-8);
  near(P.invNorm(0.5), 0, 1e-12);
});

// ---------------------------------------------------------------------------
// 2. check() parsing + tolerance helpers
// ---------------------------------------------------------------------------
test('check() parses typical student input', () => {
  const pct = { kind: 'num', answer: 58.3333, tol: PCT_TOL, unit: '%' };
  for (const ok of ['58%', ' 58.3 ', '58.33', '58th', '58 th percentile', '59', '58']) assert(P.check(pct, ok), ok);
  assert(!P.check(pct, '66.7'), 'at-or-below 8/12 must fail');
  assert(!P.check(pct, '57'), 'off by more than 1 fails');
  assert(!P.check(pct, '0.5833'), 'proportion instead of percent fails');
  assert(!P.check(pct, 'abc'));
  assert(!P.check(pct, ''));
  assert(!P.check(pct, '   '));
  assert(!P.check(pct, null));
  assert(!P.check(pct, 'x58y'), 'garbage fails');
  const half = { kind: 'num', answer: 0.5, tol: 0.051 };
  assert(P.check(half, '.5'));
  assert(P.check(half, '+0.5'));
  assert(P.check(half, '1/2'));
  const z = { kind: 'num', answer: -1.43, tol: Z_TOL };
  assert(P.check(z, '−1.43'), 'unicode minus');
  assert(P.check(z, '-1.43'));
  assert(P.check(z, '-1.4'), '1-decimal z');
  assert(P.check(z, 'z = -1.43'));
  assert(P.check(z, '–1.43'), 'en dash');
  assert(!P.check(z, '1.43'), 'sign matters');
  assert(!P.check(z, '-1.5'), '1.5 is not a rounding of 1.43');
  const money = { kind: 'num', answer: 4068.9, tol: I.normTol(4068.9, 250) };
  for (const ok of ['$4,068.89', '4068.9', '4068.89 dollars', '4068', '4069']) assert(P.check(money, ok), ok);
  assert(!P.check(money, '4331.11'));
  const mpg = { kind: 'num', answer: 18.95, tol: I.normTol(18.95, 6) };
  assert(P.check(mpg, '18.95 mpg') && P.check(mpg, '19') && P.check(mpg, '18'));
  assert(!P.check(mpg, '29.05'), 'wrong tail fails');
  const ch = { kind: 'choice', options: ['A', 'B'], correct: 1 };
  assert(P.check(ch, 1) && P.check(ch, '1') && !P.check(ch, 0) && !P.check(ch, '') && !P.check(ch, null));
  assert(!P.check(null, '1'));
});
test('tolerance helpers', () => {
  assert.strictEqual(I.normTol(161.34, 25), 0.999);
  assert.strictEqual(I.normTol(67.7, 2.5), 0.999);
  assert.strictEqual(I.normTol(7.5, 1.1), 0.051);
  assert.strictEqual(I.normTol(16.2, 0.3), 0.006);
  assert.strictEqual(I.normTol(9.2, 0.05), 0.006);
  assert.strictEqual(I.uniTol(108, 360), 0.999);
  assert.strictEqual(I.uniTol(2.25, 2.5), 0.051);
  assert.strictEqual(I.uniTol(6.5, 10), 0.1);
});

// ---------------------------------------------------------------------------
// 3. Homework examples (teacher's worksheets)
// ---------------------------------------------------------------------------
test('HW 3.1: 84 among 12 scores is at the 58.33rd percentile; 82nd percentile of 11 scores is 91', () => {
  const data = [34, 42, 51, 65, 69, 74, 78, 84, 85, 85, 86, 87];
  const c = I.countBelow(data, 84);
  assert.strictEqual(c, 7);
  const ans = I.roundTo(100 * c / data.length, 4);
  near(ans, 58.3333, 1e-9);
  const part = { kind: 'num', answer: ans, tol: PCT_TOL };
  assert(P.check(part, '58') && P.check(part, '59') && P.check(part, '58.3'), 'round down or up');
  assert(!P.check(part, '66.7') && !P.check(part, '67') && !P.check(part, '66'), 'at-or-below (66.67) fails');
  const d3 = [66, 68, 70, 70, 75, 76, 82, 83, 88, 91, 97];
  assert.strictEqual(I.countBelow(d3, 91), 9);
  assert.strictEqual(Math.round(100 * 9 / 11), 82);
  assert(Math.abs(100 * 9 / 11 - 82) < 1, '91 sits within 1 of the 82nd percentile');
  assert.strictEqual(I.countBelow([98, 99, 99, 100, 101, 102, 104, 104, 105, 106, 107, 109, 110, 111, 112], 101), 4);
});
test('HW 3.2: U(0,4) P(0.87 < X < 2.55) = 42%; U(1.5,4) 30th percentile = 2.25; U(0.25,2.75) mean 1.5', () => {
  near(100 * (2.55 - 0.87) / (4 - 0), 42, 1e-9);
  near(1.5 + 0.30 * (4 - 1.5), 2.25, 1e-12);
  const p30 = { kind: 'num', answer: 2.25, tol: I.uniTol(2.25, 2.5) };
  assert(P.check(p30, '2.25') && P.check(p30, '2.3') && P.check(p30, '2.2') && !P.check(p30, '1.2'), '30% of b = 1.2 fails');
  const donut = { kind: 'num', answer: I.roundTo(100 * (4 - 2) / 3.5, 4), tol: PCT_TOL };
  assert(P.check(donut, '57') && P.check(donut, '58') && P.check(donut, '57.14') && !P.check(donut, '42.86') && !P.check(donut, '50'));
  near((0.25 + 2.75) / 2, 1.5, 1e-12);
});
test('HW 3.3: Ryan z = -1.43, Carl z = -1.28 (Carl better)', () => {
  const ryan = I.roundTo((81.85 - 88.09) / 4.37, 2), carl = I.roundTo((82.46 - 85.28) / 2.2, 2);
  assert.strictEqual(ryan, -1.43);
  assert.strictEqual(carl, -1.28);
  const part = { kind: 'num', answer: ryan, tol: Z_TOL };
  assert(P.check(part, '-1.43') && P.check(part, '-1.4') && P.check(part, String((81.85 - 88.09) / 4.37)) && !P.check(part, '1.43'));
  assert.strictEqual(I.roundTo((83 - 71) / 6.5, 2), 1.85); // Joe
});
test('HW 3.4: mpg N(24,6) P(X<15) = 6.68%, worst 20% < 18.95; bikes 30th pct 4068.89; IQ top 2% 161.34', () => {
  near(I.roundTo(100 * P.normalCdf((15 - 24) / 6), 2), 6.68, 1e-9);
  near(I.roundTo(100 * (P.normalCdf(1) - P.normalCdf(-4 / 6)), 2), 58.89, 1e-9);
  near(I.roundTo(24 + 6 * P.invNorm(0.2), 2), 18.95, 1e-9);
  near(I.roundTo(4200 + 250 * P.invNorm(0.3), 2), 4068.9, 1e-9); // 4068.8999 (worksheet key says 4068.89)
  assert(P.check({ kind: 'num', answer: 4068.9, tol: I.normTol(4068.9, 250) }, '$4,068.89'), 'worksheet answer accepted');
  near(I.roundTo(110 + 25 * P.invNorm(0.98), 2), 161.34, 1e-9);
  const mensa = { kind: 'num', answer: 161.34, tol: I.normTol(161.34, 25) };
  assert(P.check(mensa, '161') && P.check(mensa, '162') && !P.check(mensa, '58.66'), 'wrong tail (58.66) fails');
  near(I.roundTo(100 * (P.normalCdf(1.6) - P.normalCdf(0.6)), 2), 21.95, 1e-9);
  const pctPart = { kind: 'num', answer: 6.6807, tol: PCT_TOL };
  assert(P.check(pctPart, '6') && P.check(pctPart, '7') && P.check(pctPart, '6.68%') && !P.check(pctPart, '93.32') && !P.check(pctPart, '0.0668'));
});
test('HW 3.5: chips P(X<9.07) = 16%, 8.97–9.17 = 83.85%; SAT >762 = 2.5%; sodium 500–2500 = 83.85%', () => {
  assert.strictEqual(I.sumTerms(I.belowTerms(-1)), 16);
  assert.strictEqual(I.sumTerms(I.betweenTerms(-3, 1)), 83.85);
  assert.strictEqual(I.sumTerms(I.aboveTerms(2)), 2.5);
  assert.strictEqual(I.sumTerms(I.aboveTerms(1)), 16);
  assert.strictEqual(528 - 117, 411);
  assert.strictEqual(528 + 2 * 117, 762);
  for (let k = -3; k <= 3; k++) {
    assert.strictEqual(I.sumTerms(I.belowTerms(k)), EMP[k], 'below ' + k);
    near(I.sumTerms(I.aboveTerms(k)), 100 - EMP[k], 1e-9, 'above ' + k);
    for (let j = k + 1; j <= 3; j++) near(I.sumTerms(I.betweenTerms(k, j)), EMP[j] - EMP[k], 1e-9, `between ${k} ${j}`);
  }
  const p34 = { kind: 'num', answer: 34, tol: PCT_TOL };
  assert(!P.check(p34, '68') && !P.check(p34, '33') && !P.check(p34, '35') && P.check(p34, '34'));
  const p135 = { kind: 'num', answer: 13.5, tol: PCT_TOL };
  assert(P.check(p135, '13') && P.check(p135, '14') && !P.check(p135, '27'));
  const chips = { kind: 'num', answer: 83.85, tol: PCT_TOL };
  assert(P.check(chips, '83.85') && P.check(chips, '84') && P.check(chips, '83') && !P.check(chips, '16.15'));
});

// ---------------------------------------------------------------------------
// 4. every section x type: N problems each, shape + independent recompute
// ---------------------------------------------------------------------------
const promptStats = {};
for (const section of P.SECTIONS) {
  for (const type of P.TYPES[section]) {
    test(`${section} ${type}: ${N} problems valid + answers recomputed`, () => {
      const sigs = new Set();
      let maxLen = 0;
      const correctAt = [0, 0, 0, 0];
      for (let i = 0; i < N; i++) {
        const p = P.generate(section, { type });
        checkShape(p, section, type);
        recompute(p);
        sigs.add(p.signature);
        maxLen = Math.max(maxLen, strip(p.promptHTML).length);
        if (p.parts[0].kind === 'choice' && p.parts[0].options.length === 4) correctAt[p.parts[0].correct]++;
        problemsChecked++;
      }
      promptStats[`${section} ${type}`] = { distinct: sigs.size, maxPromptChars: maxLen };
      // height/mean depend only on (a, b); empirical-rule questions only on (context, k)
      const minDistinct = ['height', 'mean', 'validDensity', 'interpMean', 'zSign'].includes(type) ? 25 : section === '3.5' ? 100 : 150;
      assert(sigs.size >= Math.min(N * 0.3, minDistinct), `too little variety: ${sigs.size} distinct of ${N}`);
      const n4 = correctAt.reduce((a, b) => a + b, 0);
      if (n4 > 400 && type !== 'whatIf') correctAt.forEach((c) => assert(c > n4 * 0.15, `correct option position is not shuffled: ${correctAt}`));
    });
  }
}

// ---------------------------------------------------------------------------
// 5. hard (boss) problems, default type picking, avoid list, errors
// ---------------------------------------------------------------------------
for (const section of P.SECTIONS) {
  test(`${section} hard: ${N_HARD} boss problems have exactly one part and are correct`, () => {
    for (let i = 0; i < N_HARD; i++) {
      const p = P.generate(section, { hard: true });
      checkShape(p, section);
      recompute(p);
      assert.strictEqual(p.parts.length, 1, `hard ${p.type} must have 1 part`);
      assert(I.HARD_TYPES[section].includes(p.type), 'hard type from the hard pool');
      problemsChecked++;
    }
  });
  test(`${section} random type picking covers all types and mixes ~60% calc / 40% interpretation`, () => {
    const seen = new Set();
    let calc = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const t = P.generate(section).type;
      seen.add(t);
      if (P.CATEGORY[section][t] === 'calc') calc++;
    }
    assert.deepStrictEqual([...seen].sort(), P.TYPES[section].slice().sort());
    assert(calc / n > 0.52 && calc / n < 0.68, `calc share ${calc / n}`);
  });
  test(`${section} avoid list is respected`, () => {
    for (const type of P.TYPES[section]) {
      for (let i = 0; i < 40; i++) {
        const a = P.generate(section, { type });
        const b = P.generate(section, { type, avoid: [a.signature] });
        assert.notStrictEqual(a.signature, b.signature, `${type} repeated an avoided problem`);
      }
    }
  });
}
test('API surface and errors', () => {
  assert.deepStrictEqual(P.SECTIONS, ['3.1', '3.2', '3.3', '3.4', '3.5']);
  for (const s of P.SECTIONS) {
    const info = P.SECTION_INFO[s];
    assert(info && info.name && info.icon && /^#[0-9a-f]{6}$/i.test(info.color), 'SECTION_INFO ' + s);
    assert(P.TYPES[s].length >= 6 && P.TYPES[s].length <= 9, 'type count ' + s);
    assert.deepStrictEqual(Object.keys(P.CATEGORY[s]), P.TYPES[s]);
    const interp = P.TYPES[s].filter((t) => P.CATEGORY[s][t] === 'interp');
    assert(interp.length >= 2, 'interpretation types in ' + s);
  }
  assert(!P.TYPES['3.3'].includes('rank') && !P.TYPES['3.5'].includes('kSD'), 'removed types are gone');
  assert.strictEqual(new Set(P.SECTIONS.map((s) => P.SECTION_INFO[s].color)).size, 5, 'distinct colors');
  assert.throws(() => P.generate('9.9'));
  assert.throws(() => P.generate('3.1', { type: 'nope' }));
  assert.throws(() => P.generate('3.3', { type: 'rank' }));
  assert.strictEqual(P.generate(3.3).section, '3.3', 'numeric section accepted');
});

// ---------------------------------------------------------------------------
// summary / samples
// ---------------------------------------------------------------------------
console.log('\nPrompt text length (chars, excluding data lists, tables & diagrams) and variety per type:');
for (const [k, v] of Object.entries(promptStats)) console.log(`  ${k.padEnd(18)} max ${String(v.maxPromptChars).padStart(4)}  distinct ${v.distinct}`);
console.log(`SVG heights (prompt/hint/solution diagrams): max ${maxSvgHeight}px`);

if (process.argv.includes('--samples')) {
  const optText = (o) => (/<svg/.test(o) ? `[picture: ${(o.match(/<text[^>]*>([^<]*)<\/text>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join(', ')}]` : strip(o));
  for (const section of P.SECTIONS) {
    for (const type of P.TYPES[section]) {
      for (let i = 0; i < 2; i++) {
        const p = P.generate(section, { type });
        console.log(`\n[${section} ${type}] ${p.title}\n  ${strip(p.promptHTML)}`);
        p.parts.forEach((q) => console.log('  >', q.label, q.kind === 'num' ? `${q.answer} ${q.unit} (±${q.tol})`
          : `${optText(q.options[q.correct])}  [of: ${q.options.map(optText).join(' / ')}]`));
        console.log('  hints:', p.hints.map(strip).join(' | '));
        console.log('  solution:', p.solution.map(strip).join(' | '));
      }
    }
  }
}

console.log(`\n${failures ? 'FAILED' : 'OK'}: ${problemsChecked} generated problems checked, ${failures} failing test(s).`);
process.exit(failures ? 1 : 0);
