// Procedural industrial courtyard and human-proportioned tactical soldiers.
// No render objects are attached to network snapshots or gameplay colliders.
export function createNeonWorld(THREE, api) {
  const {stage,world,mesh,block,ring,geometries,lowPower}=api;
  const mats=new Set(),textures=new Map(),geos=new Map(),materialCache=new Map();
  let seed=81451;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  function texture(kind){
    if(textures.has(kind))return textures.get(kind);
    if(typeof document==='undefined'){
      const t=new THREE.DataTexture(new Uint8Array([160,145,125,255]),1,1);t.needsUpdate=true;textures.set(kind,t);return t;
    }
    const c=document.createElement('canvas');c.width=kind==='yard'?2048:512;c.height=kind==='yard'?1152:512;
    const x=c.getContext('2d'),w=c.width,h=c.height;
    if(kind==='wire'){
      x.clearRect(0,0,w,h);x.strokeStyle='#a49e8c';x.lineWidth=10;
      for(const k of [-1,0,1]){x.beginPath();x.moveTo(k*w,0);x.lineTo((k+1)*w,h);x.moveTo(k*w,h);x.lineTo((k+1)*w,0);x.stroke();}
    }else{
      x.fillStyle=kind==='wood'?'#67513a':kind==='cloth'?'#55574b':kind==='concrete'?'#aaa598':kind==='wall'?'#9d9482':kind==='yard'?'#827b70':'#797365';x.fillRect(0,0,w,h);
      for(let i=0;i<(kind==='yard'?38000:9000);i++){
        const a=random(),v=Math.floor(80+random()*140);
        x.fillStyle='rgba('+v+','+(v-6)+','+(v-13)+','+(.025+a*.11)+')';
        const size=1+random()*5;x.fillRect(random()*w,random()*h,size,size*.6);
      }
      x.lineWidth=kind==='wood'?3:1;
      for(let i=0;i<(kind==='wood'?80:150);i++){
        const px=random()*w,py=random()*h;x.strokeStyle=kind==='wood'?'#21180e35':'#29271e40';
        x.beginPath();x.moveTo(px,py);
        for(let j=1;j<5;j++)x.lineTo(px+(random()-.35)*j*14,py+j*(kind==='wood'?40:5));x.stroke();
      }
      for(let i=0;i<35;i++){
        const px=random()*w,py=random()*h,r=10+random()*90,g=x.createRadialGradient(px,py,0,px,py,r);
        g.addColorStop(0,kind==='concrete'?'#25201912':'#25201935');g.addColorStop(1,'#25201900');x.fillStyle=g;x.fillRect(px-r,py-r,r*2,r*2);
      }
      if(kind==='yard'){
        x.strokeStyle='#d0b15970';x.lineWidth=9;x.setLineDash([27,23]);
        x.beginPath();x.ellipse(w/2,h/2,330,330,0,0,Math.PI*2);x.stroke();x.setLineDash([]);
        for(const [px,py,col] of [[.145,.206,'#a0a35e'],[.855,.206,'#c6a256'],[.145,.794,'#6e8d94'],[.855,.794,'#ad7267']]){
          x.strokeStyle=col;x.lineWidth=12;x.beginPath();x.ellipse(px*w,py*h,116,116,0,0,Math.PI*2);x.stroke();
        }
        x.strokeStyle='#d5b76265';x.lineWidth=12;x.strokeRect(35,35,w-70,h-70);
        // Chipped paint: random asphalt flecks cut into the markings.
        for(let i=0;i<9500;i++){x.fillStyle='#59554940';x.fillRect(random()*w,random()*h,1+random()*6,random()*3);}
        x.strokeStyle='#25241c55';x.lineWidth=2;
        for(let px=0;px<w;px+=256){x.beginPath();x.moveTo(px,0);x.lineTo(px,h);x.stroke();}
        for(let py=0;py<h;py+=230){x.beginPath();x.moveTo(0,py);x.lineTo(w,py);x.stroke();}
      }
      if(kind==='wall'){
        x.strokeStyle='#463f3540';x.lineWidth=4;
        for(let py=0;py<h;py+=95){x.beginPath();x.moveTo(0,py);x.lineTo(w,py);x.stroke();
          for(let px=(py%190?50:0);px<w;px+=140){x.beginPath();x.moveTo(px,py);x.lineTo(px,py+95);x.stroke();}}
      }
    }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;textures.set(kind,t);return t;
  }
  function material(color,kind,extra={}){
    const key=JSON.stringify([color,kind,extra]);if(materialCache.has(key))return materialCache.get(key);
    const m=new THREE.MeshStandardMaterial({color,roughness:.91,metalness:0,...extra});
    if(kind){m.map=texture(kind);if(kind!=='wire'){m.bumpMap=m.map;m.bumpScale=.015;}}
    m.userData.neonShared=true;mats.add(m);materialCache.set(key,m);return m;
  }
  const concrete=material('#d4cbb8','concrete'),edgeConcrete=material('#9d9687','wall');
  const rust=material('#74503a','wall',{metalness:.55}),steel=material('#5e605a',null,{metalness:.7,roughness:.75});
  const timber=material('#b3a086','wood'),sand=material('#a99a78','cloth'),rubber=material('#262923',null);
  const hazard=material('#c3a04a',null),black=material('#514c40',null);
  function box(parent,x,y,z,w,h,d,mat,r=.045){
    r=Math.min(r,w/5,h/5,d/5);const key=[w,h,d,r].join('/');
    let geo=geos.get(key);
    if(!geo){
      const a=w/2-r,b=h/2-r,s=new THREE.Shape();s.moveTo(-a,-b);s.lineTo(a,-b);s.lineTo(a,b);s.lineTo(-a,b);s.closePath();
      geo=new THREE.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:1,steps:1});
      geo.translate(0,0,-(d-2*r)/2);geo.userData.neonShared=true;geos.set(key,geo);
    }
    return mesh(geo,mat,parent,x,y,z);
  }
  function tube(parent,a,b,r,mat){
    const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);
    const o=mesh(geometries.cylinder,mat,parent);o.position.copy(av.add(bv).multiplyScalar(.5));
    o.scale.set(r,delta.length(),r);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;
  }
  function crate(parent,x,z,size=.9){
    box(parent,x,size*.5,z,size,size,size,timber);
    for(const sign of [-1,1]){
      box(parent,x+sign*size*.39,size*.51,z,.09,size*.98,size*1.03,timber,.01);
      const brace=box(parent,x,size*.53,z+sign*size*.52,size*.95,.09,.065,timber,.01);brace.rotation.z=.68;
    }
  }
  function barrel(parent,x,z,hex='#766e59'){
    const m=material(hex,'wall',{metalness:.5,roughness:.8});
    mesh(geometries.cylinder,m,parent,x,.64,z,[.43,1.27,.43]);
    for(const y of [.15,.5,1.05,1.26]){const t=mesh(new THREE.TorusGeometry(.435,.026,5,18),steel,parent,x,y,z);t.rotation.x=Math.PI/2;}
  }
  function sandbags(parent,x,z){
    for(let row=0;row<3;row++)for(let col=0;col<4-row;col++){
      const b=mesh(geometries.sphereFine,sand,parent,x+(col-(3-row)/2)*.62,.19+row*.30,z+(row%2)*.09,[.39,.20,.26]);b.rotation.y=(random()-.5)*.2;
    }
  }
  function tree(parent,x,z,height=8){
    const bark=material('#60513c','wood');
    tube(parent,[x,-.1,z],[x+.25,height*.7,z],.22,bark);
    for(let i=0;i<5;i++){const a=i*2.4; tube(parent,[x,height*.4,z],[x+Math.cos(a)*1.7,height*.75,z+Math.sin(a)*1.7],.09,bark);}
    const foliage=material('#a7883b',null);
    const g=new THREE.IcosahedronGeometry(1,2),count=lowPower?24:48,leaves=new THREE.InstancedMesh(g,foliage,count),dummy=new THREE.Object3D();
    for(let i=0;i<count;i++){
      const a=i*2.399,r=1.8*Math.sqrt(random());dummy.position.set(x+Math.cos(a)*r,height*.74+random()*1.9,z+Math.sin(a)*r);
      dummy.scale.set(.65+random()*.7,.45+random()*.5,.65+random()*.7);dummy.rotation.set(random(),random(),random());dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
      leaves.setColorAt(i,new THREE.Color().setHSL(.09+random()*.07,.4,.25+random()*.14));
    }
    leaves.castShadow=true;leaves.receiveShadow=true;parent.add(leaves);
  }
  function neonArena(map){
    seed=81451;
    const ground=mesh(new THREE.PlaneGeometry(180,120),material('#b2a793','wall'),stage,0,-.22,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
    const deck=box(stage,0,-.16,0,40.7,.3,23.1,edgeConcrete,.02);deck.castShadow=false;deck.userData.kind='deck';
    const floor=mesh(new THREE.PlaneGeometry(40,22.48),material('#c3c0b6','yard'),stage,0,.006,0);floor.rotation.x=-Math.PI/2;floor.castShadow=false;floor.userData.kind='floor';
    // Actual cover dimensions are identical to the server's rectangle colliders.
    for(const b of map.blocks){
      const p=world(b.x+b.w/2,b.y+b.h/2),w=b.w/25,d=b.h/25;
      const cover=box(stage,p.x,.74,p.z,w,1.48,d,concrete,.055);cover.userData.kind='cover';
      for(const side of [-1,1]){
        const plate=box(stage,p.x,.23,p.z+side*(d/2+.008),w*.97,.39,.018,black,.003);
        for(let k=-w/2+.19;k<w/2-.12;k+=.46){
          const stripe=box(stage,p.x+k,.23,p.z+side*(d/2+.022),.16,.33,.012,hazard,.003);stripe.rotation.z=-.48;
        }
      }
      for(let k=0;k<5;k++){
        const px=p.x+(random()-.5)*w*.8,pz=p.z+(random()-.5)*d*.8;
        mesh(geometries.sphere,edgeConcrete,stage,px,1.48,pz,[.04+random()*.09,.017,.05]);
      }
    }
    const wire=material('#9f9b88','wire',{alphaTest:.45,side:THREE.DoubleSide,metalness:.65,roughness:.8});
    for(const side of [-1,1]){
      box(stage,0,.45,side*11.65,41.4,.9,.48,edgeConcrete);
      box(stage,side*20.5,.45,0,.48,.9,23.4,edgeConcrete);
      for(const [x,z,w,rot] of [[0,side*11.65,41.4,0],[side*20.5,0,23.4,Math.PI/2]]){
        const geo=new THREE.PlaneGeometry(w,1.5),uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w*1.7,uv.getY(i)*2.5);
        const f=mesh(geo,wire,stage,x,1.67,z);f.rotation.y=rot;f.castShadow=false;
      }
      for(let x=-20;x<=20;x+=4){tube(stage,[x,.8,side*11.65],[x,2.58,side*11.65],.045,steel);}
      for(let z=-11.5;z<=11.6;z+=3.8){tube(stage,[side*20.5,.8,z],[side*20.5,2.58,z],.045,steel);}
      tube(stage,[-20.6,2.5,side*11.65],[20.6,2.5,side*11.65],.035,steel);
      tube(stage,[side*20.5,2.5,-11.65],[side*20.5,2.5,11.65],.035,steel);
    }
    sandbags(stage,-17.8,-10.6);sandbags(stage,17.8,10.7);
    crate(stage,-12.5,-10.6,1.15);crate(stage,18.8,6,1);crate(stage,18.5,4.8,.8);
    crate(stage,-19.2,5.5,.8);crate(stage,-19.2,4.3,1.1);
    barrel(stage,18.6,-10.1);barrel(stage,17.7,-10.4,'#6c7b78');barrel(stage,19.1,-9.3,'#8b6345');
    // Surroundings fill the viewport when its aspect ratio differs from the arena.
    box(stage,0,2.1,-14.7,62,4.5,1.6,concrete,.02);
    const glass=material('#263130',null,{metalness:.3,roughness:.42});
    for(let x=-27;x<=27;x+=5.4){
      box(stage,x,2.55,-13.82,3.7,2.4,.09,glass,.015);
      for(let k=-1.5;k<=1.6;k+=.75)box(stage,x+k,2.55,-13.72,.055,2.5,.05,rust,.005);
      for(const y of [1.4,2.2,3,3.8])box(stage,x,y,-13.7,3.8,.055,.05,rust,.005);
    }
    tube(stage,[-29,1,-13.3],[29,1,-13.3],.24,rust);
    tube(stage,[13,1,-13.3],[13,3.8,-13.3],.26,rust);
    for(const x of [-25,-15,15,25]){crate(stage,x,15.7,1.2);barrel(stage,x+1.7,16);}
    for(const [x,z,h] of [[-25,-9,8],[-25,8,7],[26,-7,9],[25,10,8],[-16,19,7],[17,20,8]])tree(stage,x,z,h);
    const leafMat=material('#a98b48',null),count=lowPower?180:480,leafGeo=new THREE.PlaneGeometry(.12,.065),leaves=new THREE.InstancedMesh(leafGeo,leafMat,count),dummy=new THREE.Object3D();
    for(let i=0;i<count;i++){
      dummy.position.set((random()-.5)*62,.025,(random()-.5)*35);dummy.rotation.set(-Math.PI/2,0,random()*6.28);dummy.scale.setScalar(.6+random()*1.1);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
    }
    leaves.receiveShadow=true;stage.add(leaves);
    for(const f of map.features){
      const p=world(f.x,f.y),hex=f.kind==='ice'?'#b3c2c3':f.kind==='portal'?'#ba9655':'#b2a16f';
      const marker=ring(stage,hex,f.r/25);marker.position.set(p.x,.032,p.z);marker.material.opacity=.32;
      if(f.kind==='bumper')mesh(geometries.cylinder,rubber,stage,p.x,.24,p.z,[f.r/25,.45,f.r/25]);
    }
    return {update(){}};
  }
  function chibi(model,id){
    // Human body ratios, rolled sleeves, plate carrier, webbing and combat boots.
    const uniform=material(['#69694e','#5b6061','#5c685a','#716653'][id],'cloth');
    const vest=material(id%2?'#434741':'#8b7d60','cloth');
    const skin=material('#b28d6d',null,{roughness:.8}),hair=material('#34312a',null);
    const face=material('#3b342c',null),eyes=material('#ddd1b4',null);
    const torso=mesh(geometries.capsule,uniform,model,0,1.62,0,[.83,.69,.48]);
    box(model,0,1.67,.18,.64,.65,.19,vest,.035);
    box(model,0,1.66,-.22,.60,.66,.14,vest,.025);
    box(model,0,1.22,0,.66,.13,.49,rubber,.02);
    for(let i=-1;i<=1;i++){
      box(model,i*.18,1.46,.32,.145,.28,.10,vest,.015);
      box(model,i*.16,1.23,.30,.12,.15,.12,vest,.01);
    }
    const neck=mesh(geometries.cylinder,skin,model,0,2.10,0,[.115,.22,.115]);
    const head=mesh(geometries.sphereFine,skin,model,0,2.35,0,[.205,.275,.205]);
    mesh(geometries.sphere,skin,model,0,2.33,.192,[.065,.09,.075]);
    box(model,0,2.22,.17,.19,.07,.055,skin,.015);
    for(const side of [-1,1]){
      mesh(geometries.sphere,skin,model,side*.202,2.34,0,[.045,.085,.05]);
      mesh(geometries.sphere,eyes,model,side*.077,2.39,.178,[.045,.024,.02]);
      mesh(geometries.sphere,face,model,side*.075,2.39,.195,[.018,.019,.012]);
      const brow=box(model,side*.076,2.43,.185,.096,.018,.025,hair,.004);brow.rotation.z=side*-.09;
    }
    if(id%2){
      mesh(new THREE.SphereGeometry(.235,20,12,0,Math.PI*2,0,Math.PI*.57),uniform,model,0,2.47,-.015);
      const brim=mesh(new THREE.CylinderGeometry(.255,.255,.035,24),uniform,model,0,2.47,.015);
      box(model,0,2.56,.20,.31,.105,.075,rubber,.02);
      for(const side of [-1,1])box(model,side*.078,2.56,.242,.125,.07,.02,face,.01);
    }else{
      mesh(new THREE.SphereGeometry(.211,20,12,0,Math.PI*2,0,Math.PI*.55),hair,model,0,2.47,-.025);
      for(let i=0;i<7;i++){const spike=mesh(geometries.sphere,hair,model,(random()-.5)*.32,2.61,(random()-.5)*.22,[.055,.10,.055]);spike.rotation.z=(random()-.5)*.9;}
    }
    const arms=[],legs=[];
    for(const side of [-1,1]){
      const arm=new THREE.Group();arm.position.set(side*.37,1.91,0);model.add(arm);
      mesh(geometries.capsule,uniform,arm,side*.025,-.18,0,[.28,.34,.28]);
      mesh(geometries.capsule,skin,arm,side*.04,-.48,0,[.20,.32,.20]);
      box(arm,side*.04,-.69,.02,.15,.18,.17,rubber,.025);
      box(arm,side*.02,-.34,0,.23,.09,.24,uniform,.02);arms.push(arm);
      const leg=new THREE.Group();leg.position.set(side*.185,1.15,0);model.add(leg);
      mesh(geometries.capsule,uniform,leg,0,-.26,0,[.33,.58,.33]);
      box(leg,side*.12,-.31,0,.13,.29,.25,uniform,.02);
      mesh(geometries.capsule,uniform,leg,0,-.70,.01,[.28,.43,.28]);
      box(leg,0,-.98,.09,.24,.27,.40,rubber,.025);
      box(leg,0,-1.10,.10,.26,.06,.44,face,.012);legs.push(leg);
    }
    return {arms,legs,tails:[],bodyMaterial:uniform};
  }
  return {neonArena,chibi,dispose(){for(const g of geos.values())g.dispose();for(const m of mats)m.dispose();for(const t of textures.values())t.dispose();geos.clear();mats.clear();textures.clear();}};
}
