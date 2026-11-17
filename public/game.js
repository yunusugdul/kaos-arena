
'use strict';
// KAOS ARENA — independent multiplayer arena combat. Fixed logical arena: 1000 x 562.
(() => {
const W=1000,H=562,R=21, TAU=Math.PI*2;
// Staging-exclusive 3D arena deathmatch. Original game logic remains as a fallback in main.
const SHOOTER_MODE=true, SHOOTER_HP=100, SHOOTER_DAMAGE=20, SHOOTER_CLIP=16;
const WEAPONS=Object.freeze({
 pistol:{name:'TABANCA',damage:20,rate:.17,clip:16,reload:1.1,speed:950,range:.96,pellets:1,spread:0,color:'#fff0a6',recoil:.12},
 rifle:{name:'OTOMATİK TÜFEK',damage:12,rate:.085,clip:28,reload:1.4,speed:1120,range:.82,pellets:1,spread:.055,color:'#ffe395',recoil:.10},
 shotgun:{name:'POMPALI',damage:12,rate:.7,clip:6,reload:1.7,speed:780,range:.44,pellets:6,spread:.28,color:'#ffaf83',recoil:.32},
 sniper:{name:'KESKİN NİŞANCI',damage:55,rate:1.1,clip:5,reload:1.9,speed:1450,range:.85,pellets:1,spread:0,color:'#b1f8ff',recoil:.38}
});
const POWERUPS=Object.freeze({heal:{name:'SAĞLIK',color:'#8fff8a',symbol:'+'},speed:{name:'HIZ',color:'#ffe06b',symbol:'⚡'},shield:{name:'KALKAN',color:'#78d8ff',symbol:'◆'},boost:{name:'HASAR',color:'#ff9b62',symbol:'✹'}});
const PLAYER_COLORS=['#b6c18b','#c38d78','#91a7ad','#c9b27b'];
// Each selected 3/5/7 round is won by one elimination. No timed countdown while fighting.
const $=id=>document.getElementById(id);
const canvas=$('arena'), ctx=canvas.getContext('2d',{alpha:true});
// The simulation remains 2D. Three.js only renders an isometric view of its state.
let arena3d=null;
let arenaLoading=null;
function prepareArena(){
 if(arena3d)return Promise.resolve(arena3d);
 return arenaLoading??=import('/arena3d.js').then(mod=>{arena3d=mod.createArena3D(canvas);return arena3d;}).catch(error=>{arenaLoading=null;console.warn('3D unavailable; using canvas.',error);return null;});
}
document.addEventListener('arena:prepare',()=>{prepareArena();});
let startPending=false;
async function startMatchFromMenu(){
 if(startPending)return;startPending=true;
 const button=$('startBtn'),label=button.querySelector('span:nth-child(2)')||button,errorBox=$('startupError');
 const originalLabel=label.textContent;button.disabled=true;label.textContent='ARENA HAZIRLANIYOR…';errorBox?.classList.add('hidden');
 try{
  const ready=await prepareArena();if(!ready)throw Error('3D renderer unavailable');
  options.nickname=$('nick').value.trim().slice(0,14)||'KAOS KRALI';
  newGame();layoutArena();
  ready.draw(game,globalTime,particles,rings,0,0);
 }catch(error){
  console.error('Arena startup failed:',error);
  if(game)returnMenu();
  if(arena3d){arena3d.dispose();arena3d=null;}arenaLoading=null;
  document.body.classList.add('setup-open');
  if(errorBox){errorBox.textContent='3D sahne yüklenemedi. Savaşı başlat düğmesiyle tekrar deneyebilirsin.';errorBox.classList.remove('hidden');}
 }finally{button.disabled=false;label.textContent=originalLabel;startPending=false;}
}

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a), choose=a=>a[Math.floor(Math.random()*a.length)];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const unit=(x,y)=>{let n=Math.hypot(x,y);return n>.00001?{x:x/n,y:y/n}:{x:1,y:0}};
const MAPS=[
 {name:'NEON PARK',glow:'#a591ff',floor:'#15152e',blocks:[{x:350,y:95,w:70,h:128},{x:581,y:337,w:70,h:128},{x:450,y:233,w:100,h:96}],features:[]},
 {name:'BUZ LABİRENTİ',glow:'#79edff',floor:'#112b39',blocks:[{x:318,y:153,w:64,h:246},{x:616,y:153,w:64,h:246},{x:451,y:75,w:98,h:68},{x:451,y:422,w:98,h:65}],features:[]},
 {name:'PORTAL PARTİSİ',glow:'#ff7dc6',floor:'#25142f',blocks:[{x:383,y:112,w:65,h:145},{x:552,y:306,w:65,h:145},{x:451,y:242,w:98,h:78}],features:[{kind:'portal',x:182,y:138,r:36,to:1},{kind:'portal',x:825,y:425,r:36,to:0}]},
 {name:'SEK SEK',glow:'#ffd16e',floor:'#29212e',blocks:[{x:260,y:200,w:110,h:65},{x:630,y:300,w:110,h:65},{x:465,y:60,w:70,h:95},{x:465,y:407,w:70,h:95}],features:[{kind:'bumper',x:500,y:281,r:29},{kind:'bumper',x:146,y:283,r:28},{kind:'bumper',x:854,y:281,r:28}]},
 {name:'SON ŞANS',glow:'#d8ff52',floor:'#142226',blocks:[{x:325,y:92,w:75,h:121},{x:600,y:350,w:75,h:121},{x:468,y:213,w:64,h:137}],features:[{kind:'ice',x:500,y:280,r:123},{kind:'bumper',x:150,y:440,r:31},{kind:'bumper',x:850,y:123,r:31}]}
];
const CARDS={blink:{name:'IŞINLAN',emoji:'🌀',color:'#ab92ff'},frost:{name:'DONDUR',emoji:'❄️',color:'#75e8ff'},shield:{name:'KALKAN',emoji:'🛡️',color:'#e0f27e'}};
const UPGRADES={rocket:{name:'ROKET MOTORU',emoji:'🚀',desc:'Bomba uçuş hızı +%22.'},magnet:{name:'MANYETİK',emoji:'🧲',desc:'Uçarken rakibe doğru hafifçe yönelir.'},bank:{name:'SEKME USTASI',emoji:'🎱',desc:'Bomba 3 yerine 5 kez sekebilir.'},dash:{name:'SERİ ATIL',emoji:'⚡',desc:'Atılma bekleme süresi %25 azalır.'},parry:{name:'REFLEKS',emoji:'🛡️',desc:'Savunma bekleme süresi %25 azalır.'},ghost:{name:'HAYALET BOMBA',emoji:'👻',desc:'Bomba iç engellerin içinden geçer; dış duvarlardan seker.'},charge:{name:'HIZLI ŞARJ',emoji:'🔋',desc:'Bombayı %20 daha hızlı doldur.'},runner:{name:'ÇEVİK ADIM',emoji:'👟',desc:'Normal hareket hızın %8 artar.'},cooling:{name:'SERİN KAN',emoji:'🧊',desc:'Dondurma etkisi %30 daha kısa sürer.'}};
const PRESETS={fusion:{upgrades:true,chaos:true,cards:true,panic:true},evolution:{upgrades:true,chaos:false,cards:true,panic:true},party:{upgrades:false,chaos:true,cards:true,panic:true},classic:{upgrades:false,chaos:false,cards:false,panic:false}};
const DEFAULT_RULES=()=>({preset:'fusion',arena:'cycle',rounds:5,battleMode:'duel',upgradePersistence:'match',...PRESETS.fusion});
function safeRules(value){const v=value&&typeof value==='object'?value:{},preset=Object.hasOwn(PRESETS,v.preset)?v.preset:'fusion';return {battleMode:['duel','team','ffa'].includes(v.battleMode)?v.battleMode:'duel',preset,arena:['cycle','random','0','1','2','3','4'].includes(String(v.arena))?String(v.arena):'cycle',rounds:[3,5,7].includes(Number(v.rounds))?Number(v.rounds):5,upgradePersistence:v.upgradePersistence==='round'?'round':'match',...Object.fromEntries(['upgrades','chaos','cards','panic'].map(k=>[k,typeof v[k]==='boolean'?v[k]:PRESETS[preset][k]]))};}
const CHAOS={turbo:{name:'⚡ TURBO ZAMANI!',color:'#e2ff60'}};
let options={mode:'bot',difficulty:'normal',nickname:'KAOS KRALI',weapon:'pistol',rules:DEFAULT_RULES()};
const net={chatHistory:[],chatUnread:0,matchId:0,focusPaused:false,ws:null,role:null,slot:null,code:null,token:null,players:[],connected:false,closing:false,freeze:false,prevPhase:null,lastState:0,lastInput:0,remote:{x:0,y:0,aimX:0,aimY:0,aimActive:false},remotes:{},hostAway:false,retry:null,snapshots:[],seq:0};
// Each remote snapshot is authoritative. Display interpolation affects rendering only,
// never collision, timers, score, or the game simulation.
const VIEW_DELAY=95,MAX_EXTRAPOLATE=38;
function remotePresentation(now){
 const frames=net.snapshots;
 if(!frames.length)return null;
 const target=now-VIEW_DELAY;
 let a=frames[0],b=frames[frames.length-1];
 for(let i=1;i<frames.length;i++)if(frames[i].t>=target){a=frames[i-1];b=frames[i];break;}
 let blend=0;
 if(b.t>a.t)blend=clamp((target-a.t)/(b.t-a.t),0,1);
 const newest=frames[frames.length-1];
 // Cap extrapolation so temporary network stalls cannot send a player through walls.
 const extrapolate=target>newest.t?Math.min(MAX_EXTRAPOLATE,target-newest.t)/1000:0;
 const players=b.state.players.map((p,i)=>{
  const old=a.state.players[i]||p;
  const jump=Math.hypot(p.x-old.x,p.y-old.y)>135;
  return {x:jump?p.x:lerp(old.x,p.x,blend),y:jump?p.y:lerp(old.y,p.y,blend)};
 });
 const prevBomb=a.state.bomb,curBomb=b.state.bomb;
 const sameProjectile=prevBomb.mode===curBomb.mode&&prevBomb.owner===curBomb.owner;
 const bomb={x:sameProjectile?lerp(prevBomb.x,curBomb.x,blend):curBomb.x,y:sameProjectile?lerp(prevBomb.y,curBomb.y,blend):curBomb.y};
 if(extrapolate){for(let i=0;i<players.length;i++){const q=newest.state.players[i];players[i].x=clamp(players[i].x+q.vx*extrapolate,R+22,W-R-22);players[i].y=clamp(players[i].y+q.vy*extrapolate,R+22,H-R-22)}if(curBomb.mode==='flying'){bomb.x+=curBomb.vx*extrapolate;bomb.y+=curBomb.vy*extrapolate;}}
 return {players,bomb};
}

let game=null, animLast=0, lastHud=0, keys=Object.create(null), muted=false,audio=null,gunNoiseBuffer=null;
let gunshotBuffer=null,gunshotDecoding=false;
const teamAudioBuffers={};
const teamAudioFiles=Object.fromEntries(Object.entries({reload:'/audio/reload.mp3',blue:'/audio/shot-blue.mp3',red:'/audio/shot-red.mp3'}).map(([key,url])=>[key,fetch(url).then(r=>{if(!r.ok)throw Error('missing audio');return r.arrayBuffer();}).catch(()=>null)]));
// CC0 field-recording derived sound is bundled locally; never depend on third-party CDNs.
const gunshotFile=fetch('/audio/pistol-fire.wav').then(r=>{if(!r.ok)throw Error('missing gunshot file');return r.arrayBuffer();}).catch(()=>null);
const CHAT_FADE_MS=4000;
let chatFadeTimer=null;
function showChatTemporarily(){
 const panel=$('gameChatPanel');if(!panel)return;
 if(chatFadeTimer!==null){clearTimeout(chatFadeTimer);chatFadeTimer=null;}
 panel.classList.remove('chat-idle');
 if(document.fullscreenElement&&options.mode==='online'&&game&&!isGameChatActive()){
  chatFadeTimer=setTimeout(()=>{
   if(document.fullscreenElement&&options.mode==='online'&&game&&!isGameChatActive())panel.classList.add('chat-idle');
   chatFadeTimer=null;
  },CHAT_FADE_MS);
 }
}
function resetChatVisibility(){
 if(chatFadeTimer!==null){clearTimeout(chatFadeTimer);chatFadeTimer=null;}
 $('gameChatPanel').classList.remove('chat-idle');
}
let mouse={x:760,y:280,active:false};
let touch={dx:0,dy:0,joystickId:null,throwDown:false};
let particles=[],rings=[],shakes=0,globalTime=0,toastTimer=0,calloutTimer=0;
function snd(type,volume=1,weapon='pistol',team=0){if(muted)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();
    if(!gunshotDecoding){gunshotDecoding=true;
      for(const [key,file] of Object.entries(teamAudioFiles))file.then(bytes=>bytes?audio.decodeAudioData(bytes.slice(0)):null).then(buffer=>{teamAudioBuffers[key]=buffer;}).catch(()=>{});
      gunshotFile.then(bytes=>bytes?audio.decodeAudioData(bytes.slice(0)):null)
    .then(buffer=>{gunshotBuffer=buffer;}).catch(()=>{});}
    if(type==='shot'||type==='reload'){
      const selected=type==='reload'?teamAudioBuffers.reload:teamAudioBuffers[team%2?'red':'blue'];
      if(selected){
        const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=selected;
        source.playbackRate.value=type==='reload'?selected.duration/(WEAPONS[weapon]?.reload||1.4):weapon==='rifle'?1.08:weapon==='shotgun'?.90:weapon==='sniper'?.85:1;
        gain.gain.setValueAtTime(volume*(type==='reload'?.65:.50),audio.currentTime);
        source.connect(gain).connect(audio.destination);source.start();return;
      }
    }
    if(type==='shot'){
    if(gunshotBuffer){
      const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=gunshotBuffer;
      source.playbackRate.value=weapon==='rifle'?1.18:weapon==='shotgun'?.80:weapon==='sniper'?.68:.95+Math.random()*.1;
      gain.gain.setValueAtTime(.52*volume,audio.currentTime);
      source.connect(gain).connect(audio.destination);source.start();return;
    }
    const rate=audio.sampleRate;
    if(!gunNoiseBuffer){
      const size=Math.floor(rate*.105);
      gunNoiseBuffer=audio.createBuffer(1,size,rate);
      const data=gunNoiseBuffer.getChannelData(0);
      for(let i=0;i<size;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/size,2.7);
    }
    const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();
    source.buffer=gunNoiseBuffer;filter.type='bandpass';filter.frequency.value=1250;filter.Q.value=.68;
    gain.gain.setValueAtTime(.24*volume,audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.105);
    source.connect(filter).connect(gain).connect(audio.destination);
    source.start();source.stop(audio.currentTime+.11);return;
  }
  const notes={ready:[[490,.06,'sine',.045]],throw:[[240,.11,'sawtooth',.07],[450,.1,'sine',.04]],hit:[[700,.08,'triangle',.12],[420,.16,'sawtooth',.05]],parry:[[880,.08,'square',.045],[1150,.1,'triangle',.035]],dash:[[110,.1,'sawtooth',.045]],card:[[640,.1,'sine',.08],[940,.18,'sine',.05]],beep:[[740,.07,'square',.018]],boom:[[125,.3,'sawtooth',.16],[63,.5,'triangle',.12]],win:[[490,.12,'sine',.07],[660,.18,'sine',.07],[880,.3,'sine',.08]],shot:[[210,.085,'sawtooth',.11],[92,.11,'triangle',.12]],reload:[[520,.06,'square',.023],[760,.13,'sine',.05]],damage:[[115,.11,'sawtooth',.075]],eliminate:[[92,.25,'triangle',.14],[165,.17,'sawtooth',.11]],click:[[520,.04,'sine',.025]]}[type]||[];for(const [f,len,wave,vol] of notes){const osc=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;osc.type=wave;osc.frequency.setValueAtTime(f,now);osc.frequency.exponentialRampToValueAtTime(Math.max(45,f*.65),now+len);gain.gain.setValueAtTime(vol*volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+len);osc.connect(gain).connect(audio.destination);osc.start(now);osc.stop(now+len+.005)}}catch(e){/* audio is optional */}}
