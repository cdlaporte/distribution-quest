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
function htmlStrings(p) {
  return [p.title, p.promptHTML].concat(p.hints, p.solution, p.parts.map((q) => q.label),
    p.parts.filter((q) => q.kind === 'choice').reduce((a, q) => a.concat(q.options), []));
}
const svgSizes = [];
function checkShape(p, section, type) {
  assert.strictEqual(p.section, section, 'section');
  if (type) assert.strictEqual(p.type, type, 'type');
  assert(P.TYPES[section].includes(p.type), 'type listed in TYPES');
  assert(typeof p.title === 'string' && p.title.length > 2 && p.title.length < 45, 'title: ' + p.title);
  assert(typeof p.promptHTML === 'string' && p.promptHTML.length > 20, 'prompt');
  assert(Array.isArray(p.parts) && p.parts.length >= 1 && p.parts.length <= 4, 'parts');
  assert(Array.isArray(p.hints) && p.hints.length >= 2 && p.hints.length <= 4, 'hints count ' + p.hints.length);
  assert(Array.isArray(p.solution) && p.solution.length >= 2, 'solution');
  assert.strictEqual(p.desmos, section === '3.4', 'desmos flag');
  assert(typeof p.signature === 'string' && p.signature.length > 5, 'signature');
  assert(p._meta && Array.isArray(p._meta.parts) && p._meta.parts.length === p.parts.length, 'meta parts align with parts');
  for (const h of htmlStrings(p)) {
    assert(typeof h === 'string' && h.length > 0, 'empty html string');
    assert(!/undefined|NaN|Infinity|null|\[object/.test(h.replace(/<svg[\s\S]*?<\/svg>/g, '')), `bad text in ${p.type}: ${h}`);
    const nOpen = (h.match(/<svg[\s>]/g) || []).length, nClose = (h.match(/<\/svg>/g) || []).length;
    assert.strictEqual(nOpen, nClose, 'unbalanced <svg>');
    for (const svg of h.match(/<svg[\s\S]*?<\/svg>/g) || []) {
      assert(!/undefined|NaN|Infinity|null/.test(svg), 'bad number in svg');
      assert(/xmlns="http:\/\/www.w3.org\/2000\/svg"/.test(svg), 'svg xmlns');
      assert(!/(href|src)=/.test(svg), 'svg has external reference');
      for (const tag of ['text', 'path', 'line', 'rect', 'circle', 'polygon']) {
        const open = (svg.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
        const closed = (svg.match(new RegExp('<' + tag + '[^>]*/>', 'g')) || []).length + (svg.match(new RegExp('</' + tag + '>', 'g')) || []).length;
        assert.strictEqual(open, closed, `unclosed <${tag}>`);
      }
      const w = Number(svg.match(/width="(\d+)"/)[1]), ht = Number(svg.match(/height="(\d+)"/)[1]);
      assert(w <= 560 && ht <= 200, `svg too big ${w}x${ht}`);
      svgSizes.push(ht);
    }
    // balanced simple tags
    for (const tag of ['b', 'p', 'span', 'div', 'i']) {
      const open = (h.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
      const close = (h.match(new RegExp('</' + tag + '>', 'g')) || []).length;
      assert.strictEqual(open, close, `unbalanced <${tag}> in: ${h}`);
    }
  }
  const classes = (p.promptHTML + p.hints.join('') + p.solution.join('')).match(/class="([^"]*)"/g) || [];
  for (const c of classes) {
    for (const name of c.slice(7, -1).split(/\s+/)) {
      assert(['story', 'data', 'big', 'eq', 'hl', 'small', 'good', 'bad'].includes(name), 'unknown class ' + name);
    }
  }
  if (section === '3.1' && /class="data"/.test(p.promptHTML)) {
    const list = p.promptHTML.match(/<div class="data">([^<]*)<\/div>/)[1].split(',');
    assert(list.length <= 20, 'data list too long');
  }
  for (const part of p.parts) {
    assert(typeof part.label === 'string', 'label');
    if (part.kind === 'num') {
      assert(Number.isFinite(part.answer), 'answer finite');
      assert(Number.isFinite(part.tol) && part.tol > 0, 'tol');
      assert(typeof part.unit === 'string', 'unit string');
      assert(passes(part, String(part.answer)), `own answer ${part.answer} must pass`);
      assert(passes(part, part.answer.toFixed(6)), 'own answer (fixed) must pass');
      assert(!passes(part, String(part.answer + part.tol * 1.5 + 0.001)), 'beyond tol must fail');
      assert(!passes(part, String(part.answer - part.tol * 1.5 - 0.001)), 'beyond tol must fail');
      if (part.unit === '%') assert(part.answer > 0 && part.answer < 100, 'percent range ' + part.answer);
    } else {
      assert.strictEqual(part.kind, 'choice', 'kind');
      assert(Array.isArray(part.options) && part.options.length >= 2 && part.options.length <= 4, 'options');
      assert.strictEqual(new Set(part.options).size, part.options.length, 'unique options');
      assert(part.options.every((o) => typeof o === 'string' && o.length > 0 && o.replace(/<[^>]+>/g, '').length <= 110), 'option text');
      assert(Number.isInteger(part.correct) && part.correct >= 0 && part.correct < part.options.length, 'correct index');
      part.options.forEach((o, i) => assert.strictEqual(P.check(part, i), i === part.correct, 'choice check'));
      assert(P.check(part, String(part.correct)), 'choice check with string index');
      assert(!P.check(part, ''), 'empty choice fails');
    }
  }
}

// ---------------------------------------------------------------------------
// independent recomputation of every answer from _meta
// ---------------------------------------------------------------------------
function recompute(p) {
  const m = p._meta;
  p._meta.parts.forEach((mp, idx) => {
    const part = p.parts[idx];
    const tag = `${p.section}/${p.type}/${mp.q}`;
    switch (p.section) {
      case '3.1': {
        const data = m.data;
        if (mp.q === 'pct') {
          const c = below(data, mp.value), n = data.length;
          const exact = 100 * c / n;
          near(part.answer, exact, 0.006, tag);
          assert(data.includes(mp.value), 'value in data');
          assert(passes(part, Math.round(exact)), 'whole-number rounding passes');
          assert(passes(part, round(exact, 1)), '1-decimal rounding passes');
          assert(passes(part, round(exact, 2) + '%'), 'with % passes');
          const wrong = 100 * atOrBelow(data, mp.value) / n;
          assert(!passes(part, round(wrong, 1)), `'at or below' (${wrong}) must fail`);
          assert(!passes(part, Math.round(wrong)), `'at or below' rounded must fail`);
        } else if (mp.q === 'val') {
          const n = data.length;
          const distinct = [...new Set(data)];
          const matches = distinct.filter((v) => Math.abs(100 * below(data, v) / n - mp.k) <= 0.5 + 1e-9);
          assert.strictEqual(matches.length, 1, `exactly one value at the ${mp.k}th percentile`);
          near(part.answer, matches[0], 1e-9, tag);
          const close = distinct.filter((v) => Math.abs(100 * below(data, v) / n - mp.k) < 2.5);
          assert.strictEqual(close.length, 1, 'no near-ties for the k-th percentile');
          // the value a student would pick with the 'at or below' rule must fail
          const wrongVals = distinct.filter((v) => Math.abs(100 * atOrBelow(data, v) / n - mp.k) <= 0.5 + 1e-9 && v !== matches[0]);
          wrongVals.forEach((v) => assert(!passes(part, v), 'at-or-below value must fail'));
          assert(mp.k > 0 && mp.k < 100);
        } else if (mp.q === 'interpret') {
          const right = part.options[part.correct];
          assert(right.startsWith(mp.k + '% of'), 'correct interpretation starts with k%: ' + right);
          assert(/lower|shorter|fewer|less|slower/.test(right), 'correct interpretation says less: ' + right);
        } else throw new Error('unknown meta ' + tag);
        break;
      }
      case '3.2': {
        const a = m.a, b = m.b, w = b - a;
        assert(b > a);
        let exp;
        if (mp.q === 'less') exp = 100 * (mp.x - a) / w;
        else if (mp.q === 'greater') exp = 100 * (b - mp.x) / w;
        else if (mp.q === 'between') { assert(mp.x1 < mp.x2 && mp.x1 > a && mp.x2 < b); exp = 100 * (mp.x2 - mp.x1) / w; }
        else if (mp.q === 'percentile') exp = a + mp.k / 100 * w;
        else if (mp.q === 'mean') exp = (a + b) / 2;
        else if (mp.q === 'height') exp = 1 / w;
        else throw new Error('unknown meta ' + tag);
        if (['less', 'greater', 'between'].includes(mp.q)) {
          near(part.answer, exp, 0.006, tag);
          assert(passes(part, Math.round(exp)) && passes(part, round(exp, 1)), 'percent roundings pass');
          assert(passes(part, round(exp / 100, 4) * 100), 'decimal ×100 passes');
          if (mp.q !== 'between') assert(!passes(part, 100 - exp), 'complement must fail');
          if (mp.q === 'less' && a > 0 && Math.abs(100 * mp.x / b - exp) > 0.6) assert(!passes(part, 100 * mp.x / b), 'ignoring a must fail');
        } else if (mp.q === 'height') {
          near(part.answer, exp, 0.00005, tag);
          assert(passes(part, round(exp, 3)), '3-decimal height passes');
          if (exp >= 0.05) assert(passes(part, round(exp, 2)), '2-decimal height passes');
          assert(passes(part, `1/${w}`), 'fraction 1/w passes');
          assert(!passes(part, w), 'width must fail');
        } else {
          near(part.answer, exp, 1e-6, tag);
          if (mp.q === 'percentile' && a > 0) assert(!passes(part, mp.k / 100 * b), 'k% of b (ignoring a) must fail');
        }
        break;
      }
      case '3.3': {
        if (mp.q === 'z') {
          const z = (mp.x - mp.mu) / mp.sigma;
          near(part.answer, round(z, 2), 1e-9, tag);
          assert(passes(part, z), 'unrounded z passes');
          assert(passes(part, z.toFixed(3)), '3-decimal z passes');
          assert(!passes(part, -part.answer), 'sign swap must fail');
          assert(!passes(part, (mp.x - mp.mu) / (mp.sigma * mp.sigma)), 'dividing by variance must fail') ;
        } else if (mp.q === 'better') {
          const z1 = p.parts[0].answer, z2 = p.parts[1].answer;
          assert(Math.abs(z1 - z2) >= 0.15 - 1e-9, 'z-scores clearly different');
          const want = mp.lowerBetter ? (z1 < z2 ? 0 : 1) : (z1 > z2 ? 0 : 1);
          assert.strictEqual(part.correct, want, 'better choice');
          assert.strictEqual(m.lowerBetter, mp.lowerBetter);
          if (mp.lowerBetter) assert(/better/.test(p.promptHTML), 'lower-is-better note present');
        } else if (mp.q === 'rank') {
          const zs = m.people.map((q) => round((q.x - q.mu) / q.sigma, 2));
          const good = zs.map((z) => (m.lowerBetter ? -z : z));
          const target = m.ask === 'best' ? good.indexOf(Math.max(...good)) : good.indexOf(Math.min(...good));
          assert.strictEqual(good.filter((g) => g === good[target]).length, 1, 'unique best/worst');
          assert.strictEqual(part.correct, target, 'rank choice');
          const sorted = good.slice().sort((x, y) => y - x);
          if (m.ask === 'best') assert(sorted[0] - sorted[1] >= 0.12 - 1e-9, 'clear winner');
          else assert(sorted[2] - sorted[3] >= 0.12 - 1e-9, 'clear loser');
          const tp = m.people[target];
          near(p._meta.parts[idx + 1].x, tp.x, 0, 'z part is for the chosen person');
          near(p._meta.parts[idx + 1].mu, tp.mu, 0);
        } else if (mp.q === 'whichUnusual') {
          const zs = mp.values.map((v) => (v - mp.mu) / mp.sigma);
          const unusual = zs.map((z, i) => (Math.abs(z) > 2 ? i : -1)).filter((i) => i >= 0);
          assert.strictEqual(unusual.length, 1, 'exactly one unusual value');
          assert.strictEqual(part.correct, unusual[0]);
          zs.forEach((z, i) => assert(i === unusual[0] ? Math.abs(z) >= 2.15 : Math.abs(z) <= 1.8, 'not borderline'));
        } else if (mp.q === 'unusualYN') {
          const z = (mp.x - mp.mu) / mp.sigma;
          assert(Math.abs(Math.abs(z) - 2) > 0.05, 'not borderline');
          assert.strictEqual(part.correct, Math.abs(z) > 2 ? 0 : 1);
        } else if (mp.q === 'x') {
          const x = mp.mu + mp.z * mp.sigma;
          near(part.answer, x, 1e-6, tag);
          assert(passes(part, round(x, 2)), '2-decimal x passes');
          assert(!passes(part, mp.mu - mp.z * mp.sigma), 'wrong direction must fail');
        } else throw new Error('unknown meta ' + tag);
        break;
      }
      case '3.4': {
        const mu = m.mu, sd = m.sigma, cdf = (x) => Phi((x - mu) / sd);
        if (['less', 'greater', 'between'].includes(mp.q)) {
          let exp;
          if (mp.q === 'less') exp = 100 * cdf(mp.x);
          else if (mp.q === 'greater') exp = 100 * (1 - cdf(mp.x));
          else exp = 100 * (cdf(mp.x2) - cdf(mp.x1));
          near(part.answer, round(exp, 2), 0.0100001, tag);
          assert(passes(part, round(exp, 1)), '1-decimal percent passes');
          assert(passes(part, round(exp / 100, 4) * 100), '4-decimal proportion ×100 passes');
          if (mp.q !== 'between') assert(!passes(part, 100 - exp), 'complement must fail');
          assert(!passes(part, exp + 0.5) && !passes(part, exp - 0.5), 'half a percent off must fail');
          assert(exp > 0.4 && exp < 99.6, 'reasonable area ' + exp);
        } else {
          let left;
          if (mp.q === 'percentile') left = mp.k / 100;
          else left = mp.dir === 'low' ? mp.p / 100 : 1 - mp.p / 100;
          const x = mu + sd * PhiInv(left);
          near(part.answer, round(x, 2), 0.0100001, tag);
          assert(passes(part, x), 'unrounded x passes');
          if (mp.q === 'cutoff' || mp.k !== 50) assert(!passes(part, mu + sd * PhiInv(1 - left)), 'wrong tail must fail');
          assert(part.tol <= Math.max(0.041 * sd, 0.006) + 1e-12, 'x tolerance is at most 0.04 SD');
          assert(!passes(part, x + Math.max(0.12 * sd, 0.02)) && !passes(part, x - Math.max(0.12 * sd, 0.02)), 'x off by 0.12 SD must fail');
        }
        break;
      }
      case '3.5': {
        const mu = m.mu, sd = m.sigma;
        assert(Math.abs(mp.k || 0) <= m.kMax && Math.abs(mp.k1 || 0) <= m.kMax && Math.abs(mp.k2 || 0) <= m.kMax);
        if (mp.q === 'below') near(part.answer, EMP[mp.k], 1e-9, tag);
        else if (mp.q === 'above') near(part.answer, 100 - EMP[mp.k], 1e-9, tag);
        else if (mp.q === 'between') near(part.answer, EMP[mp.k2] - EMP[mp.k1], 1e-9, tag);
        else if (mp.q === 'valueAtPct' || mp.q === 'kValue') {
          near(part.answer, mu + mp.k * sd, 1e-6, tag);
          assert(!passes(part, mu - mp.k * sd), 'wrong side must fail');
          if (mp.q === 'valueAtPct') assert(new RegExp(String(EMP[mp.k]).replace('.', '\\.') + 'th percentile').test(p.promptHTML), 'percentile named in prompt');
        } else throw new Error('unknown meta ' + tag);
        if (['below', 'above', 'between'].includes(mp.q)) {
          assert(!passes(part, part.answer + 1) && !passes(part, part.answer - 1), 'off by 1 must fail');
          if (part.answer === 34) assert(!passes(part, 68), '68 instead of 34 must fail');
          if (part.answer === 47.5) assert(!passes(part, 95), '95 instead of 47.5 must fail');
          if (part.answer === 16) assert(!passes(part, 32), '32 instead of 16 must fail');
          if (mp.q === 'below' || mp.q === 'above') assert(mp.k !== 0, 'no trivial 50%');
          // every value named in the question sits exactly on a tick (mu + k*sigma)
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
  });
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
// 2. check() parsing
// ---------------------------------------------------------------------------
test('check() parses typical student input', () => {
  const pct = { kind: 'num', answer: 58.33, tol: 0.5, unit: '%' };
  assert(P.check(pct, '58%'));
  assert(P.check(pct, ' 58.3 '));
  assert(P.check(pct, '58.33'));
  assert(P.check(pct, '58th'));
  assert(P.check(pct, '58 th percentile'));
  assert(!P.check(pct, '66.7'), 'at-or-below 8/12 must fail');
  assert(!P.check(pct, 'abc'));
  assert(!P.check(pct, ''));
  assert(!P.check(pct, '   '));
  assert(!P.check(pct, null));
  assert(!P.check(pct, 'x58y'), 'garbage fails');
  const half = { kind: 'num', answer: 0.5, tol: 0.011 };
  assert(P.check(half, '.5'));
  assert(P.check(half, '+0.5'));
  assert(P.check(half, '1/2'));
  const z = { kind: 'num', answer: -1.43, tol: 0.011 };
  assert(P.check(z, '−1.43'), 'unicode minus');
  assert(P.check(z, '-1.43'));
  assert(P.check(z, 'z = -1.43'));
  assert(P.check(z, '–1.43'), 'en dash');
  assert(!P.check(z, '1.43'), 'sign matters');
  const money = { kind: 'num', answer: 4068.89, tol: 0.625 };
  assert(P.check(money, '$4,068.89'));
  assert(P.check(money, '4068.9'));
  assert(P.check(money, '4068.89 dollars'));
  assert(!P.check(money, '4331.11'));
  const mpg = { kind: 'num', answer: 18.95, tol: 0.05 };
  assert(P.check(mpg, '18.95 mpg'));
  assert(P.check(mpg, '19.0'));
  assert(!P.check(mpg, '18.8'));
  const ch = { kind: 'choice', options: ['A', 'B'], correct: 1 };
  assert(P.check(ch, 1) && P.check(ch, '1') && !P.check(ch, 0) && !P.check(ch, '') && !P.check(ch, null));
  assert(!P.check(null, '1'));
});

// ---------------------------------------------------------------------------
// 3. Homework examples (teacher's worksheets)
// ---------------------------------------------------------------------------
test('HW 3.1: 84 among 12 scores is at the 58.33rd percentile; 82nd percentile of 11 scores is 91', () => {
  const data = [34, 42, 51, 65, 69, 74, 78, 84, 85, 85, 86, 87];
  const c = P._internal.countBelow(data, 84);
  assert.strictEqual(c, 7);
  const ans = P._internal.roundTo(100 * c / data.length, 2);
  assert.strictEqual(ans, 58.33);
  const part = { kind: 'num', answer: ans, tol: 0.5 };
  assert(P.check(part, '58') && P.check(part, '58.3') && !P.check(part, '66.7') && !P.check(part, '67'));
  const d3 = [66, 68, 70, 70, 75, 76, 82, 83, 88, 91, 97];
  assert.strictEqual(P._internal.countBelow(d3, 91), 9);
  assert.strictEqual(Math.round(100 * 9 / 11), 82);
  assert.strictEqual(P._internal.countBelow([98, 99, 99, 100, 101, 102, 104, 104, 105, 106, 107, 109, 110, 111, 112], 101), 4);
});
test('HW 3.2: U(0,4) P(0.87 < X < 2.55) = 42%; U(1.5,4) 30th percentile = 2.25; U(0.25,2.75) mean 1.5', () => {
  near(100 * (2.55 - 0.87) / (4 - 0), 42, 1e-9);
  near(1.5 + 0.30 * (4 - 1.5), 2.25, 1e-12);
  near(100 * (4 - 2) / 3.5, 57.142857, 1e-5);
  near((0.25 + 2.75) / 2, 1.5, 1e-12);
});
test('HW 3.3: Ryan z = -1.43, Carl z = -1.28 (Carl better)', () => {
  const ryan = P._internal.roundTo((81.85 - 88.09) / 4.37, 2), carl = P._internal.roundTo((82.46 - 85.28) / 2.2, 2);
  assert.strictEqual(ryan, -1.43);
  assert.strictEqual(carl, -1.28);
  const part = { kind: 'num', answer: ryan, tol: 0.011 };
  assert(P.check(part, '-1.43') && P.check(part, String((81.85 - 88.09) / 4.37)) && !P.check(part, '1.43'));
  assert.strictEqual(P._internal.roundTo((83 - 71) / 6.5, 2), 1.85); // Joe
});
test('HW 3.4: mpg N(24,6) P(X<15) = 6.68%, worst 20% < 18.95; bikes 30th pct 4068.89; IQ top 2% 161.34', () => {
  near(P._internal.roundTo(100 * P.normalCdf((15 - 24) / 6), 2), 6.68, 1e-9);
  near(P._internal.roundTo(100 * (P.normalCdf(1) - P.normalCdf(-4 / 6)), 2), 58.89, 1e-9);
  near(P._internal.roundTo(24 + 6 * P.invNorm(0.2), 2), 18.95, 1e-9);
  near(P._internal.roundTo(4200 + 250 * P.invNorm(0.3), 2), 4068.9, 1e-9); // 4068.8999 (worksheet key says 4068.89)
  assert(P.check({ kind: 'num', answer: 4068.9, tol: 0.625 }, '$4,068.89'), 'worksheet answer accepted');
  near(P._internal.roundTo(110 + 25 * P.invNorm(0.98), 2), 161.34, 1e-9);
  near(P._internal.roundTo(100 * (P.normalCdf(1.6) - P.normalCdf(0.6)), 2), 21.95, 1e-9);
  const pctPart = { kind: 'num', answer: 6.68, tol: 0.15 };
  assert(P.check(pctPart, '6.6') && P.check(pctPart, '6.8') && P.check(pctPart, '6.68%') && !P.check(pctPart, '93.32') && !P.check(pctPart, '7'));
});
test('HW 3.5: chips P(X<9.07) = 16%, 8.97–9.17 = 83.85%; SAT >762 = 2.5%; sodium 500–2500 = 83.85%', () => {
  const I = P._internal;
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
  const p34 = { kind: 'num', answer: 34, tol: 0.05 };
  assert(!P.check(p34, '68'));
});

// ---------------------------------------------------------------------------
// 4. every section x type: N problems each, shape + independent recompute
// ---------------------------------------------------------------------------
const promptStats = {};
const strip = (h) => h.replace(/<svg[\s\S]*?<\/svg>/g, ' [diagram] ').replace(/<div class="data">[\s\S]*?<\/div>/g, ' [data] ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
for (const section of P.SECTIONS) {
  for (const type of P.TYPES[section]) {
    test(`${section} ${type}: ${N} problems valid + answers recomputed`, () => {
      const sigs = new Set();
      let maxLen = 0;
      for (let i = 0; i < N; i++) {
        const p = P.generate(section, { type });
        checkShape(p, section, type);
        recompute(p);
        sigs.add(p.signature);
        maxLen = Math.max(maxLen, strip(p.promptHTML).length);
        problemsChecked++;
      }
      promptStats[`${section} ${type}`] = { distinct: sigs.size, maxPromptChars: maxLen };
      // height/mean depend only on (a, b); empirical-rule questions only on (context, k)
      const minDistinct = ['height', 'mean'].includes(type) ? 25 : section === '3.5' ? 120 : 200;
      assert(sigs.size >= Math.min(N * 0.3, minDistinct), `too little variety: ${sigs.size} distinct of ${N}`);
    });
  }
}

// ---------------------------------------------------------------------------
// 5. hard (boss) problems, default type picking, avoid list, errors
// ---------------------------------------------------------------------------
for (const section of P.SECTIONS) {
  test(`${section} hard: ${N_HARD} boss problems are multi-part and correct`, () => {
    for (let i = 0; i < N_HARD; i++) {
      const p = P.generate(section, { hard: true });
      checkShape(p, section);
      recompute(p);
      assert(p.parts.length >= 2, `hard ${p.type} should have >= 2 parts`);
      problemsChecked++;
    }
  });
  test(`${section} random type picking covers all types`, () => {
    const seen = new Set();
    for (let i = 0; i < 600; i++) seen.add(P.generate(section).type);
    assert.deepStrictEqual([...seen].sort(), P.TYPES[section].slice().sort());
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
    assert(P.TYPES[s].length >= 4 && P.TYPES[s].length <= 6, 'type count ' + s);
  }
  assert.strictEqual(new Set(P.SECTIONS.map((s) => P.SECTION_INFO[s].color)).size, 5, 'distinct colors');
  assert.throws(() => P.generate('9.9'));
  assert.throws(() => P.generate('3.1', { type: 'nope' }));
  assert.strictEqual(P.generate(3.3).section, '3.3', 'numeric section accepted');
});

// ---------------------------------------------------------------------------
// summary / samples
// ---------------------------------------------------------------------------
console.log('\nPrompt text length (chars, excluding data lists & diagrams) and variety per type:');
for (const [k, v] of Object.entries(promptStats)) console.log(`  ${k.padEnd(18)} max ${String(v.maxPromptChars).padStart(4)}  distinct ${v.distinct}`);
if (svgSizes.length) console.log(`SVG heights: max ${Math.max(...svgSizes)}px`);

if (process.argv.includes('--samples')) {
  for (const section of P.SECTIONS) {
    for (const type of P.TYPES[section]) {
      for (let i = 0; i < 2; i++) {
        const p = P.generate(section, { type, hard: i === 1 });
        console.log(`\n[${section} ${type}${i ? ' HARD' : ''}] ${p.title}\n  ${strip(p.promptHTML)}`);
        p.parts.forEach((q) => console.log('  >', q.label, q.kind === 'num' ? `${q.answer} ${q.unit} (±${q.tol})` : `${q.options[q.correct]}  [of ${q.options.length}]`));
        console.log('  hints:', p.hints.map(strip).join(' | '));
        console.log('  solution:', p.solution.map(strip).join(' | '));
      }
    }
  }
}

console.log(`\n${failures ? 'FAILED' : 'OK'}: ${problemsChecked} generated problems checked, ${failures} failing test(s).`);
process.exit(failures ? 1 : 0);
