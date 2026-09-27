// 밸런스 계측 — 무한 골드 봇이 아니라 "정직한 플레이어"로 한 판을 끝까지 돌립니다.
// 골드·소환권·최적화 토큰을 전부 실제 획득분만 쓰고, 유닛은 경로를 잘 덮는 칸에 놓습니다.
// (무작위로 놓고 재면 설치칸이 넓은 가로맵이 부당하게 불리하게 나옵니다.)
//
//   node tests/balance.js              현재 수치로 8판
//   node tests/balance.js 16           16판
//   node tests/balance.js 8 detail     웨이브별 표까지
//   node tests/balance.js 8 vs         개편 전 수치와 나란히 비교
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const SRC = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

// 개편 전 수치 — 같은 봇으로 재야 비교가 성립합니다.
// 게임 파일의 해당 줄이 바뀌면 여기도 같이 고쳐야 합니다(치환 실패 시 즉시 예외로 알려줍니다).
const LEGACY = [
  ['const waveCount = w => Math.round(COUNT_C0 + w*COUNT_C1 + w*w*COUNT_C2);',
   'const waveCount = w => Math.min(30, 7 + Math.floor(w*0.55));'],
  ['const hw = mobHpWave(w);', 'const hw = w;'],
  ['const baseMul  = growth(hw, 1.0115, 1.13340);', 'const baseMul  = growth(hw, 1.020, 1.1512);'],
  ['const eliteMul = growth(hw, 1.0095, 1.11142);', 'const eliteMul = growth(hw, 1.018, 1.1289);'],
  [/const ARENA_HP   = [\d.]+;/, 'const ARENA_HP   = 6;'],
  [/const LIFE_BASE = [\d.]+, MEM_PER_LV = [\d.]+;/, 'const LIFE_BASE = 20, MEM_PER_LV = 2;'],
  ['const spawnGapFor = q => S.arena ? 1 / ARENA_BURST_RATE\n  : Math.max(1 / SPAWN_RATE_MAX, SPAWN_WINDOW / Math.max(1, q));',
   'const spawnGapFor = q => S.arena ? 0.18 : 0.32;'],
  ['S.prep = S.arena ? arenaGapFor(S.waveN || 30, S.wave) : 1.5;', 'S.prep = 1.5;'],
  [/const arenaCap = w => Math\.round\(Math\.max\(140, waveCount\(w\) \* [\d.]+\)\);/,
   'const arenaCap = w => 100;'],
  ['const waveCleared = () => !S.queue.length &&\n  (!S.enemies.length || (S.arena && S.wave < S.maxWave));',
   'const waveCleared = () => !S.queue.length && !S.enemies.length;'],
];

function load(wide, tweaks) {
  let src = SRC;
  for (const [a, b] of (tweaks || [])) {
    if (a instanceof RegExp) {                 // 수치만 바뀌는 줄은 정규식으로 잡습니다
      if (!a.test(src)) throw new Error('수치 치환 실패(정규식): ' + a);
      src = src.replace(a, b);
    } else {
      if (!src.includes(a)) throw new Error('수치 치환 실패: ' + a.slice(0, 60));
      src = src.split(a).join(b);
    }
  }
  const mk = () => ({
    classList: {add(){}, remove(){}, toggle(){}, contains: () => false}, style: {},
    appendChild(){}, removeChild(){}, remove(){}, querySelector: () => null, querySelectorAll: () => [],
    addEventListener(){}, getContext: () => ctx,
    getBoundingClientRect: () => ({left:0, top:0, width:1, height:1}),
    set innerHTML(v){}, get innerHTML(){ return ''; }, textContent: '', children: [],
    parentElement: {style:{}, onclick:null, classList:{add(){}, remove(){}, toggle(){}, contains:()=>false}},
    scrollTop: 0, scrollHeight: 0, offsetWidth: 0, dataset: {}, disabled: false, onclick: null,
  });
  const ctx = new Proxy({}, {
    get: (t, k) => k === 'canvas' ? {width:768, height:432} : (typeof k === 'string' ? () => {} : undefined),
    set: () => true,
  });
  global.document = {getElementById:mk, createElement:mk, querySelectorAll:()=>[],
                     querySelector:()=>null, addEventListener(){}, body:mk()};
  global.matchMedia = () => ({matches: wide});
  global.performance = {now: () => 0};
  global.requestAnimationFrame = () => {}; global.addEventListener = () => {};
  global.setTimeout = () => 0; global.clearTimeout = () => {};
  const api = {};
  const names = ['S','step','startWave','summon','summonCost','autoMerge','craft','recipeStatus',
    'transcend','transStatus','buyResearch','optimize','optLv','OPT_MAX','draftRoll','draftTake',
    'pickSummon','place','U','RESEARCH','COLS','ROWS','TS','pathSet','arenaBlockSet',
    'ARENA_FROM','arenaCap','RECIPES','TRANS','pickAugment','AUGMENT_WAVES'];
  new Function('__x', src + '\n' + names.map(k => '__x.' + k + '=' + k + ';').join(''))(api);
  return api;
}

