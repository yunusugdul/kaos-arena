'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(dir,'public/game.js'),'utf8');
const arena=fs.readFileSync(path.join(dir,'public/arena3d.js'),'utf8');
const html=fs.readFileSync(path.join(dir,'public/index.html'),'utf8');
const css=fs.readFileSync(path.join(dir,'public/style.css'),'utf8');
function slice(start,end){
 const a=js.indexOf(start),b=js.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'missing function '+start);
 return js.slice(a,b);
}
const weaponLiteral=js.match(/const WEAPONS=Object\.freeze\((\{[\s\S]*?\})\);/);
const weapons=Function('return '+weaponLiteral[1])();

test('four weapons have distinct damage, speed, magazines, fire rates and projectiles',()=>{
 assert.deepEqual(Object.keys(weapons),['pistol','rifle','shotgun','sniper']);
 assert.ok(weapons.rifle.rate<weapons.pistol.rate);
 assert.ok(weapons.shotgun.pellets>1);
 assert.ok(weapons.sniper.damage>weapons.pistol.damage);
 assert.ok(weapons.sniper.clip<weapons.rifle.clip);
 assert.ok(weapons.shotgun.range<weapons.sniper.range);
 assert.match(html,/id="weaponChoice"/);
 assert.match(js,/function shooterWeapon\(id\)/);
 assert.match(js,/p\.fireCD=weapon\.rate/);
 assert.match(js,/weapon\.pellets/);
});
test('team combat avoids friendly fire and credits the team score',()=>{
 const source=slice('function shooterHit(p,owner,x,y,damage=SHOOTER_DAMAGE){','\nfunction shooterMatchOver(');
 const g={rules:{battleMode:'team',rounds:5},phase:'active',score:[0,0],stats:{hits:[0,0,0,0]},
  players:Array.from({length:4},(_,id)=>({id,team:id%2,name:'P'+id,dead:false,hp:100,shieldTime:0,parryTime:0,invulnerable:0}))};
 const fn=Function('game','SHOOTER_DAMAGE','ring','snd','burst','alertToast','shooterMatchOver',
  'let shakes=0;'+source+'\nreturn shooterHit;')(g,20,()=>{},()=>{},()=>{},()=>{},()=>{throw Error('should not win yet')});
 for(let i=0;i<5;i++)fn(g.players[1],2,120,80);
 assert.equal(g.score[0],1,'same-team player 2 scores for team 0');
 assert.equal(g.phase,'active','team match continues until score target');
 assert.equal(g.players[1].respawn,1.8);
 const shooting=slice('function shooterAdvanceBullets(dt){','\nfunction tickPowerups(');
 assert.match(shooting,/p\.team===b\.owner%2/);
 assert.match(shooting,/for\(const p of g\.players\)/);
});
test('FFA player 3 can win an elimination game without relying on slots 0 and 1',()=>{
 const source=slice('function shooterHit(p,owner,x,y,damage=SHOOTER_DAMAGE){','\nfunction shooterMatchOver(');
 let winner=null;
 const g={rules:{battleMode:'ffa',rounds:3},phase:'active',score:[0,0,0,2],stats:{hits:[0,0,0,0]},
 players:Array.from({length:4},(_,id)=>({id,team:id%2,name:'P'+id,dead:false,hp:100,shieldTime:0,parryTime:0,invulnerable:0}))};
 const fn=Function('game','SHOOTER_DAMAGE','ring','snd','burst','alertToast','shooterMatchOver',
  'let shakes=0;'+source+'\nreturn shooterHit;')(g,20,()=>{},()=>{},()=>{},()=>{},id=>{winner=id;});
 for(let i=0;i<5;i++)fn(g.players[0],3,120,80);
 assert.equal(g.phase,'finished');
 assert.equal(g.score[3],3);
 assert.equal(winner,3);
 assert.equal(g.victoryId,3);
});
test('safe powerups include distinct pickups, timed speed/damage and only a single active spawn',()=>{
 assert.match(js,/const POWERUPS=Object\.freeze/);
 assert.match(js,/function tickPowerups\(dt\)/);
 assert.match(js,/safeCardSpawn\(g,\{x,y\}\)/);
 assert.match(js,/if\(type==='heal'\)/);
 assert.match(js,/if\(type==='speed'\)/);
 assert.match(js,/if\(type==='shield'\)/);
 assert.match(js,/if\(type==='boost'\)/);
 assert.match(js,/p\.buffSpeedTime=5/);
 assert.match(js,/p\.buffDamageTime=5/);
 assert.match(js,/SHOOTER_MODE&&p\.buffSpeedTime>0/);
 assert.match(arena,/const buffRoot=new THREE\.Group\(\)/);
 assert.match(arena,/elimination\.visible=!!g\.eliminationFx/);
 assert.match(arena,/o\.muzzle\.visible=p\.muzzle>0/);
});
test('four-player UI and illustrated arena atmosphere are present and stay cosmetic',()=>{
 assert.match(html,/id="battleMode"/);
 assert.match(html,/value="team"/);
 assert.match(html,/value="ffa"/);
 assert.match(html,/id="multiScore"/);
 assert.match(css,/four-player-match/);
 assert.match(arena,/const humans=\[makeHuman/);
 assert.match(arena,/makeHuman\('#ffc969','OYUNCU 4',3\)/);
});

