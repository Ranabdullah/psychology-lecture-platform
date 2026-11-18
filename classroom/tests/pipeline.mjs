import assert from 'node:assert/strict';
import {processQueueMessage,textWindows} from '../pipeline.mjs';
const words=Array.from({length:15000},(_,i)=>'word'+i);const windows=textWindows(words.join(' '));assert.ok(windows.every(w=>w.split(' ').length<=900));for(const value of ['word0','word7500','word14999'])assert.ok(windows.some(w=>w.split(' ').includes(value)));
const job={id:'10000000-0000-4000-8000-000000000001',lecture:'20000000-0000-4000-8000-000000000001',status:'queued',cursor:0,total:45,phase:'clips',groups:[]},clips=[];let failed=false,retries=0,acks=0,sends=0;let saved;
globalThis.fetch=async(_url,options)=>{
 const {operation,payload}=JSON.parse(options.body);let result={ok:true};
 if(operation==='claim')result=job.status==='complete'?{done:true}:{...job};
 if(operation==='clip_work')result={clip:job.cursor,audio:['YXVkaW8='],offset_seconds:job.cursor*120,duration_seconds:120,mime:'audio/webm'};
 if(operation==='clip_commit'){clips.push({clip:job.cursor,offset_seconds:payload.offset,transcript:payload.transcript,segments:payload.segments,result:payload.result});job.cursor++;if(job.cursor===45)job.phase='groups'}
 if(operation==='results')result=clips;
 if(operation==='group_commit'){job.groups.push(payload.group);job.cursor++}
 if(operation==='failure'){job.status=payload.final?'failed':'retrying'}
 if(operation==='complete'){saved=payload;job.status='complete'}
 return Response.json(result)
};
const env={SUPABASE_URL:'https://example.invalid',SUPABASE_PUBLISHABLE_KEY:'test',DB_GATE_KEY:'test',PROCESS_QUEUE:{send:async()=>sends++},AI:{run:async(model,options)=>{
 if(model.includes('whisper'))return {text:'Passage '+job.cursor+'. '+Array.from({length:300},(_,i)=>'source'+job.cursor+'word'+i).join(' '),segments:[{start:0,end:120,text:'source'}]};
 if(job.cursor===17&&!failed){failed=true;throw Error('Simulated provider outage')}
 const data=JSON.parse(options.messages[1].content);
 if(data.passage){assert.ok(data.passage.split(' ').length<=900);return {response:{summary:'Summary '+job.cursor,heading:'Topic '+job.cursor,body:'Preserved notes for passage '+job.cursor,takeaways:['Point '+job.cursor],evidence:[data.passage.split(' ').slice(0,8).join(' ')],findings:{unclear:'Listen to passage '+job.cursor,names:'Confirm terms',source_alignment:'Source comparison needs teacher approval'}}}}
 if(Array.isArray(data)&&data[0]?.recording)return {response:{summary:'Group '+data[0].recording,takeaways:['Group point']}};
 return {response:{summary:'Whole lecture overview',takeaways:['First point','Middle point','Final point']}}
}}};
for(let i=0;i<70&&job.status!=='complete';i++)await processQueueMessage(env,{body:{job:job.id},attempts:1,ack:()=>acks++,retry:()=>retries++});
assert.equal(job.status,'complete');assert.equal(clips.length,45);assert.equal(job.groups.length,6);assert.equal(retries,1);assert.equal(saved.sections.length,47);assert.equal(saved.checks.length,5);for(let i=0;i<45;i++)assert.ok(saved.sections.some(s=>s.body==='Preserved notes for passage '+i));assert.match(saved.transcript,/Recording 45/);assert.ok(sends>=51);
let duplicateAck=false;await processQueueMessage(env,{body:{job:job.id},ack:()=>duplicateAck=true,retry:()=>assert.fail('Completed job retried')});assert.equal(duplicateAck,true);
console.log('PASS: simulated 90-minute/45-segment job, bounded context, complete segment retention, hierarchical summaries, provider retry, saved progress and duplicate completion handling. This is an orchestration simulation, not a 90-minute speech-quality test.');
