# Lecture Studio

A private classroom app for segmented recording, background transcription and reviewed lecture notes. Teachers publish summaries, key takeaways and topic headings; invited students read lessons and share notes with their teacher.

- [Try the example lesson](https://lecture-studio.ranakaharian1.workers.dev/?demo=1)
- [Open Lecture Studio](https://lecture-studio.ranakaharian1.workers.dev/)
- [Features, usage, setup and validation](classroom/README.md)

The current classroom edition is in classroom/. It uses Cloudflare Workers, Workers AI and Queues with an isolated Supabase PostgreSQL schema. Recording/uploading needs an open browser; queued processing continues after the tab closes. Original Next.js source remains under src/; developer notes are in [README-FIRST.md](README-FIRST.md).
