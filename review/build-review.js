#!/usr/bin/env node
// Builds the printable Unit 3 review sheet + answer key from js/problems.js.
//   node review/build-review.js            (writes review/*.html and review/*.pdf)
//   SEED=7 node review/build-review.js     (a different, still reproducible, set of problems)
'use strict';
const fs = require('fs');
const path = require('path');

// ---- deterministic randomness: seed Math.random BEFORE generating anything ----
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED = Number(process.env.SEED) || 20261112;
Math.random = mulberry32(SEED);

const P = require(path.join(__dirname, '..', 'js', 'problems.js'));
const I = P._internal;
const OUT = __dirname;

// ---- which problems: 5 per section, all different types (calc first, then interpretation) ----
const PLAN = {
  '3.1': ['pctOfValue', 'valueAtPct', 'dotplotValue', 'interpret', 'whatIf'],
  '3.2': ['greater', 'between', 'percentile', 'validDensity', 'uniInterp'],
  '3.3': ['single', 'compare', 'findX', 'zWords', 'unusual'],
  '3.4': ['less', 'between', 'cutoff', 'shadeArea', 'normInterp'],
  '3.5': ['below', 'between', 'valueAtPct', 'sdPct', 'shade35'],
};
const strip = (h) => h.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const contextKey = (p) => {
  const m = p.promptHTML.match(/<p class="story">([\s\S]*?)<\/p>/);
  return strip(m ? m[1] : p.promptHTML).slice(0, 38);
};
const usedContexts = new Set();
const problems = [];
for (const sec of P.SECTIONS) {
  for (const type of PLAN[sec]) {
    let p;
    for (let tries = 0; ; tries++) {
      p = P.generate(sec, { type });
      if (!usedContexts.has(contextKey(p)) || tries > 200) break;
    }
    usedContexts.add(contextKey(p));
    problems.push(p);
  }
}

// ---- recolor the dark-background SVGs for white paper ----
const C = I.COLORS;
const PRINT = [
  [C.bg, '#ffffff'], // text halo
  [C.axis, '#222222'],
  [C.muted, '#555555'],
  [C.fill, 'rgba(31,78,154,0.07)'],
  [C.shade, 'rgba(235,175,20,0.6)'],
  [C.shadeOpt, 'rgba(230,165,10,0.85)'],
  [C.red, '#c62828'],
  [C.gold, '#7a4f00'],
];
function printSvg(html) {
  return html.replace(/<svg[\s\S]*?<\/svg>/g, (svg) => {
    let s = svg.replace(new RegExp(`(<circle[^>]*fill=")${C.dot}`, 'g'), (m, pre) => pre + '#5b86c9'); // dotplot dots: medium blue
    s = s.split(C.curve).join('#1f4e9a'); // curves / outlines: dark blue
    for (const [from, to] of PRINT) s = s.split(from).join(to);
    return s;
  });
}
// Spell out shorthand distribution notation in words, e.g. "X ~ N(5, 2)" also says
// "meaning X is distributed normally with a mean of 5 and a standard deviation of 2".
function spellOut(h) {
  return h
    .replace(/([A-Za-z])\s*[~∼]\s*U\(\s*([^,()]+?)\s*,\s*([^()]+?)\s*\)/g,
      (m, v, a, b) => `${m}, meaning ${v} is uniformly distributed between ${a} and ${b}`)
    .replace(/([A-Za-z])\s*[~∼]\s*N\(\s*([^,()]+?)\s*,\s*([^()]+?)\s*\)/g,
      (m, v, a, b) => `${m}, meaning ${v} is distributed normally with a mean of ${a} and a standard deviation of ${b}`);
}
// game-only phrases
const forPaper = (h) => spellOut(printSvg(h).replace('Use Desmos in your other tab.', 'You may use Desmos.'));

