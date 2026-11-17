# Lecture Studio

A private teaching workspace for recording a lecture, checking its transcript and publishing a structured lesson.

[Explore an example lesson](https://lecture-studio.ranakaharian1.workers.dev/?demo=1) · [Open your classroom](https://lecture-studio.ranakaharian1.workers.dev/)

## What it does

- Record audio with pause and resume, or upload an existing recording.
- Save the recording and transcript privately.
- Run five review passes with results you can inspect.
- Generate a lecture summary, key takeaways and descriptive topic headings.
- Edit the lesson, move sections up or down, and add or remove sections.
- Download lesson notes as text or print them as an A4 PDF.
- Publish to enrolled students and share links through an email or WhatsApp compose window.
- Let students write notes their teacher can read.

## Try the example

Open the example lesson and select **Open**. The **Lesson** tab contains a summary, key takeaways and topic notes. Use the heading links to jump through the lesson.

Choose **Transcript & checks** to inspect the source text and prepared example checks. In **Edit lesson**, change a heading, move a section and choose **Save edits**. The example saves edits in this browser. **Student notes** shows a fictional note. **Reset example** restores the sample.

The example uses synthetic speech about attention and memory, with a transcript and lesson generated through the live review pipeline. You can play the source audio and compare it with the notes. Live recording, accounts and AI processing are available in your private classroom.

## Set up a classroom

A one-time teacher setup link is issued privately. The teacher chooses a name, email and password, then creates a private invitation for each student from the classroom dashboard. Students create their own passwords with those links.

## Record and publish a custom lecture

1. Obtain permission to record and process the lecture. Choose **New recording**, enter a title and start the microphone, or select an audio file up to 8 MB.
2. Pause and resume as needed. Stop the recorder and check playback. Download a recovery copy if you need one.
3. Save the recording, then open **Transcript & checks** and select **Transcribe & build lesson**.
4. Inspect the five results and listen to flagged passages against the recording. Each completed stage is saved, so a failed stage can be retried.
5. Review **Lesson**, including the summary, takeaways and topic sections. Change text and order under **Edit lesson**, then save.
6. Confirm your review and publish. Enrolled students can read the lesson and add notes. The teacher can share a sign-in link by email or WhatsApp.

The five passes compare an independent transcription, inspect timestamp coverage, review unclear words and attribution, flag names and figures, then verify the generated lecture against the transcript. Automated checks can miss errors. The teacher approves the final lesson.

## Languages and services

HTML, CSS, JavaScript and SQL. The app runs on Cloudflare Workers with Workers AI for transcription and lecture generation, and Supabase PostgreSQL for private classroom records.

## Self-host

Use your own Supabase project and a Cloudflare Worker with Workers AI. Generate two high-entropy random values for the private database gateway and one-time teacher setup. Replace the placeholders in `schema.sql` with each value's SHA-256 hex digest and apply it as a migration. Keep a private deployment config containing `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Put the raw gateway value in the Worker secret `DB_GATE_KEY` and deploy. The teacher setup link ends in `/#invite=YOUR_ONE_TIME_VALUE`. Keep the raw values out of Git.

Classroom identity uses its own password and session records in an isolated Supabase schema. Audio, lecture text and student notes are private. Back up classroom tables for archival retention.
