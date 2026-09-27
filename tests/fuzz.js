const html=require('fs').readFileSync(__dirname+'/../index.html','utf8');
const src=html.slice(html.indexOf('<script>')+8, html.lastIndexOf('</script>'));
const mk=()=>({classList:{add(){},remove(){},toggle(){},contains:()=>false},style:{},
  appendChild(){},removeChild(){},remove(){},querySelector:()=>null,querySelectorAll:()=>[],
  addEventListener(){},getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:1,height:1}),
  set innerHTML(v){}, get innerHTML(){return '';}, textContent:'', children:[], parentElement:{style:{},onclick:null,classList:{add(){},remove(){},toggle(){},contains:()=>false}},
  scrollTop:0,scrollHeight:0,offsetWidth:0,dataset:{},disabled:false,onclick:null});
const ctx=new Proxy({},{get:(t,k)=>k==='canvas'?{width:768,height:432}:(typeof k==='string'?()=>{}:undefined),set:()=>true});
global.document={getElementById:mk,createElement:mk,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},body:mk()};
global.matchMedia=()=>({matches:false});
let T=0; global.performance={now:()=>T};
global.requestAnimationFrame=()=>{};
global.addEventListener=()=>{}; global.setTimeout=()=>0; global.clearTimeout=()=>{};
const api={};
new Function('__x', src+'\n__x.S=S;__x.summon=summon;__x.mergeOnce=mergeOnce;__x.craft=craft;__x.transcend=transcend;'+
 '__x.sellSelected=sellSelected;__x.step=step;__x.startWave=startWave;__x.optimize=optimize;'+
 '__x.transStatus=transStatus;__x.recipeStatus=recipeStatus;__x.U=U;__x.buyResearch=buyResearch;__x.sync=sync;')(api);
const {S}=api;
function tick(n){ for(let i=0;i<n;i++){ T+=16; api.step(0.05); } }
let err=null;
try{
  S.gold=1e9; S.optTk=200;
  api.startWave();
  for(let round=0; round<400; round++){
    for(let i=0;i<3;i++) api.summon();
    api.mergeOnce();
    api.recipeStatus().forEach((s,ix)=>{ if(s.ok) api.craft(ix); });
    api.transStatus().forEach((s,ix)=>{ if(s.ok) api.transcend(ix); });
    if(S.units.length){ S.sel=S.units[(Math.random()*S.units.length)|0]; api.optimize(S.sel); }
    if(round%7===0 && S.units.length){ S.sel=S.units[0]; api.sellSelected(); api.sellSelected(); }
    if(round%11===0) api.buyResearch(['atk','myth','cap','gold'][(Math.random()*4)|0]);
    tick(40);
    if(!Number.isFinite(S.gold)) throw new Error('골드가 NaN 이 됨 (round '+round+')');
    if(!Number.isFinite(S.life)) throw new Error('메모리가 NaN');
  }
}catch(e){ err=e; }
console.log('웨이브', S.wave, '· 유닛', S.units.length, '· 골드', Math.round(S.gold), '· 처치', S.killed);
console.log(err ? ('오류 → '+err.message+'\n'+err.stack.split('\n').slice(1,4).join('\n')) : '오류 없음');