let arenaAmbience=null;
function stopArenaAmbience(){
 if(!arenaAmbience)return;
 try{
  arenaAmbience.gain.gain.setTargetAtTime(0,audio.currentTime,.06);
  arenaAmbience.osc.stop(audio.currentTime+.32);
 }catch{}
 arenaAmbience=null;
}
function updateArenaAmbience(map){
 if(!SHOOTER_MODE||!map||muted||!audio){stopArenaAmbience();return;}
 if(arenaAmbience?.map===map.name)return;
 stopArenaAmbience();
 const tones={
  'NEON PARK':[84,'sine'],
  'BUZ LABİRENTİ':[60,'triangle'],
  'PORTAL PARTİSİ':[126,'sine'],
  'SEK SEK':[71,'triangle'],
  'SON ŞANS':[53,'sine']
 };
 try{
  const [frequency,wave]=tones[map.name]||tones['NEON PARK'];
  const osc=audio.createOscillator(),gain=audio.createGain();
  osc.type=wave;osc.frequency.setValueAtTime(frequency,audio.currentTime);
  gain.gain.setValueAtTime(0,audio.currentTime);
  gain.gain.setTargetAtTime(.006,audio.currentTime,.28);
  osc.connect(gain).connect(audio.destination);osc.start();
  arenaAmbience={map:map.name,osc,gain};
 }catch{/* the match remains fully playable without ambience */}
}
function alertToast(s,seconds=1.4){const el=$('toast');el.textContent=s;el.classList.add('show');toastTimer=seconds}
function flashCallout(s,seconds=2){const el=$('eventCallout');el.textContent=s;el.classList.remove('hidden');calloutTimer=seconds}
function burst(x,y,color,count=14,speed=160){for(let i=0;i<count;i++){const ang=rand(0,TAU),v=rand(speed*.25,speed);particles.push({x,y,vx:Math.cos(ang)*v,vy:Math.sin(ang)*v,size:rand(2,6),t:rand(.3,.85),max:.85,col:color})}if(particles.length>500)particles.splice(0,particles.length-500)}
function ring(x,y,color,max=105,seconds=.48){rings.push({x,y,color,r:0,max,t:seconds,life:seconds})}
function createPlayer(id,name){return {id,name,x:id?850:150,y:281,vx:0,vy:0,face:{x:id?-1:1,y:0},aim:{x:id?-1:1,y:0},r:R,color:PLAYER_COLORS[id%PLAYER_COLORS.length],dashCD:0,dashTime:0,parryCD:0,parryTime:0,shieldTime:0,shieldUsed:false,stun:0,portalCD:0,upgrades:[],card:null,charge:0,charging:false,speed:0,blinkTrail:[],aiThink:0,aiDecision:null}}
function newGame(){prepareArena();document.body.classList.remove('setup-open');particles=[];rings=[];shakes=0;keys=Object.create(null);touch.dx=touch.dy=0;
 game={phase:'ready',round:0,score:[0,0],players:Array.from({length:options.mode==='online'&&options.rules.battleMode!=='duel'?4:2},(_,i)=>createPlayer(i,i===0?options.nickname:options.mode==='bot'?'BOT PATLATÖR':options.mode==='online'?(net.players[i]?.name||'RAKİP '+i):'OYUNCU '+(i+1))),holder:0,bomb:{mode:'held',owner:0,x:150,y:281,vx:0,vy:0,life:0,bounces:0,trail:[],charge:0},map:MAPS[0],fuse:18,initialFuse:18,phaseTime:0,lock:0,rules:safeRules(options.rules),upgradeOffer:[],upgradeChooser:null,upgradeTimer:0,card:null,cardDelay:3.1,chaos:null,chaosStarted:false,chaosTimer:0,snowPatches:[],snowDelay:1.1,elapsed:0,roundLoser:null,pausedFrom:null,beepMark:99,slowTime:0,stats:{throws:[0,0],hits:[0,0],parries:[0,0],dashes:[0,0]}};
 $('landing').classList.add('hidden');$('gameScreen').classList.remove('hidden');document.body.classList.add('is-playing');
 if(options.mode==='online')game.players.forEach((p,i)=>p.name=net.players[i]?.name||(i===0?'KURUCU':'MİSAFİR '+i));
 $('player0Name').textContent=game.players[0].name;$('player1Name').textContent=game.players[1].name;requestAnimationFrame(layoutArena);
 $('modePill').textContent=options.mode==='online'?'🌐 '+net.code+' • '+(['upgrades','chaos','cards','panic'].some(k=>game.rules[k]!==PRESETS[game.rules.preset][k])?'ÖZEL KURALLAR':({fusion:'HEPSİ BİR ARADA',evolution:'BOMBA EVRİMİ',party:'ÇILGIN KAOS',classic:'KLASİK'}[game.rules.preset]||'ÖZEL')):options.mode==='bot'?'🤖 '+({easy:'RAHAT',normal:'DENGELİ',hard:'ÇILGIN'}[options.difficulty]):'👥 AYNI KLAVYE';
 $('controlsHint').innerHTML=options.mode!=='local'?'<b>WASD</b> hareket · <b>SOL TIK</b> şarj/fırlat · <b>SPACE</b> atıl · <b>E</b> savun · <b>Q</b> kart':'<b>P1:</b> WASD, F atış, G atıl, H savun, R kart &nbsp; <b>P2:</b> oklar, L atış, K atıl, J savun, I kart';
 $('keyThrow').textContent=options.mode!=='local'?'SOL TIK':'F';$('keyDash').textContent=options.mode!=='local'?'SPACE':'G';$('keyParry').textContent=options.mode!=='local'?'E':'H';$('keyPower').textContent=options.mode!=='local'?'Q':'R';$('pauseBtn').classList.toggle('hidden',options.mode==='online');$('chatToggle').classList.toggle('hidden',options.mode!=='online');$('gameChatPanel').classList.toggle('hidden',options.mode!=='online');closeGameChat();renderChat();showChatTemporarily();
 const touchDevice=(navigator.maxTouchPoints>0||matchMedia('(pointer:coarse)').matches);if(touchDevice&&$('touchControls').parentElement!==$('gameScreen'))$('gameScreen').append($('touchControls'));$('touchControls').style.display=options.mode!=='local'&&touchDevice?'block':'none';if(options.mode!=='local'&&touchDevice){$('keyThrow').textContent='💣';$('keyDash').textContent='➚';$('keyParry').textContent='⛨';$('keyPower').textContent='✦';$('controlsHint').textContent='Sol joystick ile hareket • FIRLAT basılı tut/bırak • ATIL kaç • SAVUN karşıla • KART kullan';}
 if(SHOOTER_MODE)configureShooterUI();
 if(options.mode==='online'){net.focusPaused=false;net.guestHeardShots=0;net.guestShotCounts=[];startRound();game.phase='countdown';game.phaseTime=2.0;hideOverlay();updateHUD();return;}
 if(SHOOTER_MODE){startRound();game.phase='countdown';game.phaseTime=1.8;hideOverlay();snd('ready');updateHUD();return;}
 startRound();showOverlay('MAÇ BAŞLIYOR','🎯','YENİ KURALLAR, YENİ KAOS','Atış tuşuna basılı tut, nişan al ve bırak. Gelen bombayı savunmayla geri sektir!', [{label:'HAZIRIM, BAŞLAT →',action:()=>{snd('ready');game.phase='countdown';game.phaseTime=3.2;hideOverlay()}}]);updateHUD()}

