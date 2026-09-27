// 최종 보스 '우로보로스' 검증 — 세로·가로 맵 각각
//   node tests/snake.js
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const src = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log('  ' + (c ? '✓' : '✗') + ' ' + m); };

function load(wide){
  const mk = () => ({classList:{add(){},remove(){},toggle(){},contains:()=>false}, style:{},
    appendChild(){}, removeChild(){}, remove(){}, querySelector:()=>null, querySelectorAll:()=>[],
    addEventListener(){}, getContext:()=>ctx, getBoundingClientRect:()=>({left:0,top:0,width:1,height:1}),
    set innerHTML(v){}, get innerHTML(){ return ''; }, textContent:'', children:[], dataset:{},
    parentElement:{style:{}, onclick:null, classList:{add(){},remove(){},toggle(){},contains:()=>false}},
    scrollTop:0, scrollHeight:0, offsetWidth:0, disabled:false, onclick:null});
  const ctx = new Proxy({}, {get:(t,k)=>k==='canvas'?{width:768,height:432}:(typeof k==='string'?()=>{}:undefined), set:()=>true});
  global.window = {};
  global.document = {getElementById:mk, createElement:mk, querySelectorAll:()=>[], querySelector:()=>null, addEventListener(){}, body:mk()};
  global.matchMedia = () => ({matches: wide});
  global.performance = {now:()=>0};
  global.requestAnimationFrame = () => {}; global.addEventListener = () => {};
  global.setTimeout = () => 0; global.clearTimeout = () => {};
  const g = {};
  new Function('__x', src + '\n' + ['S','step','draw','endWave','startSnake','dmgTo','castEffect','resetRun',
    'arenaLoopSet','ARENA_LOOP','TS','SNAKE_LAP_MEM','SNAKE_SPEEDUP','ENEMY','FINAL_BOSS','loopPerimeter','SNAKE_CAST_CAP','SNAKE_DPS_CAP']
    .map(k => '__x.' + k + '=' + k + ';').join(''))(g);
  return g;
}
// 웨이브 120을 막은 직후 상태를 만듭니다
function atFinale(g){
  const S = g.S;
  g.resetRun();
  S.wave = S.maxWave; S.arena = true; S.phase = 'wave'; S.queue = []; S.enemies.length = 0;
  S.finalDown = true; S.life = 999; S.maxLife = 999;
  g.endWave();
  return S;
}
const run = (g, sec) => { for (let i = 0; i < sec / 0.05; i++){ if (g.S.over) break; g.step(0.05); } };

