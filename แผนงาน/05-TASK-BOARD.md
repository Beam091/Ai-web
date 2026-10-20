# 05 — TASK BOARD

> อัปเดต: 2026-10-20
> สถานะที่อนุญาต: `TODO` · `IN_PROGRESS` · `BLOCKED` · `DONE` · `DEFERRED`
> งานจะถูกตั้ง `DONE` ได้เมื่อผ่าน Acceptance Criteria และมีหลักฐานใน `08-TEST-REPORT.md` เท่านั้น

## 1. งานที่เสร็จแล้ว (DONE)

| ID | งาน | Prio | หลักฐาน / Acceptance |
|---|---|---|---|
| DOC-01 | สร้างแผนงาน 18 ไฟล์ | P0 | ไฟล์ 00–17 ครบ, เนื้อหาสอดคล้องโค้ด |
| SETUP-01 | Scaffold โปรเจกต์ (Vite/React/TS/Hono/Wrangler/Tailwind/ESLint) | P0 | `npm run build`, `typecheck`, `lint` ผ่าน |
| SETUP-02 | Health check + SPA static assets | P0 | `GET /api/health` 200 `database:ok`; `/` 200; SPA fallback 200 |
| DB-01 | D1 schema + migration 0001 | P0 | apply local สำเร็จ 11 statements; integration tests ผ่าน |
| DB-02 | Query layer + ownership + history/context | P0 | integration: list/detail/rename/delete + IDOR |
| AUTH-01 | Register (invite), login, logout, me + session cookie | P0 | integration 6 cases |
| AUTH-02 | PBKDF2 hashing, session token hash, CSRF guard, rate limit | P0 | unit crypto 4; integration CSRF 2; lint |
| PROV-01 | `AIProvider` interface + registry + catalog/allowlist | P0 | unit catalog 4 |
| PROV-02 | OpenAI adapter (stream, error mapping, no key leak) | P0 | unit 3 (mocked fetch) |
| PROV-03 | Gemini adapter (roles/system/thought handling) | P0 | unit 2 (mocked fetch) |
| PROV-04 | Mock provider (deterministic, no network) | P0 | integration streaming ผ่าน |
| API-01 | `POST /api/chat` + validation + rate limit + safe errors | P0 | integration chat/oversize/allowlist |
| API-02 | SSE to browser (meta/delta/done/error) + abort | P0 | integration SSE parse + abort persistence + curl |
| API-03 | `GET /api/models` + default selection | P0 | integration + curl |
| UI-01 | Layout, Sidebar, New Chat, conversation list | P1 | build/lint; รอ visual QA (QA-01) |
| UI-02 | Chat view, Markdown, code highlight, copy, streaming UI | P1 | build/lint; ใช้งานกับ Mock ผ่าน curl/SSE |
| UI-03 | Auth screen (login/register) + session restore | P0 | build; auth flow ผ่าน API tests |
| UI-04 | Responsive + keyboard/a11y basis | P1 | โค้ดมี breakpoints/aria; **ยังไม่ตรวจด้วยตา** |
| TEST-01 | Unit tests | P0 | 26 passed |
| TEST-02 | Integration tests (workerd + D1) | P0 | 16 passed (รวม abort) |
| HARD-01 | Timeout + เพดานความยาวคำตอบ | P1 | `AI_TIMEOUT_SECONDS` / `AI_MAX_OUTPUT_CHARS`; unit 4 + manual timeout/cap ใน `08` |
| POLISH-01 | ลด bundle ด้วย lazy Markdown/highlight | P2 | main 262.16 kB + lazy Markdown 339.15 kB; build ไม่มี warning; asset เสิร์ฟ 200 |
| TEST-03 | CI workflow (typecheck/lint/test/build) | P1 | `.github/workflows/ci.yml`; PR #1 run `39400469357` ผ่าน |
| DEPLOY-01 | Local deploy-equivalent verification | P0 | `wrangler dev` + local D1 + curl ผ่าน |
| DEPLOY-02 | Deploy staging + production จริง | P0 | staging `820e706c...` / production `bcb17774...`; health/SPA/flow ผ่าน |
| DOC-02 | Security/deployment/API/DB docs | P0 | เอกสารตรงกับโค้ด |
| DOC-03 | อัปเดตเอกสารหลัง deploy จริง | P1 | มี URL, version, D1 IDs และผลตรวจจริงใน `09`/`08` |
| QA-03 | ทดสอบ abort/timeout/output cap บน staging | P1 | ผ่านทั้ง 3 กรณีด้วย Mock provider |

