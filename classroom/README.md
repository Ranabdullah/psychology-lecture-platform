# Lecture Studio classroom

Record a lecture, preserve its transcript and publish a reviewed lesson with a summary, takeaways and topic notes.

[Try the example](https://lecture-studio.ranakaharian1.workers.dev/?demo=1) · [Open the classroom](https://lecture-studio.ranakaharian1.workers.dev/)

## Features

- Teacher and invited student accounts with private classroom records.
- Microphone pause/resume, automatic two-minute segments and local recovery.
- Ordered audio-clip imports and protected segment playback.
- Durable background processing, saved progress, retries and stalled-job resume.
- Voice activity detection; microphone noise suppression, echo cancellation and automatic gain control requested when supported by the device.
- Bounded transcript windows, combined checks, matching source quotes and hierarchical summaries.
- Editable summaries, takeaways and headings, reordering, text download and print/PDF.
- Teacher approval before publication; student notes visible to their teacher.

## Quick walkthrough

1. In the example, select **Open**. Play the synthetic recording and explore Lesson, Transcript & checks, Edit lesson and Student notes. Reset restores the example; edits stay in this browser.
2. In your private classroom, choose **New recording**, enter a title and confirm recording permission.
3. Record, pause/resume and stop. New recordings split about every two minutes. **Restore local recovery** retrieves segments saved in this browser under the signed-in account. Download a recovery ZIP if needed.
4. Alternatively choose ordered audio files. Filenames sort numerically: 01-introduction.mp3, 02-topic.mp3, etc. Each imported clip must be at most three minutes and 8 MB. Split a single long imported file beforehand.
5. **Save recording** uploads all segments. Keep the page open while recording or uploading. Successful upload removes that account's local recovery copy.
6. Open **Transcript & checks → Process in background**. You can now close the tab. Reopen the lecture for saved progress; active detail pages refresh every five seconds.
7. Compare recordings with the transcript and notes. Expand segment findings, check terminology and figures, then edit the lesson. Topic headings include segment start times.
8. Confirm your review and publish. Enrolled students can read lessons, play recordings and save notes. Sharing opens email/WhatsApp compose windows; it does not send messages automatically.

Optional browser alerts work while this page is open. Closed-browser Web Push is not implemented. Failed jobs offer retry; jobs without an update for ten minutes offer resume.

## Processing and review

Whisper Large v3 Turbo (@cf/openai/whisper-large-v3-turbo) transcribes each segment with voice activity detection. The source transcript is preserved rather than automatically corrected.

Llama 3.3 70B Instruct (@cf/meta/llama-3.3-70b-instruct-fp8-fast) extracts topic notes, takeaways and findings from windows of at most 900 words, with a 60-word overlap when needed. Overlapping checks use one structured extraction call per window. Short evidence quotes must match the transcript. This establishes provenance, not correctness of every generated claim.

Groups of up to eight segment summaries are reduced before creating the overview. Detailed segment notes are retained. One Queue message advances a segment or summary group; database checkpoints and leases protect progress. Queue payloads contain a job ID, not login credentials or audio.

Five review categories cover transcription, timestamp/coverage checks, unclear wording/attribution, names/dates/figures, and notes/source alignment. These are **not five independent LLM verification passes**. Teacher listening and approval remain essential. The public example retains historical results from the earlier pipeline.

## Limits and classroom use

New lectures support up to 60 segments, 120 minutes or 64 MB, whichever limit is reached first. Imports are limited to three minutes and 8 MB per clip. The library cap is 20 lectures. Browser codec support and storage vary. Segment boundaries can introduce short gaps; listen to transitions.

Use a trusted device: local recovery is browser data, not a cloud backup. Keep the recording page open and the device awake. Screen locking, calls and browser backgrounding can interrupt microphone capture. Returning later restores processing progress, not a recording stopped by the operating system.

Noise suppression depends on the device/browser. Voice activity detection skips silence; it does not separate speakers or guarantee removal of chatter, echo or distant speech. Obtain permission to record and process classroom audio.

## Set up your own deployment

Use Node.js 22+, your own Supabase project and Cloudflare account. For a fresh installation:

```powershell
cd classroom
npm ci
npm run setup
```

1. Run local private/setup.sql in your fresh Supabase project's SQL editor. Do not run the base schema over an existing classroom.
2. Apply SQL files under supabase/migrations in filename order. Existing classrooms apply only the additive upgrades, retaining their current gateway secret and teacher setup state.
3. Create a private config copy:

```powershell
Copy-Item wrangler.jsonc wrangler.live.jsonc
```

Edit SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in that copy. If another classroom uses this account, choose distinct Worker and queue names in both producer and consumer settings.

```powershell
npx wrangler login
npx wrangler queues create lecture-studio-processing --message-retention-period-secs 86400 --config wrangler.live.jsonc
npm run deploy -- --config wrangler.live.jsonc
Get-Content -Raw private/gateway.txt | npx wrangler secret put DB_GATE_KEY --config wrangler.live.jsonc
```

The Worker reports storage unavailable until its secret is set. The secret command deploys immediately. Open the deployed URL with /#invite= followed by local private/teacher-setup.txt to create the teacher account. Keep this link private. Invite students from the dashboard; each chooses a password.

Workers AI, Queues and Supabase storage have account quotas. Check capacity before processing or archiving a large course.

## Privacy and backups

Accounts are separate from other Supabase Auth apps. Tables use the isolated lecture_studio_private schema with RLS and no client row policies. Server RPCs require a high-entropy gateway secret before checking classroom identity or a processing lease. The public key alone does not grant classroom access. Keep the gateway secret, setup token and private config out of Git and frontend code.

Back up all classroom tables, including audio, clip results and jobs, plus server configuration kept separately. Test restoring into a separate project. The example browser workspace is not a backup of real lectures.

## Validation

```powershell
npm run check
npm test
```

Live checks covered a three-segment, 219-second synthetic lecture, including controlled noise/echo, that completed after its client exited. Tests reopened all segments and five review categories; checked protected playback, teacher/student isolation, draft restrictions, rolling microphone capture with shortened intervals, pause/resume, recovery ZIP CRCs, editing, exports and 320/390/768/1440-pixel layouts.

A simulated 90-minute, 45-segment job tests bounded context, segment retention, hierarchical summaries, provider retry and duplicate completion. It is not a 90-minute speech-quality or physical-phone classroom test. Real accents, specialist terminology, noisy rooms and long device sessions still need a teacher trial.

HTML, CSS, JavaScript and SQL; Cloudflare Workers, Workers AI, Queues and Supabase PostgreSQL.
