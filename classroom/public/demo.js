'use strict';
if(new URLSearchParams(location.search).get('demo')==='1'){
  const key='lecture-studio-example-v3';
  const template={
  "title": "How attention and memory support learning",
  "transcript": "Welcome to our lecture on attention and memory. We will distinguish working memory from long-term memory, then examine two study strategies. Working memory holds information briefly while we use it. Attention helps us focus on relevant information. Long-term memory retains knowledge beyond the present moment. Retrieval practice means trying to recall an idea before checking your notes. For example, read one paragraph, close the book, and write down two ideas you remember. Then open the book and correct any mistakes. Spaced practice means returning to the material in separate study sessions. It is different from repeating everything in one long sitting. These strategies help organize study, but understanding the topic is still important. To finish, our routine is to focus on a short explanation, recall two ideas, check them against the source, and return to the topic later. The key points are attention, retrieval and spacing.",
  "sections": [
    {
      "body": "The lecture distinguishes working memory from long-term memory and examines two study strategies. Working memory briefly holds information while it is being used, and attention helps focus on relevant information. Long-term memory retains knowledge beyond the present moment. The lecture also discusses retrieval practice and spaced practice as strategies to organize study.",
      "heading": "Lecture summary"
    },
    {
      "body": "Attention helps us focus on relevant information.\nRetrieval practice involves trying to recall an idea before checking notes.\nSpaced practice means returning to material in separate study sessions.\nUnderstanding the topic is still important in addition to using these strategies.\nThe routine involves focusing on a short explanation, recalling two ideas, checking them against the source, and returning to the topic later.",
      "heading": "Key takeaways"
    },
    {
      "body": "Working memory holds information briefly while we use it, and long-term memory retains knowledge beyond the present moment. Attention plays a role in helping us focus on relevant information.",
      "heading": "Working Memory and Long-term Memory"
    },
    {
      "body": "Retrieval practice involves trying to recall an idea before checking notes, such as reading a paragraph, closing the book, and writing down two remembered ideas. Spaced practice involves returning to the material in separate study sessions, differing from repeating everything in one long sitting.",
      "heading": "Study Strategies: Retrieval and Spaced Practice"
    }
  ],
  "checks": [
    {
      "at": "2026-11-17T20:07:05.133Z",
      "label": "Independent transcription comparison",
      "findings": "There are no substantive disagreements between the two audio transcriptions. The texts are identical, suggesting a high degree of consistency between the two recordings. No quotations require further listening to resolve discrepancies, as the transcripts match exactly."
    },
    {
      "at": "2026-11-17T20:07:05.283Z",
      "label": "Timestamp and coverage checks",
      "findings": "14 segments. 0 overlap(s), 0 gap(s) longer than ten seconds and 0 invalid timestamp(s). Gaps may be silence. Listen to uncertain sections."
    },
    {
      "at": "2026-11-17T20:07:09.620Z",
      "label": "Unclear words and attribution",
      "findings": "The transcript appears to be a cohesive lecture on attention and memory, discussing key concepts such as working memory, long-term memory, retrieval practice, and spaced practice. However, there is no clear indication of speaker changes or attributions, making it uncertain who is speaking at any given time. The language used is formal and instructional, suggesting an academic setting. The absence of disagreements between the two audio transcriptions increases confidence in the accuracy of the transcript, but does not provide additional information about the speaker or context. Some phrases, such as 'our routine' and 'our lecture', imply a shared understanding or protocol, but the speaker's identity and relationships to the audience remain unclear."
    },
    {
      "at": "2026-11-17T20:07:19.432Z",
      "label": "Names, dates and figures",
      "findings": "The transcript discusses 'attention' and 'memory', specifically 'working memory' and 'long-term memory'. It mentions two study strategies: 'retrieval practice' and 'spaced practice'. The wording for 'retrieval practice' is: 'trying to recall an idea before checking your notes', with an example: 'read one paragraph, close the book, and write down two ideas you remember'. 'Spaced practice' is described as: 'returning to the material in separate study sessions'. The transcript flags no specific proper names or dates, but includes specialised terminology such as 'working memory', 'long-term memory', 'retrieval practice', and 'spaced practice' that may require confirmation. No numeric claims are made."
    },
    {
      "at": "2026-11-17T20:07:41.346Z",
      "label": "Lecture outline checked against transcript",
      "findings": "The provided transcript and sections generally align, but some details could be clarified or verified by the teacher for accuracy and completeness."
    }
  ],
  "id": "example-lecture",
  "published": false,
  "created_at": "2026-11-17T09:00:00Z",
  "audio_parts": 1,
  "notes": [
    {
      "name": "Example student",
      "body": "I will recall two ideas, check them against the source and return to them later."
    }
  ]
};
  let sample;
  try{sample=JSON.parse(localStorage.getItem(key));}catch{}
  if(!sample||!Array.isArray(sample.sections))sample=structuredClone(template);
  const save=()=>localStorage.setItem(key,JSON.stringify(sample));
  window.LectureDemo={
    async request(path,data){
      if(path==='home')return {me:{name:'Example teacher',email:'teacher@example.invalid',role:'teacher'},lectures:sample.deleted?[]:[{id:sample.id,title:sample.title,published:sample.published,created_at:sample.created_at}],students:[],invites:[]};
      if(path==='lecture/'+sample.id)return structuredClone(sample);
      if(path==='lecture/'+sample.id+'/edit'){
        if(!data.sections.length)throw new Error('Add a section before saving.');
        sample.title=data.title;sample.sections=structuredClone(data.sections);save();return {ok:true};
      }
      if(path==='lecture/'+sample.id+'/publish'){sample.published=true;save();return {ok:true};}
      if(path==='lecture/'+sample.id+'/delete'){sample.deleted=true;save();return {ok:true};}
      if(path==='logout')return {ok:true};
      throw new Error('Open the private classroom to use accounts, recording and invitations.');
    }
  };
  document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('demoBanner').hidden=false;
    document.getElementById('resetDemo').onclick=()=>{
      if(!confirm('Reset the example lesson and local edits?'))return;
      localStorage.removeItem(key);location.reload();
    };
  });
}
