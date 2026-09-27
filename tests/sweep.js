// 밸런스 상수 스윕 — 게임 파일을 고치지 않고 후보 수치들을 나란히 재봅니다.
// tests/balance.js 의 봇을 그대로 씁니다. 치환 문자열이 게임 파일과 어긋나면 즉시 예외로 알려줍니다.
//
//   node tests/sweep.js            기본 후보들 × 6판
//   node tests/sweep.js 12         후보당 12판
const {run, med, BANDS} = require('./balance.js');

const R = (a, b) => [a, b];

// ── 손잡이들 (한 후보 안에서 같은 줄을 두 번 치환하면 실패합니다)
const RATE  = n => R('const SPAWN_RATE_MAX = 6.5;', 'const SPAWN_RATE_MAX = ' + n + ';');
const AHP   = v => R('const ARENA_HP   = 0.45;', 'const ARENA_HP   = ' + v + ';');
const CREEP = v => R('const ARENA_HP_CREEP = 0.15;', 'const ARENA_HP_CREEP = ' + v + ';');
const COUNT = v => R('COUNT_C2 = 0.006', 'COUNT_C2 = ' + v);
const LIFE  = (b, m) => R('const LIFE_BASE = 40, MEM_PER_LV = 4;',
                          'const LIFE_BASE = ' + b + ', MEM_PER_LV = ' + m + ';');
const LATE  = v => R('const LATE_FROM = 70, LATE_CREEP = 0.40;',
                     'const LATE_FROM = 70, LATE_CREEP = ' + v + ';');
const CAP   = v => R('const arenaCap = w => Math.round(Math.max(140, waveCount(w) * 3.6));',
                     'const arenaCap = w => Math.round(Math.max(140, waveCount(w) * ' + v + '));');
const INFLOW = (f, t) => R('const ARENA_INFLOW_FROM = 7, ARENA_INFLOW_TO = 10;',
                           'const ARENA_INFLOW_FROM = ' + f + ', ARENA_INFLOW_TO = ' + t + ';');
const BURST = b => R('const ARENA_BURST_RATE = 16;', 'const ARENA_BURST_RATE = ' + b + ';');

// 새로 넣은 유닛을 통째로 빼는 스위치. U 를 정의한 뒤 BY_TIER 를 만들기 직전에 지우면
// 소환/합성 풀에서 완전히 빠집니다 — 유닛 추가가 밸런스에 준 영향만 따로 재려고 씁니다.
const NO_NEW_UNITS = R('const IDS = Object.keys(U);',
  'delete U.pipe; delete U.rb; delete U.tx;\nconst IDS = Object.keys(U);');
// 잠금 반경을 되돌립니다(수정 전: 대상 한 마리만).
const NO_LOCK_R = [R("sp:{t:'lock',dur:1.3,r:1.6}", "sp:{t:'lock',dur:1.3}"),
                   R("sp:{t:'lock',dur:1.1,r:2.4}", "sp:{t:'lock',dur:1.1}")];

const ADJ = v => R('const PACE = 1.3, HP_ADJ = 1.56;',
                   'const PACE = 1.3, HP_ADJ = ' + v + ';');

// "몹 스펙을 더 올려도 되겠다" — 어느 손잡이가 실제로 듣는지부터 봅니다.
// 체력 곡선은 개편 초기에 '거의 무영향' 으로 나왔지만, 그건 아레나 벽에 가려진 결과였습니다.
// 병목이 풀린 지금은 다시 재봐야 합니다.
const SPEED = v => R('const PACE = 1.3, HP_ADJ = 0.78;',
                     'const PACE = ' + v + ', HP_ADJ = 0.78;');

// 체력은 ×1.5 까지 올려도 결과가 안 움직였습니다. 어디서부터 실제로 아픈지 상한을 찾습니다.
// (안 아프다는 건 곧 '올려도 안 깨진다' 는 뜻이라, 체감을 위해 올릴 여지가 큽니다)
// 체력 배수를 같은 세션에서 나란히 재야 배치 노이즈에 속지 않습니다.
// (같은 설정이 다른 배치에서 클리어 1/14 와 5/14 를 오간 전력이 있습니다)
const NOAUG = R('const AUGMENT_WAVES = [8,24,48,72,96];', 'const AUGMENT_WAVES = [];');
// 증강이 난이도를 얼마나 밀어올렸는지, 그리고 몹 체력으로 얼마나 되돌릴지.
const CANDIDATES = [
  ['증강 없음 (기준선)',        [NOAUG]],
  ['증강 있음 · 체력 ×2.0',     []],
  ['증강 있음 · 체력 ×2.5',     [ADJ(1.95)]],
  ['증강 있음 · 체력 ×3.0',     [ADJ(2.34)]],
];





const N = parseInt(process.argv[2] || '6', 10);
console.log('후보당 ' + N + '판 (가로/세로 교대)\n');
const head = '이름'.padEnd(28) + '도달중앙  클리어  구간별 최대동시(중앙) 20/40/60/80/96/120   유출 61-96';
console.log(head);
console.log('-'.repeat(head.length));
for (const [name, tw] of CANDIDATES) {
  const runs = [];
  for (let i = 0; i < N; i++) runs.push(run(i % 2 === 0, tw));
  const reached = runs.map(r => r.reached);
  const clear = runs.filter(r => r.why === '★클리어').length;
  const conc = BANDS.map(b => {
    const all = runs.flatMap(r => r.waves.filter(w => w.w >= b[0] && w.w <= b[1]));
    return all.length ? med(all.map(w => w.peak)) : '-';
  });
  const late = runs.flatMap(r => r.waves.filter(w => w.w >= 61 && w.w <= 96));
  const leak = late.length ? (late.reduce((s, w) => s + w.lost, 0) / late.length).toFixed(2) : '-';
  console.log(name.padEnd(28)
    + String(med(reached)).padEnd(10)
    + (clear + '/' + N).padEnd(8)
    + conc.join('/').padEnd(37)
    + leak);
}
