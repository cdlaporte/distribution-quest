/*
 * Distribution Quest — the game.
 * A top-down dungeon crawler. Combat, movement and upgrades are pure game;
 * stats problems are the keys to chests, shrines and boss shields.
 */
(() => {
  'use strict';
  const PR = window.Problems;
  const A = DQ.Art;
  const S = DQ.Story;
  const $ = (id) => document.getElementById(id);

  // ================= constants =================
  // The screen shows a 23 x 13 tile view. Most rooms are exactly that size; big rooms are larger and the camera follows you.
  const T = 48, VCOLS = 23, VROWS = 13, VW = VCOLS * T, VH = VROWS * T, HUD = 64;
  const CW = VW, CH = VH + HUD;
  let COLS = VCOLS, ROWS = VROWS, RW = VW, RH = VH;
  let DC = [10, 11, 12], DR = [5, 6, 7];
  function setDims(room) {
    COLS = (room && room.cols) || VCOLS; ROWS = (room && room.rows) || VROWS;
    RW = COLS * T; RH = ROWS * T;
    const mc = Math.floor(COLS / 2), mr = Math.floor(ROWS / 2);
    DC = [mc - 1, mc, mc + 1]; DR = [mr - 1, mr, mr + 1];
  }
  const FLOOR = 0, WALL = 1, ROCK = 2, PIT = 3;
  const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
  const TAU = Math.PI * 2;
  const SECTIONS = ['3.1', '3.2', '3.3', '3.4', '3.5'];
  const SEC_NAMES = { '3.1': 'Percentiles', '3.2': 'Uniform Distributions', '3.3': 'z-Scores', '3.4': 'Normal Distributions (Desmos)', '3.5': 'The Empirical Rule' };
  const SEC_COLORS = { '3.1': '#6ab8ff', '3.2': '#ffc35a', '3.3': '#6fe39a', '3.4': '#ff9f5a', '3.5': '#d29cff' };
  const secName = (s) => (PR && PR.SECTION_INFO && PR.SECTION_INFO[s] && PR.SECTION_INFO[s].name) || SEC_NAMES[s];
  const secColor = (s) => (PR && PR.SECTION_INFO && PR.SECTION_INFO[s] && PR.SECTION_INFO[s].color) || SEC_COLORS[s];
  const ENEMY_TINTS = [
    { slime: '#3fd7c0', bat: '#9b6ad6', boar: '#8f7d9e', ghost: '#d6ebff', eye: '#5ab0ff' },
    { slime: '#ffb347', bat: '#c9783a', boar: '#b8834f', ghost: '#fff1d0', eye: '#ffd23f' },
    { slime: '#7ad94f', bat: '#5a8a3a', boar: '#6b5538', ghost: '#c8ffd8', eye: '#5fe39a' },
    { slime: '#ff7a4a', bat: '#a8661f', boar: '#9a5a2a', ghost: '#ffe0c0', eye: '#ff9f43' },
    { slime: '#c66bff', bat: '#6a3fb0', boar: '#5a3f7a', ghost: '#e8d8ff', eye: '#ff5fd8' },
  ];
  const DEBUG = /[?&]debug=1/.test(location.search);

  // ================= utils =================
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
  const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ================= settings & save =================
  const SKEY = 'distQuest.settings.v1', SAVEKEY = 'distQuest.save.v1';
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  const settings = Object.assign({ sections: { '3.1': true, '3.2': true, '3.3': true, '3.4': true, '3.5': true }, mode: 'floor', extra: false, sound: true, name: '', teacherSkip: false, startFloor: 1, funUnlocked: false, funMode: false }, store.get(SKEY) || {});
  let teacherUnlocked = false;
  const skipOn = () => !!settings.teacherSkip || !!(G.run && G.run.fun);
  const saveSettings = () => store.set(SKEY, settings);
  const enabledSections = () => SECTIONS.filter((s) => settings.sections[s]);

  // ================= audio =================
  let actx = null;
  function audio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, type, vol, slide, delay) {
    if (!settings.sound) return;
    const a = audio(); if (!a) return;
    const t0 = a.currentTime + (delay || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol || 0.05, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, hp) {
    if (!settings.sound) return;
    const a = audio(); if (!a) return;
    const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = hp || 900;
    s.buffer = buf; g.gain.value = vol || 0.1;
    s.connect(f); f.connect(g); g.connect(a.destination); s.start();
  }
  const sfx = {
    shoot: () => tone(880, 0.05, 'square', 0.018, -300),
    hit: () => tone(220, 0.06, 'square', 0.035, -80),
    kill: () => { tone(330, 0.08, 'square', 0.04, -200); noise(0.12, 0.05); },
    hurt: () => { tone(160, 0.25, 'sawtooth', 0.07, -90); noise(0.2, 0.08); },
    coin: () => { tone(988, 0.05, 'square', 0.03); tone(1319, 0.08, 'square', 0.03, 0, 0.05); },
    heart: () => { tone(523, 0.08, 'triangle', 0.06); tone(784, 0.12, 'triangle', 0.06, 0, 0.08); },
    door: () => noise(0.25, 0.1, 400),
    boom: () => { noise(0.6, 0.22, 300); tone(70, 0.5, 'sawtooth', 0.08, -40); },
    shield: () => { tone(400, 0.3, 'sine', 0.06, 600); tone(600, 0.3, 'sine', 0.04, 600, 0.05); },
    correct: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'triangle', 0.07, 0, i * 0.08)),
    wrong: () => { tone(200, 0.15, 'square', 0.05); tone(150, 0.2, 'square', 0.05, 0, 0.12); },
    item: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.1, 'square', 0.04, 0, i * 0.06)),
    dash: () => noise(0.12, 0.06, 2000),
    blip: (pitch) => tone(pitch || 520, 0.03, 'square', 0.02),
    bell: () => { tone(660, 1.2, 'sine', 0.08); tone(1320, 0.9, 'sine', 0.03); tone(990, 1.0, 'triangle', 0.02); },
    zap: () => tone(1200, 0.12, 'sawtooth', 0.03, -900),
    crack: () => noise(0.15, 0.12, 1200),
    scream: () => tone(900, 0.5, 'sawtooth', 0.04, 600),
    power: () => { for (let i = 0; i < 8; i++) tone(200 + i * 90, 0.25, 'sawtooth', 0.04, 200, i * 0.12); noise(1.4, 0.12, 600); },
    whistle: () => { tone(2200, 0.18, 'square', 0.04); tone(2200, 0.3, 'square', 0.04, 0, 0.22); },
    chomp: () => { noise(0.08, 0.1, 1500); noise(0.08, 0.1, 1500); tone(300, 0.06, 'square', 0.03, 0, 0.1); },
  };

  // ================= canvas & input =================
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  canvas.width = CW; canvas.height = CH;
  function resize() {
    const s = Math.min(window.innerWidth / CW, window.innerHeight / CH);
    canvas.style.width = Math.floor(CW * s) + 'px';
    canvas.style.height = Math.floor(CH * s) + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  const keys = {}, pressed = {};
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
  const typed = [];
  window.addEventListener('keydown', (e) => {
    if (G.mode === 'modal') return modalKey(e);
    if (G.mode === 'charsel') {
      if (e.key === '1' || e.code === 'ArrowLeft' || e.code === 'KeyA') markCharSel('boy');
      if (e.key === '2' || e.code === 'ArrowRight' || e.code === 'KeyD') markCharSel('girl');
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); confirmCharSel(); }
      return;
    }
    if (G.mode === 'pick') return pickKey(e);
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (['play', 'talk', 'cut'].includes(G.mode) && GAME_KEYS.includes(e.code)) e.preventDefault();
    if (G.mode === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) { e.preventDefault(); resumeGame(); return; }
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    if (e.key && e.key.length === 1) { typed.push(e.key.toUpperCase()); if (typed.length > 12) typed.shift(); checkSecretCodes(); }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => {
    Object.keys(keys).forEach((k) => (keys[k] = false));
    mouse.down = false;
    if (G.mode === 'play') pauseGame();
  });
  function canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (CW / r.width), y: (e.clientY - r.top) * (CH / r.height) - HUD };
  }
  canvas.addEventListener('mousemove', (e) => { Object.assign(mouse, canvasPos(e)); mouse.in = true; });
  canvas.addEventListener('mouseleave', () => { mouse.in = false; });
  canvas.addEventListener('mousedown', (e) => { Object.assign(mouse, canvasPos(e)); mouse.down = true; mouse.clicked = true; e.preventDefault(); canvas.focus(); });
  window.addEventListener('mouseup', () => (mouse.down = false));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  const clearInput = () => {
    Object.keys(keys).forEach((k) => (keys[k] = false));
    Object.keys(pressed).forEach((k) => delete pressed[k]);
    mouse.down = false; mouse.clicked = false;
  };
  const blurUI = () => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); };

  // ================= items =================
  // icon: an emoji, or 'img:<name>' for a pixel sprite
  const ITEMS = [
    { id: 'shake', stat: true, name: 'Protein Shake', icon: '🥤', rarity: 'common', desc: '+50% damage. Gains are gains.', apply: (p) => { p.damage += 0.5; } },
    { id: 'sneakers', stat: true, name: 'Hall-Pass Sneakers', icon: '👟', rarity: 'common', desc: 'Move 12% faster and dash more often.', apply: (p) => { p.speed *= 1.12; p.dashCd *= 0.85; } },
    { id: 'pencil', stat: true, name: 'Mechanical Pencil', icon: '✏️', rarity: 'common', desc: 'Shoot 18% faster. Click click click.', apply: (p) => { p.fireDelay *= 0.82; } },
    { id: 'credit', stat: true, name: 'Extra Credit', icon: '💯', rarity: 'common', desc: '+1 max heart and heal to full.', apply: (p) => { p.maxHp += 1; p.hp = p.maxHp; } },
    { id: 'textbook', stat: true, name: 'Heavy Textbook', icon: '📕', rarity: 'common', desc: 'Bigger, harder-hitting shots (+30% damage).', apply: (p) => { p.size += 3; p.damage += 0.3; } },
    { id: 'ruler', stat: true, name: 'Meter Stick', icon: '📏', rarity: 'common', desc: 'Shots fly farther and faster.', apply: (p) => { p.range *= 1.35; p.shotSpeed *= 1.15; } },
    { id: 'orbitals', name: 'Standard Deviation Orbitals', icon: '🪐', rarity: 'epic', unique: true, desc: 'Three orbs circle you at 1σ, 2σ and 3σ. They hurt enemies and block bullets.', apply: (p) => { p.orbitals = 3; } },
    { id: 'boomerang', name: 'Bell Curve Boomerang', icon: '🪃', rarity: 'epic', unique: true, desc: 'Shots swing out in a bell-shaped arc and come back to you, hitting everything twice.', apply: (p) => { p.boomerang = true; p.range *= 1.2; } },
    { id: 'zapper', name: 'Z-Score Zapper', icon: '⚡', rarity: 'rare', desc: 'Hits zap lightning to 2 nearby enemies (more if you stack it).', apply: (p) => { p.zapper += 2; } },
    { id: 'spread', name: 'Uniform Spread', icon: '🎆', rarity: 'rare', desc: '+2 shots in a perfectly even fan.', apply: (p) => { p.shots += 2; } },
    { id: 'boxplot', name: 'Box Plot Shield', icon: '🛡️', rarity: 'rare', unique: true, desc: 'Blocks the first hit you take in every room.', apply: (p) => { p.boxShield = true; p.shieldReady = true; } },
    { id: 'aura', name: 'Empirical Aura', icon: '🌀', rarity: 'epic', unique: true, desc: 'Every 3 seconds you pulse rings at 68, 95 and 99.7 that damage nearby enemies.', apply: (p) => { p.aura = 1; } },
    { id: 'piercer', name: 'Percentile Piercer', icon: '🎯', rarity: 'rare', unique: true, desc: 'Shots pierce through enemies. 100th percentile sharpness.', apply: (p) => { p.pierce = true; } },
    { id: 'outlier', name: 'Outlier Shot', icon: '💥', rarity: 'rare', unique: true, desc: 'Every 6th shot is a HUGE outlier that does 4× damage.', apply: (p) => { p.outlier = true; } },
    { id: 'meanrev', name: 'Regression to the Mean', icon: '📉', rarity: 'rare', unique: true, desc: 'Clearing a room heals you 1 heart if you are below half health.', apply: (p) => { p.meanRev = true; } },
    { id: 'drone', name: 'Sampling Drone', icon: '🛸', rarity: 'epic', unique: true, desc: 'A little drone follows you and blasts a random sample of enemies.', apply: (p) => { addPet('drone'); } },
    { id: 'calc', name: 'Golden Calculator', icon: '🧮', rarity: 'rare', unique: true, desc: 'Coins are worth double, and shop prices drop 25%.', apply: (p) => { p.goldMult = 2; p.discount = 0.75; } },
    { id: 'edamame', name: 'Edamame Bean Blaster', icon: 'img:edamame', rarity: 'epic', unique: true, desc: 'Your shots become dried edamame beans that crumble into 3 crunchy bits on impact. High in protein!', apply: (p) => { p.edamameGun = true; } },
    { id: 'homing', name: "Teacher's Pet Tracker", icon: '🍎', rarity: 'rare', unique: true, desc: 'Shots curve toward enemies.', apply: (p) => { p.homing = 1; } },
    { id: 'bounce', name: 'Ricochet Protractor', icon: '📐', rarity: 'common', desc: 'Shots bounce off walls twice. Angle of incidence!', apply: (p) => { p.bounce += 2; } },
    { id: 'frost', name: 'Chill Pill', icon: '❄️', rarity: 'common', unique: true, desc: 'Shots freeze enemies, slowing them down.', apply: (p) => { p.frost = true; } },
    { id: 'thorns', name: 'Spiky Backpack', icon: '🎒', rarity: 'common', unique: true, desc: 'When you get hurt, you spray spikes in every direction.', apply: (p) => { p.thorns = true; } },
    { id: 'magnet', name: 'Attendance Magnet', icon: '🧲', rarity: 'common', unique: true, desc: 'Coins and hearts zoom to you. Everyone is present!', apply: (p) => { p.magnet = true; } },
    { id: 'hallpass', name: 'Hall Pass', icon: '🎫', rarity: 'epic', desc: 'If you would be defeated, you get back up with 3 hearts instead (once).', apply: (p) => { p.hallPass += 1; } },
    { id: 'regression', name: 'Regression Laser', icon: '📈', rarity: 'epic', unique: true, desc: 'Every 5th shot is a line-of-best-fit laser that blasts across the whole room.', apply: (p) => { p.regression = true; } },
    { id: 'clones', name: 'Bootstrap Clones', icon: '👥', rarity: 'epic', unique: true, desc: 'Dashing creates 2 clones of you (resampled, of course) that shoot alongside you for 3 seconds.', apply: (p) => { p.clones = true; } },
    { id: 'rockets', name: 'Random Walk Rockets', icon: '🚀', rarity: 'epic', unique: true, desc: 'Every 1.5 seconds you launch a rocket that wanders randomly, then explodes.', apply: (p) => { p.rockets = true; } },
    { id: 'chalk', name: 'Chalk Trail', icon: '🖍️', rarity: 'rare', unique: true, desc: 'You leave a glowing chalk line behind you that burns enemies who touch it.', apply: (p) => { p.chalk = true; } },
    { id: 'vines', name: 'Stem-and-Leaf Vines', icon: '🌿', rarity: 'rare', unique: true, desc: 'Your shots sprout vines that root enemies in place for a moment.', apply: (p) => { p.vines = true; } },
    { id: 'pinata', name: 'Percentile Piñata', icon: '🪅', rarity: 'rare', unique: true, desc: 'Enemies below the 10th percentile of their health burst into confetti that damages their friends.', apply: (p) => { p.pinata = true; } },
    { id: 'saw', name: 'Pie Chart Buzzsaw', icon: '🥧', rarity: 'epic', unique: true, desc: 'Every 2.5 seconds you fling a spinning pie-chart saw that slices through enemies and comes back.', apply: (p) => { p.saw = true; } },
    { id: 'tail', name: 'Tail Event', icon: '☄️', rarity: 'rare', desc: 'Rare events happen: some of your shots become giant flaming meteors.', apply: (p) => { p.tail += 0.05; } },
    { id: 'grading', name: 'A+ Grading', icon: '🅰️', rarity: 'rare', unique: true, desc: '15% of your hits are critical: 2.5× damage and a big red "A+" stamp.', apply: (p) => { p.crit = 0.15; } },
    { id: 'nova', name: 'Normal Nova', icon: '🔔', rarity: 'epic', unique: true, desc: 'Every 7 seconds a bell-curve shockwave erupts from you and blasts enemies away.', apply: (p) => { p.nova = true; p.novaT = 2; } },
    { id: 'dice', stat: true, name: 'Loaded Dice', icon: '🎲', rarity: 'common', desc: 'Enemies drop more coins, hearts and edamame. The distribution is... skewed.', apply: (p) => { p.luck += 1; } },
  ];
  const LOUNGE_ITEMS = [
    { id: 'coffee', name: 'Faculty Coffee', icon: '☕', rarity: 'staff', desc: 'Shoot 30% faster, move 10% faster, dash 30% more often. Staff-strength.', apply: (p) => { p.fireDelay *= 0.7; p.speed *= 1.1; p.dashCd *= 0.7; } },
    { id: 'redpen', name: 'Red Pen of Truth', icon: '🖍️', rarity: 'staff', desc: 'Your shots become red ink: +60% damage and they pierce. See me after class.', apply: (p) => { p.damage += 0.6; p.pierce = true; p.redPen = true; } },
    { id: 'lanyard', name: 'Staff Lanyard', icon: '📛', rarity: 'staff', desc: '+2 max hearts and heal to full. You basically work here now.', apply: (p) => { p.maxHp += 2; p.hp = p.maxHp; } },
    { id: 'subplans', name: 'Sub Plans', icon: '📋', rarity: 'staff', desc: 'A substitute teacher joins you and throws paper airplanes at enemies.', apply: () => { addPet('sub'); } },
  ];
  const ALL_ITEMS = ITEMS.concat(LOUNGE_ITEMS);
  const itemById = (id) => ALL_ITEMS.find((i) => i.id === id);
  function rollItems(n, pool) {
    const have = G.run ? G.run.items : [];
    const src = (pool || ITEMS).filter((i) => !(i.unique && have.includes(i.id)));
    // weighted draw without replacement: epic items are rarer, and at most one plain stat boost per offer
    const W = { common: 1, rare: 0.55, epic: 0.26, staff: 1 };
    const out = [];
    let bag = src.slice();
    let statUsed = false;
    while (out.length < n && bag.length) {
      const pool = bag.filter((it) => !(it.stat && statUsed));
      if (!pool.length) break;
      const weights = pool.map((it) => (it.stat ? 1.1 : W[it.rarity] || 1));
      let r = Math.random() * weights.reduce((a, b) => a + b, 0);
      let k = 0;
      while (r > weights[k] && k < pool.length - 1) { r -= weights[k]; k++; }
      const it = pool[k];
      out.push(it);
      if (it.stat) statUsed = true;
      bag = bag.filter((x) => x !== it);
    }
    return out;
  }
  function giveItem(item) {
    const run = G.run, p = run.player;
    run.items.push(item.id);
    item.apply(p);
    sfx.item();
    burst(p.x, p.y, '#ffe27a', 30, 240);
    floatText(p.x, p.y - 40, item.name + '!', '#ffe27a', 2.2);
  }

  // ================= game state =================
  const G = {
    mode: 'title', run: null, room: null, t: 0, shake: 0, fade: 0, banner: null, flash: 0,
    enemies: [], pbullets: [], ebullets: [], particles: [], texts: [], hazards: [], timers: [], actors: [], ambient: [],
    locked: false, bg: null, deathT: 0, hint: null, talk: null, bark: null, cut: null, psy: 0, titleT: 0,
    cam: { x: 0, y: 0 }, beams: [], clones: [], stamps: [], rockets: [], chalk: [], saws: [], novas: [], vfxRings: [], bolts: [], zoom: 0, slowmo: 0,
  };
  DQ.G = G;

  function newPlayer() {
    return {
      x: RW / 2, y: RH / 2, r: 14, hp: 6, maxHp: 6,
      speed: 235, damage: 1, fireDelay: 0.32, shotSpeed: 520, range: 0.72, shots: 1, size: 6,
      pierce: false, bounce: 0, homing: 0, orbitals: 0, frost: false, thorns: false, magnet: false,
      boxShield: false, shieldReady: false, zapper: 0, boomerang: false, aura: 0, auraT: 3, outlier: false, shotCount: 0,
      meanRev: false, goldMult: 1, discount: 1, edamameGun: false, hallPass: 0, luck: 0, redPen: false, protein: 0,
      regression: false, clones: false, rockets: false, rocketT: 1.5, chalk: false, chalkT: 0, vines: false, pinata: false,
      saw: false, sawT: 2.5, tail: 0, crit: 0, nova: false, novaT: 7, webbed: 0,
      dashCd: 0.85, dashT: 0, dashCdT: 0, dashX: 0, dashY: 0, inv: 0, fireT: 0,
      faceX: 0, faceY: 1, walkT: 0, moving: false,
    };
  }
  function newRunState() {
    return {
      floor: 1, player: newPlayer(), gold: 0, items: [], name: settings.name || '', pets: [],
      stats: { attempted: 0, solved: 0, perfect: 0, hints: 0, bySec: {} }, start: Date.now(), playTime: 0,
      kills: 0, hats: [], edamame: 0, eddie: false, flags: {}, lounges: 0, deaths: 0, hero: 'boy', floorSolved: 0, freeSolves: 0, skipped: 0,
    };
  }

  // Which section a problem on this floor should come from
  function sectionFor(hard) {
    const en = enabledSections();
    if (!en.length) return '3.1';
    const f = G.run ? G.run.floor : 1;
    if (f >= 6 || settings.mode === 'mixed') return pick(en);
    const s = SECTIONS[f - 1];
    return settings.sections[s] ? s : pick(en);
  }

  // ================= map generation =================
  function newFloor(floor) {
    const run = G.run;
    run.floor = floor;
    run.theme = A.THEMES[floor - 1];
    const target = 11 + floor;
    const rooms = new Map();
    const key = (x, y) => x + ',' + y;
    let seed = Math.floor(Math.random() * 1e9);
    const add = (x, y) => { const r = { gx: x, gy: y, type: 'combat', doors: {}, objects: [], pickups: [], cleared: false, visited: false, seen: false, seed: seed++ }; rooms.set(key(x, y), r); return r; };
    const start = add(0, 0);
    let guard = 0;
    while (rooms.size < target && guard++ < 5000) {
      const from = pick([...rooms.values()]);
      const d = pick(Object.keys(DIRS));
      const nx = from.gx + DIRS[d][0], ny = from.gy + DIRS[d][1];
      if (rooms.has(key(nx, ny)) || Math.abs(nx) > 4 || Math.abs(ny) > 3) continue;
      let nb = 0;
      for (const dd of Object.values(DIRS)) if (rooms.has(key(nx + dd[0], ny + dd[1]))) nb++;
      if (nb > 1) continue;
      add(nx, ny);
    }
    for (const r of rooms.values()) for (const [d, v] of Object.entries(DIRS)) { const n = rooms.get(key(r.gx + v[0], r.gy + v[1])); if (n) r.doors[d] = n; }
    const distTo = new Map([[start, 0]]);
    const q = [start];
    while (q.length) { const r = q.shift(); for (const n of Object.values(r.doors)) if (!distTo.has(n)) { distTo.set(n, distTo.get(r) + 1); q.push(n); } }
    const all = [...rooms.values()];
    const deadEnds = all.filter((r) => r !== start && Object.keys(r.doors).length === 1).sort((a, b) => distTo.get(b) - distTo.get(a));
    const boss = deadEnds.length ? deadEnds.shift() : all.filter((r) => r !== start).sort((a, b) => distTo.get(b) - distTo.get(a))[0];
    boss.type = 'boss';
    start.type = 'start'; start.cleared = true;
    const specials = ['treasure', 'shrine', 'shop', 'vault'];
    const shuffledDead = shuffle(deadEnds);
    const others = shuffle(all.filter((r) => r.type === 'combat' && !shuffledDead.includes(r)));
    for (const s of specials) {
      const r = shuffledDead.shift() || (others.length > 4 ? others.shift() : null);
      if (!r) break;
      r.type = s; r.cleared = true;
    }
    // some fight rooms are big (the camera pans with you)
    for (const r of rooms.values()) {
      if (r.type !== 'combat' || Math.random() > 0.3) continue;
      const [c, rr] = pick([[45, 13], [45, 13], [23, 25], [23, 25], [45, 25]]);
      r.cols = c; r.rows = rr; r.big = true;
    }
    for (const r of rooms.values()) buildRoom(r);
    if (Math.random() < (run.lounges === 0 && floor >= 2 ? 0.95 : 0.75)) addLounge(rooms);
    run.floorSolved = 0;
    run.rooms = rooms;
    run.boss = boss;
    run.flags.securityDone = false; run.flags.helpDone = false;
    run.player.x = RW / 2; run.player.y = RH / 2 + 60;
    run.player.hp = Math.max(run.player.hp, Math.ceil(run.player.maxHp / 2));
    enterRoom(start);
    G.banner = { text: `Floor ${floor}`, sub: run.theme.name, t: 3.2, sec: settings.mode === 'mixed' ? null : SECTIONS[floor - 1] };
  }

  const gapTiles = (d) => (d === 'n' ? DC.map((c) => [c, 0]) : d === 's' ? DC.map((c) => [c, ROWS - 1])
    : d === 'w' ? DR.map((r) => [0, r]) : DR.map((r) => [COLS - 1, r]));

  // The Teachers' Lounge: a secret room behind a cracked wall in a fight room
  function addLounge(rooms) {
    const k = (x, y) => x + ',' + y;
    const hosts = shuffle([...rooms.values()].filter((r) => r.type === 'combat'));
    for (const h of hosts) {
      for (const d of shuffle(Object.keys(DIRS))) {
        const nx = h.gx + DIRS[d][0], ny = h.gy + DIRS[d][1];
        if (rooms.has(k(nx, ny)) || h.doors[d]) continue;
        const L = { gx: nx, gy: ny, type: 'lounge', doors: { [OPP[d]]: h }, objects: [], pickups: [], cleared: true, visited: false, seen: false, seed: irand(1, 1e9) };
        rooms.set(k(nx, ny), L);
        buildRoom(L);
        h.doors[d] = L; h.secretDir = d; h.secretHits = 0; h.secretOpen = false;
        setDims(h);
        h.tiles && gapTiles(d).forEach(([c, r]) => (h.tiles[r][c] = WALL));
        return;
      }
    }
  }
  const isSecretShut = (room, d) => room.secretDir === d && !room.secretOpen;
  function hitSecretWall(room, x, y) {
    room.secretHits++;
    sfx.crack();
    G.shake = Math.max(G.shake, 4);
    burst(x, y, '#9a8f80', 10, 160);
    if (room.secretHits >= 3) {
      room.secretOpen = true;
      gapTiles(room.secretDir).forEach(([c, r]) => (room.tiles[r][c] = FLOOR));
      room.doors[room.secretDir].seen = true;
      G.bg = renderBG(room);
      sfx.door();
      burst(x, y, '#c9b89a', 34, 260);
      G.banner = { text: 'A secret passage!', sub: 'Wait… is that coffee?', t: 2.6, small: true };
    }
  }

  function buildRoom(room) {
    setDims(room);
    const t = [];
    for (let r = 0; r < ROWS; r++) { t.push([]); for (let c = 0; c < COLS; c++) t[r].push(r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? WALL : FLOOR); }
    if (room.doors.n) DC.forEach((c) => (t[0][c] = FLOOR));
    if (room.doors.s) DC.forEach((c) => (t[ROWS - 1][c] = FLOOR));
    if (room.doors.w) DR.forEach((r) => (t[r][0] = FLOOR));
    if (room.doors.e) DR.forEach((r) => (t[r][COLS - 1] = FLOOR));
    room.tiles = t;
    room.deco = [];
    for (let i = 0; i < 16 * (COLS * ROWS) / (VCOLS * VROWS); i++) room.deco.push({ x: rand(T * 1.5, RW - T * 1.5), y: rand(T * 1.5, RH - T * 1.5), k: irand(0, 2), a: rand(0, 3) });
    const cx = RW / 2, cy = RH / 2;
    const set = (c, r, v) => {
      if (DC.includes(c) || DR.includes(r)) return;
      if (r <= 0 || c <= 0 || r >= ROWS - 1 || c >= COLS - 1) return;
      t[r][c] = v;
    };
    const mirror = (c, r, v) => { set(c, r, v); set(COLS - 1 - c, r, v); set(c, ROWS - 1 - r, v); set(COLS - 1 - c, ROWS - 1 - r, v); };
    if (room.type === 'combat') {
      const layout = pick(['none', 'pillars', 'quads', 'lines', 'scatter', 'corners', 'quads', 'pillars']);
      if (layout === 'pillars') [[4, 3], [5, 3], [4, 4], [5, 4]].forEach(([c, r]) => mirror(c, r, ROCK));
      if (layout === 'lines') for (let c = 3; c <= 8; c++) mirror(c, 3, ROCK);
      if (layout === 'corners') [[2, 2], [3, 2], [2, 3]].forEach(([c, r]) => mirror(c, r, ROCK));
      if (layout === 'quads') { for (let i = 0; i < 4; i++) mirror(irand(3, 8), irand(2, 3), ROCK); }
      if (layout === 'scatter') { for (let i = 0; i < 6; i++) set(irand(2, COLS - 3), irand(2, ROWS - 3), ROCK); }
      if (layout !== 'scatter' && Math.random() < 0.3) for (let i = 0; i < 2; i++) mirror(irand(7, 9), irand(1, 3), PIT);
      if (room.big) {
        const mc = Math.floor(COLS / 2), mr = Math.floor(ROWS / 2);
        for (let i = 0; i < 5; i++) { const c = irand(3, mc - 2), r = irand(2, mr - 1); mirror(c, r, ROCK); if (Math.random() < 0.5) mirror(c + 1, r, ROCK); }
        if (Math.random() < 0.5) for (let i = 0; i < 3; i++) mirror(irand(4, mc - 3), irand(3, mr - 2), PIT);
      }
    }
    if (room.type === 'boss') [[3, 2], [3, 10]].forEach(([c, r]) => mirror(c, r, ROCK));
    if (room.type === 'treasure') room.objects.push({ kind: 'chest', golden: true, x: cx, y: cy, r: 24, mimic: Math.random() < 0.14 });
    if (room.type === 'vault') room.objects.push({ kind: 'chest', golden: true, unlocked: true, vault: true, x: cx, y: cy, r: 24 });
    if (room.type === 'shrine') room.objects.push({ kind: 'shrine', x: cx, y: cy - 10, r: 28 });
    if (room.type === 'lounge') {
      room.objects.push({ kind: 'coffee', x: 4 * T, y: 2.6 * T, r: 24 });
      room.objects.push({ kind: 'bowl', x: cx, y: cy + 10, r: 20 });
      room.objects.push({ kind: 'couch', x: RW - 5 * T, y: 2.6 * T, r: 34 });
      room.objects.push({ kind: 'board', x: cx, y: 1.5 * T, r: 26 });
      room.objects.push({ kind: 'fridge', x: 2 * T, y: RH - 2.6 * T, r: 22 });
    }
    if (room.type === 'shop') {
      const items = rollItems(2);
      const f = (G.run && G.run.floor) || 1;
      const wares = [
        { item: items[0], price: irand(12, 16) + f * 2 },
        { heal: true, price: 4 + f },
        { edamame: true, price: 6 + f },
        { item: items[1], price: irand(14, 18) + f * 2 },
      ];
      wares.forEach((w, i) => room.objects.push(Object.assign({ kind: 'shopItem', x: cx + (i - 1.5) * 150, y: cy + 30, r: 22 }, w)));
      room.objects.push({ kind: 'vending', x: cx, y: cy - 110, r: 30 });
    }
    if (room.type === 'start' && G.run && G.run.floor === 1) room.objects.push({ kind: 'gate', x: cx, y: 1.5 * T, r: 30 });
  }

  function renderBG(room) {
    const th = room.type === 'lounge' ? A.LOUNGE_THEME : G.run.theme;
    return A.renderRoom(room, th, T, COLS, ROWS);
  }

  // ================= rooms =================
  function enterRoom(room, fromDir) {
    const run = G.run;
    setDims(room);
    G.room = room;
    run.cur = room;
    const firstVisit = !room.visited;
    room.visited = true; room.seen = true;
    Object.entries(room.doors).forEach(([d, n]) => { if (!isSecretShut(room, d)) n.seen = true; });
    G.enemies = []; G.pbullets = []; G.ebullets = []; G.particles = []; G.hazards = []; G.timers = [];
    G.beams = []; G.clones = []; G.stamps = []; G.rockets = []; G.chalk = []; G.saws = []; G.novas = []; G.vfxRings = []; G.bolts = []; G.stampede = 0;
    G.actors = G.actors.filter((a) => a.keep);
    G.locked = false;
    G.fade = 0.3;
    const p = run.player;
    if (fromDir) {
      if (fromDir === 'n') { p.x = RW / 2; p.y = T * 1.5; }
      if (fromDir === 's') { p.x = RW / 2; p.y = RH - T * 1.5; }
      if (fromDir === 'w') { p.x = T * 1.5; p.y = RH / 2; }
      if (fromDir === 'e') { p.x = RW - T * 1.5; p.y = RH / 2; }
    }
    if (p.boxShield) p.shieldReady = true;
    run.pets.forEach((pt, i) => { pt.x = p.x - 30 + i * 10; pt.y = p.y + 20; });
    room.enteredFrom = fromDir;
    if (!room.cleared && room.type === 'combat') {
      const f = run.floor;
      const area = (COLS * ROWS) / (VCOLS * VROWS);
      const n = Math.min(20, Math.round((4 + Math.floor((f - 1) * 0.7) + irand(0, 1) + (f >= 3 ? 1 : 0) + (f >= 2 ? 1 : 0)) * (area > 1 ? 0.75 + area * 0.45 : 1)));
      // each floor introduces new monsters
      const kinds = [
        ['slime', 'slime', 'slime', 'bat', 'bat', 'archer', 'boar'],
        ['slime', 'slime', 'bigslime', 'bat', 'archer', 'boar', 'eye', 'dice', 'dice'],
        ['slime', 'bigslime', 'bat', 'archer', 'boar', 'eye', 'dice', 'ghost', 'ghost', 'knight', 'knight'],
        ['bigslime', 'bat', 'archer', 'boar', 'eye', 'ghost', 'dice', 'knight', 'spider', 'spider', 'bomber', 'bomber'],
        ['bigslime', 'bat', 'archer', 'archer', 'eye', 'ghost', 'dice', 'knight', 'spider', 'bomber', 'wraith', 'wraith', 'wraith'],
      ][f - 1] || ['slime'];
      const spots = spawnSpots(room, p);
      for (let i = 0; i < n && spots.length; i++) {
        const s = spots.splice(irand(0, spots.length - 1), 1)[0];
        let kind = pick(kinds);
        if (kind === 'archer' && G.enemies.filter((e) => e.kind === 'archer').length >= 2) kind = pick(['slime', 'bat']);
        if (kind === 'eye' && G.enemies.filter((e) => e.kind === 'eye').length >= 2) kind = 'slime';
        if (kind === 'bomber' && G.enemies.filter((e) => e.kind === 'bomber').length >= 2) kind = 'bat';
        G.enemies.push(makeEnemy(kind, s.x, s.y));
      }
      G.locked = G.enemies.length > 0;
      if (G.locked) sfx.door();
      const fresh = G.enemies.map((e) => e.kind).find((k) => S.enemyTips[k] && !run.flags['met_' + k]);
      if (fresh) { run.flags['met_' + fresh] = true; later(0.9, () => bark(S.enemyTips[fresh], 'serious', 4.5)); }
      else if (!maybeStampede()) maybeSecurity();
    }
    if (!room.cleared && room.type === 'boss') {
      G.locked = true;
      G.bg = renderBG(room);
      const finalRetry = run.floor === 5 && run.flags.finalFight;
      const b = makeBoss(finalRetry ? 6 : run.floor);
      if (finalRetry) { G.psy = 1; room.holdLock = false; later(0.4, () => bark(S.finalRetry, 'smug', 3.5)); }
      b.x = clamp(RW / 2 + (RW / 2 - p.x) * 0.5, T * 3, RW - T * 3);
      b.y = clamp(RH / 2 + (RH / 2 - p.y) * 0.5, T * 3, RH - T * 3);
      G.enemies.push(b);
      sfx.boom();
      if (!run.flags['bossIntro' + run.floor]) {
        run.flags['bossIntro' + run.floor] = true;
        startTalk(S.bossIntro[run.floor - 1], null, true);
      }
      return;
    }
    G.bg = renderBG(room);
    snapCamera();
    if (firstVisit) roomTips(room);
  }

  function camTarget() {
    const p = G.run.player;
    return { x: clamp(p.x - VW / 2, 0, RW - VW), y: clamp(p.y - VH / 2, 0, RH - VH) };
  }
  function snapCamera() { G.cam = camTarget(); }
  function updateCamera(dt) {
    const t = camTarget();
    G.cam.x = lerp(G.cam.x, t.x, Math.min(1, dt * 8));
    G.cam.y = lerp(G.cam.y, t.y, Math.min(1, dt * 8));
  }
  function roomTips(room) {
    const run = G.run, fl = run.flags;
    if (room.type === 'lounge' && !fl.loungeTalk) {
      fl.loungeTalk = true;
      run.lounges++;
      laporteCameo('lounge');
    } else if (room.type === 'shop' && !fl.shopTip) { fl.shopTip = true; bark(S.tips.shop); }
    else if (room.type === 'shrine' && !fl.shrineTip) { fl.shrineTip = true; bark(S.tips.shrine); }
    else if (room.type === 'treasure' && !fl.treasureTip) { fl.treasureTip = true; bark(S.tips.treasure); }
    else if (room.type === 'combat' && Math.random() < 0.12 && G.t - (fl.lastQuip || -99) > 60) {
      fl.lastQuip = G.t;
      const q = S.quips[run.floor - 1] || [];
      if (q.length) later(1.2, () => bark(pick(q), pick(['happy', 'calm', 'excited', 'smug']), 4));
    }
  }

  function spawnSpots(room, p) {
    const seen = new Set();
    const q = [[Math.floor(COLS / 2), Math.floor(ROWS / 2)]];
    const spots = [];
    while (q.length) {
      const [c, r] = q.pop();
      const k = c + ',' + r;
      if (seen.has(k)) continue;
      seen.add(k);
      if (c <= 0 || r <= 0 || c >= COLS - 1 || r >= ROWS - 1) continue;
      if (room.tiles[r][c] !== FLOOR) continue;
      const x = (c + 0.5) * T, y = (r + 0.5) * T;
      if (Math.hypot(x - p.x, y - p.y) > 280 && c > 1 && r > 1 && c < COLS - 2 && r < ROWS - 2) spots.push({ x, y });
      q.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }
    return spots;
  }

  function roomCleared() {
    const room = G.room, run = G.run, p = run.player;
    room.cleared = true;
    G.locked = false;
    sfx.door();
    if (p.meanRev && p.hp < p.maxHp / 2) { p.hp = Math.min(p.maxHp, p.hp + 1); floatText(p.x, p.y - 30, 'Regression to the mean! +1 ♥', '#ff8fa8', 2); sfx.heart(); }
    if (room.type === 'combat') {
      const chestChance = settings.extra ? 0.75 : 0.5;
      if (Math.random() < chestChance) {
        const free = Math.random() < (settings.extra ? 0.3 : 0.5);
        if (free) {
          room.objects.push({ kind: 'chest', crate: true, unlocked: true, x: RW / 2, y: RH / 2, r: 22, pop: 0.4 });
          floatText(RW / 2, RH / 2 - 44, 'A supply crate! (no lock!)', '#ffd966', 2);
        } else {
          room.objects.push({ kind: 'chest', x: RW / 2, y: RH / 2, r: 22, pop: 0.4, mimic: Math.random() < 0.1, lapSolve: !settings.extra && Math.random() < 0.3 });
          floatText(RW / 2, RH / 2 - 44, 'A Stat Chest appeared!', '#ffd966', 2);
          if (!run.flags.chestTip) { run.flags.chestTip = true; bark(S.tips.chest); }
        }
      } else {
        for (let i = 0; i < irand(1, 3); i++) dropPickup(RW / 2 + rand(-30, 30), RH / 2 + rand(-30, 30), 'coin');
        if (Math.random() < 0.22 + p.luck * 0.1) dropPickup(RW / 2, RH / 2, 'heart');
      }
    }
  }

  // ================= tiles & collision =================
  function isDoorTile(c, r) { return ((r === 0 || r === ROWS - 1) && DC.includes(c)) || ((c === 0 || c === COLS - 1) && DR.includes(r)); }
  function tileAt(c, r) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return WALL;
    if (G.locked && isDoorTile(c, r)) return WALL;
    return G.room.tiles[r][c];
  }
  function solid(t, mode) {
    if (mode === 'shot') return t === WALL || t === ROCK;
    if (mode === 'fly') return t === WALL;
    return t === WALL || t === ROCK || t === PIT;
  }
  function boxHits(x, y, h, mode) {
    const c0 = Math.floor((x - h) / T), c1 = Math.floor((x + h) / T);
    const r0 = Math.floor((y - h) / T), r1 = Math.floor((y + h) / T);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solid(tileAt(c, r), mode)) return true;
    return false;
  }
  function moveEnt(e, dx, dy, mode) {
    const h = e.r * 0.75;
    let hx = false, hy = false;
    if (dx) { if (!boxHits(e.x + dx, e.y, h, mode)) e.x += dx; else hx = true; }
    if (dy) { if (!boxHits(e.x, e.y + dy, h, mode)) e.y += dy; else hy = true; }
    return hx || hy;
  }
  const pointSolid = (x, y, mode) => solid(tileAt(Math.floor(x / T), Math.floor(y / T)), mode);

  // ================= timers, warnings, hazards =================
  const later = (t, fn) => G.timers.push({ t, fn });
  function hazardRect(x, y, w, h, warn, active, color) { G.hazards.push({ kind: 'rect', x, y, w, h, warn, active, color: color || '#ff5f6d', t: 0 }); }
  function hazardLine(x1, y1, x2, y2, w, warn, active, color) { G.hazards.push({ kind: 'line', x1, y1, x2, y2, w, warn, active, color: color || '#ffd23f', t: 0 }); }
  function hazardHits(h, p) {
    if (h.kind === 'rect') return p.x > h.x && p.x < h.x + h.w && p.y > h.y && p.y < h.y + h.h;
    const dx = h.x2 - h.x1, dy = h.y2 - h.y1, L = dx * dx + dy * dy || 1;
    const u = clamp(((p.x - h.x1) * dx + (p.y - h.y1) * dy) / L, 0, 1);
    return Math.hypot(p.x - (h.x1 + dx * u), p.y - (h.y1 + dy * u)) < h.w / 2 + p.r * 0.5;
  }

  // ================= enemies =================
  function makeEnemy(kind, x, y) {
    const f = G.run.floor, hm = [1, 2.2, 3.7, 5.6, 7.7][Math.min(f, 5) - 1], sm = 1 + 0.08 * (Math.min(f, 5) - 1);
    const base = { kind, x, y, t: Math.random() * 3, flash: 0, slow: 0, spawn: 0.7, kx: 0, ky: 0, tint: ENEMY_TINTS[Math.min(f, 5) - 1] };
    const defs = {
      slime: { r: 15, hp: 3, speed: 78 },
      bigslime: { r: 22, hp: 7, speed: 60 },
      bat: { r: 12, hp: 2, speed: 138 },
      archer: { r: 15, hp: 4, speed: 85, cd: rand(1.4, 2.6) },
      boar: { r: 18, hp: 6, speed: 62, state: 'walk', st: rand(1, 2.5) },
      eye: { r: 18, hp: 7, speed: 0, cd: rand(1.5, 2.8), rot: rand(0, TAU) },
      ghost: { r: 15, hp: 3, speed: 64, alpha: 1 },
      knight: { r: 17, hp: 7, speed: 66, facing: 0, cd: rand(2, 3.5) },
      dice: { r: 17, hp: 6, speed: 150, state: 'roll', st: rand(0.8, 1.4), face: 1, spin: 0, dir: rand(0, TAU) },
      spider: { r: 16, hp: 5, speed: 170, cd: rand(1.5, 2.8), hop: 0 },
      bomber: { r: 15, hp: 5, speed: 95, ringT: 0 },
      wraith: { r: 16, hp: 7, speed: 70, cd: rand(1.5, 2.5), dashT: 0, alpha: 1 },
    };
    const e = Object.assign(base, defs[kind]);
    e.hp *= hm; e.maxHp = e.hp; e.speed *= sm;
    const extraTints = { knight: '#5ab0ff', dice: '#f4f4f4', spider: '#7a4ab0', bomber: '#d99a3a', wraith: '#ff6b8a' };
    e.color = kind === 'archer' ? '#ece5d0' : extraTints[kind] || e.tint[kind === 'bigslime' ? 'slime' : kind] || '#fff';
    return e;
  }

  function fireEnemy(x, y, ux, uy, speed, opts) {
    const sm = 1 + 0.05 * (Math.min(G.run.floor, 6) - 1);
    G.ebullets.push(Object.assign({ x, y, vx: ux * speed * sm, vy: uy * speed * sm, r: 6, life: 7, color: '#ff6b6b', src: fireEnemy.src }, opts || {}));
  }
  function ring(x, y, n, speed, offset, opts, skip) {
    for (let i = 0; i < n; i++) {
      if (skip && skip(i, n)) continue;
      const a = (offset || 0) + (i * TAU) / n;
      fireEnemy(x, y, Math.cos(a), Math.sin(a), speed, opts);
    }
  }

  function updateEnemy(e, dt) {
    const p = G.run.player;
    fireEnemy.src = e.kind;
    if (e.spawn > 0) { e.spawn -= dt; return; }
    if (e.escorted) return;
    if (e.root > 0) { e.root -= dt; if (e.kind !== 'boss') { e.t += dt * 0.2; return; } }
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    const sp = e.speed * (e.slow > 0 ? 0.5 : 1);
    if (e.slow > 0) e.slow -= dt;
    if (e.kx || e.ky) {
      moveEnt(e, e.kx * dt, e.ky * dt, e.kind === 'ghost' || e.kind === 'bat' ? 'fly' : 'walk');
      e.kx *= 0.82; e.ky *= 0.82;
      if (Math.abs(e.kx) + Math.abs(e.ky) < 5) e.kx = e.ky = 0;
    }
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const f = Math.min(G.run.floor, 5);
    switch (e.kind) {
      case 'slime': case 'bigslime': {
        const hop = Math.max(0, Math.sin(e.t * 5));
        e.squash = hop;
        moveEnt(e, ux * sp * hop * 1.9 * dt, uy * sp * hop * 1.9 * dt, 'walk');
        if (e.kind === 'bigslime') { e.cd = (e.cd || 3) - dt; if (e.cd <= 0) { ring(e.x, e.y, 8, 150, e.t, { color: e.color, r: 7 }); e.cd = 3.6; } }
        break;
      }
      case 'bat': {
        const w = Math.sin(e.t * 6) * 0.9;
        moveEnt(e, (ux - uy * w) * sp * dt, (uy + ux * w) * sp * dt, 'fly');
        break;
      }
      case 'ghost': {
        e.alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(e.t * 1.6));
        moveEnt(e, ux * sp * dt, uy * sp * dt, 'fly');
        break;
      }
      case 'archer': {
        const m = d < 220 ? -1 : d > 330 ? 1 : 0;
        const s = Math.sin(e.t * 0.9) * 0.6;
        moveEnt(e, (ux * m - uy * s) * sp * dt, (uy * m + ux * s) * sp * dt, 'walk');
        e.cd -= dt;
        e.aim = e.cd < 0.6;
        if (e.cd <= 0) {
          fireEnemy(e.x, e.y, ux, uy, 235, { color: '#fff1b8', arrow: true });
          if (f >= 4) {
            const a = Math.atan2(uy, ux);
            fireEnemy(e.x, e.y, Math.cos(a + 0.25), Math.sin(a + 0.25), 240, { color: '#fff1b8', arrow: true });
            fireEnemy(e.x, e.y, Math.cos(a - 0.25), Math.sin(a - 0.25), 240, { color: '#fff1b8', arrow: true });
          }
          e.cd = rand(2.0, 2.8) - 0.1 * f;
        }
        break;
      }
      case 'boar': {
        if (e.state === 'walk') {
          const w = Math.sin(e.t * 1.3);
          moveEnt(e, (ux * 0.6 - uy * w * 0.4) * sp * dt, (uy * 0.6 + ux * w * 0.4) * sp * dt, 'walk');
          e.st -= dt;
          if (e.st <= 0 && d < 440) { e.state = 'wind'; e.st = 0.65; e.cx = ux; e.cy = uy; }
        } else if (e.state === 'wind') {
          e.st -= dt;
          if (e.st <= 0) { e.state = 'charge'; e.st = 0.6; }
        } else if (e.state === 'charge') {
          const hit = moveEnt(e, e.cx * 450 * dt * (e.slow > 0 ? 0.6 : 1), e.cy * 450 * dt * (e.slow > 0 ? 0.6 : 1), 'walk');
          e.st -= dt;
          if (Math.random() < 0.5) puff(e.x, e.y + e.r * 0.6, '#8a6a4a');
          if (hit) { e.state = 'stun'; e.st = 0.9; G.shake = Math.max(G.shake, 4); sfx.hit(); }
          else if (e.st <= 0) { e.state = 'walk'; e.st = rand(1.2, 2.2); }
        } else if (e.state === 'stun') { e.st -= dt; if (e.st <= 0) { e.state = 'walk'; e.st = rand(1.2, 2.2); } }
        break;
      }
      case 'eye': {
        e.cd -= dt; e.rot += dt * 0.7;
        if (e.cd <= 0) { ring(e.x, e.y, f >= 3 ? 6 : 4, 165, e.rot, { color: e.color }); e.cd = 2.8 - 0.1 * f; }
        break;
      }
      case 'knight': {
        // turns its box-plot shield toward you, then lunges
        const want = Math.atan2(uy, ux);
        const diff = ((want - e.facing + Math.PI * 3) % TAU) - Math.PI;
        e.facing += clamp(diff, -1.8 * dt, 1.8 * dt);
        e.cd -= dt;
        if (e.lunge > 0) { e.lunge -= dt; moveEnt(e, Math.cos(e.facing) * 330 * dt, Math.sin(e.facing) * 330 * dt, 'walk'); }
        else moveEnt(e, Math.cos(e.facing) * sp * dt, Math.sin(e.facing) * sp * dt, 'walk');
        if (e.cd <= 0 && d < 300) { e.lunge = 0.35; e.cd = rand(2.4, 3.4); }
        break;
      }
      case 'dice': {
        if (e.state === 'roll') {
          e.st -= dt; e.spin += dt * 14;
          if (moveEnt(e, Math.cos(e.dir) * sp * dt, Math.sin(e.dir) * sp * dt, 'walk')) e.dir += Math.PI * 0.7;
          if (e.st <= 0) { e.state = 'land'; e.st = 0.55; e.face = irand(1, 6); e.spin = 0; }
        } else {
          e.st -= dt;
          if (e.st <= 0) {
            const a = Math.atan2(uy, ux), n = e.face;
            for (let i = 0; i < n; i++) { const aa = a + (i - (n - 1) / 2) * 0.22; fireEnemy(e.x, e.y, Math.cos(aa), Math.sin(aa), 200, { color: '#f4f4f4', r: 6, pip: true }); }
            e.state = 'roll'; e.st = rand(0.9, 1.5); e.dir = Math.atan2(uy, ux) + rand(-1.2, 1.2);
          }
        }
        break;
      }
      case 'spider': {
        e.hop -= dt;
        if (e.hop <= 0) { e.hop = rand(0.5, 1.1); e.hx = ux + rand(-0.9, 0.9); e.hy = uy + rand(-0.9, 0.9); e.hopT = 0.25; }
        if (e.hopT > 0) { e.hopT -= dt; moveEnt(e, e.hx * sp * dt, e.hy * sp * dt, 'walk'); }
        e.cd -= dt;
        if (e.cd <= 0 && d < 420) { fireEnemy(e.x, e.y, ux, uy, 210, { color: '#e8e4ff', r: 9, web: true }); e.cd = rand(2.2, 3.2); }
        break;
      }
      case 'bomber': {
        if (e.ringT > 0) {
          e.ringT -= dt;
          if (e.ringT <= 0) {
            ring(e.x, e.y, 10, 190, rand(0, 1), { color: '#ffd23f', r: 7, note: true });
            if (d < 70) hurtPlayer('bomber');
            G.shake = Math.max(G.shake, 6); sfx.bell(); burst(e.x, e.y, '#ffd23f', 30, 260);
            e.noDrop = true; killEnemy(e);
          }
        } else {
          moveEnt(e, ux * sp * dt, uy * sp * dt, 'fly');
          if (d < 95) { e.ringT = 0.85; floatText(e.x, e.y - 30, 'DING DING DING!', '#ffd23f', 1); }
        }
        break;
      }
      case 'wraith': {
        e.alpha = 0.55 + 0.45 * Math.sin(e.t * 2);
        e.cd -= dt;
        if (e.dashT > 0) {
          e.dashT -= dt;
          // a skewed, curving dash
          const k = 1 - e.dashT / 0.7;
          const vx = e.dvx * (1 - k) + -e.dvy * e.curve * k, vy = e.dvy * (1 - k) + e.dvx * e.curve * k;
          moveEnt(e, vx * 380 * dt, vy * 380 * dt, 'fly');
          if (Math.random() < 0.6) G.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#ff6b8a', size: 14, ghost: true });
          if (e.dashT <= 0) { const a = Math.atan2(uy, ux); for (let i = -1; i <= 1; i++) fireEnemy(e.x, e.y, Math.cos(a + i * 0.25), Math.sin(a + i * 0.25), 240, { color: '#ff6b8a', r: 7 }); }
        } else {
          moveEnt(e, (ux * 0.5 + Math.sin(e.t) * 0.5) * sp * dt, (uy * 0.5 + Math.cos(e.t * 1.3) * 0.5) * sp * dt, 'fly');
          if (e.cd <= 0) { e.dashT = 0.7; e.dvx = ux; e.dvy = uy; e.curve = pick([-1, 1]) * 0.9; e.cd = rand(2, 3); }
        }
        break;
      }
      case 'boss': updateBoss(e, dt, ux, uy, d); break;
    }
    if (e.kind !== 'boss' && e.kind !== 'eye') {
      e.x = clamp(e.x, T + e.r * 0.5, RW - T - e.r * 0.5);
      e.y = clamp(e.y, T + e.r * 0.5, RH - T - e.r * 0.5);
    }
  }

  // ================= bosses =================
  const BOSSES = [
    { name: 'Rankenstein', title: 'Built from every dot of every dotplot', color: '#86b273', r: 44, hp: 270 },
    { name: 'The Uniform Monolith', title: 'Perfectly flat. Perfectly fair. Perfectly rectangular.', color: '#d9b06a', r: 42, hp: 580 },
    { name: 'Zed, the Standardizer', title: 'Measures everything in standard deviations', color: '#4fc27a', r: 40, hp: 920 },
    { name: 'The Great Bellringer', title: 'Its toll is shaped like a bell curve', color: '#d99a3a', r: 48, hp: 1300 },
    { name: 'The Empirical Emperor', title: 'Ruler of 68, 95 and 99.7', color: '#c66bd1', r: 44, hp: 1800 },
    { name: 'SUPER MANE LAPORTE', title: 'Powered by Secret Hair Tonic', color: '#ffd23f', r: 34, hp: 2600 },
  ];
  function makeBoss(floor) {
    const v = Math.min(floor, 6) - 1;
    const d = BOSSES[v];
    G.banner = { text: d.name, sub: d.title, t: 3, boss: true };
    return {
      kind: 'boss', variant: v, name: d.name, color: d.color, r: d.r, x: RW / 2, y: RH / 2 - 90,
      hp: d.hp, maxHp: d.hp, t: 0, cd: 2.2, cd2: 4.5, cd3: 6, flash: 0, slow: 0, spawn: 1.2, kx: 0, ky: 0,
      thresholds: v === 5 ? [] : [0.5], shieldIdx: 0, shielded: false, stun: 0, state: 'walk', st: 0,
      alpha: 1, sx: 1, sy: 1, z: 0,
    };
  }
  function bossSay(b, text, col) { floatText(b.x, b.y - b.r - 30, text, col || '#ffffff', 2); }

  function updateBoss(b, dt, ux, uy, d) {
    const p = G.run.player;
    const enraged = b.shieldIdx >= 1 || b.hp < b.maxHp * 0.5;
    const minions = G.enemies.filter((e) => e.kind !== 'boss').length;
    if (b.stun > 0) { b.stun -= dt; return; }
    const shieldSlow = b.shielded ? 0.6 : 1;
    const pace = shieldSlow * (1 + 0.1 * Math.min(4, b.variant)); // later bosses attack more often (Floor 1 unchanged)
    b.cd -= dt * pace; b.cd2 -= dt * pace; b.cd3 -= dt * pace;
    switch (b.variant) {
      case 0: { // Rankenstein: lumbers at you, rains columns of dotplot dots
        b.frame = Math.floor(b.t * 3) % 2;
        if (b.state === 'walk') moveEnt(b, ux * (enraged ? 85 : 65) * dt, uy * (enraged ? 85 : 65) * dt, 'walk');
        if (b.cd <= 0) {
          bossSay(b, pick(['DOTPLOT DROP!', 'STACK THEM UP!', 'COUNT THE DOTS!']), '#b5dc9c');
          const cols = enraged ? 9 : 7;
          const gap = irand(1, cols - 2);
          for (let i = 0; i < cols; i++) {
            if (i === gap || (enraged && i === gap + 1 && false)) continue;
            const x = T * 1.5 + (i + 0.5) * ((RW - 3 * T) / cols);
            const n = irand(2, enraged ? 6 : 4);
            hazardRect(x - 18, T, 36, RH - 2 * T, 0.75, 0, '#7fd1ff');
            for (let k = 0; k < n; k++) later(0.75 + k * 0.16, () => fireEnemy(x, T + 10, 0, 1, 270, { color: ['#5ab0ff', '#ffd23f', '#ff6b6b', '#5fd38a', '#c9a7ff'][i % 5], r: 9, dot: true }));
          }
          b.cd = enraged ? 3.3 : 4.2;
        }
        if (b.cd2 <= 0) {
          // stomp: a ring of dots and a burst aimed at you
          G.shake = 8; sfx.boom();
          ring(b.x, b.y + 20, enraged ? 16 : 12, 170, b.t, { color: '#b5dc9c', r: 8, dot: true });
          const a = Math.atan2(uy, ux);
          for (let i = -1; i <= 1; i++) fireEnemy(b.x, b.y, Math.cos(a + i * 0.2), Math.sin(a + i * 0.2), 250, { color: '#ffd23f', r: 8, dot: true });
          b.cd2 = enraged ? 2.6 : 3.4;
        }
        if (b.cd3 <= 0) {
          if (minions < 3) for (let i = 0; i < 2; i++) G.enemies.push(Object.assign(makeEnemy('slime', b.x + rand(-50, 50), b.y + rand(-50, 50)), { spawn: 0.4 }));
          bossSay(b, pick(['You are in the 0th percentile!', 'I rank ABOVE you!', '99th percentile of SCARY!']), '#ffffff');
          b.cd3 = 8;
        }
        break;
      }
      case 1: { // Uniform Monolith: walls of bullets with evenly spaced gaps; slams
        b.frame = Math.floor(b.t * 2) % 2;
        if (b.state === 'walk') {
          b.hover = (b.hover || 0) + dt;
          moveEnt(b, Math.sin(b.hover * 0.6) * 60 * dt + ux * 18 * dt, Math.cos(b.hover * 0.8) * 40 * dt + uy * 12 * dt, 'fly');
          b.sx = lerp(b.sx, 1, dt * 6); b.sy = lerp(b.sy, 1, dt * 6);
          if (b.cd <= 0) {
            bossSay(b, 'UNIFORM WALL!', '#7ff5ff');
            uniformWall(pick(['w', 'e', 'n', 's']), enraged);
            if (enraged) later(1.3, () => uniformWall(pick(['w', 'e', 'n', 's']), false));
            b.cd = enraged ? 3.6 : 4.4;
          } else if (b.cd2 <= 0) { b.state = 'flatten'; b.st = 0.9; bossSay(b, 'FLATTEN!', '#f4d89a'); }
          else if (b.cd3 <= 0) {
            // teleport to a uniformly random spot
            b.state = 'fade'; b.st = 0.5;
          }
        } else if (b.state === 'flatten') {
          b.st -= dt;
          b.sx = lerp(b.sx, 1.8, dt * 5); b.sy = lerp(b.sy, 0.45, dt * 5);
          if (b.st <= 0) {
            G.shake = 12; sfx.boom();
            for (let k = 0; k < 2; k++) later(k * 0.35, () => ring(b.x, b.y, 20, 180 + k * 40, k * 0.16, { color: '#f4d89a', r: 7, square: true }));
            b.state = 'walk'; b.cd2 = enraged ? 4 : 5.5;
          }
        } else if (b.state === 'fade') {
          b.st -= dt; b.alpha = Math.max(0, b.st / 0.5);
          if (b.st <= 0) {
            b.x = rand(T * 4, RW - T * 4); b.y = rand(T * 3, RH - T * 3);
            if (Math.hypot(b.x - p.x, b.y - p.y) < 200) { b.x = RW - b.x; b.y = RH - b.y; }
            b.state = 'appear'; b.st = 0.5;
            floatText(b.x, b.y - 70, 'X ~ U(a, b)', '#7ff5ff', 1.6);
          }
        } else if (b.state === 'appear') {
          b.st -= dt; b.alpha = 1 - Math.max(0, b.st / 0.5);
          if (b.st <= 0) { b.alpha = 1; b.state = 'walk'; b.cd3 = rand(5, 7); ring(b.x, b.y, 12, 160, 0, { color: '#7ff5ff', r: 7, square: true }); }
        }
        break;
      }
      case 2: { // Zed: teleports between the ±1σ and ±2σ rings, standardizing everything
        b.frame = Math.floor(b.t * 2.5) % 2;
        if (b.state === 'walk') {
          b.orbit = (b.orbit == null ? 0 : b.orbit) + dt * (enraged ? 0.55 : 0.4) * (b.dir || 1);
          const R = (b.ringZ || 1) * 110;
          const tx = RW / 2 + Math.cos(b.orbit) * R * 1.6, ty = RH / 2 + Math.sin(b.orbit) * R * 0.9;
          b.x = lerp(b.x, clamp(tx, T * 2, RW - T * 2), dt * 2); b.y = lerp(b.y, clamp(ty, T * 2, RH - T * 2), dt * 2);
          if (b.cd <= 0) {
            const a = Math.atan2(uy, ux), n = enraged ? 7 : 5;
            for (let i = 0; i < n; i++) { const aa = a + (i - (n - 1) / 2) * 0.17; fireEnemy(b.x, b.y, Math.cos(aa), Math.sin(aa), 250, { color: '#9fd3ff', r: 7, z: true }); }
            b.cd = enraged ? 1.4 : 1.9;
          }
          if (b.cd2 <= 0) { b.state = 'blink'; b.st = 0.45; }
          if (b.cd3 <= 0) {
            if (minions < 4) {
              for (let i = 0; i < 2; i++) {
                const m = makeEnemy(pick(['slime', 'bat']), b.x + rand(-60, 60), b.y + rand(-60, 60));
                m.spawn = 0.4; m.zLabel = (Math.random() < 0.5 ? '−' : '+') + (Math.random() * 2.4 + 0.2).toFixed(2);
                G.enemies.push(m);
              }
              bossSay(b, 'Rise, my standardized minions!', '#9ef0b8');
            }
            b.cd3 = 9;
          }
        } else if (b.state === 'blink') {
          b.st -= dt; b.alpha = Math.max(0, b.st / 0.45);
          if (b.st <= 0) {
            b.ringZ = pick([1, 2, 2]); b.dir = pick([-1, 1]); b.orbit = rand(0, TAU);
            b.x = clamp(RW / 2 + Math.cos(b.orbit) * b.ringZ * 176, T * 2, RW - T * 2);
            b.y = clamp(RH / 2 + Math.sin(b.orbit) * b.ringZ * 99, T * 2, RH - T * 2);
            b.zText = (Math.random() < 0.5 ? '−' : '+') + b.ringZ + '.00';
            floatText(b.x, b.y - 70, 'z = ' + b.zText, '#9ef0b8', 1.8);
            b.state = 'walk'; b.alpha = 1;
            ring(b.x, b.y, enraged ? 14 : 10, 175, rand(0, 1), { color: '#4fc27a', r: 7, z: true });
            if (enraged) later(0.4, () => ring(b.x, b.y, 14, 140, 0.2, { color: '#9ef0b8', r: 7, z: true }));
            b.cd2 = enraged ? 3.2 : 4.4;
          }
        }
        break;
      }
      case 3: { // Great Bellringer: swings, tolls shockwave rings and fires bell-curve-shaped volleys
        b.frame = Math.floor(b.t * 2) % 2;
        b.swing = Math.sin(b.t * 2.2) * 0.22;
        const hx = RW / 2 + Math.sin(b.t * 0.5) * 260, hy = T * 3.2 + Math.sin(b.t * 0.9) * 20;
        b.x = lerp(b.x, hx, dt * 1.5); b.y = lerp(b.y, hy, dt * 1.5);
        if (b.cd <= 0) {
          // volley with angles drawn from a normal distribution: dense in the middle, thin in the tails
          bossSay(b, 'BELL CURVE BARRAGE!', '#ffe08a');
          const a = Math.atan2(uy, ux), n = enraged ? 22 : 15;
          for (let i = 0; i < n; i++) later(i * 0.03, () => { const aa = a + gauss() * 0.32; fireEnemy(b.x, b.y + 30, Math.cos(aa), Math.sin(aa), rand(190, 260), { color: '#ffd23f', r: 7, note: true }); });
          b.cd = enraged ? 2.4 : 3.2;
        }
        if (b.cd2 <= 0) {
          // TOLL: shockwave ring with a gap
          sfx.bell(); G.shake = 10;
          bossSay(b, 'DONNNNG!', '#ffb84d');
          const gapAt = irand(0, 23);
          ring(b.x, b.y + 30, 24, 170, 0, { color: '#ffb84d', r: 8, wave: true }, (i) => Math.abs(i - gapAt) <= 1);
          if (enraged) later(0.6, () => ring(b.x, b.y + 30, 24, 150, 0.13, { color: '#ffb84d', r: 8, wave: true }, (i) => Math.abs(i - (gapAt + 12) % 24) <= 1));
          b.cd2 = enraged ? 3.4 : 4.6;
        }
        if (b.cd3 <= 0) {
          // SHADED REGION: highlight a band of the floor (an area under the curve!) — it gets zapped
          bossSay(b, 'FIND THE SHADED AREA!', '#ff9f43');
          const w = enraged ? 300 : 230;
          const x0 = clamp(p.x - w / 2 + rand(-60, 60), T, RW - T - w);
          hazardRect(x0, T, w, RH - 2 * T, 1.2, 0.5, '#ff9f43');
          b.cd3 = enraged ? 5 : 6.5;
        }
        if (minions < 2 && Math.random() < dt * 0.08) G.enemies.push(Object.assign(makeEnemy('bat', b.x, b.y + 40), { spawn: 0.3 }));
        break;
      }
      case 4: { // Empirical Emperor: rings that cover 68%, 95% and 99.7% of the circle
        b.frame = Math.floor(b.t * 2) % 2;
        if (b.state === 'walk') {
          const s = Math.sin(b.t * 0.7);
          const m = d < 260 ? -0.6 : d > 380 ? 0.6 : 0;
          moveEnt(b, (ux * m - uy * s) * 95 * dt, (uy * m + ux * s) * 95 * dt, 'walk');
          if (b.cd <= 0) {
            b.state = 'rings'; b.st = 0;
            const pcts = [68, 95, 99.7];
            pcts.forEach((pc, k) => later(k * (enraged ? 0.9 : 1.15), () => {
              const n = 48, gap = Math.max(1, Math.round(n * (1 - pc / 100) * (pc === 99.7 ? 3 : 1)));
              const start = irand(0, n - 1);
              floatText(b.x, b.y - b.r - 30 - k * 4, pc + '%!', ['#ffd23f', '#ff9f43', '#ff5f6d'][k], 1.4);
              ring(b.x, b.y, n, 150, 0, { color: ['#ffd23f', '#ff9f43', '#ff5f6d'][k], r: 7 }, (i) => ((i - start + n) % n) < gap);
              sfx.shield();
            }));
            later(enraged ? 2.4 : 2.9, () => { b.state = 'walk'; });
            b.cd = enraged ? 4.6 : 5.6;
          }
          if (b.cd2 <= 0) {
            const a = Math.atan2(uy, ux);
            for (let k = 0; k < 3; k++) later(k * 0.18, () => { for (let i = -2; i <= 2; i++) fireEnemy(b.x, b.y, Math.cos(a + i * 0.12), Math.sin(a + i * 0.12), 270, { color: '#d29cff', r: 7 }); });
            b.cd2 = enraged ? 2.2 : 3;
          }
          if (b.cd3 <= 0) {
            // summon a standard-deviation spiral
            bossSay(b, 'Within one standard deviation, I am ALL-POWERFUL!', '#e8d8ff');
            for (let k = 0; k < 24; k++) later(k * 0.07, () => { const a = b.t * 4 + k * 0.45; fireEnemy(b.x, b.y, Math.cos(a), Math.sin(a), 160, { color: '#c66bd1', r: 7 }); });
            b.cd3 = enraged ? 6 : 8;
          }
        }
        break;
      }
      case 5: { // SUPER MANE LAPORTE
        b.frame = Math.floor(b.t * 8) % 3;
        b.quip = (b.quip == null ? 2 : b.quip) - dt;
        if (b.quip <= 0) { bossSay(b, pick(S.maneQuips), '#ffe27a'); b.quip = rand(4, 6); }
        const phase = b.hp > b.maxHp * 0.66 ? 0 : b.hp > b.maxHp * 0.33 ? 2 : 3; // 0, 2, 3
        if (phase !== (b.lastPhase == null ? 0 : b.lastPhase)) {
          b.lastPhase = phase;
          G.flash = 0.7; G.shake = 18; G.zoom = 0.12; sfx.power();
          G.ebullets = [];
          G.banner = { text: phase === 2 ? 'PHASE 2: POP QUIZ!' : 'FINAL PHASE: THE MANE EVENT!', sub: phase === 2 ? 'His hair is getting... BIGGER?!' : 'Maximum follicle power!!', t: 2.4, boss: true };
          for (let i = 0; i < 6; i++) G.vfxRings.push({ x: b.x, y: b.y, t: -i * 0.08, max: 0.9 });
        }
        if (Math.random() < dt * (2 + phase)) G.bolts.push({ x: b.x, y: b.y - 40, a: rand(0, TAU), len: rand(120, 260), life: 0.18 });
        maneSparkles(b.x, b.y, 1.7, dt);
        if (Math.random() < dt * 30) G.particles.push({ x: rand(T, RW - T), y: T, vx: rand(-30, 30), vy: rand(40, 120), life: 2.5, max: 2.5, color: pick(['#ffd23f', '#fff4a8', '#d38b12']), size: rand(3, 6), fall: true });
        if (b.state === 'walk') {
          const s = Math.sin(b.t * 0.9);
          const m = d < 240 ? -0.7 : d > 360 ? 0.7 : 0;
          moveEnt(b, (ux * m - uy * s) * 140 * dt, (uy * m + ux * s) * 140 * dt, 'walk');
          if (b.cd <= 0) {
            if (phase >= 2 && Math.random() < 0.6) { maneLasers(b, phase >= 3); b.cd = phase >= 3 ? 3.2 : 3.8; }
            else if (phase >= 1 && Math.random() < 0.55) { popQuizSpiral(b, phase); b.cd = 3.4; }
            else { b.state = 'wind'; b.st = 0.7; b.cx = ux; b.cy = uy; bossSay(b, 'TONIC DASH!', '#ffd23f'); b.cd = 2.8; }
          }
          if (b.cd2 <= 0) {
            ring(b.x, b.y, 18 + phase * 4, 170, b.t, { color: '#ffd23f', r: 7, hair: true });
            b.cd2 = 3 - phase * 0.3;
          }
          if (b.cd3 <= 0 && phase >= 1) {
            const a = Math.atan2(uy, ux);
            for (let i = -2; i <= 2; i++) fireEnemy(b.x, b.y, Math.cos(a + i * 0.14), Math.sin(a + i * 0.14), 260, { color: '#ffffff', r: 8, paper: true });
            b.cd3 = 2.2;
          }
        } else if (b.state === 'wind') {
          b.st -= dt;
          if (b.st <= 0) { b.state = 'dash'; b.st = 0.75; }
        } else if (b.state === 'dash') {
          b.st -= dt;
          const hit = moveEnt(b, b.cx * 560 * dt, b.cy * 560 * dt, 'walk');
          G.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.35, max: 0.35, color: '#ffd23f', size: 26, ghost: true });
          if (hit || b.st <= 0) {
            b.state = 'walk'; G.shake = 10; sfx.boom();
            ring(b.x, b.y, 14 + phase * 2, 200, 0, { color: '#ffd23f', r: 7, hair: true });
          }
        }
        break;
      }
    }
    b.x = clamp(b.x, T + b.r * 0.6, RW - T - b.r * 0.6);
    b.y = clamp(b.y, T + b.r * 0.6, RH - T - b.r * 0.6);
  }

  function uniformWall(side, enraged) {
    // a whole wall of bullets with evenly spaced gaps — every gap is equally likely
    const n = side === 'w' || side === 'e' ? 12 : 21;
    const span = side === 'w' || side === 'e' ? RH - 2 * T : RW - 2 * T;
    const gapStart = irand(1, n - 4), gapLen = enraged ? 2 : 3;
    for (let i = 0; i < n; i++) {
      if (i >= gapStart && i < gapStart + gapLen) continue;
      const o = T + (i + 0.5) * (span / n);
      const opts = { color: '#7ff5ff', r: 8, square: true, life: 9 };
      if (side === 'w') fireEnemy(T + 8, o, 1, 0, 150, opts);
      if (side === 'e') fireEnemy(RW - T - 8, o, -1, 0, 150, opts);
      if (side === 'n') fireEnemy(o, T + 8, 0, 1, 130, opts);
      if (side === 's') fireEnemy(o, RH - T - 8, 0, -1, 130, opts);
    }
  }
  function maneLasers(b, big) {
    bossSay(b, 'THE MANE EVENT!!', '#ff7ae0');
    const n = big ? 5 : 4, a0 = rand(0, TAU);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * TAU) / n;
      hazardLine(b.x, b.y, b.x + Math.cos(a) * 1400, b.y + Math.sin(a) * 1400, 26, 0.9, 0.55, '#ffd23f');
    }
    if (big) later(1.6, () => {
      for (let i = 0; i < n; i++) { const a = a0 + ((i + 0.5) * TAU) / n; hazardLine(b.x, b.y, b.x + Math.cos(a) * 1400, b.y + Math.sin(a) * 1400, 26, 0.9, 0.55, '#ff7ae0'); }
    });
  }
  function popQuizSpiral(b, phase) {
    bossSay(b, 'POP QUIZ!!', '#ffffff');
    for (let k = 0; k < 30 + phase * 6; k++) later(k * 0.06, () => {
      const a = k * 0.5;
      fireEnemy(b.x, b.y, Math.cos(a), Math.sin(a), 170, { color: '#ffffff', r: 8, paper: true });
      fireEnemy(b.x, b.y, Math.cos(a + Math.PI), Math.sin(a + Math.PI), 170, { color: '#ffffff', r: 8, paper: true });
    });
  }

  function damageEnemy(e, dmg, ux, uy) {
    if (e.spawn > 0 || e.dead || e.escorted) return;
    if (e.kind === 'boss' && (e.shielded || e.alpha < 0.3)) {
      e.flash = 0.05;
      spark(e.x - ux * e.r, e.y - uy * e.r, '#9ad8ff');
      return;
    }
    const pl = G.run.player;
    // Box Plot Knights block shots that hit their shield (the side facing you)
    if (e.kind === 'knight' && (ux || uy)) {
      const hitAng = Math.atan2(-uy, -ux);
      const diff = Math.abs(((hitAng - e.facing + Math.PI * 3) % TAU) - Math.PI);
      if (diff < 0.9) { spark(e.x + Math.cos(e.facing) * 16, e.y + Math.sin(e.facing) * 16, '#d8f0ff'); if (Math.random() < 0.15) floatText(e.x, e.y - 30, 'BLOCKED! Hit it from the side!', '#9ad8ff', 1.2); return; }
    }
    if (pl.crit && Math.random() < pl.crit) { dmg *= 2.5; G.stamps.push({ x: e.x + rand(-10, 10), y: e.y - 20, life: 0.8, rot: rand(-0.4, 0.4) }); }
    e.hp -= dmg;
    e.flash = 0.1;
    sfx.hit();
    if (e.kind !== 'boss') { e.kx = ux * 260; e.ky = uy * 260; }
    if (pl.frost) e.slow = 1.6;
    if (pl.vines && (ux || uy) && e.kind !== 'boss') e.root = 1.1;
    if (pl.pinata && e.kind !== 'boss' && e.hp > 0 && e.hp < e.maxHp * 0.1) {
      e.hp = 0;
      burst(e.x, e.y, '#ff7ae0', 14, 260); burst(e.x, e.y, '#ffd23f', 14, 260); burst(e.x, e.y, '#7fe6ff', 14, 260);
      floatText(e.x, e.y - 24, 'PIÑATA!', '#ff7ae0', 1);
      for (const o of G.enemies) if (o !== e && !o.dead && dist(o, e) < 90) later(0.01, () => damageEnemy(o, 1 + pl.damage, 0, 0));
    }
    if (e.kind === 'boss' && e.shieldIdx < e.thresholds.length && e.hp <= e.maxHp * e.thresholds[e.shieldIdx]) {
      e.hp = e.maxHp * e.thresholds[e.shieldIdx];
      raiseShield(e);
    }
    if (e.hp <= 0) killEnemy(e);
  }

  function raiseShield(b) {
    b.shielded = true;
    sfx.shield();
    G.shake = 8;
    const spots = [[3, 3], [COLS - 4, 3], [3, ROWS - 4], [COLS - 4, ROWS - 4]].map(([c, r]) => ({ x: (c + 0.5) * T, y: (r + 0.5) * T }));
    spots.sort((a, c) => dist(c, b) - dist(a, b));
    G.room.objects.push({ kind: 'rune', x: spots[0].x, y: spots[0].y, r: 26, boss: b });
    floatText(b.x, b.y - b.r - 20, 'SHIELD UP!', '#9ad8ff', 2);
    G.banner = { text: 'The boss is shielded!', sub: 'Reach the glowing rune and solve its problem to break the shield', t: 3.2, small: true };
    if (!G.run.flags.runeTip) { G.run.flags.runeTip = true; bark(S.tips.rune); }
  }

  function killEnemy(e) {
    const run = G.run, p = run.player;
    if (e.dead) return;
    e.dead = true;
    run.kills++;
    sfx.kill();
    burst(e.x, e.y, e.color, e.kind === 'boss' ? 90 : 16, e.kind === 'boss' ? 420 : 210);
    if (e.kind === 'bigslime') for (let i = 0; i < 2; i++) G.enemies.push(Object.assign(makeEnemy('slime', e.x + rand(-12, 12), e.y + rand(-12, 12)), { spawn: 0.15 }));
    if (e.kind === 'boss') return bossDefeated(e);
    if (e.noDrop) return;
    if (Math.random() < 0.35 + p.luck * 0.15) dropPickup(e.x, e.y, 'coin');
    if (Math.random() < 0.035 + p.luck * 0.04) dropPickup(e.x, e.y, 'heart');
    if (Math.random() < 0.025 + p.luck * 0.025) dropPickup(e.x, e.y, 'edamame');
  }

  function bossDefeated(e) {
    const run = G.run;
    G.shake = 22; sfx.boom();
    G.enemies.forEach((m) => { if (!m.dead && m !== e) { m.dead = true; burst(m.x, m.y, m.color, 10, 150); } });
    G.ebullets = []; G.hazards = []; G.timers = [];
    G.room.objects = G.room.objects.filter((o) => o.kind !== 'rune');
    G.flash = 0.6;
    if (e.variant === 4) { // the fake final boss
      G.room.holdLock = true;
      G.room.objects.push({ kind: 'tonic', x: e.x, y: e.y, r: 18, pop: 0.6 });
      G.banner = { text: 'The Empirical Emperor falls!', sub: 'You did it! ...wait, what did it drop?', t: 3 };
      later(2.4, startTwist);
      return;
    }
    if (e.variant === 5) { G.room.holdLock = true; G.slowmo = 1.6; G.flash = 1; G.zoom = 0.2; for (let i = 0; i < 8; i++) G.vfxRings.push({ x: e.x, y: e.y, t: -i * 0.1, max: 1.2 }); later(0.6, () => startFinale(e)); return; }
    G.room.objects.push({ kind: 'chest', golden: true, unlocked: true, boss: true, x: RW / 2 - 80, y: RH / 2, r: 24, pop: 0.5 });
    G.room.objects.push({ kind: 'stairs', x: RW / 2 + 90, y: RH / 2, r: 28 });
    G.room.objects.push({ kind: 'hat', hat: e.variant, x: RW / 2, y: RH / 2 + 100, r: 16, pop: 0.6 });
    for (let i = 0; i < 6; i++) dropPickup(RW / 2 + rand(-40, 40), RH / 2 + rand(30, 60), 'coin');
    G.banner = { text: 'Boss defeated!', sub: 'Grab the treasure (and your new hat!), then take the stairs down', t: 3 };
    later(1.2, () => startTalk(S.bossDefeat[e.variant]));
  }

  // ================= pickups / effects =================
  function dropPickup(x, y, kind) { G.room.pickups.push({ kind, x, y, vx: rand(-120, 120), vy: rand(-120, 120), t: 0 }); }
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(speed * 0.2, speed);
      G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.8), max: 0.8, color, size: rand(2, 5) });
    }
  }
  const spark = (x, y, color) => burst(x, y, color, 5, 140);
  function puff(x, y, color) { G.particles.push({ x: x + rand(-6, 6), y, vx: rand(-20, 20), vy: rand(-30, -5), life: 0.4, max: 0.4, color, size: rand(3, 6) }); }
  function floatText(x, y, text, color, life) { G.texts.push({ x, y, text, color: color || '#fff', life: life || 1.2, max: life || 1.2 }); }
  function gainEdamame(n) {
    const run = G.run, p = run.player;
    run.edamame += n || 1;
    p.protein = 10;
    if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 1);
    sfx.chomp();
    floatText(p.x, p.y - 34, 'Edamame! Protein Power!', '#9be36b', 2);
    burst(p.x, p.y, '#9be36b', 20, 180);
    if (run.edamame >= 5 && !run.eddie) {
      run.eddie = true;
      addPet('eddie');
      later(0.6, () => bark(S.eddie, 'shocked', 5));
    }
  }

  // ================= pets (friends who fight with you) =================
  const PET_DEFS = {
    slime: { cd: 1.1, dmg: 0.7, color: '#7dffb0', speed: 380 },
    ghost: { cd: 0.9, dmg: 0.8, color: '#c9a7ff', speed: 420 },
    eddie: { cd: 1.0, dmg: 0.5, color: '#9be36b', speed: 420, beans: true },
    sub: { cd: 1.4, dmg: 1.3, color: '#ffffff', speed: 360, paper: true },
    drone: { cd: 0.75, dmg: 1.0, color: '#7fe6ff', speed: 600 },
  };
  function addPet(type, name) {
    const run = G.run, p = run.player;
    const names = { slime: S.petNames, ghost: ['The Outlier'], eddie: ['Eddie the Edamame'], sub: ['Mr. Substitute'], drone: ['Sampling Drone'] }[type];
    run.pets.push({ type, name: name || pick(names), x: p.x - 30, y: p.y + 20, cd: 1, t: rand(0, 3) });
  }
  function updatePets(dt) {
    const p = G.run.player;
    G.run.pets.forEach((pt, i) => {
      pt.t += dt; pt.age = (pt.age || 0) + dt;
      const ang = G.t * 0.8 + (i * TAU) / Math.max(1, G.run.pets.length);
      const want = pt.type === 'drone' ? { x: p.x + Math.cos(G.t * 2) * 40, y: p.y - 46 + Math.sin(G.t * 3) * 6 }
        : { x: p.x + Math.cos(ang) * 54, y: p.y + Math.sin(ang) * 34 + 6 };
      pt.x = lerp(pt.x, want.x, Math.min(1, dt * 4));
      pt.y = lerp(pt.y, want.y, Math.min(1, dt * 4));
      const def = PET_DEFS[pt.type];
      pt.cd -= dt;
      const targets = G.enemies.filter((e) => !e.dead && e.spawn <= 0 && !e.escorted && !(e.kind === 'boss' && e.shielded));
      if (pt.cd <= 0 && targets.length && G.mode === 'play') {
        const tgt = pt.type === 'drone' ? pick(targets) : targets.sort((a, b) => dist(a, pt) - dist(b, pt))[0];
        const a = Math.atan2(tgt.y - pt.y, tgt.x - pt.x);
        const n = def.beans ? 3 : 1;
        for (let k = 0; k < n; k++) {
          const aa = a + (k - (n - 1) / 2) * 0.22;
          G.pbullets.push({ x: pt.x, y: pt.y, vx: Math.cos(aa) * def.speed, vy: Math.sin(aa) * def.speed, r: def.beans ? 5 : 6, dmg: def.dmg * (0.7 + p.damage * 0.3), life: 1.2, hit: new Set(), color: def.color, pet: true, bean: def.beans, paper: def.paper, bounces: 0 });
        }
        pt.cd = def.cd;
      }
    });
  }

  // ================= player =================
  function hurtPlayer(src) {
    const run = G.run, p = run.player;
    if (p.inv > 0 || p.dashT > 0 || G.mode !== 'play' || G.deathT > 0) return;
    if (p.boxShield && p.shieldReady) {
      p.shieldReady = false; p.inv = 0.8;
      burst(p.x, p.y, '#9ad8ff', 18, 200);
      floatText(p.x, p.y - 26, 'Blocked by the box plot!', '#9ad8ff');
      sfx.shield();
      return;
    }
    p.hp -= 0.5; // each hit takes half a heart
    p.inv = 1.1;
    G.shake = 9;
    sfx.hurt();
    burst(p.x, p.y, '#ff5f5f', 14, 180);
    if (p.thorns) for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12;
      G.pbullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, r: 6, dmg: 1.5 + p.damage * 0.5, life: 0.6, pierce: true, bounces: 0, hit: new Set(), color: '#9be36b' });
    }
    if (p.hp <= 0) {
      if (p.hallPass > 0) {
        p.hallPass--; p.hp = 3; p.inv = 2.5;
        G.flash = 0.5;
        floatText(p.x, p.y - 40, 'HALL PASS! Back in the game!', '#ffe27a', 2.5);
        run.items.splice(run.items.indexOf('hallpass'), 1);
        sfx.item();
        return;
      }
      p.hp = 0;
      G.lastHit = src || '';
      G.deathT = 1.4;
      burst(p.x, p.y, '#7fe0d0', 40, 260);
      return;
    }
    if (p.hp <= 2 && !run.flags.helpDone && G.locked && G.room.type !== 'boss') { run.flags.helpDone = true; later(0.8, laporteHelp); }
  }

  function fireShots(p, ax, ay) {
    const base = Math.atan2(ay, ax);
    const n = p.shots;
    const spread = n > 1 ? Math.min(0.9, 0.16 * (n - 1)) : 0;
    p.shotCount++;
    const big = p.outlier && p.shotCount % 6 === 0;
    const dmgMult = p.protein > 0 ? 1.5 : 1;
    for (let i = 0; i < n; i++) {
      const a = n > 1 ? base - spread / 2 + (spread * i) / (n - 1) : base;
      const b = {
        x: p.x + Math.cos(a) * 14, y: p.y - 6 + Math.sin(a) * 14,
        vx: Math.cos(a) * p.shotSpeed, vy: Math.sin(a) * p.shotSpeed,
        r: big ? p.size * 2.6 : p.size, dmg: p.damage * dmgMult * (big ? 4 : 1), life: p.range, max: p.range, pierce: p.pierce || big, bounces: p.bounce, hit: new Set(),
        color: big ? '#ff7ae0' : p.redPen ? '#ff3b3b' : p.protein > 0 ? '#9be36b' : p.frost ? '#bfe9ff' : '#ffe27a',
        pod: p.edamameGun && !big, big,
      };
      if (p.boomerang) { b.boom = true; b.ang = a; b.age = 0; b.side = i % 2 ? -1 : 1; b.life = p.range * 1.6; b.max = b.life; b.pierce = true; b.bounces = 0; }
      if (p.tail && Math.random() < p.tail) { Object.assign(b, { r: 20, dmg: b.dmg * 8, pierce: true, meteor: true, color: '#ff7a1a', pod: false, boom: false, life: p.range * 1.4 }); b.vx *= 0.8; b.vy *= 0.8; floatText(p.x, p.y - 40, 'TAIL EVENT!', '#ff9f43', 1); }
      G.pbullets.push(b);
    }
    if (p.regression && p.shotCount % 5 === 0) playerBeam(p.x, p.y - 6, base, p.damage * dmgMult * 3);
    for (const c of G.clones) {
      if (c.life <= 0) continue;
      const cx = p.x + c.dx, cy = p.y + c.dy;
      G.pbullets.push({ x: cx, y: cy - 6, vx: Math.cos(base) * p.shotSpeed, vy: Math.sin(base) * p.shotSpeed, r: p.size * 0.8, dmg: p.damage * dmgMult * 0.6, life: p.range, hit: new Set(), color: '#c7a6ff', bounces: 0, pet: true });
    }
    sfx.shoot();
  }

  function updatePlayer(dt) {
    const p = G.run.player;
    let mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    let my = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
    const ml = Math.hypot(mx, my);
    if (ml) { mx /= ml; my /= ml; }
    p.moving = !!ml;
    if (p.inv > 0) p.inv -= dt;
    if (p.dashCdT > 0) p.dashCdT -= dt;
    if (p.protein > 0) p.protein -= dt;
    if ((pressed.Space || pressed.ShiftLeft || pressed.ShiftRight) && p.dashCdT <= 0) {
      const dx = ml ? mx : p.faceX, dy = ml ? my : p.faceY;
      p.dashT = 0.17; p.dashX = dx; p.dashY = dy; p.dashCdT = p.dashCd;
      sfx.dash();
      if (p.clones) { G.clones = [{ dx: -dy * 46, dy: dx * 46, life: 3 }, { dx: dy * 46, dy: -dx * 46, life: 3 }]; burst(p.x, p.y, '#c7a6ff', 16, 200); }
    }
    if (p.dashT > 0) {
      p.dashT -= dt;
      moveEnt(p, p.dashX * p.speed * 3.3 * dt, p.dashY * p.speed * 3.3 * dt, 'walk');
      G.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: '#7fe0d0', size: p.r * 0.9, ghost: true });
    } else if (ml) {
      const slow = p.webbed > 0 ? 0.5 : 1;
      moveEnt(p, mx * p.speed * slow * dt, my * p.speed * slow * dt, 'walk');
      p.walkT += dt;
      if (p.chalk) { p.chalkT -= dt; if (p.chalkT <= 0) { p.chalkT = 0.045; G.chalk.push({ x: p.x, y: p.y + 14, life: 2.6 }); } }
      if (Math.random() < dt * 8) puff(p.x, p.y + 16, 'rgba(200,200,220,0.5)');
    }
    let ax = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
    let ay = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
    if (!ax && !ay && mouse.down) { ax = mouse.x + G.cam.x - p.x; ay = mouse.y + G.cam.y - p.y; }
    const al = Math.hypot(ax, ay);
    if (al) { p.faceX = ax / al; p.faceY = ay / al; } else if (ml) { p.faceX = mx; p.faceY = my; }
    p.fireT -= dt;
    if (al && p.fireT <= 0) { p.fireT = p.fireDelay; fireShots(p, ax, ay); }
    if (p.webbed > 0) p.webbed -= dt;
    const fighting = G.enemies.some((e) => !e.dead && e.spawn <= 0);
    if (p.rockets && fighting) { p.rocketT -= dt; if (p.rocketT <= 0) { p.rocketT = 1.5; const a = Math.atan2(p.faceY, p.faceX) + rand(-0.5, 0.5); G.rockets.push({ x: p.x, y: p.y - 10, a, life: 1.8, turn: 0 }); } }
    if (p.saw && fighting) {
      p.sawT -= dt;
      if (p.sawT <= 0) {
        p.sawT = 2.5;
        const tgt = G.enemies.filter((e) => !e.dead).sort((a, b) => dist(a, p) - dist(b, p))[0];
        const a = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : Math.atan2(p.faceY, p.faceX);
        G.saws.push({ x: p.x, y: p.y, a, t: 0, hit: new Set(), spin: 0 });
      }
    }
    if (p.nova && fighting) { p.novaT -= dt; if (p.novaT <= 0) { p.novaT = 7; G.novas.push({ x: p.x, y: p.y, t: 0, hit: new Set() }); sfx.bell(); } }
    if (p.aura) {
      p.auraT -= dt;
      if (p.auraT <= 0) { p.auraT = 3; G.pulses = G.pulses || []; G.pulses.push({ x: p.x, y: p.y, t: 0, hit: [new Set(), new Set(), new Set()] }); }
    }
    if (!G.locked) {
      let dir = null;
      if (p.y < T * 0.5) dir = 'n'; else if (p.y > RH - T * 0.5) dir = 's'; else if (p.x < T * 0.5) dir = 'w'; else if (p.x > RW - T * 0.5) dir = 'e';
      if (dir && G.room.doors[dir]) enterRoom(G.room.doors[dir], OPP[dir]);
    }
  }

  function zapFrom(src, e, dmg) {
    const p = G.run.player;
    let from = e;
    const hit = new Set([e]);
    for (let k = 0; k < p.zapper; k++) {
      let best = null, bd = 190;
      for (const o of G.enemies) { if (hit.has(o) || o.dead || o.spawn > 0) continue; const d = dist(o, from); if (d < bd) { bd = d; best = o; } }
      if (!best) break;
      hit.add(best);
      G.zaps = G.zaps || [];
      G.zaps.push({ x1: from.x, y1: from.y, x2: best.x, y2: best.y, life: 0.18 });
      damageEnemy(best, dmg * 0.5, 0, 0);
      from = best;
    }
    if (hit.size > 1) sfx.zap();
  }

  // ================= interactions =================
  function nearestObject() {
    const p = G.run.player;
    let best = null, bd = 1e9;
    for (const o of G.room.objects) {
      if (o.used || o.fleeing || o.kind === 'hat' || o.kind === 'gate' || o.kind === 'tonic') continue;
      const d = dist(p, o) - o.r - p.r;
      if (d < 28 && d < bd) { best = o; bd = d; }
    }
    return best;
  }
  function priceOf(o) { return Math.max(1, Math.round(o.price * G.run.player.discount)); }
  function objectLabel(o) {
    switch (o.kind) {
      case 'chest': return o.crate ? 'Open the supply crate' : o.unlocked ? 'Open the treasure chest' : (o.golden ? 'Open the Golden Stat Chest' : 'Open the Stat Chest');
      case 'shrine': return 'Use the Shrine of the Mean';
      case 'shopItem':
        if (o.heal) return `Buy a heart: ${priceOf(o)} coins`;
        if (o.edamame) return `Buy edamame (heals + Protein Power): ${priceOf(o)} coins`;
        return `Buy ${o.item.name}: ${priceOf(o)} coins`;
      case 'vending': return 'Talk to the vending machine';
      case 'stairs': return 'Take the stairs down';
      case 'rune': return 'Break the shield rune!';
      case 'flag': return o.creature === 'ghost' ? 'Befriend the lonely Outlier' : 'Adopt the slime (it surrendered!)';
      case 'coffee': return 'Use the staff-only coffee machine';
      case 'bowl': return 'Eat from the bowl of edamame';
      case 'couch': return 'Sit on the comfy couch';
      case 'board': return 'Read the bulletin board';
      case 'fridge': return 'Open the fridge';
      default: return 'Interact';
    }
  }

  function interact(o) {
    const run = G.run, p = run.player;
    if (o.kind === 'chest') {
      if (o.mimic && !o.caught) return wakeMimic(o);
      if (o.mimic) {
        return openProblem(o, {
          icon: '🙀', title: 'Panicking Mimic',
          reward: '"OKAY OKAY! Here\'s a problem, just don\'t hurt me!" Mimics carry <b>double loot</b>',
          onSolve: (perfect) => {
            o.used = true; o.open = true;
            run.gold += irand(4, 8) * p.goldMult;
            burst(o.x, o.y, '#ffd966', 40, 260);
            const n = perfect ? 3 : 2;
            showItemPick(rollItems(n), 'Mimic loot! First pick:', () => showItemPick(rollItems(n), 'Mimic loot! Second pick:'));
          },
        });
      }
      if (o.unlocked) {
        o.used = true; o.open = true;
        run.gold += irand(3, 6) * p.goldMult;
        if (o.crate) return showItemPick(rollItems(2), 'Supply crate! Choose one:');
        return showItemPick(rollItems(3), o.boss ? 'Boss treasure! Choose one:' : o.vault ? 'The vault was unlocked! Choose one:' : 'Treasure! Choose one:');
      }
      if (o.lapSolve && !o.lapDone) { o.lapDone = true; return laporteSolves(o); }
      return openProblem(o, {
        icon: o.golden ? '🏆' : '🔒', title: o.golden ? 'Golden Stat Chest' : 'Stat Chest',
        reward: o.golden ? 'Reward: choose 1 of 3 items. Perfect solve: also +10 coins and a full heal' : 'Reward: choose 1 of 2 items, or 1 of 3 for a perfect solve',
        onSolve: (perfect) => {
          o.used = true; o.open = true;
          run.gold += irand(2, 5) * p.goldMult;
          burst(o.x, o.y, '#ffd966', 30, 240);
          if (o.golden && perfect) { run.gold += 10; p.hp = p.maxHp; }
          showItemPick(rollItems(o.golden || perfect ? 3 : 2), perfect ? '⭐ PERFECT! Choose one:' : 'Unlocked! Choose one:');
        },
      });
    }
    if (o.kind === 'shrine') {
      return openProblem(o, {
        icon: '⛲', title: 'Shrine of the Mean',
        reward: 'Reward: full heal + a blessing. Perfect solve: also <b>+1 max heart</b>',
        onSolve: (perfect) => {
          o.used = true;
          if (perfect) p.maxHp += 1;
          p.hp = p.maxHp;
          const b = pick([['+Damage', () => (p.damage += 0.3)], ['+Speed', () => (p.speed *= 1.07)], ['+Fire rate', () => (p.fireDelay *= 0.9)]]);
          b[1]();
          sfx.heart();
          burst(o.x, o.y, '#9fd3ff', 50, 260);
          floatText(p.x, p.y - 30, `Healed! ${b[0]}${perfect ? ' +1 max ♥' : ''}`, '#9fd3ff', 2.4);
        },
      });
    }
    if (o.kind === 'rune') {
      const b = o.boss;
      return openProblem(o, {
        icon: '🔮', title: 'Shield Rune', hard: true,
        reward: 'Solve it to shatter the boss\'s shield. Perfect solve: the boss is <b>stunned</b> too!',
        onSolve: (perfect) => {
          o.used = true;
          G.room.objects = G.room.objects.filter((x) => x !== o);
          b.shielded = false; b.shieldIdx++;
          if (perfect) { b.stun = 2.5; floatText(b.x, b.y - b.r - 30, 'STUNNED!', '#ffe27a', 2); }
          G.ebullets = [];
          G.shake = 12; sfx.boom();
          burst(b.x, b.y, '#9ad8ff', 60, 320);
          G.banner = { text: 'Shield shattered!', sub: perfect ? 'Perfect solve! The boss is stunned. GO GO GO!' : 'Keep attacking!', t: 2, small: true };
        },
      });
    }
    if (o.kind === 'shopItem') {
      const price = priceOf(o);
      if (run.gold < price) { floatText(o.x, o.y - 40, `Need ${price - run.gold} more coins`, '#ff9a9a', 1.6); sfx.wrong(); return; }
      if (o.heal && p.hp >= p.maxHp) { floatText(o.x, o.y - 40, 'You are already at full health!', '#ffd966', 1.6); return; }
      run.gold -= price;
      o.used = true;
      if (o.heal) { p.hp = Math.min(p.maxHp, p.hp + 1); sfx.heart(); floatText(p.x, p.y - 30, '+1 ♥', '#ff6b8a'); }
      else if (o.edamame) gainEdamame(1);
      else giveItem(o.item);
      speakVending(pick(S.vendingThanks));
      return;
    }
    if (o.kind === 'vending') { speakVending(pick(S.vendingLines)); return; }
    if (o.kind === 'stairs') { o.used = true; return goDownstairs(); }
    if (o.kind === 'flag') {
      o.used = true;
      G.room.objects = G.room.objects.filter((x) => x !== o);
      addPet(o.creature);
      const pt = run.pets[run.pets.length - 1];
      sfx.heart();
      burst(o.x, o.y, '#ff9fd0', 30, 200);
      floatText(o.x, o.y - 40, `${pt.name} joined your party!`, '#ff9fd0', 2.6);
      if (o.creature === 'ghost') later(0.4, () => bark(S.outlierJoin, 'happy', 4.5));
      return;
    }
    if (o.kind === 'coffee') {
      o.used = true;
      p.hp = p.maxHp;
      sfx.heart();
      return showItemPick(rollItems(3, LOUNGE_ITEMS.filter((i) => !run.items.includes(i.id) || !['redpen', 'subplans'].includes(i.id))), '☕ Staff-only coffee machine! Choose a STAFF upgrade:');
    }
    if (o.kind === 'bowl') {
      o.used = true;
      gainEdamame(2);
      p.hp = Math.min(p.maxHp, p.hp + 2);
      const lap = G.actors.find((a) => a.kind === 'laporte');
      if (lap) later(0.3, () => bark(S.edamameBowl, 'shocked', 3.5));
      return;
    }
    if (o.kind === 'couch') {
      o.used = true;
      p.hp = p.maxHp; p.maxHp += 0;
      sfx.heart();
      floatText(p.x, p.y - 34, 'So comfy... Full heal!', '#ff9fd0', 2);
      return;
    }
    if (o.kind === 'board') return startTalk(shuffle(S.boardNotes).slice(0, 3).map((t) => ({ w: 'board', t })));
    if (o.kind === 'fridge') {
      o.used = true;
      startTalk([{ w: 'board', t: S.fridge }], () => gainEdamame(1));
      return;
    }
  }
  function speakVending(text) {
    const v = G.room.objects.find((x) => x.kind === 'vending');
    if (v) { v.say = text; v.sayT = 3; }
    sfx.blip(300);
  }

  // ---------- mimics ----------
  function wakeMimic(o) {
    o.fleeing = true; o.t = 0; o.pop = 0.3;
    sfx.scream();
    G.shake = 5;
    floatText(o.x, o.y - 40, 'AAAAH!', '#ff8a8a', 1.6);
    floatText(o.x, o.y - 62, 'It was a MIMIC! Catch it!', '#ffe27a', 2.2);
  }
  function updateMimic(o, dt) {
    const p = G.run.player;
    o.t += dt;
    const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1;
    const sp = 175 + Math.sin(o.t * 8) * 30;
    const tx = dx / d + Math.sin(o.t * 2.3) * 0.6, ty = dy / d + Math.cos(o.t * 1.9) * 0.6;
    const tl = Math.hypot(tx, ty) || 1;
    const hit = moveEnt(o, (tx / tl) * sp * dt, (ty / tl) * sp * dt, 'walk');
    if (hit) { o.x += rand(-20, 20); o.y += rand(-20, 20); }
    o.x = clamp(o.x, T * 1.5, RW - T * 1.5); o.y = clamp(o.y, T * 1.5, RH - T * 1.5);
    if (Math.random() < dt * 6) puff(o.x, o.y + 14, '#c9a36b');
    if (d < o.r + p.r + 6) {
      o.fleeing = false; o.caught = true;
      floatText(o.x, o.y - 40, 'Caught it!', '#7fffa0', 1.6);
      sfx.coin();
      interact(o);
    }
  }

  // ---------- surrendering monsters ----------
  function surrender(e) {
    e.dead = true;
    G.room.objects.push({ kind: 'flag', creature: e.kind === 'ghost' ? 'ghost' : 'slime', x: e.x, y: e.y, r: 18, color: e.color, t: 0 });
    floatText(e.x, e.y - 50, e.kind === 'ghost' ? '"Everyone says I\'m an outlier... can I come with you?"' : '"I give up! Please adopt me!"', '#ffffff', 3.2);
    sfx.heart();
  }
  function flagHit(o) {
    o.used = true;
    G.room.objects = G.room.objects.filter((x) => x !== o);
    burst(o.x, o.y, o.color || '#7dffb0', 16, 160);
    floatText(o.x, o.y - 30, o.creature === 'ghost' ? '*sad ghost noises* (it floats away)' : 'It ran away crying. Rude!', '#ffb3b3', 2.4);
  }

  // ================= problem modal =================
  const M = { obj: null, opts: null };
  function genProblem(hard) {
    const sec = sectionFor(hard);
    try { return PR.generate(sec, { hard: !!hard }); } catch (err) { console.error(err); return PR.generate('3.1', {}); }
  }
  function openProblem(obj, opts) {
    const run = G.run;
    if (run.freeSolves > 0) {
      run.freeSolves--; bark(S.freeSolve, 'happy', 3.2);
      clearInput();
      setTimeout(() => opts.onSolve(false), 50);
      return;
    }
    M.auto = skipOn(); // teacher / just-for-fun mode: the answer is filled in, just press Enter
    if (!obj.problem) { obj.problem = genProblem(opts.hard); obj.pst = { wrong: 0, hints: 0, revealed: false, sel: {} }; }
    M.obj = obj; M.opts = opts;
    G.mode = 'modal';
    clearInput();
    renderModal();
    $('modal').classList.remove('hidden');
    setTimeout(() => { const i = $('pm-parts').querySelector('input'); if (i) i.focus(); }, 40);
  }
  function renderModal() {
    const o = M.obj, p = o.problem, st = o.pst;
    $('pm-icon').textContent = M.opts.icon;
    $('pm-title').textContent = M.opts.title + (p.title ? ': ' + p.title : '');
    $('pm-reward').innerHTML = M.opts.reward || '';
    $('pm-sec').textContent = p.section + ' · ' + secName(p.section);
    $('pm-sec').style.background = secColor(p.section);
    $('pm-type').textContent = '';
    $('pm-prompt').innerHTML = p.promptHTML;
    $('pm-desmos').classList.toggle('hidden', !p.desmos);
    const box = $('pm-parts');
    box.innerHTML = '';
    p.parts.forEach((part, k) => {
      if (part.kind === 'num') {
        const lab = document.createElement('label');
        lab.className = 'part-num';
        lab.innerHTML = `<span>${part.label || 'Answer:'}</span><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-k="${k}" placeholder="${escapeHTML(part.placeholder || '')}"><span class="unit">${part.unit || ''}</span>`;
        box.appendChild(lab);
      } else {
        const wrap = document.createElement('div');
        wrap.className = 'part-choice';
        wrap.innerHTML = `<div class="pl">${part.label || 'Choose one:'}</div><div class="choices"></div>`;
        const cs = wrap.querySelector('.choices');
        part.options.forEach((opt, i) => {
          const b = document.createElement('button');
          b.className = 'choice' + (st.sel[k] === i ? ' sel' : '');
          b.innerHTML = `<span class="ck">${i + 1}</span>${opt}`;
          b.onclick = () => { st.sel[k] = i; cs.querySelectorAll('.choice').forEach((x, j) => { x.classList.toggle('sel', j === i); x.classList.remove('bad'); }); if (p.parts.length === 1) submitAnswer(); };
          cs.appendChild(b);
        });
        box.appendChild(wrap);
      }
    });
    if (M.auto) {
      p.parts.forEach((part, k) => {
        if (part.kind === 'num') { const inp = box.querySelector(`input[data-k="${k}"]`); if (inp) inp.value = String(part.answer); }
        else { st.sel[k] = part.correct; const b = box.querySelectorAll('.part-choice .choice')[part.correct]; if (b) b.classList.add('sel'); }
      });
    }
    $('pm-hints').innerHTML = p.hints.slice(0, st.hints).map((h, i) => `<div class="hint"><b>Hint ${i + 1}:</b> ${h}</div>`).join('');
    // Mr. Laporte's tip the first time you see each section
    const run = G.run;
    if (!run.flags['tip' + p.section] && S.secTips[p.section]) {
      run.flags['tip' + p.section] = true;
      $('pm-hints').insertAdjacentHTML('afterbegin', `<div class="lap-tip"><canvas width="32" height="32" class="lt"></canvas><div><b>Mr. Laporte:</b> ${S.secTips[p.section]}</div></div>`);
      const c = $('pm-hints').querySelector('canvas.lt');
      A.drawPortrait(c.getContext('2d'), 0, 0, 32, { expr: 'happy', t: 1 });
    }
    $('pm-solution').innerHTML = '';
    $('pm-solution').classList.add('hidden');
    setFeedback(M.auto ? (G.run.fun ? 'Just-for-fun mode: the answer is filled in. Press Enter!' : 'Teacher mode: the correct answer is filled in. Press Enter.') : '', M.auto ? 'warn' : '');
    $('pm-hint').disabled = st.hints >= p.hints.length;
    $('pm-hint').textContent = st.hints >= p.hints.length ? 'No more hints' : `Hint (${p.hints.length - st.hints} left)`;
    $('pm-reveal').classList.toggle('hidden', st.wrong < 2);
    $('pm-submit').classList.remove('hidden');
    $('pm-submit').disabled = false;
    $('pm-new').classList.add('hidden');
    $('pm-hint').classList.remove('hidden');
  }
  function recordResult(sec, solved, perfect, hints) {
    const s = G.run.stats;
    s.attempted++;
    if (solved) s.solved++;
    if (perfect) s.perfect++;
    s.hints += hints;
    const bt = (s.bySec[sec] = s.bySec[sec] || { attempted: 0, solved: 0, perfect: 0 });
    bt.attempted++;
    if (solved) bt.solved++;
    if (perfect) bt.perfect++;
  }
  function submitAnswer() {
    const o = M.obj, p = o.problem;
    if (!p || o.pst.revealed) return;
    const inputs = [...$('pm-parts').querySelectorAll('input')];
    if (inputs.some((i) => !i.value.trim())) { setFeedback('Fill in every box first.', 'warn'); return; }
    const missingChoice = p.parts.some((part, k) => part.kind === 'choice' && o.pst.sel[k] == null);
    if (missingChoice) { setFeedback('Pick an answer for every question.', 'warn'); return; }
    let allOk = true;
    p.parts.forEach((part, k) => {
      if (part.kind === 'num') {
        const inp = $('pm-parts').querySelector(`input[data-k="${k}"]`);
        const ok = PR.check(part, inp.value);
        inp.classList.toggle('ok', ok); inp.classList.toggle('bad', !ok);
        if (!ok) allOk = false;
      } else {
        const ok = PR.check(part, o.pst.sel[k]);
        const btns = $('pm-parts').querySelectorAll('.part-choice')[p.parts.slice(0, k).filter((x) => x.kind === 'choice').length].querySelectorAll('.choice');
        btns.forEach((b, i) => { b.classList.toggle('ok', ok && i === o.pst.sel[k]); b.classList.toggle('bad', !ok && i === o.pst.sel[k]); });
        if (!ok) { allOk = false; o.pst.sel[k] = null; }
      }
    });
    if (allOk) return solvedProblem();
    wrongAnswer(p.parts.length > 1 ? 'Not quite. Check the red part(s).' : 'Not quite. Try again!');
  }
  function wrongAnswer(msg) {
    const o = M.obj;
    o.pst.wrong++;
    sfx.wrong();
    let m = msg;
    if (o.pst.wrong === 1 && o.pst.hints === 0) m += ' (Stuck? Try a hint.)';
    if (o.pst.wrong >= 2) m += ' You can also press "Show me how".';
    setFeedback(m, 'bad');
    const panel = $('modal-panel');
    panel.classList.remove('shake'); void panel.offsetWidth; panel.classList.add('shake');
    if (o.pst.wrong >= 2) $('pm-reveal').classList.remove('hidden');
  }
  function solvedProblem() {
    const o = M.obj, st = o.pst, p = o.problem;
    const perfect = st.wrong === 0 && st.hints === 0 && !M.auto;
    if (M.auto) G.run.skipped++;
    else { recordResult(p.section, true, perfect, st.hints); G.run.floorSolved++; }
    o.problem = null;
    sfx.correct();
    setFeedback(perfect ? '⭐ PERFECT! First try, no hints! ⭐' : '✔ Correct! Nice work!', 'ok');
    $('pm-submit').disabled = true;
    $('pm-parts').querySelectorAll('input,button').forEach((el) => (el.disabled = true));
    const opts = M.opts;
    setTimeout(() => { closeModal(); opts.onSolve(perfect); }, perfect ? 1100 : 850);
  }
  function revealSolution() {
    const o = M.obj, p = o.problem;
    if (!p) return;
    o.pst.revealed = true;
    recordResult(p.section, false, false, o.pst.hints);
    $('pm-solution').innerHTML = '<div class="sol-title">Here’s how to solve it:</div>' + p.solution.map((s) => `<div class="sol-step">${s}</div>`).join('');
    $('pm-solution').classList.remove('hidden');
    $('pm-hints').innerHTML = '';
    $('pm-submit').classList.add('hidden');
    $('pm-hint').classList.add('hidden');
    $('pm-reveal').classList.add('hidden');
    $('pm-new').classList.remove('hidden');
    $('pm-parts').querySelectorAll('input,button').forEach((el) => (el.disabled = true));
    setFeedback('Study the steps, then try a new one to earn the reward.', 'warn');
    o.problem = null;
  }
  function newProblem() {
    const o = M.obj;
    o.problem = genProblem(M.opts.hard);
    o.pst = { wrong: 0, hints: 0, revealed: false, sel: {} };
    renderModal();
    $('pm-help').scrollTop = 0;
    setTimeout(() => { const i = $('pm-parts').querySelector('input'); if (i) i.focus(); }, 40);
  }
  function useHint() {
    const o = M.obj;
    if (!o.problem || o.pst.hints >= o.problem.hints.length) return;
    o.pst.hints++;
    const saved = [...$('pm-parts').querySelectorAll('input')].map((i) => i.value);
    renderModal();
    [...$('pm-parts').querySelectorAll('input')].forEach((i, k) => (i.value = saved[k] || ''));
    if (o.pst.wrong >= 2) $('pm-reveal').classList.remove('hidden');
    const h = $('pm-help'); h.scrollTop = h.scrollHeight;
  }
  function setFeedback(msg, cls) { const f = $('pm-feedback'); f.textContent = msg; f.className = cls || ''; }
  function closeModal() {
    $('modal').classList.add('hidden');
    if (G.mode === 'modal') G.mode = 'play';
    clearInput();
    blurUI();
  }
  function modalKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!$('pm-new').classList.contains('hidden')) newProblem(); else submitAnswer();
      return;
    }
    const o = M.obj;
    if (o && o.problem && /^[1-4]$/.test(e.key) && !(e.target && e.target.tagName === 'INPUT')) {
      const k = o.problem.parts.findIndex((pp, i) => pp.kind === 'choice' && o.pst.sel[i] == null);
      const groups = $('pm-parts').querySelectorAll('.part-choice');
      const gi = o.problem.parts.slice(0, k).filter((x) => x.kind === 'choice').length;
      if (k >= 0 && groups[gi]) { const b = groups[gi].querySelectorAll('.choice')[Number(e.key) - 1]; if (b && !b.disabled) b.click(); }
    }
  }
  $('pm-submit').onclick = submitAnswer;
  $('pm-hint').onclick = useHint;
  $('pm-reveal').onclick = revealSolution;
  $('pm-new').onclick = newProblem;
  $('pm-leave').onclick = closeModal;

  // ================= item pick =================
  let pickChoices = [], pickThen = null;
  const iconHTML = (icon) => {
    if (icon.startsWith('img:')) {
      const spr = { edamame: A.edamameSprite() }[icon.slice(4)];
      return spr ? `<img src="${spr.toDataURL()}" alt="">` : '';
    }
    return icon;
  };
  function showItemPick(items, title, then) {
    if (!items.length) { if (then) then(); return; }
    pickChoices = items; pickThen = then || null;
    G.mode = 'pick';
    clearInput();
    $('pick-title').textContent = title;
    const box = $('pick-cards');
    box.innerHTML = '';
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.className = 'card';
      b.innerHTML = `<div class="ci">${iconHTML(it.icon)}</div><div class="cn">${it.name}</div><div class="cd">${it.desc}</div><div class="cr r-${it.rarity}">${it.rarity === 'staff' ? '★ staff only' : it.rarity}</div><div class="ck">press ${i + 1}</div>`;
      b.onclick = () => choosePick(i);
      box.appendChild(b);
    });
    $('pick').classList.remove('hidden');
  }
  function choosePick(i) {
    const it = pickChoices[i];
    if (!it) return;
    $('pick').classList.add('hidden');
    G.mode = 'play';
    clearInput(); blurUI();
    giveItem(it);
    if (pickThen) { const f = pickThen; pickThen = null; setTimeout(f, 300); }
  }
  function pickKey(e) { if (/^[1-3]$/.test(e.key)) choosePick(Number(e.key) - 1); }

  // ================= dialogue =================
  // line: string (Mr. Laporte, calm) or { w: who, e: expression, t: text, mane, hair }
  const normLine = (l) => (typeof l === 'string' ? { w: 'laporte', e: 'calm', t: l } : Object.assign({ w: 'laporte', e: 'calm' }, l));
  function startTalk(lines, onDone) {
    if (!lines || !lines.length) { if (onDone) onDone(); return; }
    G.talk = { lines: lines.map(normLine), i: 0, chars: 0, onDone, prev: G.mode === 'talk' ? 'play' : G.mode, t: 0 };
    G.mode = 'talk';
    clearInput();
  }
  function updateTalk(dt) {
    const tk = G.talk;
    tk.t += dt;
    const line = tk.lines[tk.i];
    const before = Math.floor(tk.chars);
    tk.chars = Math.min(line.t.length, tk.chars + dt * 52);
    if (Math.floor(tk.chars) !== before && Math.floor(tk.chars) % 3 === 0 && line.t[Math.floor(tk.chars)] !== ' ') sfx.blip(line.w === 'laporte' ? (line.mane ? 340 : 480) : 260);
    const adv = pressed.Enter || pressed.Space || pressed.KeyE || mouse.clicked;
    mouse.clicked = false;
    if (pressed.Escape) { finishTalk(); return; }
    if (adv) {
      if (tk.chars < line.t.length) tk.chars = line.t.length;
      else { tk.i++; tk.chars = 0; if (tk.i >= tk.lines.length) finishTalk(); }
    }
  }
  function finishTalk() {
    const tk = G.talk;
    G.talk = null;
    G.mode = tk.prev === 'talk' ? 'play' : tk.prev;
    clearInput();
    if (tk.onDone) tk.onDone();
  }
  function bark(text, expr, dur) {
    if (!text) return;
    const l = typeof text === 'string' ? { t: text, e: expr || 'happy' } : text;
    G.bark = { text: l.t, expr: l.e || expr || 'happy', t: dur || Math.max(3.5, l.t.length / 18), max: dur || Math.max(3.5, l.t.length / 18), age: 0 };
  }

  // ================= actors (Mr. Laporte, security) & cutscenes =================
  function actor(kind, x, y, extra) {
    const a = Object.assign({ kind, x, y, tx: x, ty: y, speed: 220, walkT: 0, moving: false, arrived: true, face: 1 }, extra || {});
    G.actors.push(a);
    return a;
  }
  function goTo(a, x, y, speed, onArrive) { a.tx = x; a.ty = y; if (speed) a.speed = speed; a.arrived = false; a.onArrive = onArrive || null; }
  function updateActors(dt) {
    for (const a of G.actors) {
      a.t = (a.t || 0) + dt;
      if (a.arrived) { a.moving = false; continue; }
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      const step = a.speed * dt;
      if (d <= step) {
        a.x = a.tx; a.y = a.ty; a.arrived = true; a.moving = false;
        if (a.onArrive) { const f = a.onArrive; a.onArrive = null; f(a); }
      } else {
        a.x += (dx / d) * step; a.y += (dy / d) * step; a.moving = true; a.walkT += dt;
        if (Math.abs(dx) > 2) a.face = dx > 0 ? 1 : -1;
        if (a.kind === 'laporte' && a.speed > 300 && Math.random() < dt * 20) puff(a.x, a.y + 30, 'rgba(220,210,190,0.7)');
      }
      if (a.drag && !a.drag.dead) { a.drag.x = a.x + (a.dragDx || 0); a.drag.y = a.y + (a.dragDy || 0); }
      if (a.kind === 'laporte' && a.mane > 0.5) maneSparkles(a.x, a.y, a.scale || 1, dt);
    }
  }
  function runCut(steps, onDone) {
    G.cut = { steps, i: -1, onDone, t: 0, step: null };
    G.mode = 'cut';
    clearInput();
    nextCutStep();
  }
  function nextCutStep() {
    const c = G.cut;
    if (!c) return;
    c.i++;
    if (c.i >= c.steps.length) { G.cut = null; G.mode = 'play'; clearInput(); if (c.onDone) c.onDone(); return; }
    const s = c.steps[c.i];
    c.step = s; c.t = 0;
    if (s.do) { s.do(); return nextCutStep(); }
    if (s.say) { startTalk(typeof s.say === 'function' ? s.say() : s.say, () => { G.mode = 'cut'; nextCutStep(); }); return; }
    if (s.choose) { showCharSelect(() => nextCutStep()); return; }
    if (s.move) { goTo(s.move, s.x, s.y, s.speed, s.wait === false ? null : () => nextCutStep()); if (s.wait === false) nextCutStep(); return; }
  }
  function updateCut(dt) {
    const c = G.cut;
    if (!c || !c.step) return;
    const s = c.step;
    c.t += dt;
    if (s.wait != null && !s.move) { if (c.t >= s.wait) nextCutStep(); return; }
    if (s.anim) { s.anim(Math.min(1, c.t / s.dur), dt); if (c.t >= s.dur) nextCutStep(); }
  }
  function doorPoint(dir) {
    return { n: { x: RW / 2, y: T * 0.3 }, s: { x: RW / 2, y: RH - T * 0.3 }, w: { x: T * 0.3, y: RH / 2 }, e: { x: RW - T * 0.3, y: RH / 2 } }[dir] || { x: RW / 2, y: RH - T * 0.3 };
  }

  // ---- the opening cutscene ----
  function introCutscene() {
    const p = G.run.player;
    p.x = RW / 2; p.y = RH / 2 + 40; p.faceX = -1; p.faceY = 0;
    const lap = actor('laporte', -40, RH / 2 + 40, { speed: 520 });
    runCut([
      { wait: 0.8 },
      { do: () => floatText(RW / 2 - 200, RH / 2 - 30, '"WAAAAAIT!"', '#ffe27a', 1.6) },
      { move: lap, x: p.x - 110, y: p.y, speed: 560 },
      { do: () => { G.shake = 4; for (let i = 0; i < 12; i++) puff(lap.x + 10, lap.y + 30, 'rgba(220,210,190,0.8)'); sfx.dash(); } },
      { wait: 0.4 },
      { say: S.intro1 },
      { choose: true },
      { say: () => S.intro2(G.run.name, G.run.hero) },
      { move: lap, x: -60, y: p.y, speed: 520 },
      { do: () => { G.actors = G.actors.filter((a) => a !== lap); } },
    ], () => { G.banner = { text: 'Floor 1', sub: G.run.theme.name, t: 3, sec: settings.mode === 'mixed' ? null : '3.1' }; });
  }

  // ---- "who are you again?" (pick a character) ----
  let charSel = 'boy', charDone = null;
  function showCharSelect(done) {
    charDone = done;
    G.mode = 'charsel';
    clearInput();
    ['boy', 'girl'].forEach((k) => {
      const img = $('cs-img-' + k);
      if (!img.src || img.src === location.href) img.src = A.heroSprite(false, 0, k).toDataURL();
    });
    markCharSel('boy');
    $('charsel').classList.remove('hidden');
  }
  function markCharSel(k) {
    charSel = k;
    $('cs-boy').classList.toggle('sel', k === 'boy');
    $('cs-girl').classList.toggle('sel', k === 'girl');
  }
  function confirmCharSel(k) {
    if (k) charSel = k;
    G.run.hero = charSel;
    $('charsel').classList.add('hidden');
    sfx.item();
    G.mode = 'cut';
    clearInput(); blurUI();
    const f = charDone; charDone = null;
    if (f) f();
  }
  $('cs-boy').onclick = () => confirmCharSel('boy');
  $('cs-girl').onclick = () => confirmCharSel('girl');
  $('cs-boy').onmouseenter = () => markCharSel('boy');
  $('cs-girl').onmouseenter = () => markCharSel('girl');

  // ---- the freshman stampede (rare): a callback to study hall ----
  function maybeStampede() {
    const run = G.run;
    if (run.flags.stampedeDone || Math.random() > 0.08) return false;
    run.flags.stampedeDone = true;
    later(rand(2.2, 3.5), () => { if (G.locked && G.enemies.filter((e) => !e.dead).length >= 2 && G.mode === 'play') startStampede(); });
    return true;
  }
  function startStampede() {
    const ltr = Math.random() < 0.5;
    const x0 = ltr ? -40 : RW + 40, x1 = ltr ? RW + 80 : -80;
    const lap = actor('laporte', x0, clamp(G.run.player.y, T * 2, RH - T * 2), { speed: 470 });
    bark(pick(S.stampedeStart), 'shocked', 3.4);
    sfx.whistle();
    goTo(lap, x1, lap.y, 470, () => { G.actors = G.actors.filter((a) => a !== lap); });
    later(1.1, () => {
      const n = Math.round(14 * Math.max(1, RH / VH));
      for (let i = 0; i < n; i++) {
        const y = T * 1.5 + ((i + Math.random() * 0.8) / n) * (RH - T * 3);
        const f = actor('freshman', x0 - rand(0, 260), y, { speed: rand(300, 400), look: irand(0, 99), say: Math.random() < 0.55 ? pick(S.freshmanLines) : null, phone: Math.random() < 0.7 });
        goTo(f, x1 - rand(0, 40), y + rand(-20, 20), f.speed, (a) => { G.actors = G.actors.filter((x) => x !== a); });
      }
      G.stampede = 3.5; G.stampedeSwept = false;
      noise(1.6, 0.08, 500);
      later(3.2, () => { if (!G.actors.some((a) => a.kind === 'freshman')) bark(pick(S.stampedeEnd), 'annoyed', 3.6); else later(1.2, () => bark(pick(S.stampedeEnd), 'annoyed', 3.6)); });
    });
  }
  function updateStampede(dt) {
    if (!(G.stampede > 0)) return;
    G.stampede -= dt;
    if (G.stampede <= 0.6 && !G.stampedeSwept) {
      // the tail end of the stampede sweeps up any stragglers
      G.stampedeSwept = true;
      for (const e of G.enemies) if (!e.dead && e.kind !== 'boss') { floatText(e.x, e.y - 20, 'Swept away!', '#ffffff', 1.2); killEnemy(e); }
    }
    G.shake = Math.max(G.shake, 2.5);
    for (const a of G.actors) {
      if (a.kind !== 'freshman') continue;
      if (Math.random() < dt * 10) puff(a.x, a.y + 18, 'rgba(220,210,190,0.7)');
      for (const e of G.enemies) {
        if (e.dead || e.kind === 'boss' || e.spawn > 0) continue;
        if (Math.abs(e.x - a.x) < e.r + 18 && Math.abs(e.y - a.y) < e.r + 26) { floatText(e.x, e.y - 20, 'TRAMPLED!', '#ffffff', 1); killEnemy(e); }
      }
    }
  }

  // ---- "SECURITY!" ----
  function maybeSecurity() {
    const run = G.run;
    if (run.flags.securityDone || run.floor > 5 || Math.random() > 0.38) return;
    run.flags.securityDone = true;
    later(rand(2.5, 4), () => { if (G.locked && G.enemies.filter((e) => !e.dead).length >= 2 && G.mode === 'play') startSecurity(); });
  }
  function startSecurity() {
    const room = G.room;
    const dir = room.enteredFrom || pick(Object.keys(room.doors));
    const dp = doorPoint(dir);
    const target = G.enemies.filter((e) => !e.dead && e.kind !== 'boss' && e.spawn <= 0).sort((a, b) => b.maxHp - a.maxHp)[0];
    if (!target) return;
    const inward = { x: (RW / 2 - dp.x) * 0.12, y: (RH / 2 - dp.y) * 0.12 };
    const lap = actor('laporte', dp.x + inward.x, dp.y + inward.y, { speed: 0 });
    sfx.whistle();
    bark(pick(S.securityYell), 'furious', 3);
    const guards = [actor('guard', dp.x - 20, dp.y, { speed: 210 }), actor('guard', dp.x + 20, dp.y, { speed: 210 })];
    let arrived = 0;
    guards.forEach((g, i) => goTo(g, target.x + (i ? 26 : -26), target.y, 230, () => {
      arrived++;
      if (arrived < 2 || target.dead) return;
      target.escorted = true;
      floatText(target.x, target.y - 40, pick(S.securityEnemy), '#ffffff', 2.2);
      guards.forEach((gg, j) => { gg.drag = j === 0 ? target : null; gg.dragDx = 26; gg.dragDy = 0; goTo(gg, dp.x + (j ? 26 : -26) * 0 + (j ? 20 : -20), dp.y, 120, () => {
        if (j === 0) { target.dead = true; G.actors = G.actors.filter((a) => !guards.includes(a) && a !== lap); bark(pick(S.securityDone), 'happy', 3); }
      }); });
    }));
  }

  // ---- Mr. Laporte runs in with a heart when you're in trouble ----
  function laporteHelp() {
    if (G.mode !== 'play' || !G.locked) return;
    const dir = G.room.enteredFrom || pick(Object.keys(G.room.doors));
    const dp = doorPoint(dir);
    const lap = actor('laporte', dp.x, dp.y, { speed: 520 });
    const px = (dp.x + RW / 2) / 2, py = (dp.y + RH / 2) / 2;
    goTo(lap, px, py, 520, () => {
      for (let i = 0; i < 2; i++) dropPickup(px + rand(-10, 10), py + rand(-10, 10), 'heart');
      bark(pick(S.helpLines), 'excited', 3.2);
      later(0.6, () => goTo(lap, dp.x, dp.y, 560, () => { G.actors = G.actors.filter((a) => a !== lap); }));
    });
  }

  // ---- Mr. Laporte runs in and solves a Stat Chest for you ----
  function laporteSolves(o) {
    o.used = true;
    const dir = G.room.enteredFrom || pick(Object.keys(G.room.doors));
    const dp = doorPoint(dir);
    const lap = actor('laporte', dp.x, dp.y, { speed: 560 });
    bark(pick(S.lapSolveStart), 'excited', 2.4);
    goTo(lap, o.x - 44, o.y + 8, 560, () => {
      lap.face = 1;
      bark(pick(S.lapSolveDone), 'smug', 3.6);
      burst(o.x, o.y, '#ffd966', 30, 240);
      sfx.correct();
      later(0.6, () => {
        o.open = true;
        G.run.gold += irand(2, 5) * G.run.player.goldMult;
        showItemPick(rollItems(2), 'Mr. Laporte solved it for you! Choose one:');
        later(0.4, () => goTo(lap, dp.x, dp.y, 560, () => { G.actors = G.actors.filter((a) => a !== lap); }));
      });
    });
  }

  // ---- the lounge: Mr. Laporte is already in here ----
  function laporteCameo() {
    const lap = actor('laporte', 6 * T, 3.4 * T, { speed: 200 });
    later(0.5, () => startTalk(S.lounge));
    return lap;
  }

  // ---- the twist: the fake final boss drops Secret Hair Tonic ----
  function startTwist() {
    const room = G.room, p = G.run.player;
    const tonic = room.objects.find((o) => o.kind === 'tonic');
    const dp = doorPoint(room.enteredFrom || 's');
    const lap = actor('laporte', dp.x, dp.y, { speed: 480, keep: true, mane: 0 });
    G.ebullets = [];
    runCut([
      { move: lap, x: lerp(dp.x, p.x, 0.6), y: lerp(dp.y, p.y, 0.6) },
      { say: S.twist1 },
      { move: lap, x: tonic.x - 30, y: tonic.y + 10, speed: 160 },
      { say: S.twist2 },
      { do: () => { tonic.used = true; room.objects = room.objects.filter((o) => o !== tonic); sfx.power(); } },
      { say: S.twist3 },
      { anim: (k) => { lap.mane = k; G.psy = k; G.shake = 6 + k * 8; if (Math.random() < 0.5) burst(lap.x, lap.y - 20, pick(['#ffd23f', '#fff4a8', '#ff7ae0', '#7fe6ff']), 4, 260); if (Math.random() < 0.05) G.flash = 0.25; }, dur: 3.2 },
      { do: () => { G.flash = 0.9; sfx.boom(); } },
      { say: S.twist4 },
      { do: () => {
        G.actors = G.actors.filter((a) => a !== lap);
        const b = makeBoss(6);
        G.run.flags.finalFight = true;
        b.x = lap.x; b.y = lap.y; b.spawn = 0.4;
        G.enemies.push(b);
        G.locked = true;
        G.room.cleared = false;
      } },
    ]);
  }

  // ---- the finale: the mane falls out ----
  function startFinale(e) {
    const lap = actor('laporte', e.x, e.y, { speed: 120, keep: true, mane: 1 });
    G.ebullets = []; G.hazards = [];
    runCut([
      { wait: 0.8 },
      { say: S.finale1 },
      { anim: (k) => {
        lap.mane = 1 - k;
        G.psy = 1 - k;
        if (Math.random() < 0.6) G.particles.push({ x: lap.x + rand(-30, 30), y: lap.y - 40 + rand(-20, 10), vx: rand(-40, 40), vy: rand(10, 60), life: 2, max: 2, color: pick(['#ffd23f', '#fff4a8', '#d38b12']), size: rand(3, 6), fall: true });
      }, dur: 3 },
      { do: () => { lap.mane = 0; lap.bald = true; G.psy = 0; sfx.wrong(); } },
      { say: S.finale2 },
      { do: () => { G.room.cleared = true; G.room.holdLock = false; G.locked = false; } },
    ], () => { G.run.won = true; later(0.3, () => showEnd(true)); });
  }

  // ================= floors & saving =================
  function snapshot() {
    const run = G.run;
    const data = {};
    for (const k of Object.keys(run)) if (!['rooms', 'cur', 'boss', 'theme'].includes(k)) data[k] = run[k];
    return JSON.parse(JSON.stringify(data));
  }
  function saveRun() {
    G.floorSave = snapshot();
    store.set(SAVEKEY, { v: 1, when: Date.now(), run: G.floorSave });
  }
  function restoreRun(data) {
    const run = Object.assign(newRunState(), data);
    run.player = Object.assign(newPlayer(), data.player);
    run.player.inv = 0; run.player.dashT = 0; run.player.fireT = 0;
    if (run.player.hp <= 0) run.player.hp = run.player.maxHp;
    run.pets = (data.pets || []).map((pt) => ({ type: pt.type, name: pt.name, x: 0, y: 0, cd: 1, t: 0 }));
    return run;
  }
  function goDownstairs() {
    const run = G.run;
    G.fade = 0.6;
    sfx.door();
    const next = run.floor + 1;
    newFloor(next);
    saveRun();
    startTalk(S.floorIntro[next - 1]);
  }

  // ================= update =================
  function updateWorldFx(dt) {
    G.t += dt;
    if (G.run && G.room) updateCamera(dt);
    if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
    if (G.bark) { G.bark.t -= dt; G.bark.age += dt; if (G.bark.t <= 0) G.bark = null; }
    if (G.fade > 0) G.fade -= dt;
    if (G.flash > 0) G.flash -= dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
    updateAmbient(dt);
    updateParticles(dt);
    if (G.zoom > 0) G.zoom = Math.max(0, G.zoom - dt * 0.35);
    for (const r of G.vfxRings) r.t += dt;
    G.vfxRings = G.vfxRings.filter((r) => r.t < r.max);
    for (const b of G.bolts) b.life -= dt;
    G.bolts = G.bolts.filter((b) => b.life > 0);
  }
  function update(dt) {
    const run = G.run, p = run.player;
    run.playTime += dt;
    if (G.deathT > 0) {
      G.deathT -= dt;
      if (G.deathT <= 0) showEnd(false);
      return;
    }
    if (pressed.Escape || pressed.KeyP) return pauseGame();
    if (pressed.KeyM) { settings.sound = !settings.sound; saveSettings(); floatText(p.x, p.y - 30, settings.sound ? 'Sound on' : 'Sound off'); }
    if (DEBUG) debugKeys();

    // timers (boss attack patterns etc.)
    for (const tm of G.timers) { tm.t -= dt; if (tm.t <= 0 && !tm.done) { tm.done = true; tm.fn(); } }
    G.timers = G.timers.filter((tm) => !tm.done);
    if (G.mode !== 'play') return;

    const roomBefore = G.room;
    updatePlayer(dt);
    if (G.room !== roomBefore) return;
    updatePets(dt);
    updateActors(dt);
    updateStampede(dt);

    G.hint = nearestObject();
    if (G.hint && (pressed.KeyE || pressed.Enter)) { interact(G.hint); return; }

    for (const e of G.enemies) updateEnemy(e, dt);
    for (let i = 0; i < G.enemies.length; i++) for (let j = i + 1; j < G.enemies.length; j++) {
      const a = G.enemies[i], b = G.enemies[j];
      if (a.escorted || b.escorted) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
      if (d > 0 && d < m) {
        const push = (m - d) / 2, ux = dx / d, uy = dy / d;
        if (a.kind !== 'boss' && a.kind !== 'eye') moveEnt(a, -ux * push, -uy * push, a.kind === 'ghost' ? 'fly' : 'walk');
        if (b.kind !== 'boss' && b.kind !== 'eye') moveEnt(b, ux * push, uy * push, b.kind === 'ghost' ? 'fly' : 'walk');
      }
    }
    for (const e of G.enemies) {
      if (e.spawn > 0 || e.dead || e.escorted) continue;
      if (e.kind === 'ghost' && e.alpha < 0.45) continue;
      if (e.kind === 'boss' && e.alpha < 0.5) continue;
      if (dist(e, p) < e.r + p.r * 0.7) {
        hurtPlayer('touch:' + e.kind);
        if (e.kind !== 'boss' && e.kind !== 'eye') {
          const d = dist(e, p) || 1;
          e.kx = ((e.x - p.x) / d) * 420; e.ky = ((e.y - p.y) / d) * 420;
          if (e.state === 'charge') { e.state = 'stun'; e.st = 0.8; }
        }
      }
    }

    // player bullets
    for (const b of G.pbullets) {
      if (b.boom) {
        b.age += dt;
        const k = b.age / b.max;
        const s = Math.sin(Math.PI * Math.min(1, k)) * p.shotSpeed * p.range * 0.55;
        const lat = 70 * Math.exp(-((k - 0.5) ** 2) / 0.03) * b.side;
        const ux = Math.cos(b.ang), uy = Math.sin(b.ang);
        const nx = p.x + ux * s - uy * lat, ny = p.y - 6 + uy * s + ux * lat;
        b.vx = (nx - b.x) / dt; b.vy = (ny - b.y) / dt;
        b.x = nx; b.y = ny;
        if (k > 0.5 && !b.reset) { b.reset = true; b.hit = new Set(); }
        b.life -= dt;
        if (b.life <= 0) { b.dead = true; continue; }
      } else {
        if (p.homing && !b.pet && G.enemies.length) {
          let best = null, bd = 280;
          for (const e of G.enemies) { const d = dist(e, b); if (d < bd && !e.dead && e.spawn <= 0) { bd = d; best = e; } }
          if (best) {
            const sp = Math.hypot(b.vx, b.vy);
            const want = Math.atan2(best.y - b.y, best.x - b.x);
            let cur = Math.atan2(b.vy, b.vx);
            const diff = ((want - cur + Math.PI * 3) % TAU) - Math.PI;
            cur += clamp(diff, -1, 1) * Math.min(1, dt * 3);
            b.vx = Math.cos(cur) * sp; b.vy = Math.sin(cur) * sp;
          }
        }
        const ox = b.x, oy = b.y;
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.life -= dt;
        if (pointSolid(b.x, b.y, 'shot')) {
          const rm = G.room, tc = Math.floor(b.x / T), tr = Math.floor(b.y / T);
          if (rm.secretDir && !rm.secretOpen && !b.pet && gapTiles(rm.secretDir).some(([c, r]) => c === tc && r === tr)) { b.dead = true; hitSecretWall(rm, ox, oy); continue; }
          if (b.bounces > 0) {
            b.bounces--;
            if (pointSolid(b.x, oy, 'shot')) b.vx = -b.vx;
            if (pointSolid(ox, b.y, 'shot')) b.vy = -b.vy;
            b.x = ox; b.y = oy;
          } else { b.dead = true; spark(ox, oy, b.color); if (b.pod) podBurst(b); continue; }
        }
        if (b.life <= 0) { b.dead = true; if (b.pod) podBurst(b); continue; }
      }
      for (const e of G.enemies) {
        if (e.dead || e.spawn > 0 || b.hit.has(e) || e.escorted) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
          const sp = Math.hypot(b.vx, b.vy) || 1;
          damageEnemy(e, b.dmg, b.vx / sp, b.vy / sp);
          spark(b.x, b.y, b.color);
          b.hit.add(e);
          if (p.zapper && !b.pet) zapFrom(b, e, b.dmg);
          if (b.pod) podBurst(b, e);
          if (!b.pierce || b.pod) { b.dead = true; break; }
        }
      }
      if (!b.dead && !b.pet) {
        for (const o of G.room.objects) {
          if (o.kind === 'flag' && !o.used && Math.hypot(o.x - b.x, o.y - b.y) < o.r + b.r) { b.dead = true; flagHit(o); break; }
        }
      }
    }
    // σ orbitals
    if (p.orbitals) {
      for (let i = 0; i < 3; i++) {
        const R = 46 + i * 30, a = G.t * (2.6 - i * 0.6) * (i % 2 ? -1 : 1) + i;
        const ox = p.x + Math.cos(a) * R, oy = p.y + Math.sin(a) * R * 0.8;
        for (const e of G.enemies) {
          if (e.dead || e.spawn > 0 || e.escorted) continue;
          if (Math.hypot(e.x - ox, e.y - oy) < e.r + 10 && (!e['orb' + i] || G.t - e['orb' + i] > 0.35)) { e['orb' + i] = G.t; damageEnemy(e, 0.6 + p.damage * 0.4, Math.cos(a), Math.sin(a)); }
        }
        for (const b of G.ebullets) if (Math.hypot(b.x - ox, b.y - oy) < b.r + 10) { b.dead = true; spark(b.x, b.y, '#fff3b0'); }
      }
    }
    // empirical aura pulses
    if (G.pulses) {
      for (const pu of G.pulses) {
        pu.t += dt;
        const radii = [68, 95, 99.7].map((v) => v * 1.5 * Math.min(1, pu.t / 0.45));
        radii.forEach((R, k) => {
          for (const e of G.enemies) {
            if (e.dead || e.spawn > 0 || pu.hit[k].has(e)) continue;
            if (Math.abs(dist(e, pu) - R) < e.r + 8) { pu.hit[k].add(e); damageEnemy(e, 0.8 + p.damage * 0.5, 0, 0); }
          }
        });
      }
      G.pulses = G.pulses.filter((pu) => pu.t < 0.7);
    }
    if (G.zaps) { for (const z of G.zaps) z.life -= dt; G.zaps = G.zaps.filter((z) => z.life > 0); }
    updateSpecials(dt);
    // enemy bullets
    for (const b of G.ebullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || (pointSolid(b.x, b.y, 'shot') && !(b.dot && b.y < T * 1.2))) { b.dead = true; continue; }
      if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r * 0.55) {
        b.dead = true;
        if (b.web) { if (p.dashT <= 0) { p.webbed = 2; floatText(p.x, p.y - 30, 'Webbed! (slowed)', '#e8e4ff', 1.2); } }
        else hurtPlayer('shot:' + (b.src || '?'));
      }
    }
    // hazards
    for (const h of G.hazards) {
      h.t += dt;
      if (h.t > h.warn && h.t < h.warn + h.active && hazardHits(h, p)) hurtPlayer('hazard');
      if (h.t > h.warn && !h.boomed && h.active > 0) { h.boomed = true; if (h.kind === 'rect') { G.shake = Math.max(G.shake, 6); sfx.zap(); } else sfx.zap(); }
    }
    G.hazards = G.hazards.filter((h) => h.t < h.warn + h.active + 0.05);
    G.pbullets = G.pbullets.filter((b) => !b.dead);
    G.ebullets = G.ebullets.filter((b) => !b.dead);
    G.enemies = G.enemies.filter((e) => !e.dead);

    // sometimes the last little monster in a room gives up and wants to join you
    if (G.locked && G.enemies.length === 1 && !G.room.surrenderChecked) {
      G.room.surrenderChecked = true;
      const e = G.enemies[0];
      const nPets = run.pets.filter((pt) => pt.type === 'slime' || pt.type === 'ghost').length;
      if ((e.kind === 'slime' || e.kind === 'ghost') && nPets < 2 && Math.random() < (e.kind === 'ghost' ? 0.6 : 0.4)) { surrender(e); G.enemies = []; }
    }
    if (G.locked && G.enemies.length === 0 && G.room.type !== 'boss') roomCleared();
    if (G.locked && G.enemies.length === 0 && G.room.type === 'boss' && !G.cut && !G.room.holdLock) { G.room.cleared = true; G.locked = false; }

    // pickups
    const room = G.room;
    for (const k of room.pickups) {
      k.t += dt;
      const d = dist(k, p);
      if ((p.magnet && d < 650) || d < 70) {
        if (!(k.kind === 'heart' && p.hp >= p.maxHp)) {
          const pull = p.magnet ? 520 : 300;
          k.vx += ((p.x - k.x) / d) * pull * dt * 4; k.vy += ((p.y - k.y) / d) * pull * dt * 4;
        }
      }
      k.x += k.vx * dt; k.y += k.vy * dt;
      k.vx *= 0.9; k.vy *= 0.9;
      k.x = clamp(k.x, T + 8, RW - T - 8); k.y = clamp(k.y, T + 8, RH - T - 8);
      if (d < p.r + 14 && k.t > 0.25) {
        if (k.kind === 'coin') { run.gold += p.goldMult; k.dead = true; sfx.coin(); floatText(k.x, k.y - 10, '+' + p.goldMult, '#ffd966', 0.6); }
        if (k.kind === 'heart' && p.hp < p.maxHp) { p.hp = Math.min(p.maxHp, p.hp + 1); k.dead = true; sfx.heart(); floatText(k.x, k.y - 10, '+1 ♥', '#ff6b8a'); }
        if (k.kind === 'edamame') { k.dead = true; gainEdamame(1); }
      }
    }
    room.pickups = room.pickups.filter((k) => !k.dead);
    for (const o of room.objects) {
      if (o.pop > 0) o.pop -= dt;
      if (o.sayT > 0) o.sayT -= dt;
      if (o.t != null) o.t += dt;
      if (o.fleeing) updateMimic(o, dt);
      if (o.kind === 'hat' && !o.used && dist(o, p) < o.r + p.r + 4) {
        o.used = true;
        run.hats.push(o.hat);
        sfx.item();
        burst(o.x, o.y, '#ffe27a', 24, 200);
        floatText(p.x, p.y - 60, S.hats[o.hat].name + '!', '#ffe27a', 2.4);
        floatText(p.x, p.y - 36, '(Purely cosmetic. Extremely important.)', '#dddddd', 2.6);
      }
    }
    room.objects = room.objects.filter((o) => !(o.kind === 'hat' && o.used));
  }
  function playerBeam(x, y, ang, dmg) {
    const x2 = x + Math.cos(ang) * 1500, y2 = y + Math.sin(ang) * 1500;
    G.beams.push({ x1: x, y1: y, x2, y2, life: 0.3 });
    sfx.zap();
    for (const e of G.enemies) {
      if (e.dead || e.spawn > 0 || e.escorted) continue;
      const dx = x2 - x, dy = y2 - y, L = dx * dx + dy * dy;
      const u = clamp(((e.x - x) * dx + (e.y - y) * dy) / L, 0, 1);
      if (Math.hypot(e.x - (x + dx * u), e.y - (y + dy * u)) < e.r + 14) damageEnemy(e, dmg, 0, 0);
    }
  }
  function explode(x, y, R, dmg, color) {
    burst(x, y, color, 26, 300); burst(x, y, '#fff3b0', 10, 200);
    G.vfxRings.push({ x, y, t: 0, max: 0.35, R, color });
    G.shake = Math.max(G.shake, 4);
    for (const e of G.enemies) if (!e.dead && e.spawn <= 0 && !e.escorted && dist(e, { x, y }) < R + e.r) damageEnemy(e, dmg, 0, 0);
    sfx.kill();
  }
  function updateSpecials(dt) {
    const p = G.run.player;
    for (const b of G.beams) b.life -= dt;
    G.beams = G.beams.filter((b) => b.life > 0);
    for (const c of G.clones) c.life -= dt;
    G.clones = G.clones.filter((c) => c.life > 0);
    for (const s of G.stamps) s.life -= dt;
    G.stamps = G.stamps.filter((s) => s.life > 0);
    // random walk rockets
    for (const r of G.rockets) {
      r.life -= dt; r.turn -= dt;
      if (r.turn <= 0) { r.turn = 0.12; r.a += gauss() * 0.7; }
      r.x += Math.cos(r.a) * 330 * dt; r.y += Math.sin(r.a) * 330 * dt;
      if (Math.random() < 0.7) G.particles.push({ x: r.x, y: r.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.4, max: 0.4, color: 'rgba(200,200,210,0.8)', size: 5 });
      const hitE = G.enemies.find((e) => !e.dead && e.spawn <= 0 && !e.escorted && dist(e, r) < e.r + 8);
      if (hitE || r.life <= 0 || pointSolid(r.x, r.y, 'shot')) { r.dead = true; explode(r.x, r.y, 75, 1.5 + p.damage * 1.2, '#ff9f43'); }
    }
    G.rockets = G.rockets.filter((r) => !r.dead);
    // chalk trail
    for (const c of G.chalk) c.life -= dt;
    G.chalk = G.chalk.filter((c) => c.life > 0);
    G.chalkTick = (G.chalkTick || 0) - dt;
    if (G.chalkTick <= 0 && G.chalk.length) {
      G.chalkTick = 0.25;
      for (const e of G.enemies) {
        if (e.dead || e.spawn > 0 || e.escorted || e.kind === 'bat') continue;
        if (G.chalk.some((c) => Math.abs(c.x - e.x) < e.r + 10 && Math.abs(c.y - e.y) < e.r + 10)) damageEnemy(e, 0.35 + p.damage * 0.25, 0, 0);
      }
    }
    // pie chart buzzsaws
    for (const sw of G.saws) {
      sw.t += dt; sw.spin += dt * 16;
      const k = sw.t / 1.3;
      if (k < 0.5) { const sp = 520 * (1 - k * 2) + 60; sw.x += Math.cos(sw.a) * sp * dt; sw.y += Math.sin(sw.a) * sp * dt; }
      else { if (!sw.back) { sw.back = true; sw.hit = new Set(); } const a = Math.atan2(p.y - sw.y, p.x - sw.x); sw.x += Math.cos(a) * 560 * dt; sw.y += Math.sin(a) * 560 * dt; if (dist(sw, p) < 24) sw.dead = true; }
      if (sw.t > 2.6) sw.dead = true;
      for (const e of G.enemies) if (!e.dead && e.spawn <= 0 && !e.escorted && !sw.hit.has(e) && dist(e, sw) < e.r + 22) { sw.hit.add(e); damageEnemy(e, 1.5 * p.damage + 0.5, Math.cos(sw.a), Math.sin(sw.a)); spark(sw.x, sw.y, '#ffd23f'); }
    }
    G.saws = G.saws.filter((sw) => !sw.dead);
    // normal nova shockwaves
    for (const n of G.novas) {
      n.t += dt;
      const R = 280 * Math.min(1, n.t / 0.6);
      for (const e of G.enemies) {
        if (e.dead || e.spawn > 0 || e.escorted || n.hit.has(e)) continue;
        if (dist(e, n) < R + e.r) { n.hit.add(e); const d = dist(e, n) || 1; damageEnemy(e, 2 + p.damage * 1.5, (e.x - n.x) / d, (e.y - n.y) / d); if (e.kind !== 'boss') { e.kx = ((e.x - n.x) / d) * 600; e.ky = ((e.y - n.y) / d) * 600; } }
      }
      for (const b of G.ebullets) if (dist(b, n) < R) b.dead = true;
    }
    G.novas = G.novas.filter((n) => n.t < 0.75);
  }

  function podBurst(b, hitE) {
    if (b.burst) return;
    b.burst = true;
    const a0 = Math.atan2(b.vy, b.vx);
    for (let i = -1; i <= 1; i++) {
      const a = a0 + i * 0.55;
      const nb = { x: b.x, y: b.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, r: 5, dmg: b.dmg * 0.45, life: 0.35, hit: new Set(), color: '#9be36b', bean: true, bounces: 0 };
      if (hitE) nb.hit.add(hitE);
      G.pbullets.push(nb);
    }
  }
  function updateParticles(dt) {
    for (const q of G.particles) {
      q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
      if (q.fall) q.vy += 120 * dt; else { q.vx *= 0.92; q.vy *= 0.92; }
    }
    G.particles = G.particles.filter((q) => q.life > 0);
    if (G.particles.length > 500) G.particles.splice(0, G.particles.length - 500);
    for (const t of G.texts) { t.y -= 22 * dt; t.life -= dt; }
    G.texts = G.texts.filter((t) => t.life > 0);
  }
  function updateAmbient(dt) {
    const th = G.room && G.room.type === 'lounge' ? 'steam' : G.run && G.run.theme ? G.run.theme.ambient : 'dust';
    if (G.ambientKind !== th) { G.ambientKind = th; G.ambient = []; }
    while (G.ambient.length < 34) G.ambient.push({ x: rand(0, RW), y: rand(0, RH), s: rand(0.5, 1.5), ph: rand(0, TAU), life: rand(3, 8) });
    for (const a of G.ambient) {
      a.ph += dt; a.life -= dt;
      if (th === 'sand') { a.x += 90 * a.s * dt; a.y += Math.sin(a.ph * 2) * 10 * dt; }
      else if (th === 'firefly') { a.x += Math.cos(a.ph * 0.7) * 20 * dt; a.y += Math.sin(a.ph * 0.9) * 16 * dt; }
      else if (th === 'note' || th === 'ember' || th === 'steam') { a.y -= 26 * a.s * dt; a.x += Math.sin(a.ph) * 10 * dt; }
      else { a.y += 6 * a.s * dt; a.x += Math.sin(a.ph * 0.5) * 6 * dt; }
      if (a.x > RW) a.x -= RW;
      if (a.y < 0) a.y += RH;
    }
    G.ambient = G.ambient.filter((a) => a.life > 0);
  }

  function checkSecretCodes() {
    const s = typed.join('');
    if (s.endsWith('EDAMAME')) {
      typed.length = 0;
      if (G.mode === 'play' && G.run && !G.run.flags.edamameCode) {
        G.run.flags.edamameCode = true;
        const need = Math.max(1, 5 - G.run.edamame);
        gainEdamame(need);
        bark({ t: S.edamameCode, e: 'shocked' }, null, 4);
      } else if (G.mode === 'title') { G.startWithEdamame = true; $('save-note').textContent = '🫛 Secret unlocked: you will start with the Edamame Bean Blaster!'; sfx.item(); }
    }
    if (s.endsWith('LAPORTE') && G.mode === 'play') { typed.length = 0; bark(pick(S.youRang), 'happy', 3); }
  }

  // ================= drawing =================
  const FONT = (w, s) => `${w} ${s}px Nunito, system-ui, sans-serif`;
  const PIX = (s) => `${s}px "Press Start 2P", monospace`;
  const rr = (x, y, w, h, r) => A.rrect(ctx, x, y, w, h, r);
  function textOut(str, x, y, color, font, align, outline) {
    ctx.font = font; ctx.textAlign = align || 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = outline || 'rgba(8,6,16,0.9)'; ctx.lineWidth = 4; ctx.strokeText(str, x, y);
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function wrapLines(text, maxW, font) {
    ctx.font = font;
    const words = text.split(' '), lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  const HATS_EMOJI = () => S.hats.map((h) => h.emoji);
  function drawHats(x, y) {
    const hats = G.run.hats;
    const shown = hats.slice(-3);
    ctx.font = '18px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif';
    ctx.textAlign = 'center';
    shown.forEach((h, i) => {
      ctx.save(); ctx.translate(x + (i - (shown.length - 1) / 2) * 5, y - i * 6); ctx.rotate((i - 1) * 0.15);
      ctx.fillText(HATS_EMOJI()[h], 0, 0); ctx.restore();
    });
    if (hats.length > 3) textOut('+' + (hats.length - 3), x + 18, y - 10, '#ffe27a', FONT(900, 12));
  }
  function drawPlayer(p) {
    if (p.inv > 0 && Math.floor(p.inv * 12) % 2) return;
    A.shadow(ctx, p.x, p.y + 18, 15, 6);
    if (p.protein > 0) A.glow(ctx, p.x, p.y, 46, 'rgba(155,227,107,1)', 0.35 + Math.sin(G.t * 10) * 0.1);
    const back = p.faceY < -0.4;
    const frame = p.moving ? [1, 0, 2, 0][Math.floor(p.walkT * 9) % 4] : 0;
    const bob = p.moving && frame !== 0 ? -2 : 0;
    const spr = A.heroSprite(back, frame, G.run.hero);
    for (const c of G.clones) {
      ctx.save(); ctx.globalAlpha = 0.45 * Math.min(1, c.life * 2);
      A.glow(ctx, p.x + c.dx, p.y + c.dy, 30, 'rgba(199,166,255,1)', 0.5);
      A.blit(ctx, spr, p.x + c.dx, p.y + c.dy + bob, p.faceX < -0.2 && !back);
      ctx.restore();
    }
    if (p.webbed > 0) { ctx.strokeStyle = 'rgba(232,228,255,0.7)'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(i) * 22, p.y + Math.sin(i) * 22); ctx.stroke(); } }
    A.blit(ctx, spr, p.x, p.y + bob, p.faceX < -0.2 && !back);
    // the glowing calculator-wand
    const wx = p.x + p.faceX * 20, wy = p.y + 2 + p.faceY * 12;
    A.glow(ctx, wx, wy, 16, p.redPen ? 'rgba(255,60,60,1)' : 'rgba(127,230,212,1)', 0.6);
    ctx.fillStyle = A.OUTLINE; ctx.fillRect(wx - 5, wy - 6, 10, 12);
    ctx.fillStyle = '#3a3f55'; ctx.fillRect(wx - 3, wy - 4, 6, 8);
    ctx.fillStyle = p.redPen ? '#ff6b6b' : '#7fe6d4'; ctx.fillRect(wx - 2, wy - 3, 4, 2);
    if (G.run.hats.length) drawHats(p.x, p.y - 26 + bob);
    if (p.boxShield && p.shieldReady) {
      ctx.strokeStyle = 'rgba(154,216,255,0.6)'; ctx.lineWidth = 2;
      ctx.strokeRect(p.x - 22, p.y - 26, 44, 50); ctx.beginPath(); ctx.moveTo(p.x - 22, p.y); ctx.lineTo(p.x + 22, p.y); ctx.stroke();
    }
    if (p.orbitals) {
      for (let i = 0; i < 3; i++) {
        const R = 46 + i * 30, a = G.t * (2.6 - i * 0.6) * (i % 2 ? -1 : 1) + i;
        const ox = p.x + Math.cos(a) * R, oy = p.y + Math.sin(a) * R * 0.8;
        A.glow(ctx, ox, oy, 22, ['rgba(255,210,63,1)', 'rgba(255,159,67,1)', 'rgba(255,95,109,1)'][i], 0.6);
        ctx.fillStyle = ['#ffd23f', '#ff9f43', '#ff5f6d'][i]; ctx.beginPath(); ctx.arc(ox, oy, 8, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = FONT(900, 10); ctx.textAlign = 'center'; ctx.fillText((i + 1) + 'σ', ox, oy + 4);
      }
    }
  }
  function drawPet(pt) {
    const bob = Math.sin(pt.t * 5) * 3;
    A.shadow(ctx, pt.x, pt.y + 14, 10, 4);
    if (pt.type === 'slime') A.blit(ctx, A.slimeSprite('#7dffb0', Math.floor(pt.t * 4) % 3), pt.x, pt.y + bob * 0.5);
    else if (pt.type === 'ghost') A.blit(ctx, A.ghostSprite('#c9a7ff', Math.floor(pt.t * 3) % 2), pt.x, pt.y + bob, false, 0.85);
    else if (pt.type === 'eddie') {
      const k = Math.floor(pt.t * 6) % 2;
      ctx.fillStyle = '#5f6b25'; ctx.fillRect(pt.x - 8 + k * 2, pt.y + 10 + bob, 3, 5); ctx.fillRect(pt.x + 5 - k * 2, pt.y + 10 + bob, 3, 5);
      ctx.save(); ctx.translate(pt.x, pt.y + bob); ctx.scale(1.4, 1.4); A.blit(ctx, A.edamameSprite(), 0, 0); ctx.restore();
      ctx.fillStyle = '#fff'; ctx.fillRect(pt.x - 7, pt.y - 4 + bob, 5, 5); ctx.fillRect(pt.x + 2, pt.y - 4 + bob, 5, 5);
      ctx.fillStyle = '#111'; ctx.fillRect(pt.x - 5, pt.y - 2 + bob, 2, 3); ctx.fillRect(pt.x + 4, pt.y - 2 + bob, 2, 3);
    } else if (pt.type === 'sub') {
      A.blit(ctx, A.subSprite(), pt.x, pt.y + bob * 0.4);
      if (pt.age < 5) textOut('Mr. Substitute', pt.x, pt.y - 44, '#ffffff', FONT(900, 12));
    } else if (pt.type === 'drone') {
      A.glow(ctx, pt.x, pt.y, 26, 'rgba(127,230,255,1)', 0.4);
      ctx.fillStyle = A.OUTLINE; rr(pt.x - 15, pt.y - 7 + bob, 30, 14, 6); ctx.fill();
      ctx.fillStyle = '#9aa3ad'; rr(pt.x - 13, pt.y - 5 + bob, 26, 10, 5); ctx.fill();
      ctx.fillStyle = '#7fe6ff'; ctx.fillRect(pt.x - 4, pt.y - 3 + bob, 8, 5);
      ctx.fillStyle = 'rgba(220,240,255,0.7)'; ctx.fillRect(pt.x - 18 + Math.sin(G.t * 40) * 4, pt.y - 10 + bob, 10, 2); ctx.fillRect(pt.x + 8 - Math.sin(G.t * 40) * 4, pt.y - 10 + bob, 10, 2);
    }
    if (pt.name && pt.age < 5 && pt.type !== 'sub') {
      ctx.font = FONT(800, 12); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(pt.name, pt.x, pt.y - 22);
    }
  }
  // opts: { ghost: tint color for an afterimage, flash: draw as a white silhouette }
  function drawLaporte(a, opts) {
    const o = opts || {};
    const scale = a.scale || 1;
    const frame = a.moving ? [1, 0, 2, 0][Math.floor(a.walkT * (a.speed > 300 ? 16 : 9)) % 4] : 0;
    if (!o.ghost) {
      A.shadow(ctx, a.x, a.y + 38 * scale, 20 * scale, 7 * scale);
      if (a.mane > 0) {
        const hue = Math.round(((G.t * 200) % 360) / 15) * 15;
        A.glow(ctx, a.x, a.y - 10, 90 * scale * a.mane, `hsl(${hue},100%,60%)`, 0.55 * a.mane);
        A.glow(ctx, a.x, a.y - 10, 50 * scale * a.mane, 'rgba(255,230,120,1)', 0.6 * a.mane);
      }
    }
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.scale(scale * (a.face < 0 ? -1 : 1), scale);
    ctx.imageSmoothingEnabled = false;
    const bob = a.moving && frame ? -2 : 0;
    if (a.mane >= 1) {
      // the full mane is pre-rendered (much faster than drawing every spike every frame)
      let img = A.laporteManeSprite(frame, Math.floor(G.t * 8) % 6, o.ghost || null);
      if (o.flash) img = A.whiteOf(img);
      ctx.drawImage(img, -A.MANE_CX, -A.MANE_CY + bob);
    } else {
      let spr = A.laporteSprite(frame, a.bald);
      if (o.flash) spr = A.whiteOf(spr);
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2 + bob);
      if (a.mane > 0) A.drawManeSprite(ctx, 0, -27, G.t, a.mane);
    }
    ctx.restore();
  }
  function maneSparkles(x, y, scale, dt) {
    if (Math.random() < dt * 30) G.particles.push({ x: x + rand(-30, 30) * scale, y: y + rand(-40, 30) * scale, vx: 0, vy: -rand(40, 120), life: 0.5, max: 0.5, color: pick(['#ffd23f', '#fff4a8', '#ff7ae0', '#7fe6ff']), size: rand(2, 5) });
  }
  function drawActor(a) {
    if (a.kind === 'laporte') return drawLaporte(a);
    if (a.kind === 'freshman') {
      const frame = Math.floor(a.walkT * 12) % 2;
      A.shadow(ctx, a.x, a.y + 18, 12, 4);
      A.blit(ctx, A.freshmanSprite(a.look, frame), a.x, a.y + (frame ? -2 : 0), a.face < 0);
      if (a.phone) { ctx.fillStyle = A.OUTLINE; ctx.fillRect(a.x + (a.face < 0 ? -16 : 8), a.y - 2, 8, 11); ctx.fillStyle = Math.floor(G.t * 8 + a.look) % 2 ? '#5dade2' : '#aed6f1'; ctx.fillRect(a.x + (a.face < 0 ? -14 : 10), a.y, 4, 7); }
      if (a.say) {
        ctx.font = FONT(900, 13); const w = ctx.measureText(a.say).width + 12;
        ctx.fillStyle = 'rgba(255,255,255,0.95)'; rr(a.x - w / 2, a.y - 44, w, 20, 6); ctx.fill();
        ctx.fillStyle = '#1b1430'; ctx.textAlign = 'center'; ctx.fillText(a.say, a.x, a.y - 29);
      }
      return;
    }
    if (a.kind === 'guard') {
      const frame = a.moving ? [1, 0, 2, 0][Math.floor(a.walkT * 9) % 4] : 0;
      A.shadow(ctx, a.x, a.y + 20, 14, 5);
      A.blit(ctx, A.guardSprite(frame), a.x, a.y + (a.moving && frame ? -2 : 0), a.face < 0);
    }
  }
  function drawEnemy(e) {
    let alpha = e.spawn > 0 ? Math.max(0.15, 1 - e.spawn / 0.7) : 1;
    if (e.kind === 'ghost') alpha *= e.alpha;
    if (e.kind === 'boss') return drawBoss(e);
    ctx.save();
    ctx.globalAlpha = alpha;
    const bob = Math.sin(e.t * 4) * 2;
    if (e.kind !== 'bat' && e.kind !== 'ghost') A.shadow(ctx, e.x, e.y + e.r * 0.85, e.r * 0.9, e.r * 0.35);
    else A.shadow(ctx, e.x, e.y + e.r + 12, e.r * 0.7, e.r * 0.25, 0.25);
    let spr = null, flip = false, sc = 1;
    switch (e.kind) {
      case 'slime': spr = A.slimeSprite(e.color, e.squash > 0.6 ? 0 : e.squash > 0.2 ? 1 : 2); break;
      case 'bigslime': spr = A.slimeSprite(e.color, e.squash > 0.6 ? 0 : e.squash > 0.2 ? 1 : 2); sc = 1.5; break;
      case 'bat': spr = A.batSprite(e.color, Math.floor(e.t * 10) % 2); break;
      case 'ghost': spr = A.ghostSprite(e.color, Math.floor(e.t * 3) % 2); break;
      case 'archer': spr = A.archerSprite(Math.floor(e.t * 5) % 2, e.aim); flip = G.run.player.x < e.x; break;
      case 'boar': spr = A.boarSprite(e.color, e.state === 'charge' ? Math.floor(e.t * 12) % 2 : Math.floor(e.t * 4) % 2); flip = (e.state === 'charge' ? e.cx : G.run.player.x - e.x) > 0; break;
      case 'eye': spr = A.eyeSprite(e.color); break;
      case 'knight': spr = A.knightSprite(e.color, Math.floor(e.t * 5) % 2); flip = Math.cos(e.facing) < 0; break;
      case 'spider': spr = A.spiderSprite(e.color, Math.floor(e.t * 10) % 2); break;
      case 'wraith': spr = A.ghostSprite(e.color, Math.floor(e.t * 3) % 2); break;
      case 'bomber': spr = A.bosses.bell(e.ringT > 0 ? Math.floor(e.t * 12) % 2 : 0, e.ringT > 0 && Math.floor(e.t * 10) % 2 === 0); sc = 0.34; break;
    }
    const yy = e.y + (e.kind === 'bat' || e.kind === 'ghost' || e.kind === 'eye' ? bob : 0);
    ctx.translate(e.x, yy);
    if (e.escorted) ctx.rotate(Math.sin(G.t * 10) * 0.15);
    ctx.scale(sc, sc);
    if (e.kind === 'wraith') ctx.transform(1, 0, Math.sin(e.t * 2) * 0.45, 1, 0, 0); // skewed!
    if (e.kind === 'bomber' && e.ringT > 0) ctx.rotate(Math.sin(e.t * 40) * 0.25);
    if (spr) { const img = e.flash > 0 ? A.whiteOf(spr) : spr; ctx.imageSmoothingEnabled = false; ctx.save(); if (flip) ctx.scale(-1, 1); ctx.drawImage(img, -spr.width / 2, -spr.height / 2); ctx.restore(); }
    if (e.kind === 'dice') {
      const rot = e.state === 'roll' ? e.spin : 0;
      ctx.save(); ctx.rotate(rot);
      ctx.fillStyle = A.OUTLINE; rr(-17, -17, 34, 34, 7); ctx.fill();
      ctx.fillStyle = e.flash > 0 ? '#fff' : '#f4f4f4'; rr(-15, -15, 30, 30, 6); ctx.fill();
      ctx.fillStyle = '#d8d8e4'; ctx.fillRect(-15, 8, 30, 7);
      const face = e.state === 'roll' ? 1 + (Math.floor(e.spin * 2) % 6) : e.face;
      const P = { 1: [[0, 0]], 2: [[-7, -7], [7, 7]], 3: [[-8, -8], [0, 0], [8, 8]], 4: [[-7, -7], [7, -7], [-7, 7], [7, 7]], 5: [[-8, -8], [8, -8], [0, 0], [-8, 8], [8, 8]], 6: [[-7, -9], [7, -9], [-7, 0], [7, 0], [-7, 9], [7, 9]] }[face];
      ctx.fillStyle = face === 1 ? '#e74c3c' : '#1b1430';
      for (const [px, py] of P) { ctx.beginPath(); ctx.arc(px, py, face === 1 ? 5 : 3.2, 0, TAU); ctx.fill(); }
      ctx.restore();
      if (e.state === 'land') textOut(String(e.face), 0, -26, '#ffd23f', FONT(900, 18));
    }
    if (e.kind === 'knight') {
      // the box-plot shield (box + whiskers) on the side facing you
      ctx.save(); ctx.rotate(e.facing);
      ctx.fillStyle = A.OUTLINE; ctx.fillRect(14, -17, 9, 34);
      ctx.fillStyle = '#9ad8ff'; ctx.fillRect(16, -15, 5, 30);
      ctx.fillStyle = '#1b4a7a'; ctx.fillRect(16, -2, 5, 3);
      ctx.strokeStyle = '#d8f0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(18.5, -15); ctx.lineTo(18.5, -24); ctx.moveTo(15, -24); ctx.lineTo(22, -24); ctx.moveTo(18.5, 15); ctx.lineTo(18.5, 24); ctx.moveTo(15, 24); ctx.lineTo(22, 24); ctx.stroke();
      ctx.restore();
    }
    if (e.kind === 'spider') textOut('σ', 0, 8, '#ffd23f', FONT(900, 14));
    if (e.kind === 'bomber') { ctx.fillStyle = '#ffd23f'; ctx.fillRect(-1, -30, 2, 8); if (e.ringT > 0 || Math.floor(e.t * 4) % 2) { ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.arc(0, -32, 3, 0, TAU); ctx.fill(); } }
    if (e.kind === 'eye') {
      const p = G.run.player, a = Math.atan2(p.y - e.y, p.x - e.x);
      const ix = Math.cos(a) * 7, iy = Math.sin(a) * 7;
      ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(ix, iy, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(ix * 1.2, iy * 1.2, 4.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(ix - 4, iy - 5, 3, 3);
    }
    if (e.kind === 'boar' && e.state === 'wind') { ctx.fillStyle = '#ff5f5f'; ctx.font = FONT(900, 22); ctx.textAlign = 'center'; ctx.fillText('!', 0, -e.r - 10); }
    if (e.kind === 'ghost' && e.alpha > 0.5) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = FONT(900, 11); ctx.textAlign = 'center'; ctx.fillText('outlier', 0, -e.r - 10); }
    ctx.restore();
    if (e.zLabel) textOut('z=' + e.zLabel, e.x, e.y - e.r - 10, '#9ef0b8', FONT(900, 13));
    if (e.root > 0) {
      ctx.strokeStyle = '#4fae5a'; ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) { const a = i * 1.6 + e.t; ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * e.r, e.y + e.r * 0.8); ctx.quadraticCurveTo(e.x + Math.cos(a + 1) * e.r * 1.3, e.y, e.x + Math.cos(a + 2) * e.r * 0.6, e.y - e.r * 0.6); ctx.stroke(); }
      ctx.fillStyle = '#7ad94f'; ctx.fillRect(e.x - 3, e.y - e.r * 0.7, 6, 4);
    }
    if (e.escorted) textOut('🚨', e.x, e.y - e.r - 14, '#fff', '18px sans-serif');
    if (e.hp < e.maxHp && e.kind !== 'boss') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - 16, e.y - e.r - 8, 32, 4);
      ctx.fillStyle = '#ff6b6b'; ctx.fillRect(e.x - 16, e.y - e.r - 8, 32 * Math.max(0, e.hp / e.maxHp), 4);
    }
  }
  function drawBoss(b) {
    const alpha = (b.spawn > 0 ? Math.max(0.2, 1 - b.spawn / 1.2) : 1) * (b.alpha == null ? 1 : b.alpha);
    const flash = b.flash > 0;
    if (b.variant === 5) {
      const hue = Math.round(((G.t * 240) % 360) / 15) * 15;
      A.glow(ctx, b.x, b.y - 10, 150, `hsl(${hue},100%,60%)`, 0.5);
      A.glow(ctx, b.x, b.y - 10, 80, 'rgba(255,240,160,1)', 0.55);
      ctx.save(); ctx.globalAlpha = alpha;
      drawLaporte({ x: b.x, y: b.y, mane: 1, scale: 1.7, moving: true, walkT: b.t * (b.state === 'dash' ? 2 : 0.6), face: G.run.player.x < b.x ? -1 : 1, speed: 400 }, { flash });
      ctx.restore();
      if (b.state === 'wind') textOut('!!', b.x, b.y - 110, '#ff5f6d', FONT(900, 34));
    } else {
      const spr = A.bosses[['rankenstein', 'monolith', 'zed', 'bell', 'emperor'][b.variant]](b.frame || 0, flash);
      A.shadow(ctx, b.x, b.y + spr.height / 2 - 6 + (b.variant === 1 || b.variant === 3 ? 26 : 0), spr.width * 0.38 * (b.sx || 1), 12, 0.45);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(b.x, b.y);
      if (b.variant === 3) { ctx.translate(0, -spr.height / 2); ctx.rotate(b.swing || 0); ctx.translate(0, spr.height / 2); }
      if (b.variant === 1) ctx.translate(0, Math.sin(G.t * 2) * 6);
      ctx.scale(b.sx || 1, b.sy || 1);
      if (b.variant === 1 && (b.sy || 1) < 0.95) ctx.translate(0, (1 - b.sy) * spr.height * 0.9);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
      ctx.restore();
      if (b.variant === 2 && b.zText) textOut('z = ' + b.zText, b.x, b.y - spr.height / 2 - 12, '#9ef0b8', FONT(900, 16));
    }
    if (b.shielded) {
      const R = b.r + 22 + Math.sin(G.t * 5) * 3;
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(G.t * 6) * 0.1;
      ctx.fillStyle = '#9ad8ff'; ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = '#d8f0ff'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) { const a = (i * TAU) / 6 + G.t * 0.5; const x = b.x + Math.cos(a) * R, y = b.y + Math.sin(a) * R; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
      ctx.restore();
    }
    if (b.stun > 0) textOut('✦ STUNNED ✦', b.x, b.y - b.r - 40, '#ffe27a', FONT(900, 18));
  }

  function drawObject(o) {
    const pop = o.pop > 0 ? 1 - o.pop / 0.6 : 1;
    const t = G.t;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(pop, pop);
    switch (o.kind) {
      case 'chest': {
        const kind = o.boss ? 'boss' : o.golden ? 'gold' : 'wood';
        if (!o.open && !o.unlocked) A.glow(ctx, 0, 0, 60, o.golden ? 'rgba(255,210,63,1)' : 'rgba(127,209,255,1)', 0.25 + Math.sin(t * 3) * 0.08);
        A.shadow(ctx, 0, 24, 30, 7);
        if (o.fleeing) {
          const k = Math.sin(o.t * 22) * 6;
          ctx.fillStyle = '#c9a36b'; ctx.fillRect(-18 + k, 20, 6, 14); ctx.fillRect(12 - k, 20, 6, 14);
          ctx.save(); ctx.rotate(Math.sin(o.t * 20) * 0.12);
        }
        A.blit(ctx, A.chestSprite(o.crate ? 'wood' : kind, !!o.open), 0, 0);
        if (o.crate && !o.open) textOut('FREE', 0, -26, '#7fe0d0', FONT(900, 13));
        if (o.fleeing) { ctx.fillStyle = '#fff'; ctx.fillRect(-12, -4, 7, 7); ctx.fillRect(5, -4, 7, 7); ctx.fillStyle = '#111'; ctx.fillRect(-10, -2, 3, 3); ctx.fillRect(7, -2, 3, 3); ctx.restore(); }
        if (!o.open && !o.unlocked && !o.fleeing && Math.random() < 0.08) G.particles.push({ x: o.x + rand(-26, 26), y: o.y + rand(-20, 10), vx: 0, vy: -30, life: 0.7, max: 0.7, color: o.golden ? '#ffe27a' : '#9fd3ff', size: 3 });
        break;
      }
      case 'shrine': {
        const used = o.used;
        A.shadow(ctx, 0, 30, 44, 10);
        if (!used) A.glow(ctx, 0, -10, 90, 'rgba(110,190,255,1)', 0.3 + Math.sin(t * 2) * 0.08);
        ctx.fillStyle = A.OUTLINE; ctx.beginPath(); ctx.ellipse(0, 18, 44, 18, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#7a86a8'; ctx.beginPath(); ctx.ellipse(0, 16, 40, 15, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = used ? '#3a4560' : '#3fa9ff'; ctx.beginPath(); ctx.ellipse(0, 13, 32, 10, 0, 0, TAU); ctx.fill();
        if (!used) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(-8 + Math.sin(t * 2) * 6, 11, 8, 2, 0, 0, TAU); ctx.fill(); }
        // pillar with a bell curve on top
        ctx.fillStyle = A.OUTLINE; ctx.fillRect(-9, -40, 18, 52);
        ctx.fillStyle = '#c9cfe0'; ctx.fillRect(-6, -38, 12, 48); ctx.fillStyle = '#9aa3bd'; ctx.fillRect(2, -38, 4, 48);
        ctx.strokeStyle = used ? '#6a7290' : '#ffe27a'; ctx.lineWidth = 4; ctx.beginPath();
        for (let i = -26; i <= 26; i++) { const z = i / 9; const y = -44 - 20 * Math.exp(-z * z / 2); if (i === -26) ctx.moveTo(i, y); else ctx.lineTo(i, y); }
        ctx.stroke();
        ctx.fillStyle = used ? '#6a7290' : '#ffe27a'; ctx.fillRect(-1, -66, 2, 22);
        if (!used && Math.random() < 0.15) G.particles.push({ x: o.x + rand(-20, 20), y: o.y + 8, vx: 0, vy: -50, life: 0.6, max: 0.6, color: '#9fd3ff', size: 3 });
        break;
      }
      case 'rune': {
        const sec = sectionFor(true);
        const col = '#9ad8ff';
        A.glow(ctx, 0, 0, 80, 'rgba(154,216,255,1)', 0.45 + Math.sin(t * 5) * 0.15);
        ctx.strokeStyle = col; ctx.lineWidth = 3;
        for (const R of [26, 18]) { ctx.beginPath(); ctx.arc(0, 0, R + Math.sin(t * 4) * 2, 0, TAU); ctx.stroke(); }
        ctx.save(); ctx.rotate(t);
        for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.fillStyle = col; ctx.fillRect(28, -3, 8, 6); }
        ctx.restore();
        textOut('?', 0, 10, '#ffffff', FONT(900, 28));
        void sec;
        break;
      }
      case 'stairs': {
        A.glow(ctx, 0, 0, 70, 'rgba(255,230,140,1)', 0.25);
        ctx.fillStyle = A.OUTLINE; ctx.fillRect(-34, -30, 68, 60);
        for (let i = 0; i < 5; i++) { ctx.fillStyle = A.shade('#6a6688', -i * 0.15); ctx.fillRect(-30 + i * 2, -26 + i * 11, 60 - i * 4, 10); }
        ctx.fillStyle = '#05040a'; ctx.fillRect(-20, 22, 40, 6);
        textOut('▼', 0, -38 + Math.sin(t * 4) * 4, '#ffe27a', FONT(900, 20));
        break;
      }
      case 'hat': {
        const y = Math.sin(t * 4) * 5;
        A.glow(ctx, 0, y, 36, 'rgba(255,226,122,1)', 0.4);
        ctx.font = '34px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(S.hats[o.hat].emoji, 0, y + 12);
        break;
      }
      case 'flag': {
        const s = o.creature === 'ghost' ? A.ghostSprite(o.color || '#d6ebff', Math.floor(t * 3) % 2) : A.slimeSprite(o.color || '#3fd7c0', Math.floor(t * 3) % 3);
        A.blit(ctx, s, 0, o.creature === 'ghost' ? Math.sin(t * 3) * 3 : 0);
        ctx.fillStyle = '#8a6a4a'; ctx.fillRect(18, -40, 3, 44);
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(21, -40); ctx.lineTo(44 + Math.sin(t * 8) * 3, -34); ctx.lineTo(21, -26); ctx.fill();
        ctx.fillStyle = '#ff9fd0'; ctx.font = FONT(900, 18); ctx.textAlign = 'center'; ctx.fillText('♥', -18 + Math.sin(t * 3) * 3, -30 - (t * 20) % 16);
        break;
      }
      case 'shopItem': {
        if (o.used) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = FONT(800, 14); ctx.textAlign = 'center'; ctx.fillText('SOLD', 0, 4); break; }
        ctx.fillStyle = A.OUTLINE; ctx.fillRect(-26, 8, 52, 20); ctx.fillStyle = '#6b4a8a'; ctx.fillRect(-23, 10, 46, 16);
        A.glow(ctx, 0, -8, 40, 'rgba(255,230,140,1)', 0.25);
        const y = -10 + Math.sin(t * 3 + o.x) * 3;
        if (o.heal) A.blit(ctx, A.heartSprite(false), 0, y);
        else if (o.edamame) A.blit(ctx, A.edamameSprite(), 0, y);
        else if (o.item.icon.startsWith('img:')) A.blit(ctx, A.edamameSprite(), 0, y);
        else { ctx.font = '30px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.fillText(o.item.icon, 0, y + 10); }
        textOut('🪙 ' + priceOf(o), 0, 48, '#ffd23f', FONT(900, 17));
        textOut(o.heal ? 'Heart' : o.edamame ? 'Edamame' : o.item.name, 0, 68, '#ffffff', FONT(800, 13));
        break;
      }
      case 'vending': {
        A.shadow(ctx, 0, 46, 40, 8);
        ctx.fillStyle = A.OUTLINE; rr(-38, -56, 76, 104, 8); ctx.fill();
        ctx.fillStyle = '#c0392b'; rr(-35, -53, 70, 98, 6); ctx.fill();
        ctx.fillStyle = '#1b2236'; ctx.fillRect(-28, -44, 40, 64);
        for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { ctx.fillStyle = ['#ffd23f', '#5fe39a', '#6ab8ff', '#ff9fd0'][(r + c) % 4]; ctx.fillRect(-25 + c * 13, -40 + r * 15, 9, 9); }
        ctx.fillStyle = '#e8e4ff'; ctx.fillRect(16, -40, 14, 30); ctx.fillStyle = '#111'; ctx.fillRect(16, 26, 14, 6);
        // face
        ctx.fillStyle = '#fff'; ctx.fillRect(-22, 26, 8, 8); ctx.fillRect(-4, 26, 8, 8);
        ctx.fillStyle = '#111'; ctx.fillRect(-19, 28, 3, 4); ctx.fillRect(-1, 28, 3, 4);
        A.glow(ctx, -8, -12, 50, 'rgba(120,180,255,1)', 0.25);
        if (o.sayT > 0) {
          // speech bubble to the right of the machine
          const lines = wrapLines(o.say, 280, FONT(800, 17));
          const w = 300, h = 14 + lines.length * 21, bx = 52, by = -50;
          ctx.fillStyle = 'rgba(255,255,255,0.96)'; rr(bx, by, w, h, 10); ctx.fill();
          ctx.beginPath(); ctx.moveTo(bx, by + 14); ctx.lineTo(bx - 14, by + 22); ctx.lineTo(bx, by + 28); ctx.fill();
          ctx.fillStyle = '#1b1430'; ctx.font = FONT(800, 17); ctx.textAlign = 'left';
          lines.forEach((l, i) => ctx.fillText(l, bx + 12, by + 24 + i * 21));
        }
        break;
      }
      case 'coffee': {
        A.shadow(ctx, 0, 28, 28, 7);
        ctx.fillStyle = A.OUTLINE; rr(-26, -40, 52, 70, 6); ctx.fill();
        ctx.fillStyle = '#4a4f5c'; rr(-23, -37, 46, 64, 5); ctx.fill();
        ctx.fillStyle = '#2a2d36'; ctx.fillRect(-15, -10, 30, 22);
        ctx.fillStyle = o.used ? '#555' : '#ff5f3f'; ctx.fillRect(10, -30, 6, 6);
        ctx.fillStyle = '#fff'; rr(-8, 0, 16, 12, 3); ctx.fill(); ctx.fillStyle = '#6b3f1f'; ctx.fillRect(-6, 2, 12, 4);
        ctx.fillStyle = '#ffe27a'; ctx.font = FONT(900, 10); ctx.textAlign = 'center'; ctx.fillText('STAFF', 0, -18); ctx.fillText('ONLY', 0, -8);
        if (!o.used) { for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(255,255,255,${0.25 - i * 0.07})`; ctx.beginPath(); ctx.arc(Math.sin(t * 2 + i) * 4, -8 - i * 10 - (t * 10) % 10, 4 + i, 0, TAU); ctx.fill(); } A.glow(ctx, 0, 0, 60, 'rgba(255,220,140,1)', 0.25); }
        break;
      }
      case 'bowl': {
        A.shadow(ctx, 0, 14, 30, 7);
        ctx.fillStyle = A.OUTLINE; ctx.beginPath(); ctx.ellipse(0, 0, 32, 16, 0, 0, Math.PI); ctx.fill(); ctx.fillRect(-32, -4, 64, 6);
        ctx.fillStyle = '#e8e4ff'; ctx.beginPath(); ctx.ellipse(0, 0, 29, 13, 0, 0, Math.PI); ctx.fill();
        if (!o.used) for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(-20 + i * 8, -6 - (i % 2) * 5); ctx.rotate((i % 3 - 1) * 0.5); ctx.scale(0.6, 0.6); A.blit(ctx, A.edamameSprite(), 0, 0); ctx.restore(); }
        textOut(o.used ? 'empty :(' : "L's EDAMAME", 0, 34, '#9be36b', FONT(900, 13));
        break;
      }
      case 'couch': {
        A.shadow(ctx, 0, 26, 70, 9);
        ctx.fillStyle = A.OUTLINE; rr(-72, -30, 144, 58, 12); ctx.fill();
        ctx.fillStyle = '#7a3f5a'; rr(-68, -26, 136, 30, 10); ctx.fill();
        ctx.fillStyle = '#93506e'; rr(-62, -2, 124, 24, 6); ctx.fill();
        ctx.fillStyle = '#6a3450'; rr(-70, -10, 16, 34, 6); ctx.fill(); rr(54, -10, 16, 34, 6); ctx.fill();
        ctx.fillStyle = '#ffd23f'; rr(-40, -16, 26, 16, 5); ctx.fill();
        break;
      }
      case 'board': {
        ctx.fillStyle = A.OUTLINE; ctx.fillRect(-60, -26, 120, 54);
        ctx.fillStyle = '#b58a5a'; ctx.fillRect(-57, -23, 114, 48);
        const notes = ['#fff59d', '#ffccbc', '#c5e1a5', '#b3e5fc', '#fff'];
        for (let i = 0; i < 5; i++) { ctx.fillStyle = notes[i]; ctx.save(); ctx.translate(-44 + i * 22, -6 + (i % 2) * 8); ctx.rotate((i % 3 - 1) * 0.12); ctx.fillRect(-9, -10, 18, 18); ctx.fillStyle = '#c0392b'; ctx.fillRect(-1, -9, 3, 3); ctx.restore(); }
        break;
      }
      case 'fridge': {
        A.shadow(ctx, 0, 34, 26, 6);
        ctx.fillStyle = A.OUTLINE; rr(-24, -46, 48, 82, 6); ctx.fill();
        ctx.fillStyle = '#e8eef4'; rr(-21, -43, 42, 76, 5); ctx.fill();
        ctx.fillStyle = '#b8c4d0'; ctx.fillRect(-21, -12, 42, 3); ctx.fillRect(12, -36, 3, 18); ctx.fillRect(12, -4, 3, 22);
        ctx.fillStyle = '#fff59d'; ctx.fillRect(-14, 2, 16, 14); ctx.fillStyle = '#c0392b'; ctx.font = FONT(900, 7); ctx.textAlign = 'center'; ctx.fillText('MINE', -6, 12);
        break;
      }
      case 'gate': {
        // the dungeon entrance, carved into the top wall
        ctx.fillStyle = A.OUTLINE; rr(-110, -66, 220, 92, 10); ctx.fill();
        ctx.fillStyle = '#4a4670'; rr(-106, -62, 212, 84, 8); ctx.fill();
        ctx.fillStyle = '#ffd23f'; ctx.font = PIX(11); ctx.textAlign = 'center';
        ctx.fillText('DISTRIBUTION', 0, -40); ctx.fillText('DUNGEON', 0, -22);
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.beginPath();
        for (let i = -70; i <= 70; i++) { const z = i / 24; const y = 12 - 22 * Math.exp(-z * z / 2); if (i === -70) ctx.moveTo(i, y); else ctx.lineTo(i, y); }
        ctx.stroke();
        break;
      }
      case 'tonic': {
        const y = Math.sin(t * 3) * 5 - 10;
        const hue = Math.round(((t * 200) % 360) / 15) * 15;
        A.glow(ctx, 0, y, 80, `hsl(${hue},100%,60%)`, 0.6);
        ctx.fillStyle = A.OUTLINE; rr(-14, y - 22, 28, 40, 8); ctx.fill(); ctx.fillRect(-7, y - 34, 14, 14);
        ctx.fillStyle = `hsl(${hue},90%,65%)`; rr(-11, y - 14, 22, 29, 6); ctx.fill();
        ctx.fillStyle = '#e8e4ff'; ctx.fillRect(-5, y - 31, 10, 10);
        ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-6, y - 36, 12, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-7, y - 10, 4, 14);
        if (Math.random() < 0.3) G.particles.push({ x: o.x + rand(-20, 20), y: o.y + y + rand(-20, 20), vx: 0, vy: -40, life: 0.6, max: 0.6, color: `hsl(${hue},100%,70%)`, size: 3 });
        break;
      }
    }
    ctx.restore();
  }
  function drawPickup(k) {
    const y = k.y + Math.sin(G.t * 5 + k.x) * 3;
    A.shadow(ctx, k.x, k.y + 12, 9, 3);
    if (k.kind === 'coin') A.blit(ctx, A.coinSprite(Math.floor(G.t * 8 + k.x) % 4), k.x, y);
    if (k.kind === 'heart') A.blit(ctx, A.heartSprite(false), k.x, y);
    if (k.kind === 'edamame') { A.glow(ctx, k.x, y, 26, 'rgba(155,227,107,1)', 0.4); A.blit(ctx, A.edamameSprite(), k.x, y); }
  }
  function drawDoors() {
    const room = G.room;
    const th = room.type === 'lounge' ? A.LOUNGE_THEME : G.run.theme;
    for (const [d, n] of Object.entries(room.doors)) {
      const gaps = gapTiles(d);
      const x0 = Math.min(...gaps.map((g) => g[0])) * T, y0 = Math.min(...gaps.map((g) => g[1])) * T;
      const w = d === 'n' || d === 's' ? 3 * T : T, h = d === 'n' || d === 's' ? T : 3 * T;
      if (isSecretShut(room, d)) {
        const hits = room.secretHits || 0;
        const pulse = 0.5 + 0.5 * Math.sin(G.t * 3);
        A.glow(ctx, x0 + w / 2, y0 + h / 2, 70, 'rgba(255,190,90,1)', 0.25 + pulse * 0.2);
        ctx.save(); ctx.strokeStyle = `rgba(255,${180 + hits * 20},90,${0.55 + pulse * 0.35})`; ctx.lineWidth = 5;
        for (let i = 0; i < 4 + hits * 2; i++) {
          ctx.beginPath();
          let px = x0 + w / 2 + Math.sin(i * 7.3) * w * 0.3, py = y0 + h / 2 + Math.cos(i * 3.1) * h * 0.3;
          ctx.moveTo(px, py);
          for (let k = 0; k < 3; k++) { px += Math.sin(i * 11 + k) * 12; py += Math.cos(i * 5 + k * 3) * 12; ctx.lineTo(px, py); }
          ctx.stroke();
        }
        ctx.restore();
        if (Math.random() < 0.08) G.particles.push({ x: x0 + rand(4, w - 4), y: y0 + rand(4, h - 4), vx: rand(-10, 10), vy: rand(20, 50), life: 0.9, max: 0.9, color: '#c9b89a', size: rand(2, 4) });
        if (Math.random() < 0.03) G.particles.push({ x: x0 + w / 2 + rand(-8, 8), y: y0 + h / 2, vx: rand(-6, 6), vy: -rand(15, 30), life: 1.4, max: 1.4, color: 'rgba(255,255,255,0.35)', size: rand(5, 9) });
        const plx = d === 'n' || d === 's' ? x0 + w / 2 : x0 + w / 2, ply = d === 'n' ? y0 + h - 8 : d === 's' ? y0 + 10 : y0 + h / 2;
        ctx.fillStyle = '#c9a36b'; rr(plx - 24, ply - 9, 48, 17, 4); ctx.fill();
        ctx.fillStyle = '#3a2618'; ctx.font = FONT(900, 11); ctx.textAlign = 'center'; ctx.fillText('STAFF?', plx, ply + 4);
        ctx.strokeStyle = 'rgba(20,14,10,0.8)'; ctx.lineWidth = 3;
        for (let i = 0; i < 3 + hits * 2; i++) {
          ctx.beginPath();
          let px = x0 + w / 2 + Math.sin(i * 7.3) * w * 0.3, py = y0 + h / 2 + Math.cos(i * 3.1) * h * 0.3;
          ctx.moveTo(px, py);
          for (let k = 0; k < 3; k++) { px += Math.sin(i * 11 + k) * 12; py += Math.cos(i * 5 + k * 3) * 12; ctx.lineTo(px, py); }
          ctx.stroke();
        }
        continue;
      }
      // dark doorway with a lit frame
      ctx.fillStyle = '#05040a'; ctx.fillRect(x0, y0, w, h);
      const special = n.type === 'boss' ? '#ff4d4d' : n.type === 'lounge' ? '#ffe27a' : n.type === 'shop' ? '#6be38a' : (n.type === 'treasure' || n.type === 'vault') ? '#ffd23f' : n.type === 'shrine' ? '#9fd3ff' : null;
      ctx.strokeStyle = special || th.wallHi; ctx.lineWidth = 4;
      ctx.strokeRect(x0 + 2, y0 + 2, w - 4, h - 4);
      if (special && n.seen) A.glow(ctx, x0 + w / 2, y0 + h / 2, 70, special, 0.3);
      if (G.locked) {
        ctx.fillStyle = '#8a8fa8';
        if (d === 'n' || d === 's') for (let i = 0; i < 9; i++) { ctx.fillRect(x0 + 6 + i * 16, y0 + 2, 6, h - 4); }
        else for (let i = 0; i < 9; i++) { ctx.fillRect(x0 + 2, y0 + 6 + i * 16, w - 4, 6); }
      }
      if (n.type === 'boss') textOut('☠', x0 + w / 2, y0 + h / 2 + 10, '#ff6b6b', FONT(900, 26));
    }
  }
  function drawEnemyBullet(b) {
    if (b.paper) {
      const a = Math.atan2(b.vy, b.vx);
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
      ctx.fillStyle = '#f4f4f4'; ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-9, -8); ctx.lineTo(-4, 0); ctx.lineTo(-9, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e74c3c'; ctx.font = FONT(900, 9); ctx.fillText('F', -4, 3);
      ctx.restore(); return;
    }
    if (b.arrow) {
      const a = Math.atan2(b.vy, b.vx);
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
      ctx.fillStyle = '#d8c8a0'; ctx.fillRect(-12, -1.5, 18, 3);
      ctx.fillStyle = '#fff1b8'; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(4, -5); ctx.lineTo(4, 5); ctx.fill();
      ctx.fillStyle = '#ff6b6b'; ctx.fillRect(-13, -4, 4, 8);
      ctx.restore(); return;
    }
    if (b.web) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(G.t * 4);
      ctx.strokeStyle = '#e8e4ff'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * 1.047) * b.r, Math.sin(i * 1.047) * b.r); ctx.stroke(); }
      for (const R of [b.r * 0.5, b.r]) { ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke(); }
      ctx.restore(); return;
    }
    if (b.pip) { ctx.fillStyle = A.OUTLINE; ctx.fillRect(b.x - 7, b.y - 7, 14, 14); ctx.fillStyle = '#f4f4f4'; ctx.fillRect(b.x - 5, b.y - 5, 10, 10); ctx.fillStyle = '#1b1430'; ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, TAU); ctx.fill(); return; }
    A.glow(ctx, b.x, b.y, b.r * 3, b.color, 0.35);
    if (b.square) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(G.t * 3);
      ctx.fillStyle = A.OUTLINE; ctx.fillRect(-b.r - 2, -b.r - 2, b.r * 2 + 4, b.r * 2 + 4);
      ctx.fillStyle = b.color; ctx.fillRect(-b.r, -b.r, b.r * 2, b.r * 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(-b.r + 2, -b.r + 2, b.r * 0.7, b.r * 0.7);
      ctx.restore(); return;
    }
    if (b.note) { textOut('♪', b.x, b.y + 7, b.color, FONT(900, 22)); return; }
    if (b.hair) {
      const a = Math.atan2(b.vy, b.vx);
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
      ctx.fillStyle = A.OUTLINE; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -7); ctx.lineTo(-10, 7); ctx.fill();
      ctx.fillStyle = b.color; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-8, -5); ctx.lineTo(-8, 5); ctx.fill();
      ctx.restore(); return;
    }
    ctx.fillStyle = A.OUTLINE; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 2, 0, TAU); ctx.fill();
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.38, 0, TAU); ctx.fill();
    if (b.z) { ctx.fillStyle = '#0b3a2a'; ctx.font = FONT(900, 10); ctx.textAlign = 'center'; ctx.fillText('z', b.x, b.y + 3); }
  }
  function drawPlayerBullet(b) {
    if (b.pod) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx)); ctx.scale(0.7, 0.7);
      A.blit(ctx, A.edamameSprite(), 0, 0); ctx.restore(); return;
    }
    if (b.bean) { A.blit(ctx, A.beanSprite(), b.x, b.y); return; }
    if (b.meteor) {
      for (let i = 0; i < 3; i++) G.particles.push({ x: b.x + rand(-8, 8), y: b.y + rand(-8, 8), vx: -b.vx * 0.1 + rand(-30, 30), vy: -b.vy * 0.1 + rand(-30, 30), life: 0.35, max: 0.35, color: pick(['#ff7a1a', '#ffd23f', '#ff3b3b']), size: rand(4, 8) });
      A.glow(ctx, b.x, b.y, 60, 'rgba(255,122,26,1)', 0.7);
      ctx.fillStyle = '#5a2a12'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff9f43'; ctx.beginPath(); ctx.arc(b.x - 4, b.y - 4, b.r * 0.6, 0, TAU); ctx.fill();
      return;
    }
    if (b.paper) { drawEnemyBullet(Object.assign({}, b, { paper: true })); return; }
    A.glow(ctx, b.x, b.y, b.r * 3.2, b.color, b.big ? 0.7 : 0.45);
    if (b.boom) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(G.t * 18);
      ctx.fillStyle = A.OUTLINE; ctx.fillRect(-b.r - 3, -3, b.r * 2 + 6, 6); ctx.fillRect(-3, -b.r - 3, 6, b.r * 2 + 6);
      ctx.fillStyle = b.color; ctx.fillRect(-b.r - 1, -2, b.r * 2 + 2, 4); ctx.fillRect(-2, -b.r - 1, 4, b.r * 2 + 2);
      ctx.restore(); return;
    }
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.45, 0, TAU); ctx.fill();
  }
  function drawHazards() {
    for (const h of G.hazards) {
      const warn = h.t < h.warn;
      ctx.save();
      if (h.kind === 'rect') {
        if (warn) {
          ctx.globalAlpha = 0.18 + 0.14 * Math.sin(h.t * 22);
          ctx.fillStyle = h.color; ctx.fillRect(h.x, h.y, h.w, h.h);
          ctx.globalAlpha = 0.8; ctx.strokeStyle = h.color; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.strokeRect(h.x, h.y, h.w, h.h);
        } else if (h.active > 0) {
          ctx.globalAlpha = 0.55; ctx.fillStyle = h.color; ctx.fillRect(h.x, h.y, h.w, h.h);
          ctx.globalAlpha = 0.9; ctx.fillStyle = '#fff'; ctx.fillRect(h.x + h.w / 2 - 3, h.y, 6, h.h);
        }
      } else {
        if (warn) {
          ctx.globalAlpha = 0.5 + 0.4 * Math.sin(h.t * 30);
          ctx.strokeStyle = h.color; ctx.lineWidth = 3; ctx.setLineDash([10, 10]);
          ctx.beginPath(); ctx.moveTo(h.x1, h.y1); ctx.lineTo(h.x2, h.y2); ctx.stroke();
        } else {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = h.color; ctx.globalAlpha = 0.6; ctx.lineWidth = h.w * 1.8;
          ctx.beginPath(); ctx.moveTo(h.x1, h.y1); ctx.lineTo(h.x2, h.y2); ctx.stroke();
          ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.95; ctx.lineWidth = h.w * 0.5; ctx.stroke();
        }
      }
      ctx.restore();
    }
  }
  function drawAmbient() {
    const kind = G.ambientKind;
    for (const a of G.ambient) {
      const al = Math.min(1, a.life) * 0.7;
      if (kind === 'firefly') { const b = 0.5 + 0.5 * Math.sin(a.ph * 4); A.glow(ctx, a.x, a.y, 10, 'rgba(200,255,120,1)', b * 0.5 * al); ctx.fillStyle = `rgba(230,255,160,${b * al})`; ctx.fillRect(a.x - 1, a.y - 1, 3, 3); }
      else if (kind === 'note') { ctx.fillStyle = `rgba(255,200,120,${al * 0.4})`; ctx.font = FONT(900, 14); ctx.fillText(a.s > 1 ? '♪' : '♫', a.x, a.y); }
      else if (kind === 'ember') { ctx.fillStyle = `rgba(220,160,255,${al * 0.8})`; ctx.fillRect(a.x, a.y, 2, 2); }
      else if (kind === 'sand') { ctx.fillStyle = `rgba(255,235,190,${al * 0.5})`; ctx.fillRect(a.x, a.y, 4, 1); }
      else if (kind === 'steam') { ctx.fillStyle = `rgba(255,255,255,${al * 0.06})`; ctx.beginPath(); ctx.arc(a.x, a.y, 10 * a.s, 0, TAU); ctx.fill(); }
      else { ctx.fillStyle = `rgba(255,240,220,${al * 0.35})`; ctx.fillRect(a.x, a.y, 2, 2); }
    }
  }
  function drawTorches() {
    const room = G.room;
    if (room.type === 'lounge') return;
    const th = G.run.theme;
    for (let c = 4; c < COLS - 2; c += 14) { A.drawTorch(ctx, c * T + T / 2, T - 18, G.t, th.light); A.drawTorch(ctx, (COLS - 1 - c) * T + T / 2, T - 18, G.t + c, th.light); }
    for (let r = 3; r < ROWS - 2; r += 6) { A.drawTorch(ctx, 14, r * T + T / 2, G.t + r, th.light); A.drawTorch(ctx, RW - 14, r * T + T / 2, G.t + r * 2, th.light); }
  }
  // a faint edge vignette (no fog of war)
  function drawLighting() {
    if (!G.vignette) {
      G.vignette = document.createElement('canvas'); G.vignette.width = VW; G.vignette.height = VH;
      const vg = G.vignette.getContext('2d');
      const gr = vg.createRadialGradient(VW / 2, VH / 2, VH * 0.55, VW / 2, VH / 2, VW * 0.72);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.28)');
      vg.fillStyle = gr; vg.fillRect(0, 0, VW, VH);
    }
    ctx.drawImage(G.vignette, Math.round(G.cam.x), Math.round(G.cam.y));
  }
  function drawPsychedelic() {
    if (G.psy <= 0) return;
    ctx.save();
    const k = G.psy;
    // a cheap rainbow wash: one solid fill whose hue cycles (gradients and blend modes were too slow on Chromebooks)
    ctx.globalAlpha = 0.2 * k;
    ctx.fillStyle = `hsl(${Math.round((G.t * 140) % 360)},100%,55%)`;
    ctx.fillRect(0, 0, RW, RH);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16 * k;
    for (let i = 0; i < 4; i++) {
      const R = ((G.t * 160 + i * 180) % 720);
      ctx.strokeStyle = `hsl(${Math.round((i * 90 + G.t * 200) % 360)},100%,60%)`; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.arc(RW / 2, RH / 2, R, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
  function drawZedRings() {
    const b = G.enemies.find((e) => e.kind === 'boss' && e.variant === 2);
    if (!b) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(158,240,184,0.35)'; ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
    for (const z of [1, 2]) { ctx.beginPath(); ctx.ellipse(RW / 2, RH / 2, z * 176, z * 99, 0, 0, TAU); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(158,240,184,0.55)'; ctx.font = FONT(900, 15); ctx.textAlign = 'center';
    [['μ', 0], ['+1σ', 176], ['+2σ', 352], ['−1σ', -176], ['−2σ', -352]].forEach(([l, dx]) => ctx.fillText(l, RW / 2 + dx, RH / 2 + 5));
    ctx.restore();
  }
  function drawPulses() {
    if (!G.pulses) return;
    for (const pu of G.pulses) {
      const k = Math.min(1, pu.t / 0.45), al = 1 - pu.t / 0.7;
      [68, 95, 99.7].forEach((v, i) => {
        const R = v * 1.5 * k;
        ctx.strokeStyle = ['rgba(255,210,63,', 'rgba(255,159,67,', 'rgba(255,95,109,'][i] + al + ')';
        ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(pu.x, pu.y, R, 0, TAU); ctx.stroke();
        if (k > 0.9) { ctx.fillStyle = `rgba(255,255,255,${al})`; ctx.font = FONT(900, 11); ctx.textAlign = 'center'; ctx.fillText(v + '%', pu.x + R, pu.y - 4); }
      });
    }
  }
  function drawSpecials() {
    const p = G.run.player;
    // chalk trail
    if (G.chalk.length > 1) {
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 1; i < G.chalk.length; i++) {
        const a = G.chalk[i - 1], b = G.chalk[i];
        if (Math.hypot(a.x - b.x, a.y - b.y) > 40) continue;
        ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, b.life) * 0.85})`; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.restore();
    }
    for (const n of G.novas) {
      const R = 280 * Math.min(1, n.t / 0.6), al = 1 - n.t / 0.75;
      ctx.save(); ctx.strokeStyle = `rgba(255,226,122,${al})`; ctx.lineWidth = 8;
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) { const a = (i / 64) * TAU; const bump = 1 + 0.18 * Math.exp(-((((a + Math.PI / 2) % TAU) - Math.PI) ** 2) / 0.3); const x = n.x + Math.cos(a) * R * bump, y = n.y + Math.sin(a) * R * bump * 0.85; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke(); ctx.restore();
      if (n.t < 0.4) textOut('NORMAL NOVA!', n.x, n.y - 50, '#ffe27a', FONT(900, 18));
    }
    for (const b of G.beams) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(127,230,255,0.6)'; ctx.lineWidth = 26 * (b.life / 0.3); ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6 * (b.life / 0.3); ctx.stroke();
      ctx.restore();
      textOut('ŷ = a + bx', b.x1 + (b.x2 - b.x1) * 0.06, b.y1 + (b.y2 - b.y1) * 0.06 - 16, '#bff8ff', FONT(900, 14));
    }
    for (const r of G.rockets) {
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.a);
      ctx.fillStyle = A.OUTLINE; ctx.fillRect(-10, -5, 20, 10);
      ctx.fillStyle = '#e8e4ff'; ctx.fillRect(-8, -3, 14, 6); ctx.fillStyle = '#ff5f6d'; ctx.fillRect(6, -3, 4, 6);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(-13, -2, 4, 4);
      ctx.restore();
    }
    for (const sw of G.saws) {
      ctx.save(); ctx.translate(sw.x, sw.y); ctx.rotate(sw.spin);
      A.glow(ctx, 0, 0, 34, 'rgba(255,210,63,1)', 0.35);
      const cols = ['#ff6b6b', '#ffd23f', '#5fe39a', '#6ab8ff', '#c9a7ff'], fr = [0.3, 0.25, 0.2, 0.15, 0.1];
      let a0 = 0;
      ctx.fillStyle = A.OUTLINE; ctx.beginPath(); ctx.arc(0, 0, 21, 0, TAU); ctx.fill();
      fr.forEach((f, i) => { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 18, a0, a0 + f * TAU); ctx.closePath(); ctx.fill(); a0 += f * TAU; });
      for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.fillStyle = '#e8e4ff'; ctx.beginPath(); ctx.moveTo(18, -4); ctx.lineTo(26, 0); ctx.lineTo(18, 4); ctx.fill(); }
      ctx.restore();
    }
    for (const r of G.vfxRings) {
      if (r.t < 0) continue;
      const k = r.t / r.max, R = (r.R || 420) * k;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = r.color || `hsl(${Math.round((G.t * 300 + r.t * 600) % 360)},100%,65%)`; ctx.globalAlpha = 1 - k; ctx.lineWidth = r.R ? 6 : 14;
      ctx.beginPath(); ctx.arc(r.x, r.y, R, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    for (const b of G.bolts) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath(); ctx.moveTo(b.x, b.y);
      let x = b.x, y = b.y;
      for (let i = 0; i < 7; i++) { x += Math.cos(b.a) * b.len / 7 + rand(-14, 14); y += Math.sin(b.a) * b.len / 7 + rand(-14, 14); ctx.lineTo(x, y); }
      ctx.strokeStyle = 'rgba(255,210,63,0.35)'; ctx.lineWidth = 10; ctx.stroke();
      ctx.strokeStyle = b.life > 0.09 ? '#ffffff' : '#ffe27a'; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    }
    for (const st of G.stamps) {
      ctx.save(); ctx.translate(st.x, st.y - (0.8 - st.life) * 20); ctx.rotate(st.rot); ctx.globalAlpha = Math.min(1, st.life * 2);
      const sc = 1 + Math.max(0, st.life - 0.6) * 3; ctx.scale(sc, sc);
      ctx.strokeStyle = '#e8213a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -6, 16, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#e8213a'; ctx.font = PIX(13); ctx.textAlign = 'center'; ctx.fillText('A+', 1, 0);
      ctx.restore();
    }
    void p;
  }
  function drawFinalFx() {
    const b = G.enemies.find((e) => e.kind === 'boss' && e.variant === 5);
    if (!b) return;
    const phase = b.lastPhase || 0;
    // afterimages
    b.trail = b.trail || [];
    if (G.mode === 'play' && (b.trailTick = (b.trailTick || 0) + 1) % 3 === 0) { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 4) b.trail.shift(); }
    const tints = ['#ffd23f', '#ff7ae0', '#7fe6ff', '#9be36b'];
    b.trail.forEach((tp, i) => { ctx.save(); ctx.globalAlpha = 0.12 + i * 0.06; drawLaporte({ x: tp.x, y: tp.y, mane: 1, scale: 1.7, moving: false, walkT: 0, face: 1, speed: 0 }, { ghost: tints[i % 4] }); ctx.restore(); });
    // speed lines radiating from the boss
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8 + phase; i++) {
      const a = rand(0, TAU), r0 = rand(140, 240), r1 = r0 + rand(80, 260);
      ctx.strokeStyle = `hsla(${Math.round((G.t * 200 + i * 30) % 360)},100%,70%,0.25)`; ctx.lineWidth = rand(1, 4);
      ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * r0, b.y + Math.sin(a) * r0); ctx.lineTo(b.x + Math.cos(a) * r1, b.y + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.restore();
  }
  function drawZaps() {
    if (!G.zaps) return;
    ctx.save();
    for (const z of G.zaps) {
      ctx.globalAlpha = z.life / 0.18;
      ctx.beginPath(); ctx.moveTo(z.x1, z.y1);
      for (let i = 1; i < 6; i++) ctx.lineTo(lerp(z.x1, z.x2, i / 6) + rand(-8, 8), lerp(z.y1, z.y2, i / 6) + rand(-8, 8));
      ctx.lineTo(z.x2, z.y2);
      ctx.strokeStyle = 'rgba(127,230,255,0.35)'; ctx.lineWidth = 9; ctx.stroke();
      ctx.strokeStyle = '#bff8ff'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore();
  }

  function drawWorld() {
    const p = G.run.player;
    ctx.save();
    const sx = G.shake ? rand(-G.shake, G.shake) : 0, sy = G.shake ? rand(-G.shake, G.shake) : 0;
    ctx.translate(sx, HUD + sy);
    ctx.beginPath(); ctx.rect(-20, 0, VW + 40, VH + 20); ctx.clip();
    if (G.zoom > 0) { const z = 1 + G.zoom; ctx.translate(VW / 2, VH / 2); ctx.scale(z, z); ctx.translate(-VW / 2, -VH / 2); }
    const cam = G.cam;
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
    if (G.bg) ctx.drawImage(G.bg, 0, 0);
    drawPsychedelic();
    drawZedRings();
    drawFinalFx();
    drawDoors();
    drawTorches();
    drawHazards();
    for (const k of G.room.pickups) drawPickup(k);
    for (const q of G.particles) if (q.ghost) { ctx.globalAlpha = (q.life / q.max) * 0.5; ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    // depth-sorted things
    const list = [];
    for (const o of G.room.objects) list.push({ y: o.y + (o.kind === 'gate' || o.kind === 'board' ? -100 : 0), f: () => drawObject(o) });
    for (const e of G.enemies) list.push({ y: e.y, f: () => drawEnemy(e) });
    for (const a of G.actors) list.push({ y: a.y + 20, f: () => drawActor(a) });
    for (const pt of G.run.pets) list.push({ y: pt.y, f: () => drawPet(pt) });
    if (G.deathT <= 0 && p.hp > 0) list.push({ y: p.y, f: () => drawPlayer(p) });
    list.sort((a, b) => a.y - b.y).forEach((it) => it.f());
    drawPulses();
    drawSpecials();
    for (const b of G.pbullets) drawPlayerBullet(b);
    for (const b of G.ebullets) drawEnemyBullet(b);
    drawZaps();
    for (const q of G.particles) if (!q.ghost) { ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.color; ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); }
    ctx.globalAlpha = 1;
    drawLighting();
    drawAmbient();
    for (const t of G.texts) { ctx.globalAlpha = Math.min(1, (t.life / t.max) * 2); textOut(t.text, t.x, t.y, t.color, FONT(900, 18)); }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function objectDesc(o) {
    switch (o.kind) {
      case 'chest':
        if (o.crate) return 'Free! No lock on this one. Choose a power-up.';
        if (o.unlocked) return 'Already unlocked. Choose a power-up!';
        if (o.lapSolve && !o.lapDone) return 'Solve a stats problem to choose a power-up.';
        return o.golden ? 'Solve a stats problem to choose 1 of 3 power-ups.' : 'Solve a stats problem to choose a power-up (1 of 3 for a perfect solve).';
      case 'shrine': return 'Solve a stats problem: full heal + a blessing. Perfect solve: +1 max heart.';
      case 'rune': return "Solve it to shatter the boss's shield.";
      case 'shopItem':
        if (o.heal) return 'Restores 1 heart.';
        if (o.edamame) return 'One dried edamame bean: heals 1 heart and gives Protein Power (+50% damage) for 10 seconds.';
        return o.item.desc;
      case 'coffee': return 'Choose one powerful STAFF upgrade. Also heals you to full. (One use.)';
      case 'bowl': return "Mr. Laporte's dried edamame: heals 2 hearts and gives Protein Power.";
      case 'couch': return 'Rest for a moment: full heal. (One use.)';
      case 'flag': return 'It will follow you and help you fight!';
      case 'stairs': return 'Go down to the next floor. (The game saves when you arrive.)';
      default: return '';
    }
  }
  function drawPromptPanel() {
    if (!G.hint || G.mode !== 'play' || G.talk) return;
    const o = G.hint, label = objectLabel(o), desc = objectDesc(o);
    const f1 = FONT(900, 20), f2 = FONT(700, 17);
    ctx.font = f1; const w1 = ctx.measureText(label).width;
    const lines = desc ? wrapLines(desc, 640, f2) : [];
    ctx.font = f2; const w2 = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
    const w = Math.max(w1 + 60, w2 + 40), h = 44 + lines.length * 22;
    const x = CW / 2 - w / 2, y = CH - h - 12;
    ctx.fillStyle = 'rgba(12,9,24,0.94)'; rr(x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffe27a'; rr(x + 14, y + 10, 28, 26, 6); ctx.fill();
    ctx.fillStyle = '#111'; ctx.font = FONT(900, 18); ctx.textAlign = 'center'; ctx.fillText('E', x + 28, y + 30);
    ctx.fillStyle = '#ffffff'; ctx.font = f1; ctx.textAlign = 'left'; ctx.fillText(label, x + 52, y + 30);
    ctx.fillStyle = '#cfc6ee'; ctx.font = f2;
    lines.forEach((l, i) => ctx.fillText(l, x + 20, y + 58 + i * 22));
  }
  function drawTooltip() {
    if (!mouse.in || !G.hudIcons || G.mode === 'modal' || G.mode === 'pick') return;
    const mx = mouse.x, my = mouse.y + HUD;
    const hit = G.hudIcons.find((h) => mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h);
    if (!hit) return;
    const f1 = FONT(900, 18), f2 = FONT(700, 16);
    const lines = wrapLines(hit.desc, 340, f2);
    ctx.font = f1; const w = Math.max(ctx.measureText(hit.title).width, 340) + 24;
    const h = 36 + lines.length * 21;
    const x = clamp(mx - w / 2, 6, CW - w - 6), y = HUD + 6;
    ctx.fillStyle = 'rgba(12,9,24,0.96)'; rr(x, y, w, h, 10); ctx.fill();
    ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffe27a'; ctx.font = f1; ctx.textAlign = 'left'; ctx.fillText(hit.title, x + 12, y + 24);
    ctx.fillStyle = '#e8e2ff'; ctx.font = f2; lines.forEach((l, i) => ctx.fillText(l, x + 12, y + 46 + i * 21));
  }
  function drawHUD() {
    G.hudIcons = [];
    const run = G.run, p = run.player;
    const g = ctx.createLinearGradient(0, 0, 0, HUD);
    g.addColorStop(0, '#1d1833'); g.addColorStop(1, '#110e20');
    ctx.fillStyle = g; ctx.fillRect(0, 0, CW, HUD);
    ctx.fillStyle = '#3d3466'; ctx.fillRect(0, HUD - 3, CW, 3);
    // hearts
    const hs = p.maxHp > 10 ? 300 / p.maxHp : 30;
    for (let i = 0; i < p.maxHp; i++) {
      const x = 22 + i * hs, y = 20;
      ctx.save(); ctx.globalAlpha = i < p.hp ? 1 : 0.9;
      A.blit(ctx, A.heartSprite(p.hp >= i + 1 ? 'full' : p.hp >= i + 0.5 ? 'half' : 'empty'), x, y);
      ctx.restore();
    }
    // coins / edamame
    A.blit(ctx, A.coinSprite(0), 24, 46);
    textOut(String(run.gold), 40, 53, '#ffd23f', FONT(900, 18), 'left');
    A.blit(ctx, A.edamameSprite(), 110, 46);
    textOut(String(run.edamame), 128, 53, '#c3cf6e', FONT(900, 18), 'left');
    G.hudIcons.push({ x: 10, y: 34, w: 80, h: 26, title: `Coins: ${run.gold}`, desc: 'Spend them at the talking vending machine shop.' });
    G.hudIcons.push({ x: 94, y: 34, w: 64, h: 26, title: `Edamame eaten: ${run.edamame}`, desc: 'Dried edamame beans! Each one heals 1 heart and gives Protein Power (+50% damage for 10 seconds).' + (run.eddie ? ' Eddie the Edamame has joined your party!' : run.edamame < 5 ? ` Eat ${5 - run.edamame} more and something special happens...` : '') });
    G.hudIcons.push({ x: 8, y: 6, w: Math.min(310, 30 * p.maxHp), h: 28, title: `Hearts: ${p.hp} / ${p.maxHp}`, desc: 'Each hit takes half a heart. Wrong answers never cost hearts. Find hearts from monsters, shrines, the shop and the lounge couch.' });
    // dash
    const dk = p.dashCdT > 0 ? 1 - p.dashCdT / p.dashCd : 1;
    ctx.fillStyle = '#2a2445'; rr(166, 41, 66, 11, 5); ctx.fill();
    ctx.fillStyle = dk >= 1 ? '#7fe0d0' : '#4a8a80'; rr(166, 41, 66 * dk, 11, 5); ctx.fill();
    textOut('DASH', 238, 52, '#7fe0d0', FONT(900, 11), 'left');
    // floor & section (or the boss's health during a boss fight)
    const boss = G.enemies.find((e) => e.kind === 'boss');
    if (boss && G.mode !== 'cut') drawBossBar(boss);
    else {
      const sec = run.floor <= 5 ? SECTIONS[run.floor - 1] : null;
      const title = run.floor > 5 ? 'Final Floor' : `Floor ${run.floor} · ${run.theme.name}`;
      textOut(title, CW / 2, 26, '#ffffff', FONT(900, 21));
      let sub = `Solved ${run.stats.solved} · ⭐ ${run.stats.perfect}`;
      if (settings.mode === 'mixed' || !sec || !settings.sections[sec]) sub = 'Mixed questions  ·  ' + sub;
      else sub = `${sec} ${secName(sec).replace(' (Desmos)', '')}  ·  ` + sub;
      textOut(sub, CW / 2, 50, sec ? secColor(sec) : '#c9a7ff', FONT(800, 15));
    }
    // items (right side)
    const its = run.items.slice(-12);
    ctx.font = '19px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif'; ctx.textAlign = 'center';
    its.forEach((id, i) => {
      const it = itemById(id), x = CW - 22 - (i % 6) * 26, y = 26 + Math.floor(i / 6) * 26;
      if (!it) return;
      if (it.icon.startsWith('img:')) A.blit(ctx, A.edamameSprite(), x, y - 6);
      else ctx.fillText(it.icon, x, y);
      G.hudIcons.push({ x: x - 13, y: y - 20, w: 26, h: 26, title: it.name, desc: it.desc });
    });
    if (run.items.length > 12) textOut(`+${run.items.length - 12}`, CW - 180, 50, '#c9a7ff', FONT(900, 13));
  }
  function drawBossBar(b) {
    const w = 440, x = (CW - w) / 2, y = 38;
    textOut(b.name, CW / 2, 26, b.variant === 5 ? `hsl(${(G.t * 200) % 360},100%,70%)` : '#ff8a8a', FONT(900, 20));
    ctx.fillStyle = '#2a1a22'; rr(x, y, w, 14, 6); ctx.fill();
    ctx.fillStyle = b.shielded ? '#9ad8ff' : b.variant === 5 ? `hsl(${(G.t * 200) % 360},90%,60%)` : '#ff5f6d';
    rr(x, y, w * Math.max(0, b.hp / b.maxHp), 14, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (const th of b.thresholds) ctx.fillRect(x + w * th - 1, y - 2, 2, 18);
  }
  function drawMinimap() {
    const run = G.run, cell = 15, gap = 3;
    const rooms = [...run.rooms.values()].filter((r) => r.seen);
    if (!rooms.length) return;
    const xs = rooms.map((r) => r.gx), ys = rooms.map((r) => r.gy);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const w = (maxx - minx + 1) * (cell + gap) + 10, h = (maxy - miny + 1) * (cell * 0.7 + gap) + 10;
    const ox = CW - w - 12, oy = HUD + 12;
    ctx.fillStyle = 'rgba(10,8,20,0.6)'; rr(ox, oy, w, h, 8); ctx.fill();
    for (const r of rooms) {
      const x = ox + 5 + (r.gx - minx) * (cell + gap), y = oy + 5 + (r.gy - miny) * (cell * 0.7 + gap);
      ctx.fillStyle = r === run.cur ? '#ffffff' : r.visited ? '#7a7398' : '#3a3458';
      ctx.fillRect(x, y, cell, cell * 0.7);
      const icon = { boss: '#ff4d4d', treasure: '#ffd23f', vault: '#ffd23f', shop: '#6be38a', shrine: '#9fd3ff', lounge: '#ffe27a' }[r.type];
      if (icon) { ctx.fillStyle = icon; ctx.fillRect(x + 4, y + 2, cell - 8, cell * 0.7 - 4); }
    }
  }
  function drawBadges() {
    const run = G.run;
    let x = 14;
    const badge = (text, col) => {
      ctx.font = FONT(900, 14); const w = ctx.measureText(text).width + 18;
      ctx.fillStyle = 'rgba(12,9,24,0.85)'; rr(x, HUD + 8, w, 24, 8); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.fillText(text, x + 9, HUD + 25);
      x += w + 8;
    };
    if (run.hardcore) badge('💀 HARDCORE', '#ff5f6d');
    if (settings.teacherSkip) badge('TEACHER MODE: answers filled in', '#ff6b6b');
    else if (run.fun) badge('JUST FOR FUN: answers filled in', '#ffd23f');
    if (run.freeSolves > 0) badge(`🎟 Free solves: ${run.freeSolves}`, '#7fe0d0');
  }
  function drawBanner() {
    if (!G.banner) return;
    const b = G.banner;
    const a = Math.min(1, b.t);
    ctx.save();
    ctx.globalAlpha = a;
    const y = HUD + VH * 0.38;
    const g = ctx.createLinearGradient(0, 0, CW, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.2, 'rgba(0,0,0,0.7)'); g.addColorStop(0.8, 'rgba(0,0,0,0.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y - 56, CW, b.small ? 92 : 118);
    const col = b.boss ? '#ff6b6b' : (G.run.theme ? G.run.theme.accent : '#ffd23f');
    ctx.font = b.small ? PIX(20) : PIX(30);
    textOut(b.text, CW / 2, y - (b.small ? 6 : 0), col, b.small ? PIX(20) : PIX(30));
    textOut(b.sub || '', CW / 2, y + (b.small ? 24 : 36), '#f0eaff', FONT(800, 20));
    if (b.sec && settings.sections[b.sec]) textOut(`Questions from Section ${b.sec}: ${secName(b.sec)}`, CW / 2, y + 60, secColor(b.sec), FONT(900, 18));
    ctx.restore();
  }
  const PORTRAIT_WHO = {
    laporte: { name: 'Mr. Laporte', color: '#ffd23f' },
    you: { name: 'You', color: '#7fe6d4' },
    board: { name: 'Bulletin Board', color: '#ffccbc' },
    rank: { name: 'Rankenstein', color: '#b5dc9c', boss: 'rankenstein' },
    mono: { name: 'The Uniform Monolith', color: '#f4d89a', boss: 'monolith' },
    zed: { name: 'Zed', color: '#9ef0b8', boss: 'zed' },
    bell: { name: 'The Great Bellringer', color: '#ffe08a', boss: 'bell' },
    emp: { name: 'The Empirical Emperor', color: '#e8b0ff', boss: 'emperor' },
    guard: { name: 'Security', color: '#ff8a7a' },
  };
  function drawPortraitFor(who, line, x, y, size, talking) {
    ctx.fillStyle = A.OUTLINE; rr(x - 4, y - 4, size + 8, size + 8, 10); ctx.fill();
    if (who === 'laporte') {
      const lapActor = G.actors.find((a) => a.kind === 'laporte');
      const mane = line.mane != null ? line.mane : lapActor && lapActor.mane ? lapActor.mane : 0;
      const hair = line.hair != null ? line.hair : lapActor && lapActor.bald ? 0 : 100;
      A.drawPortrait(ctx, x, y, size, { expr: line.e || 'calm', talk: talking, t: G.t, mane, hair, bg: mane > 0 ? 'aura' : 'dungeon' });
      return;
    }
    ctx.fillStyle = '#241e40'; ctx.fillRect(x, y, size, size);
    const def = PORTRAIT_WHO[who] || {};
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
    if (def.boss) { const spr = A.bosses[def.boss](talking ? Math.floor(G.t * 6) % 2 : 0, false); ctx.imageSmoothingEnabled = false; ctx.drawImage(spr, x + size / 2 - spr.width * 0.5, y + 6, spr.width, spr.height); }
    else if (who === 'you') { const s = A.heroSprite(false, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(s, x + size / 2 - s.width, y + 10, s.width * 2, s.height * 2); }
    else if (who === 'guard') { const s = A.guardSprite(0); ctx.imageSmoothingEnabled = false; ctx.drawImage(s, x + size / 2 - s.width, y + 10, s.width * 2, s.height * 2); }
    else { ctx.font = '72px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('📌', x + size / 2, y + size / 2 + 26); }
    ctx.restore();
  }
  function drawTalk() {
    const tk = G.talk;
    if (!tk) return;
    const line = tk.lines[tk.i];
    const x = 16, h = 182, y = CH - h - 12, w = CW - 32;
    ctx.fillStyle = 'rgba(12,9,24,0.95)'; rr(x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.stroke();
    const ps = 148;
    const talking = tk.chars < line.t.length;
    drawPortraitFor(line.w, line, x + 16, y + 17, ps, talking);
    const def = PORTRAIT_WHO[line.w] || { name: line.w, color: '#fff' };
    const name = line.w === 'laporte' && (line.mane || (G.actors.find((a) => a.kind === 'laporte' && a.mane > 0.9))) ? 'SUPER MANE LAPORTE' : def.name;
    textOut(name, x + ps + 40, y + 36, def.color, FONT(900, 24), 'left');
    const font = FONT(800, 25);
    const lines = wrapLines(line.t, w - ps - 70, font);
    let shown = Math.floor(tk.chars);
    ctx.font = font; ctx.textAlign = 'left'; ctx.fillStyle = '#f4f0ff';
    lines.forEach((l, i) => {
      if (shown <= 0) return;
      const part = l.slice(0, shown);
      shown -= l.length + 1;
      ctx.fillText(part, x + ps + 40, y + 74 + i * 33);
    });
    if (!talking && Math.floor(G.t * 3) % 2) textOut('▼', x + w - 30, y + h - 18, '#ffd23f', FONT(900, 18));
    textOut('Enter / Space / click: next   ·   Esc: skip', x + w - 20, y + h - 14, 'rgba(200,190,240,0.55)', FONT(700, 13), 'right');
  }
  function drawBark() {
    const b = G.bark;
    if (!b || G.talk) return;
    const k = Math.min(1, b.age * 4, b.t * 3);
    const w = 560, ps = 76;
    const lines = wrapLines(b.text, w - ps - 40, FONT(800, 19));
    const h = Math.max(ps + 20, 26 + lines.length * 25);
    const x = 14, y = HUD + 40 - (1 - k) * 30;
    ctx.save(); ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(12,9,24,0.92)'; rr(x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.stroke();
    const maneOn = G.enemies.some((e) => e.kind === 'boss' && e.variant === 5) ? 1 : undefined;
    drawPortraitFor('laporte', { e: b.expr, mane: maneOn }, x + 10, y + 10, ps, b.age < Math.min(2.4, b.text.length / 30));
    ctx.font = FONT(800, 19); ctx.fillStyle = '#f4f0ff'; ctx.textAlign = 'left';
    lines.forEach((l, i) => ctx.fillText(l, x + ps + 26, y + 30 + i * 25));
    ctx.restore();
  }
  function drawTitleScene() {
    G.titleT += 1 / 60;
    const t = G.titleT;
    const g = ctx.createLinearGradient(0, 0, 0, CH);
    g.addColorStop(0, '#0c0a1c'); g.addColorStop(1, '#1d1236');
    ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
    for (let i = 0; i < 70; i++) { const x = (i * 157) % CW, y = (i * 89) % (CH * 0.6); ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.3 * Math.sin(t * 2 + i)})`; ctx.fillRect(x, y, 2, 2); }
    // glowing bell curve on the horizon
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = ['rgba(255,210,63,0.5)', 'rgba(210,156,255,0.35)', 'rgba(106,184,255,0.3)'][k]; ctx.lineWidth = 6 - k;
      ctx.beginPath();
      for (let x = 0; x <= CW; x += 6) { const z = (x - CW / 2) / 150; const y = CH * 0.78 - (260 + k * 12) * Math.exp(-z * z / 2) - Math.sin(t + k) * 4; if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#0a0814'; ctx.fillRect(0, CH * 0.78, CW, CH * 0.22);
    // characters on the sides
    const lap = { x: CW - 130, y: CH * 0.78 - 40, mane: 0, moving: false, face: -1, walkT: 0 };
    drawLaporte(lap);
    ctx.save(); ctx.translate(140, CH * 0.78 - 30); ctx.scale(1.4, 1.4); A.blit(ctx, A.heroSprite(false, Math.floor(t * 4) % 2 ? 1 : 0), 0, 0); ctx.restore();
    A.blit(ctx, A.slimeSprite('#3fd7c0', Math.floor(t * 3) % 3), 60, CH * 0.78 - 14);
    A.blit(ctx, A.batSprite('#9b6ad6', Math.floor(t * 8) % 2), 90, CH * 0.5 + Math.sin(t * 2) * 20);
    A.blit(ctx, A.ghostSprite('#d6ebff', Math.floor(t * 3) % 2), CW - 60, CH * 0.5 + Math.sin(t * 1.6) * 16, false, 0.6);
    for (const x of [40, CW - 40]) A.drawTorch(ctx, x, 120, t, 'rgba(255,170,90,1)');
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#07060d';
    ctx.fillRect(0, 0, CW, CH);
    if (!G.run || !G.room) { drawTitleScene(); return; }
    drawWorld();
    drawHUD();
    ctx.save(); ctx.translate(0, HUD); drawMinimap(); ctx.restore();
    drawBadges();
    drawBanner();
    drawPromptPanel();
    drawBark();
    drawTalk();
    drawTooltip();
    if (G.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, G.fade / 0.3)})`; ctx.fillRect(0, HUD, CW, VH); }
    if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, G.flash)})`; ctx.fillRect(0, 0, CW, CH); }
    if (G.deathT > 0) { ctx.fillStyle = `rgba(60,0,10,${0.6 * (1 - G.deathT / 1.4)})`; ctx.fillRect(0, HUD, CW, VH); }
  }

  // ================= screens =================
  function showScreen(id) {
    ['title', 'howto', 'settings', 'pause', 'end', 'pin', 'teacher'].forEach((s) => $(s).classList.toggle('hidden', s !== id));
    if (!id) { blurUI(); canvas.focus(); }
  }
  function pauseGame() {
    G.mode = 'paused';
    clearInput();
    $('pause-sound').textContent = 'Sound: ' + (settings.sound ? 'ON' : 'OFF');
    $('pause-note').textContent = G.floorSave ? `Your progress is saved at the start of Floor ${G.floorSave.floor}.` : '';
    showScreen('pause');
  }
  function resumeGame() { showScreen(null); G.mode = 'play'; clearInput(); }
  function reportCode(run) {
    const ini = (run.name || '').split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join('').slice(0, 3) || 'XX';
    return `F${run.won ? 6 : run.floor}-S${run.stats.solved}-A${run.stats.attempted}-P${run.stats.perfect}-${run.won ? 'W' : 'L'}${run.hardcore ? 'H' : ''}${ini}`;
  }
  function fmtTime(s) { const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }
  function showEnd(won) {
    const run = G.run;
    G.mode = 'end';
    clearInput();
    const hcOver = !won && run.hardcore;
    if (won) { store.del(SAVEKEY); if (!settings.funUnlocked) { settings.funUnlocked = true; saveSettings(); } } else run.deaths++;
    if (hcOver) { store.del(SAVEKEY); G.floorSave = null; } // hardcore: the run is over
    $('end-fun-row').classList.toggle('hidden', !won);
    $('end-fun').checked = !!settings.funMode;
    $('end-title').textContent = won ? '🏆 YOU BEAT THE DISTRIBUTION DUNGEON! 🏆' : hcOver ? '💀 Hardcore run over!' : 'Defeated!';
    const fctx = $('end-face').getContext('2d');
    A.drawPortrait(fctx, 0, 0, 32, { expr: won ? 'happy' : 'shocked', hair: won ? 0 : 100, t: 2, bg: 'dungeon' });
    const credit = run.freeSolves + run.floorSolved;
    $('end-sub').innerHTML = won ? `<b>Mr. Laporte:</b> ${escapeHTML(S.endWin)}`
      : `<b>Mr. Laporte:</b> ${escapeHTML(defeatLine())} ${escapeHTML(hcOver ? S.endLoseHardcore(run.floor) : S.endLose(run.floor, credit))}`;
    $('end-retry').textContent = `↻ Try Floor ${run.floor} again`;
    const s = run.stats;
    const rows = SECTIONS.filter((k) => s.bySec[k]).map((k) => `<tr><td><b style="color:${secColor(k)}">${k}</b> ${secName(k)}</td><td>${s.bySec[k].solved} / ${s.bySec[k].attempted}${s.bySec[k].perfect ? ` &nbsp;⭐${s.bySec[k].perfect}` : ''}</td></tr>`).join('');
    const hats = run.hats.map((h) => S.hats[h].emoji).join(' ');
    const pets = run.pets.map((p) => p.name).join(', ');
    $('end-stats').innerHTML = `
      <div class="end-name">${escapeHTML(run.name || 'Unnamed Hero')}</div>
      <div class="end-grid">
        <div><b>${won ? 'ALL' : run.floor}</b><span>${won ? 'floors cleared' : 'floor reached'}${run.hardcore ? ' (💀 hardcore)' : ''}</span></div>
        <div><b>${s.solved}</b><span>problems solved</span></div>
        <div><b>${s.perfect}</b><span>perfect solves ⭐</span></div>
        <div><b>${fmtTime(run.playTime)}</b><span>play time</span></div>
      </div>
      ${rows ? `<table class="end-table"><tr><th>Section</th><th>Solved / tried</th></tr>${rows}</table>` : '<p class="note" style="text-align:center">No problems tried yet.</p>'}
      <div class="end-extras">${hats ? 'Hats: ' + hats : ''}${pets ? ` &nbsp;·&nbsp; Friends: ${escapeHTML(pets)}` : ''}${run.edamame ? ` &nbsp;·&nbsp; Edamame eaten: ${run.edamame}` : ''}</div>
      <div class="end-code">Report code (screenshot this or copy it into your class form): <b>${reportCode(run)}</b></div>`;
    $('end-retry').classList.toggle('hidden', won || hcOver || !G.floorSave);
    $('end-again').classList.toggle('hidden', !won);
    $('end-restart').classList.toggle('hidden', !hcOver);
    showScreen('end');
  }
  function defeatLine() {
    const src = (G.lastHit || '').split(':').pop();
    const n = G.enemies.filter((e) => !e.dead).length;
    let pool = S.defeatLines[src] || S.defeatLines.generic;
    if (n < 2) pool = pool.filter((l) => !l.includes('{n}'));
    if (!pool.length) pool = S.defeatLines.generic.filter((l) => !l.includes('{n}'));
    return pick(pool).replace('{n}', String(n));
  }

  // ---- settings page ----
  function renderSettings() {
    const box = $('set-secs');
    box.innerHTML = '';
    SECTIONS.forEach((s) => {
      const lab = document.createElement('label');
      lab.className = 'sec-card' + (settings.sections[s] ? '' : ' off');
      lab.style.borderColor = settings.sections[s] ? secColor(s) : '';
      lab.innerHTML = `<input type="checkbox" ${settings.sections[s] ? 'checked' : ''}><div class="sn" style="color:${secColor(s)}">${s}</div><div class="sd">${secName(s)}</div><div class="sx"></div>`;
      lab.querySelector('input').onchange = (e) => {
        settings.sections[s] = e.target.checked;
        if (!enabledSections().length) { settings.sections[s] = true; $('set-warn').textContent = 'Keep at least one section turned on!'; }
        else $('set-warn').textContent = '';
        saveSettings(); renderSettings();
      };
      box.appendChild(lab);
    });
    for (const m of ['floor', 'mixed']) {
      const el = $('mode-' + m);
      el.classList.toggle('sel', settings.mode === m);
      const r = el.querySelector('input');
      r.checked = settings.mode === m;
      r.onchange = () => { settings.mode = m; saveSettings(); renderSettings(); };
    }
    $('set-extra').checked = !!settings.extra;
    $('set-fun-row').classList.toggle('hidden', !settings.funUnlocked);
    $('set-fun').checked = !!settings.funMode;
    $('set-sound').checked = !!settings.sound;
  }
  $('set-extra').onchange = (e) => { settings.extra = e.target.checked; saveSettings(); };
  $('set-sound').onchange = (e) => { settings.sound = e.target.checked; saveSettings(); };

  // ---- title buttons ----
  $('name').value = settings.name || '';
  $('name').addEventListener('input', () => { settings.name = $('name').value.trim(); saveSettings(); if (G.run) G.run.name = settings.name; });
  function refreshTitle() {
    const sv = store.get(SAVEKEY);
    $('btn-continue').classList.toggle('hidden', !sv);
    $('save-note').textContent = sv ? `Saved game found: Floor ${sv.run.floor}${sv.run.hardcore ? ' · 💀 Hardcore' : ''}${sv.run.name ? ' · ' + sv.run.name : ''} (${new Date(sv.when).toLocaleDateString()})` : '';
    $('hc').checked = !!settings.hardcore;
    $('hc-row').classList.toggle('on', !!settings.hardcore);
  }
  $('hc').onchange = (e) => { settings.hardcore = e.target.checked; saveSettings(); refreshTitle(); };
  function startRun() {
    audio();
    G.run = newRunState();
    G.run.name = settings.name || '';
    G.run.fun = !!(settings.funUnlocked && settings.funMode);
    G.run.hardcore = !!settings.hardcore;
    G.actors = []; G.texts = []; G.particles = []; G.deathT = 0; G.shake = 0; G.psy = 0; G.talk = null; G.bark = null; G.cut = null;
    if (G.startWithEdamame) { const it = itemById('edamame'); G.run.items.push('edamame'); it.apply(G.run.player); }
    const sf = clamp(Number(settings.startFloor) || 1, 1, 5);
    if (sf > 1) {
      // teacher playtest: jump ahead with a few upgrades, like a student would have
      newFloor(sf);
      for (let i = 0; i < (sf - 1) * 3; i++) { const it = rollItems(1)[0]; if (it) { G.run.items.push(it.id); it.apply(G.run.player); } }
      G.run.player.hp = G.run.player.maxHp;
      G.texts = [];
      saveRun();
      showScreen(null);
      G.mode = 'play';
      return;
    }
    newFloor(1);
    G.banner = null;
    saveRun();
    showScreen(null);
    G.mode = 'play';
    introCutscene();
  }
  function continueRun(data) {
    audio();
    G.run = restoreRun(data);
    G.actors = []; G.texts = []; G.particles = []; G.deathT = 0; G.shake = 0; G.psy = 0; G.talk = null; G.bark = null; G.cut = null;
    G.pbullets = []; G.ebullets = [];
    newFloor(G.run.floor);
    saveRun();
    showScreen(null);
    G.mode = 'play';
    startTalk(S.welcomeBack(G.run.floor));
  }
  $('btn-play').onclick = () => {
    if (store.get(SAVEKEY) && !confirm('Start a brand new game? Your saved game will be replaced.')) return;
    startRun();
  };
  $('btn-continue').onclick = () => { const sv = store.get(SAVEKEY); if (sv) continueRun(sv.run); };
  $('btn-howto').onclick = () => showScreen('howto');
  $('btn-settings').onclick = () => { renderSettings(); showScreen('settings'); };
  document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => { refreshTitle(); showScreen('title'); }));
  $('pause-resume').onclick = resumeGame;
  $('pause-sound').onclick = () => { settings.sound = !settings.sound; saveSettings(); $('pause-sound').textContent = 'Sound: ' + (settings.sound ? 'ON' : 'OFF'); };
  $('pause-quit').onclick = () => { G.mode = 'title'; G.run = null; G.room = null; refreshTitle(); showScreen('title'); };
  // ---- teacher options (PIN protected) ----
  const PIN_HASH = 'e4dea61a';
  function pinHash(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); }
  function renderTeacher() {
    $('t-skip').checked = !!settings.teacherSkip;
    $('t-floor').value = String(settings.startFloor || 1);
  }
  $('btn-teacher').onclick = () => {
    if (teacherUnlocked) { renderTeacher(); showScreen('teacher'); return; }
    $('pin-input').value = ''; $('pin-msg').textContent = '';
    showScreen('pin');
    setTimeout(() => $('pin-input').focus(), 30);
  };
  function checkPin() {
    if (pinHash($('pin-input').value.trim()) === PIN_HASH) { teacherUnlocked = true; renderTeacher(); showScreen('teacher'); }
    else { $('pin-msg').textContent = 'That PIN is not right.'; $('pin-input').value = ''; sfx.wrong(); }
  }
  DQ.pinHash = pinHash; // to change the PIN: DQ.pinHash('1234') in the console, then paste into PIN_HASH
  $('pin-ok').onclick = checkPin;
  $('pin-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') checkPin(); });
  $('t-skip').onchange = (e) => { settings.teacherSkip = e.target.checked; saveSettings(); };
  $('t-floor').onchange = (e) => { settings.startFloor = Number(e.target.value) || 1; saveSettings(); };
  $('t-back').onclick = () => { renderSettings(); showScreen('settings'); };
  $('pin-back').onclick = () => { renderSettings(); showScreen('settings'); };

  function retryFloor() {
    const dead = G.run;
    audio();
    G.run = restoreRun(G.floorSave);
    const run = G.run;
    run.stats = dead.stats; run.playTime = dead.playTime; run.deaths = dead.deaths; run.skipped = dead.skipped;
    run.freeSolves = dead.freeSolves + dead.floorSolved;
    run.flags = Object.assign({}, run.flags, { finalFight: dead.flags.finalFight, bossIntro5: dead.flags.bossIntro5 || run.flags.bossIntro5 });
    G.actors = []; G.texts = []; G.particles = []; G.deathT = 0; G.shake = 0; G.psy = 0; G.talk = null; G.bark = null; G.cut = null;
    G.pbullets = []; G.ebullets = [];
    newFloor(run.floor);
    saveRun();
    showScreen(null);
    G.mode = 'play';
    startTalk(S.retry(run.floor, run.freeSolves));
  }
  $('end-retry').onclick = () => { if (G.floorSave) retryFloor(); };
  $('end-again').onclick = () => startRun();
  $('end-restart').onclick = () => startRun();
  $('end-fun').onchange = (e) => { settings.funMode = e.target.checked; saveSettings(); };
  $('set-fun').onchange = (e) => { settings.funMode = e.target.checked; saveSettings(); };
  $('end-title-btn').onclick = () => { G.mode = 'title'; G.run = null; G.room = null; refreshTitle(); showScreen('title'); };

  // ================= debug helpers =================
  function debugKeys() {
    for (let f = 1; f <= 5; f++) if (pressed['Digit' + f]) { newFloor(f); return; }
    if (pressed.KeyB) { const b = G.run.boss; const adj = Object.values(b.doors)[0]; enterRoom(adj); enterRoom(b, Object.keys(b.doors)[0]); }
    if (pressed.KeyK) G.enemies.forEach((e) => { if (e.kind === 'boss') { e.shielded = false; e.shieldIdx = e.thresholds.length; damageEnemy(e, e.hp + 1, 0, 0); } else killEnemy(e); });
    if (pressed.KeyH) G.run.player.hp = G.run.player.maxHp;
    if (pressed.KeyI) giveItem(pick(ITEMS));
    if (pressed.KeyL) { const r = [...G.run.rooms.values()].find((x) => x.type === 'lounge'); if (r) enterRoom(r, Object.keys(r.doors)[0]); }
  }
  DQ.debug = {
    G, settings, newFloor, enterRoom, giveItem, itemById, makeEnemy, ITEMS, LOUNGE_ITEMS, interact, startRun, startSecurity, laporteHelp, startTwist, gainEdamame, addPet, showEnd,
    gotoBoss(f) { if (f) newFloor(f); const b = G.run.boss; enterRoom(b, Object.keys(b.doors)[0]); },
    gotoType(type) { const r = [...G.run.rooms.values()].find((x) => x.type === type); if (r) enterRoom(r, Object.keys(r.doors)[0]); return !!r; },
    killAll() { G.enemies.forEach((e) => { if (e.kind === 'boss') { e.shielded = false; e.shieldIdx = e.thresholds.length; damageEnemy(e, e.hp + 1, 0, 0); } else killEnemy(e); }); },
    skipTalk() { if (G.talk) finishTalk(); },
    curProblem() { return M.obj && M.obj.problem; },
    hurt() { hurtPlayer('test'); },
    startStampede,
    sectionFor,
    openTest(sec) { const o = { kind: 'chest', x: 0, y: 0 }; settings.mode = 'mixed'; o.problem = PR.generate(sec, {}); o.pst = { wrong: 0, hints: 0, revealed: false, sel: {} }; openProblem(o, { icon: '🔒', title: 'Stat Chest', reward: 'Reward: test', onSolve: () => {} }); },
  };

  // ================= main loop =================
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    if (G.run && G.room) {
      let dtg = dt;
      if (G.slowmo > 0) { G.slowmo -= dt; dtg = dt * 0.3; }
      if (G.mode === 'play') { update(dtg); updateWorldFx(dtg); }
      else if (G.mode === 'talk') { updateTalk(dt); updateWorldFx(dt); updateActors(dt * 0); }
      else if (G.mode === 'cut') { updateCut(dt); updateActors(dt); updateWorldFx(dt); if (G.deathT <= 0) for (const tm of G.timers) { tm.t -= dt; if (tm.t <= 0 && !tm.done) { tm.done = true; tm.fn(); } } G.timers = G.timers.filter((tm) => !tm.done); }
    }
    for (const k in pressed) delete pressed[k];
    mouse.clicked = false;
    draw();
    requestAnimationFrame(frame);
  }
  refreshTitle();
  showScreen('title');
  requestAnimationFrame(frame);
})();