// 경로를 잘 덮는 칸부터 순위를 매깁니다 (사거리 2.5칸 안에 들어오는 경로칸 수).
function rankTiles(g, arena) {
  const set = arena ? g.arenaBlockSet : g.pathSet;
  const road = [...set].map(k => k.split(',').map(Number))
                       .filter(p => p[0] >= 0 && p[1] >= 0 && p[0] < g.COLS && p[1] < g.ROWS);
  const out = [];
  for (let y = 0; y < g.ROWS; y++) for (let x = 0; x < g.COLS; x++) {
    if (set.has(x + ',' + y)) continue;
    let c = 0;
    for (const r of road) if ((r[0]-x)*(r[0]-x) + (r[1]-y)*(r[1]-y) <= 6.25) c++;
    out.push({x, y, c});
  }
  return out.sort((a, b) => b.c - a.c);
}

// 실제 플레이어처럼, 노는 좋은 칸이 있으면 유닛을 옮깁니다.
function reseat(g, ranked) {
  const S = g.S;
  const score = new Map();
  for (const t of ranked) score.set(t.x + ',' + t.y, t.c);
  const taken = new Set(S.units.map(u => u.tx + ',' + u.ty));
  const free = ranked.filter(t => !taken.has(t.x + ',' + t.y));
  const mine = S.units.map(u => ({u, c: score.get(u.tx + ',' + u.ty) || 0}))
                      .sort((a, b) => a.c - b.c);
  let fi = 0;
  for (const m of mine) {
    while (fi < free.length && free[fi].c <= m.c) fi++;
    if (fi >= free.length) break;
    const t = free[fi++];
    m.u.tx = t.x; m.u.ty = t.y;
    m.u.x = t.x * g.TS + g.TS / 2; m.u.y = t.y * g.TS + g.TS / 2;
  }
}

