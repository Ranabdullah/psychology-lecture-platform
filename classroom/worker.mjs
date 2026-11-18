import {pipelineDB,processQueueMessage} from './pipeline.mjs';
const encoder = new TextEncoder();
const MAX_PART = 1048576;
const types = new Set(['audio/webm','audio/ogg','audio/mp4','audio/wav','audio/mpeg']);
const response = (data,status=200,headers={}) => Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
const error = (message,status=400) => Object.assign(new Error(message),{status});
const hex = bytes => [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async value => hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const idPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const sessionName = '__Host-lecture_session';
const cookie = (value,maxAge=28800) => sessionName+'='+value+'; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age='+maxAge;
function bytesToBase64(bytes){
  let text='';
  for(let i=0;i<bytes.length;i+=8192) text+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(text);
}
const decode = value => Uint8Array.from(atob(value),value=>value.charCodeAt(0));
async function passwordHash(password,salt){
  const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},material,256);
  return hex(new Uint8Array(bits));
}
function sameValue(left,right){
  if(left.length!==right.length) return false;
  let difference=0;
  for(let i=0;i<left.length;i++) difference|=left.charCodeAt(i)^right.charCodeAt(i);
  return difference===0;
}
function bounded(data,field,max,required=true){
  const value=typeof data[field]==='string'?data[field].trim():'';
  if((required&&!value)||value.length>max) throw error('Check '+field+' and try again.');
  return value;
}
async function requestBytes(request,limit){
  if(Number(request.headers.get('Content-Length')||0)>limit) throw error('Request is too large.',413);
  if(!request.body) return new Uint8Array();
  const reader=request.body.getReader();
  const parts=[];
  let length=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done) break;
      length+=value.length;
      if(length>limit){await reader.cancel();throw error('Request is too large.',413);}
      parts.push(value);
    }
  }finally{reader.releaseLock();}
  const result=new Uint8Array(length);
  let offset=0;
  for(const part of parts){result.set(part,offset);offset+=part.length;}
  return result;
}
async function jsonBody(request){
  if(!request.headers.get('Content-Type')?.startsWith('application/json')) throw error('Expected JSON.',415);
  try{return JSON.parse(new TextDecoder().decode(await requestBytes(request,350000)));}
  catch(failure){if(failure.status)throw failure;throw error('Invalid JSON.');}
}
async function db(env,operation,payload={}){
  if(!env.DB_GATE_KEY||!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY) throw error('Classroom storage has not been configured.',503);
  const request=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/lecture_studio_gateway',{
    method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({gateway:env.DB_GATE_KEY,operation,payload})
  });
  if(!request.ok) throw error('Classroom storage is temporarily unavailable.',502);
  const result=await request.json();
  if(result.error) throw error(result.error,result.status);
  return result;
}
async function limit(binding,key){
  if(binding && !(await binding.limit({key})).success) throw error('Too many requests. Try again in a minute.',429);
}
async function login(request,env,register){
  await limit(env.AUTH_LIMIT,request.headers.get('CF-Connecting-IP')||'local');
  const data=await jsonBody(request);
  const email=bounded(data,'email',200).toLowerCase();
  if(!emailPattern.test(email)) throw error('Enter an email address.');
  const password=typeof data.password==='string'?data.password:'';
  if(password.length<12||password.length>160) throw error('Use a password with 12 to 160 characters.');
  const session=random();
  const newSession=await digest(session);
  if(register){
    const invite=bounded(data,'invite',64);
    if(!/^[a-f0-9]{64}$/i.test(invite)) throw error('Enter the private invitation code.');
    const name=bounded(data,'name',100);
    const salt=random();
    await db(env,'register',{name,email,password:salt+':'+await passwordHash(password,salt),invite:await digest(invite.toLowerCase()),newSession});
  }else{
    const user=await db(env,'lookup',{email});
    const [salt,expected]=(user.password||'').split(':');
    const result=await passwordHash(password,salt||'unregistered');
    if(!expected||!sameValue(result,expected)) throw error('Email or password is incorrect.',401);
    await db(env,'login',{account:user.id,newSession});
  }
  return response({ok:true},200,{'Set-Cookie':cookie(session)});
}
async function sessionHash(request){
  const value=request.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-lecture_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(!value) throw error('Sign in first.',401);
  return digest(value);
}
async function getAudio(env,parameters,count){
  const chunks=[];
  let size=0;
  for(let part=0;part<count;part++){
    const row=await db(env,'part',{...parameters,part});
    const bytes=decode(row.bytes);
    size+=bytes.length;
    chunks.push(bytes);
  }
  const result=new Uint8Array(size);
  let offset=0;
  for(const bytes of chunks){result.set(bytes,offset);offset+=bytes.length;}
  return result;
}
function sections(value){
  if(!Array.isArray(value)||value.length<1||value.length>120) throw error('Add between 1 and 120 lecture sections.');
  return value.map(row=>({heading:bounded(row,'heading',160),body:bounded(row,'body',4500)}));
}
async function handle(request,env){
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  const method=request.method;
  if(method!=='GET'&&request.headers.get('Origin')!==url.origin) throw error('Request origin is not allowed.',403);
  if(method==='POST'&&url.pathname==='/api/login') return login(request,env,false);
  if(method==='POST'&&url.pathname==='/api/register') return login(request,env,true);
  const session=await sessionHash(request);
  const clipRoute=/^\/api\/lecture\/([a-f0-9-]+)\/(status|finish_set|clips)(?:\/(\d+))?(?:\/(part|finish)(?:\/(\d+))?)?$/.exec(url.pathname);
  if(clipRoute){
    const [,lecture,route,index,action,part]=clipRoute;
    if(!idPattern.test(lecture))throw error('Invalid lecture ID.');
    const params={session,lecture};
    if(method==='GET'&&route==='status')return response(await pipelineDB(env,'status',params));
    const clip=Number(index);
    if(route==='clips'&&(!Number.isInteger(clip)||clip<0||clip>59))throw error('Invalid recording segment.');
    if(method==='GET'&&route==='clips'&&!action){
      const info=await pipelineDB(env,'clip_info',{...params,clip});
      if(!info.parts)throw error('Use the original recording playback.',404);
      const pieces=[];let size=0;
      for(let part=0;part<info.parts;part++){const row=await pipelineDB(env,'audio_part',{...params,clip,part});const bytes=decode(row.bytes);pieces.push(bytes);size+=bytes.length;}
      const bytes=new Uint8Array(size);let offset=0;for(const piece of pieces){bytes.set(piece,offset);offset+=piece.length;}
      return new Response(bytes,{headers:{'Content-Type':info.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }
    if(method!=='POST')throw error('Method unavailable.',405);
    if(action==='part'){
      const number=Number(part);if(!Number.isInteger(number)||number<0||number>7)throw error('Invalid audio part.');
      const bytes=await requestBytes(request,MAX_PART);if(!bytes.length)throw error('Empty recording.');
      return response(await pipelineDB(env,'upload_clip',{...params,clip,part:number,bytes:bytesToBase64(bytes)}));
    }
    const data=await jsonBody(request);
    if(route==='finish_set'){
      if(!Number.isInteger(data.count)||data.count<1||data.count>60)throw error('Choose 1 to 60 recording segments.');
      return response(await pipelineDB(env,'finish_set',{...params,count:data.count}));
    }
    if(action==='finish'){
      if(!types.has(data.mime)||!Number.isInteger(data.count)||data.count<1||data.count>8||!Number.isFinite(data.offset)||data.offset<0||data.offset>7200||!Number.isFinite(data.duration)||data.duration<=0||data.duration>180)throw error('Each recording segment must be at most three minutes and 8 MB.');
      return response(await pipelineDB(env,'finish_clip',{...params,clip,count:data.count,mime:data.mime,offset:data.offset,duration:data.duration}));
    }
    throw error('Route unavailable.',404);
  }
  const match=/^\/api\/lecture\/([a-f0-9-]+)(?:\/(audio|finish|process|edit|publish|note|delete)(?:\/(\d+))?)?$/.exec(url.pathname);
  if(match){
    const [,lecture,route,part]=match;
    if(!idPattern.test(lecture)) throw error('Invalid lecture ID.');
    const params={session,lecture};
    if(method==='GET'&&!route) return response(await db(env,'detail',params));
    if(method==='GET'&&route==='audio'&&part===undefined){
      const detail=await db(env,'detail',params);
      if(!detail.audio_parts) throw error('Recording unavailable.',404);
      const bytes=await getAudio(env,params,detail.audio_parts);
      return new Response(bytes,{headers:{'Content-Type':types.has(detail.audio_type)?detail.audio_type:'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }
    if(method!=='POST') throw error('Method unavailable.',405);
    if(route==='audio'){
      const number=Number(part);
      if(!Number.isInteger(number)||number<0||number>7) throw error('Invalid audio part.');
      const bytes=await requestBytes(request,MAX_PART);
      if(!bytes.length) throw error('Recording part is empty.');
      return response(await db(env,'upload',{...params,part:number,bytes:bytesToBase64(bytes)}));
    }
    if(route==='process'){
      await limit(env.WORK_LIMIT,session);
      if(!env.PROCESS_QUEUE)throw error('Background processing is not configured.',503);
      const job=await pipelineDB(env,'start',params);
      if(job.status!=='complete')await env.PROCESS_QUEUE.send({job:job.id});
      return response({queued:true,...job},202);
    }
    if(!['finish','note','edit','publish','delete'].includes(route)) throw error('Route unavailable.',404);
    if(['publish','edit'].includes(route)){const state=await pipelineDB(env,'status',params);if(state.job&&['queued','running','retrying'].includes(state.job.status))throw error('The lecture is processing in the background. Wait before editing or publishing.',409);}
    if(route==='publish'||route==='delete') return response(await db(env,route,params));
    const data=await jsonBody(request);
    if(route==='note') return response(await db(env,'note',{...params,body:bounded(data,'body',8000,false)}));
    if(route==='edit') return response(await db(env,'edit',{...params,title:bounded(data,'title',150),sections:sections(data.sections)}));
    if(!types.has(data.mime)||!Number.isInteger(data.count)||data.count<1||data.count>8) throw error('Unsupported recording type or size.');
    return response(await db(env,'finish',{...params,mime:data.mime,count:data.count}));
  }
  if(method==='GET'&&url.pathname==='/api/home') return response(await db(env,'home',{session}));
  if(method!=='POST') throw error('Route unavailable.',404);
  if(url.pathname==='/api/logout'){
    await db(env,'logout',{session});
    return response({ok:true},200,{'Set-Cookie':cookie('',0)});
  }
  const data=await jsonBody(request);
  if(url.pathname==='/api/create') return response(await db(env,'create',{session,title:bounded(data,'title',150)}));
  if(url.pathname==='/api/invite'){
    const email=bounded(data,'email',200).toLowerCase();
    if(!emailPattern.test(email)) throw error('Enter a student email.');
    const invite=random();
    await db(env,'invite',{session,email,invite:await digest(invite)});
    return response({link:url.origin+'/#invite='+invite});
  }
  if(['revoke_invite','remove_student'].includes(url.pathname.slice(5))){
    const id=bounded(data,'target',40);
    if(!idPattern.test(id)) throw error('Invalid enrolment ID.');
    return response(await db(env,url.pathname.slice(5),{session,target:id}));
  }
  throw error('Route unavailable.',404);
}
export default {
  async queue(batch,env){for(const message of batch.messages)await processQueueMessage(env,message);},
  async fetch(request,env){
    try{return await handle(request,env);}
    catch(failure){return response({error:failure.status?failure.message:'The classroom could not complete this request.'},failure.status||500);}
  }
};
