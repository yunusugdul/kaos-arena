'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const game=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
test('ice map uses three large temporary snow zones with 50% movement penalty',()=>{
 assert.match(game,/function snowStep\(dt\)/);
 assert.match(game,/g\.snowPatches\.push\(/);
 assert.match(game,/const inSnow=game\.map===MAPS\[1\]&&game\.snowPatches\.some/);
 assert.match(game,/if\(inSnow\)speed\*=\.5/);
 assert.match(game,/slice\(-3\)/);
 assert.doesNotMatch(game,/chaos==='shrink'|g\.chaos='shrink'/);
 assert.doesNotMatch(game,/ALAN DARALIYOR/);
});
test('winner begins next round with bomb and round-reset policy only resets between rounds',()=>{
 assert.match(game,/nextHolder=g\.round===0\?Math\.floor\(rand\(0,2\)\):\(1-g\.roundLoser\)/);
 assert.match(game,/g\.rules\.upgradePersistence==='round'/);
 assert.match(game,/g\.players\.forEach\(p=>\{p\.upgrades=\[\];\}\)/);
 assert.match(html,/id="rulesPersistence"/);
 assert.match(server,/upgradePersistence:v\.upgradePersistence==='round'\?'round':'match'/);
});
test('nine upgrades include ghost pass-through and magnet is moderated',()=>{
 for(const id of ['rocket','magnet','bank','dash','parry','ghost','charge','runner','cooling'])assert.match(game,new RegExp(id+':\\{name:'));
 assert.match(game,/if\(!g\.players\[b\.owner\]\.upgrades\.includes\('ghost'\)\)for\(const o of g\.map\.blocks\)/);
 assert.match(game,/k=clamp\(1\.43\*dt,0,\.075\)/);
 assert.match(game,/return available\.slice\(0,3\)/);
});
test('chat and online pauses are present, room selection unlocked upon leave',()=>{
 for(const id of ['lobbyChatMessages','gameChatMessages','chatToggle','lobbyChatForm','gameChatForm'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(game,/renderRules\(\);}\s*function updateRoomPanel/);
 assert.match(game,/function pauseHostWhenAway\(/);
 assert.match(game,/function applyHostAwayPause\(/);
 assert.match(server,/d\.type==='chat'/);
 assert.match(server,/d\.type==='host_pause'/);
});
