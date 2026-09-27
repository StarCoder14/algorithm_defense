// 아레나(웨이브 97+) 지형 검증.
// 기존 두 테스트는 웨이브 60 부근까지만 도달해서 아레나 코드를 한 줄도 밟지 않습니다.
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const src = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

let fails = 0;
const ok = (cond, msg) => { if (!cond){ fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

function load(wide){
  const labels = {};
  const mk = id => ({classList:{add(){},remove(){},toggle(){},contains:()=>false},style:{},
    appendChild(){},removeChild(){},remove(){},querySelector:()=>null,querySelectorAll:()=>[],
    addEventListener(){},getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:1,height:1}),
    set innerHTML(v){ labels[id] = v; }, get innerHTML(){ return labels[id] || ''; },
    textContent:'', children:[], parentElement:{style:{},onclick:null,classList:{add(){},remove(){},toggle(){},contains:()=>false}},
    scrollTop:0,scrollHeight:0,offsetWidth:0,dataset:{},disabled:false,onclick:null});
  const ctx = new Proxy({}, {get:(t,k)=>k==='canvas'?{width:768,height:432}:(typeof k==='string'?()=>{}:undefined), set:()=>true});
  global.document = {getElementById:mk, createElement:mk, querySelectorAll:()=>[], querySelector:()=>null, addEventListener(){}, body:mk()};
  global.matchMedia = () => ({matches: wide});
  let T = 0; global.performance = {now:()=>T};
  global.requestAnimationFrame = () => {};
  global.addEventListener = () => {}; global.setTimeout = () => 0; global.clearTimeout = () => {};
  const a = {};
  new Function('__x', src + '\n' + [
    'S','WP','COLS','ROWS','TS','px','pathSet','ARENA_LOOP','ARENA_WAY','arenaLoopSet','arenaEntrySet',
    'arenaBlockSet','buildable','occupied','nodeAt','scatterUnits','place','resetRun','setSpeed',
    'spawn','step','draw','ENEMY','U','startWave','ARENA_FROM','SPEED_START','SPEED_FAST','SPEED_FAST_STAGE','stageOf','setSpeed',
  ].map(k => `__x.${k}=${k};`).join(''))(a);
  a.labels = labels;
  return a;
}

