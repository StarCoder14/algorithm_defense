// 스테이지당 6웨이브 검증 — 건너뛰어도 보스·증강·아레나·마지막 웨이브가 남는지,
// 건너뛴 웨이브의 보상이 빠짐없이 한 번씩만 들어오는지 확인함.
//
//   node tests/waves.js
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const src = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

const mk = () => ({classList:{add(){},remove(){},toggle(){},contains:()=>false}, style:{},
  appendChild(){}, removeChild(){}, remove(){}, querySelector:()=>null, querySelectorAll:()=>[],
  addEventListener(){}, getContext:()=>ctx, getBoundingClientRect:()=>({left:0,top:0,width:1,height:1}),
  innerHTML:'', textContent:'', children:[], dataset:{}, disabled:false, onclick:null,
  parentElement:{style:{}, onclick:null, classList:{add(){},remove(){},toggle(){},contains:()=>false}},
  scrollTop:0, scrollHeight:0, offsetWidth:0});
const ctx = new Proxy({}, {get:(t,k)=>k==='canvas'?{width:768,height:432}:(typeof k==='string'?()=>{}:undefined), set:()=>true});
global.document = {getElementById:mk, createElement:mk, querySelectorAll:()=>[], querySelector:()=>null, addEventListener(){}, body:mk()};
global.matchMedia = () => ({matches:false});
global.performance = {now:()=>0};
global.requestAnimationFrame = () => {}; global.addEventListener = () => {};
global.setTimeout = () => 0; global.clearTimeout = () => {};

const g = {};
new Function('__x', src + '\n' + ['S','startWave','endWave','nextWaveAfter','wavesPaidAt','playedWaveOf','playedSlotOf',
  'stageOf','stageWave','STAGES','STAGE_LEN','PLAYED_PER_STAGE','AUGMENT_WAVES','ARENA_FROM','BOSS_SLOT','offerAugment',
  'buildWave','SESSION_SEC','SESSION_WARN','BOOTH_HARD_AT','SPEED_FAST','SPEED_OPTIONS','nextSpeed']
  .map(k => '__x.' + k + '=' + k + ';').join(''))(g);
const S = g.S;

let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log('  ' + (c ? '✓' : '✗') + ' ' + m); };

console.log('── 부스 제한시간·난이도·배속');
ok(g.SESSION_SEC === 6 * 60, '한 판 제한은 6분');
ok(g.BOOTH_HARD_AT === 2 * 60, '난이도 상승은 플레이 2분 시점부터');
ok(g.SESSION_WARN.includes(g.SESSION_SEC - g.BOOTH_HARD_AT), '난이도 상승 시점에 안내 표시');
ok(g.SPEED_FAST === 8, '3스테이지부터 자동 8배속');
ok(g.SPEED_OPTIONS.join(',') === '1,2,3,5,8', '배속 선택에 8배속 포함');
ok(g.SPEED_OPTIONS.every((speed, i) => g.nextSpeed(speed) === g.SPEED_OPTIONS[(i + 1) % g.SPEED_OPTIONS.length]),
   '배속 버튼이 1→2→3→5→8→1 순환');
S.real = g.BOOTH_HARD_AT - 1;
const easyWave = g.buildWave(1);
S.real = g.BOOTH_HARD_AT;
const hardWave = g.buildWave(1);
const avgHp = wave => wave.reduce((sum, enemy) => sum + enemy.hpMul, 0) / wave.length;
ok(hardWave.length > easyWave.length, '2분 이후 웨이브부터 적 수 증가 (' + easyWave.length + '→' + hardWave.length + ')');
ok(avgHp(hardWave) > avgHp(easyWave), '2분 이후 웨이브부터 적 체력 증가');
S.real = 0;

console.log('── 치르는 웨이브 목록');
const played = [];
for (let w = g.nextWaveAfter(0); w <= S.maxWave; w = g.nextWaveAfter(w)) played.push(w);
ok(played.length === g.STAGES.length * g.PLAYED_PER_STAGE, '한 판은 ' + played.length + '웨이브 (스테이지 ' + g.STAGES.length + ' × ' + g.PLAYED_PER_STAGE + ')');
ok(played.every(w => ![4, 7].includes(g.stageWave(w))), '4·7번째 웨이브는 안 나옴');
const bossWaves = [];
for (let st = 0; st < g.STAGES.length; st++)
  for (const slot of Object.keys(g.BOSS_SLOT)) bossWaves.push(st * g.STAGE_LEN + Number(slot));
