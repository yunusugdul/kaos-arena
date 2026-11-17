import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Merge rigid parts; animated joints always remain independent.
export function batchRigidMeshes(THREE,root,{colors=false,materials=new Map()}={}){
 root.updateWorldMatrix(true,true);
 const inverse=root.matrixWorld.clone().invert(),groups=new Map();let before=0;
 root.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material)||!o.visible)return;
  const m=o.material,key=colors?(m.emissiveIntensity>1?'glow':m.metalness<.2?'rubber':'armor'):m.uuid+':'+o.castShadow+':'+o.receiveShadow;
  if(!groups.has(key))groups.set(key,{sources:[],material:m,cast:o.castShadow,receive:o.receiveShadow});
  groups.get(key).sources.push(o);before++;
 });
 for(const [key,set] of groups){
  if(!colors&&set.sources.length<2)continue;
  let material=set.material;
  if(colors){
   if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:key==='rubber'?.82:.40,metalness:key==='rubber'?.03:.42,map:key==='armor'?set.material.map:null,emissive:key==='glow'?'#42ffe9':'#000000',emissiveIntensity:key==='glow'?1.1:0}));
   material=materials.get(key);
  }
  const pieces=set.sources.map(o=>{
   const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
   for(const name of Object.keys(g.attributes))if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);
   if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
   if(colors){const c=o.material.color,a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(a,3));}
   return g;
  });
  const geometry=mergeGeometries(pieces,false);for(const g of pieces)g.dispose();if(!geometry)throw Error('Rigid batching failed');
  const merged=new THREE.Mesh(geometry,material);merged.castShadow=set.cast;merged.receiveShadow=set.receive;merged.name='batched-'+key;root.add(merged);for(const o of set.sources)o.removeFromParent();
 }
 return {before,after:groups.size,materials:[...materials.values()]};
}
export function batchArticulated(THREE,root){
 const materials=new Map(),parents=[];root.traverse(o=>{if(!o.isMesh)parents.push(o);});let before=0,after=0;
 for(const parent of parents.reverse()){
  const meshes=parent.children.filter(o=>o.isMesh&&!o.isInstancedMesh);if(!meshes.length)continue;
  const holder=new THREE.Group();parent.add(holder);for(const mesh of meshes)holder.add(mesh);
  const counts=batchRigidMeshes(THREE,holder,{colors:true,materials});before+=counts.before;after+=counts.after;
 }
 return {materials:[...materials.values()],before,after};
}
