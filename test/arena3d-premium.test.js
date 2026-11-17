'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'public/game.js'),'utf8');
const view=fs.readFileSync(path.join(root,'public/arena3d.js'),'utf8');
const detail=fs.readFileSync(path.join(root,'public/arena3d-detail.js'),'utf8');
const server=require('../server');
const maps=Function('return '+game.match(/const MAPS=(\[[\s\S]*?\]);/)[1])();
const safeCode=game.slice(game.indexOf('function safeCardSpawn(g,pos){'),game.indexOf('\nfunction spawners(',game.indexOf('function safeCardSpawn(g,pos){')));
const safe=Function('W','H','clamp',safeCode+'\nreturn safeCardSpawn;')(1000,562,(x,lo,hi)=>Math.max(lo,Math.min(hi,x)));
const players=[{x:150,y:281,r:21},{x:850,y:281,r:21}];

test('cards never spawn inside any rectangular obstacle or its margins',()=>{
  for(const map of maps){
    const state={map,players};
    for(const b of map.blocks){
      assert.equal(safe(state,{x:b.x+b.w/2,y:b.y+b.h/2}),false,map.name);
      assert.equal(safe(state,{x:b.x-20,y:b.y+b.h/2}),false,map.name+' near obstacle');
    }
  }
});
test('cards never spawn inside a bumper, portal or ice decal',()=>{
  for(const map of maps){
    const state={map,players};
    for(const feature of map.features){
      assert.equal(safe(state,{x:feature.x,y:feature.y}),false,map.name+' '+feature.kind);
      assert.equal(safe(state,{x:feature.x+feature.r+10,y:feature.y}),false,map.name+' feature margin');
    }
  }
});
test('cards avoid arena bounds and players but legal empty coordinates remain valid',()=>{
  for(const map of maps){
    const state={map,players};
    assert.equal(safe(state,{x:25,y:200}),false,map.name+' boundary');
    assert.equal(safe(state,{x:150,y:281}),false,map.name+' player');
    assert.equal(safe(state,{x:85,y:85}),true,map.name+' free space');
  }
  assert.match(game,/let spots=candidates\.filter\(p=>safeCardSpawn\(g,p\)\)/);
  assert.match(game,/if\(!spots\.length\)/);
});
test('arena maps, pickup collisions and player mechanics still use the original 2D coordinate system',()=>{
  assert.equal(maps.length,5);
  assert.match(game,/const W=1000,H=562,R=21/);
  assert.match(game,/if\(Math\.hypot\(p\.x-g\.card\.x,p\.y-g\.card\.y\)<p\.r\+23\)/);
  assert.match(view,/world\(p\.x,p\.y/);
  assert.doesNotMatch(view,/makeLabel\(/);
  assert.doesNotMatch(view,/o\.label/);
  assert.match(view,/pickupStyles=/);
  assert.match(view,/fusePath=new THREE\.CatmullRomCurve3/);
});
test('detailed 3D environment and optional bloom remain visual-only',()=>{
  assert.match(detail,/MeshPhysicalMaterial/);
  assert.match(detail,/floorTexture\(map\)/);
  assert.match(detail,/shadowAt\(/);
  assert.match(view,/createArenaDetailKit/);
  assert.match(view,/UnrealBloomPass\.js/);
  // The fast renderer uses one direct pass for every map, including Last Chance.
  const render=view.slice(view.indexOf('function renderScene(now)'),view.indexOf('let cachedW='));
  assert.match(render,/renderer\.render\(scene,camera\)/);
  assert.doesNotMatch(render,/composer\.render\(/);
});
test('all local Three.js addon module assets are reachable by the server',async()=>{
  await new Promise(resolve=>server.server.listen(0,'127.0.0.1',resolve));
  const port=server.server.address().port;
  try{
    for(const name of [
      '/arena3d.js','/arena3d-detail.js','/vendor/three.module.js',
      '/vendor/addons/postprocessing/EffectComposer.js',
      '/vendor/addons/postprocessing/RenderPass.js',
      '/vendor/addons/postprocessing/UnrealBloomPass.js',
      '/vendor/addons/postprocessing/OutputPass.js',
      '/vendor/addons/postprocessing/Pass.js',
      '/vendor/addons/postprocessing/ShaderPass.js',
      '/vendor/addons/postprocessing/MaskPass.js',
      '/vendor/addons/shaders/CopyShader.js',
      '/vendor/addons/shaders/LuminosityHighPassShader.js'
    ]){
      const res=await fetch('http://127.0.0.1:'+port+name);
      assert.equal(res.status,200,name);
      assert.match(res.headers.get('content-type'),/javascript/,name);
    }
    assert.equal((await fetch('http://127.0.0.1:'+port+'/vendor/addons/../../package.json')).status,404);
  }finally{await new Promise(resolve=>server.server.close(resolve));}
});

