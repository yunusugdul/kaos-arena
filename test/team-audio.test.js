const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('the supplied three MP3 files are bundled and the two teams select different recordings',()=>{
 const root=path.join(__dirname,'..');
 for(const [name,size] of [['reload.mp3',48384],['shot-blue.mp3',47647],['shot-red.mp3',55170]]){
  const bytes=fs.readFileSync(path.join(root,'public/audio',name));assert.equal(bytes.length,size);assert.ok(bytes.subarray(0,3).toString()==='ID3'||bytes[0]===255);
 }
 const source=fs.readFileSync(path.join(root,'public/game.js'),'utf8');
 const snd=source.slice(source.indexOf('function snd('),source.indexOf('\nlet arenaAmbience='));
 const harness=Function(`
  const played=[],teamAudioBuffers={reload:{name:'reload',duration:2.4},blue:{name:'blue'},red:{name:'red'}},WEAPONS={rifle:{reload:1.4}};
  let muted=false,gunshotDecoding=true;
  const audio={state:'running',currentTime:0,destination:{},createBufferSource(){const s={playbackRate:{value:1},connect(){return {connect(){}}},start(){played.push({name:s.buffer.name,rate:s.playbackRate.value})}};return s;},createGain(){return {gain:{setValueAtTime(){}},connect(){}}}};
  ${snd}
  return {snd,played};`)();
 harness.snd('shot',1,'rifle',0);harness.snd('shot',1,'rifle',1);harness.snd('shot',1,'rifle',2);harness.snd('shot',1,'rifle',3);harness.snd('reload',1,'rifle',1);
 assert.deepEqual(harness.played.map(p=>p.name),['blue','red','blue','red','reload']);
 assert.equal(harness.played[4].rate,2.4/1.4);
});
