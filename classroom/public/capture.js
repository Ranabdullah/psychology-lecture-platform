'use strict';
window.LectureCapture=(()=>{
 const maxSegment=8*1048576,maxTotal=64*1048576;
 async function recovery(owner,operation,value){
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('lecture-studio-recovery',1);r.onupgradeneeded=()=>r.result.createObjectStore('recordings');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction('recordings',operation==='get'?'readonly':'readwrite'),store=tx.objectStore('recordings');const req=operation==='get'?store.get(owner):operation==='delete'?store.delete(owner):store.put(value,owner);let result;req.onsuccess=()=>result=req.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}
 }
 async function duration(blob){
  const url=URL.createObjectURL(blob),a=new Audio();a.preload='metadata';
  try{const seconds=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Audio duration could not be read.')),15000);a.onloadedmetadata=()=>{clearTimeout(timer);resolve(a.duration)};a.onerror=()=>{clearTimeout(timer);reject(Error('This audio file could not be opened.'))};a.src=url});if(Number.isFinite(seconds)&&seconds>0)return seconds;
   const context=new (window.AudioContext||window.webkitAudioContext)();try{const decoded=await context.decodeAudioData(await blob.arrayBuffer());return decoded.duration}finally{await context.close()}
  }finally{a.removeAttribute('src');a.load();URL.revokeObjectURL(url)}
 }
 class RollingRecorder{
  constructor(stream,{onsegment,onstop,onerror,segmentSeconds=120}){this.stream=stream;this.callbacks={onsegment,onstop,onerror};this.segmentSeconds=segmentSeconds;this.stopping=false;this.elapsed=0;this.state='inactive';this.paused=0;this.pauseAt=0}
  start(){this.started=Date.now();this.state='recording';this.begin();this.tick=setInterval(()=>{if(this.state==='recording'&&(Date.now()-this.started-this.paused-this.elapsed*1000)>=this.segmentSeconds*1000)this.current.stop()},250)}
  begin(){
   const type=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));this.current=new MediaRecorder(this.stream,{audioBitsPerSecond:32000,...(type?{mimeType:type}:{})});const parts=[];let size=0;
   this.current.ondataavailable=e=>{if(e.data.size){parts.push(e.data);size+=e.data.size}if(size>=maxSegment*.94&&this.current.state==='recording')this.current.stop()};
   this.current.onerror=()=>{this.stopping=true;this.callbacks.onerror(Error('The microphone stopped unexpectedly. Saved local segments are retained.'));this.stop()};
   this.current.onstop=async()=>{
    const captured=(Date.now()-this.started-this.paused-(this.pauseAt?Date.now()-this.pauseAt:0))/1000;
    const seconds=Math.max(.1,captured-this.elapsed),offset=this.elapsed;this.elapsed=captured;
    const mime=this.current.mimeType.split(';')[0]||'audio/webm';const blob=new Blob(parts,{type:mime});
    if(!this.stopping&&this.elapsed<7200){this.begin()}else{this.state='inactive';clearInterval(this.tick);this.stream.getTracks().forEach(t=>t.stop())}
    try{if(blob.size)await this.callbacks.onsegment({blob,mime,duration:seconds,offset});}catch(e){this.callbacks.onerror(e);this.stop()}
    if(this.state==='inactive')this.callbacks.onstop();
   };
   this.current.start(1000)
  }
  pause(){if(this.state!=='recording'||this.current.state!=='recording')return;this.current.pause();this.pauseAt=Date.now();this.state='paused'}
  resume(){if(this.state!=='paused'||this.current.state!=='paused')return;this.paused+=Date.now()-this.pauseAt;this.pauseAt=0;this.current.resume();this.state='recording'}
  stop(){this.stopping=true;if(this.current&&['recording','paused'].includes(this.current.state))this.current.stop();else if(this.state==='inactive'){clearInterval(this.tick);this.stream.getTracks().forEach(t=>t.stop())}}
 }
 function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return(crc^0xffffffff)>>>0}
 async function zip(clips){
  const entries=[],central=[];let offset=0;const enc=new TextEncoder();
  for(const [index,clip] of clips.entries()){
   const ext=({'audio/mp4':'m4a','audio/mpeg':'mp3','audio/wav':'wav','audio/ogg':'ogg'})[clip.mime]||'webm';const name=enc.encode(String(index+1).padStart(2,'0')+'-recording.'+ext),bytes=new Uint8Array(await clip.blob.arrayBuffer()),crc=crc32(bytes);
   const header=new Uint8Array(30+name.length),h=new DataView(header.buffer);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint32(14,crc,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,name.length,true);header.set(name,30);
   const directory=new Uint8Array(46+name.length),d=new DataView(directory.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint32(16,crc,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);directory.set(name,46);entries.push(header,bytes);central.push(directory);offset+=header.length+bytes.length;
  }
  const length=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,clips.length,true);v.setUint16(10,clips.length,true);v.setUint32(12,length,true);v.setUint32(16,offset,true);return new Blob([...entries,...central,end],{type:'application/zip'})
 }
 return {RollingRecorder,recovery,duration,zip,maxSegment,maxTotal};
})();
