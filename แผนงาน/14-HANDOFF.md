# 14 — HANDOFF (ส่งต่องาน)

> อัปเดตล่าสุด: **2026-10-20** · เวลาโดยประมาณ 10:00 UTC
> ผู้รับช่วง: อ่านไฟล์นี้จบแล้วไปที่ Task ถัดไปได้ทันที

## 1. สถานะโปรเจกต์

| รายการ | ค่า |
|---|---|
| ชื่อโปรเจกต์ | Nova Chat / AI Web |
| Repository | `/workspaces/Ai-web` |
| Branch | `feat/8-char-invite-password-toggle` → PR #2 (base `main`) |
| Commit ล่าสุด | `2bd5d76` (merge PR #1) + commit auth 8 ตัว/GitHub Actions |
| Phase ปัจจุบัน | Phase 11–13: deployed staging/production; เหลือ live provider + browser QA |
| สถานะโดยรวม | Deploy จริงแล้วทั้ง staging/production ด้วย Mock Provider; auth 8 ตัว deploy staging แล้ว; production รอ auto deploy หลัง merge |
| Staging | https://ai-web-staging.peerapatmatprasong.workers.dev |
| Production | https://ai-web.peerapatmatprasong.workers.dev |
| Git status | `main` มีโค้ดครบจาก PR #1 แล้ว · branch auth 8 ตัวพร้อมเปิด PR · GitHub Actions CD ตั้งค่าแล้ว |
| ลิงก์ | https://github.com/Beam091/Ai-web |

## 2. สิ่งที่เสร็จแล้ว

| Task ID | รายละเอียด | ไฟล์หลัก | ผลทดสอบ |
|---|---|---|---|
| SETUP-01/02 | Worker + Hono + Vite/React + Tailwind + health + assets | `worker/`, `src/`, `wrangler.jsonc` | typecheck/lint/build ผ่าน |
| DB-01/02 | D1 schema, migrations, CRUD, ownership, context | `migrations/0001_init.sql`, `worker/db/queries.ts` | integration ผ่าน |
| AUTH-01/02 | register/login/logout/me, session, CSRF, rate limit | `worker/routes/auth.ts`, `worker/middleware/auth.ts`, `worker/lib/crypto.ts` | integration ผ่าน |
| AUTH-03 | password ขั้นต่ำ 8, invite 8 ตัว, ปุ่มแสดง/ซ่อนรหัส | `src/components/AuthScreen.tsx`, `src/components/Icons.tsx`, `worker/lib/validation.ts` | unit 2 + staging register/login ผ่าน |
| PROV-01..04 | provider interface, OpenAI, Gemini, Mock, catalog | `worker/providers/*` | unit ผ่าน (mocked fetch) |
| API-01..03 | `/api/chat` SSE, models, conversations | `worker/routes/*` | integration + curl ผ่าน |
| UI-01..04 | Sidebar, chat, Markdown, auth screen, responsive | `src/**` | build/lint ผ่าน (ยังไม่ visual QA) |
| TEST-01..03 | unit, integration, CI workflow | `tests/**`, `.github/workflows/ci.yml` | 28 + 16 ผ่าน |
| HARD-01 | timeout + output cap | `worker/routes/chat.ts`, `worker/lib/output-budget.ts` | unit 4 + manual timeout/cap ผ่าน |
| POLISH-01 | lazy Markdown/highlight | `src/components/MarkdownLazy.tsx`, `src/components/MessageBubble.tsx` | main 262 kB; chunk 339 kB; asset 200; ไม่มี warning |
| DEPLOY-01 | local deploy-equivalent | `wrangler dev` + D1 local | health/register/chat/SPA ผ่าน |
| DEPLOY-02 | deploy staging + production | `wrangler.jsonc`, D1 staging/prod | health/SPA/assets/auth/chat/persist/CSRF ผ่าน |
| DEPLOY-04 | GitHub Actions auto deploy production | `.github/workflows/deploy.yml` | secrets ตั้งแล้ว; push `main` trigger test + migrate + deploy |
| QA-03 | abort/timeout/cap บน staging | staging env ชั่วคราว | ผ่านทั้ง 3 กรณี (Mock provider) |
| DOC-01/02/03 | แผนงาน 18 ไฟล์ + เอกสารหลัง deploy | `แผนงาน/**`, `README.md` | ตรวจกับ URL/ผลจริงแล้ว |

**หลักฐานสำคัญ**
- `npm test` → unit 28 passed, integration 16 passed
- `npm run typecheck` / `npm run lint` / `npm run build` → ผ่าน
- GitHub Actions `verify` บน PR #1 → success ([run 39400469357](https://github.com/Beam091/Ai-web/actions/runs/39400469357))
- `wrangler dev` + curl: health `status:ok database:ok`, login 200, chat SSE 54 delta + done, detail มี user+assistant `complete`
- Abort test: integration test ผ่าน; manual curl ตัดที่ 0.18s → assistant `status=aborted` 207 chars ถูกบันทึกจริง
- Guardrails: `AI_TIMEOUT_SECONDS=1` → `PROVIDER_TIMEOUT` ที่ ~1.07s; ตั้ง `AI_MAX_OUTPUT_CHARS=120` (clamp เป็น 500) → `RESPONSE_LIMIT_REACHED` ที่ 500 chars และ persisted `status=error`
- Staging: register 201 (admin), cookie `HttpOnly/Secure/SameSite=Lax`, chat 55 events/492 chars/`done`, persist ครบ, CSRF 403
- Staging auth 8 ตัว: register 201 ด้วย password `12345678` + invite 8 ตัว, login 200, invite 7 ตัว → 400 `VALIDATION_ERROR`, invite 8 ตัวผิด → 403, chat 55 events/489 chars/`done`; ลบ test user แล้ว (users/conversations/messages = 0)
- Staging guardrails: cap 500 chars, timeout 53 chars, abort persisted 109 chars
- Production: health `production/database:ok`, `/` 200, lazy asset 200, unauth 401, bad invite 403, CSRF 403, headers ครบ, D1 tables ครบ, users = 0

## 3. ไฟล์ที่สร้าง/แก้ไขล่าสุด

### สร้างใหม่ (ทั้งหมด)
- Root: `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`, `vitest.workers.config.ts`, `eslint.config.js`, `wrangler.jsonc`, `wrangler.test.jsonc`, `index.html`, `.gitignore`, `.env.example`, `README.md` (แก้)
- `.github/workflows/ci.yml`
- `worker/**` (ประมาณ 20 ไฟล์)
- `src/**` (14 ไฟล์ รวม `MarkdownLazy.tsx`)
- `migrations/0001_init.sql`
- `tests/**` (6 ไฟล์)
- `public/_headers`, `public/favicon.svg`
- `แผนงาน/00`–`17` (18 ไฟล์)

### ไฟล์ local ที่ไม่ถูก commit
- `.dev.vars` (มี `SIGNUP_CODE=DEV2026` สำหรับ local)
- `แผนงาน/token` (mode 600; เก็บ Cloudflare/GitHub token, account ID และ signup codes ของ staging/production) — ถูก ignore
- `.wrangler/` (local D1 state — มีผู้ใช้ทดสอบ `owner@example.com`)
- `dist/`, `node_modules/`

## 4. คำสั่งที่รันล่าสุดและผลลัพธ์

```bash
npm run typecheck   # ผ่าน (3 projects)
npm run lint        # ผ่าน 0 warning
npm test            # unit 28 passed; integration 16 passed
npm run build       # สำเร็จ; main 262 kB + lazy Markdown chunk 339 kB; ไม่มี warning
npx wrangler d1 migrations apply DB --local   # 11 commands สำเร็จ
npx wrangler dev --port 8787                  # รันได้ (หยุดหลังทดสอบแล้ว)
curl /api/health                              # 200 {"status":"ok","database":"ok"}
curl /                                  # 200 text/html
curl /settings/profile                  # 200 (SPA fallback)
```

## 5. งานที่กำลังทำ

กำลังรอ merge PR auth 8 ตัวเข้า `main` เพื่อให้ GitHub Actions deploy production และตรวจ smoke รอบสุดท้าย — งานที่เหลือหลังจบรอบนี้ต้องใช้ browser, API keys หรือการตัดสินใจเชิงนโยบาย

## 6. งานถัดไปที่ควรทำทันที

1. **QA-01 — ตรวจ UI ในเบราว์เซอร์จริง** (ไม่ต้องมี credential)
   - เปิด staging URL → สมัครด้วย signup code ของ staging (เก็บใน `แผนงาน/token`)
   - ตรวจ mobile 360px, tablet 768px, desktop 1280px
   - ทดสอบ login → Mock chat → stop กลางทาง → copy → rename → delete → refresh
   - ตรวจว่า Markdown/highlight แสดงหลัง lazy chunk โหลด และ console ไม่มี CSP/React error
   - Acceptance: ทุก flow ใช้งานได้ ไม่มี layout ล้น
2. **LIVE-01 / LIVE-02 — ทดสอบ OpenAI/Gemini จริง** (ต้องมี API keys)
   - ตั้ง secret, เปลี่ยน `DEFAULT_PROVIDER`, ใช้ข้อความสั้น, ตรวจ streaming/error
   - บันทึก latency/CPU และปัญหาใน `08-TEST-REPORT.md`
3. **QA-04 — ทดสอบ timeout/output cap กับ provider จริง** หลัง LIVE-01/02
4. **DEPLOY-03 / SEC-01** — วัด CPU ของ PBKDF2 และ stress test rate limit บน Cloudflare จริง

## 7. ปัญหาคงค้าง

| อาการ | สาเหตุที่ยืนยัน | สถานะ |
|---|---|---|
| ยังไม่ทดสอบ provider จริง | ไม่มี API keys | BLOCKED (LIVE-01/02) |
| lazy Markdown chunk | แยก react-markdown/highlight ออกจาก main แล้ว | รอตรวจใน browser (QA-01) |
| อาจเกิน CPU 10 ms ตอน login | PBKDF2 100k บน Free plan | ต้องวัดจริงบน Cloudflare (DEPLOY-03) |
| ยังไม่ยืนยัน responsive/CSP | ไม่มี browser test | TODO (QA-01) |
| abort ก่อน token แรก | ไม่มี assistant row (เว้นว่างโดยเจตนา) | ยอมรับใน MVP; ทดสอบ UX บน browser (QA-01) |
| abort persistence | ทดสอบ staging ผ่าน (Mock) | ยังไม่ทดสอบกับ provider จริง/network หลากหลาย |
| timeout/output cap | ทดสอบ staging ผ่าน (Mock) | ยังไม่ทดสอบกับ provider จริง (QA-04) |

## 8. ข้อมูล/สิทธิ์ที่ต้องขอจากเจ้าของ

- `OPENAI_API_KEY` และ/หรือ `GEMINI_API_KEY` (พร้อม quota และ model ที่บัญชีเข้าถึงได้)
- โดเมน (ถ้าต้องการ custom domain)
- การอนุมัติค่าใช้จ่าย/เพดานรายเดือนของ AI provider
- นโยบาย data retention และนโยบายความเป็นส่วนตัว
- การตัดสินใจว่าจะเปิดรับสมัครต่อหรือปิดหลัง bootstrap admin

## 9. วิธีเริ่มทำงานต่อโดยไม่ต้องเริ่มวิเคราะห์ใหม่

```bash
cd /workspaces/Ai-web
git status
cat แผนงาน/14-HANDOFF.md
cat แผนงาน/05-TASK-BOARD.md
npm ci
npm run typecheck && npm run lint && npm test && npm run build
# แล้วเริ่ม QA-01
npm run dev
```

- Local login สำหรับทดสอบ: ใช้อีเมลใหม่ + `SIGNUP_CODE` จาก `.dev.vars` (`DEV2026`, 8 ตัว)
- Staging login: ใช้อีเมลใหม่ + `STAGING_SIGNUP_CODE` (8 ตัว) จาก `แผนงาน/token` (ห้าม commit; ส่งให้เจ้าของผ่านช่องทางส่วนตัวเมื่อจำเป็น)
- Production login: ใช้ `PRODUCTION_SIGNUP_CODE` (8 ตัว) จาก `แผนงาน/token`; ผู้สมัครคนแรกได้ role `admin`
- Production ยังไม่มีผู้ใช้; ผู้สมัครคนแรกจะได้ role `admin`
- ถ้า local D1 หาย: `npm run db:migrate:local`
- ถ้าต้องการเริ่ม local DB ใหม่: ลบ `.wrangler/state` (ระวังข้อมูลทดสอบหาย) แล้ว migrate ใหม่
- Deploy ซ้ำ: push `main` เพื่อให้ GitHub Actions deploy production อัตโนมัติ หรือรัน `npm run deploy:staging` / `npm run deploy:production` ด้วยตนเอง (ต้องมี `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`)

## 10. สิ่งที่ Agent คนถัดไปต้องระวัง

1. **อย่า commit `.dev.vars` หรือ secret ใด ๆ**
2. **อย่าอ้างว่า deploy/live test ผ่าน** ถ้ายังไม่ได้รันจริง
3. `npm run deploy` ชี้ **production**; ใช้ `deploy:staging` ก่อนและตรวจ smoke
4. อย่าแก้ migration `0001` ที่ apply แล้ว — สร้างไฟล์ใหม่
5. อย่าลดความปลอดภัย (เช่นปิด CSRF/rate limit) เพื่อให้ test ผ่าน
6. ถ้าเพิ่ม provider ต้องอัปเดต catalog + registry + unit test + docs
7. ทุกงานต้องอัปเดต Task Board, Test Report, Changelog และ Handoff
8. ก่อนแก้ UI จำนวนมาก ให้รัน `npm run build` เพื่อดู baseline
9. Token ที่เคยส่งในแชทควร rotate หลังใช้งานเสร็จ และห้าม commit `แผนงาน/token`

## 11. สรุปการเปลี่ยนแปลงล่าสุด (รอบนี้)

- สร้างแอป MVP ใหม่ทั้งหมดจาก repo ว่าง
- เพิ่มระบบ auth/session/CSRF/rate limit
- เพิ่ม provider adapters 3 ตัว + allowlist
- เพิ่ม D1 schema/migrations + ownership
- เพิ่ม UI ครบ flow หลัก + Markdown/streaming
- เพิ่ม test 44 รายการ (28 unit + 16 integration) + CI + เอกสาร 18 ไฟล์
- แก้ abort persistence ด้วย `waitUntil` + เพิ่ม integration test + เขียน `08-TEST-REPORT.md`
- เพิ่ม timeout/output cap (HARD-01) + unit test + manual verification
- แยก Markdown/highlight เป็น lazy chunk (POLISH-01) ทำให้ main bundle เหลือ ~262 kB
- สร้าง D1 staging/production (APAC), apply migration, ตั้ง `SIGNUP_CODE` และ deploy จริงทั้งสอง env
- Staging ผ่าน flow smoke + abort/timeout/output cap (Mock); production ผ่าน health/SPA/auth guard/headers/D1 tables
- อัปเดตเอกสาร 00/01/04/05/07/08/09/14/15 และ README ให้ตรงสถานะ deploy จริง
- push branch `deploy/staging-production`, เปิด PR #1, CI `verify` ผ่าน และ merge เข้า `main` แล้ว
- เพิ่ม auth 8 ตัว (password + invite) และปุ่มแสดง/ซ่อนรหัส; unit เพิ่มเป็น 28
- เพิ่ม GitHub Actions CD `.github/workflows/deploy.yml` + secrets; push `main` จะ test, migrate D1 และ deploy production
- เปลี่ยน `SIGNUP_CODE` staging/production เป็น 8 ตัวอักษร และ deploy staging ใหม่แล้ว

---

## 12. Prompt สำหรับ Agent คนถัดไป (คัดลอกไปใช้ได้ทันที)

```text
คุณคือ AI Agent ที่รับช่วงพัฒนาโปรเจกต์ต่อจาก Agent ก่อนหน้า ให้เริ่มจากตรวจสอบ Repository และอ่านแผนงาน/00-README.md, แผนงาน/14-HANDOFF.md, แผนงาน/05-TASK-BOARD.md และเอกสารที่เกี่ยวข้อง ตรวจสอบ Git Status และผลการทดสอบก่อนแก้ไขโค้ด ห้ามสมมติว่างานเสร็จหากไม่มีหลักฐาน ให้ทำ Task ถัดไปที่ระบุไว้ใน Handoff ปรับปรุงเอกสารทุกครั้งที่มีการเปลี่ยนแปลงสำคัญ และเมื่อหยุดทำงานต้องอัปเดต Handoff เพื่อให้ Agent คนต่อไปทำงานต่อได้ทันที
```
