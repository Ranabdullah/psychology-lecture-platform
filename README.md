# Lecture Studio

A private classroom app that records or uploads lectures, transcribes the audio, saves five review passes, and gives the teacher an editable outline to publish. Students join by private invitation, read published lectures and write notes for their teacher.

- [Open Lecture Studio](https://lecture-studio.ranakaharian1.workers.dev/)
- [Classroom setup and teacher walkthrough](classroom/README.md)
- [Fictional review walkthrough](https://psych-lecture-workflow-demo.ranakaharian1.workers.dev/)

The current classroom edition is in `classroom/` and runs on Cloudflare Workers, Workers AI and an isolated Supabase PostgreSQL schema. The original Next.js implementation remains under `src/`; its developer setup is in [README-FIRST.md](README-FIRST.md).