// 드래프트는 '고르는' 수단입니다. 무작위로 집으면 사람이 쓰는 방식과 전혀 달라지고,
// 후보 풀에 유닛을 추가하는 변경이 부당하게 나쁘게 나옵니다.
// 아직 못 만든 조합식에 필요한 재료를 우선 고릅니다 — 사람이 하는 판단과 같은 기준입니다.
function pickDraft(g) {
  const S = g.S;
  if (!S.draft) return 0;
  const have = {};
  for (const u of S.units) have[u.id] = (have[u.id] || 0) + 1;
  const made = new Set(S.units.map(u => u.id));
  // 아직 없는 신화가 요구하는 재료마다 '얼마나 모자란지' 를 셉니다
  const want = {};
  for (const r of g.RECIPES) {
    if (made.has(r.id)) continue;
    const need = {};
    for (const m of r.need) need[m] = (need[m] || 0) + 1;
    for (const m of Object.keys(need)) {
      const short = need[m] - (have[m] || 0);
      if (short > 0) want[m] = (want[m] || 0) + short;
    }
  }
  let bi = 0, bs = -1;
  S.draft.forEach((d, i) => {
    // 재료 수요 우선, 같으면 높은 등급
    const sc = (want[d.id] || 0) * 10 + g.U[d.id].t;
    if (sc > bs) { bs = sc; bi = i; }
  });
  return bi;
}
// 증강은 '고르는' 수단입니다. 무작위로 집으면 드래프트 때와 똑같은 편향이 생깁니다.
// 조건부 카드는 지금 보드가 그 조건을 만족할 때만 값을 쳐줍니다.
// 증강은 '고르는' 수단입니다. 무작위로 집거나, 효과 숫자의 크기만 보면 편향이 생깁니다.
// (실제로 첫 버전이 그랬습니다: autoscaleRange 0.6 을 damage 0.10 보다 6배로 쳐서
//  '전체 공격력 +10%' 를 한 번도 안 집었습니다. 단위가 다른 값을 그대로 비교한 탓입니다.)
// 그래서 '1 단위가 판에 얼마나 값어치 있는가' 를 키마다 따로 매깁니다.
const AUG_WEIGHT = {
  damage:300, speed:280, shortDamage:150, longDamage:150, aoe:160, single:120,
  canary:90, ult:90, hardware:90, boss:60, gold:40, slow:200, lockSlow:50,
  stealth:40, shield:60, autoscaleRange:40, fanout:35, merge:40, optCost:30,
  tickets:25, leakHalf:60, arenaCap:80, rollout:6000, summonGrowth:1800,
  memory:2.5, cap:14, mythCap:30, blueGreen:1.5, spot:0.0033,
  // 대가는 같은 잣대로 깎습니다
  hp:-250, ultPenalty:-90, aoePenalty:-160, singlePenalty:-120,
};
function pickAugmentIdx(g) {
  const S = g.S, ch = S.augmentChoices || [];
  const n = S.units.length;
  const score = a => {
    const e = a.e || {};
    let v = 0;
    for (const k of Object.keys(e)) {
      const x = e[k];
      if (k === 'monolith')   { v += n <= 10 ? x * 300 : 0; continue; }   // 조건 미달이면 0
      if (k === 'scale')      { v += n >= 22 ? x * 280 : 0; continue; }
      if (k === 'skill')      { v += (x - 1) * 120; continue; }           // 배수형
      v += x * (AUG_WEIGHT[k] ?? 50);
    }
    return v;
  };
  let bi = 0, bs = -1e9;
  ch.forEach((a, i) => { const v = score(a); if (v > bs) { bs = v; bi = i; } });
  return bi;
}
function playTurn(g, ranked) {
  const S = g.S;
  if (S.augmentAwait && S.augmentChoices) g.pickAugment(pickAugmentIdx(g));
  if (S.tk.draft > 0) { g.draftRoll(); g.draftTake(pickDraft(g)); }
  while (S.tk.tier >= 4 && S.units.length < S.cap) g.pickSummon(4);
  while (S.gold >= g.summonCost() && S.units.length < S.cap * 0.85) g.summon();
  g.autoMerge();
  g.recipeStatus().forEach((s, i) => { if (s.ok) g.craft(i); });
  g.transStatus().forEach((s, i) => { if (s.ok) g.transcend(i); });
  if (S.optTk > 0) {
    const list = S.units.filter(u => g.U[u.id].t >= 5 && g.optLv(u) < g.OPT_MAX)
                        .sort((x, y) => g.U[y.id].t - g.U[x.id].t);
    for (const u of list) { if (S.optTk <= 0) break; S.sel = u; g.optimize(u); }
  }
  for (const r of g.RESEARCH) {
    let n = 0;
    while (S.gold > g.summonCost() * 3 && n++ < 3) {
      const before = S.res[r.k];
      g.buyResearch(r.k);
      if (S.res[r.k] === before) break;
    }
  }
  reseat(g, ranked);
}