// Shooter rules are exclusive to the isolated staging branch.
// Preserve the existing arena coordinate system, host-authoritative networking,
// WASD controls and circular player/obstacle collisions.
function shooterWeapon(id){return WEAPONS[id]||WEAPONS.pistol;}
function playerWeapon(p){return shooterWeapon(p.weapon);}
function requiredPlayers(){return options.rules.battleMode==='duel'?2:4;}
function configureShooterUI(){
 document.body.classList.add('shooter-mode');
 $('controlsHint').innerHTML=options.mode==='local'
  ?'<b>P1:</b> WASD, F ateş, G atıl, H kalkan, R şarjör · <b>P2:</b> oklar, L ateş, K atıl, J kalkan, I şarjör'
  :'<b>WASD</b> hareket · <b>SOL TIK</b> ateş · <b>SPACE</b> atıl · <b>E</b> kalkan · <b>R</b> şarjör';
 $('keyThrow').textContent=options.mode==='local'?'F':'SOL TIK';
 $('keyDash').textContent=options.mode==='local'?'G':'SPACE';
 $('keyParry').textContent=options.mode==='local'?'H':'E';
 $('keyPower').textContent=options.mode==='local'?'R':'R';
 $('modePill').textContent=options.mode==='online'?'🌐 '+net.code+' • '+({duel:'1V1',team:'2V2',ffa:'HERKES TEK'}[game.rules.battleMode]):options.mode==='bot'?'🤖 BOT ÇATIŞMASI':'👥 İKİ OYUNCU';
 $('roundLabel').textContent=(game.rules.battleMode==='duel'?'TUR 1 / ':'HEDEF ')+game.rules.rounds;
 $('fuseLabel').textContent='RAUNT';
 $('timerIcon').textContent='🎯';
 $('timerDigits').textContent=String(game.rules.rounds);
 $('bombStatus').textContent='🔫 SİLAH HAZIR';
 $('tipText').textContent='Nişan al, ateş et; R ile şarjör değiştir.';
 document.querySelectorAll('.ability').forEach((item,i)=>{
  const name=item.querySelector('b');
  if(i===0)name.textContent='MERMİ';
  if(i===1)name.textContent='ATIL';
  if(i===2)name.textContent='KALKAN';
 });
 $('cardName').textContent='ŞARJÖR';
 $('touchThrow').innerHTML='🔫<small>ATEŞ</small>';
 $('touchParry').innerHTML='🛡️<small>KALKAN</small>';
 $('touchSkill').innerHTML='↻<small>DOLDUR</small>';
 if($('touchControls').style.display!=='none'){
  $('keyThrow').textContent='🔫';$('keyPower').textContent='↻';
  $('controlsHint').textContent='Sol joystick hareket · ATEŞ basılı tut · ATIL kaç · KALKAN korun · DOLDUR şarjör';
 }
 for(let i=0;i<2;i++){
  const status=$('player'+i+'Status');
  const wrapper=status.parentElement;
  if(!wrapper.querySelector('.shooter-hp-track')){
   const track=document.createElement('div');track.className='shooter-hp-track';
   const fill=document.createElement('span');fill.id='shooterHp'+i;track.append(fill);wrapper.append(track);
  }
 }
}
function startShooterRound(){
 const g=game;
 if(options.mode!=='online')g.rules.battleMode='duel';
 g.shooter=true;
 g.round=0;
 g.score=Array(g.rules.battleMode==='ffa'?4:2).fill(0);g.teamScores=[0,0];
 g.shotsFired=Array(g.players.length).fill(0);g.stats.throws=Array(g.players.length).fill(0);g.stats.hits=Array(g.players.length).fill(0);
 g.powerup=null;g.powerDelay=5.5;g.eliminationFx=null;g.victoryId=null;g.battleMode=g.rules.battleMode;
 g.rules.panic=false;g.rules.chaos=false;g.rules.cards=false;g.rules.upgrades=false;
 g.fuse=999;g.initialFuse=999;g.holder=-1;
 g.bomb={mode:'hidden',owner:0,x:500,y:281,vx:0,vy:0,trail:[],life:0};
 beginShooterRound();
}
function beginShooterRound(){
 const g=game;
 g.round++;
 const arenaOption=g.rules.arena;
 const index=arenaOption==='cycle'?(g.round-1)%MAPS.length:
   arenaOption==='random'?Math.floor(rand(0,MAPS.length)):Number(arenaOption);
 g.map=MAPS[index];g.phase='countdown';g.phaseTime=1.8;
 g.bullets=[];g.roundWinner=null;g.powerup=null;g.powerDelay=4.5;
 g.card=null;g.chaos=null;g.snowPatches=[];g.snowDelay=1.3;g.elapsed=0;
 const starts=[[155,120],[845,442],[155,442],[845,120]];
 for(let i=0;i<g.players.length;i++){
  const p=g.players[i],start=starts[i];p.x=start[0];p.y=start[1];p.vx=0;p.vy=0;
  p.team=i%2;p.hp=SHOOTER_HP;p.dead=false;p.respawn=0;p.invulnerable=.35;
  p.weapon= i===0?options.weapon:(p.weapon||'pistol');
  p.shooting=false;p.ammo=playerWeapon(p).clip;p.reload=0;p.fireCD=0;p.muzzle=0;p.hitFlash=0;
  p.buffSpeedTime=0;p.buffDamageTime=0;p.buffShieldTime=0;p.recoil=0;
  p.shieldTime=0;p.parryCD=0;p.parryTime=0;p.dashCD=0;p.dashTime=0;
  p.stun=0;p.portalCD=0;p.upgrades=[];p.card=null;
  p.aim={x:i?-1:1,y:0};p.face={x:i?-1:1,y:0};
 }
 $('mapName').textContent=({'NEON PARK':'AVLU','BUZ LABİRENTİ':'SOĞUK DEPO','PORTAL PARTİSİ':'GEÇİT','SEK SEK':'TERSANE','SON ŞANS':'SON MEVZİ'}[g.map.name]||g.map.name);hideOverlay();
}
function shooterBotInput(p){
 const op=game.players[0],t=game.elapsed;
 if(p.dead||op.dead)return {x:0,y:0};
 const dx=op.x-p.x,dy=op.y-p.y,d=Math.max(1,Math.hypot(dx,dy));
 const orbit=Math.sin(t*.65)>0?1:-1;
 const go=d>335?1:d<230?-.80:.05;
 let x=dx/d*go-dy/d*orbit*.58,y=dy/d*go+dx/d*orbit*.58;
 for(const b of game.map.blocks){
  const nx=clamp(p.x,b.x,b.x+b.w),ny=clamp(p.y,b.y,b.y+b.h);
  const xx=p.x-nx,yy=p.y-ny,n=Math.hypot(xx,yy);
  if(n<106){const v=unit(xx||p.x-b.x-b.w*.5,yy||p.y-b.y-b.h*.5);
    x+=v.x*(106-n)/106*3;y+=v.y*(106-n)/106*3;}
 }
 if(p.x<85)x+=2;if(p.x>915)x-=2;if(p.y<85)y+=2;if(p.y>477)y-=2;
 return unitOrZero(x,y);
}
function shooterLineClear(x,y,tx,ty){
 // Segment-AABB intersection; no bot wall-hacking shots through obstacles.
 for(const b of game.map.blocks){
  const dx=tx-x,dy=ty-y;
  let near=0,far=1;
  for(const [start,delta,lo,hi] of [[x,dx,b.x-5,b.x+b.w+5],[y,dy,b.y-5,b.y+b.h+5]]){
   if(Math.abs(delta)<1e-9){if(start>=lo&&start<=hi){continue;}near=2;break;}
   const a=(lo-start)/delta,c=(hi-start)/delta;
   near=Math.max(near,Math.min(a,c));far=Math.min(far,Math.max(a,c));
  }
  if(near<=far&&near<=1&&far>=0)return false;
 }
 return true;
}
function shooterReload(id){
 if(!game||game.phase!=='active')return;
 const p=game.players[id];if(!p||p.dead||p.reload>0||p.ammo>=playerWeapon(p).clip)return;
 p.reload=playerWeapon(p).reload;p.shooting=false;snd('reload',id===0?.8:.4,p.weapon,p.team??p.id%2);
 if(id===0)alertToast('↻ ŞARJÖR DEĞİŞTİRİLİYOR',.65);
}
function shooterFire(p){
 const g=game;
 if(!p||p.dead||p.fireCD>0||p.reload>0||g.phase!=='active')return;
 if(p.ammo<=0){shooterReload(p.id);return;}
   const weapon=playerWeapon(p),direction=aimOf(p),spawn=({pistol:24.4,rifle:30.5,shotgun:31.8,sniper:35.5}[p.weapon]||24.4);
 for(let n=0;n<weapon.pellets;n++){
  const angle=(Math.random()-.5)*weapon.spread+(n-(weapon.pellets-1)/2)*(weapon.spread/Math.max(1,weapon.pellets));
  const dx=direction.x*Math.cos(angle)-direction.y*Math.sin(angle);
  const dy=direction.y*Math.cos(angle)+direction.x*Math.sin(angle);
  g.bullets.push({id:g.shotsFired[p.id]+'-'+p.id+'-'+n,owner:p.id,
    x:p.x+dx*spawn,y:p.y+dy*spawn,vx:dx*weapon.speed,vy:dy*weapon.speed,
    t:weapon.range,damage:weapon.damage*(p.buffDamageTime>0?1.5:1),
    color:weapon.color,weapon:p.weapon});
 }
 p.ammo--;p.fireCD=weapon.rate;p.muzzle=.085;p.recoil=weapon.recoil;p.aim=direction;
 g.stats.throws[p.id]++;g.shotsFired[p.id]++;
 if(g.bullets.length>120)g.bullets.splice(0,g.bullets.length-120);
 burst(p.x+direction.x*35,p.y+direction.y*35,'#ffcf78',7,130);
 snd('shot',p.id===(options.mode==='online'?net.slot:0)? .70:.40,p.weapon,p.team??p.id%2);
 if(p.id===(options.mode==='online'?net.slot:0))shakes=Math.max(shakes,weapon.recoil*14);
 if(p.ammo===0){shooterReload(p.id);p.shooting=true;}
}
function shooterHit(p,owner,x,y,damage=SHOOTER_DAMAGE){
 const g=game;
 if(p.dead||p.invulnerable>0)return;
 if(p.shieldTime>0||p.parryTime>0){
  ring(x,y,'#75e8ff',36,.19);snd('parry',.21);return;
 }
 p.hp=Math.max(0,p.hp-damage);p.hitFlash=.24;
 g.stats.hits[owner]++;burst(x,y,p.color,18,165);ring(x,y,'#fff1b0',35,.22);
 g.hitFx={x,y,t:.28,color:p.color};shakes=Math.max(shakes,4);
 snd('damage',p.id===0?.7:.3);
 if(p.hp>0)return;
 p.dead=true;p.respawn=0;p.shooting=false;p.vx=p.vy=0;
 const multi=g.rules.battleMode!=='duel',points=g.rules.rounds;
 const team=owner%2;
 if(g.rules.battleMode==='team')g.score[team]++;
 else g.score[owner]++;
 g.roundWinner=owner;
 g.eliminationFx={x:p.x,y:p.y,t:1.4,color:p.color};
 burst(p.x,p.y,p.color,42,230);ring(p.x,p.y,'#ffe08a',110,.55);
 snd('eliminate',.8);alertToast(g.players[owner].name+' ELEME YAPTI!',1.3);
 if(!multi){g.phase='roundwin';g.phaseTime=1.6;}
 else if(g.score[g.rules.battleMode==='team'?team:owner]>=points){
  g.phase='finished';g.victoryId=owner;shooterMatchOver(g.rules.battleMode==='team'?team:owner);
 }else{p.respawn=1.8;}
}
function shooterMatchOver(winner){
 const g=game;if(options.mode==='online'&&net.role==='guest')return;
 const teamMode=g.rules.battleMode==='team';
 const who=teamMode?(winner===0?'YEŞİL TAKIM':'PEMBE TAKIM'):g.players[winner]?.name||'OYUNCU';
 showOverlay(g.rules.battleMode==='duel'?g.rules.rounds+' TURLUK DÜELLO':g.rules.battleMode==='ffa'?'HERKES TEK':'2V2 TAKIM SAVAŞI',
    '🏆',who+' KAZANDI!',
   'Skor '+g.score.join(' – ')+'. '+(g.stats.throws[0]||0)+' atış • '+(g.stats.hits[0]||0)+' isabet.',
   [{label:'↻ YENİ MAÇ',action:()=>{if(options.mode==='online'){
      netSend({type:'rematch'});showOverlay('RÖVANŞ','⏳','RAKİP BEKLENİYOR','Yeni maç başlatılıyor.',[]);
    }else{newGame();game.phase='countdown';hideOverlay();}}},
    {label:'ANA MENÜ',secondary:true,action:returnMenu}]);
 snd('win',.8);
}
function shooterAdvanceBullets(dt){
 const g=game;
 for(const b of g.bullets){
  if(b.t<=0)continue;b.t-=dt;
  b.x+=b.vx*dt;b.y+=b.vy*dt;
  if(blocked(b.x,b.y,4)||g.map.features.some(f=>f.kind==='bumper'&&Math.hypot(b.x-f.x,b.y-f.y)<f.r+3)){
   b.t=0;burst(b.x,b.y,'#ffd28b',5,85);continue;
  }
  for(const p of g.players){
   if(p.id===b.owner||p.dead||(g.rules.battleMode==='team'&&p.team===b.owner%2))continue;
   if(Math.hypot(b.x-p.x,b.y-p.y)<p.r+5){
    b.t=0;shooterHit(p,b.owner,b.x,b.y,b.damage||SHOOTER_DAMAGE);break;
   }
  }
 }
 g.bullets=g.bullets.filter(b=>b.t>0);
}
function tickPowerups(dt){
 const g=game;if(g.phase!=='active')return;
 if(g.powerup){
  g.powerup.t-=dt;
  if(g.powerup.t<=0){g.powerup=null;g.powerDelay=4;}
 }else{
  g.powerDelay-=dt;
  if(g.powerDelay<=0){
   const candidates=[];
   for(let y=88;y<=474;y+=64)for(let x=90;x<=910;x+=76){
    if(safeCardSpawn(g,{x,y}))candidates.push({x,y});
   }
   if(candidates.length){
    const place=candidates[Math.floor(Math.random()*candidates.length)];
    const types=Object.keys(POWERUPS);
    g.powerup={...place,type:types[Math.floor(Math.random()*types.length)],t:12};
   }
   g.powerDelay=8;
  }
 }
 for(const p of g.players){
  if(p.dead||!g.powerup)continue;
  if(Math.hypot(p.x-g.powerup.x,p.y-g.powerup.y)>p.r+25)continue;
  const type=g.powerup.type;
  if(type==='heal')p.hp=Math.min(SHOOTER_HP,p.hp+45);
  if(type==='speed')p.buffSpeedTime=5;
  if(type==='shield')p.shieldTime=Math.max(p.shieldTime,2.3);
  if(type==='boost')p.buffDamageTime=5;
  burst(g.powerup.x,g.powerup.y,POWERUPS[type].color,21,120);
  ring(g.powerup.x,g.powerup.y,POWERUPS[type].color,65,.38);
  alertToast(p.name+' • '+POWERUPS[type].name,1.1);snd('card',.6);
  g.powerup=null;g.powerDelay=8;break;
 }
}
function tickShooter(dt){
 globalTime+=dt;
 for(const pt of particles){pt.x+=pt.vx*dt;pt.y+=pt.vy*dt;pt.vy+=150*dt;pt.t-=dt;}
 particles=particles.filter(p=>p.t>0);
 for(const r of rings){r.t-=dt;r.r=lerp(r.max,0,r.t/r.life);}
 rings=rings.filter(r=>r.t>0);
 if(shakes>0)shakes=Math.max(0,shakes-35*dt);
 if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');}
 if(calloutTimer>0){calloutTimer-=dt;if(calloutTimer<=0)$('eventCallout').classList.add('hidden');}
 if(!game)return;
 const g=game;
 updateArenaAmbience(g.map);
 if(g.eliminationFx){g.eliminationFx.t-=dt;if(g.eliminationFx.t<=0)g.eliminationFx=null;}
 if(g.hitFx){g.hitFx.t-=dt;if(g.hitFx.t<=0)g.hitFx=null;}
 if(g.phase==='countdown'){g.phaseTime-=dt;if(g.phaseTime<=0){g.phase='active';snd('ready');alertToast('🔫 ÇATIŞMA BAŞLADI!',1);}return;}
 if(g.phase==='roundwin'){
  g.phaseTime-=dt;
  if(g.phaseTime<=0){
   if(g.round>=g.rules.rounds){g.phase='finished';
     shooterMatchOver(g.score[0]>g.score[1]?0:1);
   }else{beginShooterRound();}
  }
  return;
 }
 if(g.phase!=='active')return;
 g.elapsed+=dt;
 tickPowerups(dt);
 const steps=Math.max(1,Math.ceil(dt/.008)),step=dt/steps;
 if(options.mode==='bot'){
  const bot=g.players[1],human=g.players[0];
  bot.shooting=!bot.dead&&!human.dead&&dist(bot,human)<685&&shooterLineClear(bot.x,bot.y,human.x,human.y);
  if(bot.ammo===0&&bot.reload<=0)shooterReload(1);
 }
 snowStep(dt);
 for(let n=0;n<steps;n++){
  for(const p of g.players){
   p.fireCD=Math.max(0,p.fireCD-step);
   p.muzzle=Math.max(0,p.muzzle-step);
   p.hitFlash=Math.max(0,p.hitFlash-step);
   p.recoil=Math.max(0,(p.recoil||0)-step*.9);
   p.buffSpeedTime=Math.max(0,(p.buffSpeedTime||0)-step);
   p.buffDamageTime=Math.max(0,(p.buffDamageTime||0)-step);
   p.invulnerable=Math.max(0,p.invulnerable-step);
   if(p.dead){p.respawn-=step;if(p.respawn<=0&&g.rules.battleMode!=='duel'){
      p.dead=false;p.hp=SHOOTER_HP;p.ammo=playerWeapon(p).clip;p.reload=0;
      const start=[[155,120],[845,442],[155,442],[845,120]][p.id];
      p.x=start[0];p.y=start[1];p.vx=p.vy=0;p.invulnerable=1.1;
      burst(p.x,p.y,p.color,14,130);
     }continue;}
   if(p.reload>0){p.reload-=step;if(p.reload<=0){p.reload=0;p.ammo=playerWeapon(p).clip;}}
   updatePlayer(p,step);
   if(p.shooting)shooterFire(p);
  }
  adjustPlayerOverlap();
  shooterAdvanceBullets(step);
  if(g.phase!=='active')break;
 }
}
function updateMultiplayerHud(){
 if(!game)return;
 const box=$('multiScore');if(!box)return;
 const target=$('multiTarget');
 const four=game.players.length===4,mode=game.rules.battleMode;
 box.classList.toggle('hidden',!four);
 target.classList.toggle('hidden',!four);
 if(four)target.textContent=(mode==='team'?'🟩 2V2 TAKIM':'🎯 4 OYUNCU • HERKES TEK')+' • İLK '+game.rules.rounds+' ELEME';
 document.body.classList.toggle('four-player-match',four);
 if(!four)return;
 if(box.children.length!==4){
  box.replaceChildren();
  for(let i=0;i<4;i++){
   const row=document.createElement('div');row.className='multi-score-player';
   const name=document.createElement('strong');name.className='multi-player-name';
   const hp=document.createElement('div');hp.className='multi-player-hp';
   const fill=document.createElement('span');hp.append(fill);
   const kills=document.createElement('b');kills.className='multi-player-kills';
   row.append(name,hp,kills);box.append(row);
  }
 }
 for(let i=0;i<4;i++){
  const row=box.children[i],p=game.players[i];
  row.classList.toggle('self',i===(net.slot||0));
  row.style.setProperty('--player-color',p.color);
  row.children[0].textContent=(mode==='team'?(i%2?'🩷 ':'🟩 '):'')+p.name;
  row.children[1].firstChild.style.width=(100*Math.max(0,p.hp||0)/SHOOTER_HP)+'%';
  row.children[1].firstChild.style.background=p.color;
  row.children[2].textContent=mode==='team'?'TAKIM '+game.score[i%2]:'✕ '+game.score[i];
 }
}
function updateShooterHUD(){
 if(!game)return;
 const g=game,self=options.mode==='online'?net.slot??0:0,p=g.players[self]||g.players[0];
 updateMultiplayerHud();
 for(let i=0;i<2;i++){
  const pp=g.players[i];$('score'+i).textContent=g.score[i];
  $('player'+i+'Status').textContent=pp.dead?'ELENDİ':Math.ceil(pp.hp)+' CAN';
  const hpFill=$('shooterHp'+i);if(hpFill){hpFill.style.width=(pp.hp/SHOOTER_HP*100)+'%';hpFill.style.background=pp.hp<35?'#b4614f':i===0?'#bcc795':'#c49e89';}
  $('scoreBox'+i).style.boxShadow=pp.hitFlash>0?'inset 0 0 20px #ff728060':'none';
 }
 $('roundLabel').textContent=g.rules.battleMode==='duel'?'TUR '+g.round+' / '+g.rules.rounds:g.rules.battleMode==='team'?'2V2 • TAKIM SAVAŞI':'HERKES TEK • 4 OYUNCU';
 $('fuseLabel').textContent=g.rules.battleMode==='duel'?'TUR SAYISI':'ELEME HEDEFİ';
 $('timerIcon').textContent='🎯';
 $('timerDigits').textContent=String(g.rules.rounds);
 $('bombStatus').textContent=p.dead?(g.rules.battleMode==='duel'?'☠️ TUR BİTTİ':'☠️ YENİDEN DOĞUYORSUN'):p.reload>0?'↻ ŞARJÖR YENİLENİYOR':'🔫 '+playerWeapon(p).name+' • '+p.ammo+' / '+playerWeapon(p).clip;
 $('bombStatus').style.color=p.dead?'#ff6c88':'#d8ff52';
 $('tipText').textContent='';
 $('throwMeter').style.width=(p.ammo/playerWeapon(p).clip*100)+'%';
 $('dashMeter').style.width=clamp((1-p.dashCD/3.15)*100,0,100)+'%';
 $('parryMeter').style.width=clamp((1-p.parryCD/3.5)*100,0,100)+'%';
 $('cardName').textContent=p.reload>0?'DOLDURULUYOR':'ŞARJÖR DOLDUR';
 $('cardMeter').style.width=(p.reload>0?clamp((1-p.reload/playerWeapon(p).reload)*100,0,100):100)+'%';
}
let renderRecoveryVisible=false;
function drawShooterArena(){
 if(arena3d){
  try{arena3d.draw(game,globalTime,particles,rings,shakes,options.mode==='online'?(net.slot??0):0);ctx.clearRect(0,0,W,H);renderRecoveryVisible=false;return;}
  catch(error){console.error('3D scene failed:',error);arena3d.dispose();arena3d=null;arenaLoading=null;}
 }
 // Never substitute the old emoji arena during a delayed or failed 3D startup.
 ctx.clearRect(0,0,W,H);ctx.fillStyle='#172b28';ctx.fillRect(0,0,W,H);
 if(!arenaLoading&&!renderRecoveryVisible){
  renderRecoveryVisible=true;
  showOverlay('GÖRÜNTÜ','', '3D SAHNE YÜKLENEMEDİ','Tekrar deneyebilir veya ana menüye dönebilirsin.',[
   {label:'TEKRAR DENE',action:async()=>{const ready=await prepareArena();if(ready)hideOverlay();renderRecoveryVisible=false;}},
   {label:'ANA MENÜ',secondary:true,action:returnMenu}
  ]);
 }
}

function pressShooterControl(code,down){
 if(options.mode==='online'){
  const acts={Space:'dash',KeyE:'parry',KeyQ:'card',KeyR:'card'};
  const action=acts[code];if(!action||!down)return;
  if(net.role==='guest')netSend({type:'act',action});
  else if(net.role==='host'){if(action==='dash')useDash(0);if(action==='parry')useParry(0);if(action==='card')useCard(0);}
  return;
 }
 const act0={Space:'dash',KeyE:'parry',KeyQ:'card',KeyR:'card',KeyF:'throw',KeyG:'dash',KeyH:'parry'};
 const act1={KeyL:'throw',KeyK:'dash',KeyJ:'parry',KeyI:'card'};
 const a=options.mode==='local'?(act0[code]||act1[code]):act0[code];
 if(!a)return;
 const id=options.mode==='local'&&act1[code]?1:0;
 if(a==='throw'){if(down)beginCharge(id);else endCharge(id);}
 else if(down){if(a==='dash')useDash(id);if(a==='parry')useParry(id);if(a==='card')useCard(id);}
}