## 2. งานที่กำลังทำ (IN_PROGRESS)

_ไม่มีงานค้างระหว่างทำ — รอบนี้ปิดงานทั้งหมดที่ทำได้โดยไม่ต้องใช้ credential_

## 3. งานที่รอทำ (TODO)

| ID | งาน | Prio | Dependencies | Acceptance Criteria |
|---|---|---|---|---|
| QA-01 | ตรวจ UI ด้วยเบราว์เซอร์จริง (Chrome/Safari/Firefox) + mobile 360/768/1280 | P0 | staging URL | ทุกหน้าจอไม่ล้น, sidebar drawer ทำงาน, streaming/copy/stop ใช้งานได้ |
| HARD-02 | Admin/user management หรือปิดรับสมัครหลัง bootstrap | P2 | AUTH-01 | เฉพาะ admin สร้าง/ปิดผู้ใช้ได้, มี test |
| HARD-03 | Data retention / ลบข้อความเก่าตามนโยบาย | P2 | DB-01 | มีนโยบายและงานลบ/เมตริก |
| QA-02 | เพิ่ม E2E (Playwright) สำหรับ flow หลัก | P2 | QA-01 | CI รัน E2E ผ่าน |
| QA-04 | ทดสอบ timeout/cap กับ live provider | P1 | LIVE-01/02 | error code และ partial persistence ถูกต้องกับ provider จริง |

## 4. งานที่ถูกบล็อก (BLOCKED)

| ID | งาน | สาเหตุ | สิ่งที่ต้องขอ |
|---|---|---|---|
| LIVE-01 | ทดสอบ OpenAI API จริง | ไม่มี `OPENAI_API_KEY` | Key ที่มี quota + ระบุโมเดลที่บัญชีใช้ได้ |
| LIVE-02 | ทดสอบ Gemini API จริง | ไม่มี `GEMINI_API_KEY` | Key ที่มี quota + ระบุโมเดลที่บัญชีใช้ได้ |
| DEPLOY-03 | ตรวจ CPU/PBKDF2 บน Free plan | ต้อง deploy จริงก่อนวัด | ผลจาก `wrangler tail` / metrics หลัง DEPLOY-02 |
| SEC-01 | ตรวจ rate limit boundary + WAF | ต้องมี env จริง | ตัดสินใจว่าจะใช้ Cloudflare Rate Limiting เสริมหรือไม่ |

## 5. งานที่เลื่อนออกไป (DEFERRED)

| ID | งาน | เหตุผล |
|---|---|---|
| FEAT-01 | RAG / Upload files | ต้องมี storage + embedding + ค่าใช้จ่าย |
| FEAT-02 | Web Search / Image generation | เพิ่ม provider/complexity เกิน MVP |
| FEAT-03 | Regenerate / Edit & Resend | ต้องออกแบบ context ซ้ำ |
| FEAT-04 | Export chat / ค้นหาประวัติ | ยังไม่มีผู้ใช้จริง |
| FEAT-05 | Dark/Light toggle | ใช้ dark theme เดียว |
| FEAT-06 | OAuth/SSO, email verify, password reset | ต้องมี email service/IdP |
| FEAT-07 | Usage/cost dashboard | ต้องมี billing integration |

## 6. งานถัดไปที่ควรทำทันที

1. **QA-01** — เปิด staging URL แล้วตรวจ UI/streaming/responsive + lazy Markdown ในเบราว์เซอร์จริง
2. **LIVE-01 / LIVE-02** — เมื่อมี API keys; ทดสอบด้วยข้อความสั้นและบันทึกผลลง `08-TEST-REPORT.md`
3. **QA-04** — ทดสอบ timeout/output cap กับ provider จริง
4. **DEPLOY-03 / SEC-01** — วัด CPU และ stress test rate limit บน Cloudflare จริง

## 7. เหตุผลของงานที่ยังไม่เสร็จ

- งาน deploy เสร็จแล้ว; live provider test ยังถูกบล็อกด้วย **API keys** ไม่ใช่โค้ด
- งาน visual QA ต้องใช้เบราว์เซอร์ซึ่งสภาพแวดล้อมปัจจุบันเป็น terminal-only
- งาน hardening ที่เหลือต้องตัดสินใจนโยบาย (retention, admin model, WAF) — ดู `16-OPEN-QUESTIONS.md`; timeout/cap ทำแล้ว
