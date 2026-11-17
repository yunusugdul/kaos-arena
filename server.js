// KAOS ARENA online room relay. Node 22+, dependency-free.
// The host simulates the shared game and transmits state; guests send only controls.
// Intended for casual friend matches on a single Render instance.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.join(__dirname, 'public');
const rooms = new Map();
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_FRAME = 64 * 1024;
const ROOM_TTL_MS = 2 * 60 * 1000;
function newCode() { let id; do { id=Array.from(crypto.randomBytes(6),v=>CHARS[v%CHARS.length]).join(''); } while(rooms.has(id)); return id; }
function token() { return crypto.randomBytes(24).toString('hex'); }
const PRESETS={fusion:{upgrades:true,chaos:true,cards:true,panic:true},evolution:{upgrades:true,chaos:false,cards:true,panic:true},party:{upgrades:false,chaos:true,cards:true,panic:true},classic:{upgrades:false,chaos:false,cards:false,panic:false}};
function validateRules(input){const v=input&&typeof input==='object'&&!Array.isArray(input)?input:{};const preset=Object.hasOwn(PRESETS,v.preset)?v.preset:'fusion';return {battleMode:['duel','team','ffa'].includes(v.battleMode)?v.battleMode:'duel',preset,arena:['cycle','random','0','1','2','3','4'].includes(String(v.arena))?String(v.arena):'cycle',rounds:[3,5,7].includes(Number(v.rounds))?Number(v.rounds):5,upgradePersistence:v.upgradePersistence==='round'?'round':'match',...Object.fromEntries(['upgrades','chaos','cards','panic'].map(k=>[k,typeof v[k]==='boolean'?v[k]:PRESETS[preset][k]]))};}
function safeName(raw){ return String(raw||'OYUNCU').replace(/[\x00-\x1f\x7f<>]/g,'').trim().slice(0,14)||'OYUNCU'; }
function safeChat(raw){return typeof raw==='string'?raw.replace(/[\x00-\x1f\x7f\u202a-\u202e<>]/g,'').trim().slice(0,180):'';}
function send(ws, data){ if(ws && !ws.closed) try { ws.send(JSON.stringify(data)); }catch{} }
function roomCapacity(room){return room.rules.battleMode==='duel'?2:4;}
function roster(room){ return room.members.map((m,i)=>({slot:i,name:m.name,online:!!m.ws&&!m.ws.closed})); }
function presence(room){ const p={type:'presence',code:room.code,players:roster(room),started:room.started,matchId:room.matchId,rules:room.rules,hostPaused:!!room.hostPaused}; room.members.forEach(m=>send(m.ws,p)); }
function cleanup(){ const now=Date.now(); for(const [id,room] of rooms) if(now-room.updated>ROOM_TTL_MS && room.members.every(m=>!m.ws||m.ws.closed)) rooms.delete(id); }
function reject(ws,message){ send(ws,{type:'error',message}); }
function leave(ws,explicit=false){
  const room=ws.room,slot=ws.slot; if(!room)return;
  const m=room.members[slot];
  if(m && m.ws===ws) {m.ws=null;room.updated=Date.now();if(slot===0&&room.started)room.hostPaused=true;}
  ws.room=null;ws.slot=null;
  if(explicit && slot===0){room.members.forEach((x,i)=>{if(i>0){send(x.ws,{type:'closed',message:'Odayı kuran oyuncu ayrıldı.'});if(x.ws){x.ws.room=null;x.ws.slot=null;}}});rooms.delete(room.code);}
  else if(explicit && slot>0){
    // Preserve stable player slots while a four-player match is in progress.
    room.members[slot]={name:'Oyuncu bekleniyor',token:token(),ws:null};
    room.started=false;presence(room);
  }else presence(room);
}
function join(ws,room,slot,reconnected=false){
  if(ws.room) leave(ws,true);
  const m=room.members[slot];
  if(m.ws && m.ws!==ws){send(m.ws,{type:'replaced'});m.ws.room=null;m.ws.slot=null;m.ws.close();}
  m.ws=ws;ws.room=room;ws.slot=slot;room.updated=Date.now();
  send(ws,{type:'joined',code:room.code,slot,token:m.token,players:roster(room),started:room.started,matchId:room.matchId,rules:room.rules,hostPaused:!!room.hostPaused,chatHistory:room.chatHistory||[],reconnected});
  presence(room);
}
function onMessage(ws,raw){
  let d;try{d=JSON.parse(raw);}catch{return reject(ws,'Geçersiz mesaj.');}
  if(!d || typeof d!=='object'||typeof d.type!=='string')return;
  if(d.type==='create'){
    if(ws.room)leave(ws,true);
    const code=newCode();const room={code,members:[{name:safeName(d.name),token:token(),ws:null}],rules:validateRules(d.rules),started:false,matchId:0,hostPaused:false,chatHistory:[],updated:Date.now()};rooms.set(code,room);join(ws,room,0);return;
  }
  if(d.type==='join'){
    const code=String(d.code||'').trim().toUpperCase().replace(/[^A-Z2-9]/g,''); const room=rooms.get(code);
    if(!room)return reject(ws,'Bu oda bulunamadı veya süresi doldu.');
    // Rejoin must prove the secret resume token, never reclaim by nickname alone.
    const resume=room.members.findIndex(m=>m.token===d.token && typeof d.token==='string');
    if(resume!==-1){join(ws,room,resume,true);return;}
    if(room.started)return reject(ws,'Maç devam ediyor. Yeni oyuncular bir sonraki maça katılabilir.');
    const slot=room.members.findIndex((m,i)=>i>0&&(!m.ws||m.ws.closed)&&m.name==='Oyuncu bekleniyor');
    if(slot<0&&room.members.length>=roomCapacity(room))return reject(ws,'Oda dolu.');
    const index=slot>=0?slot:room.members.length;
    const member={name:safeName(d.name),token:token(),ws:null};
    if(slot>=0)room.members[slot]=member;else room.members.push(member);
    join(ws,room,index);return;
  }
  const room=ws.room; if(!room)return reject(ws,'Önce odaya katılmalısın.');
  room.updated=Date.now();
  if(d.type==='leave'){leave(ws,true);return;}
  if(d.type==='start'||d.type==='rematch'){
    if(ws.slot!==0 || room.members.length!==roomCapacity(room) || !room.members.every(m=>m.ws&&!m.ws.closed))return reject(ws,roomCapacity(room)+' oyuncu hazır olmadan maç başlatılamaz.');
    if(d.type==='start'&&room.started)return reject(ws,'Maç zaten başladı. Rövanş için rövanş komutunu kullan.');
    if(d.type==='rematch'&&!room.started)return reject(ws,'Önce ilk maçı başlatmalısın.');
    room.started=true;room.hostPaused=false;room.matchId++;room.lastSnapshotAt=0;
    room.members.forEach(m=>send(m.ws,{type:'start',matchId:room.matchId,rematch:d.type==='rematch'}));return;
  }
  if(d.type==='chat'){
    const msg=safeChat(d.text),member=room.members[ws.slot],now=Date.now();
    if(!msg||!member||now-(member.lastChatAt||0)<650)return;
    member.lastChatAt=now;
    const item={type:'chat',slot:ws.slot,name:member.name,text:msg,at:now};
    room.chatHistory.push(item);if(room.chatHistory.length>40)room.chatHistory.shift();
    room.members.forEach(m=>send(m.ws,item));return;
  }
  if(d.type==='host_pause'&&ws.slot===0&&room.started){
    room.hostPaused=!!d.paused;
    room.members.forEach(m=>send(m.ws,{type:'host_pause',paused:room.hostPaused,reason:room.hostPaused?'Oda kurucusu oyun penceresinden ayrıldı.':'Oda kurucusu oyuna döndü.'}));return;
  }
  if(d.type==='state'){
    if(ws.slot!==0||!room.started||d.matchId!==room.matchId||typeof d.state!=='object'||d.state===null||Array.isArray(d.state))return;
    const state=d.state;if(!Array.isArray(state.players)||state.players.length!==roomCapacity(room)||!Array.isArray(state.score))return;
    const now=Date.now();if(room.lastSnapshotAt&&now-room.lastSnapshotAt<20)return;room.lastSnapshotAt=now;
    room.members.slice(1).forEach(m=>send(m.ws,{type:'state',matchId:room.matchId,seq:Number.isFinite(d.seq)?d.seq:0,state}));return;
  }
  if(d.type==='input'&&ws.slot>0&&room.started){
    const num=n=>Number.isFinite(n)?Math.max(-1,Math.min(1,n)):0;
    const aim=n=>Number.isFinite(n)?Math.max(-1000,Math.min(1000,n)):0;
    send(room.members[0].ws,{type:'input',slot:ws.slot,x:num(d.x),y:num(d.y),aimX:aim(d.aimX),aimY:aim(d.aimY),aimActive:!!d.aimActive,weapon:['pistol','rifle','shotgun','sniper'].includes(d.weapon)?d.weapon:'pistol'});return;
  }
  if(d.type==='upgrade'&&ws.slot>0&&room.started){if(typeof d.choice==='string'&&['rocket','magnet','bank','dash','parry'].includes(d.choice))send(room.members[0].ws,{type:'upgrade',choice:d.choice});return;}
  if(d.type==='act'&&ws.slot>0&&room.started){
    if(!['charge_on','charge_off','dash','parry','card'].includes(d.action))return;
    send(room.members[0].ws,{type:'act',slot:ws.slot,action:d.action});return;
  }
}
function wsFrame(op,payload){
  const data=Buffer.isBuffer(payload)?payload:Buffer.from(payload||'');const n=data.length;
  const header=n<126?Buffer.alloc(2):n<=65535?Buffer.alloc(4):Buffer.alloc(10);
  header[0]=0x80|op;if(n<126)header[1]=n;
  else if(n<=65535){header[1]=126;header.writeUInt16BE(n,2);}
  else{header[1]=127;header.writeBigUInt64BE(BigInt(n),2);}
  return Buffer.concat([header,data]);
}
function upgrade(req,socket,head){
  try{
    const origin=req.headers.origin;
    if(origin && new URL(origin).host!==req.headers.host){socket.destroy();return;}
    if(req.url!=='/ws' || req.headers.upgrade?.toLowerCase()!=='websocket' || req.headers['sec-websocket-version']!=='13' || !/^[A-Za-z0-9+/]{22}==$/.test(String(req.headers['sec-websocket-key']||''))) {socket.destroy();return;}
    const accept=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  }catch{socket.destroy();return;}
  const ws={socket,closed:false,room:null,slot:null,buffer:Buffer.alloc(0),send:msg=>{if(!ws.closed)socket.write(wsFrame(1,msg));},close:()=>{if(!ws.closed){ws.closed=true;socket.end(wsFrame(8,Buffer.alloc(0)));}}};
  socket.on('data',chunk=>{
    if(ws.closed)return;
    ws.buffer=Buffer.concat([ws.buffer,chunk]);
    if(ws.buffer.length>MAX_FRAME+1024){ws.close();return;}
    while(ws.buffer.length>=2){
      const b=ws.buffer;const op=b[0]&15;const fin=!!(b[0]&128);const masked=!!(b[1]&128);let len=b[1]&127,offset=2;
      if(len===126){if(b.length<4)return;len=b.readUInt16BE(2);offset=4;}
      else if(len===127){if(b.length<10)return;const l=b.readBigUInt64BE(2);if(l>BigInt(MAX_FRAME)){ws.close();return;}len=Number(l);offset=10;}
      if(!masked||len>MAX_FRAME||!fin){ws.close();return;}
      if(b.length<offset+4+len)return;
      const mask=b.subarray(offset,offset+4),msg=Buffer.from(b.subarray(offset+4,offset+4+len));
      ws.buffer=b.subarray(offset+4+len);
      for(let i=0;i<msg.length;i++)msg[i]^=mask[i&3];
      if(op===8){ws.close();return;}if(op===9){socket.write(wsFrame(10,msg));continue;}if(op===10)continue;
      if(op!==1){ws.close();return;}
      onMessage(ws,msg.toString('utf8'));
    }
  });
  socket.on('close',()=>{ws.closed=true;leave(ws);});
  socket.on('error',()=>{ws.closed=true;leave(ws);});
  if(head.length)socket.emit('data',head);
  ws.pingTimer=setInterval(()=>{if(ws.closed){clearInterval(ws.pingTimer);return;}try{socket.write(wsFrame(9,'ping'));}catch{}},25000);
  socket.on('close',()=>clearInterval(ws.pingTimer));
}
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{
  if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,rooms:rooms.size}));return;}
  let pathname;try{pathname=new URL(req.url,'http://localhost').pathname;}catch{res.writeHead(400).end();return;}
  if(pathname==='/')pathname='/index.html';
  const pub=new Set(['/index.html','/favicon.svg','/game.js','/style.css','/arena3d.js','/arena3d-detail.js','/audio/pistol-fire.wav']);
  // Allow only the renderer and its official local Three.js postprocess addons.
  const threeBuild=/^\/vendor\/three\.(?:module|core)\.js$/.test(pathname);
  const addon=/^\/vendor\/addons\/(?:postprocessing|shaders)\/[A-Za-z][A-Za-z0-9.-]*\.js$/.test(pathname);
  if(!pub.has(pathname)&&!threeBuild&&!addon){res.writeHead(404).end('Not found');return;}
  const fp=threeBuild?path.join(__dirname,'node_modules','three','build',path.basename(pathname)):
    addon?path.join(__dirname,'node_modules','three','examples','jsm',pathname.slice('/vendor/addons/'.length)):
    path.join(ROOT,pathname);fs.readFile(fp,(err,data)=>{if(err){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);});
});
server.on('upgrade',upgrade);
const cleaner=setInterval(cleanup,60000);cleaner.unref();
if(require.main===module)server.listen(PORT,HOST,()=>console.log('KAOS ARENA online listening on '+HOST+':'+PORT));
module.exports={server,rooms,safeName};
