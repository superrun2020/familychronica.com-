# FamilyChronica workspace implementation

## Storage, authentication, and media

The workspace API lives under `/api/auth/workspace/...` and accepts identity only from the auth server's existing `sessionUser` function. Every resource query includes `user_id`; foreign IDs return 404, while a memory that names a nonexistent or foreign media ID is rejected with `INVALID_MEDIA`.

Workspace state is stored in `DATA_DIR/workspace.sqlite`. Media uses UUID filenames in `DATA_DIR/workspace-media`, outside the public web root. Individual uploads are limited to 10 MiB and aggregate stored media is limited to 250 MiB per account. MIME types and signatures are allowlisted. Media reads support one normal, open-ended, or suffix byte range. Invalid ranges return 416 with `Content-Range: bytes */<size>`.

Production now has the dedicated 12 MiB workspace location from `backend/nginx-workspace.conf`; legacy auth endpoints retain their smaller limit. See [deployment evidence and remaining acceptance](DEPLOYMENT-20260917.md).

## AI limits and estimates

There is no fake production AI. When `FAMILYCHRONICA_OPENAI_API_KEY` is absent, the UI shows an unavailable banner and skips provider calls. Text, uploads, and recordings still save.

Limits are reserved transactionally in SQLite **before** each provider attempt, so failed calls consume quota:

- Five provider operations per user per UTC day.
- 3,600 measured transcription seconds per user per UTC day.
- 500,000 microdollars ($0.50) conservative reserved budget per user per UTC day.
- Each chat attempt reserves 100,000 microdollars ($0.10).
- Each transcription segment reserves its measured audio duration and 100,000 microdollars ($0.10), including optional translation.
- One provider operation per user and eight across this server process at a time; both AI operation types permit ten starts per minute.
- A recording can contain at most 180 segments, 30 MiB of transcription audio, and 1,800 measured seconds.

These dollar figures are deliberately conservative reservations, not measured bills or claims of zero cost. They cap exposure without depending on provider usage fields or mutable pricing. Operators should review the estimates whenever configured models or provider pricing change.

OpenAI Responses text is parsed from `output[].content[]` entries of type `output_text`; empty chat and translation replies fail. Chat history is capped at 12,000 UTF-8 bytes and output at 700 tokens. `zh-CN` is sent to transcription as `zh`; the UI supports `en`, `zh-CN`, and `es`.

## Recording behavior

Camera/microphone access starts only after an explicit Start action. The archive recorder owns the original stream. Transcription uses a separate audio-only `MediaStream` and negotiates `audio/mp4` first for Safari, then Opus WebM/WebM.

Stop awaits the final `dataavailable` and `stop` event from both recorders before draining the final transcription queue. Segment IDs and sequence numbers are captured per recording. Uploads remain ordered; a failed segment stays at the head until explicit retry, and the archive blob remains in memory for a stable-ID save retry. The queue is capped at six pending segments. Recording auto-stops at 30 minutes or 9 MiB of locally observed archive chunks, displays a live REC timer, and releases tracks on stop, cancellation, route changes, remount, logout, `pagehide`, and `beforeunload`.

The browser's complete archive is saved as uploaded media; transcript and translation are separate memory fields. Server transcription uses a timeout/output-bounded project-specific ffprobe, rejects video-bearing or over-15-second audio segments, and accumulates measured duration. Missing probe configuration fails closed. Source and target language are selected independently and captured for the recording.

## Production auth integration

The initial rollout is deployed; see the deployment report for precise verification limits. For subsequent releases, use the deterministic integration script against a downloaded production auth baseline:

```sh
node backend/apply-auth-integration.mjs /path/to/baseline/server.mjs /path/to/release/server.mjs
```

The script copies `workspace.mjs` and `openai.mjs` beside the output server, adds production-suitable `./workspace.mjs` and `./openai.mjs` imports, initializes the workspace service from the existing `dataDir`, `publicOrigin`, and `sessionUser`, and dispatches workspace routes. Review the generated diff before packaging. It is idempotent for an already-integrated target.

Optional environment variables:

```text
FAMILYCHRONICA_OPENAI_API_KEY
FAMILYCHRONICA_FFPROBE=/opt/familychronica-auth/current/bin/ffprobe
FAMILYCHRONICA_OPENAI_CHAT_MODEL=gpt-4.1-mini
FAMILYCHRONICA_OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
FAMILYCHRONICA_OPENAI_TRANSLATION_MODEL=gpt-4.1-mini
```

Rollback is to restore the authoritative auth-server baseline and restart that service. Preserve `workspace.sqlite` and `workspace-media`; disabling routes does not require deleting user data.

## Verification

```sh
node --test test/*.test.mjs
```

Tests use temporary SQLite/media directories, injected provider functions, a local static/API fixture, synthetic request identity, and headless Chrome with `--use-fake-device-for-media-stream`. Playwright is imported from `PLAYWRIGHT_PATH` or `/tmp/fc-browser-qa/node_modules/playwright/index.mjs`. No production identity, database, cookie, API key, or human camera is used.

Known acceptance limitations: live OpenAI behavior still requires the absent FamilyChronica credential, and real camera/microphone behavior still requires an HTTPS human-device browser matrix. The automated recording check uses Chrome's synthetic media device and verifies that the uploaded archive loads browser metadata as a complete playable container.
