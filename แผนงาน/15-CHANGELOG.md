# 15 — CHANGELOG

รูปแบบ: วันที่ → Added / Changed / Fixed / Removed / Security
อ้างอิง Task ID และไฟล์ที่เกี่ยวข้องเมื่อเป็นไปได้

## [0.2.0] — 2026-10-20

### Added

- **Cloudflare deployment จริง** (DEPLOY-02)
  - D1 staging `ai-web-db-staging` (`3c73db62-b00f-4b52-8b5f-774ff53dec3a`) และ production `ai-web-db-prod` (`4f59bd66-bbf1-4072-8aa4-3ca502514f6d`) ที่ region APAC
  - apply `migrations/0001_init.sql` (11 statements) ทั้งสองฐานข้อมูล
  - ตั้ง secret `SIGNUP_CODE` แยก staging/production (ค่าเก็บในไฟล์ ignored ไม่ commit)
  - Staging: `https://ai-web-staging.peerapatmatprasong.workers.dev` · version `820e706c-cf10-48d2-9c13-44405d021b85`
  - Production: `https://ai-web.peerapatmatprasong.workers.dev` · version `bcb17774-fdf8-4e0b-8f52-4bdef92dd6f9`
- **ผลตรวจ staging**: health/SPA/lazy asset/register 201 admin/cookie flags/me/chat 55 events/492 chars/persist/CSRF 403/security headers
- **ผลตรวจ guardrails บน staging (Mock)**: output cap 500 chars (`RESPONSE_LIMIT_REACHED`), timeout 53 chars (`PROVIDER_TIMEOUT`), abort persisted 109 chars (`status=aborted`)
- **ผลตรวจ production**: health `production/database:ok`, `/` 200, lazy asset 200, unauth 401, bad invite 403, CSRF 403, headers ครบ, D1 tables ครบ, users = 0

### Changed

- `wrangler.jsonc` ใช้ D1 ID จริง; top-level ชี้ staging เพื่อความปลอดภัย ส่วน production ใช้ `--env production`
- `README.md`, `แผนงาน/00`, `01`, `04`, `05`, `07`, `08`, `09`, `14` อัปเดต URL/version/ผลตรวจ/สถานะจริง
- `.gitignore` ignore `แผนงาน/token` และไฟล์ credential ชั่วคราว

### Known limitations (ณ 0.2.0)

- ยังไม่ทดสอบ OpenAI/Gemini live (ไม่มี API keys); ทั้งสอง env ใช้ `DEFAULT_PROVIDER=mock`
- ยังไม่ visual/browser QA (QA-01) และยังไม่มี E2E (QA-02)
- ยังไม่วัด CPU ของ PBKDF2 บน Free plan (DEPLOY-03)
- ยังไม่ stress test rate limit ภายใต้ concurrency จริง (SEC-01)
- ยังไม่มี custom domain, admin dashboard, password reset หรือ retention policy

## [0.1.0] — 2026-10-20

### Added

- **โปรเจกต์ใหม่ทั้งหมด** (SETUP-01)
  - React 19 + TypeScript + Vite 7 + Tailwind CSS 4 frontend
  - Hono 4 Worker API + Static Assets
  - D1 schema/migration `migrations/0001_init.sql`
  - `GET /api/health` + SPA fallback (`worker/index.ts`, `wrangler.jsonc`)
- **Authentication** (AUTH-01/02)
  - `POST /api/auth/register` (invite code), `/login`, `/logout`, `GET /me`
  - PBKDF2-SHA256 100k + salt, session token hash ใน D1
  - cookie `ai_session` (HttpOnly/SameSite=Lax/Secure non-dev, 7 วัน)
  - CSRF guard (`Origin`/`Sec-Fetch-Site`) + D1 fixed-window rate limit
  - ไฟล์: `worker/routes/auth.ts`, `worker/middleware/auth.ts`, `worker/lib/crypto.ts`, `worker/lib/rate-limit.ts`
- **Conversation + message** (DB-02, API-03)
  - CRUD `/api/conversations`, ownership isolation, rename/delete
  - context budget 40 ข้อความ / 24k ตัวอักษร
- **Provider layer** (PROV-01..04)
  - `AIProvider` interface + registry + server-side allowlist
  - OpenAI adapter (Chat Completions SSE)
  - Gemini adapter (`streamGenerateContent?alt=sse`, systemInstruction, thought filter)
  - Mock provider + `DEMO` badge
- **Chat streaming** (API-01/02)
  - `POST /api/chat` → SSE `meta`/`delta`/`done`/`error`
  - abort/stop + best-effort partial persistence
  - safe provider error mapping
