-- Additive upgrade: existing accounts, invitations and legacy recordings are retained.
create table lecture_studio_private.clips (
 lecture uuid not null references lecture_studio_private.lectures(id) on delete cascade,
 clip integer not null check(clip between 0 and 59),
 parts integer check(parts between 1 and 8), mime text not null,
 offset_seconds numeric not null check(offset_seconds between 0 and 7200),
 duration_seconds numeric not null check(duration_seconds>0 and duration_seconds<=180),
 transcript text not null default '', segments jsonb not null default '[]', result jsonb,
 primary key(lecture,clip)
);
create table lecture_studio_private.clip_audio (
 lecture uuid not null references lecture_studio_private.lectures(id) on delete cascade,
 clip integer not null check(clip between 0 and 59),part integer not null check(part between 0 and 7),
 bytes bytea not null check(octet_length(bytes) between 1 and 1048576),primary key(lecture,clip,part)
);
create table lecture_studio_private.processing_jobs (
 id uuid primary key default gen_random_uuid(),lecture uuid not null unique references lecture_studio_private.lectures(id) on delete cascade,
 teacher uuid not null references lecture_studio_private.accounts(id) on delete cascade,
 status text not null default 'queued' check(status in('queued','running','retrying','failed','complete')),
 cursor integer not null default 0, total integer not null, phase text not null default 'clips',
 message text not null default 'Waiting for processing', groups jsonb not null default '[]',
 lease text, lease_until timestamptz, updated_at timestamptz not null default now()
);
alter table lecture_studio_private.clips enable row level security;
alter table lecture_studio_private.clip_audio enable row level security;
alter table lecture_studio_private.processing_jobs enable row level security;
create index lecture_processing_teacher on lecture_studio_private.processing_jobs(teacher);
create function public.lecture_studio_pipeline(gateway text,operation text,payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare
 actor lecture_studio_private.accounts%rowtype;
 lesson lecture_studio_private.lectures%rowtype;
 job lecture_studio_private.processing_jobs%rowtype;
 clip_record lecture_studio_private.clips%rowtype;
 target uuid; n integer; count_clips integer; output jsonb;
begin
 if not exists(select 1 from lecture_studio_private.configuration c where c.gateway_hash=encode(sha256(convert_to(coalesce(gateway,''),'UTF8')),'hex')) then return jsonb_build_object('error','Unauthorized','status',401);end if;
 if operation in('claim','clip_work','clip_commit','group_commit','complete','failure','results') then
  select * into job from lecture_studio_private.processing_jobs j where j.id=(payload->>'job')::uuid for update;
  if not found then return jsonb_build_object('gone',true);end if;
  if operation='claim' then
   if job.status='complete' then return jsonb_build_object('done',true);end if;
   if job.status='failed' then return jsonb_build_object('done',true);end if;
   if job.lease_until>now() then return jsonb_build_object('busy',true);end if;
   update lecture_studio_private.processing_jobs set status='running',lease=payload->>'lease',lease_until=now()+interval '8 minutes',updated_at=now(),message=case when phase='clips' then 'Transcribing and reviewing recording '||(cursor+1)||' of '||total else 'Organising lecture summary' end where id=job.id returning * into job;
   return to_jsonb(job)-'teacher'-'lease';
  end if;
  if job.lease is distinct from payload->>'lease' or job.lease_until<=now() then return jsonb_build_object('error','Processing lease expired.','status',409);end if;
  if operation='results' then
   return (select coalesce(jsonb_agg(to_jsonb(c)-'parts'-'mime' order by c.clip),'[]') from lecture_studio_private.clips c where c.lecture=job.lecture);
  elsif operation='failure' then
   update lecture_studio_private.processing_jobs set status=case when coalesce((payload->>'final')::boolean,false) then 'failed' else 'retrying' end,message=left(payload->>'message',500),lease=null,lease_until=null,updated_at=now() where id=job.id;
   return jsonb_build_object('ok',true);
  elsif operation='clip_work' then
   select * into clip_record from lecture_studio_private.clips c where c.lecture=job.lecture and c.clip=job.cursor;
   if found then
    select jsonb_agg(encode(a.bytes,'base64') order by a.part) into output from lecture_studio_private.clip_audio a where a.lecture=job.lecture and a.clip=job.cursor;
    return to_jsonb(clip_record)||jsonb_build_object('audio',output);
   end if;
   -- Legacy single recordings can still be processed through the new background job.
   select * into lesson from lecture_studio_private.lectures where id=job.lecture;
   select jsonb_agg(encode(a.bytes,'base64') order by a.part) into output from lecture_studio_private.audio a where a.lecture=job.lecture;
   return jsonb_build_object('clip',0,'audio',output,'mime',lesson.audio_type,'offset_seconds',0,'duration_seconds',0);
  elsif operation='clip_commit' then
   insert into lecture_studio_private.clips(lecture,clip,parts,mime,offset_seconds,duration_seconds,transcript,segments,result)
    values(job.lecture,job.cursor,null,coalesce(payload->>'mime','audio/webm'),(payload->>'offset')::numeric,greatest(1,least(180,(payload->>'duration')::numeric)),payload->>'transcript',payload->'segments',payload->'result')
    on conflict(lecture,clip) do update set transcript=excluded.transcript,segments=excluded.segments,result=excluded.result;
   update lecture_studio_private.processing_jobs set cursor=cursor+1,phase=case when cursor+1>=total then 'groups' else 'clips' end,lease=null,lease_until=null,updated_at=now() where id=job.id;
  elsif operation='group_commit' then
   update lecture_studio_private.processing_jobs set groups=groups||jsonb_build_array(payload->'group'),cursor=cursor+1,lease=null,lease_until=null,updated_at=now() where id=job.id;
  elsif operation='complete' then
   update lecture_studio_private.lectures set transcript=payload->>'transcript',sections=payload->'sections',checks=payload->'checks' where id=job.lecture and not published;
   update lecture_studio_private.processing_jobs set status='complete',message='Lesson ready for teacher review',phase='complete',lease=null,lease_until=null,updated_at=now() where id=job.id;
  end if;
  return jsonb_build_object('ok',true);
 end if;
 select a.* into actor from lecture_studio_private.sessions s join lecture_studio_private.accounts a on a.id=s.account_id where s.token_hash=payload->>'session' and s.expires>now();
 if actor.id is null then return jsonb_build_object('error','Sign in again.','status',401);end if;
 target:=(payload->>'lecture')::uuid;
 select * into lesson from lecture_studio_private.lectures l where l.id=target and l.teacher=coalesce(actor.owner,actor.id) and(actor.role='teacher' or l.published);
 if not found then return jsonb_build_object('error','Lecture unavailable.','status',404);end if;
 if operation='status' then
  select to_jsonb(j)-'teacher'-'lease'-'lease_until'-'groups' into output from lecture_studio_private.processing_jobs j where j.lecture=target;
  return jsonb_build_object('job',output,'clips',(select coalesce(jsonb_agg(jsonb_build_object('clip',c.clip,'mime',c.mime,'offset',c.offset_seconds,'duration',c.duration_seconds,'reviewed',c.result is not null,'findings',case when actor.role='teacher' then jsonb_path_query_array(c.result,'$.units[*].findings') else null end) order by c.clip),'[]') from lecture_studio_private.clips c where c.lecture=target));
 elsif operation='audio_part' then
  select jsonb_build_object('bytes',encode(a.bytes,'base64')) into output from lecture_studio_private.clip_audio a where a.lecture=target and a.clip=(payload->>'clip')::int and a.part=(payload->>'part')::int;
  return coalesce(output,jsonb_build_object('error','Recording part unavailable.','status',404));
 elsif operation='clip_info' then
  select to_jsonb(c)-'transcript'-'segments'-'result' into output from lecture_studio_private.clips c where c.lecture=target and c.clip=(payload->>'clip')::int;
  return coalesce(output,jsonb_build_object('error','Recording unavailable.','status',404));
 end if;
 if actor.role<>'teacher' then return jsonb_build_object('error','Teacher access required.','status',403);end if;
 if lesson.published then return jsonb_build_object('error','This lecture is already published.','status',409);end if;
 select * into job from lecture_studio_private.processing_jobs j where j.lecture=target;
 if operation='start' then
  if job.id is not null then
   if job.status='failed' then update lecture_studio_private.processing_jobs set status='queued',message='Queued to resume',updated_at=now() where id=job.id;end if;
   return jsonb_build_object('id',job.id,'status',case when job.status='failed' then 'queued' else job.status end);
  end if;
  select count(*) into count_clips from lecture_studio_private.clips c where c.lecture=target and c.parts is not null;
  if count_clips=0 and lesson.audio_parts is null then return jsonb_build_object('error','Save audio first.','status',409);end if;
  insert into lecture_studio_private.processing_jobs(lecture,teacher,total) values(target,actor.id,greatest(count_clips,1)) returning * into job;
  return jsonb_build_object('id',job.id,'status',job.status);
 end if;
 if job.id is not null then return jsonb_build_object('error','Audio is locked once processing starts.','status',409);end if;
 if operation='upload_clip' then
  insert into lecture_studio_private.clip_audio(lecture,clip,part,bytes) values(target,(payload->>'clip')::int,(payload->>'part')::int,decode(payload->>'bytes','base64')) on conflict(lecture,clip,part) do update set bytes=excluded.bytes;
 elsif operation='finish_clip' then
  n:=(payload->>'clip')::int;
  if(select count(*) from lecture_studio_private.clip_audio a where a.lecture=target and a.clip=n)<>(payload->>'count')::int then return jsonb_build_object('error','Recording part missing. Retry upload.','status',409);end if;
  insert into lecture_studio_private.clips(lecture,clip,parts,mime,offset_seconds,duration_seconds) values(target,n,(payload->>'count')::int,payload->>'mime',(payload->>'offset')::numeric,(payload->>'duration')::numeric) on conflict(lecture,clip) do update set parts=excluded.parts,mime=excluded.mime,offset_seconds=excluded.offset_seconds,duration_seconds=excluded.duration_seconds;
 elsif operation='finish_set' then
  select count(*) into count_clips from lecture_studio_private.clips c where c.lecture=target;
  if count_clips<>(payload->>'count')::int or exists(select 1 from lecture_studio_private.clips c where c.lecture=target and(c.clip>=count_clips or c.parts is null)) then return jsonb_build_object('error','Some recordings are missing. Retry upload.','status',409);end if;
  if(select sum(duration_seconds) from lecture_studio_private.clips where lecture=target)>7200 or(select sum(octet_length(bytes)) from lecture_studio_private.clip_audio where lecture=target)>67108864 then return jsonb_build_object('error','Maximum 120 minutes or 64 MB per lecture.','status',413);end if;
 else return jsonb_build_object('error','Unknown operation.','status',404);end if;
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.lecture_studio_pipeline(text,text,jsonb) from public,authenticated;
grant execute on function public.lecture_studio_pipeline(text,text,jsonb) to anon;
