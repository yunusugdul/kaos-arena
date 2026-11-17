const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
let THREE,createNeonWorld;
test.before(async()=>{THREE=await import('three');({createNeonWorld}=await import('../public/neon-world.js'));});
function makeWorld(){
 const stage=new THREE.Group();
 const geometries={sphere:new THREE.SphereGeometry(1,16,12),sphereFine:new THREE.SphereGeometry(1,24,16),cylinder:new THREE.CylinderGeometry(1,1,1,16),capsule:new THREE.CapsuleGeometry(.45,.6,5,10)};
 const mesh=(geo,mat,parent,x=0,y=0,z=0,scale)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);if(scale)o.scale.set(...scale);parent.add(o);return o;};
 const ring=(parent,hex,r=1)=>{const o=mesh(new THREE.TorusGeometry(r,.04,8,32),new THREE.MeshBasicMaterial({color:hex}),parent);o.rotation.x=-Math.PI/2;return o;};
 const world=(x,y)=>new THREE.Vector3((x-500)/25,0,(y-281)/25);
 const kit=createNeonWorld(THREE,{stage,mesh,ring,world,geometries,lowPower:true});
 return {stage,kit};
}
const game=fs.readFileSync(require('path').join(__dirname,'../public/game.js'),'utf8');
const maps=Function('return '+game.match(/const MAPS=(\[[\s\S]*?\]);/)[1])();
test('all five 3D arenas keep cover footprints and place the floor above the platform',()=>{
 for(const map of maps){
  const {stage,kit}=makeWorld();kit.neonArena(map);stage.updateMatrixWorld(true);
  const deck=stage.children.find(o=>o.userData.kind==='deck'),floor=stage.children.find(o=>o.userData.kind==='floor');
  const deckBounds=new THREE.Box3().setFromObject(deck);
  assert.ok(deckBounds.max.y<floor.position.y,'platform must not hide floor tiles');
  const covers=stage.children.filter(o=>o.userData.kind==='cover');
  assert.equal(covers.length,map.blocks.length);
  covers.forEach((o,i)=>{
   const bounds=new THREE.Box3().setFromObject(o),size=bounds.getSize(new THREE.Vector3()),b=map.blocks[i];
   assert.ok(Math.abs(size.x-b.w/25)<.001,'visual width must match collider');
   assert.ok(Math.abs(size.z-b.h/25)<.001,'visual depth must match collider');
  });
 }
});
test('four tactical soldiers have two animated arms and legs and finite geometry',()=>{
 const {kit}=makeWorld();
 for(let id=0;id<4;id++){
  const model=new THREE.Group(),rig=kit.chibi(model,id);
  assert.equal(rig.arms.length,2);assert.equal(rig.legs.length,2);assert.equal(rig.tails.length,0);
  const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  assert.ok(size.y>2.4&&size.y<3.1,'human-proportioned soldier silhouette');
  model.traverse(o=>{if(o.geometry)for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));});
 }
});
