# Psych Lecture developer review kit

## Release status

REVIEW ONLY — recording, transcription, AI draft and recovery checked; buyer launch checks remain

Verified: Production build; authenticated teacher/student access; private notes; actual Chrome microphone stream using a fictional spoken fixture; playable Opus audio saved and streamed; real Whisper transcription and real Llama summary; teacher approval required; failed-save browser recovery; 390px layout. Provider failures preserve the saved original and report pending work. Summaries replace previous drafts transactionally. Local transcript extraction is explicitly labelled and copies the transcript without invented teaching content.

Remaining: A physical microphone and longer real lectures, Urdu accuracy, educational quality, actual R2 integration and complete database/Auth/file disaster recovery still need testing. Automatic purchase activation must be verified against your real published shop listings. This is a developer review kit, not a certified hosted school service.

## Start

Node.js 22+ and your own PostgreSQL database are required. Copy Source/.env.example to Source/.env and fill your own DATABASE_URL, NEXTAUTH_URL and a stable random NEXTAUTH_SECRET. In Source run npm ci, npx prisma migrate deploy, npm run build, npm start. Optional seed needs distinct teacher/student passwords of at least 12 characters. Seed examples are fictional. Never migrate an owner database without a tested backup.

## Using the app

Sign in as a teacher, open Record, give the lecture a title and allow the microphone. Starting may send speech to the configured browser/server transcription provider. Enable the AI summary checkbox only when you agree to provider processing. Stop & Save preserves the audio first. Open teacher review, check the transcript and summary, then approve/publish deliberately. A failed save retains browser recovery blocks; reload Record on the SAME browser/address and use Restore & Save. Clearing browser storage can remove unsaved recordings. Recovery is not guaranteed after browser eviction or device failure. Recording uses 32 kbps speech audio. Server saving accepts up to 256 MB; this Cloudflare transcription path accepts audio up to 20 MB. Larger audio remains saved with transcription pending; use a compatible transcription service or manually enter the real transcript.

## Data & backups

Back up the PostgreSQL database, all local recording/upload files or R2 objects, and Local Data/purchase-activation.json. Keep stable Auth/server secrets separately in a password manager. Copy versioned backups to a second drive and test restore with another instance. The source ZIP, IndexedDB and a database-only export are not complete disaster recovery.

## Own cloud

Choose local Whisper/Ollama, a remote transcription service, or your own Cloudflare bridge. Source/cloudflare-ai contains a private Worker example; deploy with your own account and set BRIDGE_TOKEN as a Worker secret. Set AI_BRIDGE_URL/AI_BRIDGE_TOKEN, STT_PROVIDER=cloudflare and LLM_PROVIDER=cloudflare only on your app server. The local Whisper adapter contract is POST JSON {audio_base64, language}; generic Whisper installations may need an adapter. Remote STT uses multipart file. Never send provider secrets to browser variables. AI free allowances can reject requests; no automatic paid upgrade or failover is configured.

## Purchase activation

Purchase activation is integrated in these three review kits. The seller service and signing database are prepared on free Cloudflare. Your real itch.io/Gumroad listings do not exist yet, so these copies keep ACTIVATION_REQUIRED=false and blank seller connection values. After creating listings, configure the exact shop product IDs, privately add the itch API key, set the seller URL/public verification key in the app server, and enable ACTIVATION_REQUIRED=true. Verify real purchase, wrong key, copied key, refund and renewal before uploading a customer release. The server assigns a signed installation code; certificates last 30 days and renew by verifying the receipt again. This is one logical server installation per purchase, not unbreakable DRM or a guarantee against copied editable source. Keep the signing private key only on the seller service. Ledger and Gods App were not changed. Link Launcher retains its existing seller-issued licence system; automatic shop activation was not added there.