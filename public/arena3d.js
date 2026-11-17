// Kaos Arena visual presentation. Physics, scoring and networking are in game.js.
// THREE is installed locally and served by the existing Node web server.
import * as THREE from '/vendor/three.module.js';
import {createArenaDetailKit} from '/arena3d-detail.js';
import {createNeonWorld} from '/neon-world.js';
import {createArmoredMarine} from '/armored-marine.js';
import {createWeaponRig} from '/weapon-rig.js';
import {batchRigidMeshes} from '/render-batch.js';

const S = 25, WIDTH = 1000, HEIGHT = 562;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const world = (x, y, h = 0) => new THREE.Vector3((x - WIDTH / 2) / S, h, (y - HEIGHT / 2) / S);
const color = hex => new THREE.Color(hex);
const mat = (hex, opts = {}) => new THREE.MeshStandardMaterial({color: hex, roughness: .48, metalness: .14, ...opts});
const basic = (hex, opts = {}) => new THREE.MeshBasicMaterial({color: hex, ...opts});

export function createArena3D(inputCanvas) {
  const shell = inputCanvas.parentElement;
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, powerPreference:'high-performance'});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const lowPower = matchMedia('(pointer:coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4;
  const pixelRatio=Math.min(window.devicePixelRatio||1,lowPower?.85:1);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.className = 'arena-webgl';
  renderer.domElement.dataset.engine='three-industrial';
  renderer.domElement.setAttribute('aria-hidden','true');
  shell.insertBefore(renderer.domElement, inputCanvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b6aa91');
  scene.fog = new THREE.FogExp2('#b6aa91', .003);
  const camera = new THREE.OrthographicCamera(-22,22,12.4,-12.4,.1,170);
  // High-angle orthographic framing restores almost the full 2D arena footprint.
  // Keeping the same 1000 x 562 plane also preserves mouse raycast targeting.
  const CAMERA_HEIGHT=48, CAMERA_DEPTH=32;
  camera.position.set(0,CAMERA_HEIGHT,CAMERA_DEPTH);
  camera.lookAt(0,0,0);
  const hemi = new THREE.HemisphereLight('#e0e8ed', '#675944', 2.0);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#ffe2ad', 3.2);
  key.position.set(-18,27,-15);
  key.castShadow = true;
  key.shadow.mapSize.set(1024,1024);
  key.shadow.camera.left = -27; key.shadow.camera.right = 27;
  key.shadow.camera.top = 19; key.shadow.camera.bottom = -19;
  key.shadow.camera.near = 1; key.shadow.camera.far = 80;
  key.shadow.bias = -.0003;
  key.shadow.normalBias = .018;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#bdd2e0', .48);
  rim.position.set(18,15,-12); scene.add(rim);
  const fill = new THREE.DirectionalLight('#e8d7b6',.45);
  fill.position.set(10,8,17);scene.add(fill);

  
  const studio=new THREE.Scene();studio.background=new THREE.Color('#a6a6a1');
  for(const [x,y,z,w,h,hex] of [[-6,7,3,7,9,'#e9f3ff'],[6,5,-4,4,7,'#b3c5ce'],[0,9,0,5,5,'#ffffff']]){
    const card=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:hex,side:THREE.DoubleSide}));
    card.position.set(x,y,z);card.lookAt(0,0,0);studio.add(card);
  }
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,0);
  scene.environment=environment.texture;pmrem.dispose();
  studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});

  const stage = new THREE.Group(); scene.add(stage);
  const effects = new THREE.Group(); scene.add(effects);
  let lastMap = null;
  let accent = '#a591ff';
  const arenaFloor = mat('#456481',{roughness:.91,metalness:0});
  const linesMat = basic('#a997ff',{transparent:true,opacity:.12,depthWrite:false});
  const wallBody = mat('#51466e',{metalness:.08,roughness:.6});
  const platformMaterial = mat('#363454',{metalness:.1,roughness:.68});
  const geometries = {
    sphere:new THREE.SphereGeometry(1,16,12),
    sphereFine:new THREE.SphereGeometry(1,24,16),
    box:new THREE.BoxGeometry(1,1,1),
    cylinder:new THREE.CylinderGeometry(1,1,1,16),
    torus:new THREE.TorusGeometry(1,.04,8,64),
    torusWide:new THREE.TorusGeometry(1,.09,8,64),
    crystal:new THREE.OctahedronGeometry(1,0),
    capsule:new THREE.CapsuleGeometry(.45,.6,5,10)
  };
  function mesh(geo, material, parent, x=0, y=0, z=0, scale) {
    const m = new THREE.Mesh(geo,material);
    m.position.set(x,y,z);
    if (scale) m.scale.set(...scale);
    m.castShadow = !!(geo !== geometries.torus && geo !== geometries.torusWide);
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function block(parent,x,y,z,w,h,d,material) {
    return mesh(geometries.box,material,parent,x,y,z,[w,h,d]);
  }
  function track(parent,x,z,w,d,hex,height=.055,opacity=1) {
    const segment=block(parent,x,height,z,w,.055,d,basic(hex,{toneMapped:false,transparent:opacity<1,opacity,depthWrite:opacity===1}));
    segment.castShadow=false;segment.receiveShadow=false;return segment;
  }
  function ring(parent,hex,radius=1) {
    const m=mesh(geometries.torus,basic(hex,{transparent:true,opacity:.85,depthWrite:false,toneMapped:false}),parent);
    m.rotation.x=-Math.PI/2; m.scale.setScalar(radius); m.castShadow=false;
    return m;
  }
  function disposeGroup(group) {
    group.traverse(o => { if(o.isInstancedMesh)o.dispose();
      if(o.isMesh && !o.geometry.userData.neonShared && !Object.values(geometries).includes(o.geometry)) o.geometry?.dispose();
      if(o.isMesh) {const mm = Array.isArray(o.material)?o.material:[o.material]; for(const m of mm) if(m && !m.userData.neonShared && ![arenaFloor,linesMat,wallBody,platformMaterial].includes(m)) m.dispose();}});
    group.clear();
  }
  const detailKit=createArenaDetailKit(THREE,{stage,world,block,mesh,track,ring,geometries,lowPower});
  const neonWorld=createNeonWorld(THREE,{stage,world,mesh,block,ring,geometries,lowPower});
  let stageDetail=null;
  let currentQualityRatio=pixelRatio;
  let classicMapTexture=null;
  function resetMap(map) {
    disposeGroup(stage);
    accent=map.glow;lastMap=map.name;
    scene.background.set('#b6aa91');scene.fog.color.copy(scene.background);
    renderer.setPixelRatio(currentQualityRatio);composer?.setPixelRatio(currentQualityRatio);
    stageDetail=neonWorld.neonArena(map);
    batchRigidMeshes(THREE,stage);
    stage.updateWorldMatrix(true,true);
    stage.traverse(o=>{o.matrixAutoUpdate=false;o.matrixWorldAutoUpdate=false;});
    renderer.shadowMap.needsUpdate=true;
  }

  function makeHuman(hex,name,id) {
    const root = new THREE.Group(); scene.add(root);
    const model=new THREE.Group();root.add(model);
    const armor=createArmoredMarine(THREE,model,id);
    const {arms,legs}=armor;const tails=[];
    const shadow=mesh(new THREE.CircleGeometry(.95,24),basic('#000000',{transparent:true,opacity:.26,depthWrite:false}),root,0,.01,0);
    shadow.rotation.x=-Math.PI/2; shadow.castShadow=false;
    const a=ring(root,id%2?'#bb8168':'#b3b681',.72);a.position.y=.025;a.material.opacity=.35;
    const baseDisc=mesh(new THREE.CylinderGeometry(.98,.98,.10,24),basic(hex,{toneMapped:false}),root,0,.035,0);
    baseDisc.castShadow=false;baseDisc.material.transparent=true;baseDisc.material.opacity=.025;
    const carry=ring(root,'#ffbd64',1.31);carry.position.y=.09;
    const defense=ring(root,'#72efff',1.55);defense.position.y=.17;
    const charge=ring(root,'#e3ff65',1.46);charge.position.y=.13;
    // Distinctive chunky sci-fi blaster gripped with both hands.
    // Gun faces local +Z, the player's aim rotates the whole character.
    const gun=new THREE.Group();gun.position.set(0,1.46,.47);model.add(gun);
    const gunDark=mat('#141c2b',{roughness:.41,metalness:.55});
    const gunSteel=mat('#67788f',{roughness:.33,metalness:.57});
    const gunColor=new THREE.MeshPhysicalMaterial({color:id%2?'#c71523':'#075cf2',roughness:.30,metalness:.45,clearcoat:.35});
    block(gun,0,0,.29,.43,.35,.70,gunDark);
    block(gun,0,.18,.07,.55,.11,.55,gunSteel);
    const receiver=mesh(geometries.box,gunColor,gun,0,.215,.40,[.25,.045,.34]);
    receiver.castShadow=false;
    const barrel=mesh(new THREE.CylinderGeometry(.13,.16,.86,12),gunSteel,gun,0,-.025,.86);
    barrel.rotation.x=Math.PI/2;
    const bore=mesh(new THREE.CylinderGeometry(.085,.085,.065,14),gunDark,gun,0,-.025,1.31);
    bore.rotation.x=Math.PI/2;
    block(gun,0,-.27,.04,.20,.47,.25,gunDark);
    block(gun,0,.36,.25,.18,.16,.30,gunDark);
    const magazine=block(gun,0,-.17,.31,.27,.23,.22,gunSteel);
    magazine.rotation.x=-.16;
    gun.userData.magazine=magazine;
    for(let i=0;i<3;i++){
      const stripe=block(gun,.222,.03,.18+i*.15,.015,.18,.065,basic(id%2?'#eee2c9':'#ff9b17'));
      stripe.rotation.x=-.35;
    }
    const muzzle=mesh(new THREE.ConeGeometry(.27,.70,8),basic('#ffe27a',{
      transparent:true,opacity:.86,depthWrite:false,toneMapped:false}),gun,0,-.03,1.55);
    muzzle.rotation.x=Math.PI/2;muzzle.visible=false;muzzle.castShadow=false;
    const hpRoot=new THREE.Group();scene.add(hpRoot);
    const hpBack=block(hpRoot,0,0,-.02,2.42,.33,.10,basic('#0c1328',{toneMapped:false}));
    hpBack.castShadow=false;
    const hpFill=block(hpRoot,0,0,.07,2.21,.20,.09,basic(hex,{toneMapped:false}));
    hpFill.castShadow=false;
    const weaponRig=createWeaponRig(THREE,armor.group,model,gun,{height:1.72,depth:.40});
    weaponRig.update({weapon:'pistol',vx:0,vy:0},0,0);
    for(const chain of weaponRig.chains)batchRigidMeshes(THREE,chain.hand);
    return {root,model,arms,legs,tails,armor,weaponRig,a,carry,defense,charge,gun,muzzle,hpRoot,hpFill,prevX:null,prevZ:null};
  }
  const humans=[makeHuman('#baff22','SEN',0),makeHuman('#ff3fa9','RAKİP',1),
    makeHuman('#73e9ff','OYUNCU 3',2),makeHuman('#ffc969','OYUNCU 4',3)];

  function updateHuman(o,p,g,t,dt) {
    const target=world(p.x,p.y);
    if (o.prevX===null || Math.hypot(target.x-o.root.position.x,target.z-o.root.position.z)>5) o.root.position.copy(target);
    else o.root.position.lerp(target,clamp(dt*22,.1,1));
    o.prevX=target.x;o.prevZ=target.z;
    o.root.visible=!g.shooter||!p.dead;
    const facing=g.shooter?(p.aim||p.face):p.face;
    o.root.rotation.y=Math.atan2((facing?.x??0),(facing?.y??1));
    o.hpRoot.visible=!!g.shooter&&!p.dead;
    if(o.hpRoot.visible){
      o.hpRoot.position.set(o.root.position.x,3.15,o.root.position.z);
      o.hpRoot.quaternion.copy(camera.quaternion);
      const pct=clamp((p.hp??100)/100,0,1);
      o.hpFill.scale.x=2.21*pct;
      o.hpFill.position.x=-1.105*(1-pct);
      o.hpFill.material.color.set(pct<.35?'#af5d49':p.id%2?'#c39b83':'#bcc798');
    }
    o.gun.visible=!!g.shooter;
    if(g.shooter){
      const weapon=p.weapon||'pistol';
      o.gun.scale.set(weapon==='shotgun'?1.18:weapon==='sniper'?.82:weapon==='rifle'?.90:1,
                      weapon==='shotgun'?1.14:1,
                      weapon==='pistol'?.75:weapon==='rifle'?1.27:weapon==='sniper'?1.56:1.20);
      o.gun.scale.multiplyScalar(.65);
      o.gun.position.z=.47-(p.recoil||0)*.9;
      o.muzzle.visible=p.muzzle>0;
    }

    const moving=Math.hypot(p.vx||0,p.vy||0)>24;
    const run=moving?Math.min(1,Math.hypot(p.vx,p.vy)/260):0;
    if(o.mixer){
      o.mixer.update(dt);
      const target=moving?(p.dashTime>0?'run':'walk'):'idle';
      for(const [name,action] of Object.entries(o.animationActions)){
        const weight=name.includes(target)?1:0;
        action.setEffectiveWeight(THREE.MathUtils.lerp(action.getEffectiveWeight(),weight,Math.min(1,dt*12)));
      }
    }
    const phase=t*12+(p.id*2);
    o.model.position.y=0;o.model.rotation.set(0,0,0);
    o.armor?.animate(p,t,dt);
    if(!o.armor)for(let i=0;i<2;i++) {
      const side=i===0?-1:1;
      o.legs[i].rotation.x=Math.sin(phase+i*Math.PI)*.68*run;
      o.arms[i].rotation.x=g.shooter?-.87:-Math.sin(phase+i*Math.PI)*.62*run;
      o.arms[i].rotation.z=g.shooter?side*.28:side*.13;
    }
    o.tails.forEach((tail,i)=>{tail.rotation.y=.3+Math.sin(t*7+i)*(.08+run*.2);});
    if(g.shooter)o.weaponRig?.update(p,t,dt);
    const holding=!g.shooter&&g.holder===p.id;
    o.carry.visible=holding;
    o.carry.material.opacity=.58+Math.sin(t*10)*.23;
    o.carry.scale.setScalar(1+.04*Math.sin(t*9));
    o.defense.visible=p.shieldTime>0||p.parryTime>0;
    o.defense.material.color.set(p.parryTime>0?'#78eeff':'#efffa7');
    o.defense.rotation.z=t*1.5;
    o.charge.visible=!!(p.charging&&holding&&g.bomb.mode==='held');
    if(o.charge.visible){o.charge.material.opacity=.25+clamp(p.charge/.85,0,1)*.7;o.charge.rotation.z=t*2;}
    o.a.material.opacity=p.dashTime>0?.95:.30;
    o.a.scale.setScalar(p.dashTime>0?1.15:1);
    for(const material of o.armor?.materials||[]){
      if(material.emissiveIntensity>1)continue;
      material.emissive.set(p.hitFlash>0?'#ff6255':'#000000');
      material.emissiveIntensity=p.hitFlash>0?.22:0;
    }
    if(g.shooter&&g.victoryId===p.id){o.model.rotation.y=t*3;o.model.position.y=.38+Math.abs(Math.sin(t*9))*.28;
      }
    // Character names remain exclusively in the existing scoreboard.
  }
  // Recognizable hand-fused bomb: layered forged metal, warning badge, cap and live wick.
  const bomb=new THREE.Group();scene.add(bomb);
  const shellMat=basic('#141620',{toneMapped:false});
  const rimMat=mat('#8999b9',{metalness:.18,roughness:.43});
  const yellow=basic('#ffc248',{toneMapped:false});
  mesh(geometries.sphereFine,shellMat,bomb,0,0,0,[.59,.59,.59]);
  // No flashing white highlight: the bomb has a matte black body and steady orange fuse.
  const topBand=mesh(new THREE.TorusGeometry(.52,.048,8,32),rimMat,bomb,0,.26,0);
  topBand.rotation.x=-Math.PI/2;
  const baseBand=mesh(new THREE.TorusGeometry(.51,.032,8,32),yellow,bomb,0,-.27,0);
  baseBand.rotation.x=-Math.PI/2;
  for(let k=0;k<10;k++){
    const a=k*Math.PI*2/10;
    const riv=mesh(geometries.sphere,rimMat,bomb,Math.cos(a)*.56,.02,Math.sin(a)*.56,[.04,.04,.04]);
    riv.castShadow=false;
  }
  mesh(geometries.cylinder,rimMat,bomb,0,.57,0,[.23,.17,.23]);
  mesh(geometries.cylinder,shellMat,bomb,0,.71,0,[.18,.06,.18]);
  const fusePath=new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,.73,0),
    new THREE.Vector3(.06,.86,.04),
    new THREE.Vector3(.15,1.00,.01),
    new THREE.Vector3(.20,1.10,-.08)
  ]);
  mesh(new THREE.TubeGeometry(fusePath,14,.075,8,false),mat('#ceb38d',{roughness:.95,metalness:0}),bomb);
  const hotWick=mesh(geometries.sphere,basic('#ff9f28',{toneMapped:false}),bomb,.20,1.10,-.08,[.09,.09,.09]);
  hotWick.castShadow=false;
  const fuseHalo=new THREE.PointLight('#ff9a37',2.0,3,2);fuseHalo.position.set(.20,1.09,-.08);bomb.add(fuseHalo);
  const spark=hotWick;
  const fuseSparks=[];
  for(let i=0;i<5;i++){
    const dot=mesh(geometries.crystal,basic('#ff7a19',{toneMapped:false}),bomb,.20,1.10,-.08,[.020,.045,.020]);
    dot.castShadow=false;fuseSparks.push(dot);
  }
  // Gold warning seal on the camera-facing side of the shell.
  const badge=mesh(geometries.cylinder,yellow,bomb,0,.015,.575,[.19,.031,.19]);
  badge.rotation.x=Math.PI/2;
  block(bomb,0,-.01,.61,.065,.22,.03,shellMat);
  block(bomb,0,-.19,.615,.065,.07,.025,shellMat);
  const blastLight=new THREE.PointLight('#ffbb69',.7,4,2);bomb.add(blastLight);
  const trail=Array.from({length:20},()=> {
    const v=mesh(geometries.sphere,basic('#ffbc5c',{transparent:true,opacity:.6,depthWrite:false,toneMapped:false}),effects,0,0,0,[.3,.3,.3]);
    v.visible=false;v.castShadow=false;return v;
  });
  const ripple=Array.from({length:36},()=>{const m=ring(effects,'#fff0ac');m.visible=false;return m;});
  const debris=Array.from({length:160},()=>{const m=mesh(geometries.box,basic('#ffffff',{transparent:true,opacity:1,depthWrite:false,toneMapped:false}),effects);m.visible=false;m.castShadow=false;return m;});
  // Snow patches use one shared light-weight illustrated texture, not transparent cylinders.
  // Three large footprints at most; snow damage remains in the 2D physics layer.
  const snowCanvas=document.createElement('canvas');snowCanvas.width=256;snowCanvas.height=256;
  const snowCtx=snowCanvas.getContext('2d');
  const frostGradient=snowCtx.createRadialGradient(128,128,5,128,128,127);
  frostGradient.addColorStop(0,'rgba(245,253,255,.97)');
  frostGradient.addColorStop(.57,'rgba(202,245,255,.87)');
  frostGradient.addColorStop(.83,'rgba(131,220,243,.52)');
  frostGradient.addColorStop(1,'rgba(95,207,237,0)');
  snowCtx.fillStyle=frostGradient;snowCtx.fillRect(0,0,256,256);
  for(let i=0;i<95;i++){
    const x=128+Math.cos(i*2.4)*(10+(i*37)%98),y=128+Math.sin(i*2.4)*(10+(i*37)%98);
    snowCtx.fillStyle=i%4===0?'rgba(255,255,255,.8)':'rgba(244,254,255,.38)';
    snowCtx.fillRect(x,y,2+(i%4),1+(i%3));
  }
  const snowTexture=new THREE.CanvasTexture(snowCanvas);snowTexture.colorSpace=THREE.SRGBColorSpace;
  const snowGeometry=new THREE.PlaneGeometry(2,2);
  const snow=Array.from({length:3},()=>{
    const material=basic('#ffffff',{map:snowTexture,transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
    const meshObj=mesh(snowGeometry,material,effects);meshObj.rotation.x=-Math.PI/2;
    meshObj.visible=false;meshObj.castShadow=false;return meshObj;
  });
  const snowRings=Array.from({length:3},()=>{const o=ring(effects,'#d4faff');o.visible=false;return o;});
  // Round-ending visual-only burst: show the explosion before any selection overlay.
  const explosionFX=new THREE.Group();scene.add(explosionFX);explosionFX.visible=false;
  const blastCore=mesh(geometries.sphereFine,basic('#ffcd5e',{transparent:true,opacity:.68,depthWrite:false,toneMapped:false}),explosionFX,0,.85,0);
  blastCore.castShadow=false;
  const blastRing=ring(explosionFX,'#ffed9d',1);blastRing.position.y=.11;
  const innerBlast=ring(explosionFX,'#ff6a9c',1);innerBlast.position.y=.15;
  // Independent identifiable 3D pickups. Labels belong to items only, never players.
  const bonus=new THREE.Group();scene.add(bonus);
  const pickupModels={};
  const pickupStyles={
    shield:{title:'KALKAN',color:'#64c7ff'},
    frost:{title:'DONDUR',color:'#86f2ff'},
    blink:{title:'IŞINLAN',color:'#c2a0ff'}
  };
  function pickupLabel(word,hex) {
    const c=document.createElement('canvas');c.width=512;c.height=128;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#10152de8';ctx.beginPath();ctx.roundRect(13,17,486,92,25);ctx.fill();
    ctx.strokeStyle=hex;ctx.lineWidth=6;ctx.stroke();
    ctx.fillStyle='#f7fcff';ctx.font='900 52px Arial,sans-serif';
    ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillText(word,256,65);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true}));
    sprite.position.y=2.72;sprite.scale.set(2.75,.68,1);return sprite;
  }
  function pickupBase(group,hex) {
    const pedestal=mesh(geometries.cylinder,mat('#20243a',{metalness:.64,roughness:.34}),group,0,.13,0,[.89,.13,.89]);
    pedestal.castShadow=false;
    const halo=ring(group,hex,.86);halo.position.y=.28;
    const halo2=ring(group,'#f8ffff',.69);halo2.position.y=.31;halo2.material.opacity=.42;
    for(let n=0;n<8;n++){
      const a=n*Math.PI/4;
      const pip=mesh(geometries.box,basic(hex,{toneMapped:false}),group,
       Math.cos(a)*.72,.30,Math.sin(a)*.72,[.13,.06,.13]);
      pip.rotation.y=a;pip.castShadow=false;
    }
    return {halo,halo2};
  }
  for(const [type,style] of Object.entries(pickupStyles)){
    const group=new THREE.Group();group.visible=false;bonus.add(group);
    const {halo,halo2}=pickupBase(group,style.color);
    const float=new THREE.Group();group.add(float);
    const glow=mesh(geometries.sphere,basic(style.color,{
      transparent:true,opacity:.15,depthWrite:false}),float,0,1.1,0,[.85,.85,.85]);
    glow.castShadow=false;
    if(type==='shield'){
      const makeShield=(scale,z,material)=>{
        const sh=new THREE.Shape();
        sh.moveTo(0,.70);sh.lineTo(.51,.52);sh.lineTo(.47,-.05);
        sh.quadraticCurveTo(.37,-.48,0,-.74);
        sh.quadraticCurveTo(-.37,-.48,-.47,-.05);
        sh.lineTo(-.51,.52);sh.closePath();
        const geo=new THREE.ExtrudeGeometry(sh,{depth:.09,bevelEnabled:true,
          bevelThickness:.058,bevelSize:.045,bevelSegments:2,steps:1});
        return mesh(geo,material,float,0,1.26,z,[scale,scale,scale]);
      };
      makeShield(.88,0,mat('#2a4b70',{metalness:.64,roughness:.28}));
      makeShield(.66,.15,mat('#7bdcff',{metalness:.26,roughness:.16,emissive:'#167db8',emissiveIntensity:1.0}));
      block(float,0,1.33,.30,.12,.62,.08,basic('#f6ffff'));
      block(float,0,1.33,.30,.48,.12,.08,basic('#f6ffff'));
    }else if(type==='frost'){
      for(let n=0;n<7;n++){
        const a=n*Math.PI*2/7,r=n===0?0:.25;
        const shard=mesh(new THREE.ConeGeometry(n===0?.33:.20,n===0?1.54:.88,5),
          mat(n===0?'#d1fbff':'#7bdbff',{metalness:.05,roughness:.12,
            transparent:true,opacity:.91,emissive:'#16738e',emissiveIntensity:.58}),
          float,Math.cos(a)*r,1.11,Math.sin(a)*r);
        shard.rotation.z=n===0?0:Math.sin(a)*.27;
      }
      for(let j=0;j<6;j++){
        const a=j*Math.PI/3;
        const spoke=mesh(geometries.box,basic('#d6fdff',{toneMapped:false}),float,
          Math.sin(a)*.35,1.17,Math.cos(a)*.35,[.08,.08,.51]);
        spoke.rotation.y=a;
      }
    }else{
      mesh(geometries.sphereFine,mat('#c8aaff',{
        metalness:.12,roughness:.12,emissive:'#7047da',emissiveIntensity:2}),float,0,1.16,0,[.40,.40,.40]);
      for(let n=0;n<3;n++){
        const orbit=mesh(new THREE.TorusGeometry(.66,.065,7,48),basic(n===0?'#e6dbff':'#ae83ff'),float,0,1.17,0);
        orbit.rotation.set(Math.PI*n/3,Math.PI*(n+1)/4,n*.55);
      }
      for(const a of [0,Math.PI]){
        mesh(geometries.crystal,basic('#fce9ff'),float,Math.cos(a)*.65,1.15,Math.sin(a)*.65,[.13,.21,.13]);
      }
    }
    group.add(pickupLabel(style.title,style.color));
    pickupModels[type]={group,float,halo,halo2,style};
  }
  // Pooled bullet meshes: no allocations in the animation loop.
  const shotGeometry=new THREE.CylinderGeometry(.17,.17,.95,8);
  const shotMaterial=mat('#fff0a6',{metalness:.12,roughness:.24,
    emissive:'#ffbb47',emissiveIntensity:2.6});
  const shooterShots=Array.from({length:42},()=>{
    const projectile=mesh(shotGeometry,shotMaterial,effects);
    projectile.castShadow=false;projectile.visible=false;return projectile;
  });
  const shotAxis=new THREE.Vector3(0,1,0),shotDir=new THREE.Vector3();
  // Pooled power-up presentation: clear silhouettes/hovering markers, no gameplay colliders.
  const buffRoot=new THREE.Group();scene.add(buffRoot);buffRoot.visible=false;
  const buffStyles={heal:{color:'#8eff9a',title:'CAN'},speed:{color:'#ffe680',title:'HIZ'},
    shield:{color:'#85e6ff',title:'KALKAN'},boost:{color:'#ffb073',title:'HASAR'}};
  const buffs={};
  for(const [kind,style] of Object.entries(buffStyles)){
    const group=new THREE.Group();buffRoot.add(group);group.visible=false;
    const pad=mesh(geometries.cylinder,mat('#242a44',{metalness:.4,roughness:.62}),
      group,0,.12,0,[.77,.13,.77]);pad.castShadow=false;
    const halo=ring(group,style.color,.72);halo.position.y=.23;
    const orb=new THREE.Group();group.add(orb);
    const material=basic(style.color,{toneMapped:false});
    if(kind==='heal'){
      block(orb,0,1.1,0,.27,1.05,.33,material);
      block(orb,0,1.1,0,1.05,.27,.33,material);
    }else if(kind==='speed'){
      const bolt=mesh(geometries.crystal,material,orb,0,1.12,0,[.34,.74,.39]);
      bolt.rotation.z=-.30;
      block(orb,.19,.80,.06,.24,.60,.23,material).rotation.z=.46;
    }else if(kind==='shield'){
      mesh(geometries.crystal,material,orb,0,1.15,0,[.53,.68,.36]);
      const band=ring(orb,'#dffaff',.52);band.position.y=1.13;band.rotation.z=.3;
    }else{
      mesh(geometries.sphereFine,material,orb,0,1.14,0,[.46,.46,.46]);
      for(let i=0;i<4;i++){
        const shard=mesh(geometries.crystal,material,orb,Math.cos(i*Math.PI/2)*.57,1.14,
          Math.sin(i*Math.PI/2)*.57,[.16,.25,.16]);shard.rotation.y=i;
      }
    }
    group.add(pickupLabel(style.title,style.color));
    buffs[kind]={group,orb,halo};
  }
  const elimination=new THREE.Group();scene.add(elimination);elimination.visible=false;
  const elimSphere=mesh(geometries.sphereFine,basic('#ffda77',{transparent:true,opacity:.8,depthWrite:false}),elimination,0,.95,0);
  elimSphere.castShadow=false;
  const elimRing=ring(elimination,'#fff0ac');elimRing.position.y=.09;
  const elimRays=[];
  for(let i=0;i<14;i++){
    const ray=mesh(geometries.crystal,basic(i%2?'#fff2b6':'#ffa763',{toneMapped:false}),
     elimination,0,.5,0,[.12,.4,.12]);ray.castShadow=false;elimRays.push(ray);
  }
  const impactFX=ring(scene,'#fff1d4');impactFX.visible=false;impactFX.position.y=.15;
  const guide = new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),5,'#d8ff52',.6,.28);
  scene.add(guide); guide.visible=false;
  const raycaster=new THREE.Raycaster();
  const pointerPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  // Optional desktop post-processing. Mobile retains a single fast render pass.
  // If a browser cannot load an addon, standard Three.js rendering keeps the game playable.
  let composer=null;
  if(false){
    Promise.all([
      import('/vendor/addons/postprocessing/EffectComposer.js'),
      import('/vendor/addons/postprocessing/RenderPass.js'),
      import('/vendor/addons/postprocessing/UnrealBloomPass.js'),
      import('/vendor/addons/postprocessing/OutputPass.js')
    ]).then(([ec,rp,bp,op])=>{
      if(!renderer.domElement.isConnected)return;
      const pipeline=new ec.EffectComposer(renderer);
      pipeline.setPixelRatio(pixelRatio);
      pipeline.addPass(new rp.RenderPass(scene,camera));
      pipeline.addPass(new bp.UnrealBloomPass(new THREE.Vector2(1,1),.40,.38,1.05));
      pipeline.addPass(new op.OutputPass());
      pipeline.setSize(Math.max(1,cachedW),Math.max(1,cachedH));
      composer=pipeline;
    }).catch(error=>console.info('Optional Three.js bloom unavailable:',error));
  }
  let lastFrame=performance.now();
  let lastShadow=0,performanceStart=0,performanceFrames=0,totalRenderMs=0,performanceReports=0;
  const performanceBadge=document.createElement('output');performanceBadge.className='performance-hud';performanceBadge.setAttribute('aria-label','Oyun performansı');performanceBadge.textContent='FPS —';shell.append(performanceBadge);
  function renderScene(now){
    if(now-lastShadow>=1000/30){renderer.shadowMap.needsUpdate=true;lastShadow=now;}
    const begin=performance.now();renderer.render(scene,camera);totalRenderMs+=performance.now()-begin;
    if(!performanceStart)performanceStart=now;
    performanceFrames++;
    if(now-performanceStart>=1000){
      const fps=performanceFrames*1000/(now-performanceStart),cpu=totalRenderMs/performanceFrames;
      performanceBadge.textContent=Math.round(fps)+' FPS';
      inputCanvas.dataset.fps=fps.toFixed(1);inputCanvas.dataset.renderMs=cpu.toFixed(2);inputCanvas.dataset.drawCalls=String(renderer.info.render.calls);inputCanvas.dataset.triangles=String(renderer.info.render.triangles);
      // Scale only when rendering itself exceeds the high-refresh budget.
      if(++performanceReports>2&&cpu>6&&currentQualityRatio>.70){currentQualityRatio=Math.max(.70,currentQualityRatio*.9);renderer.setPixelRatio(currentQualityRatio);renderer.setSize(cachedW,cachedH,false);}
      performanceFrames=0;performanceStart=now;totalRenderMs=0;
    }
  }
  let cachedW=0,cachedH=0;
  function resize(){
    const w=Math.max(1,inputCanvas.clientWidth),h=Math.max(1,inputCanvas.clientHeight);
    if(w===cachedW&&h===cachedH)return;
    cachedW=w;cachedH=h;
    renderer.setSize(w,h,false);
    composer?.setSize(w,h);
    // Fit the same logical arena regardless of actual screen shape.
    const aspect=w/h;
    const visibleW=Math.max(43.2,25.5*aspect);
    const visibleH=visibleW/aspect;
    camera.left=-visibleW/2;camera.right=visibleW/2;
    camera.top=visibleH/2;camera.bottom=-visibleH/2;
    camera.updateProjectionMatrix();
  }
  function pointer(e) {
    resize();
    const box=inputCanvas.getBoundingClientRect();
    const nx=((e.clientX-box.left)/box.width)*2-1;
    const ny=-((e.clientY-box.top)/box.height)*2+1;
    raycaster.setFromCamera(new THREE.Vector2(nx,ny),camera);
    const hit=new THREE.Vector3();
    if(raycaster.ray.intersectPlane(pointerPlane,hit))
      return {x:clamp(hit.x*S+WIDTH/2,0,WIDTH),y:clamp(hit.z*S+HEIGHT/2,0,HEIGHT)};
    return null;
  }
  function draw(g,t,particles,rings,shake=0,viewSlot=0) {
    resize();
    // Guest snapshots contain a fresh JSON map object every 33 ms: compare the map name.
    if(g.map.name!==lastMap)resetMap(g.map,!!g.shooter);
    stageDetail?.update(t);
    const now=performance.now(),dt=Math.min(.07,(now-lastFrame)/1000);lastFrame=now;
    // Camera shake only changes presentation, never the targeting plane or simulation.
    const cameraSlot=g.shooter?Math.max(0,Math.min(g.players.length-1,viewSlot)):0;
    const self=g.players[cameraSlot];
    const localRecoil=g.shooter?(self?.recoil||0)+(self?.hitFlash||0)*.35:0;
    const cameraJitter=(shake>0?.055*Math.min(6,shake):0)+localRecoil*.12;
    camera.position.set(Math.sin(t*41)*cameraJitter,CAMERA_HEIGHT,CAMERA_DEPTH+Math.cos(t*35)*cameraJitter);
    camera.lookAt(0,0,0);
    for(let i=0;i<humans.length;i++){
      if(i<g.players.length)updateHuman(humans[i],g.players[i],g,t,dt);
      else{humans[i].root.visible=false;humans[i].hpRoot.visible=false;}
    }
    if(g.shooter){
      bomb.visible=false;guide.visible=false;bonus.visible=false;explosionFX.visible=false;
      buffRoot.visible=!!g.powerup;
      for(const [type,pick] of Object.entries(buffs))pick.group.visible=type===g.powerup?.type;
      if(g.powerup){
        buffRoot.position.copy(world(g.powerup.x,g.powerup.y));
        const picked=buffs[g.powerup.type];
        if(picked){picked.orb.rotation.y=t*1.6;picked.orb.position.y=Math.sin(t*4)*.14;
          picked.halo.material.opacity=.6+.26*Math.sin(t*5);}
      }
      elimination.visible=!!g.eliminationFx;
      if(g.eliminationFx){
        const fx=g.eliminationFx,age=1.4-fx.t,progress=clamp(age/1.4,0,1);
        elimination.position.copy(world(fx.x,fx.y));
        elimSphere.scale.setScalar(.25+progress*2.1);elimSphere.material.opacity=(1-progress)*.85;
        elimRing.scale.setScalar(1+progress*4);elimRing.material.opacity=(1-progress);
        for(let i=0;i<elimRays.length;i++){
          const angle=i*Math.PI*2/elimRays.length+age*.6;
          const o=elimRays[i],radius=.5+progress*2.9;
          o.position.set(Math.cos(angle)*radius,.42+Math.sin(age*6+i)*.2,Math.sin(angle)*radius);
          o.rotation.y=angle;o.scale.setScalar(.55*(1-progress));
        }
      }
      impactFX.visible=!!g.hitFx;
      if(g.hitFx){const fx=g.hitFx;impactFX.position.copy(world(fx.x,fx.y,.24));
        impactFX.scale.setScalar(1+(1-fx.t/.28)*1.5);
        impactFX.material.color.set(fx.color);impactFX.material.opacity=clamp(fx.t/.28,0,1);}

      for(const v of trail)v.visible=false;
      for(let i=0;i<shooterShots.length;i++){
        const b=g.bullets?.[i],o=shooterShots[i];
        o.visible=!!b;
        if(o.visible){
          o.position.copy(world(b.x,b.y,1.70));
          shotDir.set(b.vx,0,b.vy).normalize();
          o.quaternion.setFromUnitVectors(shotAxis,shotDir);
        }
      }
      for(let i=0;i<ripple.length;i++){
        const r=rings[i],o=ripple[i];o.visible=!!r;
        if(o.visible){o.position.copy(world(r.x,r.y,.18));o.scale.setScalar(r.r/S);
          o.material.color.set(r.color);o.material.opacity=clamp(r.t/r.life,0,1);}
      }
      for(let i=0;i<debris.length;i++){
        const p=particles[i],o=debris[i];o.visible=!!p;
        if(o.visible){o.position.copy(world(p.x,p.y,.28));const q=clamp(p.size/S,.055,.22);
          o.scale.set(q,q,q);o.material.color.set(p.col);o.material.opacity=clamp(p.t/p.max,0,1);}
      }
      for(let i=0;i<snow.length;i++){
        const p=g.snowPatches?.[i],o=snow[i],r=snowRings[i];
        o.visible=r.visible=!!p&&g.map.name==='BUZ LABİRENTİ';
        if(o.visible){o.position.copy(world(p.x,p.y,.065));o.scale.setScalar(p.r/S);
          o.material.opacity=clamp(p.t/.9,0,.95);
          r.position.copy(world(p.x,p.y,.08));r.scale.setScalar(p.r/S*.92);r.material.opacity=.5;}
      }
      renderScene(now);
      return;
    }
    bomb.visible=true;buffRoot.visible=false;elimination.visible=false;impactFX.visible=false;
    for(const o of shooterShots)o.visible=false;
    const bp=world(g.bomb.x,g.bomb.y,1.0+(g.bomb.mode==='flying'?.38:0));
    bomb.position.copy(bp);bomb.rotation.y=t*2;
    bomb.scale.setScalar(g.bomb.mode==='held'?.72:.93);
    spark.scale.setScalar(1); // the fuse remains steady; no white pulse
    for(let i=0;i<fuseSparks.length;i++){
      const a=t*18+i*6.283185307/5,r=.12+.06*Math.sin(t*11+i);
      const q=fuseSparks[i];q.position.set(.20+Math.cos(a)*r,1.11+Math.abs(Math.sin(a*1.4))*.12,-.08+Math.sin(a)*r);
      q.scale.setScalar(.025);q.rotation.y=t*9+i;
    }
    blastLight.intensity=.55;
    fuseHalo.intensity=.65;
    for(let i=0;i<trail.length;i++){
      const p=g.bomb.trail?.[i],o=trail[i];o.visible=!!p&&g.bomb.mode==='flying';
      if(o.visible){o.position.copy(world(p.x,p.y,.58));o.scale.setScalar(clamp(p.t/.32,.03,1)*.25);o.material.opacity=clamp(p.t/.32,0,.75);}
    }
    for(let i=0;i<ripple.length;i++){
      const r=rings[i],o=ripple[i];o.visible=!!r;
      if(o.visible){o.position.copy(world(r.x,r.y,.18));o.scale.setScalar(r.r/S);o.material.color.set(r.color);o.material.opacity=clamp(r.t/r.life,0,1);}
    }
    for(let i=0;i<debris.length;i++){
      const p=particles[i],o=debris[i];o.visible=!!p;
      if(o.visible){o.position.copy(world(p.x,p.y,.25+Math.abs(p.vy)*.001));const sc=clamp(p.size/S,.055,.24);o.scale.set(sc,sc,sc);o.rotation.set(t*4+i,t*3,t*2);o.material.color.set(p.col);o.material.opacity=clamp(p.t/p.max,0,1);}
    }
    for(let i=0;i<snow.length;i++){
      const p=g.snowPatches?.[i],o=snow[i],r=snowRings[i];o.visible=r.visible=!!p&&g.map.name==='BUZ LABİRENTİ';
      if(o.visible){o.position.copy(world(p.x,p.y,.065));o.scale.setScalar(p.r/S);
        o.material.opacity=clamp(p.t/.9,0,.95)*clamp((p.max-p.t)/.35,0,1);
        r.position.copy(world(p.x,p.y,.08));r.scale.setScalar(p.r/S*.92);r.material.opacity=clamp(p.t/.8,0,.50);}
    }
    explosionFX.visible=g.phase==='explode'&&g.phaseTime>1.30;
    if(explosionFX.visible){
      const age=2.35-g.phaseTime,ratio=clamp(age/.92,0,1),loser=g.players[g.roundLoser??g.holder];
      explosionFX.position.copy(world(loser.x,loser.y));
      blastCore.scale.setScalar(1.1+ratio*2.3);blastCore.material.opacity=.7*(1-ratio);
      blastRing.scale.setScalar(.7+ratio*6);blastRing.material.opacity=1-ratio;
      innerBlast.scale.setScalar(.5+ratio*3.5);innerBlast.material.opacity=.85*(1-ratio);
    }
    bonus.visible=!!g.card;
    if(bonus.visible){
      bonus.position.copy(world(g.card.x,g.card.y));
      for(const [type,obj] of Object.entries(pickupModels)){
        obj.group.visible=type===g.card.type;
        if(obj.group.visible){
          obj.float.position.y=Math.sin(t*3.5)*.12;
          obj.float.rotation.y=t*.8;
          obj.halo.rotation.z=t*.55;
          obj.halo.material.opacity=.55+.2*Math.sin(t*5);
          obj.halo2.material.opacity=.2+.14*Math.sin(t*6);
        }
      }
    }
    guide.visible=false;
    if(g.phase==='active'&&g.bomb.mode==='held'){
      const p=g.players[g.holder];
      if(p.charging&&p.aim) {
        const aim=new THREE.Vector3(p.aim.x,0,p.aim.y).normalize(),len=(80+180*clamp(p.charge/.85,0,1))/S;
        guide.position.copy(world(p.x,p.y,.18));guide.setDirection(aim);guide.setLength(len,.55,.26);
        guide.setColor(p.charge>.8?'#ff83c9':'#d8ff52');guide.visible=true;
      }
    }
    renderScene(now);
  }
  function dispose(){
    for(const pass of composer?.passes||[])pass.dispose?.();
    composer?.dispose();detailKit.dispose();classicMapTexture?.dispose();environment.dispose();
    const gs=new Set(),ms=new Set(),ts=new Set();
    scene.traverse(o=>{
      if(o.isInstancedMesh)o.dispose();
      if(o.geometry)gs.add(o.geometry);
      for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m){
        ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);
      }
    });
    for(const g of gs)g.dispose();for(const m of ms)m.dispose();for(const t of ts)t.dispose();
    for(const human of humans)if(human.mixer){human.mixer.stopAllAction();human.mixer.uncacheRoot(human.soldier);}
    neonWorld.dispose();renderer.dispose();renderer.domElement.remove();performanceBadge.remove();scene.clear();
  }
  return {draw,pointer,dispose};
}

