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
  if(id!=='detail') $('#sourceAudio').removeAttribute('src');
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
  $('#user').textContent=home.me.name+' · '+home.me.role;
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
  const rows=[...home.lectures].sort((a,b)=>b.created_at.localeCompare(a.created_at));
  for(const row of rows){
    const item=node('li','');
    const label=node('div',row.title);
    label.append(node('small',row.published?'Published':'Draft'));
    item.append(label,button('Open',()=>run(()=>openLecture(row.id))));
    list.append(item);
  }
  if(!rows.length) list.append(node('li',teacher?'Start by recording a lecture.':'Your teacher has not published a lecture yet.'));
  renderStudents();
  pendingChanges=false;
  route('workspace');
}
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
    const row=node('li',invite.email+' · invited');
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
  if(working||uploadInProgress||recorder?.state==='recording') return status('Finish the recording or review in progress first.',true);
  if((audio||pendingChanges)&&!confirm('Leave the current unsaved work?'))return;
  await api('logout',{});
  location.assign(location.pathname);
});
for(const item of document.querySelectorAll('[data-back]')) item.onclick=()=>run(async()=>{
  if(working||uploadInProgress||recorder?.state==='recording')return status('Finish this action before leaving.',true);
  if(pendingChanges&&!confirm('Leave without saving these edits?')) return;
  status('');await dashboard();
});
$('#newLecture').onclick=()=>{
  if(audio){route('recorder');return;}
  recordForm.reset();uploadingId=null;
  route('recorder');status('');
};
function rememberAudio(blob,mime){
  audio={blob,mime};
  if(playbackURL) URL.revokeObjectURL(playbackURL);
  playbackURL=URL.createObjectURL(blob);
  $('#localAudio').src=playbackURL;
  $('#localAudio').hidden=false;
  $('#downloadAudio').href=playbackURL;
  $('#downloadAudio').download='lecture.'+({ 'audio/mp4':'m4a','audio/wav':'wav','audio/mpeg':'mp3','audio/ogg':'ogg'}[mime]||'webm');
  $('#downloadAudio').hidden=false;
  $('#audioSelection').textContent=Math.round(blob.size/1024)+' KB ready to save';
  $('#saveRecording').disabled=blob.size>maxAudio;
  if(blob.size>maxAudio)status('This recording exceeds 8 MB. Download the backup and split it before uploading.',true);
}
$('#startRecording').onclick=()=>run(async()=>{
  if(!recordForm.elements.consent.checked) return recordForm.elements.consent.reportValidity();
  if(audio&&!confirm('Replace this unsaved recording?'))return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder) throw new Error('Microphone recording is unavailable. Choose an audio file instead.');
  mediaStream=await navigator.mediaDevices.getUserMedia({audio:true});
  const preferred=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
  try{recorder=new MediaRecorder(mediaStream,{audioBitsPerSecond:32000,...(preferred?{mimeType:preferred}:{})});}
  catch(error){mediaStream.getTracks().forEach(track=>track.stop());throw error;}
  const parts=[];
  let size=0;
  recorder.ondataavailable=event=>{
    if(event.data.size){parts.push(event.data);size+=event.data.size;}
    if(size>=maxAudio*0.96&&recorder.state==='recording') recorder.stop();
  };
  recorder.onstop=()=>{
    clearInterval(timer);
    mediaStream.getTracks().forEach(track=>track.stop());
    $('#startRecording').disabled=false;$('#stopRecording').disabled=true;$('#audioFile').disabled=false;
    $('#saveRecording').disabled=false;
    const mime=recorder.mimeType.split(';')[0]||'audio/webm';
    rememberAudio(new Blob(parts,{type:mime}),mime);
  };
  recorder.onerror=()=>{status('The microphone stopped unexpectedly.',true);if(recorder.state==='recording')recorder.stop();};
  recorder.start(1000);
  const started=Date.now();
  $('#recordTime').textContent='00:00';
  timer=setInterval(()=>{
    const seconds=Math.floor((Date.now()-started)/1000);
    $('#recordTime').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  },250);
  uploadingId=null;
  $('#startRecording').disabled=true;$('#stopRecording').disabled=false;$('#audioFile').disabled=true;$('#saveRecording').disabled=true;
  status('Recording…');
});
$('#stopRecording').onclick=()=>{if(recorder?.state==='recording'){recorder.stop();status('Recording stopped. Save it to continue.');}};
$('#audioFile').onchange=event=>{
  const file=event.target.files[0];
  if(!file)return;
  const mime=file.type==='video/webm'?'audio/webm':file.type;
  if(!['audio/webm','audio/ogg','audio/mp4','audio/wav','audio/mpeg'].includes(mime))return status('Choose a WebM, Ogg, M4A, WAV or MP3 audio file.',true);
  uploadingId=null;status('');rememberAudio(file,mime);
};
formHandler(recordForm,async fields=>{
  if(!audio?.blob.size||audio.blob.size>maxAudio)throw new Error('Record or choose an audio file of up to 8 MB.');
  uploadInProgress=true;
  $('#audioFile').disabled=true;$('#startRecording').disabled=true;
  try{
    if(!uploadingId) uploadingId=(await api('create',{title:fields.title})).id;
    const count=Math.ceil(audio.blob.size/chunkSize);
    for(let index=0;index<count;index++){
      status('Saving recording '+(index+1)+' of '+count+'…');
      await api('lecture/'+uploadingId+'/audio/'+index,undefined,{method:'POST',body:audio.blob.slice(index*chunkSize,(index+1)*chunkSize)});
    }
    const target=uploadingId;
    await api('lecture/'+target+'/finish',{count,mime:audio.mime});
    if(playbackURL)URL.revokeObjectURL(playbackURL);
    $('#localAudio').removeAttribute('src');$('#localAudio').hidden=true;$('#downloadAudio').hidden=true;
    $('#audioSelection').textContent='';$('#recordTime').textContent='00:00';
    audio=null;uploadingId=null;playbackURL=null;
    status('Recording saved.');
    await openLecture(target);
  }finally{uploadInProgress=false;$('#audioFile').disabled=false;$('#startRecording').disabled=false;}
});
async function openLecture(id){
  lecture=await api('lecture/'+id);
  $('#lectureTitle').textContent=lecture.title;
  $('#lectureStatus').textContent=lecture.published?'Published to enrolled students':'Draft · teacher access';
  const source=$('#sourceAudio');
  source.hidden=!lecture.audio_parts;
  $('#audioUnavailable').hidden=!!lecture.audio_parts;
  if(lecture.audio_parts)source.src='/api/lecture/'+id+'/audio';
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
    const sections=$('#publishedSections');
    sections.replaceChildren();
    for(const section of lecture.sections||[]){
      const item=node('article','','published-row');
      item.append(node('h3',section.heading),node('p',section.body));
      sections.append(item);
    }
    $('#noteForm').elements.body.value=lecture.note||'';
  }
  route('detail');
}
function renderChecks(){
  const list=$('#checkList');
  list.replaceChildren();
  for(const check of lecture.checks||[]){
    const row=node('li','');row.append(node('strong',check.label),node('p',check.findings));list.append(row);
  }
  if(!list.children.length)list.append(node('li','Transcription has not started.'));
  $('#transcript').textContent=lecture.transcript||'The first transcription will appear here.';
  $('#process').hidden=!!lecture.published||lecture.checks?.length===5;
  $('#process').disabled=working||!lecture.audio_parts;
  $('#share').hidden=!lecture.published;
  $('#reviewConfirm').hidden=!!lecture.published;
  $('#publish').hidden=!!lecture.published;
  updatePublish();
}
function updatePublish(){
  $('#publish').disabled=working||pendingChanges||lecture?.checks?.length!==5||!$('#teacherConfirmed').checked;
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
  row.append(heading,bodyLabel,button('Remove section',()=>{row.remove();pendingChanges=true;updatePublish();}));
  $('#outline').append(row);
}
function renderOutline(){
  outlineForm.elements.title.value=lecture.title;
  $('#outline').replaceChildren();
  for(const section of lecture.sections||[]) sectionInput(section);
}
outlineForm.oninput=()=>{pendingChanges=true;updatePublish();};
$('#addSection').onclick=()=>{
  if($('#outline').children.length>=40)return status('The lecture can have up to 40 sections.',true);
  sectionInput();pendingChanges=true;updatePublish();
};
formHandler(outlineForm,async fields=>{
  const sections=[...$('#outline').querySelectorAll('.outline-row')].map(row=>({heading:row.querySelector('.heading').value,body:row.querySelector('.body').value}));
  await api('lecture/'+lecture.id+'/edit',{title:fields.title,sections});
  await openLecture(lecture.id);
  status('Lecture edits saved.');
});
$('#process').onclick=()=>run(async()=>{
  if(working)return;
  if(pendingChanges&&!confirm('Start review passes and replace unsaved edits?')) return;
  working=true;
  $('#process').disabled=true;
  updatePublish();
  const id=lecture.id;
  try{
    let step=lecture.checks?.length||0;
    while(step<5){
      $('#workStatus').textContent='Working through the transcript. '+step+' of 5 review passes saved.';
      const result=await api('lecture/'+id+'/process',{});
      step=result.step;
      lecture=await api('lecture/'+id);
      renderChecks();
    }
    $('#workStatus').textContent='Five passes saved. Listen to flagged passages and edit the lecture before publishing.';
    pendingChanges=false;
    renderOutline();
  } finally {working=false;renderChecks();}
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
  if(audio||pendingChanges||recorder?.state==='recording'||uploadInProgress){event.preventDefault();event.returnValue='';}
});
enterClassroom().catch(error=>{route('auth');if(error.status!==401)status(error.message,true);});
