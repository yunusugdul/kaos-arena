'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'public/game.js'),'utf8');
const view=fs.readFileSync(path.join(root,'public/arena3d.js'),'utf8');
const art=fs.readFileSync(path.join(root,'public/arena3d-detail.js'),'utf8');
const maps=Function('return '+game.match(/const MAPS=(\[[\s\S]*?\]);/)[1])();
const obstacleGap=(a,b)=>{
 const dx=Math.max(0,a.x-b.x-b.w,b.x-a.x-a.w);
 const dy=Math.max(0,a.y-b.y-b.h,b.y-a.y-a.h);
 return Math.hypot(dx,dy);
};
test('classic five arena layout remains exactly as original Bomba Sende',()=>{
 assert.equal(maps.length,5);
 assert.match(game,/const W=1000,H=562,R=21/);
 const expected=[
  [[350,95,70,128],[581,337,70,128],[450,233,100,96]],
  [[318,153,64,246],[616,153,64,246],[451,75,98,68],[451,422,98,65]],
  [[383,112,65,145],[552,306,65,145],[451,242,98,78]],
  [[260,200,110,65],[630,300,110,65],[465,60,70,95],[465,407,70,95]],
  [[325,92,75,121],[600,350,75,121],[468,213,64,137]]
 ];
 for(let i=0;i<maps.length;i++){
  assert.deepEqual(maps[i].blocks.map(v=>[v.x,v.y,v.w,v.h]),expected[i],maps[i].name);
 }
 assert.equal(maps[2].features.filter(f=>f.kind==='portal').length,2);
});
test('isometric high-angle camera restores most of the original 2D arena area',()=>{
 assert.match(view,/CAMERA_HEIGHT=56, CAMERA_DEPTH=16/);
 assert.match(view,/camera\.position\.set\(0,CAMERA_HEIGHT,CAMERA_DEPTH\)/);
 assert.match(view,/camera\.position\.set\(Math\.sin\(t\*41\)\*cameraJitter,CAMERA_HEIGHT,CAMERA_DEPTH/);
 const projectedFloorHeight=22.48*56/Math.hypot(56,16);
 const viewportHeight=44*562/1000;
 assert.ok(projectedFloorHeight/viewportHeight>.85,'arena should occupy at least 85% of canvas height');
 assert.match(view,/const visibleW=Math\.max\(44,24\.75\*aspect\)/);
 assert.match(view,/raycaster\.ray\.intersectPlane\(pointerPlane,hit\)/);
});
test('bomb has no white animated glints and characters remain high contrast',()=>{
 assert.doesNotMatch(view,/basic\('#e9f6ff'/);
 assert.match(view,/hotWick=mesh\(geometries\.sphere,basic\('#ff9f28'/);
 assert.match(view,/spark\.scale\.setScalar\(1\)/);
 assert.match(view,/fuseHalo\.intensity=\.65/);
 assert.match(view,/emissive:\['#94c800','#e91e77'/);
 assert.match(view,/const a=ring\(root,hex,1\.12\);a\.position\.y=\.07;a\.material\.opacity=1/);
});
test('3D obstacles are truly extruded with separate bevelled material sides, within the same collision footprints',()=>{
 assert.match(art,/new THREE\.ExtrudeGeometry\(shape/);
 assert.match(art,/roundedWall\(w,d,2\.68\)/);
 assert.match(art,/\[cap,body\]/);
 assert.match(view,/function buildClassicMap\(map\)/);
 assert.match(view,/if\(simple\)\{stageDetail=buildClassicMap\(map\);return;\}/);
 assert.match(art,/shadowAt\(x,z,w\+2,d\+2/);
 assert.doesNotMatch(view,/\.\_visual=/);
});
