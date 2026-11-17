'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {server,rooms}=require('../server.js');

const clients=[];
const delay=n=>new Promise(resolve=>setTimeout(resolve,n));
const before=async()=>{
 if(server.listening)return;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
};
const socket=()=>new Promise((resolve,reject)=>{
 const w=new WebSocket('ws://127.0.0.1:'+server.address().port+'/ws');
 w.addEventListener('open',()=>{clients.push(w);resolve(w)},{once:true});
 w.addEventListener('error',reject,{once:true});
});
const wait=(ws,kind)=>new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{ws.removeEventListener('message',handle);reject(new Error('no '+kind));},2500);
 function handle(ev){const d=JSON.parse(ev.data);if(d.type===kind){clearTimeout(timer);ws.removeEventListener('message',handle);resolve(d);}}
 ws.addEventListener('message',handle);
});
const send=(ws,p)=>ws.send(JSON.stringify(p));

test('four-player 2v2 rooms preserve player slots and relay snapshots/actions securely',async()=>{
 await before();
 const players=await Promise.all([socket(),socket(),socket(),socket()]);
 const [h,g1,g2,g3]=players;
 const createdP=wait(h,'joined');send(h,{type:'create',name:'HOST',rules:{battleMode:'team',arena:'cycle',rounds:5}});const room=await createdP;
 assert.equal(room.rules.battleMode,'team');
 assert.equal(room.slot,0);
 for(let i=1;i<4;i++){
  const ready=wait(players[i],'joined');
  send(players[i],{type:'join',name:'P'+i,code:room.code});
  const result=await ready;assert.equal(result.slot,i);
  assert.equal(result.rules.battleMode,'team');
 }
 for(let i=1;i<4;i++){const ready=wait(h,'presence');send(players[i],{type:'ready',ready:true});await ready;}
 const full=await socket(),error=wait(full,'error');
 send(full,{type:'join',code:room.code,name:'EXTRA'});
 assert.match((await error).message,/dolu/);
 const starts=players.map(p=>wait(p,'start'));
 send(h,{type:'start'});
 const events=await Promise.all(starts);
 assert.ok(events.every(e=>e.matchId===events[0].matchId));
 const inputs=wait(h,'input');
 send(g3,{type:'input',x:2,y:-2,aimX:500,aimY:100,aimActive:true,weapon:'sniper'});
 const input=await inputs;
 assert.equal(input.slot,3);assert.equal(input.x,1);assert.equal(input.y,-1);assert.equal(input.weapon,'sniper');
 const acts=wait(h,'act');
 send(g2,{type:'act',action:'dash'});
 const act=await acts;assert.equal(act.slot,2);assert.equal(act.action,'dash');
 const snapshots=[wait(g1,'state'),wait(g2,'state'),wait(g3,'state')];
 const state={map:{name:'NEON PARK'},phase:'active',players:[{id:0},{id:1},{id:2},{id:3}],score:[0,0]};
 send(h,{type:'state',matchId:events[0].matchId,seq:1,state});
 for(const response of await Promise.all(snapshots)){
  assert.equal(response.state.players.length,4);
  assert.equal(response.seq,1);
 }
 const closed=[wait(g1,'closed'),wait(g2,'closed'),wait(g3,'closed')];
 send(h,{type:'leave'});
 await Promise.all(closed);
 assert.equal(rooms.has(room.code),false);
});

test('FFA rules require four players and sanitize invalid modes',async()=>{
 await before();
 const h=await socket(),made=wait(h,'joined');
 send(h,{type:'create',rules:{battleMode:'ffa',rounds:7}});
 const room=await made;assert.equal(room.rules.battleMode,'ffa');assert.equal(room.rules.rounds,7);
 const denied=wait(h,'error');
 send(h,{type:'start'});
 assert.match((await denied).message,/4 oyuncu/);
 send(h,{type:'leave'});
 const invalid=await socket(),made2=wait(invalid,'joined');
 send(invalid,{type:'create',rules:{battleMode:'unknown'}});
 assert.equal((await made2).rules.battleMode,'duel');
 send(invalid,{type:'leave'});
});
test.after(async()=>{
 for(const w of clients)try{w.close()}catch{}
 await delay(40);
 if(server.listening)await new Promise(resolve=>server.close(resolve));
});