function startRound(){if(SHOOTER_MODE){startShooterRound();return;}const g=game,nextHolder=g.round===0?Math.floor(rand(0,2)):(1-g.roundLoser);g.round++;g.map=MAPS[g.rules.arena==='random'?Math.floor(rand(0,MAPS.length)):g.rules.arena==='cycle'?(g.round-1)%MAPS.length:Number(g.rules.arena)];g.holder=nextHolder;g.phase='countdown';g.phaseTime=3.15;g.initialFuse=rand(19,23.4);g.fuse=g.initialFuse;g.beepMark=99;g.elapsed=0;g.lock=.55;g.bomb={mode:'held',owner:g.holder,x:g.players[g.holder].x,y:g.players[g.holder].y-27,vx:0,vy:0,life:0,bounces:0,trail:[],charge:0};g.card=null;g.cardDelay=3.6;g.upgradeOffer=[];g.upgradeChooser=null;g.upgradeTimer=0;g.chaos=null;g.chaosStarted=false;g.chaosTimer=0;g.snowPatches=[];g.snowDelay=.9;g.roundLoser=null;g.slowTime=0;
 g.players.forEach((p,i)=>{p.x=i?850:150;p.y=281;p.vx=p.vy=p.speed=0;p.face={x:i?-1:1,y:0};p.aim={x:i?-1:1,y:0};p.charging=false;p.charge=0;p.dashCD=0;p.dashTime=0;p.parryCD=0;p.parryTime=0;p.shieldTime=0;p.shieldUsed=false;p.stun=0;p.portalCD=0;p.card=null;p.aiThink=0;p.aiDecision=null});$('mapName').textContent=({'NEON PARK':'AVLU','BUZ LABİRENTİ':'SOĞUK DEPO','PORTAL PARTİSİ':'GEÇİT','SEK SEK':'TERSANE','SON ŞANS':'SON MEVZİ'}[g.map.name]||g.map.name);hideOverlay()}
function showOverlay(eyebrow,icon,title,description,actions=[]){$('overlayEyebrow').textContent=eyebrow;$('overlayIcon').textContent=icon;$('overlayTitle').textContent=title;$('overlayDesc').textContent=description;const div=$('overlayFoot');div.replaceChildren();for(const a of actions){const b=document.createElement('button');b.textContent=a.label;if(a.secondary)b.classList.add('secondary-btn');b.addEventListener('click',()=>{snd('click');a.action()});div.appendChild(b)}$('overlay').classList.remove('hidden')}
function hideOverlay(){$('overlay').classList.add('hidden')}
function returnMenu(){document.body.classList.remove('setup-open');stopArenaAmbience();resetChatVisibility();if(options.mode==='online')leaveOnline();closeGameChat();$('gameChatPanel').classList.add('hidden');game=null;keys=Object.create(null);document.body.classList.remove('is-playing');$('gameScreen').classList.add('hidden');$('landing').classList.remove('hidden');hideOverlay();$('eventCallout').classList.add('hidden');} 
function pauseGame(){if(options.mode==='online')return;if(!game)return;if(game.phase==='paused'){game.phase=game.pausedFrom;hideOverlay();return}if(!['active','countdown'].includes(game.phase))return;game.pausedFrom=game.phase;game.phase='paused';showOverlay('MOLA ZAMANI','⏸️','OYUN DURAKLATILDI','Hazır olduğunda kaldığın yerden devam et.',[{label:'DEVAM ET →',action:pauseGame},{label:'ANA MENÜ',secondary:true,action:returnMenu}])}
function showHelp(){$('infoDialog').classList.remove('hidden');$('infoDialog').setAttribute('aria-hidden','false');$('infoClose').focus();}
function closeHelp(){$('infoDialog').classList.add('hidden');$('infoDialog').setAttribute('aria-hidden','true');$('helpBtn').focus();}
// For help: set text safely but preserve user-independent markup in a controlled block.
const origShowOverlay=showOverlay;
showOverlay=function(eyebrow,icon,title,description,actions=[],html=false){origShowOverlay(eyebrow,icon,title,description,actions);if(html)$('overlayDesc').innerHTML=description};
function movementInput(p){if(options.mode==='online'&&p.id>0){const r=net.remotes[p.id]||net.remote;return unitOrZero(r.x||0,r.y||0);}if(p.id===1&&options.mode==='bot')return botInput(p);let x=0,y=0;
 if(p.id===0){x=+(!!keys['KeyD'])-+(!!keys['KeyA']);y=+(!!keys['KeyS'])-+(!!keys['KeyW']);if(touch.joystickId!==null){x=touch.dx;y=touch.dy}}
 else {x=+(!!keys['ArrowRight'])-+(!!keys['ArrowLeft']);y=+(!!keys['ArrowDown'])-+(!!keys['ArrowUp'])}
 return unitOrZero(x,y)}
function unitOrZero(x,y){const n=Math.hypot(x,y);return n>0?{x:x/n,y:y/n}:{x:0,y:0}}
function blocked(x,y,r){if(x<r+22||x>W-r-22||y<r+22||y>H-r-22)return true;for(const b of game.map.blocks){if(x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h)return true}return false}
function seekCard(p){return game.card&&p.card===null?game.card:null}
function botInput(p){if(SHOOTER_MODE)return shooterBotInput(p);const g=game, me=p, op=g.players[0];let target={x:op.x,y:op.y},x=0,y=0;const holding=g.holder===1,card=seekCard(p),difficulty=options.difficulty;
 if(holding){const to=unit(op.x-p.x,op.y-p.y);const desired=clamp((dist(p,op)-280)/230,-.4,.8);x=to.x*desired+(-to.y)*.3;y=to.y*desired+(to.x)*.3;if(card&&dist(p,card)<280){target=card;x=target.x-p.x;y=target.y-p.y}}
 else {const towards=unit(p.x-op.x,p.y-op.y);const targetSep=difficulty==='hard'?280:210;const sep=dist(p,op);x=towards.x*(sep<targetSep?1:-.12);y=towards.y*(sep<targetSep?1:-.12);if(card&&(!g.bomb||g.bomb.mode==='held')&&dist(p,card)<360){x=card.x-p.x;y=card.y-p.y}
  if(g.bomb.mode==='flying'&&g.bomb.owner===0){const b=g.bomb,v=unit(b.x-p.x,b.y-p.y),near=dist(p,b);if(near<190){const cross=unit(-b.vy,b.vx);x=cross.x*(Math.sin(g.elapsed*4)>0?1:-1);y=cross.y*(Math.sin(g.elapsed*4)>0?1:-1)}}}
 // Obstacles & walls repulsion. Weighted to avoid simple faceplant against blocks.
 for(const b of g.map.blocks){const nx=clamp(p.x,b.x,b.x+b.w),ny=clamp(p.y,b.y,b.y+b.h),dx=p.x-nx,dy=p.y-ny,d=Math.hypot(dx,dy);if(d<105){const away=unit(dx||p.x-(b.x+b.w/2),dy||p.y-(b.y+b.h/2));const factor=(105-d)/105*280;x+=away.x*factor;y+=away.y*factor}}
 x+=p.x<95?250:p.x>905?-250:0;y+=p.y<90?190:p.y>472?-190:0;
 if(difficulty==='easy'&&Math.sin(g.elapsed*2.4)>0.8){x*=.35;y*=.35}
 return unitOrZero(x,y)}
function aimOf(p){const op=game.players[p.id===0?1:0]||game.players[0];const remote=net.remotes[p.id]||net.remote;
 if(options.mode==='online'&&p.id>0&&remote.aimActive)return unit(remote.aimX-p.x,remote.aimY-p.y);if(options.mode==='online'&&p.id===0&&mouse.active)return unit(mouse.x-p.x,mouse.y-p.y);if(options.mode==='bot'&&p.id===0&&mouse.active){return unit(mouse.x-p.x,mouse.y-p.y)}
 if(p.id===1&&options.mode==='bot'){let tx=op.x,ty=op.y;const lead=options.difficulty==='hard'?.25:options.difficulty==='normal'?.12:0;tx+=op.vx*lead;ty+=op.vy*lead;return unit(tx-p.x,ty-p.y)}
 // In same-keyboard mode use automatic soft aim towards the other player when nearby.
 const straight=unit(op.x-p.x,op.y-p.y),f=p.face||straight;return unit(straight.x*.79+f.x*.21,straight.y*.79+f.y*.21)}
function beginCharge(id){if(SHOOTER_MODE){if(game?.phase==='active'){const p=game.players[id];if(p&&!p.dead)p.shooting=true;}return;}if(!game||game.phase!=='active'||game.holder!==id||game.bomb.mode!=='held'||game.lock>0)return;const p=game.players[id];if(!p.charging){p.charging=true;p.charge=.05;snd('ready',.23)}}
function endCharge(id){if(SHOOTER_MODE){if(game?.players[id])game.players[id].shooting=false;return;}if(!game||game.phase!=='active')return;const p=game.players[id];if(!p.charging)return;p.charging=false;if(game.holder!==id||game.bomb.mode!=='held'){p.charge=0;return}let charge=clamp(p.charge/.85,.06,1);p.charge=0;throwBomb(id,charge)}
function throwBomb(id,power){const g=game,p=g.players[id],dir=aimOf(p),b=g.bomb;if(g.holder!==id||b.mode!=='held'||g.lock>0)return;const speed=lerp(460,895,power)*(p.upgrades.includes('rocket')?1.22:1)*(p.upgrades.includes('ghost')?.91:1);b.mode='flying';b.owner=id;b.x=p.x+dir.x*34;b.y=p.y+dir.y*34;b.vx=dir.x*speed;b.vy=dir.y*speed;b.life=1.45;b.bounces=0;b.charge=power;b.trail=[];p.charge=0;g.lock=.18;g.stats.throws[id]++;burst(b.x,b.y,'#ffdc75',10,115);ring(b.x,b.y,'#d8ff52',38,.2);snd('throw');alertToast(power>.78?'🔥 MÜKEMMEL ATIŞ!':'💣 BOMBA FIRLATILDI',.65)}
function useDash(id){if(!game||game.phase!=='active')return;const p=game.players[id];if(p.dashCD>0||p.stun>0)return;p.dashCD=p.upgrades.includes('dash')?2.36:3.15;p.dashTime=.23;game.stats.dashes[id]++;const dir=movementInput(p),aim=Math.hypot(dir.x,dir.y)>0?dir:p.face;p.face=aim;p.vx=aim.x*900;p.vy=aim.y*900;burst(p.x,p.y,p.color,15,135);ring(p.x,p.y,p.color,65,.35);snd('dash');if(id===0)alertToast('➚ ATILMA!',.5)}
function useParry(id){if(SHOOTER_MODE){if(game?.phase!=='active')return;const p=game.players[id];if(!p||p.dead||p.parryCD>0)return;p.parryCD=3.5;p.shieldTime=.9;ring(p.x,p.y,'#a9edff',64,.28);snd('parry',.38);return;}if(!game||game.phase!=='active')return;const p=game.players[id];if(p.parryCD>0||p.stun>0)return;p.parryCD=p.upgrades.includes('parry')?2.63:3.5;p.parryTime=.42;ring(p.x,p.y,'#80e7ff',75,.5);snd('parry',.6);if(id===0)alertToast('⛨ KARŞILAMA PENCERESİ!',.6)}
function useCard(id){if(SHOOTER_MODE){shooterReload(id);return;}if(!game||game.phase!=='active')return;const g=game,p=g.players[id];if(!p.card)return;const card=p.card;p.card=null;const enemy=g.players[1-id];if(card==='blink'){const dir=aimOf(p);let success=false;for(let i=9;i>=1;i--){const length=200*i/9,nx=p.x+dir.x*length,ny=p.y+dir.y*length;if(!blocked(nx,ny,R+3)){burst(p.x,p.y,'#ad87ff',18,160);p.x=nx;p.y=ny;success=true;break}}if(!success){p.card=card;return}burst(p.x,p.y,'#ad87ff',20,180);ring(p.x,p.y,'#ad87ff',100,.5);alertToast('🌀 IŞINLANDIN!')}
 else if(card==='frost'){enemy.stun=Math.max(enemy.stun,enemy.upgrades.includes('cooling')?.61:.87);burst(enemy.x,enemy.y,'#75e8ff',19,145);ring(enemy.x,enemy.y,'#75e8ff',100,.5);alertToast(id===0?'❄️ RAKİP DONDU!':'❄️ DONDUN!')}
 else if(card==='shield'){p.shieldTime=3.5;p.shieldUsed=false;ring(p.x,p.y,'#e0f27e',80,.5);alertToast(id===0?'🛡️ KALKAN AÇILDI!':'🛡️ RAKİP KALKAN AÇTI!')}
 snd('card')}
function ricochet(b,nx,ny){const dot=b.vx*nx+b.vy*ny;b.vx-=2*dot*nx;b.vy-=2*dot*ny;b.bounces++;burst(b.x,b.y,'#ffce63',7,115);snd('parry',.18);if(b.bounces>=(game.players[b.owner].upgrades.includes('bank')?5:3)){b.mode='return'} }
function tagOpponent(b,id){const g=game,p=g.players[id];if(p.parryTime>0||p.shieldTime>0){p.parryTime=0;g.stats.parries[id]++;if(p.shieldTime>0)p.shieldTime=0;b.owner=id===0?1:0;b.mode='return';b.life=.5;p.stun=0;shakes=3;ring(p.x,p.y,'#82eeff',120,.5);burst(p.x,p.y,'#82eeff',22,210);snd('parry');alertToast(id===0?'⛨ EFSANE SAVUNMA!':'⛨ BOT GERİ SEKTİRDİ!',.85);return}
 g.stats.hits[b.owner]++;const bankshot=b.bounces>0;g.holder=id;g.lock=.40;b.mode='held';b.owner=id;b.x=p.x;b.y=p.y-28;p.charging=false;p.charge=0;shakes=7;ring(p.x,p.y,'#ff80b9',110,.5);burst(p.x,p.y,'#ff80b9',24,210);snd('hit');alertToast(bankshot?'🎱 RİKOŞET İSABETİ!':id===0?'💥 BOMBA SENDE!':'🎯 BOMBA RAKİPTE!',.95)}
