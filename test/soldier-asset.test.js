const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('bundled soldier has valid GLB data, a skeleton and idle walk run animations',()=>{
 const bytes=fs.readFileSync(path.join(__dirname,'../public/models/Soldier.glb'));
 assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const length=bytes.readUInt32LE(12);assert.equal(bytes.readUInt32LE(16),0x4e4f534a);
 const gltf=JSON.parse(bytes.toString('utf8',20,20+length));
 assert.ok(gltf.skins.length>0);assert.ok(gltf.meshes.length>0);
 for(const name of ['Idle','Walk','Run'])assert.ok(gltf.animations.some(a=>a.name===name),name);
 assert.ok(gltf.buffers.every(b=>!b.uri),'geometry must be embedded for offline use');
 assert.ok(gltf.images.every(i=>i.bufferView!==undefined),'textures must be embedded for offline use');
});
