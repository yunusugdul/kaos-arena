const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
const start=source.indexOf('async function startMatchFromMenu(){'),end=source.indexOf('\nconst clamp=',start);
assert.ok(start>0&&end>start);const fn=source.slice(start,end);
function harness(ready){
 return Function('prepareArena',`
 let startPending=false,game=null,arena3d=null,arenaLoading=null,started=0;const options={},globalTime=0,particles=[],rings=[];
 const label={textContent:'SAVAŞI BAŞLAT'},errorBox={textContent:'',classList:{add(){},remove(){}}};
 const button={disabled:false,querySelector(){return label}},nick={value:'  Test  '};
 const $=id=>({startBtn:button,startupError:errorBox,nick}[id]);
 const document={body:{classList:{add(){}}}},console={error(){}};
 function newGame(){started++;game={phase:'countdown'};}function layoutArena(){}function returnMenu(){game=null;}
 ${fn}
 return {start:startMatchFromMenu,button,label,errorBox,count:()=>started,phase:()=>game?.phase};`)(ready);
}
test('a delayed renderer is awaited, duplicate clicks are ignored and a match starts only once',async()=>{
 let release,draws=0;const rendererPromise=new Promise(resolve=>release=resolve),h=harness(()=>rendererPromise);
 const first=h.start();assert.equal(h.count(),0);assert.equal(h.button.disabled,true);
 await h.start();assert.equal(h.count(),0);
 release({draw(state){assert.equal(state.phase,'countdown');draws++;}});await first;
 assert.equal(h.count(),1);assert.equal(draws,1);assert.equal(h.button.disabled,false);assert.equal(h.label.textContent,'SAVAŞI BAŞLAT');
});
test('a failed 3D startup leaves the start button usable and does not enter the legacy arena',async()=>{
 const h=harness(async()=>null);await h.start();assert.equal(h.count(),0);assert.equal(h.button.disabled,false);assert.match(h.errorBox.textContent,/3D sahne yüklenemedi/);
});