function updateBomb(dt){const g=game,b=g.bomb;if(b.mode==='held'){const p=g.players[g.holder];b.x=p.x+Math.sin(globalTime*7)*3;b.y=p.y-37-Math.sin(globalTime*6)*4;return}
 b.trail.push({x:b.x,y:b.y,t:.32});if(b.trail.length>13)b.trail.shift();for(const t of b.trail)t.t-=dt;
 if(b.mode==='flying'){const px=b.x,py=b.y;if(g.players[b.owner].upgrades.includes('magnet')){const foe=g.players[1-b.owner],v=unit(foe.x-b.x,foe.y-b.y),speed=Math.hypot(b.vx,b.vy),k=clamp(1.43*dt,0,.075);const vv=unit(lerp(b.vx/Math.max(1,speed),v.x,k),lerp(b.vy/Math.max(1,speed),v.y,k));b.vx=vv.x*speed;b.vy=vv.y*speed;}b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;const r=15;
 if(b.x<r+22){b.x=r+22;ricochet(b,1,0)}else if(b.x>W-r-22){b.x=W-r-22;ricochet(b,-1,0)}
 if(b.y<r+22){b.y=r+22;ricochet(b,0,1)}else if(b.y>H-r-22){b.y=H-r-22;ricochet(b,0,-1)}
 if(!g.players[b.owner].upgrades.includes('ghost'))for(const o of g.map.blocks){if(b.x+r>o.x&&b.x-r<o.x+o.w&&b.y+r>o.y&&b.y-r<o.y+o.h){const fromLeft=px+r<=o.x,fromRight=px-r>=o.x+o.w,fromTop=py+r<=o.y,fromBottom=py-r>=o.y+o.h;if(fromLeft){b.x=o.x-r;ricochet(b,-1,0)}else if(fromRight){b.x=o.x+o.w+r;ricochet(b,1,0)}else if(fromTop){b.y=o.y-r;ricochet(b,0,-1)}else if(fromBottom){b.y=o.y+o.h+r;ricochet(b,0,1)}else{const dx=b.x-(o.x+o.w/2),dy=b.y-(o.y+o.h/2);if(Math.abs(dx/o.w)>Math.abs(dy/o.h)){ricochet(b,Math.sign(dx)||1,0);b.x=dx<0?o.x-r:o.x+o.w+r}else{ricochet(b,0,Math.sign(dy)||1);b.y=dy<0?o.y-r:o.y+o.h+r}}break}}
 for(const f of g.map.features){if(f.kind==='bumper'&&Math.hypot(b.x-f.x,b.y-f.y)<f.r+15){const dir=unit(b.x-f.x,b.y-f.y);b.x=f.x+dir.x*(f.r+18);b.y=f.y+dir.y*(f.r+18);const sp=Math.hypot(b.vx,b.vy)*1.10;b.vx=dir.x*sp;b.vy=dir.y*sp;burst(b.x,b.y,'#ffdb71',12,160);snd('hit',.28);b.bounces++}}
 if(b.life<=0)b.mode='return';}
 if(b.mode==='return'){const owner=g.players[b.owner],v=unit(owner.x-b.x,owner.y-25-b.y),d=Math.hypot(owner.x-b.x,owner.y-25-b.y),step=1000*dt;if(d<step+18){b.mode='held';g.holder=b.owner;g.lock=.18;b.x=owner.x;b.y=owner.y-34;return}b.x+=v.x*step;b.y+=v.y*step;}
 const enemy=g.players[1-b.owner];if(Math.hypot(b.x-enemy.x,b.y-enemy.y)<enemy.r+13&&g.lock<=0)tagOpponent(b,enemy.id);
}
function circleRectResolve(p,b){const nx=clamp(p.x,b.x,b.x+b.w),ny=clamp(p.y,b.y,b.y+b.h);let dx=p.x-nx,dy=p.y-ny;let d=Math.hypot(dx,dy);if(d<p.r){if(d<.001){const left=Math.abs(p.x-b.x),right=Math.abs(p.x-(b.x+b.w)),top=Math.abs(p.y-b.y),bottom=Math.abs(p.y-(b.y+b.h));const min=Math.min(left,right,top,bottom);if(min===left)p.x=b.x-p.r;else if(min===right)p.x=b.x+b.w+p.r;else if(min===top)p.y=b.y-p.r;else p.y=b.y+b.h+p.r;p.vx=p.vy=0;return}const normal={x:dx/d,y:dy/d};p.x+=normal.x*(p.r-d+0.2);p.y+=normal.y*(p.r-d+0.2);const dot=p.vx*normal.x+p.vy*normal.y;if(dot<0){p.vx-=dot*normal.x;p.vy-=dot*normal.y}}}
function updatePlayer(p,dt){p.dashCD=Math.max(0,p.dashCD-dt);p.parryCD=Math.max(0,p.parryCD-dt);p.dashTime=Math.max(0,p.dashTime-dt);p.parryTime=Math.max(0,p.parryTime-dt);p.shieldTime=Math.max(0,p.shieldTime-dt);p.stun=Math.max(0,p.stun-dt);p.portalCD=Math.max(0,p.portalCD-dt);
 const i=movementInput(p);if(Math.hypot(i.x,i.y)>.12)p.face={x:i.x,y:i.y};p.aim=aimOf(p);let speed=275*(p.upgrades.includes('runner')?1.08:1)*(SHOOTER_MODE&&p.buffSpeedTime>0?1.45:1);if(game.rules.panic&&game.fuse<5)speed*=1.12;
 if(game.chaos==='turbo')speed*=1.4;
 let icy=game.map.features.some(f=>f.kind==='ice'&&Math.hypot(p.x-f.x,p.y-f.y)<f.r);
 // Snow slows movement by exactly 50% only while physically inside a patch.
 const inSnow=game.map===MAPS[1]&&game.snowPatches.some(f=>Math.hypot(p.x-f.x,p.y-f.y)<f.r+4);
 if(inSnow)speed*=.5;
 if(p.stun>0)speed=0;
 if(p.dashTime>0){p.vx=p.face.x*760*(inSnow?.5:1);p.vy=p.face.y*760*(inSnow?.5:1)}
 else {let ease=icy?(game.map===MAPS[4]?11:3.2):13;let desireX=i.x*speed,desireY=i.y*speed;p.vx=lerp(p.vx,desireX,clamp(ease*dt,0,1));p.vy=lerp(p.vy,desireY,clamp(ease*dt,0,1))}
 p.x=clamp(p.x+p.vx*dt,p.r+22,W-p.r-22);p.y=clamp(p.y+p.vy*dt,p.r+22,H-p.r-22);
 for(const b of game.map.blocks)circleRectResolve(p,b);
 for(const f of game.map.features){if(f.kind==='bumper'){const d=Math.hypot(p.x-f.x,p.y-f.y);if(d<p.r+f.r){const dir=unit(p.x-f.x,p.y-f.y);p.x=f.x+dir.x*(p.r+f.r+2);p.y=f.y+dir.y*(p.r+f.r+2);p.vx=dir.x*460;p.vy=dir.y*460;if(Math.random()<.28)burst(p.x,p.y,'#ffe989',4,75)}}if(f.kind==='portal'&&p.portalCD<=0&&Math.hypot(p.x-f.x,p.y-f.y)<f.r*.65){const target=game.map.features.find((v,j)=>v.kind==='portal'&&v.to!==f.to);if(target){burst(p.x,p.y,'#b399ff',18,160);p.x=clamp(target.x+rand(-30,30),60,940);p.y=clamp(target.y+rand(-30,30),60,502);p.portalCD=1.45;burst(p.x,p.y,'#b399ff',18,160);snd('card',.5)}}}
 if(p.charging&&game.holder===p.id&&game.bomb.mode==='held')p.charge=Math.min(.95,p.charge+dt*(p.upgrades.includes('charge')?1.2:1));
}
function adjustPlayerOverlap(){
 const players=game.players;
 for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
  const a=players[i],b=players[j];if(a.dead||b.dead)continue;
  const d=dist(a,b);
  if(d<a.r+b.r+3){
   const dir=d>1e-5?unit(b.x-a.x,b.y-a.y):{x:1,y:0};
   const n=(a.r+b.r+3-d)/2;
   a.x-=dir.x*n;b.x+=dir.x*n;a.y-=dir.y*n;b.y+=dir.y*n;
  }
 }
}
// Spawning safety is the ONLY gameplay fix in the 3D update: preserve pickup types,
// timings and collisions, but keep the card footprint away from solids and players.
// Bumpers are circular obstacles and were not considered by the original blocked() test.
function safeCardSpawn(g,pos){
 const margin=38; // 23px pickup radius + 15px visual / collision clearance
 if(!Number.isFinite(pos.x)||!Number.isFinite(pos.y))return false;
 if(pos.x<22+margin||pos.x>W-22-margin||pos.y<22+margin||pos.y>H-22-margin)return false;
 if(g.players.some(p=>Math.hypot(p.x-pos.x,p.y-pos.y)<Math.max(90,p.r+margin+20)))return false;
 // Circle-to-rectangle check: covers the entire raised 3D obstacle footprint.
 for(const b of g.map.blocks){
  const nx=clamp(pos.x,b.x,b.x+b.w),ny=clamp(pos.y,b.y,b.y+b.h);
  if(Math.hypot(pos.x-nx,pos.y-ny)<margin)return false;
 }
 for(const f of g.map.features){
  // In particular, never spawn inside a bumper or portal or in the visible ice decal.
  if(Math.hypot(pos.x-f.x,pos.y-f.y)<f.r+margin)return false;
 }
 return true;
}
function spawners(dt){const g=game;if(!g.rules.cards)return;if(!g.card){g.cardDelay-=dt;if(g.cardDelay<=0){const candidates=[{x:500,y:118},{x:500,y:440},{x:180,y:150},{x:825,y:410},{x:500,y:285},{x:720,y:105},{x:290,y:444}];
 // Prefer the original spawn slots; only use a deterministic fallback grid if all are unsafe.
 let spots=candidates.filter(p=>safeCardSpawn(g,p));
 if(!spots.length){
  for(let y=86;y<=H-86;y+=65)for(let x=85;x<=W-85;x+=72){
   const p={x,y};if(safeCardSpawn(g,p))spots.push(p);
  }
 }
if(spots.length){const pos=choose(spots);g.card={x:pos.x,y:pos.y,type:choose(Object.keys(CARDS)),t:0};ring(pos.x,pos.y,CARDS[g.card.type].color,65,.7)}else g.cardDelay=1}
 }else{g.card.t+=dt;for(const p of g.players){if(Math.hypot(p.x-g.card.x,p.y-g.card.y)<p.r+23){p.card=g.card.type;burst(g.card.x,g.card.y,CARDS[g.card.type].color,18,140);snd('card',.75);alertToast((p.id===0?'✦ KART ALDIN: ':'✦ RAKİP KART ALDI: ')+CARDS[p.card].name);g.card=null;g.cardDelay=4.8;break}}}}
function chaosStep(dt){
 const g=game;
 if(g.rules.chaos&&!g.chaosStarted&&g.fuse<g.initialFuse*.57){
  g.chaosStarted=true;g.chaos='turbo';g.chaosTimer=6.5;
  flashCallout(CHAOS.turbo.name,2.4);snd('win',.4);
 }
 if(g.chaosTimer>0){g.chaosTimer-=dt;if(g.chaosTimer<=0)g.chaos=null;}
}
function snowStep(dt){
 const g=game;if(g.map!==MAPS[1])return;
 g.snowDelay-=dt;
 if(g.snowDelay<=0){g.snowDelay=rand(3.6,4.8);const radius=rand(43,61);
  for(let tries=0;tries<24;tries++){
   const x=rand(85,W-85),y=rand(75,H-75);
   if(blocked(x,y,radius+5)||g.snowPatches.some(f=>Math.hypot(x-f.x,y-f.y)<f.r+radius+25))continue;
   const lifetime=rand(6.5,8.0);g.snowPatches.push({x,y,r:radius,t:lifetime,max:lifetime});break;
  }
 }
 for(const f of g.snowPatches)f.t-=dt;
 g.snowPatches=g.snowPatches.filter(f=>f.t>0).slice(-3);
}
function botDecisions(dt){if(options.mode!=='bot'||game.phase!=='active')return;const g=game,p=g.players[1],op=g.players[0],difficulty=options.difficulty;const factor=difficulty==='hard'?1:difficulty==='easy'?.26:.58;
 if(g.holder===1&&g.bomb.mode==='held'&&g.lock<=0){if(!p.charging&&dist(p,op)<(difficulty==='hard'?650:500)&&Math.random()<.04*factor*dt*60){beginCharge(1)}if(p.charging&&p.charge>rand(.30,.55)&&(dist(p,op)<(difficulty==='hard'?720:590)||g.fuse<4)){endCharge(1)}}
 else {p.charging=false;p.charge=0;if(g.bomb.mode==='flying'&&g.bomb.owner===0){const b=g.bomb,d=dist(p,b),heading=unit(p.x-b.x,p.y-b.y),incoming=(b.vx*heading.x+b.vy*heading.y)>180;if(d<(difficulty==='hard'?140:90)&&incoming&&Math.random()<.07*factor*dt*60){useParry(1)}}}
 if(p.dashCD<=0){const danger=g.holder===0&&dist(p,op)<170;const chase=g.holder===1&&dist(p,op)>440;if((danger||chase)&&Math.random()<.014*factor*dt*60)useDash(1)}
 if(p.card){if(p.card==='frost'&&dist(p,op)<300&&Math.random()<.06*factor*dt*60)useCard(1);else if(p.card==='shield'&&g.holder===0&&Math.random()<.05*factor*dt*60)useCard(1);else if(p.card==='blink'&&Math.random()<.011*factor*dt*60)useCard(1)}}
function showExplosionOutcome(){if(!game||game.phase!=='explode')return;const g=game,p=g.players[g.holder],winner=g.players[1-g.holder];showOverlay('TUR '+g.round+' / '+g.rules.rounds+' • BOOOM!','💥',winner.name+' KURTULDU!',p.name+' bomba elindeyken patladı. Skor '+g.score[0]+' – '+g.score[1]+'.',[])}
function explode(){const g=game;if(g.phase!=='active')return;g.phase='explode';g.phaseTime=2.35;g.explosionNoticeShown=false;g.roundLoser=g.holder;g.score[1-g.holder]++;const p=g.players[g.holder];burst(p.x,p.y,'#ff8a8d',85,420);burst(p.x,p.y,'#fff8a8',65,325);ring(p.x,p.y,'#ffec82',350,.8);ring(p.x,p.y,'#f883b9',550,.95);shakes=24;snd('boom');hideOverlay();}
function upgradeOptions(g){const owned=g.players[g.roundLoser].upgrades;const available=Object.keys(UPGRADES).filter(x=>!owned.includes(x));for(let i=available.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[available[i],available[j]]=[available[j],available[i]];}return available.slice(0,3);}
function showUpgradeChoice(){const g=game;if(!g||g.phase!=='upgrade')return;const self=options.mode==='online'?net.slot:0;const isHuman=(options.mode!=='bot'||g.upgradeChooser===0);if(self===g.upgradeChooser&&isHuman){showOverlay('BOMBA EVRİMİ • TUR '+g.round,'🧬','YENİ GÜCÜNÜ SEÇ!',`Kaybettiğin turdan sonra bir geliştirme kazanıyorsun. ${Math.ceil(g.upgradeTimer)} saniyen var.`,g.upgradeOffer.map(k=>({label:UPGRADES[k].emoji+' '+UPGRADES[k].name+' — '+UPGRADES[k].desc,action:()=>chooseUpgrade(k)})));}else{showOverlay('BOMBA EVRİMİ','⏳','RAKİP GÜÇ SEÇİYOR',g.players[g.upgradeChooser].name+' üç geliştirmeden birini seçiyor…',[]);}}
function chooseUpgrade(id){const g=game;if(!g||g.phase!=='upgrade'||!g.upgradeOffer.includes(id))return;const chooser=g.upgradeChooser;if(options.mode==='online'&&net.role==='guest'){if(net.slot===chooser)netSend({type:'upgrade',choice:id});return;}if(options.mode==='online'&&net.role==='host'&&chooser!==0)return;applyUpgrade(id);}
function applyUpgrade(id){const g=game;if(!g||g.phase!=='upgrade'||!g.upgradeOffer.includes(id))return;const p=g.players[g.upgradeChooser];if(!p.upgrades.includes(id))p.upgrades.push(id);flashCallout(UPGRADES[id].emoji+' '+p.name+': '+UPGRADES[id].name,2.5);startRound();snd('ready');}
function nextAfterExplosion(){if(!game||game.phase!=='explode')return;const g=game;if(g.round>=g.rules.rounds){finishMatch();return}if(g.rules.upgrades&&g.rules.upgradePersistence==='round'){g.players.forEach(p=>{p.upgrades=[];});}if(g.rules.upgrades){const offer=upgradeOptions(g);if(offer.length){g.phase='upgrade';g.upgradeChooser=g.roundLoser;g.upgradeOffer=offer;g.upgradeTimer=14;showUpgradeChoice();return;}}startRound();snd('ready')}

function finishMatch(){const g=game;g.phase='finished';const winner=g.score[0]>g.score[1]?0:1;const humanWon=winner===0;const title=options.mode==='bot'?(humanWon?'ŞAMPİYON SENSİN!':'BOT BU SEFER KAZANDI!'):(g.players[winner].name+' KAZANDI!');showOverlay('MAÇ BİTTİ • '+g.score[0]+'–'+g.score[1],humanWon?'🏆':'🎖️',title,g.rules.rounds+' turda '+g.stats.throws[0]+' atış, '+g.stats.hits[0]+' isabet ve '+g.stats.parries[0]+' başarılı savunma yaptın. Bir rövanş daha?', [{label:'↻ RÖVANŞ!',action:()=>{if(options.mode==='online'){netSend({type:'rematch'});showOverlay('RÖVANŞ','⏳','YENİ MAÇ HAZIRLANIYOR','İki oyuncu da aynı anda yeni maça alınacak.',[]);}else{newGame();game.phase='countdown';hideOverlay();}}},{label:'ANA MENÜ',secondary:true,action:returnMenu}]);snd('win');for(let i=0;i<110;i++)burst(rand(100,900),rand(10,100),choose(['#ff79bd','#d8ff52','#a98bff','#fff7a0']),1,rand(40,190))}
function tick(dt){if(SHOOTER_MODE){tickShooter(dt);return;}globalTime+=dt;for(const pt of particles){pt.x+=pt.vx*dt;pt.y+=pt.vy*dt;pt.vy+=150*dt;pt.t-=dt}particles=particles.filter(p=>p.t>0);for(const r of rings){r.t-=dt;r.r=lerp(r.max,0,r.t/r.life)}rings=rings.filter(r=>r.t>0);if(shakes>0)shakes=Math.max(0,shakes-35*dt);if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show')}if(calloutTimer>0){calloutTimer-=dt;if(calloutTimer<=0)$('eventCallout').classList.add('hidden')}
 if(!game)return;const g=game;
 if(g.phase==='countdown'){g.phaseTime-=dt;if(g.phaseTime<=0){g.phase='active';g.phaseTime=0;alertToast('🔥 BAŞLADI!',.8);snd('ready')}else if(Math.floor(g.phaseTime+.1)!==Math.floor(g.phaseTime+dt+.1))snd('beep',.6);return}
 if(g.phase==='explode'){g.phaseTime-=dt;if(!g.explosionNoticeShown&&g.phaseTime<=1.30){g.explosionNoticeShown=true;showExplosionOutcome();}if(g.phaseTime<=0)nextAfterExplosion();return}
 if(g.phase==='upgrade'){g.upgradeTimer-=dt;if(g.upgradeTimer<=0){applyUpgrade(g.upgradeOffer[0]);}else if((options.mode==='bot'||options.mode==='local')&&g.upgradeChooser===1&&g.upgradeTimer<12){applyUpgrade(choose(g.upgradeOffer));}return}
 if(g.phase!=='active')return;
 g.fuse=Math.max(0,g.fuse-dt);g.elapsed+=dt;g.lock=Math.max(0,g.lock-dt);
 if(Math.floor(g.fuse)!==Math.floor(g.fuse+dt)&&g.fuse<=6)snd('beep',g.fuse<3?1.35:.8);
 chaosStep(dt);snowStep(dt);botDecisions(dt);
 // Smaller physics steps are essential for reliable projectile collision at high charge.
 const steps=Math.ceil(dt/.008),part=dt/steps;for(let i=0;i<steps;i++){g.players.forEach(p=>updatePlayer(p,part));adjustPlayerOverlap();updateBomb(part)}spawners(dt);
 if(g.fuse<=0)explode();}
