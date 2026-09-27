// 실제 DOM 에 가깝게: 렌더된 HTML 을 파싱해 querySelector 가 진짜로 동작하도록
const html=require('fs').readFileSync(__dirname+'/../index.html','utf8');
const src=html.slice(html.indexOf('<script>')+8, html.lastIndexOf('</script>'));
function makeNode(html=''){
  const node={
    _html:html,
    classList:{add(){},remove(){},toggle(){},contains:()=>false}, style:{}, dataset:{},
    appendChild(){}, removeChild(){}, remove(){}, addEventListener(){},
    getContext:()=>ctx, getBoundingClientRect:()=>({left:0,top:0,width:1,height:1}),
    textContent:'', children:[], parentElement:{style:{},onclick:null,classList:{add(){},remove(){},toggle(){},contains:()=>false}},
    scrollTop:0, scrollHeight:0, offsetWidth:0, disabled:false, onclick:null,
    set innerHTML(v){ this._html=v; }, get innerHTML(){ return this._html; },
    querySelector(sel){
      const m=/\[([\w-]+)(?:=([^\]]+))?\]/.exec(sel); if(!m) return null;
      const re=new RegExp(m[1]+(m[2]?'="?'+m[2]+'"?':''));
      return re.test(this._html) ? makeNode() : null;   // 없으면 진짜로 null
    },
    querySelectorAll(sel){
      const m=/\[([\w-]+)/.exec(sel); if(!m) return [];
      const c=(this._html.match(new RegExp(m[1],'g'))||[]).length;
      return Array.from({length:c},()=>makeNode());
    },
  };
  return node;
}
const ctx=new Proxy({},{get:(t,k)=>k==='canvas'?{width:768,height:432}:(typeof k==='string'?()=>{}:undefined),set:()=>true});
const body=makeNode();
global.document={getElementById:()=>body,createElement:()=>makeNode(),querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},body};
global.matchMedia=()=>({matches:false}); global.performance={now:()=>0};
global.requestAnimationFrame=()=>{}; global.addEventListener=()=>{};
global.setTimeout=()=>0; global.clearTimeout=()=>{};
const x={};
new Function('__x',src+'\n__x.renderSheet=renderSheet;__x.SHEET=SHEET;__x.S=S;__x.summon=summon;__x.startWave=startWave;__x.step=step;')(x);
const {S}=x;
S.gold=1e7; S.optTk=50;
x.startWave(); for(let i=0;i<40;i++){ x.summon(); x.step(0.05); }
const cases=[['unit',null],['craft','myth'],['craft','trans'],['gacha',null],['lab',null],['log',null],['dex',null],['menu',null],['wave',null]];
let bad=[];
for(const [kind,ctab] of cases){
  x.SHEET.kind=kind; if(ctab) x.SHEET.ctab=ctab;
  try{ x.renderSheet(); }catch(e){ bad.push(`${kind}${ctab?'/'+ctab:''} → ${e.message}`); }
}
console.log(bad.length ? '오류:\n  '+bad.join('\n  ') : '모든 화면 렌더+바인딩 정상');
