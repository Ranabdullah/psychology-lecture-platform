'use strict';
const $ = selector=>document.querySelector(selector);
const node = (tag,value,cls='')=>{
  const element=document.createElement(tag);
  element.textContent=value;
  if(cls) element.className=cls;
  return element;
};
const button=(text,action)=>{
  const element=node('button',text);
  element.type='button';
  element.onclick=action;
  return element;
};
const link=(text,url)=>{
  const element=node('a',text,'button');
  element.href=url;
  element.rel='noopener noreferrer';
  return element;
};
let home;
let lecture;
let registration=false;
let recorder;
let mediaStream;
let audio;
let playbackURL;
let uploadingId;
let uploadInProgress=false;
let working=false;
let pendingChanges=false;
let timer;
let backgroundTimer;
let pipelineState={job:null,clips:[]};
const jobBusy=()=>pipelineState.job&&["queued","running","retrying"].includes(pipelineState.job.status);
const chunkSize=1048576;
const maxAudio=chunkSize*8;
const fragment=new URLSearchParams(location.hash.slice(1));
const initialInvite=fragment.get('invite');
const requestedLecture=new URLSearchParams(location.search).get('lecture');
if(initialInvite) history.replaceState(null,'',location.pathname+location.search);
const authForm=$('#authForm');
const outlineForm=$('#outlineForm');
const recordForm=$('#recordForm');
const api=async(path,data,options={})=>{
  if(window.LectureDemo) return window.LectureDemo.request(path,data,options);
  const settings={cache:'no-store',...options};
  if(data!==undefined){
    settings.method='POST';
    settings.headers={'Content-Type':'application/json'};
    settings.body=JSON.stringify(data);
  }
  const response=await fetch('/api/'+path,settings);
  if(!response.ok){
    const result=await response.json().catch(()=>({}));
    throw Object.assign(new Error(result.error||'Could not complete this request.'),{status:response.status});
  }
  return response.json();
};
function status(text='',isError=false){
  const target=$('#status');
  target.textContent=text;
  target.classList.toggle('error',isError);
  target.hidden=!text;
}
async function run(action){
  try{await action();}catch(error){status(error.message,true);}
}
function route(id){
  for(const current of ['auth','workspace','recorder','detail']) $('#'+current).hidden=current!==id;
  if(id!=='detail'){$('#sourceAudio').removeAttribute('src');clearInterval(backgroundTimer);}
  window.scrollTo(0,0);
}
function toggleAuth(register){
  registration=register;
  $('#nameField').hidden=!register;
  $('#inviteField').hidden=!register;
  authForm.elements.name.required=register;
  authForm.elements.invite.required=register;
  $('#password').autocomplete=register?'new-password':'current-password';
  $('#authButton').textContent=register?'Create account':'Sign in';
  $('#signInTab').setAttribute('aria-pressed',!register);
  $('#registerTab').setAttribute('aria-pressed',register);
}
$('#signInTab').onclick=()=>toggleAuth(false);
$('#registerTab').onclick=()=>toggleAuth(true);
if(initialInvite){
  authForm.elements.invite.value=initialInvite;
  toggleAuth(true);
}
function formHandler(form,handler){
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const submit=event.submitter||form.querySelector('button:not([type=button])');
    if(submit?.disabled) return;
    if(submit) submit.disabled=true;
    run(async()=>{
      try{await handler(Object.fromEntries(new FormData(form)));}
      finally{if(submit) submit.disabled=false;}
    });
  });
}
formHandler(authForm,async fields=>{
  status('');
  await api(registration?'register':'login',fields);
  authForm.reset();
  await enterClassroom();
});
async function enterClassroom(){
  home=await api('home');
  $('#userBar').hidden=false;
  $('#user').textContent=home.me.name+' Â· '+home.me.role;
  if(requestedLecture&&!lecture){
    try{await openLecture(requestedLecture);return;}catch(error){status(error.message,true);}
  }
  await dashboard(false);
}
async function dashboard(refresh=true){
  if(refresh) home=await api('home');
  const teacher=home.me.role==='teacher';
  $('#workspaceTitle').textContent=teacher?'Teacher workspace':'Your lectures';
  $('#workspaceCaption').textContent=teacher?'Record, review and publish lectures to your class.':'Published lectures from your teacher.';
  $('#roster').hidden=!teacher;
  $('#newLecture').hidden=!teacher;
  const list=$('#lectureList');
  list.replaceChildren();
  const query=$('#lectureSearch').value.trim().toLowerCase();
  const rows=[...home.lectures].filter(row=>row.title.toLowerCase().includes(query)).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  $('#lectureCount').textContent=home.lectures.length+' '+(home.lectures.length===1?'lecture':'lectures');
  for(const row of rows){
    const item=node('li','');
    const label=node('div',row.title);
    label.append(node('small',(row.published?'Published':'Draft')+' Â· '+new Date(row.created_at).toLocaleDateString(undefined,{day:'numeric',month:'short'})));
    item.append(label,button('Open',()=>run(()=>openLecture(row.id))));
    list.append(item);
  }
  if(!rows.length) list.append(node('li',query?'No lectures match your search.':teacher?'Start by recording a lecture.':'Your teacher has not published a lecture yet.'));
  renderStudents();
  pendingChanges=false;
  route('workspace');
}
$('#lectureSearch').oninput=()=>run(()=>dashboard(false));
function renderStudents(){
  const roster=$('#students');
  roster.replaceChildren();
  for(const student of home.students){
    const row=node('li','');
    const label=node('div',student.name);
    label.append(node('small',student.email));
    row.append(label,button('Remove',()=>run(async()=>{
      if(!confirm('Remove this student and their notes from your classroom?'))return;
      await api('remove_student',{target:student.id});await dashboard();
    })));
    roster.append(row);
  }
  for(const invite of home.invites){
    const row=node('li',invite.email+' Â· invited');
    row.append(button('Revoke',()=>run(async()=>{
      await api('revoke_invite',{target:invite.id});$('#inviteResult').hidden=true;await dashboard();
    })));
    roster.append(row);
  }
}
function share(target,url,subject,message){
  const result=$(target);
  result.replaceChildren(node('p',message));
  const actions=node('div','','actions');
  actions.append(button('Copy link',()=>run(async()=>{await navigator.clipboard.writeText(url);status('Link copied.');})),
    link('Open email','mailto:?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(url)),
    link('Open WhatsApp','https://wa.me/?text='+encodeURIComponent(subject+'\n'+url)));
  const address=node('input','');address.value=url;address.readOnly=true;address.setAttribute('aria-label','Link to copy');
  result.append(address,actions);
  result.hidden=false;
}
formHandler($('#inviteForm'),async fields=>{
  const result=await api('invite',fields);
  $('#inviteForm').reset();
  await dashboard();
  share('#inviteResult',result.link,'Your Lecture Studio invitation','Send this private link to '+fields.email+'. It works once and expires in seven days.');
});
$('#logout').onclick=()=>run(async()=>{
  if(working||uploadInProgress||['recording','paused'].includes(recorder?.state)) return status('Finish the recording or review in progress first.',true);
  if((audio||pendingChanges)&&!confirm('Leave the current unsaved work?'))return;
  await api('logout',{});
  location.assign(location.pathname);
});
for(const item of document.querySelectorAll('[data-back]')) item.onclick=()=>run(async()=>{
  if(working||uploadInProgress||['recording','paused'].includes(recorder?.state))return status('Finish this action before leaving.',true);
  if(pendingChanges&&!confirm('Leave without saving these edits?')) return;
  status('');await dashboard();
});
$('#newLecture').onclick=()=>{
  if(window.LectureDemo)return status('The example contains a prepared lesson. Open the private classroom to record your own.');
  if(audio){route('recorder');return;}
  recordForm.reset();uploadingId=null;
  route('recorder');status('');
};
const capture=window.LectureCapture;
const recoveryOwner=()=>home?.me?.email||'';
let segmentPlayback=0;
function showLocalAudio(){
  if(playbackURL)URL.revokeObjectURL(playbackURL);
  const first=audio?.clips[0];if(first){playbackURL=URL.createObjectURL(first.blob);$('#localAudio').src=playbackURL;$('#localAudio').hidden=false;}
  $('#downloadAudio').hidden=!first;$('#downloadAudio').href='#';$('#downloadAudio').textContent='Download recovery ZIP';
  const size=(audio?.clips||[]).reduce((n,c)=>n+c.blob.size,0);$('#audioSelection').textContent=(audio?.clips.length||0)+' segment(s) · '+Math.round(size/1024)+' KB ready to save';
  $('#saveRecording').disabled=!first||size>capture.maxTotal;
}
$('#downloadAudio').onclick=event=>{event.preventDefault();run(async()=>{if(!audio?.clips.length)return;const blob=await capture.zip(audio.clips),url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='Lecture-Studio-recovery.zip';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});};
$('#recoverRecording').onclick=()=>run(async()=>{const saved=await capture.recovery(recoveryOwner(),'get');if(!saved?.clips?.length)return status('No local recording recovery was found for this account.');if(audio&&!confirm('Replace the unsaved selection with the local recovery?'))return;audio={clips:saved.clips};recordForm.elements.title.value=saved.title||'';showLocalAudio();status('Local recording recovered. Review and save it to your classroom.');});
$('#startRecording').onclick=()=>run(async()=>{
  if(!recordForm.elements.consent.checked)return recordForm.elements.consent.reportValidity();
  const old=await capture.recovery(recoveryOwner(),'get').catch(()=>null);
  if((audio||old?.clips?.length)&&!confirm('Start a new recording and replace the existing local recovery? Download a recovery ZIP first if needed.'))return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Microphone recording is unavailable. Choose audio clips instead.');
  $('#startRecording').disabled=true;
  try{mediaStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});}catch(failure){$('#startRecording').disabled=false;throw failure;}
  audio={clips:[]};uploadingId=null;
  recorder=new capture.RollingRecorder(mediaStream,{
    onsegment:async clip=>{audio.clips.push(clip);showLocalAudio();$('#saveRecording').disabled=true;if(audio.clips.reduce((n,c)=>n+c.blob.size,0)>=capture.maxTotal*.94)recorder.stop();await capture.recovery(recoveryOwner(),'put',{clips:audio.clips,title:recordForm.elements.title.value}).catch(()=>status('Local recovery could not be saved. Download the recovery ZIP before leaving.',true));},
    onstop:()=>{clearInterval(timer);$('#startRecording').disabled=false;$('#stopRecording').disabled=true;$('#audioFile').disabled=false;$('#pauseRecording').hidden=true;showLocalAudio();status('Recording stopped. Save all segments to continue.');},
    onerror:failure=>status(failure.message,true)
  });
  recorder.start();const started=Date.now();pausedMilliseconds=0;pauseStarted=0;
  $('#recordTime').textContent='00:00';timer=setInterval(()=>{const seconds=Math.floor((Date.now()-started-pausedMilliseconds-(pauseStarted?Date.now()-pauseStarted:0))/1000);$('#recordTime').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');},250);
  $('#pauseRecording').hidden=false;$('#pauseRecording').textContent='Pause';$('#stopRecording').disabled=false;$('#audioFile').disabled=true;$('#saveRecording').disabled=true;
  status('Recording… Segments save locally every two minutes. Keep this page open.');
});
let pauseStarted=0;
let pausedMilliseconds=0;
$('#pauseRecording').onclick=()=>{
  if(recorder?.state==='recording'){
    recorder.pause();pauseStarted=Date.now();$('#pauseRecording').textContent='Resume';status('Recording paused.');
  }else if(recorder?.state==='paused'){
    pausedMilliseconds+=Date.now()-pauseStarted;pauseStarted=0;recorder.resume();$('#pauseRecording').textContent='Pause';status('Recordingâ€¦');
  }
};
$('#stopRecording').onclick=()=>{if(recorder&&['recording','paused'].includes(recorder.state)){recorder.stop();status('Recording stopped. Save it to continue.');}};
$('#audioFile').onchange=event=>run(async()=>{
  const files=[...event.target.files].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));if(!files.length)return;
  if(files.length>60||files.reduce((n,f)=>n+f.size,0)>capture.maxTotal)throw new Error('Choose at most 60 clips totalling up to 64 MB.');
  const clips=[];let offset=0;
  for(const file of files){
    const mime=file.type==='video/webm'?'audio/webm':file.type;
    if(!['audio/webm','audio/ogg','audio/mp4','audio/wav','audio/mpeg'].includes(mime)||file.size>capture.maxSegment)throw new Error('Choose audio clips of up to 8 MB each.');
    status('Checking '+file.name+'…');const duration=await capture.duration(file);
    if(duration>180||duration<=0)throw new Error(file.name+' is longer than three minutes. Split long imports into ordered clips first. New microphone recordings are segmented automatically.');
    clips.push({blob:file,mime,duration,offset});offset+=duration;
  }
  if(offset>7200)throw new Error('A lecture can contain up to 120 minutes of audio.');
  audio={clips};uploadingId=null;showLocalAudio();status('Audio clips ready in filename order.');
});
formHandler(recordForm,async fields=>{
  if(!audio?.clips?.length)throw new Error('Record or choose audio clips first.');
  uploadInProgress=true;$('#audioFile').disabled=true;$('#startRecording').disabled=true;
  try{
    if(!uploadingId)uploadingId=(await api('create',{title:fields.title})).id;
    for(const [clipIndex,clip] of audio.clips.entries()){
      const count=Math.ceil(clip.blob.size/chunkSize);
      for(let part=0;part<count;part++){status('Saving segment '+(clipIndex+1)+' of '+audio.clips.length+' · part '+(part+1)+' of '+count+'…');await api('lecture/'+uploadingId+'/clips/'+clipIndex+'/part/'+part,undefined,{method:'POST',body:clip.blob.slice(part*chunkSize,(part+1)*chunkSize)});}
      await api('lecture/'+uploadingId+'/clips/'+clipIndex+'/finish',{count,mime:clip.mime,offset:clip.offset,duration:clip.duration});
    }
    const target=uploadingId;await api('lecture/'+target+'/finish_set',{count:audio.clips.length});
    await capture.recovery(recoveryOwner(),'delete').catch(()=>{});
    if(playbackURL)URL.revokeObjectURL(playbackURL);$('#localAudio').removeAttribute('src');$('#localAudio').hidden=true;$('#downloadAudio').hidden=true;$('#audioSelection').textContent='';$('#recordTime').textContent='00:00';audio=null;uploadingId=null;playbackURL=null;
    status('All recording segments saved.');await openLecture(target);
  }finally{uploadInProgress=false;$('#audioFile').disabled=false;$('#startRecording').disabled=false;}
});
async function openLecture(id){
  lecture=await api('lecture/'+id);
  $('#lectureTitle').textContent=lecture.title;
  $('#lectureStatus').textContent=lecture.published?'Published to enrolled students':'Draft Â· teacher access';
  pipelineState=window.LectureDemo?{job:null,clips:[]}:await api('lecture/'+id+'/status');
  const source=$('#sourceAudio');
  source.hidden=!lecture.audio_parts&&!pipelineState.clips.length;
  $('#audioUnavailable').hidden=!!lecture.audio_parts||!!pipelineState.clips.length;
  $('#clipPickerLabel').hidden=!pipelineState.clips.length;
  $('#clipPicker').replaceChildren(...pipelineState.clips.map(row=>{const item=node('option','Segment '+(row.clip+1)+' · '+Math.floor(row.offset/60)+':'+String(Math.floor(row.offset%60)).padStart(2,'0'));item.value=row.clip;return item}));
  if(pipelineState.clips.length){source.src='/api/lecture/'+id+'/clips/0';$('#clipPicker').onchange=()=>{source.src='/api/lecture/'+id+'/clips/'+$('#clipPicker').value;};}
  if(lecture.audio_parts)source.src=window.LectureDemo?'example-lecture.wav':'/api/lecture/'+id+'/audio';
  const teacher=home.me.role==='teacher';
  $('#teacherReview').hidden=!teacher;
  $('#studentReview').hidden=teacher;
  $('#shareResult').hidden=true;
  if(teacher){
    pendingChanges=false;
    $('#teacherConfirmed').checked=false;
    renderChecks();
    renderOutline();
    const notes=$('#teacherNotes');
    notes.replaceChildren();
    for(const note of lecture.notes||[]){
      const item=node('article','','student-note');
      item.append(node('h3',note.name),node('p',note.body));
      notes.append(item);
    }
    if(!notes.children.length)notes.append(node('p','Student notes will appear here.'));
  }else{
    $('#noteForm').elements.body.value=lecture.note||'';
  }
  for(const tab of document.querySelectorAll('[data-detail-tab]')){
    tab.hidden=!teacher&&['review','edit'].includes(tab.dataset.detailTab);
  }
  renderLesson();
  detailTab('lesson');
  route('detail');
  renderBackground();clearInterval(backgroundTimer);
  if(!window.LectureDemo&&home.me.role==='teacher')backgroundTimer=setInterval(()=>run(refreshBackground),5000);
}
function detailTab(tab){
  for(const button of document.querySelectorAll('[data-detail-tab]'))button.setAttribute('aria-pressed',button.dataset.detailTab===tab);
  for(const panel of document.querySelectorAll('[data-detail-panel]'))panel.hidden=panel.dataset.detailPanel!==tab;
}
for(const tab of document.querySelectorAll('[data-detail-tab]'))tab.onclick=()=>detailTab(tab.dataset.detailTab);
function renderLesson(){
  const sections=lecture.sections||[];
  const container=$('#lessonSections');
  const contents=$('#lessonContents');
  container.replaceChildren();contents.replaceChildren();
  const words=sections.reduce((count,section)=>count+section.body.trim().split(/\s+/).filter(Boolean).length,0);
  $('#lessonMeta').textContent=sections.length?sections.length+' sections Â· '+Math.max(1,Math.ceil(words/200))+' min read':'The structured lesson will appear after the review passes.';
  if(!sections.length){
    const empty=node('div','','empty-lesson');
    empty.append(node('h3','Your lesson starts with the recording.'),node('p','Run transcription and checks, then review the summary and topic headings.','muted'));
    if(home.me.role==='teacher')empty.append(button('Open transcript & checks',()=>detailTab('review')));
    container.append(empty);
    return;
  }
  sections.forEach((section,index)=>{
    const type=section.heading.toLowerCase();
    const article=node('article','','lesson-section'+(type==='lecture summary'?' summary-section':type==='key takeaways'?' takeaways':''));
    article.id='lesson-section-'+index;
    article.append(node('h3',section.heading));
    if(type==='key takeaways'){
      const list=document.createElement('ul');
      section.body.split('\n').map(value=>value.replace(/^\s*(?:[-â€¢*]|\d+[.)])\s*/,'').trim()).filter(Boolean).forEach(value=>list.append(node('li',value)));
      article.append(list);
    }else article.append(node('p',section.body));
    container.append(article);
    const item=node('a',section.heading);item.href='#'+article.id;contents.append(item);
  });
}
$('#exportLesson').onclick=()=>{
  if(!lecture.sections?.length)return status('Generate or write lesson sections first.');
  const text=lecture.title+'\n\n'+lecture.sections.map(row=>row.heading+'\n'+row.body).join('\n\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=(lecture.title.replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,70)||'lecture')+'.txt';anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('#printLesson').onclick=()=>window.print();
$('#copyTranscript').onclick=()=>run(async()=>{
  if(!lecture.transcript)return status('The source transcript is not available yet.');
  await navigator.clipboard.writeText(lecture.transcript);status('Transcript copied.');
});
function renderChecks(){
  const list=$('#checkList');
  list.replaceChildren();
  for(const check of lecture.checks||[]){
    const row=node('li','');
    const details=document.createElement('details');details.append(node('summary',check.label),node('p',check.findings));
    row.append(details);list.append(row);
  }
  if(!list.children.length)list.append(node('li','Transcription has not started.'));
  $('#transcript').textContent=lecture.transcript||'The first transcription will appear here.';
  $('#process').hidden=!!lecture.published||lecture.checks?.length===5;
  if(jobBusy()&&Date.now()-new Date(pipelineState.job.updated_at).getTime()<10*60*1000)$('#process').hidden=true;
  $('#process').disabled=working||(!lecture.audio_parts&&!pipelineState.ready);
  const count=lecture.checks?.length||0;
  $('#process').textContent=pipelineState.job?.status==='failed'?'Retry background processing':jobBusy()?'Resume stalled processing':'Process in background';
  $('#checkCount').textContent=count+' of 5 complete';
  $('#reviewProgress').value=count;
  for(const control of outlineForm.querySelectorAll('input,textarea,button'))control.disabled=working||!!jobBusy();
  $('#deleteLecture').disabled=working||!!jobBusy();
  $('#share').hidden=!lecture.published;
  $('#reviewConfirm').hidden=!!lecture.published;
  $('#publish').hidden=!!lecture.published;
  updatePublish();
}
function updatePublish(){
  $('#publish').disabled=working||!!jobBusy()||pendingChanges||lecture?.checks?.length!==5||!$('#teacherConfirmed').checked;
  $('#editState').textContent=pendingChanges?'Unsaved changes':'Saved';
}
$('#teacherConfirmed').onchange=updatePublish;
function sectionInput(section={heading:'',body:''}){
  const row=node('div','','outline-row');
  const heading=node('label','Heading');
  const name=document.createElement('input');name.required=true;name.maxLength=160;name.value=section.heading;name.className='heading';
  heading.append(name);
  const bodyLabel=node('label','Content');
  const text=document.createElement('textarea');text.required=true;text.maxLength=4500;text.value=section.body;text.className='body';
  bodyLabel.append(text);
  const tools=node('div','','outline-tools');
  tools.append(node('small','Section'),button('Move up',()=>{
    if(row.previousElementSibling){row.previousElementSibling.before(row);pendingChanges=true;updatePublish();}
  }),button('Move down',()=>{
    if(row.nextElementSibling){row.nextElementSibling.after(row);pendingChanges=true;updatePublish();}
  }),button('Remove',()=>{row.remove();pendingChanges=true;updatePublish();}));
  row.append(heading,bodyLabel,tools);
  $('#outline').append(row);
}
function renderOutline(){
  outlineForm.elements.title.value=lecture.title;
  $('#outline').replaceChildren();
  for(const section of lecture.sections||[]) sectionInput(section);
}
outlineForm.oninput=()=>{pendingChanges=true;updatePublish();};
$('#addSection').onclick=()=>{
  if($('#outline').children.length>=120)return status('The lecture can have up to 120 sections.',true);
  sectionInput();pendingChanges=true;updatePublish();
};
formHandler(outlineForm,async fields=>{
  if(working)return;
  const sections=[...$('#outline').querySelectorAll('.outline-row')].map(row=>({heading:row.querySelector('.heading').value,body:row.querySelector('.body').value}));
  await api('lecture/'+lecture.id+'/edit',{title:fields.title,sections});
  await openLecture(lecture.id);
  status('Lecture edits saved.');
});
function renderBackground(){
  const job=pipelineState.job;$('#backgroundStatus').hidden=!job||home.me.role!=='teacher';
  if(!job)return;
  $('#backgroundMessage').textContent=job.message+' · '+job.status;
  $('#workStatus').textContent=job.message;
  $('#backgroundProgress').value=job.status==='complete'?100:Math.min(95,Math.round(job.cursor/(job.total+Math.ceil(job.total/8)+1)*100));
  const rows=$('#segmentFindings');rows.replaceChildren();
  for(const clip of pipelineState.clips.filter(c=>c.findings?.length)){const details=document.createElement('details');details.append(node('summary','Segment '+(clip.clip+1)+' · source review'));for(const finding of clip.findings)for(const [label,value] of Object.entries(finding))details.append(node('p',label+': '+value,'muted'));rows.append(details);}
}
async function refreshBackground(){
  if(!lecture||$('#detail').hidden)return;
  const was=pipelineState.job?.status;
  pipelineState=await api('lecture/'+lecture.id+'/status');
  renderBackground();renderChecks();
  if(pipelineState.job?.status==='complete'&&was!=='complete'){
    lecture=await api('lecture/'+lecture.id);renderLesson();renderOutline();renderChecks();status('Lesson ready. Review the source recording and notes before publishing.');
    if(window.Notification?.permission==='granted')try{new Notification('Lecture Studio',{body:'Your lesson is ready for teacher review.'})}catch{}
  }
}
$('#notifyProcessing').onclick=()=>run(async()=>{if(!('Notification' in window))return status('This browser does not support page completion alerts. Saved progress is available when you return.');const result=await Notification.requestPermission();status(result==='granted'?'Completion alerts enabled while this page is open.':'Alerts were not enabled. Processing progress stays saved online.');});
$('#process').onclick=()=>run(async()=>{
  if(working)return;if(pendingChanges&&!confirm('Processing will replace the unsaved draft. Continue?'))return;
  working=true;renderChecks();
  try{await api('lecture/'+lecture.id+'/process',{});pendingChanges=false;await refreshBackground();status('Processing started in the background. You can close this tab and return later.');}finally{working=false;renderChecks();}
});
$('#publish').onclick=()=>run(async()=>{
  if(!$('#teacherConfirmed').checked||pendingChanges||working)return;
  await api('lecture/'+lecture.id+'/publish',{});
  await openLecture(lecture.id);
  status('Published to enrolled students.');
});
$('#share').onclick=()=>share('#shareResult',location.origin+'/?lecture='+lecture.id,lecture.title,'Students must sign in to open this lecture.');
$('#deleteLecture').onclick=()=>run(async()=>{
  if(working)return;
  if(!confirm('Delete this lecture, recording and attached notes?'))return;
  await api('lecture/'+lecture.id+'/delete',{});
  status('Lecture deleted.');await dashboard();
});
formHandler($('#noteForm'),async fields=>{
  await api('lecture/'+lecture.id+'/note',fields);
  status('Notes saved for you and your teacher.');
});
window.addEventListener('beforeunload',event=>{
  if(audio||pendingChanges||['recording','paused'].includes(recorder?.state)||uploadInProgress||working){event.preventDefault();event.returnValue='';}
});
enterClassroom().catch(error=>{route('auth');if(error.status!==401)status(error.message,true);});