- **Generation guardrails** (HARD-01)
  - `AI_TIMEOUT_SECONDS` (default 90) → `PROVIDER_TIMEOUT` และบันทึก partial เป็น `error`
  - `AI_MAX_OUTPUT_CHARS` (default 32,000) → `RESPONSE_LIMIT_REACHED` และตัด delta ให้พอดีเพดาน
  - `MOCK_DELAY_MS` สำหรับ demo/ทดสอบ streaming และ timeout
  - `worker/lib/output-budget.ts` + unit tests
- **Frontend** (UI-01..04)
  - Auth screen, sidebar/drawer, conversation list grouped by date
  - Chat view, empty state + suggestion cards, Markdown/GFM, code highlight, copy code/message
  - lazy Markdown/highlight (POLISH-01) + Suspense/error boundary (`MarkdownLazy.tsx`)
  - Model/provider selector, streaming caret/typing dots, stop button, error banner
  - responsive layout, keyboard (Enter/Shift+Enter/Escape), aria labels
- **Tests** (TEST-01/02)
  - unit 26 tests: SSE parser, OpenAI/Gemini adapters (mocked fetch), validation/catalog, crypto, output budget
  - integration 16 tests: health, auth, CSRF, chat SSE, persistence, abort partial persistence, allowlist, size, IDOR
  - config: `vitest.config.ts` (Node), `vitest.workers.config.ts` (workerd + D1)
- **CI** (TEST-03): `.github/workflows/ci.yml` (typecheck, lint, test, build)
- **Documentation** (DOC-01/02): `แผนงาน/00`–`17` (รวม `08-TEST-REPORT.md` ที่บันทึกผลจริง)
- **Static assets**: `public/_headers` (CSP/security headers), `public/favicon.svg`
- **Deployment config**: `wrangler.jsonc` env `staging`/`production`, scripts `deploy:staging`/`deploy:production`

### Changed

- `README.md` เปลี่ยนจาก 1 บรรทัดเป็นภาพรวมโปรเจกต์ + quickstart + ลิงก์แผนงาน
- `.env.example` ปิด comment ช่อง API key ที่เป็น placeholder เพื่อไม่ให้ UI แสดง provider ที่ยังใช้ไม่ได้
- ปรับ `APP_ENV` ให้ staging ใช้ `Secure` cookie ด้วย (`APP_ENV !== 'development'`)
- `package.json` เพิ่ม `engines.node >= 22`, scripts lint/test แยก unit/integration
- แยก Markdown/highlight เป็น lazy chunk: main JS 601.38 → 262.16 kB, chunk 339.15 kB, ไม่มี warning >500 kB

### Fixed

- ISSUE-01: เปลี่ยน `@cloudflare/vitest-pool-workers` → `@cloudflare/vitest-plugin` 1.4.5
- ISSUE-02: แก้ import path ของ unit tests (`../../worker/...`)
- ISSUE-03: integration test ต้อง consume response stream ก่อนตรวจ persistence
- ISSUE-04: type narrowing ของ conversation + ESLint `no-useless-assignment`
- ISSUE-08: abort กลาง stream ไม่บันทึก partial — เพิ่ม `waitUntil` ใน `request.signal`/`cancel()` + integration test (`tests/integration/api.test.ts`)
- ISSUE-09: ไม่มีเพดานเวลา/ความยาวคำตอบ — เพิ่ม timeout/output budget และแก้ listener cleanup ที่ลบ handler ผิดตัว

### Removed

- `@cloudflare/vitest-pool-workers` (แทนที่ด้วย `@cloudflare/vitest-plugin`)

### Security

- ไม่มี secret ใน repo/frontend; `.dev.vars`/`.env` ถูก ignore
- CSP + nosniff + frame deny + referrer policy ผ่าน `_headers` และ Worker middleware
- parameterized SQL ทั้งหมด; ไม่ render HTML ดิบจาก Markdown
- provider error ไม่ส่ง body ดิบถึง client; ไม่ log เนื้อหาแชท/secret
- จำกัด body 256 KB, ข้อความ 8k, context 24k, allowlist model
- จำกัดเวลา/ความยาว generation (`AI_TIMEOUT_SECONDS` / `AI_MAX_OUTPUT_CHARS`) และ abort upstream

### Known limitations ณ ตอน 0.1.0 (แก้ไขแล้วบางส่วนใน 0.2.0)

- ตอน 0.1.0 ยังไม่ deploy จริง / ยังไม่ทดสอบ OpenAI/Gemini live
- ตอน 0.1.0 ยังไม่ visual QA ในเบราว์เซอร์ (รวมการโหลด lazy Markdown chunk)
- PBKDF2 อาจเกิน CPU Free plan