// Canvas drawing helpers.
function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
function text(s,x,y,size=14,color='#fff',weight=800,align='center'){ctx.font=weight+' '+size+'px Arial,sans-serif';ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(s,x,y)}
function drawGrid(){const g=game,map=g.map;ctx.fillStyle=map.floor;ctx.fillRect(0,0,W,H);const grad=ctx.createRadialGradient(500,281,20,500,281,540);grad.addColorStop(0,map.glow+'1f');grad.addColorStop(1,'#080814');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
 ctx.save();ctx.strokeStyle='#ffffff0c';ctx.lineWidth=1;let off=(globalTime*4)%40;for(let x=-40+off;x<W+40;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=-40+off;y<H+40;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}ctx.restore();
 rounded(22,22,W-44,H-44,14,'#080a1419',map.glow+'70');ctx.lineWidth=4;ctx.strokeStyle=map.glow+'48';ctx.strokeRect(23,23,8,40);ctx.strokeRect(W-31,H-63,8,40);
 ctx.save();ctx.strokeStyle='#ffffff10';ctx.lineWidth=2;ctx.setLineDash([8,15]);ctx.beginPath();ctx.arc(500,281,176,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(500,22);ctx.lineTo(500,H-22);ctx.stroke();ctx.restore();
 // Running neon boundary
 ctx.save();ctx.strokeStyle=map.glow+'33';ctx.lineWidth=4;ctx.shadowBlur=24;ctx.shadowColor=map.glow;ctx.strokeRect(22,22,W-44,H-44);ctx.restore()}
function drawFeatures(){const g=game;
 if(g.snowPatches)for(const f of g.snowPatches){
  const alpha=clamp(f.t/.75,0,1)*clamp((f.max-f.t)/.55,0,1);
  ctx.save();ctx.globalAlpha=alpha;const r=f.r;
  const grad=ctx.createRadialGradient(f.x,f.y,4,f.x,f.y,r);
  grad.addColorStop(0,'#e8faffc9');grad.addColorStop(.6,'#b9efffb5');grad.addColorStop(1,'#a5e5ff06');
  ctx.fillStyle=grad;ctx.beginPath();ctx.arc(f.x,f.y,r,0,TAU);ctx.fill();
  ctx.strokeStyle='#edffffa0';ctx.lineWidth=2;ctx.setLineDash([4,9]);ctx.beginPath();ctx.arc(f.x,f.y,r*.86,0,TAU);ctx.stroke();ctx.setLineDash([]);
  for(let i=0;i<7;i++){const ang=i*2.399;const radius=r*(.18+(i%3)*.23);text('✳',f.x+Math.cos(ang)*radius,f.y+Math.sin(ang)*radius,10,'#fff',800)}
  ctx.restore();
 }
 for(const f of g.map.features){if(f.kind==='ice'){const rad=ctx.createRadialGradient(f.x,f.y,10,f.x,f.y,f.r);rad.addColorStop(0,'#82e7ff3a');rad.addColorStop(1,'#82e7ff04');ctx.fillStyle=rad;ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,TAU);ctx.fill();ctx.strokeStyle='#79eaff65';ctx.lineWidth=2;ctx.setLineDash([8,11]);ctx.stroke();ctx.setLineDash([]);text('❄',f.x,f.y,37,'#75e8ff')}else if(f.kind==='portal'){const spin=globalTime*.9*(f.to===0?1:-1);ctx.save();ctx.translate(f.x,f.y);ctx.rotate(spin);ctx.shadowBlur=24;ctx.shadowColor='#b199ff';ctx.strokeStyle='#b199ff';ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,0,f.r,-.3,2.3);ctx.stroke();ctx.strokeStyle='#ff84d1';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,f.r-13,-2.1,.4);ctx.stroke();ctx.restore();text('🌀',f.x,f.y,28)}else if(f.kind==='bumper'){ctx.save();ctx.translate(f.x,f.y);ctx.shadowBlur=22;ctx.shadowColor='#ffd671';ctx.beginPath();ctx.arc(0,0,f.r+3,0,TAU);ctx.fillStyle='#8a5c35';ctx.fill();ctx.strokeStyle='#ffd477';ctx.lineWidth=4;ctx.stroke();ctx.restore();text('✷',f.x,f.y,37,'#ffec8f')}}
 for(const b of g.map.blocks){ctx.shadowColor='#04040b';ctx.shadowBlur=15;rounded(b.x+5,b.y+7,b.w,b.h,8,'#070713',null);ctx.shadowBlur=0;rounded(b.x,b.y,b.w,b.h,7,'#51426f','#a38ac4');rounded(b.x+6,b.y+6,b.w-12,b.h-12,4,'#3a3056','#6e5b8d');ctx.fillStyle=g.map.glow+'78';ctx.fillRect(b.x+11,b.y+12,b.w-22,3);ctx.fillStyle='#ffffff10';ctx.fillRect(b.x+8,b.y+b.h-13,b.w-16,3)}
}
function drawCard(){if(!game.card)return;const p=game.card,c=CARDS[p.type];const y=p.y+Math.sin(globalTime*5)*7;ctx.save();ctx.translate(p.x,y);ctx.shadowBlur=28;ctx.shadowColor=c.color;ctx.fillStyle=c.color+'3c';ctx.strokeStyle=c.color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,30,0,TAU);ctx.fill();ctx.stroke();ctx.restore();text(c.emoji,p.x,y,29);text('✦ BONUS',p.x,y+44,10,c.color,900)}
function drawPlayer(p){const t=globalTime,carrying=game.holder===p.id;const glow=carrying?'#ffd27e':p.color;ctx.save();ctx.translate(p.x,p.y);let shadow=ctx.createRadialGradient(0,0,6,0,0,62);shadow.addColorStop(0,glow+'52');shadow.addColorStop(1,glow+'00');ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(0,0,62,0,TAU);ctx.fill();ctx.fillStyle='#0608159c';ctx.beginPath();ctx.ellipse(0,23,25,10,0,0,TAU);ctx.fill();
 if(carrying){ctx.strokeStyle='#ffcb67';ctx.lineWidth=3;ctx.globalAlpha=.58+Math.sin(t*12)*.23;ctx.beginPath();ctx.arc(0,0,31+Math.sin(t*8)*3,0,TAU);ctx.stroke();ctx.globalAlpha=1}
 if(p.shieldTime>0||p.parryTime>0){ctx.strokeStyle=p.parryTime>0?'#78eeff':'#ebff9a';ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=20;ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,36+Math.sin(t*18)*2,0,TAU);ctx.stroke()}
 if(p.stun>0)text('❄',0,-61,26,'#8beaff');
 if(p.dashTime>0){ctx.save();ctx.globalAlpha=.45;for(let i=1;i<=3;i++){ctx.beginPath();ctx.arc(-p.face.x*i*17,-p.face.y*i*17,21-i*2,0,TAU);ctx.fillStyle=p.color;ctx.fill()}ctx.restore()}
 ctx.shadowColor=p.color;ctx.shadowBlur=20;ctx.fillStyle=p.id===0?'#c9ff65':'#ff93cf';ctx.strokeStyle='#111324';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,23,0,TAU);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#1d182e';ctx.beginPath();ctx.arc(p.face.x*6-7,p.face.y*4-3,3.5,0,TAU);ctx.arc(p.face.x*6+7,p.face.y*4-3,3.5,0,TAU);ctx.fill();ctx.strokeStyle='#32223e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,6,5,0,Math.PI);ctx.stroke();
 // Names remain in the score HUD only, including when 2D fallback is active.
 if(p.charging&&carrying&&game.bomb.mode==='held'){const amount=clamp(p.charge/.85,0,1);ctx.lineWidth=5;ctx.strokeStyle='#ffffff48';ctx.beginPath();ctx.arc(0,0,39,-Math.PI/2,1.5*Math.PI);ctx.stroke();ctx.strokeStyle=amount>.85?'#ff83c9':'#ddff67';ctx.beginPath();ctx.arc(0,0,39,-Math.PI/2,-Math.PI/2+TAU*amount);ctx.stroke()}
 ctx.restore()}
function drawBomb(){const g=game,b=g.bomb;if(b.mode!=='held'){for(let i=0;i<b.trail.length;i++){const tr=b.trail[i];ctx.globalAlpha=clamp(tr.t/.32,0,1)*.55;ctx.fillStyle='#ffe385';ctx.beginPath();ctx.arc(tr.x,tr.y,4+i/Math.max(1,b.trail.length)*9,0,TAU);ctx.fill()}ctx.globalAlpha=1}
 ctx.save();ctx.translate(b.x,b.y);const scale=b.mode==='held'?.83:1.1;ctx.scale(scale,scale);ctx.shadowColor='#ffcc72';ctx.shadowBlur=27;ctx.fillStyle='#10151e';ctx.lineWidth=4;ctx.strokeStyle='#ffcc72';ctx.beginPath();ctx.arc(0,2,15,0,TAU);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#f8ecc4';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(5,-12);ctx.quadraticCurveTo(14,-23,9,-27);ctx.stroke();ctx.fillStyle='#ffdc74';ctx.beginPath();ctx.arc(10+Math.sin(globalTime*20)*3,-29,4.5+Math.sin(globalTime*13)*1.5,0,TAU);ctx.fill();ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(-6,-4,4,0,TAU);ctx.fill();ctx.restore();if(b.mode==='flying'){ctx.save();ctx.strokeStyle='#ffdf977a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x-b.vx*.046,b.y-b.vy*.046);ctx.lineTo(b.x-b.vx*.014,b.y-b.vy*.014);ctx.stroke();ctx.restore()}}
function drawChargeGuide(){const g=game;if(g.phase!=='active'||g.bomb.mode!=='held')return;const p=g.players[g.holder];if(!p.charging||p.id===1&&options.mode==='bot')return;const v=p.aim||p.face,charge=clamp(p.charge/.85,0,1),length=lerp(80,260,charge);ctx.save();ctx.strokeStyle=charge>.8?'#ff95d6a6':'#d8ff52a6';ctx.lineWidth=3;ctx.setLineDash([9,8]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+v.x*length,p.y+v.y*length);ctx.stroke();ctx.setLineDash([]);ctx.translate(p.x+v.x*length,p.y+v.y*length);ctx.rotate(Math.atan2(v.y,v.x));ctx.beginPath();ctx.moveTo(-9,-8);ctx.lineTo(0,0);ctx.lineTo(-9,8);ctx.stroke();ctx.restore()}
function drawVFX(){for(const e of rings){ctx.save();ctx.globalAlpha=e.t/e.life;ctx.strokeStyle=e.color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,TAU);ctx.stroke();ctx.restore()}for(const p of particles){ctx.save();ctx.globalAlpha=clamp(p.t/p.max,0,1);ctx.fillStyle=p.col;ctx.translate(p.x,p.y);ctx.rotate((p.x+p.y)*.04);ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);ctx.restore()}}
function drawArena(){
 if(SHOOTER_MODE){drawShooterArena();return;}
 if(arena3d){
  try{
   arena3d.draw(game,globalTime,particles,rings,shakes);
   ctx.clearRect(0,0,W,H);
   ctx.save();
   if(game.phase==='countdown'){
    ctx.fillStyle='#080a1da8';ctx.fillRect(0,0,W,H);
    text('DÜELLO BAŞLIYOR',500,178,18,'#d8ff52',900);
    text(String(Math.max(1,Math.ceil(game.phaseTime))),500,274,102,'#ffffff',1000);
    text('BOMBAYI ŞARJ ET • FIRLAT • KURTUL',500,371,16,'#c0b5d7',800);
   }
   if(game.phase==='active'&&game.fuse<3){ctx.fillStyle='#ff487d';ctx.globalAlpha=(3-game.fuse)/3*.18*(.4+.6*Math.sin(globalTime*14)**2);ctx.fillRect(0,0,W,H);}
   ctx.restore();return;
  }catch(error){console.error('3D rendering failed; restoring 2D rendering.',error);arena3d.dispose();arena3d=null;}
 }
 ctx.save();if(shakes>0&&options.mode!=='online')ctx.translate(rand(-shakes,shakes),rand(-shakes,shakes));drawGrid();drawFeatures();drawCard();drawChargeGuide();game.players.forEach(drawPlayer);drawBomb();drawVFX();if(game.phase==='countdown'){ctx.fillStyle='#080a1db6';ctx.fillRect(0,0,W,H);text('DÜELLO BAŞLIYOR',500,192,17,'#d8ff52',900);text(String(Math.max(1,Math.ceil(game.phaseTime))),500,279,105,'#ffffff',1000);text('BOMBAYI ŞARJ ET • FIRLAT • KURTUL',500,364,16,'#c0b5d7',800)}if(game.phase==='active'&&game.fuse<3){ctx.save();ctx.globalAlpha=(3-game.fuse)/3*.23*(.4+.6*Math.sin(globalTime*14)**2);ctx.fillStyle='#ff487d';ctx.fillRect(0,0,W,H);ctx.restore()}ctx.restore()}
function updateHUD(){if(SHOOTER_MODE){updateShooterHUD();return;}if(!game)return;const g=game,self=options.mode==='online'&&net.slot===1?1:0,p=g.players[self],b=g.bomb;for(let i=0;i<2;i++){$('score'+i).textContent=g.score[i];$('player'+i+'Status').textContent=(g.holder===i?'💣 SICAK PATATES!':g.players[i].stun>0?'❄️ DONDU':'HAZIR')+(g.players[i].upgrades.length?' • 🧬'+g.players[i].upgrades.length:'');$('scoreBox'+i).style.boxShadow=g.holder===i?'inset 0 0 34px #ffd36c20':'none'}
 $('roundLabel').textContent='TUR '+g.round+' / '+g.rules.rounds;$('timerDigits').textContent=g.fuse.toFixed(1);$('timerFill').style.width=clamp(g.fuse/g.initialFuse*100,0,100)+'%';$('timerIcon').textContent=g.fuse<5?'🔥':'💣';$('fuseSpark').style.left='calc('+clamp(g.fuse/g.initialFuse*100,0,100)+'% - 1px)';document.querySelector('.fuse-container').classList.toggle('danger',g.fuse<5);
 const hold=g.holder===self;const status=$('bombStatus');status.textContent=hold?'🔫 KAOS ARENA!':b.mode==='flying'?'🚀 BOMBA HAVADA!':'✓ BOMBA RAKİPTE';status.style.color=hold?'#ffcc72':'#d8ff52';$('tipText').textContent=hold?'Atış tuşuna basılı tut, bırakınca bombayı fırlat.':'Atıl ve savun; bombayı havada geri gönderebilirsin.';
 $('throwMeter').style.width=(hold?clamp(p.charge/.85*100,0,100):0)+'%';$('dashMeter').style.width=clamp((1-p.dashCD/3.15)*100,0,100)+'%';$('parryMeter').style.width=clamp((1-p.parryCD/3.5)*100,0,100)+'%';$('cardName').textContent=p.card?CARDS[p.card].name:'KART YOK';$('cardMeter').style.width=p.card?'100%':'0%';}
