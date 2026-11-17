'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'public/game.js'),'utf8');
const view=fs.readFileSync(path.join(root,'public/arena3d.js'),'utf8');
const detail=fs.readFileSync(path.join(root,'public/arena3d-detail.js'),'utf8');
const maps=Function('return '+game.match(/const MAPS=(\[[\s\S]*?\]);/)[1])();
test('Last Chance returns to original arena layout and features',()=>{
 const last=maps[4], [left,right,center]=last.blocks;
 assert.equal(last.name,'SON ŞANS');
 assert.equal(left.x,325);
 assert.equal(left.x+left.w,400);
 assert.equal(right.x,600);
 assert.equal(center.x,468);
 assert.equal(center.x+center.w,532);
 assert.equal(last.features.length,3);
});
test('Last Chance keeps normal speed but responsive movement through its central ice region',()=>{
 assert.match(game,/let ease=icy\?\(game\.map===MAPS\[4\]\?11:3\.2\):13/);
 assert.match(game,/let speed=275\*/);
 assert.match(game,/function updateBomb\(dt\)/);
});
test('Snow is sparse, larger, and exactly 50 percent slower inside and clears on exit',()=>{
 assert.match(game,/const radius=rand\(43,61\)/);
 assert.match(game,/g\.snowDelay=rand\(3\.6,4\.8\)/);
 assert.match(game,/g\.snowPatches=g\.snowPatches\.filter\(f=>f\.t>0\)\.slice\(-3\)/);
 assert.match(game,/const inSnow=game\.map===MAPS\[1\]/);
 assert.match(game,/if\(inSnow\)speed\*=\.5/);
 assert.match(game,/if\(p\.dashTime>0\)\{p\.vx=p\.face\.x\*760\*\(inSnow\?\.5:1\)/);
 assert.match(view,/snowCanvas\.width=256/);
 assert.match(view,/new THREE\.PlaneGeometry\(2,2\)/);
});
test('Explosion draws for at least one second before the result overlay',()=>{
 const start=game.indexOf('function explode(){'),end=game.indexOf('function upgradeOptions(',start);
 assert.ok(start>0&&end>start);
 assert.doesNotMatch(game.slice(start,end),/showOverlay\(/);
 assert.match(game,/g\.phaseTime<=1\.30/);
 assert.match(game,/if\(!g\.explosionNoticeShown/);
 assert.match(game,/if\(game\.phase==='explode'&&game\.explosionNoticeShown/);
 assert.match(view,/explosionFX\.visible=g\.phase==='explode'&&g\.phaseTime>1\.30/);
});

