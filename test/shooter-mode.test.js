'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const gameJs=fs.readFileSync(path.join(root,'public/game.js'),'utf8');
const three=fs.readFileSync(path.join(root,'public/arena3d.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'public/style.css'),'utf8');
const maps=Function('return '+gameJs.match(/const MAPS=(\[[\s\S]*?\]);/)[1])();
function extract(first,last){
 const a=gameJs.indexOf(first),b=gameJs.indexOf(last,a+first.length);
 assert.ok(a>0&&b>a,'source spans: '+first);
 return gameJs.slice(a,b);
}
test('shooter mode is isolated to staging and preserves existing arena physics and online code',()=>{
 assert.match(gameJs,/const SHOOTER_MODE=true, SHOOTER_HP=100, SHOOTER_DAMAGE=20, SHOOTER_CLIP=16/);
 assert.match(gameJs,/function circleRectResolve\(p,b\)/);
 assert.match(gameJs,/function blocked\(x,y,r\)/);
 assert.match(gameJs,/function onNetMessage\(d\)/);
 assert.match(gameJs,/function pressControl\(code,down\)/);
 assert.match(gameJs,/function tick\(dt\)\{if\(SHOOTER_MODE\)\{tickShooter\(dt\);return;\}/);
 assert.equal(maps.length,5);
});
test('health bar and gunfight instructions replace bomb timer in visible staging UI',()=>{
 assert.match(html,/<body class="shooter-mode">/);
 assert.match(html,/id="arena"/);
 assert.match(gameJs,/const track=document.createElement\('div'\);track.className='shooter-hp-track'/); // generated HP bar
});
test('shooter HUD is health, ammo and elimination-based with no fuse display',()=>{
 assert.match(gameJs,/newGame\(\)/);
 assert.match(gameJs,/function updateShooterHUD\(/);
 assert.match(gameJs,/shooterHp/);
 assert.match(gameJs,/function beginShooterRound\(\)/);
 assert.match(gameJs,/g\.round>=g\.rules\.rounds/);
 assert.match(css,/body\.shooter-mode \.fuse-container \{ display:none!important/);
 assert.match(html,/SİLAH HAZIR/);
 assert.match(html,/TUR SAYISI|SÜRESİZ/);
});
test('the 3D human carries a blaster and bullets are visible, the bomb is hidden',()=>{
 assert.match(three,/const gun=new THREE\.Group\(\)/);
 assert.match(three,/const barrel=mesh\(new THREE\.CylinderGeometry/);
 assert.match(three,/const muzzle=mesh\(new THREE\.ConeGeometry/);
 assert.match(three,/const hpRoot=new THREE\.Group\(\)/);
 assert.match(three,/const shooterShots=Array\.from/);
 assert.match(three,/if\(g\.shooter\)\{/);
 assert.match(three,/bomb\.visible=false/);
 assert.match(three,/o\.gun\.visible=!!g\.shooter/);
});
test('recorded CC0 gunshot is decoded locally with a synthesized fallback',()=>{
 assert.match(gameJs,/fetch\('\/audio\/pistol-fire\.wav'\)/);
 assert.match(gameJs,/audio\.decodeAudioData\(bytes\.slice\(0\)\)/);
 assert.match(gameJs,/if\(gunshotBuffer\)/);
 assert.match(gameJs,/if\(type==='shot'\)/);
 assert.match(gameJs,/audio\.createBuffer\(1,size,rate\)/);
 assert.match(gameJs,/source\.connect\(filter\)\.connect\(gain\)/);
 assert.match(gameJs,/if\(p\.ammo===0\)\{shooterReload\(p\.id\);p\.shooting=true;\}/);
 assert.match(gameJs,/shooting=false/);
 assert.match(gameJs,/action==='charge_on'/);
});
test('line-of-sight prevents a bot from firing through a wall',()=>{
 const source=extract('function shooterLineClear(x,y,tx,ty){','\nfunction shooterReload(');
 const {clear,setMap}=Function('maps',`
  let game={map:maps[0]};
  ${source}
  return {clear:shooterLineClear,setMap:(m)=>game.map=m};`)(maps);
 assert.equal(clear(150,281,800,281),false,'Neon Park centre cover must block shots');
 assert.equal(clear(75,75,250,75),true,'open side should be shootable');
 setMap(maps[1]);assert.equal(clear(150,80,850,80),false,'Ice Labyrinth central obstacle');
});
test('bullets stop on walls, never hit the owner, and deal health damage',()=>{
 const src=extract('function shooterAdvanceBullets(dt){','\nfunction tickShooter(dt){');
 const players=[{id:0,x:120,y:280,r:21,dead:false,hp:100},{id:1,x:340,y:280,r:21,dead:false,hp:100}];
 const game={map:maps[0],players,bullets:[],rules:{battleMode:'duel'}};
 let hits=0,impacts=0;
 const simulate=Function('game','blocked','burst','shooterHit','SHOOTER_DAMAGE',src+'\nreturn shooterAdvanceBullets;')(
   game,(x,y,r)=>x>280,()=>{impacts++},(p,owner)=>{hits++;p.hp-=20;},20);
 game.bullets=[{x:250,y:280,vx:1000,vy:0,owner:0,t:1}];
 simulate(.04);assert.equal(hits,0);assert.ok(impacts>0);assert.equal(game.bullets.length,0);
 game.bullets=[{x:306,y:280,vx:600,vy:0,owner:0,t:1}];
 // Override hit obstacle check by using a different collision range.
 const simulate2=Function('game','blocked','burst','shooterHit','SHOOTER_DAMAGE',src+'\nreturn shooterAdvanceBullets;')(
  game,()=>false,()=>{},(p,owner)=>{hits++;p.hp-=20;},20);
 simulate2(.02);assert.equal(hits,1);assert.equal(players[1].hp,80);
 assert.equal(players[0].hp,100);
});
test('shooting consumes ammo, adds one network-visible projectile and records score stats',()=>{
 const src=extract('function shooterFire(p){','\nfunction shooterHit(');
 const g={phase:'active',shotsFired:[0,0],bullets:[],stats:{throws:[0,0]}};
 const p={id:0,x:150,y:281,dead:false,fireCD:0,reload:0,ammo:16,aim:{x:1,y:0},weapon:'pistol'};
 const fire=Function('game','aimOf','burst','snd','shooterReload','SHOOTER_CLIP','SHOOTER_DAMAGE','playerWeapon','options','net','let shakes=0;'+src+'\nreturn shooterFire;')(
  g,()=>({x:1,y:0}),()=>{},()=>{},()=>{},16,20,()=>({rate:.17,clip:16,range:.96,speed:950,damage:20,pellets:1,spread:0,color:'#fff0a6',recoil:.12}),{mode:'bot'},{slot:0});
 fire(p);
 assert.equal(g.bullets.length,1);assert.equal(g.bullets[0].owner,0);
 assert.equal(g.bullets[0].vx,950);
 assert.equal(p.ammo,15);assert.equal(g.stats.throws[0],1);assert.equal(g.shotsFired[0],1);
});
test('a blocked hit causes no damage; fifth clear hit defeats player and scores',()=>{
 const src=extract('function shooterHit(p,owner,x,y,damage=SHOOTER_DAMAGE){','\nfunction shooterMatchOver(');
 const victim={id:1,x:850,y:281,dead:false,hp:100,shieldTime:1,parryTime:0,invulnerable:0};
 const g={phase:'active',players:[{id:0,name:'HOST'},victim],score:[0,0],stats:{hits:[0,0]},rules:{battleMode:'duel',rounds:3}};
 const hit=Function('game','SHOOTER_DAMAGE','SHOOTER_KILLS','ring','snd','burst','alertToast','shooterMatchOver','let shakes=0;'+src+'\nreturn shooterHit;')(
  g,20,10,()=>{},()=>{},()=>{},()=>{},()=>{throw Error('unexpected victory')});
 hit(victim,0,850,281);assert.equal(victim.hp,100,'shield must block shots');
 victim.shieldTime=0;
 for(let i=0;i<5;i++)hit(victim,0,850,281);
 assert.equal(victim.hp,0);assert.equal(victim.dead,true);
 assert.equal(victim.respawn,0);assert.equal(g.score[0],1);assert.equal(g.phase,'roundwin');assert.equal(g.roundWinner,0);
});

