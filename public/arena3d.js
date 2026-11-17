// Kaos Arena visual presentation. Physics, scoring and networking are in game.js.
// THREE is installed locally and served by the existing Node web server.
import * as THREE from '/vendor/three.module.js';
import {createArenaDetailKit} from '/arena3d-detail.js';

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
  renderer.toneMappingExposure = 1.20;
  const lowPower = matchMedia('(pointer:coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4;
  const pixelRatio=Math.min(window.devicePixelRatio||1,lowPower?1.05:1.4);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'arena-webgl';
  renderer.domElement.setAttribute('aria-hidden','true');
  shell.insertBefore(renderer.domElement, inputCanvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0d20');
  scene.fog = new THREE.FogExp2('#0b0d20', .011);
  const camera = new THREE.OrthographicCamera(-22,22,12.4,-12.4,.1,170);
  // High-angle orthographic framing restores almost the full 2D arena footprint.
  // Keeping the same 1000 x 562 plane also preserves mouse raycast targeting.
  const CAMERA_HEIGHT=56, CAMERA_DEPTH=16;
  camera.position.set(0,CAMERA_HEIGHT,CAMERA_DEPTH);
  camera.lookAt(0,0,0);
  const hemi = new THREE.HemisphereLight('#edf7ff', '#344052', 1.8);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#fff6e7', 2.4);
  key.position.set(-18,30,11);
  key.castShadow = true;
  key.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  key.shadow.camera.left = -27; key.shadow.camera.right = 27;
  key.shadow.camera.top = 19; key.shadow.camera.bottom = -19;
  key.shadow.camera.near = 1; key.shadow.camera.far = 80;
  key.shadow.bias = -.0003;
  key.shadow.normalBias = .018;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#b7a5ff', 1.25);
  rim.position.set(18,15,-12); scene.add(rim);
  const fill = new THREE.DirectionalLight('#a0dfff',.80);
  fill.position.set(10,8,17);scene.add(fill);

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
    group.traverse(o => { if(o.isMesh && !Object.values(geometries).includes(o.geometry)) o.geometry?.dispose();
      if(o.isMesh) {const mm = Array.isArray(o.material)?o.material:[o.material]; for(const m of mm) if(m && ![arenaFloor,linesMat,wallBody,platformMaterial].includes(m)) m.dispose();}});
    group.clear();
  }
  const detailKit=createArenaDetailKit(THREE,{stage,world,block,mesh,track,ring,geometries,lowPower});
  let stageDetail=null;
  let currentQualityRatio=pixelRatio;
  let classicMapTexture=null;
  function buildClassicMap(map){
    // The established classic arena layouts, backdrops, flat central circle and
    // low-profile solid obstacles. Player/gun models remain full 3D.
    scene.background.set(map.floor).lerp(color('#090c1d'),.33);
    scene.fog.color.copy(scene.background);
    currentQualityRatio=pixelRatio;
    renderer.setPixelRatio(pixelRatio);composer?.setPixelRatio(pixelRatio);
    const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=562;
    const c=canvas.getContext('2d');
    c.fillStyle=map.floor;c.fillRect(0,0,1000,562);
    const grad=c.createRadialGradient(500,281,35,500,281,560);
    grad.addColorStop(0,map.glow+'34');grad.addColorStop(1,'#090b1d');
    c.fillStyle=grad;c.fillRect(0,0,1000,562);
    c.strokeStyle='#d8e4ff0c';c.lineWidth=1;
    for(let x=0;x<=1000;x+=52){c.beginPath();c.moveTo(x,0);c.lineTo(x,562);c.stroke();}
    for(let y=0;y<=562;y+=52){c.beginPath();c.moveTo(0,y);c.lineTo(1000,y);c.stroke();}
    c.strokeStyle=map.glow+'25';c.lineWidth=3;c.setLineDash([12,14]);
    c.beginPath();c.arc(500,281,190,0,Math.PI*2);c.stroke();c.setLineDash([]);
    c.strokeStyle=map.glow+'42';c.lineWidth=4;
    c.strokeRect(23,23,954,516);
    // Low-contrast painted lanes, spawn markings and surface grain. Entirely cosmetic.
    for(const [x,y,hex] of [[155,120,'#c9ff4f'],[845,442,'#ff67cb'],[155,442,'#77ecff'],[845,120,'#ffd17d']]){
      c.strokeStyle=hex+'70';c.lineWidth=3;c.beginPath();c.arc(x,y,48,0,Math.PI*2);c.stroke();
      c.globalAlpha=.3;c.lineWidth=1;c.beginPath();c.arc(x,y,57,0,Math.PI*2);c.stroke();c.globalAlpha=1;
    }
    let seed=map.name.length*1729;
    for(let i=0;i<500;i++){
      seed=(seed*1664525+1013904223)>>>0;const x=30+seed/4294967296*940;
      seed=(seed*1664525+1013904223)>>>0;const y=28+seed/4294967296*503;
      c.fillStyle=i%4===0?'#ffffff0b':'#00000010';c.fillRect(x,y,i%7===0?4:2,1);
    }
    classicMapTexture?.dispose();
    classicMapTexture=new THREE.CanvasTexture(canvas);
    classicMapTexture.colorSpace=THREE.SRGBColorSpace;
    const floor=mesh(new THREE.PlaneGeometry(WIDTH/S,HEIGHT/S),
       basic('#ffffff',{map:classicMapTexture,toneMapped:false}),stage,0,-.02,0);
    floor.rotation.x=-Math.PI/2;floor.castShadow=false;floor.receiveShadow=false;
    const pale=mat('#322d4c',{metalness:.12,roughness:.79});
    const side=mat(map.glow,{metalness:.07,roughness:.63});
    const top=mat('#aaa0c7',{metalness:.03,roughness:.75});
    // Simple shallow soft-edged arena walls that mirror the 2D original.
    for(const [x,z,w,d] of [[0,-11.3,40.6,.27],[0,11.3,40.6,.27],[-20.14,0,.27,23],[20.14,0,.27,23]]){
      block(stage,x,.28,z,w,.52,d,pale);
      track(stage,x,z,w,d,map.glow,.57,.72);
    }
    for(const b of map.blocks){
      const p=world(b.x+b.w/2,b.y+b.h/2),w=b.w/S,d=b.h/S;
      block(stage,p.x,.29,p.z,w,.58,d,pale);
      block(stage,p.x,.60,p.z,w*.95,.08,d*.95,top);
      for(const sign of [-1,1]){
        track(stage,p.x,p.z+sign*(d*.46),w*.80,.05,map.glow,.67,.68);
      }
    }
    for(const feature of map.features){
      const p=world(feature.x,feature.y,.06),radius=feature.r/S;
      if(feature.kind==='portal'){
        const a=ring(stage,map.glow,radius);a.position.set(p.x,.08,p.z);
        const b=ring(stage,'#eabaff',radius*.74);b.position.set(p.x,.12,p.z);
      }else if(feature.kind==='bumper'){
        const circle=mesh(geometries.cylinder,side,stage,p.x,.22,p.z,[radius,.24,radius]);
        circle.castShadow=false;
        const rim=ring(stage,'#fff0b1',radius*.90);rim.position.set(p.x,.48,p.z);
      }else if(feature.kind==='ice'){
        const ice=ring(stage,'#adf6ff',radius);ice.position.set(p.x,.055,p.z);
        ice.material.opacity=.42;
      }
    }
    // Theme-specific peripheral scenery sits OUTSIDE original gameplay bounds.
    // No obstacles or hitboxes are introduced.
    const themes={
      'NEON PARK':['#a58aff','#5e408d'],
      'BUZ LABİRENTİ':['#a6f4ff','#2f7aab'],
      'PORTAL PARTİSİ':['#ff8bdb','#9b4898'],
      'SEK SEK':['#ffd28c','#a76b68'],
      'SON ŞANS':['#d3ff72','#56966f']
    };
    const [highlight,secondary]=themes[map.name]||themes['NEON PARK'];
    const props=[];
    const steel=mat('#2d3452',{metalness:.33,roughness:.53});
    const trim=basic(highlight,{toneMapped:false,transparent:true,opacity:.68,depthWrite:false});
    // Side light-boxes and futuristic arena-broadcast totems.
    for(const x of [-20.50,20.50]){
      for(const z of [-9,-4.5,0,4.5,9]){
        const stem=block(stage,x,.66,z,.24,1.28,.43,steel);
        stem.castShadow=false;
        const signal=block(stage,x,1.25,z,.18,.26,.31,trim);
        signal.castShadow=false;props.push(signal);
      }
    }
    for(const z of [-11.55,11.55])for(const x of [-15,-7.5,0,7.5,15]){
      const marker=block(stage,x,.20,z,1.65,.25,.34,steel);marker.castShadow=false;
      const led=track(stage,x,z,1.50,.065,highlight,.36,.77);
      props.push(led);
    }
    // Ambient decorations are flat or outside bounds to keep the original arena playable.
    if(map.name==='BUZ LABİRENTİ'){
      for(const x of [-20.60,20.60])for(const z of [-11.7,11.7]){
        const crystal=mesh(geometries.crystal,mat('#9beefa',{metalness:.08,roughness:.26,
          emissive:'#255b85',emissiveIntensity:.2}),stage,x,1.05,z,[.4,1.05,.39]);
        crystal.castShadow=false;
      }
    }
    if(map.name==='PORTAL PARTİSİ'){
      for(const x of [-20.65,20.65])for(const z of [-8,8]){
        const portal=ring(stage,'#ff92f0',.8);portal.position.set(x,1.5,z);
        portal.rotation.x=0;props.push(portal);
      }
    }
    return {update(time){for(let i=0;i<props.length;i++){
      if(props[i].material?.opacity!==undefined)
        props[i].material.opacity=.57+.13*Math.sin(time*1.7+i*.65);
    }}};
  }
  function resetMap(map,simple=false) {

    disposeGroup(stage);
    accent=map.glow; lastMap=map.name;
    if(simple){stageDetail=buildClassicMap(map);return;}
    const palette={
      'NEON PARK':'#2d3262','BUZ LABİRENTİ':'#2d718e','PORTAL PARTİSİ':'#513668',
      'SEK SEK':'#674663','SON ŞANS':'#2e6150'
    };
    scene.background.set(palette[map.name]||map.floor).lerp(color('#0b1422'),.36);
    scene.fog.color.copy(scene.background);
    arenaFloor.color.set(palette[map.name]||map.floor);
    // Last Chance has the most expensive frozen floor feature. Keep a smaller back buffer
    // and skip optional bloom for smooth, predictable input/animation frame times.
    currentQualityRatio=map.name==='SON ŞANS'?Math.min(pixelRatio,lowPower?.85:1.05):pixelRatio;
    renderer.setPixelRatio(currentQualityRatio);
    composer?.setPixelRatio(currentQualityRatio);
    const deck=block(stage,0,-.46,0,42.4,.72,24.9,platformMaterial);
    deck.castShadow=false;
    block(stage,0,-.075,0,40.2,.12,22.6,arenaFloor).castShadow=false;
    // The render has depth, but every obstacle footprint is identical to the 2D collider.
    for(let x=-19.6;x<=19.7;x+=1.6)track(stage,x,0,.022,22.48,'#ffffff',-.008,.065);
    for(let z=-10.9;z<=11;z+=1.6)track(stage,0,z,40,.022,'#ffffff',-.008,.065);
    const edge=basic(map.glow,{toneMapped:false});
    for(const [x,z,w,d] of [[0,-11.25,40.4,.1],[0,11.25,40.4,.1],[-20.05,0,.1,22.55],[20.05,0,.1,22.55]])
      track(stage,x,z,w,d,map.glow,.13);
    // Visible 3D guard rails sit outside the actual playable collision boundary.
    for(const [x,z,w,d] of [[0,-11.47,40.9,.28],[0,11.47,40.9,.28],[-20.35,0,.3,23.1],[20.35,0,.3,23.1]]) {
      block(stage,x,.48,z,w,.68,d,wallBody);
      track(stage,x,z,w,d,map.glow,.84);
    }
    // Rounded pads and light columns are decoration outside the playable bounds.
    for(const x of [-20.35,20.35]) for(const z of [-11.47,11.47]) {
      block(stage,x,1.03,z,.72,1.1,.72,wallBody);
      mesh(geometries.sphere,basic(map.glow,{toneMapped:false}),stage,x,1.62,z,[.25,.25,.25]);
    }
    for (const b of map.blocks) {
      const cx=(b.x+b.w/2-500)/S, cz=(b.y+b.h/2-281)/S;
      const w=b.w/S,d=b.h/S;
      // Original collision footprint is retained; the detailed cartoon wall caps this core.
      block(stage,cx,1.2,cz,w,2.4,d,wallBody);
    }
    for(const f of map.features) {
      const q=world(f.x,f.y,.065),radius=f.r/S;
      if(f.kind==='portal') {
        const pad=mesh(geometries.cylinder,mat('#302348',{metalness:.55,roughness:.29}),stage,q.x,.07,q.z,[radius,.07,radius]);
        pad.castShadow=false;
        const a=ring(stage,'#b69bff',radius);a.position.set(q.x,.15,q.z);
        const b=ring(stage,'#ff7dc6',radius*.73);b.position.set(q.x,.18,q.z);
        // Keep Three.js mesh references out of the game's JSON-serialized map.
      } else if(f.kind==='bumper') {
        mesh(geometries.cylinder,mat('#ba7d48',{metalness:.55}),stage,q.x,.22,q.z,[radius,.43,radius]);
        const rim=ring(stage,'#ffdd87',radius*1.06);rim.position.set(q.x,.48,q.z);
        mesh(geometries.sphere,basic('#ffe4a3',{toneMapped:false}),stage,q.x,.54,q.z,[.25,.25,.25]);
      } else if(f.kind==='ice') {
        // An inexpensive ground decal, not a giant translucent 3D cylinder.
        const rr=ring(stage,'#bdfbff',radius);rr.position.set(q.x,.04,q.z);rr.material.opacity=.5;
      }
    }
    // Subtle arena landmark at the centre, stays below the playing surface.
    const center=ring(stage,map.glow,6.9);center.position.y=.03;center.material.opacity=.16;
    stageDetail=detailKit.build(map);
  }

  function makeHuman(hex,name,id) {
    const root = new THREE.Group(); scene.add(root);
    const model=new THREE.Group();root.add(model);
    const suit=mat(['#c9ff1f','#ff43ac','#52dfff','#ffbe46'][id]||'#c9ff1f',{metalness:.04,roughness:.53,emissive:['#94c800','#e91e77','#0c93b3','#bd6411'][id]||'#94c800',emissiveIntensity:.76});
    const suitDark=mat(['#45a947','#e24d97','#318da5','#c18032'][id]||'#45a947',{metalness:.04,roughness:.6,emissive:['#2b8423','#ae2a70','#15547d','#955117'][id]||'#2b8423',emissiveIntensity:.32});
    const skin=mat(['#f1bd98','#edb08b','#f5bd92','#bf8c68'][id]||'#f1bd98',{roughness:.82,metalness:0});
    const hair=mat(id===0?'#242136':'#30253a',{roughness:.87,metalness:0});
    const bright=basic(hex,{toneMapped:false});
    // Humanoid: head, torso, both arms and legs - all narrower than the original collision diameter.
    mesh(geometries.capsule,suit,model,0,1.34,0,[.96,1.08,.66]);
    block(model,0,1.17,.35,.72,.23,.12,suitDark);
    mesh(geometries.sphere,skin,model,0,2.20,.03,[.31,.32,.31]);
    mesh(geometries.sphere,hair,model,0,2.43,-.05,[.33,.17,.32]);
    for(const side of [-1,1]) {
      mesh(geometries.sphere,hair,model,side*.15,2.23,.334,[.038,.043,.025]);
    }
    const arms=[],legs=[];
    for(const side of [-1,1]) {
      const arm=new THREE.Group(); arm.position.set(side*.53,1.73,0);model.add(arm);
      mesh(geometries.capsule,suitDark,arm,side*.13,-.3,0,[.4,.7,.42]);
      mesh(geometries.sphere,skin,arm,side*.24,-.68,.07,[.17,.17,.17]);
      arms.push(arm);
      const leg=new THREE.Group();leg.position.set(side*.24,.95,0);model.add(leg);
      mesh(geometries.capsule,suitDark,leg,0,-.37,0,[.55,.79,.54]);
      mesh(geometries.box,hair,leg,0,-.77,.14,[.4,.22,.66]);
      legs.push(leg);
    }
    const emblem=mesh(geometries.sphere,bright,model,0,1.42,.46,[.15,.15,.045]);
    emblem.castShadow=false;
    const shadow=mesh(new THREE.CircleGeometry(.95,24),basic('#000000',{transparent:true,opacity:.26,depthWrite:false}),root,0,.01,0);
    shadow.rotation.x=-Math.PI/2; shadow.castShadow=false;
    const a=ring(root,hex,1.12);a.position.y=.07;a.material.opacity=1;
    const baseDisc=mesh(new THREE.CylinderGeometry(.98,.98,.10,24),basic(hex,{toneMapped:false}),root,0,.035,0);
    baseDisc.castShadow=false;baseDisc.material.transparent=true;baseDisc.material.opacity=.47;
    const carry=ring(root,'#ffbd64',1.31);carry.position.y=.09;
    const defense=ring(root,'#72efff',1.55);defense.position.y=.17;
    const charge=ring(root,'#e3ff65',1.46);charge.position.y=.13;
    // High detail combat suit without changing the old 21px physical collision radius.
    const alloy=mat(id===0?'#293d3b':'#433048',{metalness:.68,roughness:.28});
    const trim=mat(['#daff46','#ff6dbb','#7df9ff','#ffd471'][id]||'#daff46',{metalness:.25,roughness:.36,
      emissive:['#aaff3d','#ff48a9','#49dcff','#ffc64e'][id]||'#aaff3d',emissiveIntensity:1.55});
    block(model,0,1.47,.44,.78,.47,.17,alloy);
    block(model,0,1.50,.54,.43,.09,.057,trim);
    for(const side of [-1,1]) {
      mesh(geometries.sphere,alloy,model,side*.58,1.75,0,[.30,.25,.31]);
      block(model,side*.28,.92,.36,.14,.20,.08,trim);
      block(model,side*.25,.50,.23,.32,.28,.48,alloy);
      mesh(geometries.sphere,trim,model,side*.53,1.06,.12,[.14,.15,.20]);
    }
    mesh(geometries.sphere,alloy,model,0,2.48,-.02,[.39,.23,.39]);
    const visor=mesh(geometries.sphere,mat('#78dbff',{metalness:.75,roughness:.12,
      emissive:id===0?'#266777':'#74418a',emissiveIntensity:.58}),model,0,2.24,.26,[.29,.12,.15]);
    visor.castShadow=false;
    block(model,0,1.05,-.36,.62,.43,.21,alloy);
    block(model,0,1.13,-.49,.34,.075,.08,trim);
    // Distinctive chunky sci-fi blaster gripped with both hands.
    // Gun faces local +Z, the player's aim rotates the whole character.
    const gun=new THREE.Group();gun.position.set(0,1.46,.47);model.add(gun);
    const gunDark=mat('#141c2b',{roughness:.41,metalness:.55});
    const gunSteel=mat('#67788f',{roughness:.33,metalness:.57});
    const gunColor=basic(id===0?'#caff55':'#ff72bd',{toneMapped:false});
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
    const muzzle=mesh(new THREE.ConeGeometry(.27,.70,8),basic('#ffe27a',{
      transparent:true,opacity:.86,depthWrite:false,toneMapped:false}),gun,0,-.03,1.55);
    muzzle.rotation.x=Math.PI/2;muzzle.visible=false;muzzle.castShadow=false;
    const hpRoot=new THREE.Group();scene.add(hpRoot);
    const hpBack=block(hpRoot,0,0,-.02,2.42,.33,.10,basic('#0c1328',{toneMapped:false}));
    hpBack.castShadow=false;
    const hpFill=block(hpRoot,0,0,.07,2.21,.20,.09,basic(hex,{toneMapped:false}));
    hpFill.castShadow=false;
    return {root,model,arms,legs,a,carry,defense,charge,gun,muzzle,hpRoot,hpFill,prevX:null,prevZ:null};
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
    o.root.rotation.y=Math.atan2((facing?.x||0),(facing?.y||1));
    o.hpRoot.visible=!!g.shooter&&!p.dead;
    if(o.hpRoot.visible){
      o.hpRoot.position.set(o.root.position.x,3.15,o.root.position.z);
      o.hpRoot.quaternion.copy(camera.quaternion);
      const pct=clamp((p.hp??100)/100,0,1);
      o.hpFill.scale.x=2.21*pct;
      o.hpFill.position.x=-1.105*(1-pct);
      o.hpFill.material.color.set(pct<.35?'#ff526b':p.color);
    }
    o.gun.visible=!!g.shooter;
    if(g.shooter){
      const weapon=p.weapon||'pistol';
      o.gun.scale.set(weapon==='shotgun'?1.18:weapon==='sniper'?.82:weapon==='rifle'?.90:1,
                      weapon==='shotgun'?1.14:1,
                      weapon==='pistol'?.75:weapon==='rifle'?1.27:weapon==='sniper'?1.56:1.20);
      o.gun.position.z=.47-(p.recoil||0)*.9;
      o.muzzle.visible=p.muzzle>0;
    }

    const moving=Math.hypot(p.vx||0,p.vy||0)>24;
    const run=moving?Math.min(1,Math.hypot(p.vx,p.vy)/260):0;
    const phase=t*12+(p.id*2);
    o.model.position.y=(moving?Math.abs(Math.sin(phase))*.10:.035*Math.sin(t*3+p.id));
    o.model.rotation.z=p.dashTime>0?-.28*Math.sin(phase):.025*Math.sin(t*2+p.id);
    for(let i=0;i<2;i++) {
      const side=i===0?-1:1;
      o.legs[i].rotation.x=Math.sin(phase+i*Math.PI)*.68*run;
      o.arms[i].rotation.x=g.shooter?-.87:-Math.sin(phase+i*Math.PI)*.62*run;
      o.arms[i].rotation.z=g.shooter?side*.28:side*.13;
    }
    const holding=g.holder===p.id;
    o.carry.visible=holding;
    o.carry.material.opacity=.58+Math.sin(t*10)*.23;
    o.carry.scale.setScalar(1+.04*Math.sin(t*9));
    o.defense.visible=p.shieldTime>0||p.parryTime>0;
    o.defense.material.color.set(p.parryTime>0?'#78eeff':'#efffa7');
    o.defense.rotation.z=t*1.5;
    o.charge.visible=!!(p.charging&&holding&&g.bomb.mode==='held');
    if(o.charge.visible){o.charge.material.opacity=.25+clamp(p.charge/.85,0,1)*.7;o.charge.rotation.z=t*2;}
    o.a.material.opacity=p.dashTime>0?.95:.30;
    o.a.scale.setScalar(p.dashTime>0?1.4:1);
    o.model.children[0].material.emissive?.set(g.shooter&&p.hitFlash>0?'#ff3a42':p.stun>0?'#285775':
      ['#94c800','#e91e77','#0c93b3','#bd6411'][p.id]||'#a0d512');
    if(g.shooter&&g.victoryId===p.id){o.model.rotation.y=t*3;o.model.position.y=.38+Math.abs(Math.sin(t*9))*.28;
      o.arms[0].rotation.z=-1.2;o.arms[1].rotation.z=1.2;}
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
  if(!lowPower){
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
      pipeline.addPass(new bp.UnrealBloomPass(new THREE.Vector2(1,1),.22,.30,.92));
      pipeline.addPass(new op.OutputPass());
      pipeline.setSize(Math.max(1,cachedW),Math.max(1,cachedH));
      composer=pipeline;
    }).catch(error=>console.info('Optional Three.js bloom unavailable:',error));
  }
  let lastFrame=performance.now();
  let cachedW=0,cachedH=0;
  function resize(){
    const w=Math.max(1,inputCanvas.clientWidth),h=Math.max(1,inputCanvas.clientHeight);
    if(w===cachedW&&h===cachedH)return;
    cachedW=w;cachedH=h;
    renderer.setSize(w,h,false);
    composer?.setSize(w,h);
    // Fit the same logical arena regardless of actual screen shape.
    const aspect=w/h;
    const visibleW=Math.max(44,24.75*aspect);
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
          o.position.copy(world(b.x,b.y,1.35));
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
      if(composer&&g.map.name!=='SON ŞANS')composer.render();else renderer.render(scene,camera);
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
    if(composer&&g.map.name!=='SON ŞANS')composer.render();else renderer.render(scene,camera);
  }
  function dispose(){
    composer?.dispose();detailKit.dispose();classicMapTexture?.dispose();snowTexture.dispose();snowGeometry.dispose();
    shotGeometry.dispose();shotMaterial.dispose();
    for(const human of humans){human.hpRoot.traverse(o=>{if(o.isMesh){o.geometry?.dispose();o.material?.dispose();}});}
    renderer.dispose();renderer.domElement.remove();
    disposeGroup(stage);scene.clear();
  }
  return {draw,pointer,dispose};
}
