'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const js=read('public/game.js'),html=read('public/index.html'),css=read('public/style.css');
test('chat panel is a canvas sibling and does not push the arena off center',()=>{
 assert.match(html,/id="arenaStage" class="arena-stage"><aside id="gameChatPanel"/);
 assert.match(html,/<\/aside><div class="arena-shell"><canvas id="arena"/);
 assert.match(css,/body\.is-playing \.arena-chat\{\s*position:absolute;left:clamp/);
 assert.doesNotMatch(js,/const sideW=onlineChat&&!stacked/);
});
test('chat nicknames are relative to the current player for lobby and game',()=>{
 assert.match(js,/by.textContent=msg.slot===net.slot\?'Sen':'O'/);
 assert.match(js,/name.textContent=\(msg.slot===net.slot\?'Sen':'O'\)\+':'/);
 assert.match(js,/net.chatHistory.slice\(-5\)/);
});
test('full-screen idle chat fades after 4000 milliseconds but reappears on messages and Enter',()=>{
 assert.match(js,/const CHAT_FADE_MS=4000/);
 assert.match(js,/document.fullscreenElement&&options.mode==='online'&&game&&!isGameChatActive\(\)/);
 assert.match(js,/appendChatItem\(item\)[\s\S]*?renderChat\(\);showChatTemporarily\(\)/);
 assert.match(js,/function openGameChat\(\)[\s\S]*?showChatTemporarily\(\)/);
 assert.match(js,/if\(e.key==='Enter'&&options.mode==='online'&&game\)/);
 assert.match(css,/body\.is-playing \.arena-chat.chat-idle\{opacity:0;visibility:hidden/);
});

