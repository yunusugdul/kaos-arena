'use strict';
const {server}=require('./server.js');
const {spawn}=require('node:child_process');
let fallback=false;
server.on('error',err=>{
  if(err.code==='EADDRINUSE'&&!fallback){fallback=true;server.listen(0,'0.0.0.0');}
  else{console.error('Oyun acilamadi:',err.message);process.exitCode=1;}
});
server.on('listening',()=>{
  const url='http://localhost:'+server.address().port;
  console.log('\nKAOS ARENA\n'+url+'\nOynarken bu pencere acik kalsin.\n');
  if(process.platform==='win32')spawn('cmd.exe',['/c','start','',url],{windowsHide:true,stdio:'ignore'}).unref();
});
server.listen(3300,'0.0.0.0');
