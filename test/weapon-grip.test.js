const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
test('both wrists remain on weapon sockets through motion, recoil, reload, four weapons and rotated/scaled parents',async()=>{
 const THREE=await import('three');
 const rounded=pathToFileURL(path.resolve(__dirname,'../node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js')).href;
 const marineSource=fs.readFileSync(path.join(__dirname,'../public/armored-marine.js'),'utf8').replace('/vendor/addons/geometries/RoundedBoxGeometry.js',rounded).replace('/render-batch.js',pathToFileURL(path.resolve(__dirname,'../public/render-batch.js')).href);
 const {createArmoredMarine}=await import('data:text/javascript;base64,'+Buffer.from(marineSource).toString('base64'));
 const rigSource=fs.readFileSync(path.join(__dirname,'../public/weapon-rig.js'),'utf8');
 const {createWeaponRig}=await import('data:text/javascript;base64,'+Buffer.from(rigSource).toString('base64'));
 for(let id=0;id<2;id++){
  const root=new THREE.Group(),model=new THREE.Group(),gun=new THREE.Group();root.add(model);model.add(gun);
  const armor=createArmoredMarine(THREE,model,id,{textures:false});
  const rig=createWeaponRig(THREE,armor.group,model,gun,{height:1.72,depth:.40});
  for(const weapon of ['pistol','rifle','shotgun','sniper'])for(let frame=0;frame<60;frame++){
   const p={weapon,vx:frame%2?180:0,vy:80,recoil:frame%10===0?.38:0,reload:frame>15&&frame<45?(45-frame)/20:0};
   root.rotation.y=frame*.15;root.scale.setScalar(.8+frame*.01);root.position.set(2,.2,-3);
   armor.animate(p,frame/30,1/30);rig.update(p,frame/30,1/30);root.updateMatrixWorld(true);
   for(const [i,grip] of [rig.rightGrip,rig.leftGrip].entries()){
    const expected=gun.localToWorld(grip.clone()),actual=rig.chains[i].hand.getWorldPosition(new THREE.Vector3());
    assert.ok(actual.distanceTo(expected)<.003,`${weapon} frame ${frame} hand ${i}: ${actual.distanceTo(expected)}`);
   }
  }
 }
});


