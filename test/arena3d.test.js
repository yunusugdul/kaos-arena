'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'public/game.js'),'utf8');
const three=fs.readFileSync(path.join(root,'public/arena3d.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const pkg=require('../package.json');

test('Three.js uses local package, not an external CDN',()=>{
 assert.equal(pkg.dependencies.three,'0.160.1');
 assert.match(three,/from '\/vendor\/three\.module\.js'/);
 assert.match(server,/const threeBuild=/);
 assert.match(server,/const addon=/);
});
test('2D simulation and WebSocket networking remain intact',()=>{
 assert.match(game,/const W=1000,H=562,R=21/);
 assert.match(game,/function blocked\(x,y,r\)/);
 assert.match(game,/function updateBomb\(dt\)/);
 assert.match(game,/function remotePresentation\(now\)/);
 assert.match(game,/netSend\(\{type:'state'/);
 assert.match(three,/game\.js/);
 assert.doesNotMatch(three,/\._visual=/);
});
test('isometric renderer and raycast aiming are connected',()=>{
 assert.match(three,/OrthographicCamera/);
 assert.match(three,/raycaster\.ray\.intersectPlane/);
 assert.match(three,/camera\.lookAt\(0,0,0\)/);
 assert.match(game,/arena3d\?\.pointer\(e\)/);
 assert.match(game,/arena3d\.draw\(game,globalTime,particles,rings,shakes\)/);
});
test('3D canvas layers below existing input HUD and preserves original fallback',()=>{
 assert.match(game,/ctx\.clearRect\(0,0,W,H\)/);
 assert.match(game,/ctx\.save\(\);if\(shakes>0/);
 assert.match(fs.readFileSync(path.join(root,'public/style.css'),'utf8'),/\.arena-webgl/);
});