for (const [name, wide] of [['세로(9x12)', false], ['가로(16x9)', true]]){
  const g = load(wide);
  const {S, WP, COLS, ROWS, TS, px, ARENA_LOOP, ARENA_WAY, arenaLoopSet, arenaEntrySet, arenaBlockSet} = g;
  console.log(`\n── ${name} ──`);

  // 1) 진입로가 스폰 지점에서 시작해 트랙 첫 꼭짓점에 닿는가
  ok(ARENA_WAY[0][0] === WP[0][0] && ARENA_WAY[0][1] === WP[0][1], '진입로가 스폰 지점 WP[0]에서 시작');
  const full = [...ARENA_WAY, ARENA_LOOP[0]];
  ok(full.every((p, i) => i === 0 || p[0] === full[i-1][0] || p[1] === full[i-1][1]),
     '진입로 각 구간이 가로/세로 축에 나란함');

  // 2) 칸이 끊기지 않고 이어지는가 (한 칸씩 인접)
  const seq = [];
  for (let i = 0; i < full.length-1; i++){
    let [x,y] = full[i]; const [tx,ty] = full[i+1];
    const dx = Math.sign(tx-x), dy = Math.sign(ty-y);
    while (x!==tx || y!==ty){ seq.push([x,y]); x+=dx; y+=dy; }
  }
  seq.push(ARENA_LOOP[0]);
  ok(seq.every((p,i) => i===0 || Math.abs(p[0]-seq[i-1][0]) + Math.abs(p[1]-seq[i-1][1]) === 1),
     '진입로 칸이 한 칸씩 끊김 없이 이어짐');
  ok(seq.slice(0,-1).every(([x,y]) => x<0 || y<0 || arenaEntrySet.has(x+','+y)),
     '진입로 칸이 전부 arenaEntrySet 에 들어 있음');

  // 3) 진입로가 트랙 위를 밟지 않는가 (도착 꼭짓점 제외)
  const overlap = [...arenaEntrySet].filter(k => arenaLoopSet.has(k));
  ok(overlap.length === 0, '진입로가 트랙 위를 지나지 않음 (겹침 ' + overlap.length + '칸)');

  // 4) buildable — 아레나에서는 옛 경로가 열리고 트랙+진입로가 막힘
  S.arena = false;
  const oldPathTile = [...g.pathSet].map(k => k.split(',').map(Number)).find(([x,y]) => x>=0 && y>=0 && !arenaBlockSet.has(x+','+y));
  ok(oldPathTile && !g.buildable(...oldPathTile), '평상시: 옛 경로 칸은 설치 불가');
  S.arena = true;
  ok(oldPathTile && g.buildable(...oldPathTile), '아레나: 옛 경로 칸이 설치 가능해짐');
  const trackTiles = [...arenaBlockSet].map(k => k.split(',').map(Number)).filter(([x,y]) => x>=0 && y>=0);
  ok(trackTiles.every(([x,y]) => !g.buildable(x,y)), '아레나: 트랙+진입로 칸은 전부 설치 불가');

  // 5) 적이 진입로를 따라 들어와 트랙을 도는가
  S.arena = true; S.enemies.length = 0; S.life = 20;
  const type = Object.keys(g.ENEMY).find(k => !g.ENEMY[k].boss && !g.ENEMY[k].blink);
  for (let i = 0; i < 5; i++) g.spawn({type, hpMul:1});
  S.enemies.forEach(e => { e.hp = e.max = 1e12; e.shield = 0; });
  let off = 0, sawEntry = false;
  for (let t = 0; t < 4000; t++){
    g.step(0.05);
    for (const e of S.enemies){
      const tx = Math.floor(e.x/TS), ty = Math.floor(e.y/TS);
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) continue;   // 맵 밖 스폰 구간
      const k = tx+','+ty;
      if (!arenaBlockSet.has(k)) off++;
      if (arenaEntrySet.has(k)) sawEntry = true;
    }
  }
  ok(sawEntry, '적이 실제로 진입로 칸을 밟고 들어옴');
  ok(off === 0, '적이 길 없는 칸을 가로지르지 않음 (이탈 ' + off + '회)');
  ok(S.life === 20, '아레나에서 적이 새어나가지 않음 (메모리 ' + S.life + ')');
  ok(S.enemies.every(e => e.wp > ARENA_WAY.length + ARENA_LOOP.length), '적이 트랙을 한 바퀴 이상 돎');

  // 6) 지형 전환 시 유닛 재배치
  const id = Object.keys(g.U)[0];
  S.arena = false; S.units.length = 0; S.gold = 1e9;
  for (let i = 0; i < 12; i++) g.place(id, true);
  // 무작위 배치에 기대면 테스트가 간헐적으로 통과합니다. 절반을 트랙 위로 강제로 옮겨 둡니다.
  const track = [...arenaLoopSet].map(k => k.split(',').map(Number)).filter(([x,y]) => x>=0 && y>=0);
  S.units.slice(0, 6).forEach((u, i) => { u.tx = track[i][0]; u.ty = track[i][1]; });
  const onTrack = () => S.units.filter(u => arenaBlockSet.has(u.tx+','+u.ty)).length;
  S.arena = true;
  const before = onTrack();
  g.scatterUnits();
  ok(before >= 6, '전환 전에는 트랙 위에 겹친 유닛이 있음 (' + before + '기)');
  ok(onTrack() === 0, '재배치 후 트랙 위 유닛 0기');
  ok(S.units.every(u => g.buildable(u.tx, u.ty)), '재배치된 유닛이 전부 설치 가능 칸에 있음');
  const seen = new Set(S.units.map(u => u.tx+','+u.ty));
  ok(seen.size === S.units.length, '재배치된 유닛이 겹치지 않음');
  ok(S.units.every(u => u.x === px(u.tx) && u.y === px(u.ty)), '유닛의 화면 좌표가 칸과 일치');

  // 6b) startWave 로 실제 전환 — 이 경로가 scatterUnits 를 부르는지
  S.arena = false; S.units.length = 0; S.enemies.length = 0; S.life = 20; S.gold = 1e9;
  for (let i = 0; i < 12; i++) g.place(id, true);
  S.units.slice(0, 6).forEach((u, i) => { u.tx = track[i][0]; u.ty = track[i][1]; });
  S.wave = g.ARENA_FROM - 2;
  g.startWave();
  ok(S.wave === g.ARENA_FROM - 1 && !S.arena, 'ARENA_FROM 직전 웨이브는 아직 평상시 지형');
  g.startWave();
  ok(S.wave === g.ARENA_FROM && S.arena, 'ARENA_FROM 웨이브에서 아레나로 전환');
  ok(onTrack() === 0, 'startWave 전환이 유닛을 트랙 밖으로 옮김');
  let ran = true;
  try { for (let t = 0; t < 3000; t++) { g.step(0.05); g.draw(); } }
  catch(e){ ran = false; console.log('    오류: ' + e.message); }
  ok(ran, '아레나 3000틱 진행 + 렌더 정상');
  ok(S.life === 20, '아레나 진행 중 메모리 손실 없음 (' + S.life + ')');

  // 7) 리셋 — 배속 표기 / 칸 수 / 아레나 플래그
  g.setSpeed(5);
  S.cap = 99;
  g.resetRun();
  // 부스 전시용으로 시작 배속이 2 입니다(3스테이지에서 5로 올라갑니다).
  ok(S.speed === g.SPEED_START, 'resetRun 후 배속이 시작값(' + g.SPEED_START + ')');
  ok(new RegExp(g.SPEED_START + 'x').test(g.labels['btn-speed'] || ''),
     'resetRun 후 버튼 표기도 ' + g.SPEED_START + 'x (' + (g.labels['btn-speed']||'없음') + ')');
  ok(S.cap === (wide ? 26 : 22), 'resetRun 후 칸 수가 화면에 맞음 (' + S.cap + ')');
  ok(S.arena === false && S.holdArena === false, 'resetRun 후 아레나 플래그 해제');

  // 8) 아레나 상태로 렌더가 터지지 않는지
  S.arena = true;
  let drew = true;
  try { g.draw(); } catch(e){ drew = false; console.log('    draw 오류: ' + e.message); }
  ok(drew, '아레나 지형 렌더 정상');
}

console.log(fails ? `\n실패 ${fails}건` : '\n아레나 검증 전부 통과');
process.exit(fails ? 1 : 0);
