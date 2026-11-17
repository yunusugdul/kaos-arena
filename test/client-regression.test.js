'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../public');
const js=fs.readFileSync(path.join(root,'game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('online updates flow at 30Hz rather than 13Hz',()=>{
 assert.match(js,/time-net\.lastState>32/);
 assert.match(js,/time-net\.lastInput>30/);
 assert.match(js,/remotePresentation\(time\)/);
 assert.match(js,/const VIEW_DELAY=95/);
});
test('shared aim direction comes from authoritative snapshot',()=>{
 assert.match(js,/p\.aim=aimOf\(p\)/);
 assert.match(js,/const v=p\.aim\|\|p\.face/);
 assert.match(js,/net\.snapshots\.push\(/);
});
test('invite links join automatically and no remix branding remains',()=>{
 assert.match(js,/connectRoom\(\{type:'join',code,token:tok,name:options\.nickname\}\)/);
 assert.doesNotMatch(html,/REMIX/);
 assert.match(html,/KAOS<br><em>ARENA/);
});

