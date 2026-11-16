import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireTeacher, ApiError, handleApiError } from '@/lib/rbac';
import { getStorageProvider } from '@/lib/providers/storage';
import { getSpeechToTextProvider } from '@/lib/providers/stt';
import { runLectureAnalysis, transcriptToPromptText } from '@/lib/ai-analysis';
export const dynamic='force-dynamic';
const schema=z.object({audioDataUrl:z.string().max(29*1024*1024).optional(),durationSec:z.number().min(0).max(36000).optional(),manualText:z.string().max(200000).optional(),clientSegments:z.array(z.object({text:z.string().max(10000),startTimeSec:z.number().min(0),endTimeSec:z.number().min(0),language:z.string().optional()})).max(20000).optional(),generateSummary:z.boolean().optional()});
export async function POST(req:Request,{params}:{params: Promise<{ lectureId: string }>}){
  const routeParams = await params;
 try{
  await requireTeacher();
  const body=schema.parse(await req.json());
  const lecture=await prisma.lecture.findUnique({where:{id:routeParams.lectureId}});
  if(!lecture)throw new ApiError(404,'Lecture not found');
  if(lecture.status==='PUBLISHED')throw new ApiError(409,'Unpublish before changing the recording.');
  const recording=await prisma.lectureRecording.findFirst({where:{lectureId:lecture.id},orderBy:{createdAt:'desc'},include:{segments:{orderBy:{sequenceIndex:'asc'}}}});
  if(!recording)throw new ApiError(409,'Start a recording before saving.');
  const storage=getStorageProvider(),masterKey=`lectures/${lecture.id}/recordings/${recording.id}/master.webm`;
  if(body.audioDataUrl){
   const match=body.audioDataUrl.match(/^data:audio\/(?:webm|ogg|mp4|wav)(?:;codecs=[^;,]+)?;base64,([A-Za-z0-9+/=]+)$/);
   if(!match)throw new ApiError(400,'Invalid audio file.');
   const bytes=Buffer.from(match[1]!,'base64');if(!bytes.length||bytes.length>20*1024*1024)throw new ApiError(413,'Audio must be between 1 byte and 20 MB.');
   await storage.put(masterKey,bytes,'audio/webm');
  }else if(!recording.isFinalized){
   if(!recording.segments.length||recording.segments.some((s,i)=>s.sequenceIndex!==i||s.status!=='uploaded'))throw new ApiError(409,'Some audio blocks are missing. Retry the uploads or recover the full audio from this browser.');
   const buffers:Buffer[]=[];let size=0;
   for(const seg of recording.segments){const data=await storage.getBytes(seg.storageKey);size+=data.length;if(size>256*1024*1024)throw new ApiError(413,'Recording is too large to merge here. Keep your browser recovery copy.');buffers.push(data);}
   await storage.put(masterKey,Buffer.concat(buffers),'audio/webm');
  }
  const finalized=await prisma.lectureRecording.update({where:{id:recording.id},data:{isFinalized:true,finalizedAt:new Date(),storageKey:masterKey,totalDurationSec:body.durationSec||recording.totalDurationSec||0,audioBase64:null}});
  await prisma.lecture.update({where:{id:lecture.id},data:{status:'IN_REVIEW',actualDuration:Math.round(body.durationSec||0)}});
  let transcriptionStatus='ready',summaryStatus='not_requested',warning:string|undefined;
  try{
   let segments=body.clientSegments?.filter(s=>s.text.trim());
   if(!segments?.length&&body.manualText?.trim())segments=[{text:body.manualText.trim(),startTimeSec:0,endTimeSec:body.durationSec||0,language:lecture.primaryLanguage}];
   if(!segments?.length){const result=await getSpeechToTextProvider().transcribe({storageKey:masterKey});segments=result.segments.map(s=>({text:s.text,startTimeSec:s.startSec,endTimeSec:s.endSec,language:({en:'ENGLISH',ur:'URDU',pa:'PUNJABI'} as Record<string,string>)[s.language]||'MIXED_URDU_ENGLISH'}));}
   if(!segments.length)throw new Error('No speech detected.');
   const speaker=await prisma.speaker.upsert({where:{lectureId_rawLabel:{lectureId:lecture.id,rawLabel:'SPEAKER_00'}},create:{lectureId:lecture.id,rawLabel:'SPEAKER_00',displayName:'Instructor',role:'TEACHER'},update:{}});
   await prisma.$transaction([prisma.transcriptSegment.deleteMany({where:{lectureId:lecture.id}}),...segments.map(s=>prisma.transcriptSegment.create({data:{lectureId:lecture.id,speakerId:speaker.id,speakerRole:'TEACHER',startTimeSec:s.startTimeSec,endTimeSec:Math.max(s.endTimeSec,s.startTimeSec),text:s.text.trim(),language:(['ENGLISH','URDU','PUNJABI','MIXED_URDU_ENGLISH'].includes(s.language||'')?s.language:'MIXED_URDU_ENGLISH') as any,segmentType:'TEACHER_EXPLANATION'}}))]);
   if(body.generateSummary){
    try{const saved=await prisma.transcriptSegment.findMany({where:{lectureId:lecture.id},orderBy:{startTimeSec:'asc'}});await runLectureAnalysis({lectureId:lecture.id,type:'SUMMARY_SHORT',transcriptText:transcriptToPromptText(saved),jsonSchemaHint:'{"summary": "A concise factual summary of this lecture, with key points. Do not invent facts."}'});summaryStatus='ready_for_teacher_review';}
    catch{summaryStatus='failed';warning='Audio and transcript saved. AI summary failed; reconnect your AI provider and retry in review.';}
   }
  }catch{transcriptionStatus='pending';warning='Audio saved. Transcription failed or is not configured. You can download your audio, retry transcription, or enter the real transcript. No placeholder speech was generated.';}
  return NextResponse.json({recording:finalized,transcriptionStatus,summaryStatus,warning},{headers:{'Cache-Control':'private, no-store'}});
 }catch(err){return handleApiError(err);}
}
