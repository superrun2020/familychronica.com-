# FamilyChronica workspace rollout — 2026-09-17

## Status and scope

The production backend/static workspace release is deployed. **This is not a claim that the live AI or the real-user login/camera acceptance chain has passed.** The running service has no `FAMILYCHRONICA_OPENAI_API_KEY`; chat/transcription/translation therefore fail closed with an explicit unavailable state. No other project's key was used, no production OTP was read, and no production authentication bypass or synthetic login was added.

The prior dashboard was hard-coded sample-family content with backend-connection toast buttons. Before implementation, the downloaded production auth server, app.js, and dashboard HTML were byte-identical to local baseline. Auth and email health were already working; the unauthenticated dashboard redirect was expected, not the root defect.

Implemented: account-owned private workspace, real session identity, persistent text memories, members, album uploads, recorded audio/video and authenticated playback/ranges; explicit device consent, track cleanup, stop/final flush, source/translation-language controls, independently finalized audio segments, server-side OpenAI adapter, missing-provider/error/retry states, ownership/CSRF/upload quotas and bounded AI calls. Each account currently owns a separate private family: shared-family memberships/invitations and a graphical relationship tree are not implemented.

## Production paths and rollback

- Site: `/var/www/familychronica/current` (existing release retained; only listed files replaced).
- Auth current: `/opt/familychronica-auth/releases/workspace-20260917T120733Z-c27b0de`.
- Main backup: `/opt/familychronica-auth/backups/workspace-20260917T120733Z-c27b0de`.
- Rollback: `bash /opt/familychronica-auth/backups/workspace-20260917T120733Z-c27b0de/rollback.sh` as the authorized operator. This restores code/config and keeps new user workspace data; it does not restore the SQLite backup over newer data.
- Nginx snippet: `/etc/nginx/snippets/familychronica-auth.conf`; dedicated workspace location accepts 12 MiB, application files limited to 10 MiB.
- Service drop-in: `/etc/systemd/system/familychronica-auth.service.d/workspace.conf`, source `backend/workspace-service.conf`. It configures the project-only ffprobe and `UMask=0077`.
- `workspace.sqlite` is 0600 and `workspace-media/` 0700, owned by `familychronica-auth`. Upload files are 0600.
- ffprobe deployed only inside the auth release, from pinned `@ffprobe-installer/linux-x64@5.2.0`; binary SHA256 `576c21674291ec1948d507ea8ab0d78eb6621a0be8c6f1a6db0f50c5fcb1e0f9`.

No production `.env` credentials were changed. Existing auth and support remained active. Nginx syntax succeeded; it emitted existing duplicate-vhost warnings for unrelated analysis/auth domains, which were not changed.

## Verification actually executed

- `node --test test/*.test.mjs`: **23 passed, zero failures**, including real auth-server signed-session fixtures (temporary DB/secret only), IDOR/CSRF, upload signature/size/concurrent idempotency, persistent 250 MiB quota, provider parsing/errors, browser persistence/recording playback, delayed camera permission cleanup, EN/zh-CN/ES, and login/signup asset loading.
- Production Node 22 ran the isolated HTTP/provider suites: **16 passed, zero failures**. These used temporary test storage, not production accounts.
- `node test/verify-audio-probe.mjs`: headless Chrome synthetic devices generated two complete MP4 audio segments; the real local ffprobe accepted them and measured approximately 11.7 seconds combined. Ordered transcript/translation fields persisted; video archive played. The upstream provider in this one test was an explicitly isolated stub, **not live AI evidence**.
- Independent Codex security review: pass after correcting cost reservation, media concurrency, deployment imports, and proxy upload limits. Secret scan: no findings in source scan; Git remote commit read-back performed.
- Public HTTPS health: 200 with `ok:true,emailConfigured:true`.
- Public workspace and AI status without authentication: 401 `AUTH_REQUIRED`.
- A 2 MiB unauthenticated upload through the public proxy reached the auth gate and returned 401, not the old nginx 413. This proves routing/size allowance, not authenticated media saving.
- Public app/dashboard JS and CSS bytes matched local source hashes. Real headless browser navigation `/dashboard` redirected to `/login?next=/dashboard`, loaded released modules, and had no page errors.

## Independent rechecks

```sh
# From familychronica-site; install the existing sibling auth dependencies first
npm --prefix ../familychronica-auth install --no-audit --no-fund
npm install --prefix /tmp/fc-browser-qa playwright --no-audit --no-fund
npm install --prefix /tmp/fc-media-tools @ffprobe-installer/darwin-arm64@5.0.1 --no-audit --no-fund
npm test
node test/verify-audio-probe.mjs
curl -sS https://familychronica.com/api/auth/health
curl -i https://familychronica.com/api/auth/workspace
# Authorized server shell:
systemctl is-active familychronica-auth familychronica-support
systemctl show familychronica-auth -p UMask -p WorkingDirectory
readlink -f /opt/familychronica-auth/current
```

## Required external acceptance

1. An authorized operator must provision a **FamilyChronica-specific** OpenAI API key in the existing server environment through a secure channel, never chat or source control, then restart only `familychronica-auth`. Approved models are `gpt-4.1-mini` and `gpt-4o-mini-transcribe`; unsupported overrides are rejected.
2. Current safety policy reserves $0.10 per attempted AI operation against $0.50/day/account (five operations including failed attempts), plus fixed input/output, audio, concurrency, and upload limits. This is a conservative reservation, not a billed-cost report. Longer live interviews need an explicitly reviewed policy change; do not promise unlimited transcription.
3. The user must complete their real email login at https://familychronica.com/dashboard and explicitly grant camera/microphone access. Then verify chat, a short English/Chinese recording with different translation target, stop/save, reload/replay, denied permission, and Safari/mobile behavior. Human devices and real supplier calls remain unverified.