function frame(time){if(document.hidden){animLast=time;requestAnimationFrame(frame);return;}const dt=Math.min(.034,Math.max(0,(time-animLast)/1000||.016));animLast=time;
 if(options.mode==='online'&&net.role==='guest'){
  globalTime+=dt;
  if(game&&net.connected&&time-net.lastInput>30){sendGuestInput();net.lastInput=time;}
 }else{
  tick(dt);
  if(options.mode==='online'&&net.role==='host'&&net.connected&&game&&time-net.lastState>32){
   netSend({type:'state',seq:++net.seq,matchId:net.matchId,state:game});net.lastState=time;
  }
 }
 if(game){
  if(options.mode==='online'&&net.role==='guest'&&net.snapshots.length){
   const view=remotePresentation(time),positions=game.players.map(p=>({x:p.x,y:p.y})),bombPos={x:game.bomb.x,y:game.bomb.y};
   if(view){game.players.forEach((p,i)=>{p.x=view.players[i].x;p.y=view.players[i].y});game.bomb.x=view.bomb.x;game.bomb.y=view.bomb.y;}
   drawArena();
   game.players.forEach((p,i)=>{p.x=positions[i].x;p.y=positions[i].y});game.bomb.x=bombPos.x;game.bomb.y=bombPos.y;
  }else drawArena();
  if(time-lastHud>65){updateHUD();lastHud=time}
 }
 requestAnimationFrame(frame)
}
function isTyping(el){return el&&['INPUT','TEXTAREA','SELECT'].includes(el.tagName)}
function pressControl(code,down){if(isGameChatActive()||!game||game.phase==='finished'||game.phase==='paused'||game.phase==='help')return;
 if(SHOOTER_MODE){pressShooterControl(code,down);return;}
 if(options.mode==='online'){
   const acts={Space:'dash',KeyE:'parry',KeyQ:'card'};
   const action=acts[code];if(!action)return;
   if(net.role==='guest'){if(action==='charge')netSend({type:'act',action:down?'charge_on':'charge_off'});else if(down)netSend({type:'act',action});}
   else if(net.role==='host'){if(action==='charge'){if(down)beginCharge(0);else endCharge(0);}else if(down){if(action==='dash')useDash(0);if(action==='parry')useParry(0);if(action==='card')useCard(0);}}
   return;
 }
 const m=options.mode;
 let id=null,action=null;if(m==='bot'){const actions={Space:'dash',KeyE:'parry',KeyQ:'card'};if(actions[code]){id=0;action=actions[code]}}
 else {const actions0={KeyF:'throw',KeyG:'dash',KeyH:'parry',KeyR:'card'},actions1={KeyL:'throw',KeyK:'dash',KeyJ:'parry',KeyI:'card'};if(actions0[code]){id=0;action=actions0[code]}else if(actions1[code]){id=1;action=actions1[code]}}
 if(id===null)return;if(action==='throw'){if(down)beginCharge(id);else endCharge(id)}else if(down){if(action==='dash')useDash(id);else if(action==='parry')useParry(id);else if(action==='card')useCard(id)}}
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&options.mode==='online'&&game){e.preventDefault();if(e.repeat)return;if(isGameChatActive()){sendChat($('gameChatInput'));closeGameChat();}else if(!isTyping(e.target)){openGameChat();}return;}if(e.code==='Escape'&&isGameChatActive()){e.preventDefault();closeGameChat();return;}if(e.code==='Escape'&&!$('infoDialog').classList.contains('hidden')){e.preventDefault();closeHelp();return;}if(!$('infoDialog').classList.contains('hidden'))return;if(isTyping(e.target))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)&&game)e.preventDefault();if(e.code==='Escape'||e.code==='KeyP'){if(game&&game.phase==='help'){game.phase=game.pausedFrom;hideOverlay()}else pauseGame();return}if(!keys[e.code])pressControl(e.code,true);keys[e.code]=true});document.addEventListener('keyup',e=>{if(isTyping(e.target))return;keys[e.code]=false;pressControl(e.code,false)});window.addEventListener('blur',()=>{if(game&&game.phase==='active'&&options.mode!=='online')pauseGame();if(options.mode==='online'&&net.role==='guest')netSend({type:'act',action:'charge_off'});if(options.mode==='online'&&net.role==='host')pauseHostWhenAway();if(SHOOTER_MODE&&game?.players?.[0])game.players[0].shooting=false;mouseThrowHeld=false;keys=Object.create(null);touch.throwDown=false});
canvas.addEventListener('pointermove',e=>{const point=arena3d?.pointer(e);if(point){mouse.x=point.x;mouse.y=point.y;}else{const r=canvas.getBoundingClientRect(),ratioX=W/r.width,ratioY=H/r.height;mouse.x=(e.clientX-r.left)*ratioX;mouse.y=(e.clientY-r.top)*ratioY;}if(e.pointerType==='mouse')mouse.active=true});
let mouseThrowHeld=false;canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||!game||game.phase!=='active'||options.mode==='local'||isGameChatActive())return;mouse.active=true;const point=arena3d?.pointer(e);if(point){mouse.x=point.x;mouse.y=point.y;}mouseThrowHeld=true;e.preventDefault();if(options.mode==='online'&&net.role==='guest')netSend({type:'act',action:'charge_on'});else beginCharge(0)});window.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse'||e.button!==0||!mouseThrowHeld)return;mouseThrowHeld=false;if(!game||game.phase!=='active'||options.mode==='local')return;if(isGameChatActive())return;if(options.mode==='online'&&net.role==='guest')netSend({type:'act',action:'charge_off'});else endCharge(0)});
function bindTouch(){const joy=$('joystick'),stick=$('joystickStick');function joyMove(e){const r=joy.getBoundingClientRect(),c={x:r.left+r.width/2,y:r.top+r.height/2},dx=e.clientX-c.x,dy=e.clientY-c.y,n=Math.max(1,Math.hypot(dx,dy)),scale=Math.min(1,n/43);touch.dx=dx/n*scale;touch.dy=dy/n*scale;stick.style.transform=`translate(${touch.dx*30}px,${touch.dy*30}px)`}
 joy.addEventListener('pointerdown',e=>{e.preventDefault();touch.joystickId=e.pointerId;joy.setPointerCapture(e.pointerId);joyMove(e)});joy.addEventListener('pointermove',e=>{if(e.pointerId===touch.joystickId){e.preventDefault();joyMove(e)}});const release=e=>{if(e.pointerId===touch.joystickId){touch.joystickId=null;touch.dx=touch.dy=0;stick.style.transform='translate(0,0)'}};joy.addEventListener('pointerup',release);joy.addEventListener('pointercancel',release);
 for(const [id,down,up] of [['touchThrow',()=>touchAct('charge_on'),()=>touchAct('charge_off')],['touchDash',()=>touchAct('dash')],['touchParry',()=>touchAct('parry')],['touchSkill',()=>touchAct('card')]]){const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);down()});if(up){el.addEventListener('pointerup',e=>{e.preventDefault();up()});el.addEventListener('pointercancel',up)}}
}

