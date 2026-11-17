import {RoundedBoxGeometry} from '/vendor/addons/geometries/RoundedBoxGeometry.js';
import {batchArticulated} from '/render-batch.js';

// Original articulated 3D geometry built from the supplied armor references.
// Front is +Z; the hands, elbow chains and weapon all share this coordinate frame.
export function createArmoredMarine(THREE,parent,id,{textures=true}={}){
 const group=new THREE.Group();group.name='ArmoredMarine';parent.add(group);
 const blue=id%2===0,paint=blue?'#075cf2':'#c71523',trim=blue?'#ff9b17':'#eee2c9';
 const materials=[],geometries=new Map();
 let wear=null;
 if(textures&&typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#f7f7f7';ctx.fillRect(0,0,256,256);
  let seed=1357;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<240;i++){const x=random()*256,y=random()*256;ctx.strokeStyle=i%5?'#b0b0b0':'#505050';ctx.lineWidth=i%5?.5:1.1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*9,y+random()*3);ctx.stroke();}
  wear=new THREE.CanvasTexture(canvas);wear.colorSpace=THREE.SRGBColorSpace;
 }
 function material(color,props={}){const {clearcoat,clearcoatRoughness,...surface}=props;const m=new THREE.MeshStandardMaterial({color,roughness:.34,metalness:.48,map:wear,...surface});materials.push(m);return m;}
 const armor=material(paint),edge=material('#353c49',{metalness:.75,roughness:.31}),accent=material(trim),rubber=material('#171d29',{metalness:.08,roughness:.84,clearcoat:0,map:null}),steel=material('#8b96a4',{metalness:.82,roughness:.28}),glow=material('#a1fff1',{emissive:'#24ffe1',emissiveIntensity:2.2,metalness:.1,map:null});
 const all=[];
 function box(p,x,y,z,w,h,d,m=armor,r=.06){
  const key=[w,h,d,r].join('/');if(!geometries.has(key))geometries.set(key,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)));
  const o=new THREE.Mesh(geometries.get(key),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);all.push(o);return o;
 }
 function joint(p,x,y,z,r){const o=new THREE.Mesh(new THREE.SphereGeometry(r,12,8),rubber);o.position.set(x,y,z);p.add(o);o.castShadow=true;return o;}
 function bone(p,name,x,y,z){const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);p.add(b);return b;}
 function bolt(p,x,y,z,r=.034){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.025,8),steel);o.rotation.x=Math.PI/2;o.position.set(x,y,z);p.add(o);return o;}
 function chevrons(p,x,y,z,scale=1){for(let i=0;i<3;i++){const mark=box(p,x+i*.085*scale,y,z,.045*scale,.17*scale,.012,accent,.008);mark.rotation.z=-.37;}}
 const body=new THREE.Group();group.add(body);
 // Layered breastplate and flexing undersuit rather than a single painted torso.
 box(body,0,1.64,0,.91,.70,.54,rubber,.13);
 box(body,0,1.84,.12,.98,.38,.59,armor,.12);
 for(const side of [-1,1]){
  const p=box(body,side*.255,1.69,.326,.43,.32,.15,armor,.07);p.rotation.z=-side*.11;
  box(body,side*.39,1.9,.34,.11,.27,.10,edge,.025);
  box(body,side*.39,1.92,.40,.063,.12,.034,steel,.015);
  box(body,side*.22,1.41,.28,.35,.14,.17,edge,.035);
 }
 box(body,0,1.76,.425,.20,.115,.05,edge,.025);box(body,0,1.77,.46,.12,.045,.025,glow,.014);
 box(body,0,1.36,.02,.63,.21,.47,rubber,.07);
 for(let i=0;i<3;i++)box(body,0,1.37-i*.09,.27,.46,.07,.10,edge,.018);
 // Reinforced belt, buckle and separate thigh armor.
 box(group,0,1.15,0,.85,.18,.54,armor,.05);box(group,0,1.15,.31,.23,.17,.10,accent,.03);
 for(const side of [-1,1])box(group,side*.37,1.08,.23,.22,.26,.19,edge,.035);
 // Backpack with emissive heat vents, silhouette visible from every aiming direction.
 box(body,0,1.84,-.36,.71,.68,.30,edge,.07);
 box(body,0,2.06,-.47,.33,.43,.15,edge,.04);
 for(let i=0;i<3;i++)box(body,0,1.96+i*.095,-.56,.23,.045,.025,glow,.012);
 for(const side of [-1,1]){
  box(body,side*.36,1.84,-.31,.19,.52,.26,armor,.06);
  const points=[new THREE.Vector3(side*.40,1.97,-.38),new THREE.Vector3(side*.59,1.88,-.29),new THREE.Vector3(side*.55,1.55,-.16)];
  const tube=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),12,.075,8,false),rubber);body.add(tube);
 }
 const head=new THREE.Group();head.position.set(0,2.23,.06);body.add(head);
 box(head,0,.10,0,.76,.70,.65,edge,.19);
 box(head,0,.17,.025,.80,.60,.64,armor,.18);
 box(head,0,.32,.04,.13,.30,.66,accent,.025);
 box(head,0,.39,.20,.19,.22,.14,edge,.035);
 // Shaped V visor, inset into the helmet with an armored jaw beneath it.
 const visor=new THREE.Shape();visor.moveTo(-.30,.04);visor.lineTo(-.28,-.08);visor.lineTo(0,-.18);visor.lineTo(.28,-.08);visor.lineTo(.30,.04);visor.lineTo(0,-.035);visor.closePath();
 const visorMesh=new THREE.Mesh(new THREE.ExtrudeGeometry(visor,{depth:.025,bevelEnabled:true,bevelSize:.018,bevelThickness:.012,bevelSegments:2,steps:1}),glow);visorMesh.position.set(0,.09,.365);head.add(visorMesh);
 box(head,0,-.16,.32,.45,.22,.23,armor,.065);
 for(const side of [-1,1]){box(head,side*.30,-.05,.30,.14,.32,.16,armor,.035);box(head,side*.40,.08,0,.10,.32,.31,steel,.03);}
 for(let i=-1;i<=1;i++)box(head,i*.09,-.18,.445,.035,.11,.02,rubber,.006);
 const arms=[],legs=[];
 for(const side of [-1,1]){
  const label=side===1?'Right':'Left';
  const upper=bone(body,label+'Arm',side*.57,1.90,0);arms.push(upper);
  joint(upper,0,0,0,.21);
  const shoulder=box(upper,side*.07,-.02,0,.43,.40,.52,armor,.12);shoulder.rotation.z=side*.16;
  box(upper,side*.15,-.06,.25,.31,.29,.10,side===1?edge:armor,.06);
  if(side===1){box(upper,side*.21,-.06,.30,.055,.28,.025,accent,.01);bolt(upper,.09,-.02,.32);bolt(upper,.09,-.14,.32);}
  else chevrons(upper,-.16,-.05,.31,.75);
  box(upper,0,-.25,0,.28,.40,.32,rubber,.09);
  box(upper,0,-.25,.09,.30,.27,.30,armor,.07);
  const lower=bone(upper,label+'ForeArm',0,-.47,0);joint(lower,0,0,0,.16);
  box(lower,0,-.20,.035,.34,.34,.39,armor,.075);
  box(lower,0,-.27,.25,.25,.14,.07,edge,.03);box(lower,0,-.28,.29,.17,.06,.025,steel,.013);
  const hand=bone(lower,label+'Hand',0,-.47,0);
  box(hand,0,-.075,0,.24,.20,.17,rubber,.045);box(hand,0,-.045,.085,.23,.10,.055,edge,.022);
  for(const [name,x] of [['Index',.075],['Middle',.025],['Ring',-.025],['Pinky',-.075],['Thumb',.12]]){
   const f1=bone(hand,label+'Hand'+name+'1',x,-.14,0);
   box(f1,0,-.027,0,.043,.074,.065,rubber,.015);
   const f2=bone(f1,label+'Hand'+name+'2',0,-.065,0);box(f2,0,-.023,0,.042,.060,.063,rubber,.015);
   bone(f2,label+'Hand'+name+'3',0,-.05,0);
  }
  const thigh=bone(group,label+'UpLeg',side*.265,1.08,0);legs.push(thigh);
  joint(thigh,0,0,0,.20);box(thigh,0,-.20,0,.39,.39,.44,armor,.09);
  box(thigh,0,-.23,.245,.27,.25,.07,edge,.035);
  const shin=bone(thigh,label+'Leg',0,-.46,0);joint(shin,0,0,0,.16);
  box(shin,0,-.04,.16,.31,.27,.25,armor,.07);
  box(shin,0,-.26,0,.37,.33,.39,edge,.07);box(shin,0,-.25,.20,.27,.25,.09,armor,.04);
  const boot=bone(shin,label+'Foot',0,-.39,0);
  box(boot,0,-.08,.115,.46,.25,.64,rubber,.07);box(boot,0,-.03,.18,.42,.19,.55,armor,.075);box(boot,0,-.08,.42,.39,.12,.055,edge,.02);
 }
 group.updateMatrixWorld(true);
 const batching=batchArticulated(THREE,group);materials.push(...batching.materials);
 group.userData.batchStats={before:batching.before,after:batching.after};
 return {group,body,head,arms,legs,materials,paint,trim,animate(p,t,dt){
  const speed=Math.hypot(p.vx||0,p.vy||0),amount=Math.min(1,speed/260);
  const phase=t*(p.dashTime>0?16:10.5);
  body.rotation.z=THREE.MathUtils.damp(body.rotation.z,-Math.sin(phase)*.035*amount,12,dt);
  body.position.y=Math.abs(Math.sin(phase))*.035*amount;
  for(let i=0;i<2;i++){
   const leg=legs[i],step=Math.sin(phase+i*Math.PI);
   leg.rotation.x=step*.43*amount;
   leg.children.find(c=>c.isBone).rotation.x=Math.max(0,-step)*.62*amount;
  }
  head.rotation.y=Math.sin(t*1.4)*.018;
 }};
}
