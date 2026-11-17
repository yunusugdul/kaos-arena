'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {once}=require('node:events');
const js=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../public/style.css'),'utf8');
const {server}=require('../server.js');
function delay(ms){return new Promise(r=>setTimeout(r,ms));}
function wait(ws,pred,timeout=1800){return new Promise((res,rej)=>{const t=setTimeout(()=>{ws.removeEventListener('message',fn);rej(new Error('timeout'))},timeout);function fn(e){const d=JSON.parse(e.data);if(pred(d)){clearTimeout(t);ws.removeEventListener('message',fn);res(d);}}ws.addEventListener('message',fn);});}
async function connect(url,sockets){const w=new WebSocket(url);await once(w,'open');sockets.push(w);return w;}
function send(ws,obj){ws.send(JSON.stringify(obj));}
test('rematch sends new match id to BOTH members and rejects stale first-match frames', async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url="ws://127.0.0.1:"+server.address().port+"/ws",sockets=[];
 try{
  const host=await connect(url,sockets),joined=wait(host,d=>d.type==='joined');send(host,{type:'create',name:'Host'});const room=await joined;
  const guest=await connect(url,sockets),guestJoined=wait(guest,d=>d.type==='joined');send(guest,{type:'join',code:room.code,name:'Guest'});await guestJoined;
  const firstHost=wait(host,d=>d.type==='start'),firstGuest=wait(guest,d=>d.type==='start');send(host,{type:'start'});const [a,b]=await Promise.all([firstHost,firstGuest]);assert.equal(a.matchId,1);assert.equal(b.matchId,1);
  const secondHost=wait(host,d=>d.type==='start'),secondGuest=wait(guest,d=>d.type==='start');send(host,{type:'rematch'});const [c,d]=await Promise.all([secondHost,secondGuest]);assert.equal(c.matchId,2);assert.equal(d.matchId,2);assert.equal(c.rematch,true);assert.equal(d.rematch,true);
  send(host,{type:'state',matchId:1,seq:77,state:{players:[{},{}],score:[2,0],map:{name:'OLD'},phase:'finished'}});
  const fresh=wait(guest,m=>m.type==='state');send(host,{type:'state',matchId:2,seq:1,state:{players:[{},{}],score:[0,0],map:{name:'NEW'},phase:'countdown'}});
  assert.equal((await fresh).state.map.name,'NEW');
  const noOld=wait(guest,m=>m.type==='state'&&m.state?.map?.name==='OLD',200).then(()=>false,()=>true);assert.equal(await noOld,true);
  send(host,{type:'leave'});
 }finally{for(const ws of sockets)try{ws.close()}catch{}await delay(60);await new Promise(r=>server.close(r));}
});
test('chat feed uses five-message lightweight overlay and Enter opens/sends/closes composer',()=>{
 assert.match(js,/net\.chatHistory\.slice\(-5\)/);
 assert.match(js,/if\(e\.key==='Enter'&&options\.mode==='online'&&game\)/);
 assert.match(js,/sendChat\(\$\('gameChatInput'\)\);closeGameChat\(\)/);
 assert.match(js,/keys=Object\.create\(null\);touch\.dx=touch\.dy=0;mouseThrowHeld=false;/);
 assert.match(html,/<div id="arenaStage" class="arena-stage"><aside id="gameChatPanel"/);
 assert.match(css,/body\.is-playing \.arena-chat\{\s*position:absolute;left:clamp/);
 assert.doesNotMatch(css,/\.game-chat-panel\{/);
});
test('meteor is absent from logic, rendering, and user-visible descriptions',()=>{
 assert.doesNotMatch(js,/meteors|meteorTimer|METEOR|g\.meteors|☄️/);
 assert.doesNotMatch(html,/meteor/i);
 assert.match(js,/g\.chaos='turbo'/);
});