// ONLINE NETWORK • host simulates the V2 arena; server validates room membership and forwards inputs.
function netSend(data){if(net.ws?.readyState===WebSocket.OPEN)try{net.ws.send(JSON.stringify(data));}catch{}}
function roomMessage(str,error=false){const el=$('roomMessage');el.textContent=str;el.classList.toggle('error',error);}
function canOnline(){if(location.protocol!=='http:'&&location.protocol!=='https:'){roomMessage('Online oda için oyunu yayımlanmış site adresinden açmalısın. Bilgisayarda bot modu çalışır.',true);return false;}return true;}
function appendChatItem(item){
 if(!item||typeof item.text!=='string')return;
 net.chatHistory.push(item);if(net.chatHistory.length>40)net.chatHistory.shift();
 renderChat();showChatTemporarily();
}
function renderChat(){
 const lobby=$('lobbyChatMessages');lobby.replaceChildren();
 if(!net.chatHistory.length){const empty=document.createElement('p');empty.className='chat-empty';empty.textContent='Henüz mesaj yok. İlk mesajı sen gönder!';lobby.append(empty);}
 for(const msg of net.chatHistory){
  const row=document.createElement('div');row.className='chat-line'+(msg.slot===net.slot?' from-self':' from-other');
  const meta=document.createElement('div');meta.className='chat-meta';const by=document.createElement('b');by.textContent=msg.slot===net.slot?'Sen':'O';
  const time=document.createElement('time');const date=new Date(Number(msg.at)||Date.now());time.textContent=Number.isNaN(date.getTime())?'':date.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
  const line=document.createElement('span');line.textContent=msg.text;
  meta.append(by,time);row.append(meta,line);lobby.append(row);
 }
 lobby.scrollTop=lobby.scrollHeight;
 const feed=$('gameChatMessages');feed.replaceChildren();
 // Show only the last five messages, with no large floating chat window.
 for(const msg of net.chatHistory.slice(-5)){
  const row=document.createElement('div');row.className='arena-chat-line'+(msg.slot===net.slot?' from-self':' from-other');
  const name=document.createElement('strong');name.textContent=(msg.slot===net.slot?'Sen':'O')+':';
  const value=document.createElement('span');value.textContent=' '+msg.text;
  row.append(name,value);feed.append(row);
 }
}
function sendChat(input){const msg=input.value.trim();if(!msg||!net.connected||!net.code)return;netSend({type:'chat',text:msg.slice(0,180)});input.value='';}
function isGameChatActive(){return !$('gameChatForm').classList.contains('hidden');}
function closeGameChat(){
 $('gameChatForm').classList.add('hidden');$('chatToggle').setAttribute('aria-expanded','false');
 showChatTemporarily();
 if(document.activeElement===$('gameChatInput'))$('gameChatInput').blur();keys=Object.create(null);
}
function openGameChat(){
 if(options.mode!=='online'||!game)return;
 keys=Object.create(null);touch.dx=touch.dy=0;mouseThrowHeld=false;
 if(net.role==='guest'){netSend({type:'input',x:0,y:0,aimX:0,aimY:0,aimActive:false});netSend({type:'act',action:'charge_off'});}
 else if(net.role==='host'&&game.players[0]){game.players[0].charging=false;game.players[0].charge=0;}
 $('gameChatForm').classList.remove('hidden');$('chatToggle').setAttribute('aria-expanded','true');showChatTemporarily();$('gameChatInput').focus();
}
function toggleGameChat(){if(isGameChatActive())closeGameChat();else openGameChat();}
function pauseMessage(reason){showOverlay('⏸️ MAÇ DURAKLATILDI','⏸️','OYUN BEKLEMEDE',reason,[{label:'ANA MENÜ',secondary:true,action:returnMenu}]);}
function pauseHostWhenAway(){
 if(!game||options.mode!=='online'||net.role!=='host'||net.focusPaused||['finished','ready'].includes(game.phase))return;
 net.focusPaused=true;
 if(!net.freeze&&game.phase!=='paused'){net.prevPhase=game.phase;game.phase='paused';}
 netSend({type:'host_pause',paused:true});
 pauseMessage('Oda kurucusu pencereyi değiştirdi. Geri döndüğünde maç devam edecek.');
}
function resumeHostWhenBack(){
 if(!net.focusPaused)return;net.focusPaused=false;
 netSend({type:'host_pause',paused:false});
 if(!net.freeze&&game&&game.phase==='paused'){game.phase=net.prevPhase||'countdown';hideOverlay();}
}
function applyHostAwayPause(paused,reason){
 if(net.role!=='guest'||!game)return;
 net.hostAway=paused;
 if(paused){game.phase='paused';pauseMessage(reason||'Oda kurucusu şu anda oyunda değil. Kaldığınız yerden devam etmek için onu bekleyin.');}
 else {hideOverlay();}
}
function joinFromInput(){if(!canOnline())return;const code=$('joinCode').value.toUpperCase().replace(/[^A-Z2-9]/g,'');if(code.length!==6){roomMessage('Lütfen 6 karakterli oda kodunu gir.',true);return;}options.nickname=$('nick').value.trim().slice(0,14)||'KAOS KRALI';try{localStorage.setItem('bomba-nickname',options.nickname)}catch{}connectRoom({type:'join',name:options.nickname,code,token:sessionStorage.getItem('bomba-room-'+code)||undefined});}
function connectRoom(request){
 if(net.retry){clearTimeout(net.retry);net.retry=null;}
 net.closing=false; if(net.ws){net.ws.onclose=null;net.ws.close();}
 net.connected=false;roomMessage('Sunucuya bağlanılıyor…');
 const uri=(location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/ws';
 let socket;try{socket=new WebSocket(uri);}catch{roomMessage('Bağlantı kurulamadı. Site adresini kontrol et.',true);return;}
 net.ws=socket;
 socket.onopen=()=>{if(net.ws!==socket)return;net.connected=true;netSend(request)};
 socket.onmessage=e=>{if(net.ws!==socket)return;let d;try{d=JSON.parse(e.data);}catch{return;}onNetMessage(d)};
 socket.onerror=()=>{if(net.ws!==socket)return;roomMessage('WebSocket bağlantısı kurulamadı.',true)};
 socket.onclose=()=>{if(net.ws!==socket)return;net.connected=false;if(net.closing)return;
   roomMessage('Bağlantı koptu; yeniden bağlanılıyor…',true);
   if(game&&options.mode==='online'){showOverlay('BAĞLANTI','📡','BAĞLANTI KOPTU','Sunucuya tekrar bağlanmayı deniyoruz…',[]);}
   if(net.code){net.retry=setTimeout(()=>connectRoom({type:'join',code:net.code,token:net.token,name:options.nickname}),2000);}else{roomMessage('Sunucuya erişilemedi. Yeniden denemek için oda kur/katıl düğmesine bas.',true);}
 };
}
function leaveOnline(){resetChatVisibility();net.closing=true;if(net.retry){clearTimeout(net.retry);net.retry=null;}netSend({type:'leave'});if(net.ws){net.ws.onclose=null;net.ws.close();net.ws=null;}if(net.code)try{sessionStorage.removeItem('bomba-room-'+net.code)}catch{}net.role=null;net.slot=null;net.code=null;net.token=null;net.players=[];net.connected=false;net.freeze=false;net.focusPaused=false;net.hostAway=false;net.snapshots=[];net.seq=0;net.remote={x:0,y:0,aimX:0,aimY:0,aimActive:false};net.remotes={};net.hostAway=false;net.focusPaused=false;net.matchId=0;net.chatUnread=0;net.chatHistory=[];renderChat();$('gameChatPanel').classList.add('hidden');$('chatUnread').classList.add('hidden');closeGameChat();$('roomReady').classList.add('hidden');history.replaceState(null,'',location.pathname);renderRules();}
function updateRoomPanel(){
 if(!net.code)return;
 $('roomReady').classList.remove('hidden');$('roomCode').textContent=net.code;
 $('roomLink').value=location.origin+location.pathname+'?room='+net.code;
 $('roomPlayers').replaceChildren();renderRules();for(let i=0;i<requiredPlayers();i++){
  const info=net.players[i],line=document.createElement('div');const name=document.createElement('b');name.textContent=(i===0?'🟢 ':'🩷 ')+(info?.name||'Oyuncu bekleniyor');const state=document.createElement('span');state.textContent=info?.online?'HAZIR':'BEKLENİYOR';state.className=info?.online?'ready':'waiting';line.append(name,state);$('roomPlayers').append(line);
 }
 $('hostStart').classList.toggle('hidden',net.role!=='host');
 $('hostStart').disabled=!(net.players.length===requiredPlayers()&&net.players.every(p=>p.online));
 $('hostStart').textContent=$('hostStart').disabled?'OYUNCULAR BEKLENİYOR ('+net.players.filter(p=>p.online).length+'/'+requiredPlayers()+')':'🔫 MAÇI BAŞLAT →';
 roomMessage(net.role==='host'?'Arkadaşın katılınca maçı başlat.':'Odadasın! Maçı kuran oyuncu başlatacak.');
}
function onNetMessage(d){
 if(d.type==='error'){roomMessage(d.message||'Oda hatası.',true);return;}
 if(d.type==='joined'){
  net.code=d.code;net.slot=d.slot;net.role=d.slot===0?'host':'guest';net.token=d.token;net.players=d.players||[];net.connected=true;net.chatHistory=Array.isArray(d.chatHistory)?d.chatHistory.slice(-40):[];net.chatUnread=0;net.matchId=Number.isInteger(d.matchId)?d.matchId:0;$('chatUnread').classList.add('hidden');renderChat();showChatTemporarily();options.rules=safeRules(d.rules);renderRules();
  try{sessionStorage.setItem('bomba-room-'+net.code,net.token)}catch{}
  history.replaceState(null,'',location.pathname+'?room='+net.code);updateRoomPanel();
  if(d.reconnected&&game){hideOverlay();if(net.role==='host'&&!document.hidden)netSend({type:'host_pause',paused:false});}
  return;
 }
 if(d.type==='chat'){appendChatItem(d);return;}
 if(d.type==='host_pause'){
  if(net.role==='guest')applyHostAwayPause(!!d.paused,d.reason);
  return;
 }
 if(d.type==='presence'){net.players=d.players||[];if(d.rules){options.rules=safeRules(d.rules);renderRules();}updateRoomPanel();
  if(net.role==='guest'&&game){const away=net.players[0]?.online===false||!!d.hostPaused;if(away&&!net.hostAway)applyHostAwayPause(true,net.players[0]?.online===false?'Oda kurucusunun bağlantısı koptu. Oyun durdu; geri bağlanması bekleniyor.':'Oda kurucusu başka pencereye geçti. Oyun duraklatıldı.');else if(!away&&net.hostAway)applyHostAwayPause(false);}

  if(net.role==='host'&&game){const guestOnline=net.players.length===requiredPlayers()&&net.players.slice(1).every(p=>p?.online);
   if(!guestOnline&&!net.freeze){net.freeze=true;if(game.phase!=='paused')net.prevPhase=game.phase;game.phase='paused';net.remote.x=0;net.remote.y=0;pauseMessage('Rakibin bağlantısı koptu. Yeniden bağlandığında maç devam edecek.');}
   else if(guestOnline&&net.freeze){net.freeze=false;if(!net.focusPaused){game.phase=net.prevPhase||'countdown';hideOverlay();}else pauseMessage('Oda kurucusu oyun penceresine dönene kadar maç duraklatıldı.');}
  }
  return;
 }
 if(d.type==='start'){
  if(options.mode!=='online')return;
  if(!Number.isInteger(d.matchId)||d.matchId<=net.matchId)return;net.matchId=d.matchId;net.freeze=false;net.focusPaused=false;net.hostAway=false;net.snapshots=[];net.seq=0;net.remote={x:0,y:0,aimX:0,aimY:0,aimActive:false};net.remotes={};newGame();roomMessage(d.rematch?'Rövanş başladı!':'Maç başladı!');return;
 }
 if(d.type==='input'&&net.role==='host'){
  const slot=Number.isInteger(d.slot)?d.slot:1;
  if(!game||slot<=0||slot>=game.players.length)return;
  const remote={x:d.x||0,y:d.y||0,aimX:d.aimX||0,aimY:d.aimY||0,aimActive:!!d.aimActive};
  net.remotes[slot]=remote;if(slot===1)net.remote=remote;
  if(game.phase==='countdown'&&WEAPONS[d.weapon]){
   game.players[slot].weapon=d.weapon;game.players[slot].ammo=WEAPONS[d.weapon].clip;
  }
  return;
 }
 if(d.type==='upgrade'&&net.role==='host'&&game?.phase==='upgrade'&&game.upgradeChooser===1){applyUpgrade(d.choice);return;}
 if(d.type==='act'&&net.role==='host'&&game?.phase==='active'){
  const slot=Number.isInteger(d.slot)?d.slot:1;if(slot<1||slot>=game.players.length)return;
  if(d.action==='charge_on')beginCharge(slot);else if(d.action==='charge_off')endCharge(slot);
  else if(d.action==='dash')useDash(slot);else if(d.action==='parry')useParry(slot);
  else if(d.action==='card')useCard(slot);return;
 }
 if(d.type==='state'&&net.role==='guest'){
  if(!d.state?.players||!d.state?.map||d.matchId!==net.matchId)return;
  if(Number.isFinite(d.seq)&&d.seq<=net.seq)return;
  if(Number.isFinite(d.seq))net.seq=d.seq;
  if(!game)newGame();
  const at=performance.now();net.snapshots.push({t:at,state:d.state});
  if(net.snapshots.length>8)net.snapshots.shift();
  const oldPhase=game.phase,oldRound=game.round,oldChaos=game.chaos,oldExplosionNotice=game.explosionNoticeShown;
    const previousPlayers=game.players;
    game=d.state;if(net.hostAway)game.phase='paused';
  if(SHOOTER_MODE&&game.shooter){
    if(!Array.isArray(net.guestShotCounts))net.guestShotCounts=[];
    for(const p of game.players){
      const prior=net.guestShotCounts[p.id]??0,next=game.shotsFired?.[p.id]||0;
      if(next>prior&&next-prior<5)snd('shot',p.id===net.slot?.70:.35,p.weapon,p.team??p.id%2);
      if((p.reload||0)>(previousPlayers?.[p.id]?.reload||0)+.05)snd('reload',p.id===net.slot?.8:.35,p.weapon,p.team??p.id%2);
      net.guestShotCounts[p.id]=next;
    }
  }
  if(game.phase==='explode'&&game.explosionNoticeShown&&!oldExplosionNotice&&!net.hostAway)showExplosionOutcome();
  if(SHOOTER_MODE&&game.phase==='roundwin'&&oldPhase!=='roundwin'){
   flashCallout(game.players[game.roundWinner].name+' TURU KAZANDI!',1.3);snd('eliminate',.35);
  }
  if(oldRound!==game.round){$('mapName').textContent=game.map.name;hideOverlay();}
  if(oldChaos!==game.chaos&&game.chaos&&CHAOS[game.chaos])flashCallout(CHAOS[game.chaos].name,2);
  if(game.phase!==oldPhase){if(SHOOTER_MODE&&game.phase==='finished'){
      const winner=game.score.indexOf(Math.max(...game.score));
      const name=game.rules.battleMode==='team'?(winner===0?'MAVİ TAKIM':'KIRMIZI TAKIM'):game.players[winner].name;
      showOverlay('ARENA ÇATIŞMASI','🏆',name+' KAZANDI!',game.rules.rounds+' turluk maç tamamlandı. Skor '+game.score.join(' – ')+'.',[{label:'ANA MENÜ',action:returnMenu}]);snd('win',.7);
    }else if(game.phase==='upgrade'){showUpgradeChoice();}else if(game.phase==='explode'){
     hideOverlay();snd('boom',.6);
   }else if(game.phase==='finished'){
     const winner=game.score[0]>game.score[1]?0:1;
     showOverlay('MAÇ BİTTİ','🏆',game.players[winner].name+' KAZANDI!','Skor '+game.score.join(' – ')+'. Yeni maç için oda kurucusu rövanş başlatabilir.',[{label:'ANA MENÜ',action:returnMenu}]);snd('win',.5);
   }else if(game.phase==='countdown'||game.phase==='active'){hideOverlay();}}
  $('player0Name').textContent=game.players[0].name;$('player1Name').textContent=game.players[1].name;
  return;
 }
 if(d.type==='closed'||d.type==='replaced'){
   if(game){showOverlay('ODA KAPANDI','🚪','MAÇ SONA ERDİ',d.message||'Oda kapandı.',[{label:'ANA MENÜ',action:returnMenu}]);}
   else{roomMessage(d.message||'Oda kapandı.',true);leaveOnline();}
 }
}
function sendGuestInput(){if(!game||!net.connected||net.role!=='guest')return;
 let x=+(!!keys.KeyD)-+(!!keys.KeyA),y=+(!!keys.KeyS)-+(!!keys.KeyW);
 if(touch.joystickId!==null){x=touch.dx;y=touch.dy;}if(isGameChatActive()){x=0;y=0;}
 const v=unitOrZero(x,y),p=game.players[net.slot]||game.players[1];
 netSend({type:'input',x:v.x,y:v.y,aimX:mouse.active?mouse.x:game.players[0].x,aimY:mouse.active?mouse.y:game.players[0].y,aimActive:mouse.active,weapon:options.weapon});
}
function touchAct(action){if(options.mode==='online'&&net.role==='guest'){netSend({type:'act',action});return;}
 const id=0;if(action==='charge_on')beginCharge(id);else if(action==='charge_off')endCharge(id);else if(action==='dash')useDash(id);else if(action==='parry')useParry(id);else if(action==='card')useCard(id);
}
function layoutArena(){if(!document.body.classList.contains('is-playing'))return;
 const screen=$('gameScreen'),shell=screen.querySelector('.arena-shell');
 // Fill the viewport. Three.js fits the logical field; the surrounding yard
 // occupies any extra width, so there are no blank side gutters.
 shell.style.width=screen.clientWidth+'px';shell.style.height=screen.clientHeight+'px';
}

function readRules(){const p=$('rulesPreset').value;const r={preset:p,battleMode:$('battleMode').value,arena:$('rulesArena').value,rounds:Number($('rulesRounds').value),upgradePersistence:$('rulesPersistence').value};for(const f of ['upgrades','chaos','cards','panic'])r[f]=$('rules'+f[0].toUpperCase()+f.slice(1)).checked;options.rules=safeRules(r);renderRules();}
function renderRules(){const r=options.rules;$('battleMode').value=r.battleMode;$('weaponChoice').value=options.weapon;$('rulesPreset').value=r.preset;$('rulesArena').value=r.arena;$('rulesRounds').value=String(r.rounds);$('rulesPersistence').value=r.upgradePersistence;for(const k of ['upgrades','chaos','cards','panic'])$('rules'+k[0].toUpperCase()+k.slice(1)).checked=r[k];$('selectedRules').textContent=`${(['upgrades','chaos','cards','panic'].some(k=>r[k]!==PRESETS[r.preset][k])?'🎛️ Özel Kurallar':({fusion:'🔥 Hepsi Bir Arada',evolution:'💣 Bomba Evrimi',party:'⚡ Çılgın Kaos',classic:'🎯 Klasik Düello'}[r.preset]))} • ${r.battleMode==='duel'?'1v1 DÜELLO':r.battleMode==='team'?'2v2 TAKIM':'4 OYUNCU FFA'} • ${r.rounds} tur/eleme • ${r.arena==='cycle'?'Dönen arenalar':r.arena==='random'?'Rastgele arenalar':MAPS[Number(r.arena)].name} • ${r.upgradePersistence==='round'?'Güçler her tur sıfırlanır':'Güçler maç boyu birikir'}`;$('roomRulePreview').textContent=$('selectedRules').textContent;const locked=options.mode==='online'&&net.code!==null;$('rulesEditor').querySelectorAll('select,input').forEach(el=>el.disabled=(locked&&el.id!=='weaponChoice')||(el.id==='battleMode'&&options.mode!=='online'));}
function init(){
 $('rulesEditor').before($('onlineRoom'));
 $('rulesPreset').addEventListener('change',e=>{const base=PRESETS[e.target.value];for(const k of Object.keys(base))$('rules'+k[0].toUpperCase()+k.slice(1)).checked=base[k];readRules()});
 $('rulesEditor').querySelectorAll('select,input').forEach(el=>{if(el.id!=='rulesPreset'&&el.id!=='weaponChoice')el.addEventListener('change',readRules)});
 $('weaponChoice').addEventListener('change',()=>{options.weapon=WEAPONS[$('weaponChoice').value]?$('weaponChoice').value:'pistol';
  const w=WEAPONS[options.weapon];$('weaponHelp').textContent=w.name+' • '+w.damage+' hasar • '+w.clip+' mermi • '+(1/w.rate).toFixed(1)+' atış/sn.';
  snd('click');});renderRules();
 document.querySelectorAll('.mode-btn').forEach(el=>el.addEventListener('click',()=>{options.mode=el.dataset.mode;document.querySelectorAll('.mode-btn').forEach(b=>{b.classList.toggle('selected',b===el);b.setAttribute('aria-pressed',b===el?'true':'false')});$('difficultyRow').classList.toggle('hidden',options.mode!=='bot');$('onlineRoom').classList.toggle('hidden',options.mode!=='online');document.body.classList.toggle('online-setup',options.mode==='online');
 if(options.mode!=='online')options.rules.battleMode='duel';renderRules();$('startBtn').classList.toggle('hidden',options.mode==='online');if(options.mode==='online'&&matchMedia('(max-width:760px)').matches)requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'instant'}));snd('click')}));
 document.querySelectorAll('.diff-buttons button').forEach(el=>el.addEventListener('click',()=>{options.difficulty=el.dataset.diff;document.querySelectorAll('.diff-buttons button').forEach(b=>b.classList.toggle('selected',b===el));snd('click')}));
 $('startBtn').addEventListener('click',startMatchFromMenu);
 $('createRoom').addEventListener('click',()=>{if(!canOnline())return;options.nickname=$('nick').value.trim().slice(0,14)||'KAOS KRALI';try{localStorage.setItem('bomba-nickname',options.nickname)}catch{}connectRoom({type:'create',name:options.nickname,rules:options.rules})});
 $('joinRoom').addEventListener('click',()=>joinFromInput());$('joinCode').addEventListener('keydown',e=>{if(e.key==='Enter')joinFromInput()});
 $('copyInvite').addEventListener('click',async()=>{const url=$('roomLink').value;try{await navigator.clipboard.writeText(url);roomMessage('Davet bağlantısı kopyalandı! ✓')}catch{const el=$('roomLink');el.select();document.execCommand('copy');roomMessage('Bağlantı seçildi; Ctrl+C ile kopyala.')}});
 $('hostStart').addEventListener('click',()=>{if(net.role==='host'&&net.players.length===requiredPlayers()&&net.players.every(p=>p.online))netSend({type:'start'})});
 $('leaveRoom').addEventListener('click',()=>{leaveOnline();roomMessage('Odadan ayrıldın. Yeni oda için harita ve mod seçebilirsin.');$('roomReady').classList.add('hidden')});
 $('lobbyChatForm').addEventListener('submit',e=>{e.preventDefault();sendChat($('lobbyChatInput'));});$('gameChatForm').addEventListener('submit',e=>{e.preventDefault();sendChat($('gameChatInput'));closeGameChat();});
 $('chatToggle').addEventListener('click',toggleGameChat);$('chatClose').addEventListener('click',closeGameChat);
 window.addEventListener('focus',resumeHostWhenBack);
 document.addEventListener('visibilitychange',()=>{if(options.mode!=='online'||net.role!=='host')return;if(document.hidden)pauseHostWhenAway();else if(document.hasFocus())resumeHostWhenBack();});
 $('backBtn').addEventListener('click',returnMenu);$('logoHome').addEventListener('click',e=>{e.preventDefault();returnMenu()});
 $('helpBtn').addEventListener('click',showHelp);$('infoClose').addEventListener('click',closeHelp);$('infoDone').addEventListener('click',closeHelp);$('infoDialog').addEventListener('click',e=>{if(e.target===$('infoDialog'))closeHelp()});
 $('pauseBtn').addEventListener('click',pauseGame);
 $('fullscreenBtn').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{alertToast('Tam ekran tarayıcın tarafından engellendi.')}layoutArena();});
 $('muteTop').addEventListener('click',()=>{muted=!muted;document.getElementById('menuSound')?.setAttribute('aria-pressed',String(muted));const soundLabel=document.querySelector('#menuSound span');if(soundLabel)soundLabel.textContent=muted?'KAPALI':'AÇIK';stopArenaAmbience();$('muteTop').textContent=muted?'🔇':'🔊'});
 window.addEventListener('resize',layoutArena);document.addEventListener('fullscreenchange',()=>{showChatTemporarily();setTimeout(layoutArena,80);});bindTouch();
 const invite=new URLSearchParams(location.search).get('room');
 if(invite){
  const code=invite.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);
  document.querySelector('[data-mode="online"]').click();$('joinCode').value=code;
  if(code.length===6&&canOnline()){
   let tok;try{tok=sessionStorage.getItem('bomba-room-'+code)||undefined}catch{}
   let nickname;try{nickname=localStorage.getItem('bomba-nickname')}catch{}
   if(!nickname)nickname='MİSAFİR '+Math.floor(100+Math.random()*900);
   options.nickname=nickname.slice(0,14);$('nick').value=options.nickname;
   roomMessage('Davet bağlantısından odaya otomatik katılınıyor…');
   connectRoom({type:'join',code,token:tok,name:options.nickname});
  }else roomMessage('Davet bağlantısındaki oda kodu geçersiz.',true);
 }
 requestAnimationFrame(frame);
}

init();
// Public test hook with minimal read-only surface (used only by automated smoke tests).
window.__BOMBA_SENDE__={getState:()=>game?{phase:game.phase,round:game.round,score:game.score.slice(),holder:game.holder,bombMode:game.bomb.mode,map:game.map.name,chaos:game.chaos,rules:game.rules,upgradeOffer:game.upgradeOffer,upgrades:game.players.map(p=>p.upgrades)}:null,actions:{start:()=>{$('startBtn').click()},begin:()=>{if(game&&game.phase==='ready'){$('overlayFoot button')?.click()}},throw:()=>{beginCharge(0);if(game){game.players[0].charge=.7;endCharge(0)}},dash:()=>useDash(0),parry:()=>useParry(0),card:()=>useCard(0)}};
})();