function run(wide, tweaks) {
  const g = load(wide, tweaks);
  const S = g.S;
  const ranked = {normal: rankTiles(g, false), arena: rankTiles(g, true)};
  const waves = [];
  let peak = 0, prevWave = 0, wStart = 0, lifeAt = S.life, err = null, stall = 0, snakeAt = null;
  g.startWave();
  // 한 웨이브가 STALL_LIMIT 초를 넘기면 교착으로 보고 그 판을 끊습니다.
  // (개편 전 수치의 아레나는 낙오자 하나 때문에 영원히 끝나지 않을 수 있습니다.)
  // 마지막 웨이브는 누적된 적을 전부 처리해야 끝나므로 시간을 넉넉히 줍니다.
  const STALL_LIMIT = 600;
  for (let i = 0; i < 3000000 && !S.over && S.wave <= S.maxWave; i++) {
    if (S.playT - wStart > STALL_LIMIT) { stall++; break; }
    if (i % 20 === 0) {
      try { playTurn(g, S.arena ? ranked.arena : ranked.normal); }
      catch (e) { err = e; break; }
    }
    if (S.wave !== prevWave) {
      if (prevWave) waves.push({w: prevWave, t: +(S.playT - wStart).toFixed(1), peak,
        units: S.units.length, myth: S.units.filter(u => g.U[u.id].t >= 5).length,
        lost: lifeAt - S.life, life: S.life, gold: Math.round(S.gold)});
      prevWave = S.wave; wStart = S.playT; peak = 0; lifeAt = S.life;
    }
    peak = Math.max(peak, S.enemies.length);
    if (S.snake && snakeAt === null) snakeAt = S.playT;
    g.step(0.05);
    if (S.phase === 'prep') S.prep = 0;      // 준비 시간은 계측에서 뺍니다
    if (S.holdArena) S.holdArena = false;
  }
  const why = err ? '오류' : stall ? '교착(웨이브 안 끝남)'
            : (S.snake && S.over && !S.snake.dead) ? '우로보로스에게 패배'
            : (S.wave >= S.maxWave && S.finalDown && S.life > 0) ? '★클리어'
            : !S.over ? '완주(생존)' : S.life <= 0 ? '메모리 소진'
            : S.enemies.length >= g.arenaCap(S.wave) * 0.9 ? '아레나 포화'
            : (S.wave >= S.maxWave ? '최종 보스 놓침' : '기타');
  return {reached: S.wave, over: S.over, life: S.life, waves, err, why, wide,
          augs: S.augments.length, augList: S.augments.map(a => a.n),
          snake: S.snake ? {won: !!S.snake.dead, t: S.playT - snakeAt, lap: S.snake.lap,
                            left: S.snake.hp / S.snake.max, N: S.snake.N} : null,
          units: S.units.length, myth: S.units.filter(u => g.U[u.id].t >= 5).length,
          trans: S.units.filter(u => g.U[u.id].t === 6).length};
}

const med = a => { const s = [...a].sort((x, y) => x - y); return s[(s.length / 2) | 0]; };
const BANDS = [[1,20],[21,40],[41,60],[61,80],[81,96],[97,120]];

function report(name, runs) {
  const reached = runs.map(r => r.reached).sort((x, y) => x - y);
  const why = {};
  for (const r of runs) why[r.why] = (why[r.why] || 0) + 1;
  console.log('\n■ ' + name);
  console.log('  각 판: ' + runs.map(r => r.reached + (r.wide ? '가' : '세') + '[' + r.why + ']').join(' '));
  console.log('  도달 중앙 ' + med(reached) + ' · 최소 ' + reached[0] + ' · 최대 ' + reached[reached.length-1]);
  console.log('  결과: ' + Object.entries(why).map(e => e[0] + ' ' + e[1]).join(' · '));
  console.log('  구간 | 클리어(초) | 최대동시 중앙 | 최대동시 최대 | 웨이브당 유출');
  for (const b of BANDS) {
    const all = runs.flatMap(r => r.waves.filter(w => w.w >= b[0] && w.w <= b[1]));
    if (!all.length) { console.log('  ' + b[0] + '-' + b[1] + ' | (도달 못함)'); continue; }
    console.log('  ' + b[0] + '-' + b[1]
      + ' | ' + med(all.map(w => w.t)).toFixed(1)
      + ' | ' + med(all.map(w => w.peak))
      + ' | ' + Math.max(...all.map(w => w.peak))
      + ' | ' + (all.reduce((s, w) => s + w.lost, 0) / all.length).toFixed(2));
  }
}

module.exports = {run, report, med, BANDS, LEGACY};
if (require.main !== module) return;

const N = parseInt(process.argv[2] || '8', 10);
const mode = process.argv[3] || '';
const cur = [];
for (let i = 0; i < N; i++) cur.push(run(i % 2 === 0));
if (cur[0].err) console.log('오류: ' + cur[0].err.message + '\n' + (cur[0].err.stack || '').split('\n').slice(1, 4).join('\n'));
report('현행 수치', cur);
if (mode === 'vs') {
  const old = [];
  for (let i = 0; i < N; i++) old.push(run(i % 2 === 0, LEGACY));
  report('개편 전 수치 (대조군)', old);
}
if (mode === 'detail') {
  const r = cur.slice().sort((a, b) => b.waves.length - a.waves.length)[0];
  console.log('\nwave | 초 | 최대동시 | 유닛 | 신화+ | 유출 | 메모리 | 골드');
  for (const w of r.waves) if (w.w % 5 === 0 || w.w >= 95)
    console.log(w.w + ' | ' + w.t + ' | ' + w.peak + ' | ' + w.units + ' | ' + w.myth + ' | ' + w.lost + ' | ' + w.life + ' | ' + w.gold);
}
