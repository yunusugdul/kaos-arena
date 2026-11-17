'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const load=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const css=load('public/style.css'),js=load('public/game.js'),html=load('public/index.html');
test('V9 arena is centered independently of chat',()=>{
 assert.match(css,/body\.is-playing \.arena-stage\{\s*position:relative;display:flex;align-items:center;justify-content:center/);
 assert.match(css,/body\.is-playing \.arena-chat\{\s*position:absolute/);
 assert.doesNotMatch(js,/const reservedH=onlineChat/);
 assert.doesNotMatch(js,/const sideW=onlineChat/);
});
test('chat has no decorative frame; mobile no longer reserves a second row',()=>{
 assert.match(css,/body\.is-playing \.arena-chat-feed\{[\s\S]*?border:0;border-radius:0;[\s\S]*?background:none/);
 assert.match(css,/@media\(max-width:800px\)\{\s*body\.is-playing \.arena-chat\{\s*left:6px;bottom:9px/);
 assert.doesNotMatch(css.slice(css.indexOf('/* V9: canvas always stays centered.')), /flex-direction:column-reverse/);
 assert.match(css,/body\.is-playing \.arena-chat-feed:empty\{display:none\}/);
});
test('fullscreen fade happens 4 seconds after message or composer closes but not while typing',()=>{
 assert.match(js,/const CHAT_FADE_MS=4000/);
 assert.match(js,/document\.fullscreenElement&&options\.mode==='online'&&game&&!isGameChatActive\(\)/);
 assert.match(js,/function openGameChat\(\)[\s\S]*?showChatTemporarily\(\)/);
 assert.match(js,/function closeGameChat\(\)[\s\S]*?showChatTemporarily\(\)/);
 assert.match(html,/Tam ekranda 4 saniye yeni mesaj gelmezse/);
});

