'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
test('match customization controls exist and default to fusion',()=>{
 for(const id of ['rulesEditor','rulesPreset','rulesArena','rulesRounds','rulesUpgrades','rulesChaos','rulesCards','rulesPanic'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(js,/preset:'fusion'/);assert.match(js,/connectRoom\(\{type:'create',name:options.nickname,rules:options.rules\}\)/);
});
test('evolution chooser keeps upgrades after round reset and remains authoritative',()=>{
 for(const id of ['rocket','magnet','bank','dash','parry'])assert.match(js,new RegExp('(?:const UPGRADES|rocket|magnet|bank|dash|parry)[\\s\\S]*'+id));
 assert.match(js,/g\.phase='upgrade'/);assert.match(js,/g\.players\[g\.upgradeChooser\]/);assert.match(js,/if\(!p\.upgrades\.includes\(id\)\)p\.upgrades\.push\(id\)/);
 assert.match(js,/type:'upgrade',choice:id/);assert.match(js,/game\.upgradeChooser===1/);
});
test('no medals or replay system is added',()=>{
 assert.doesNotMatch(js,/replayBuffer|awardBadge|recordGif/);
});

