const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
test('rigid batching reduces 100 draw objects to one while preserving transformed bounds',async()=>{
 const THREE=await import('three'),{batchRigidMeshes}=await import('../public/render-batch.js');
 const root=new THREE.Group(),nested=new THREE.Group();root.position.set(3,2,-4);root.rotation.y=.6;root.add(nested);nested.rotation.z=.14;
 const geometry=new THREE.BoxGeometry(1,.5,2),material=new THREE.MeshStandardMaterial({color:'#557799'});
 for(let i=0;i<100;i++){const m=new THREE.Mesh(geometry,material);m.position.set(i%10,Math.floor(i/10),Math.sin(i));m.castShadow=true;nested.add(m);}
 const before=new THREE.Box3().setFromObject(root,true);const counts=batchRigidMeshes(THREE,root);root.updateWorldMatrix(true,true);
 const after=new THREE.Box3().setFromObject(root,true);assert.ok(before.min.distanceTo(after.min)<.00001);assert.ok(before.max.distanceTo(after.max)<.00001);
 assert.equal(counts.before,100);assert.equal(counts.after,1);let meshes=0;root.traverse(o=>{if(o.isMesh)meshes++;});assert.equal(meshes,1);
});
test('animated soldier retains its articulated bounds with fewer than half as many visible draw objects',async()=>{
 const THREE=await import('three'),{batchRigidMeshes}=await import('../public/render-batch.js');
 const rounded=pathToFileURL(path.resolve(__dirname,'../node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js')).href;
 const src=fs.readFileSync(path.join(__dirname,'../public/armored-marine.js'),'utf8').replace('/vendor/addons/geometries/RoundedBoxGeometry.js',rounded).replace('/render-batch.js',pathToFileURL(path.resolve(__dirname,'../public/render-batch.js')).href);
 const {createArmoredMarine}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
 const rigSrc=fs.readFileSync(path.join(__dirname,'../public/weapon-rig.js'),'utf8'),{createWeaponRig}=await import('data:text/javascript;base64,'+Buffer.from(rigSrc).toString('base64'));
 const parent=new THREE.Group(),gun=new THREE.Group();parent.add(gun);const marine=createArmoredMarine(THREE,parent,0,{textures:false});
 const rig=createWeaponRig(THREE,marine.group,parent,gun,{height:1.72,depth:.4});rig.update({weapon:'rifle',vx:0,vy:0},0,.016);
 const before=new THREE.Box3().setFromObject(marine.group);for(const chain of rig.chains)batchRigidMeshes(THREE,chain.hand);
 const after=new THREE.Box3().setFromObject(marine.group);assert.ok(before.min.distanceTo(after.min)<.00001);assert.ok(before.max.distanceTo(after.max)<.00001);
 let count=0;marine.group.traverse(o=>{if(o.isMesh)count++;});
 assert.ok(count<marine.group.userData.batchStats.before/2,`${count} optimized vs ${marine.group.userData.batchStats.before} original objects`);
 console.log('Marine draw objects:',marine.group.userData.batchStats.before,'->',count);
});