// ---- rendering ----
const LETTERS = 'ABCD';
const SECTION_NOTE = {
  '3.1': 'A percentile is the percent of values <b>below</b> a value. Rounding up or down is fine.',
  '3.2': 'Sketch the density curve. Area = width × height = probability.',
  '3.3': 'z = (x − μ) ÷ σ. Round z-scores to 2 decimal places.',
  '3.4': 'You may use Desmos: normaldist(μ, σ) (the normal distribution with mean μ and standard deviation σ) with Find Cumulative Probability, or .inversecdf(area).',
  '3.5': 'Use the empirical rule (68–95–99.7). No calculator needed.',
};
function partHTML(part, calc) {
  if (part.kind === 'num') {
    return `<div class="answer-line">${part.label} <span class="blank"></span> ${part.unit || ''}</div>`;
  }
  const pics = part.options.every((o) => /^<svg/.test(o));
  const len = Math.max(...part.options.map((o) => strip(o).length));
  const opts = part.options.map((o, i) => `<div class="opt"><b>${LETTERS[i]}.</b> ${spellOut(printSvg(o))}</div>`).join('');
  return `<div class="opts ${pics ? 'pics' : len <= 14 ? 'row' : len <= 36 ? 'grid' : 'col'}">${opts}</div>${calc ? '' : '<div class="work small-work"></div>'}`;
}
function fmtAnswer(part) {
  const a = part.answer;
  if (part.unit === '%' || part.unit === 'th percentile') return I.trim(a, 2);
  if (part.tol === I.Z_TOL) return I.fmt(a, 2);
  return I.trim(a, 4);
}
function keyAnswer(part) {
  if (part.kind === 'choice') {
    const o = part.options[part.correct];
    return /^<svg/.test(o) ? `<b>${LETTERS[part.correct]}</b> ${printSvg(o)}` : `<b>${LETTERS[part.correct]}. ${spellOut(o)}</b>`;
  }
  let extra = ' — answers that round to this are fine';
  if (part.unit === '%' || part.unit === 'th percentile') {
    const lo = Math.floor(part.answer + 1e-9), hi = Math.ceil(part.answer - 1e-9);
    if (lo !== hi) extra = ` — ${lo} or ${hi} (rounded down or up) is fine`;
  }
  return `${part.label} <b>${fmtAnswer(part)}</b>${part.unit === 'th percentile' ? '' : ' '}${part.unit || ''}<span class="note">${extra}</span>`;
}

const CSS = `
  @page { size: Letter; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 11.5pt; line-height: 1.28; color: #111; background: #fff; margin: 0; }
  h1 { font-size: 17pt; margin: 0 0 4px; }
  .namebar { display: flex; gap: 24px; margin: 6px 0 8px; font-size: 12pt; }
  .namebar span { flex: 1; border-bottom: 1px solid #333; height: 18px; }
  .namebar span.short { flex: 0 0 1.2in; }
  .instructions { border: 1px solid #999; border-radius: 6px; padding: 6px 10px; font-size: 10.5pt; margin-bottom: 6px; }
  .instructions ul { margin: 2px 0 0 18px; padding: 0; }
  h2 { font-size: 13.5pt; margin: 10px 0 2px; padding-bottom: 2px; border-bottom: 2px solid #333; }
  .secnote { font-size: 10pt; color: #444; margin: 0 0 4px; }
  .sec-start { break-inside: avoid; page-break-inside: avoid; }
  .problem { break-inside: avoid; page-break-inside: avoid; padding: 4px 0 2px; display: grid; grid-template-columns: 32px 1fr; }
  .num { font-weight: bold; }
  .problem p { margin: 2px 0; }
  .story { }
  .data { font-family: "Courier New", monospace; font-size: 11pt; background: #f2f2f2; border: 1px solid #ccc; border-radius: 4px; padding: 4px 8px; margin: 4px 0; }
  .eq { font-weight: bold; white-space: nowrap; }
  .hl { font-weight: bold; }
  .small { font-size: 10pt; color: #444; }
  .good, .bad { font-weight: bold; }
  table { border-collapse: collapse; margin: 4px 0; font-size: 11pt; }
  td, th { border: 1px solid #777; padding: 2px 8px; text-align: center; }
  th { background: #eee; }
  svg { display: block; max-width: 3.4in; height: auto; margin: 2px 0; }
  .opts.pics { display: flex; gap: 10px; flex-wrap: nowrap; margin-top: 4px; }
  .opts.pics .opt { display: flex; align-items: flex-start; gap: 3px; }
  .opts.pics svg { width: 1.4in; margin: 0; border: 1px solid #bbb; border-radius: 4px; }
  .opts.row { display: flex; gap: 28px; flex-wrap: wrap; margin-top: 4px; }
  .opts.col .opt { margin: 2px 0 2px 4px; }
  .opts.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 20px; margin-top: 4px; }
  .answer-line { margin-top: 6px; }
  .blank { display: inline-block; width: 1.3in; border-bottom: 1px solid #222; margin: 0 4px; }
  .work { height: 1.7in; }
  .work.small-work { height: 0.45in; }
  .key .problem { padding: 5px 0; border-bottom: 1px dotted #bbb; }
  .key .final { margin: 2px 0 3px; }
  .key .final svg { display: inline-block; vertical-align: middle; width: 1.3in; margin: 0 0 0 6px; border: 1px solid #bbb; }
  .key .steps { font-size: 10.5pt; color: #222; }
  .key .steps div { margin: 1px 0; }
  .key .steps svg { max-width: 3.6in; }
  .note { font-size: 9.5pt; color: #555; font-weight: normal; }
  footer { font-size: 9pt; color: #777; margin-top: 8px; }
`;
const HEADER = (key) => `
  <h1>${key ? 'Unit 3 Review: Distributions — ANSWER KEY' : 'Intro to Stats B — Unit 3 Review: Distributions'}</h1>
  ${key ? '' : `<div class="namebar">Name: <span></span> Period: <span class="short"></span></div>
  <div class="instructions"><b>Directions.</b> Show your work in the space under each problem. Rounding up or down is fine on every answer.
    <ul>
      <li><b>3.1 Percentiles:</b> a value’s percentile = the percent of the data values that are <b>below</b> it.</li>
      <li><b>3.2 Uniform:</b> the density curve is a rectangle with area 1; area = probability.</li>
      <li><b>3.3 z-scores:</b> z = (x − μ) ÷ σ.  <b>3.4 Normal:</b> you may use Desmos.  <b>3.5:</b> use the empirical rule (68–95–99.7).</li>
    </ul></div>`}`;

