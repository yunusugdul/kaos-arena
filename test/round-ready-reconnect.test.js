'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {once}=require('node:events');
const {server}=require('../server.js');
const sockets=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function wait(ws,pred,limit=2500){return new Promise((res,rej)=>{
 const t=setTimeout(()=>{ws.removeEventListener('message',fn);rej(new Error('expected message not received'))},limit);
 function fn(e){let d;try{d=JSON.parse(e.data);}catch{return;}if(pred(d)){clearTimeout(t);ws.removeEventListener('message',fn);res(d)}}
 ws.addEventListener('message',fn);
});}
async function client(){const ws=new WebSocket('ws://127.0.0.1:'+server.address().port+'/ws');await once(ws,'open');sockets.push(ws);return ws;}
function send(ws,body){ws.send(JSON.stringify(body));}
test.before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));});
test.after(async()=>{for(const ws of sockets)try{ws.close()}catch{}await sleep(40);await new Promise(r=>server.close(r));});
test('guest must explicitly ready; reconnect resets unstarted lobby readiness; weapon picks are validated',async()=>{
 const h=await client(),made=wait(h,d=>d.type==='joined');send(h,{type:'create',name:'Host'});const room=await made;
 const g=await client(),joined=wait(g,d=>d.type==='joined');send(g,{type:'join',name:'Guest',code:room.code});const seat=await joined;
 assert.equal(seat.players[1].ready,false);assert.equal(seat.players[0].ready,true);
 let denied=wait(h,d=>d.type==='error');send(h,{type:'start'});assert.match((await denied).message,/HAZIRIM/);
 const ready=wait(h,d=>d.type==='presence'&&d.players[1].ready);send(g,{type:'ready',ready:true});await ready;
 // No automatic ready after the guest's connection is replaced or lost before match start.
 const re=await client(),back=wait(re,d=>d.type==='joined');send(re,{type:'join',code:room.code,token:seat.token});const r=await back;
 assert.equal(r.reconnected,true);assert.equal(r.players[1].ready,false);
 denied=wait(h,d=>d.type==='error');send(h,{type:'start'});assert.match((await denied).message,/HAZIRIM/);
 const guestReady=wait(h,d=>d.type==='presence'&&d.players[1].ready);send(re,{type:'ready',ready:true});await guestReady;
 const launched=wait(re,d=>d.type==='start');send(h,{type:'start'});const start=await launched;
 const invalid=wait(h,d=>d.type==='weapon_select'&&d.weapon==='sniper',350).then(()=>false,()=>true);
 send(re,{type:'weapon_select',round:1,matchId:start.matchId,weapon:'invalid'});
 assert.equal(await invalid,true);
 const selection=wait(h,d=>d.type==='weapon_select');send(re,{type:'weapon_select',round:1,matchId:start.matchId,weapon:'sniper'});
 assert.deepEqual(((x)=>({slot:x.slot,round:x.round,weapon:x.weapon}))(await selection),{slot:1,round:1,weapon:'sniper'});
 const pulse=wait(re,d=>d.type==='heartbeat_ack');send(re,{type:'heartbeat'});await pulse;
 send(h,{type:'leave'});
});
test('large but valid WebSocket states do not disconnect players',async()=>{
 const h=await client(),made=wait(h,d=>d.type==='joined');send(h,{type:'create'});const room=await made;
 const g=await client(),joined=wait(g,d=>d.type==='joined');send(g,{type:'join',code:room.code});await joined;
 const ready=wait(h,d=>d.type==='presence'&&d.players[1]?.ready);send(g,{type:'ready',ready:true});await ready;
 const started=wait(h,d=>d.type==='start');send(h,{type:'start'});const game=await started;
 const huge=wait(g,d=>d.type==='state'&&d.seq===1,4000);
 send(h,{type:'state',matchId:game.matchId,seq:1,state:{players:[{},{}],score:[0,0],map:{name:'NEON PARK'},extra:'x'.repeat(90000)}});
 assert.equal((await huge).state.extra.length,90000);
 assert.equal(h.readyState,WebSocket.OPEN);assert.equal(g.readyState,WebSocket.OPEN);
 send(h,{type:'leave'});
});
test('client includes per-round selection UI and robust reconnect logic',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 assert.match(html,/id="guestReady"/);
 assert.match(js,/function selectRoundWeapon\(slot,weapon\)/);
 assert.match(js,/game\.weaponSelections\.every\(Boolean\)/);
 assert.match(js,/if\(g\.phase==='weapon-select'\)return/);
 assert.match(js,/type:'weapon_select',matchId:net\.matchId,round:game\.round/);
 assert.match(js,/setInterval\(\(\)=>\{/);
 assert.match(js,/type:'heartbeat'/);
 assert.match(js,/net\.retryAttempts\+\+/);
});
