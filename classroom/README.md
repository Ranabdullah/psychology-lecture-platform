# Lecture Studio

[Open the classroom](https://lecture-studio.ranakaharian1.workers.dev/). A one-time teacher setup link is issued privately. The teacher chooses their name, email and password, then creates a private invitation for each student from the classroom dashboard. Students create their own passwords with those links.

## Record and publish

1. Obtain permission to record and process the lecture. Record from the microphone or choose an audio file up to 8 MB.
2. Save the recording. Download the recovery copy before leaving if an upload fails.
3. Start transcription. The app saves the source transcript and five distinct review results. It retries from the last completed stage if a provider stops.
4. Listen to flagged passages, edit the lecture headings and text, and confirm your review. Publish when ready.
5. Copy the published lecture link or open an email or WhatsApp compose window. Only invited students can open published lectures in their classroom. Students can write notes visible to themselves and their teacher.

The five review passes compare a second transcription, inspect timestamp coverage, flag unclear words and attribution, check names and figures, and check the generated lecture sections against the transcript. Automated checks can miss errors. The teacher approves the final lecture.

## Self-host

Use your own Supabase project and a Cloudflare Worker with Workers AI. Generate two high-entropy random values for the private database gateway and one-time teacher setup. Replace the placeholders in `schema.sql` with each value's SHA-256 hex digest and apply it as a migration. Keep a private deployment config containing `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Put the raw gateway value in the Cloudflare Worker secret `DB_GATE_KEY` and deploy the Worker. The teacher setup link ends in `/#invite=YOUR_ONE_TIME_VALUE`. Keep the raw values out of Git.

Classroom identity uses its own password and session records in an isolated Supabase schema. It does not change any other application's identity configuration. Audio parts, lecture text and student notes are private. Back up the classroom tables separately if you need archival retention.
