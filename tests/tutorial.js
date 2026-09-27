// 부스용 튜토리얼 검증 — 사람이 안내대로 조작했을 때 모든 단계가 넘어가는지,
// 조작하지 않으면 멈춰 있는지, 끝나면 깨끗한 새 판이 시작되는지 확인합니다.
//
//   node tests/tutorial.js
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const src = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

const store = {}, cls = {};
const mk = id => ({
  classList: {
    add(c){ (cls[id] = cls[id] || new Set()).add(c); },
    remove(c){ (cls[id] = cls[id] || new Set()).delete(c); },
    toggle(c, on){ const s = (cls[id] = cls[id] || new Set()); (on === undefined ? !s.has(c) : on) ? s.add(c) : s.delete(c); },
    contains: c => (cls[id] || new Set()).has(c),
  },
  style: {}, appendChild(){}, removeChild(){}, remove(){},
  querySelector: () => null, querySelectorAll: () => [], addEventListener(){}, setPointerCapture(){},
  getContext: () => ctx, getBoundingClientRect: () => ({left:0, top:0, width:100, height:40}),
  set innerHTML(v){ store[id] = v; }, get innerHTML(){ return store[id] || ''; },
  textContent: '', children: [], dataset: {}, disabled: false, onclick: null,
  parentElement: {style:{}, onclick:null, getBoundingClientRect: () => ({left:0, top:0, width:80, height:30}),
                  classList:{add(){}, remove(){}, toggle(){}, contains:() => false}},
  scrollTop: 0, scrollHeight: 0, offsetWidth: 0,
});
const els = {};
const ctx = new Proxy({}, {get: (t, k) => k === 'canvas' ? {width:768, height:432} : (typeof k === 'string' ? () => {} : undefined), set: () => true});
global.window = {};
global.document = {getElementById: id => (els[id] = els[id] || mk(id)), createElement: mk,
                   querySelectorAll: () => [], querySelector: () => null, addEventListener(){}, body: mk('body')};
global.matchMedia = () => ({matches: true});
global.performance = {now: () => 0};
global.requestAnimationFrame = () => {}; global.addEventListener = () => {};
global.setTimeout = f => { if (typeof f === 'function') f(); return 0; }; global.clearTimeout = () => {};

const g = {};
new Function('__x', src + '\n' + ['S','SHEET','TUT_STEPS','showTutorial','tutTick','tutGo','endTutorial','step',
  'summon','mergeOnce','sellSelected','draftRoll','draftTake','craft','RECIPES','buyResearch','openSheet',
  'pickAugment','setSpeed','freeTiles','U','startWave'].map(k => '__x.' + k + '=' + k + ';').join(''))(g);
const S = g.S;

let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log('  ' + (c ? '✓' : '✗') + ' ' + m); };
// 한 프레임 = 튜토리얼 판정 + (멈춰 있지 않으면) 게임 진행
const frame = (dt = 0.05) => { g.tutTick(dt); if (!S.over && !S.paused) for (let i = 0; i < S.speed; i++) g.step(dt); };
// 조작 후 단계가 넘어갈 때까지 기다립니다
function waitNext(from, maxFrames = 4000){
  for (let i = 0; i < maxFrames; i++){ frame(); if (!S.tut || S.tut.i !== from) return true; }
  return false;
}

// 사람이 하는 조작 — 단계 제목별
const ACT = {
  '소환':               () => g.summon(),
  '유닛 살펴보기':       () => { S.sel = S.units[0]; },
  '옮기기':             () => { const u = S.units[0], t = g.freeTiles()[0]; u.tx = t[0]; u.ty = t[1]; },
  '병력 늘리기':         () => { while (S.units.length < 4) g.summon(); },
  '첫 전투':            () => {},                                   // 지켜보기만 합니다
  '합성':               () => g.mergeOnce(),
  '판매':               () => { S.sel = S.units[S.units.length - 1]; g.sellSelected(); g.sellSelected(); },
  '소환소 · 드래프트권':  () => { g.draftRoll(); g.draftTake(0); },
  '조합 — 신화 만들기':   () => g.craft(g.RECIPES.findIndex(r => r.id === 'dfs')),
  '연구소':             () => g.buyResearch('atk'),
  '다음 웨이브 미리보기':  () => g.openSheet('wave', '웨이브 정보'),
  '증강':               () => g.pickAugment(0),
  '배속':               () => g.setSpeed(S.speed === 1 ? 2 : 1),
};

let started = 0;
console.log('── 조작 없이 두면 멈춰 있는가');
g.showTutorial(() => { started++; g.startWave(); });
for (let i = 0; i < 400; i++) frame();
ok(S.tut && S.tut.i === 0, '20초 동안 아무것도 안 하면 1단계에 머뭅니다');
ok(S.wave === 0, '튜토리얼 중엔 웨이브가 저절로 시작되지 않습니다');

console.log('\n── 안내대로 조작하면 단계가 넘어가는가 (' + g.TUT_STEPS.length + '단계)');
for (let i = 0; i < g.TUT_STEPS.length - 1; i++){
  const st = g.TUT_STEPS[S.tut.i];
  const act = ACT[st.t];
  if (!act){ ok(false, st.t + ' — 조작이 정의되지 않음'); break; }
  act();
  const moved = waitNext(S.tut.i);
  ok(moved, (i + 1) + '. ' + st.t);
  if (!moved) break;
  if (st.fight){
    const w = S.wave;
    for (let k = 0; k < 400; k++) frame();
    ok(S.wave === w, '    전투 단계가 끝나면 다음 웨이브가 저절로 시작되지 않습니다');
  }
}

console.log('\n── 마지막 단계 → 실전 시작');
ok(S.tut && S.tut.i === g.TUT_STEPS.length - 1, '마지막 단계(준비 완료)에 도착');
g.endTutorial();
ok(S.tut === null, '튜토리얼 상태가 비워집니다');
ok(started === 1, '실전 웨이브가 한 번 시작됩니다');
ok(S.wave === 1, '새 판은 웨이브 1부터');
ok(S.gold === 300, '튜토리얼 골드는 사라지고 시작 골드 300 (' + S.gold + ')');
ok(S.units.length === 0, '튜토리얼 유닛도 사라집니다');
ok(S.augments.length === 0 && S.stat.myth === 0, '증강·신화 기록도 초기화');
ok(S.speed === 2, '실전은 2배속으로 시작 (' + S.speed + ')');
ok(cls['coach'] && cls['coach'].has('hide'), '안내 말풍선이 닫힙니다');

console.log('\n── 도중에 건너뛰기');
started = 0;
g.showTutorial(() => started++);
g.summon(); waitNext(0);
g.endTutorial();
ok(S.tut === null && started === 1 && S.units.length === 0, '중간에 건너뛰어도 깨끗한 새 판으로 시작');

console.log('\n── 증강 단계에서 건너뛰어도 게임이 멈춘 채로 남지 않는가');
g.showTutorial(() => {});
const aug = g.TUT_STEPS.findIndex(t => t.t === '증강');
for (let i = 1; i <= aug; i++) g.tutGo(i);          // '이 단계 넘기기' 를 연달아 누른 것과 같습니다
ok(S.augmentAwait === true, '증강 카드가 떠 있습니다');
g.tutGo(aug + 1);
ok(S.augmentAwait === false && S.paused === false, '단계를 넘기면 카드가 정리되고 일시정지가 풀립니다');
g.endTutorial();

console.log(fails ? '\n실패 ' + fails + '건' : '\n튜토리얼 검증 전부 통과');
process.exit(fails ? 1 : 0);
