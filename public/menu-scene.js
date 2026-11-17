import * as THREE from '/vendor/three.module.js';
import {batchRigidMeshes} from '/render-batch.js';

// Camp rendering is independent of the menu buttons and audio.
const canvas=document.getElementById('heroArena');
let renderer,scene,camera,actors=[],last=0,renderCount=0,firstFrame=0;
const pointer={x:0,y:0},reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
window.addEventListener('pointermove',e=>{pointer.x=e.clientX/innerWidth-.5;pointer.y=e.clientY/innerHeight-.5;},{passive:true});
try{
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
 scene=new THREE.Scene();scene.background=new THREE.Color('#b8d9d6');scene.fog=new THREE.Fog('#b8d9d6',30,72);
 camera=new THREE.PerspectiveCamera(43,1,.1,120);
 scene.add(new THREE.HemisphereLight('#e5f5ff','#577049',2.2));
 const sun=new THREE.DirectionalLight('#fff0c5',3.4);sun.position.set(-7,15,9);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-18,right:18,top:16,bottom:-14,near:1,far:45});sun.shadow.normalBias=.04;scene.add(sun);
 const fill=new THREE.DirectionalLight('#bfddf0',.7);fill.position.set(8,7,-5);scene.add(fill);
 const camp=new THREE.Group();scene.add(camp);
 const mats=new Map();function material(hex,roughness=.8,metalness=0){const key=hex+'/'+roughness+'/'+metalness;if(!mats.has(key))mats.set(key,new THREE.MeshStandardMaterial({color:hex,roughness,metalness}));return mats.get(key);}
 const boxGeo=new THREE.BoxGeometry(1,1,1),cylinderGeo=new THREE.CylinderGeometry(1,1,1,10),coneGeo=new THREE.ConeGeometry(1,1,7),sphereGeo=new THREE.IcosahedronGeometry(1,1);
 function shape(geo,p,x,y,z,sx,sy,sz,hex,metal=0){const m=new THREE.Mesh(geo,material(hex,.76,metal));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=m.receiveShadow=true;p.add(m);return m;}
 function box(p,x,y,z,w,h,d,c,m=0){return shape(boxGeo,p,x,y,z,w,h,d,c,m);}
 function tube(p,a,b,r,color){const d=new THREE.Vector3().subVectors(b,a),o=shape(cylinderGeo,p,0,0,0,r,d.length(),r,color);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;}
 // Soft rolling ground, a paved route through warm timber-and-metal warehouses.
 const ground=box(camp,0,-.23,0,130,.42,110,'#6b8756');ground.castShadow=false;
 box(camp,-1,-.015,3.5,8,.08,22,'#a7a080');
 for(let row=0;row<18;row++)for(let col=0;col<5;col++){const p=box(camp,-4.15+col*1.5+(row%2)*.2,.045,-7+row*1.2,1.4,.10,1.10,['#afa88a','#b7ac8d','#a29c7e'][(row+col)%3]);p.rotation.y=.025*Math.sin(row+col);}
 function warehouse(x,z,w,h,d,roof){
  const g=new THREE.Group();g.position.set(x,0,z);camp.add(g);
  box(g,0,h/2,0,w,h,d,'#d9bc8c');box(g,0,.19,0,w+.25,.38,d+.25,'#787d66');
  const ridge=h+.7,angle=Math.atan2(.85,w/2),slope=Math.hypot(w/2,.85);
  for(const side of [-1,1]){const r=box(g,side*w/4,h+.43,0,slope+.32,.20,d+.85,roof,.25);r.rotation.z=-side*angle;
   for(let k=0;k<8;k++){const rib=box(g,side*w/4,h+.55,-d/2+k*d/7,slope+.27,.045,.035,'#8faaa4',.4);rib.rotation.z=-side*angle;}}
  box(g,0,ridge+.02,0,.20,.18,d+.95,'#576853');
  for(const side of [-1,1]){box(g,side*(w/2-.08),h/2,d/2+.025,.15,h,.18,'#644e37');box(g,side*w*.3,1.8,d/2+.05,.9,1.25,.07,'#40594e');box(g,side*w*.3,1.8,d/2+.10,.73,1.06,.05,'#e1bb70');box(g,side*w*.3,1.8,d/2+.15,.06,1.1,.04,'#59634b');box(g,side*w*.3,1.8,d/2+.15,.8,.06,.04,'#59634b');}
  box(g,0,1.1,d/2+.06,1.3,2.2,.12,'#4c5b45');box(g,.34,1.1,d/2+.14,.035,.035,.035,'#d2b477',.6);
  box(g,0,h-.28,d/2+.11,w,.18,.2,'#6f5940');
  const chimney=shape(cylinderGeo,g,w*.28,h+.9,-d*.2,.17,1.25,.17,'#64766d',.4);box(g,w*.28,h+1.55,-d*.2,.55,.08,.5,'#4f6059');
  return g;
 }
 warehouse(-6,-3,6.3,3.4,5,'#416b75');warehouse(1.5,-7,5.3,4.2,4.7,'#567b70');warehouse(-12,-10,5.5,4.4,6,'#466575');warehouse(9,-8,6,3.2,5,'#4c7375');
 // Timber gates, stacked supply crates, sandbags and team pennants.
 function crate(x,y,z,size=1){box(camp,x,y+size/2,z,size,size,size,'#8b784f');for(const s of [-1,1]){box(camp,x+s*size*.43,y+size/2,z+size*.51,.09,size,.055,'#c0a56f');box(camp,x,y+size*.5+s*size*.4,z+size*.51,size,.08,.06,'#c0a56f');}}
 for(const [x,y,z,s] of [[-4,0,1,1.1],[-5.2,0,1,1],[-4.7,1.05,1,.85],[4,0,-1,1.1],[5.3,0,-1,1.2],[4.9,1.1,-1,1]])crate(x,y,z,s);
 for(let n=0;n<12;n++)box(camp,-7+n%4*.7,.23+Math.floor(n/4)*.38,3,.8,.39,.55,'#9a9a70');
 for(const [x,z,color] of [[-4,-6,'#2663ab'],[4,-5,'#a9473e']]){shape(cylinderGeo,camp,x,2.5,z,.055,5,.055,'#8a7954');const flag=box(camp,x+.60,4.2,z,1.2,.68,.035,color);flag.rotation.y=-.18;box(camp,x+.6,4.2,z+.023,.08,.52,.02,'#e3c489');}
 function pine(x,z,h){shape(cylinderGeo,camp,x,h*.32,z,.19,h*.65,.19,'#6e573b');for(let k=0;k<3;k++)shape(coneGeo,camp,x,h*(.40+k*.19),z,h*(.32-k*.055),h*.55,h*(.32-k*.055),['#476b42','#537949','#658954'][k]);}
 for(const [x,z,h] of [[-10,2,5.5],[-13,5,6],[-9,-6,5.8],[5,0,5.2],[11,3,7],[15,-3,6],[-18,-13,8],[0,-14,7],[10,-17,8]])pine(x,z,h);
 // Low-poly wooded hills keep the horizon close to the provided reference.
 for(let i=0;i<10;i++){const h=6+(i%3)*2;const hill=shape(sphereGeo,camp,-30+i*7,h*.22,-24-(i%2)*6,8,h,7,i%2?'#7a9e83':'#8eaf96');hill.castShadow=false;}
 for(const side of [-1,1]){const x=side<0?-7:7;for(let j=0;j<4;j++){shape(cylinderGeo,camp,x,1,6-j*1.5,.08,2,.08,'#6b6244');}for(const y of [.55,1.25])box(camp,x,y,3.7,.11,.12,6.6,'#88794f');}
 batchRigidMeshes(THREE,camp);camp.updateWorldMatrix(true,true);camp.traverse(o=>{o.matrixAutoUpdate=false;o.matrixWorldAutoUpdate=false;});
 function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.set(w<h?10:12,7.1,w<h?21:15);camera.lookAt(-1.8,1.35,0);camera.updateProjectionMatrix();renderer.shadowMap.needsUpdate=true;}
 window.addEventListener('resize',resize,{passive:true});resize();renderer.shadowMap.needsUpdate=true;
 renderer.render(scene,camera);firstFrame=performance.now();canvas.parentElement.classList.add('ready');canvas.dataset.readyMs=Math.round(firstFrame).toString();
 // Details load AFTER the first camp frame; the menu never waits for a full match.
 Promise.all([import('/armored-marine.js'),import('/weapon-rig.js')]).then(([marine,rig])=>{
  for(let id=0;id<2;id++){
   const root=new THREE.Group();root.position.set(id?.4:-2.8,.04,id?2.3:5.0);root.rotation.y=id?-.3:.4;root.scale.setScalar(id?.94:1.15);scene.add(root);
   const model=new THREE.Group();root.add(model);const armor=marine.createArmoredMarine(THREE,model,id);
   const gun=new THREE.Group();model.add(gun);const dark='#28343c',paint=id?'#b7202d':'#125bd8';
   box(gun,0,0,.28,.4,.30,.72,paint,.35);box(gun,0,-.26,.02,.17,.40,.24,dark);box(gun,0,-.19,.30,.25,.3,.24,dark);box(gun,0,.20,.24,.19,.12,.31,dark);
   const barrel=shape(cylinderGeo,gun,0,0,.93,.095,.72,.095,'#75858a',.65);barrel.rotation.x=Math.PI/2;
   const weaponRig=rig.createWeaponRig(THREE,armor.group,model,gun,{height:1.72,depth:.4});weaponRig.update({weapon:'rifle',vx:0,vy:0},0,0);for(const chain of weaponRig.chains)batchRigidMeshes(THREE,chain.hand);
   actors.push({armor,weaponRig});
  }
  renderer.shadowMap.needsUpdate=true;renderer.compileAsync?.(scene,camera).catch(()=>{});
 }).catch(e=>console.warn('Camp character detail unavailable:',e));
 function frame(ms){
  if(!document.hidden&&!document.body.classList.contains('is-playing')&&ms-last>=(reduced?200:1000/30)){
   const dt=Math.min(.1,(ms-last)/1000||.033);last=ms;
   if(!reduced){camera.position.x=THREE.MathUtils.damp(camera.position.x,(camera.aspect<1?10:12)+pointer.x*.55,3,dt);camera.lookAt(-1.8+pointer.x*.12,1.35-pointer.y*.06,0);}
   for(const a of actors){const p={weapon:'rifle',vx:0,vy:0};a.armor.animate(p,ms/1000,dt);a.weaponRig.update(p,ms/1000,dt);}
   renderer.render(scene,camera);renderCount++;
   if(renderCount%30===0){canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.triangles=String(renderer.info.render.triangles);}
  }
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}catch(error){console.warn('3D camp unavailable; menu remains usable.',error);document.getElementById('menuStatus').textContent='KARARGÂH';}