ok(bossWaves.every(w => played.includes(w)), '보스 웨이브 ' + bossWaves.length + '개가 전부 남음');
ok(g.AUGMENT_WAVES.every(w => played.includes(w)), '증강 웨이브 ' + g.AUGMENT_WAVES.join('/') + ' 전부 남음');
ok(played.includes(g.ARENA_FROM), '아레나 첫 웨이브(' + g.ARENA_FROM + ')가 남음');
ok(played[played.length - 1] === S.maxWave, '마지막 웨이브(' + S.maxWave + ')가 남음');
ok(played.every(w => g.stageOf(w) !== undefined) && played.filter(w => g.stageWave(w) === 1).length === g.STAGES.length,
   '스테이지마다 첫 웨이브가 남아서 변이·배속 전환이 그대로 일어남');

console.log('\n── 화면에 보이는 번호');
ok(played.every((w, i) => g.playedWaveOf(w) === i + 1), '판 전체 번호가 1부터 ' + played.length + '까지 빠짐없이 이어짐');
ok(played.every(w => g.playedSlotOf(w) >= 1 && g.playedSlotOf(w) <= g.PLAYED_PER_STAGE), '스테이지 안 번호는 1~' + g.PLAYED_PER_STAGE);
ok(g.playedWaveOf(g.ARENA_FROM) === 12 * g.PLAYED_PER_STAGE + 1, '아레나는 화면 기준 ' + g.playedWaveOf(g.ARENA_FROM) + '웨이브');

console.log('\n── 건너뛴 웨이브의 보상');
const paidAll = played.flatMap(w => g.wavesPaidAt(w)).sort((a, b) => a - b);
ok(paidAll.length === S.maxWave && paidAll.every((w, i) => w === i + 1), '옛 120웨이브의 보상이 정확히 한 번씩 들어옴');

// 실제 endWave 로 한 판치 보상을 받아서 옛날 방식과 비교함
S.gold = 0; S.tk = {draft:0, tier:0, named:0};
let oldGold = 0, oldDraft = 0, oldTier = 0, oldNamed = 0;
for (let w = 1; w <= S.maxWave; w++){
  oldGold += 70 + w*14;
  if (w % 3 === 0) oldDraft++;
  if (w % 6 === 0) oldTier++;
  if (w % 8 === 0) oldNamed++;
}
for (const w of played){
  if (w === S.maxWave) break;                  // 마지막 웨이브는 뱀으로 넘어가서 따로 셈
  S.wave = w; S.phase = 'wave'; S.augmentAwait = false;
  g.endWave();
}
S.wave = S.maxWave; oldGold -= 70 + S.maxWave*14;
let lastDraft = 0, lastTier = 0, lastNamed = 0;
for (const w of g.wavesPaidAt(S.maxWave)){ if (w % 3 === 0) lastDraft++; if (w % 6 === 0) lastTier++; if (w % 8 === 0) lastNamed++; }
for (const w of g.wavesPaidAt(S.maxWave)) if (w !== S.maxWave) oldGold -= 70 + w*14;
ok(S.gold === oldGold, '웨이브 보너스 골드 합계가 옛날과 같음 (' + S.gold.toLocaleString() + 'G)');
ok(S.tk.draft === oldDraft - lastDraft, '드래프트권 수가 옛날과 같음 (' + S.tk.draft + '장)');
ok(S.tk.tier === oldTier - lastTier, '등급권 수가 옛날과 같음 (' + S.tk.tier + '장)');
ok(S.tk.named === oldNamed - lastNamed, '지목권 수가 옛날과 같음 (' + S.tk.named + '장)');

console.log('\n── startWave 가 실제로 건너뛰는가');
S.wave = 3; S.phase = 'prep'; S.over = false;
g.startWave();
ok(S.wave === 5, '3번 다음은 5번 (' + S.wave + ')');
S.phase = 'prep'; S.wave = 6;
g.startWave();
ok(S.wave === 8, '6번 다음은 8번 (' + S.wave + ')');
S.phase = 'prep'; S.wave = 8;
g.startWave();
ok(S.wave === 9 && g.stageOf(S.wave) === 1, '8번 다음은 다음 스테이지 첫 웨이브');

console.log(fails ? '\n실패 ' + fails + '건' : '\n웨이브 구조 검증 전부 통과');
process.exit(fails ? 1 : 0);