for (const [name, wide] of [['세로(9x12)', false], ['가로(16x9)', true]]){
  const g = load(wide);
  console.log('\n── ' + name);

  // 1) 등장
  let S = atFinale(g);
  ok(!!S.snake && !S.over, '웨이브 120을 막으면 승리 대신 우로보로스가 등장합니다');
  ok(S.speed <= 2, '피날레는 2배속 이하로 늦춥니다 (' + S.speed + ')');
  const sn = S.snake;
  ok(sn.N * sn.gap <= g.loopPerimeter() && (sn.N + 1) * sn.gap > g.loopPerimeter(),
     '마디 수 ' + sn.N + ' × 간격 ≈ 트랙 둘레 (' + Math.round(sn.N * sn.gap) + ' / ' + g.loopPerimeter() + 'px)');

  // 2) 한 마디씩 들어와 트랙을 채우는가
  run(g, 1);
  ok(sn.segs.length > 0 && sn.segs.length < sn.N, '마디가 한 번에 뜨지 않고 차례로 들어옵니다 (' + sn.segs.length + '/' + sn.N + ')');
  run(g, 22);                                                  // 진입은 설계상 약 SNAKE_LAP_SEC(20초)
  ok(sn.segs.length === sn.N, '전부 들어왔습니다 (' + sn.segs.length + ')');
  const gaps = sn.segs.slice(1).map((e, i) => sn.segs[i].dist - e.dist);
  ok(Math.max(...gaps) - Math.min(...gaps) < sn.gap * 0.25, '마디 간격이 고르게 유지됩니다');
  run(g, 10);                                                  // 꼬리까지 트랙에 올라오도록
  const road = [...g.arenaLoopSet];
  const covered = new Set(sn.segs.map(e => Math.floor(e.x / g.TS) + ',' + Math.floor(e.y / g.TS)));
  const cov = road.filter(k => covered.has(k)).length / road.length;
  ok(cov >= 0.9, '뱀이 트랙을 가득 채웁니다 (트랙 칸의 ' + Math.round(cov * 100) + '%)');
  ok(S.enemies.length === sn.N, '필드의 적 = 뱀 마디뿐 (' + S.enemies.length + ')');

  // 3) 체력은 한 몸
  const hp0 = sn.hp;
  g.dmgTo(sn.segs[5], 1000);
  ok(Math.abs(hp0 - sn.hp - 1000) < 1, '어느 마디를 때려도 공용 체력이 깎입니다');
  const hp1 = sn.hp;
  for (const e of sn.segs.slice(0, 10)) g.dmgTo(e, 1000);
  ok(Math.abs(hp1 - sn.hp - 10000) < 1, '마디 10개를 긁으면 10배로 깎입니다 — 광역이 곧 화력');
  run(g, 6);                       // 버킷이 다시 차도록 잠시 둡니다
  const hp2 = sn.hp;
  const u = {id:'ptr', x:0, y:0, chg:0};
  g.castEffect(u, {f:'pctAll', pct:.18}, 1, '#fff', true);
  const lost = (hp2 - sn.hp) / hp2;
  const cap = g.SNAKE_CAST_CAP;
  ok(lost < 0.5, '"전체 체력의 18%" 가 마디 수만큼 부풀지 않습니다 (' + (lost * 100).toFixed(1) + '%)');
  ok(Math.abs(lost - cap) < 0.012, '시전 한 번은 상한 ' + (cap * 100) + '% 에서 잘립니다 (' + (lost * 100).toFixed(1) + '%)');
  // 한 마디만 노려 최대 체력의 10배를 퍼부어도 시전 한 번은 상한까지만
  // (상한은 '시전' 단위라, 반드시 공격·스킬·궁극기를 통해 때려야 합니다)
  run(g, 6);
  const hp3 = sn.hp;
  g.castEffect({id:'ptr', x:0, y:0, chg:0}, {f:'top', k:1, mul:1}, sn.max * 10, '#fff', true);
  ok(Math.abs((hp3 - sn.hp) / sn.max - cap) < 0.002, '한 방으로 아무리 크게 때려도 시전당 ' + (cap * 100) + '% 까지 (' + ((hp3 - sn.hp) / sn.max * 100).toFixed(1) + '%)');
  ok(sn.segs.every(e => !e.dead), '체력이 남아 있는 동안 마디는 죽지 않습니다');

  // 4) 한 바퀴마다 메모리를 삼키고 빨라집니다
  S = atFinale(g);
  S.life = 999; const s2 = S.snake;
  let lapAt = -1, lifeAt = S.life, v0 = s2.v;
  for (let i = 0; i < 1200 && s2.lap < 1; i++) g.step(0.05);
  ok(s2.lap >= 1, '머리가 한 바퀴를 돌았습니다');
  ok(lifeAt - S.life === g.SNAKE_LAP_MEM, '한 바퀴에 메모리 -' + g.SNAKE_LAP_MEM + ' (' + (lifeAt - S.life) + ')');
  ok(Math.abs(s2.v / v0 - g.SNAKE_SPEEDUP) < 1e-6, '바퀴마다 ' + g.SNAKE_SPEEDUP + '배 빨라집니다');
  S.life = 5;
  for (let i = 0; i < 2000 && !S.over; i++) g.step(0.05);
  ok(S.over && S.life === 0, '메모리가 바닥나면 패배합니다');

  // 5) 격파 → 승리
  S = atFinale(g);
  run(g, 20);
  // 상한이 있으니 한 방으로는 못 잡습니다 — 시전을 거듭해야 합니다
  const caster = {id:'ptr', x:0, y:0, chg:0};
  const t0 = S.playT;
  let casts = 0;
  while (!S.snake.dead && casts < 4000){ g.castEffect(caster, {f:'all', mul:1}, S.snake.max, '#fff', true); run(g, 0.05); casts++; }
  const took = S.playT - t0;
  ok(casts >= 1 / g.SNAKE_CAST_CAP - 1, '한 방으로는 못 잡고 여러 번 시전해야 합니다 (' + casts + '번)');
  ok(took >= 1 / g.SNAKE_DPS_CAP * 0.9, '무한 화력을 퍼부어도 최소 ' + Math.round(1 / g.SNAKE_DPS_CAP) + '초는 걸립니다 (' + took.toFixed(0) + '초)');
  ok(S.snake.dead && !S.over, '체력이 바닥나면 격파, 잠깐 폭발을 보여준 뒤');
  run(g, 3);
  ok(S.over && S.phase === 'done' && S.life > 0, '승리로 끝납니다');
  ok(S.enemies.length === 0, '마디가 전부 사라집니다');

  // 6) 렌더와 리셋
  S = atFinale(g); run(g, 10);
  let drew = true; try { g.draw(); } catch (e) { drew = false; console.log('    ' + e.message); }
  ok(drew, '뱀과 체력바가 오류 없이 그려집니다');
  g.resetRun();
  ok(S.snake === null && S.enemies.length === 0, '새 판에서는 뱀이 사라집니다');
}
console.log(fails ? '\n실패 ' + fails + '건' : '\n우로보로스 검증 전부 통과');
process.exit(fails ? 1 : 0);
