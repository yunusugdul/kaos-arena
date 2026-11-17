import {createArena3D} from '/arena3d.js';
const canvas=document.getElementById('heroArena');
const state={shooter:true,map:{name:'AVLU',glow:'#b7a36e',floor:'#827663',blocks:[{x:350,y:95,w:70,h:128},{x:581,y:337,w:70,h:128},{x:450,y:233,w:100,h:96}],features:[]},players:[],bullets:[],snowPatches:[]};
const colors=['#c5ff26','#ff4cba','#73e9ff','#ffc969'];
for(let i=0;i<4;i++)state.players.push({id:i,x:[185,790,235,805][i],y:[170,386,407,175][i],hp:100,color:colors[i],face:{x:i%2?-1:1,y:.45},aim:{x:i%2?-1:1,y:.45},vx:0,vy:0,weapon:i===0?'rifle':'pistol'});
let preview=null,last=0,visible=true;
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
new IntersectionObserver(([e])=>visible=e.isIntersecting).observe(canvas.parentElement);
function frame(ms){
  const playing=document.body.classList.contains('is-playing');
  if(!playing&&visible&&!document.hidden&&ms-last>=(reduce?250:40)){
    last=ms;
    try{
      if(!preview)preview=createArena3D(canvas);
      const t=ms/1000;
      state.players.forEach((p,i)=>{const a=t*.3+i*Math.PI*.5;p.aim={x:Math.cos(a),y:Math.sin(a)};});
      preview.draw(state,t,[],[]);
      canvas.parentElement.querySelector('.showcase-fallback').hidden=true;
    }catch(error){
      console.warn('Arena preview unavailable',error);
      preview?.dispose();preview=null;
      canvas.parentElement.querySelector('.showcase-fallback').textContent='3D önizleme açılamadı. Oyun başlatıldığında tekrar denenecek.';
      return;
    }
  }
  if(playing&&preview){preview.dispose();preview=null;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