function sheet(key) {
  let n = 0, body = '';
  for (const sec of P.SECTIONS) {
    body += `<div class="sec-start"><h2>${sec} ${P.SECTION_INFO[sec].name}</h2>`;
    if (!key) body += `<div class="secnote">${SECTION_NOTE[sec]}</div>`;
    problems.filter((p) => p.section === sec).forEach((p, j) => {
      n++;
      if (j === 1) body += '</div>';
      const part = p.parts[0];
      if (key) {
        body += `<div class="problem"><div class="num">${n}.</div><div>
          <div class="final">${keyAnswer(part)}</div>
          <div class="steps">${p.solution.filter((s) => !/^The correct picture:/.test(s)).map((s) => `<div>${forPaper(s)}</div>`).join('')}</div></div></div>`;
      } else {
        const calc = P.CATEGORY[sec][p.type] === 'calc';
        body += calc
          ? `<div class="problem calc"><div class="num">${n}.</div><div>${forPaper(p.promptHTML)}${partHTML(part, true)}<div class="work"></div></div></div>`
          : `<div class="problem"><div class="num">${n}.</div><div>${forPaper(p.promptHTML)}${partHTML(part, false)}</div></div>`;
      }
    });
    if (problems.filter((p) => p.section === sec).length < 2) body += '</div>';
  }
  const title = key ? 'Unit 3 Review — Answer Key' : 'Unit 3 Review';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head>
<body class="${key ? 'key' : 'sheet'}">${HEADER(key)}${body}
<!-- generated by review/build-review.js, seed ${SEED} --></body></html>`;
}

const files = [['Unit3_Review', sheet(false)], ['Unit3_Review_Key', sheet(true)]];
for (const [name, html] of files) fs.writeFileSync(path.join(OUT, name + '.html'), html);

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) {
    console.log('HTML written; install Playwright to also print the PDFs.');
    return;
  }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, html] of files) {
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({
      path: path.join(OUT, name + '.pdf'), format: 'Letter', printBackground: true,
      margin: { top: '0.6in', bottom: '0.6in', left: '0.7in', right: '0.7in' },
    });
    console.log('wrote review/' + name + '.pdf');
  }
  await browser.close();
})();
