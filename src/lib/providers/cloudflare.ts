import { getStorageProvider } from './storage';
import type { LLMProvider, SpeechToTextProvider, LlmMessage, LlmCompletionOptions, TranscriptionResult } from './types';
export async function aiBridge(route: string, body: unknown) {
 const base=process.env.AI_BRIDGE_URL, token=process.env.AI_BRIDGE_TOKEN;
 if(!base||!token) throw new Error('Connect your own AI service in server settings first.');
 const url=new URL(route,base.endsWith('/')?base:base+'/');
 if(url.protocol!=='https:' && !['localhost','127.0.0.1'].includes(url.hostname))throw new Error('AI connection must use HTTPS.');
 const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
 if(!res.ok)throw new Error(res.status===429?'AI free quota reached. Keep the recording and retry later.':'AI service unavailable; your original audio is preserved.');
 return res.json();
}
export class CloudflareSpeechProvider implements SpeechToTextProvider {
 readonly name='cloudflare_whisper';
 async transcribe(audio:{storageKey:string}):Promise<TranscriptionResult>{
  const bytes=await getStorageProvider().getBytes(audio.storageKey);
  if(bytes.length>20*1024*1024)throw new Error('This recording exceeds the 20 MB AI transcription limit. Download it or use your local speech service.');
  const data=await aiBridge('transcribe',{audio:bytes.toString('base64')});
  const language=data.transcription_info?.language||'en';
  const segments=(data.segments||[]).map((s:any)=>({text:String(s.text||'').trim(),startSec:Number(s.start||0),endSec:Number(s.end||0),language})).filter((s:any)=>s.text);
  if(!segments.length && data.text?.trim())segments.push({text:data.text.trim(),startSec:0,endSec:0,language});
  if(!segments.length)throw new Error('No speech was detected. Review the saved audio and retry.');
  return {segments,detectedLanguages:[language]};
 }
}
export class CloudflareLLMProvider implements LLMProvider {
 readonly name='cloudflare_llama_3_2_3b';
 async complete(messages:LlmMessage[],options:LlmCompletionOptions={}){
  const data=await aiBridge('complete',{messages,max_tokens:Math.min(options.maxTokens||1024,2048),jsonMode:!!options.jsonMode});
  const response=typeof data.response==='string'?data.response:JSON.stringify(data.response);
  if(!response?.trim())throw new Error('AI returned no summary.');return response.trim();
 }
}
