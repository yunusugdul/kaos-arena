// Two-bone arm constraints are applied AFTER the locomotion mixer each frame.
// Grip sockets belong to the weapon, so walking/recoil/reloading cannot leave it behind.
export function createWeaponRig(THREE, soldier, model, gun,options={}) {
  const V=THREE.Vector3, Q=THREE.Quaternion;
  const bones={};soldier.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
  const chains=['Right','Left'].map(side=>({side,upper:bones[side+'Arm'],lower:bones[side+'ForeArm'],hand:bones[side+'Hand']}));
  if(chains.some(c=>!c.upper||!c.lower||!c.hand))return null;
  const s=new V(),e=new V(),h=new V(),dir=new V(),bend=new V(),elbow=new V(),target=new V(),pole=new V();
  const from=new V(),to=new V(),delta=new Q(),parentQ=new Q(),worldQ=new Q();
  const normal=new V(),finger=new V(),across=new V(),basis=new THREE.Matrix4();
  const desiredQ=new Q(),modelQ=new Q(),inverseFrame=new Q();
  model.updateWorldMatrix(true,true);
  for(const chain of chains){
    const middle=bones[chain.side+'HandMiddle1'],index=bones[chain.side+'HandIndex1'],pinky=bones[chain.side+'HandPinky1'];
    finger.copy(middle.position).normalize();
    across.subVectors(index.position,pinky.position).normalize();
    normal.crossVectors(across,finger).normalize();
    across.crossVectors(finger,normal).normalize();
    basis.makeBasis(across,finger,normal);
    chain.inverseFrame=new Q().setFromRotationMatrix(basis).invert();
    chain.fingers=[];
    for(const [name,bone] of Object.entries(bones)){
      if(!name.startsWith(chain.side+'Hand')||bone===chain.hand||!bone.children.some(o=>o.isBone))continue;
      const child=bone.children.find(o=>o.isBone);
      const palm=normal.clone().applyQuaternion(chain.hand.getWorldQuaternion(new Q()));
      palm.applyQuaternion(bone.getWorldQuaternion(new Q()).invert());
      const axis=new V().crossVectors(child.position.clone().normalize(),palm).normalize();
      chain.fingers.push({bone,rest:bone.quaternion.clone(),axis,angle:name.includes('Thumb')?.28:name.includes('Index')&&chain.side==='Right'?.28:.85});
    }
  }
  function pointBone(bone,child,point){
    bone.getWorldPosition(from);child.getWorldPosition(to);to.sub(from).normalize();
    from.subVectors(point,from).normalize();delta.setFromUnitVectors(to,from);
    bone.getWorldQuaternion(worldQ);worldQ.premultiply(delta);
    bone.parent.getWorldQuaternion(parentQ).invert();bone.quaternion.copy(parentQ.multiply(worldQ));
    bone.updateWorldMatrix(false,false);
  }
  function solve(chain,localTarget,localPole){
    target.copy(localTarget);gun.localToWorld(target);
    pole.copy(localPole);model.localToWorld(pole);
    chain.upper.getWorldPosition(s);chain.lower.getWorldPosition(e);chain.hand.getWorldPosition(h);
    const a=s.distanceTo(e),b=e.distanceTo(h),distance=s.distanceTo(target);
    const d=THREE.MathUtils.clamp(distance,Math.abs(a-b)+.0001,a+b-.0001);
    dir.subVectors(target,s).normalize();
    bend.subVectors(pole,s).addScaledVector(dir,-bend.dot(dir)).normalize();
    const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));
    elbow.copy(s).addScaledVector(dir,along).addScaledVector(bend,height);
    pointBone(chain.upper,chain.lower,elbow);pointBone(chain.lower,chain.hand,target);
    // Orient palms around the pistol grip / fore-end instead of leaving idle wrists dangling.
    finger.set(chain.side==='Right'?0:1,chain.side==='Right'?-1:.08,chain.side==='Right'?.1:0).normalize();
    normal.set(chain.side==='Right'?-1:0,chain.side==='Right'?0:1,0);
    across.crossVectors(finger,normal).normalize();normal.crossVectors(across,finger).normalize();
    basis.makeBasis(across,finger,normal);
    desiredQ.setFromRotationMatrix(basis).multiply(chain.inverseFrame);
    gun.getWorldQuaternion(modelQ);desiredQ.premultiply(modelQ);
    chain.hand.parent.getWorldQuaternion(parentQ).invert();chain.hand.quaternion.copy(parentQ.multiply(desiredQ));
    chain.hand.updateWorldMatrix(false,false);
  }
  const rightGrip=new V(.08,-.10,-.13),leftGrip=new V(),rightPole=new V(.82,1.55,-.20),leftPole=new V(-.78,1.5,.12);
  for(const chain of chains)for(const f of chain.fingers){f.bone.quaternion.copy(f.rest).multiply(delta.setFromAxisAngle(f.axis,f.angle));f.bone.updateMatrix();f.bone.matrixAutoUpdate=false;}
  const magazineTarget=new V(-.18,-.35,.04);
  let reloadTotal=0,lastReload=0;
  return {
    update(p,t,dt){
      const weapon=p.weapon||'pistol',reload=p.reload||0;
      if(reload>lastReload+.05)reloadTotal=reload;
      lastReload=reload;
      const progress=reload>0?1-reload/Math.max(reloadTotal,.01):0;
      const reloadPose=reload>0?Math.sin(Math.PI*THREE.MathUtils.clamp(progress*1.25,0,1)):0;
      const kick=Math.min(.4,p.recoil||0),speed=Math.hypot(p.vx||0,p.vy||0);
      const breath=Math.sin(t*2.3)*.006,step=Math.sin(t*10)*Math.min(1,speed/260)*.008;
      gun.position.set(.10,(options.height??1.91)+breath+step-reloadPose*.05,(options.depth??.10)-kick*.19-reloadPose*.18);
      gun.rotation.set(-kick*.26+reloadPose*.48,0,reloadPose*-.23);
      if(gun.userData.magazine)gun.userData.magazine.position.y=-.17-reloadPose*.22;
      // Length varies along the barrel; wrist sockets are recomputed in its transformed space.
      const length=weapon==='pistol'?.70:weapon==='sniper'?1.24:weapon==='shotgun'?1.06:1;
      gun.scale.set(.53,.53,.53*length);
      if(weapon==='pistol')leftGrip.set(-.16,-.14,-.06);
      else leftGrip.set(-.16,-.17,.25);
      // Support hand reaches the magazine during the middle of a reload, then returns.
      leftGrip.lerp(magazineTarget,reloadPose);
      model.updateWorldMatrix(true,false);
      solve(chains[0],rightGrip,rightPole);solve(chains[1],leftGrip,leftPole);
      return {right:chains[0].hand,left:chains[1].hand};
    },
    // Exposed for numerical grip checks without requiring a WebGL context.
    chains,rightGrip,leftGrip
  };
}
