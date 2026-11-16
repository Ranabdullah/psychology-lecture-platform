create schema lecture_studio_private;
revoke all on schema lecture_studio_private from public, anon, authenticated;

create table lecture_studio_private.configuration (
  singleton boolean primary key default true check (singleton),
  gateway_hash text not null,
  teacher_setup_hash text
);
insert into lecture_studio_private.configuration(gateway_hash,teacher_setup_hash)
values ('REPLACE_GATEWAY_HASH','REPLACE_SETUP_HASH');

create table lecture_studio_private.accounts (
  id uuid primary key default gen_random_uuid(),
  owner uuid references lecture_studio_private.accounts(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  password_hash text not null,
  role text not null check (role in ('teacher','student'))
);
create table lecture_studio_private.sessions (
  token_hash text primary key,
  account_id uuid not null references lecture_studio_private.accounts(id) on delete cascade,
  expires timestamptz not null default now()+interval '8 hours'
);
create index lecture_sessions_account on lecture_studio_private.sessions(account_id);
create table lecture_studio_private.invites (
  id uuid primary key default gen_random_uuid(),
  teacher uuid not null references lecture_studio_private.accounts(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires timestamptz not null default now()+interval '7 days',
  unique(teacher,email)
);
create table lecture_studio_private.lectures (
  id uuid primary key default gen_random_uuid(),
  teacher uuid not null references lecture_studio_private.accounts(id) on delete cascade,
  title text not null,
  transcript text not null default '',
  transcript_segments jsonb not null default '[]',
  sections jsonb not null default '[]',
  checks jsonb not null default '[]',
  audio_type text,
  audio_parts integer check(audio_parts between 1 and 8),
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index lecture_teacher_created on lecture_studio_private.lectures(teacher,created_at desc);
create table lecture_studio_private.audio (
  lecture uuid not null references lecture_studio_private.lectures(id) on delete cascade,
  part integer not null check (part between 0 and 7),
  bytes bytea not null check (octet_length(bytes) between 1 and 1048576),
  primary key(lecture,part)
);
create table lecture_studio_private.notes (
  lecture uuid not null references lecture_studio_private.lectures(id) on delete cascade,
  student uuid not null references lecture_studio_private.accounts(id) on delete cascade,
  body text not null,
  modified_at timestamptz not null default now(),
  primary key(lecture,student)
);
alter table lecture_studio_private.configuration enable row level security;
alter table lecture_studio_private.accounts enable row level security;
alter table lecture_studio_private.sessions enable row level security;
alter table lecture_studio_private.invites enable row level security;
alter table lecture_studio_private.lectures enable row level security;
alter table lecture_studio_private.audio enable row level security;
alter table lecture_studio_private.notes enable row level security;

create function public.lecture_studio_gateway(gateway text, operation text, payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  actor lecture_studio_private.accounts%rowtype;
  lecture lecture_studio_private.lectures%rowtype;
  invite lecture_studio_private.invites%rowtype;
  active_id uuid;
  class_owner uuid;
  target uuid;
  output jsonb;
begin
  if not exists (select 1 from lecture_studio_private.configuration c where c.gateway_hash =
    encode(sha256(convert_to(coalesce(gateway,''),'UTF8')),'hex')) then
    return jsonb_build_object('error','Unauthorized','status',401);
  end if;

  if operation='lookup' then
    select jsonb_build_object('id',a.id,'password',a.password_hash) into output
      from lecture_studio_private.accounts a where a.email=payload->>'email';
    return coalesce(output,'{}'::jsonb);
  end if;

  if operation='register' then
    if exists(select 1 from lecture_studio_private.accounts where email=payload->>'email') then
      return jsonb_build_object('error','That email already has a classroom account. Sign in instead.','status',409);
    end if;
    update lecture_studio_private.configuration set teacher_setup_hash=null
      where teacher_setup_hash=payload->>'invite';
    if found then
      insert into lecture_studio_private.accounts(email,display_name,password_hash,role)
        values(payload->>'email',payload->>'name',payload->>'password','teacher') returning id into active_id;
    else
      delete from lecture_studio_private.invites
        where token_hash=payload->>'invite' and email=payload->>'email' and expires>now()
        returning * into invite;
      if not found then return jsonb_build_object('error','The invite is invalid, expired or for another email.','status',403); end if;
      insert into lecture_studio_private.accounts(owner,email,display_name,password_hash,role)
        values(invite.teacher,payload->>'email',payload->>'name',payload->>'password','student') returning id into active_id;
    end if;
    insert into lecture_studio_private.sessions(token_hash,account_id) values(payload->>'newSession',active_id);
    return jsonb_build_object('created',true);
  end if;

  if operation='login' then
    delete from lecture_studio_private.sessions where expires<=now();
    insert into lecture_studio_private.sessions(token_hash,account_id) values(payload->>'newSession',(payload->>'account')::uuid);
    return jsonb_build_object('ok',true);
  end if;

  select a.* into actor from lecture_studio_private.sessions s join lecture_studio_private.accounts a on a.id=s.account_id
    where s.token_hash=payload->>'session' and s.expires>now();
  if actor.id is null then return jsonb_build_object('error','Sign in again.','status',401); end if;
  class_owner := coalesce(actor.owner,actor.id);

  if operation='logout' then
    delete from lecture_studio_private.sessions where token_hash=payload->>'session';
    return jsonb_build_object('ok',true);
  elsif operation='home' then
    return jsonb_build_object('me',jsonb_build_object('name',actor.display_name,'email',actor.email,'role',actor.role),
      'lectures',(select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc),'[]') from
        (select id,title,published,created_at from lecture_studio_private.lectures
          where teacher=class_owner and (actor.role='teacher' or published) limit 200) l),
      'students',case when actor.role='teacher' then
        (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.display_name,'email',a.email)),'[]')
          from lecture_studio_private.accounts a where a.owner=actor.id) else '[]'::jsonb end,
      'invites',case when actor.role='teacher' then
        (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'expires',i.expires)),'[]')
          from lecture_studio_private.invites i where i.teacher=actor.id and i.expires>now()) else '[]'::jsonb end);
  end if;

  if operation in ('invite','revoke_invite','remove_student','create') then
    if actor.role<>'teacher' then return jsonb_build_object('error','Teacher access is required.','status',403); end if;
    if operation='invite' then
      if exists(select 1 from lecture_studio_private.accounts where email=payload->>'email') then
        return jsonb_build_object('error','This email already has a classroom account.','status',409);
      end if;
      insert into lecture_studio_private.invites(teacher,email,token_hash) values(actor.id,payload->>'email',payload->>'invite')
        on conflict (teacher,email) do update set token_hash=excluded.token_hash, expires=now()+interval '7 days';
    elsif operation='revoke_invite' then
      delete from lecture_studio_private.invites where id=(payload->>'target')::uuid and teacher=actor.id;
    elsif operation='remove_student' then
      delete from lecture_studio_private.accounts where id=(payload->>'target')::uuid and owner=actor.id;
    else
      if (select count(*) from lecture_studio_private.lectures where teacher=actor.id)>=20 then
        return jsonb_build_object('error','This classroom can hold 20 lectures.','status',409);
      end if;
      insert into lecture_studio_private.lectures(teacher,title) values(actor.id,payload->>'title') returning id into active_id;
      return jsonb_build_object('id',active_id);
    end if;
    return jsonb_build_object('ok',true);
  end if;

  target := (payload->>'lecture')::uuid;
  select * into lecture from lecture_studio_private.lectures l
    where l.id=target and l.teacher=class_owner and (actor.role='teacher' or l.published);
  if not found then return jsonb_build_object('error','Lecture unavailable.','status',404); end if;

  if operation='detail' then
    output := to_jsonb(lecture)-'transcript_segments';
    if actor.role='student' then
      output := output-'checks'-'transcript'||jsonb_build_object('note',
        (select body from lecture_studio_private.notes where notes.lecture=target and student=actor.id));
    else
      output := output||jsonb_build_object('notes',(
        select coalesce(jsonb_agg(jsonb_build_object('name',a.display_name,'body',n.body,'at',n.modified_at)),'[]')
        from lecture_studio_private.notes n join lecture_studio_private.accounts a on a.id=n.student where n.lecture=target));
    end if;
    return output;
  elsif operation='part' then
    select jsonb_build_object('bytes',encode(a.bytes,'base64'),'type',lecture.audio_type) into output
      from lecture_studio_private.audio a where a.lecture=target and a.part=(payload->>'part')::int;
    return coalesce(output,jsonb_build_object('error','Audio part unavailable.','status',404));
  elsif operation='note' and actor.role='student' then
    insert into lecture_studio_private.notes(lecture,student,body) values(target,actor.id,payload->>'body')
      on conflict (lecture,student) do update set body=excluded.body, modified_at=now();
    return jsonb_build_object('ok',true);
  end if;

  if actor.role<>'teacher' then return jsonb_build_object('error','Teacher access is required.','status',403); end if;
  if operation='upload' then
    if lecture.audio_parts is not null then return jsonb_build_object('error','Recording already saved.','status',409); end if;
    insert into lecture_studio_private.audio(lecture,part,bytes)
      values(target,(payload->>'part')::int,decode(payload->>'bytes','base64'))
      on conflict(lecture,part) do update set bytes=excluded.bytes;
  elsif operation='finish' then
    if (select count(*) from lecture_studio_private.audio where audio.lecture=target)<>(payload->>'count')::int
      or exists(select 1 from lecture_studio_private.audio where audio.lecture=target and part>=(payload->>'count')::int) then
      return jsonb_build_object('error','The recording is incomplete. Retry upload.','status',409);
    end if;
    update lecture_studio_private.lectures set audio_parts=(payload->>'count')::int,audio_type=payload->>'mime' where id=target and audio_parts is null;
  elsif operation='checkpoint' then
    return jsonb_build_object('transcript',lecture.transcript,'segments',lecture.transcript_segments,'sections',lecture.sections,
      'checks',lecture.checks,'audioParts',lecture.audio_parts,'audioType',lecture.audio_type,'published',lecture.published);
  elsif operation='save_checkpoint' then
    update lecture_studio_private.lectures set
      transcript=coalesce(payload->>'transcript',transcript), transcript_segments=coalesce(payload->'segments',transcript_segments),
      sections=coalesce(payload->'sections',sections), checks=coalesce(payload->'checks',checks)
      where id=target and not published and transcript=payload->>'priorTranscript'
        and checks=payload->'priorChecks' and sections=payload->'priorSections';
    if not found then return jsonb_build_object('error','This draft changed. Reload it before continuing.','status',409); end if;
  elsif operation='edit' then
    update lecture_studio_private.lectures set title=payload->>'title', sections=payload->'sections' where id=target;
  elsif operation='publish' then
    update lecture_studio_private.lectures set published=true
      where id=target and jsonb_array_length(checks)=5 and jsonb_array_length(sections)>0;
    if not found then return jsonb_build_object('error','Complete all five checks and add lecture sections before publishing.','status',409); end if;
  elsif operation='delete' then
    delete from lecture_studio_private.lectures where id=target;
  else
    return jsonb_build_object('error','Unknown operation.','status',404);
  end if;
  return jsonb_build_object('ok',true);
exception when unique_violation then
  return jsonb_build_object('error','That classroom record already exists.','status',409);
end;
$$;
revoke all on function public.lecture_studio_gateway(text,text,jsonb) from public, authenticated;
grant execute on function public.lecture_studio_gateway(text,text,jsonb) to anon;
