'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {server}=require('../server');
const {once}=require('node:events');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let address;const sockets=[];
async function client(){const ws=new WebSocket(address);await once(ws,'open');sockets.push(ws);return ws;}
function wait(ws,pred,limit=3500){return new Promise((resolve,reject)=>{let id=setTimeout(()=>{ws.removeEventListener('message',handler);reject(new Error('timed out'));},limit);function handler(ev){const d=JSON.parse(ev.data);if(!pred(d))return;clearTimeout(id);ws.removeEventListener('message',handler);resolve(d);}ws.addEventListener('message',handler);});}
function send(ws,d){ws.send(JSON.stringify(d));}
test.before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));address='ws://127.0.0.1:'+server.address().port+'/ws';});
test.after(async()=>{for(const s of sockets)try{s.close()}catch{}await sleep(70);await new Promise(r=>server.close(r));});
test('new rules validate reset policy and share with joining player',async()=>{
 const a=await client();const w=wait(a,d=>d.type==='joined');send(a,{type:'create',name:'A',rules:{upgradePersistence:'round',preset:'evolution'}});const room=await w;
 assert.equal(room.rules.upgradePersistence,'round');
 const b=await client();const p=wait(b,d=>d.type==='joined');send(b,{type:'join',code:room.code,name:'B'});assert.equal((await p).rules.upgradePersistence,'round');
 const c=await client();const x=wait(c,d=>d.type==='joined');send(c,{type:'create',rules:{upgradePersistence:'hack'}});assert.equal((await x).rules.upgradePersistence,'match');
 send(a,{type:'leave'});send(c,{type:'leave'});
});
test('lobby/game chat is relayed, sanitized, throttled and histories sent on resume',async()=>{
 const a=await client();const w=wait(a,d=>d.type==='joined');send(a,{type:'create',name:'Ana'});const room=await w;
 const b=await client();const p=wait(b,d=>d.type==='joined');send(b,{type:'join',code:room.code,name:'Arkadaş'});const guest=await p;
 const received=wait(b,d=>d.type==='chat');send(a,{type:'chat',text:'  <b>Merhaba!</b>  '});const item=await received;assert.equal(item.text,'bMerhaba!/b');assert.equal(item.slot,0);
 send(a,{type:'chat',text:'too fast'});await sleep(110);
 const reconnect=await client();const x=wait(reconnect,d=>d.type==='joined');send(reconnect,{type:'join',code:room.code,token:guest.token,name:'Arkadaş'});const j=await x;
 assert.equal(j.chatHistory.length,1);assert.equal(j.chatHistory[0].text,'bMerhaba!/b');
 send(a,{type:'leave'});
});
test('host pause/unpause broadcasts to other player, guest cannot spoof host pause',async()=>{
 const a=await client();const w=wait(a,d=>d.type==='joined');send(a,{type:'create'});const room=await w;
 const b=await client();const p=wait(b,d=>d.type==='joined');send(b,{type:'join',code:room.code});await p;
 const start=wait(b,d=>d.type==='start');send(a,{type:'start'});await start;
 const paused=wait(b,d=>d.type==='host_pause'&&d.paused===true);send(a,{type:'host_pause',paused:true});assert.equal((await paused).paused,true);
 const notResumed=wait(b,d=>d.type==='host_pause'&&d.paused===false,350).then(()=>true,()=>false);send(b,{type:'host_pause',paused:false});assert.equal(await notResumed,false);
 const resume=wait(b,d=>d.type==='host_pause'&&d.paused===false);send(a,{type:'host_pause',paused:false});assert.equal((await resume).paused,false);
 const disconnected=wait(b,d=>d.type==='presence'&&d.players[0].online===false);a.close();assert.equal((await disconnected).hostPaused,true);
});
