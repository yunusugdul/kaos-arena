// Menu interaction and music must work independently of WebGL/model loading.
(()=>{
 const $=id=>document.getElementById(id),play=$('menuPlay'),music=$('menuMusic'),credits=$('creditsPanel');
 let unlocked=false;
 music.volume=.30;
 function syncMusic(){
  const playing=document.body.classList.contains('is-playing'),muted=$('menuSound').getAttribute('aria-pressed')==='true';
  music.muted=muted;
  if(playing||muted||document.hidden){music.pause();if(playing)music.currentTime=0;music.dataset.state='paused';return;}
  if(unlocked)music.play().then(()=>{music.dataset.state='playing';}).catch(()=>{music.dataset.state='interaction-required';});
 }
 function unlock(){unlocked=true;syncMusic();}
 // Browsers require a user gesture for audible playback.
 document.addEventListener('pointerdown',unlock,{capture:true,once:true});document.addEventListener('keydown',unlock,{capture:true,once:true});
 play.addEventListener('click',()=>{document.body.classList.add('setup-open');$('nick').focus();document.dispatchEvent(new Event('arena:prepare'));});
 $('closeSetup').addEventListener('click',()=>{document.body.classList.remove('setup-open');play.focus();});
 $('menuSound').addEventListener('click',()=>{$('muteTop').click();syncMusic();});
 $('muteTop').addEventListener('click',()=>queueMicrotask(syncMusic));
 $('menuGuide').addEventListener('click',()=>$('helpBtn').click());
 $('menuCredits').addEventListener('click',()=>{credits.classList.remove('hidden');$('closeCredits').focus();});
 $('closeCredits').addEventListener('click',()=>{credits.classList.add('hidden');$('menuCredits').focus();});
 document.addEventListener('keydown',e=>{if(e.key!=='Escape'||document.body.classList.contains('is-playing'))return;document.body.classList.remove('setup-open');credits.classList.add('hidden');play.focus();});
 new MutationObserver(syncMusic).observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',syncMusic);
 if(new URLSearchParams(location.search).has('room')){document.body.classList.add('setup-open');document.dispatchEvent(new Event('arena:prepare'));}
 music.dataset.state='interaction-required';
})();
