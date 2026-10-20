# 08 — TEST REPORT (ผลทดสอบจริง)

> อัปเดตล่าสุด: **2026-10-20 ~09:25 UTC**
> สภาพแวดล้อม: Linux / Node `v24.21.0` / npm `11.19.0` / Wrangler `4.151.2` / Vitest `4.1.12`
> หลักการ: บันทึกเฉพาะผลที่ **รันจริง** — งานที่ยังไม่ได้รันจะอยู่ในหัวข้อ “ยังไม่ทดสอบ” และห้ามถือว่าผ่าน

## 1. สรุปผล

| หมวด | คำสั่ง / วิธี | ผล |
|---|---|---|
| TypeScript | `npm run typecheck` (3 projects) | **ผ่าน** |
| Lint | `npm run lint` (`eslint . --max-warnings=0`) | **ผ่าน** 0 warning |
| Unit tests | `npm run test:unit` | **ผ่าน 26/26** (5 ไฟล์) |
| Integration tests | `npm run test:integration` (workerd + D1) | **ผ่าน 16/16** (1 ไฟล์) |
| Frontend build | `npm run build` | **ผ่าน** (main chunk 262 kB; Markdown chunk แยก 339 kB; ไม่มี warning) |
| Local runtime | `wrangler dev` + curl/Node scripts | **ผ่าน** health, SPA, auth, SSE, persistence, abort, timeout, output cap, headers |
| D1 migration (local) | `npx wrangler d1 migrations apply DB --local` | **ผ่าน** 11 statements |
| Deploy dry-run | `npx wrangler deploy --dry-run --env staging` | **ผ่าน** |
| Remote deploy | `wrangler deploy --env staging` / `--env production` | **ผ่านทั้งสอง env** |
| Staging smoke | health/SPA/assets/register/login/chat/persist/CSRF/headers | **ผ่าน** |
| Staging guardrails | abort/timeout/output cap | **ผ่าน** (Mock provider) |
| Production smoke | health/SPA/assets/auth guard/CSRF/headers/D1 tables | **ผ่าน** |
| Live OpenAI/Gemini | API keys | **ยังไม่ทดสอบ / BLOCKED** |
| GitHub Actions CI | PR #1 (`.github/workflows/ci.yml`) | **ผ่าน** `verify` ([run 39400469357](https://github.com/Beam091/Ai-web/actions/runs/39400469357)) |
| Browser visual QA | Chrome/Safari/Firefox + mobile | **ยังไม่ทดสอบ / TODO (QA-01)** |

## 2. Unit tests (Node, 26 tests)

คำสั่ง: `npm run test:unit`  
ผล: `Test Files 5 passed (5)`, `Tests 26 passed (26)`, duration ~3–5s (ขึ้นกับ cache)

| ไฟล์ | จำนวน | สิ่งที่ครอบคลุม |
|---|---:|---|
| `tests/unit/crypto.test.ts` | 4 | PBKDF2 round-trip, salt ไม่ซ้ำ, hash ผิดรูปแบบไม่ throw, SHA-256 known digest |
| `tests/unit/validation.test.ts` | 9 | chat/rename schema, trim, ขนาด, UUID, title, catalog/allowlist/default, extra models |
| `tests/unit/sse.test.ts` | 4 | event ถูกแบ่ง chunk, CRLF/multi-line data, event สุดท้ายไม่มี blank line, comment-only |
| `tests/unit/providers.test.ts` | 5 | OpenAI request/stream/error mapping/no-key; Gemini role/system/thought filter (mock fetch ทั้งหมด) |
| `tests/unit/output-budget.test.ts` | 4 | สะสม delta, ตัด delta ที่เกินเพดาน, คงสถานะ exhausted, normalize ค่าผิดรูปแบบ |
| **รวม** | **26** | |

> Unit tests ไม่เรียก OpenAI/Gemini จริง และไม่ได้ตรวจว่า model ID ยังใช้ได้กับบัญชีจริง

## 3. Integration tests (workerd + D1, 16 tests)

คำสั่ง: `npm run test:integration`  
ผล: `Test Files 1 passed (1)`, `Tests 16 passed (16)`, duration ~11–15s (cold start อาจ ~19s)  
หมายเหตุ: ตัวแปรใน `vitest.workers.config.ts` ถูก override เป็น `SIGNUP_CODE=test-invite-code` แม้ Wrangler จะแจ้งว่าพบ secrets ใน `.dev.vars`

| กลุ่ม | จำนวน | กรณีที่ทดสอบ |
|---|---:|---|
| Health | 2 | `/api/health` เห็น D1; unknown API คืน JSON 404 |
| Authentication | 5 | first user = admin, invite ผิดถูกปฏิเสธ, login ผิด/ถูก, protected route 401, logout revoke session |
| CSRF | 2 | origin แปลกปลอมได้ 403; same-origin ผ่าน |
| Chat + persistence | 5 | Mock SSE + persist user/assistant, rename/delete, **abort partial persistence**, multi-turn context, allowlist, oversized |
| Authorization / IDOR | 2 | อ่าน/rename/delete/chat ข้ามเจ้าของไม่ได้; list แยกตามผู้ใช้ |
| **รวม** | **16** | |

### 3.1 กรณี abort ที่เพิ่มรอบนี้

Test: `persists the partial assistant message when the client stops reading`

1. ส่ง `POST /api/chat` ด้วย Mock Provider
2. อ่าน response จนได้รับ event `delta` แรก
3. เรียก `reader.cancel()` เพื่อจำลองผู้ใช้กด Stop/ปิดการเชื่อมต่อ
4. poll `GET /api/conversations/:id` จนเห็น assistant message
5. ตรวจว่า role เป็น `['user', 'assistant']`, `status = 'aborted'`, content ยาวกว่า 0

ผล: **ผ่าน** — ยืนยันว่า `waitUntil()` + `cancel()` บันทึกข้อความบางส่วนได้ใน workerd test runtime

## 4. Manual local runtime verification

คำสั่งที่ใช้: `npx wrangler dev --port 8787 --ip 127.0.0.1` (local D1 จาก `.wrangler/state`)  
หมายเหตุ: ใช้บัญชีทดสอบใน local D1 (`owner@example.com`) และ `.dev.vars` ที่ไม่ถูก commit

| # | การทดสอบ | ผลจริง |
|---|---|---|
| M-01 | `GET /api/health` | `200` · `{"status":"ok","environment":"development","database":"ok"}` |
| M-02 | `GET /` | `200 text/html; charset=utf-8` |
| M-03 | `GET /settings/profile` (SPA fallback) | `200 text/html; charset=utf-8` |
| M-04 | Login ด้วย session cookie | `200` · user role `admin` |
| M-05 | Chat ปกติ (Mock) | `200 text/event-stream` · 56 events · 54 delta · `done` · ไม่มี `error` |
| M-06 | Persistence หลัง chat ปกติ | user `complete` 27 chars + assistant `complete` 501 chars |
| M-07 | **Abort กลาง stream** (`curl --max-time 0.18`) | ได้ 1,215 bytes ก่อนตัด; หลังรอ 2 วินาที พบ assistant `status=aborted` 207 chars |
| M-08 | API security headers | `cache-control: no-store`, `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`, `x-frame-options: DENY`, `x-request-id` |
| M-09 | Static security headers | CSP, `permissions-policy`, nosniff, frame deny, referrer policy ครบ |
| M-10 | Secret scan ใน `dist/client` | ไม่พบ `dev-invite-code` / `OPENAI_API_KEY` / `GEMINI_API_KEY` (คำว่า `task-list`/`mask-type` ที่แมตช์ `sk-` ไม่ใช่ secret) |
| M-11 | `wrangler d1 migrations apply DB --local` | สำเร็จ 11 statements |
| M-12 | `wrangler deploy --dry-run --env staging` (ก่อน deploy จริง) | สำเร็จ; upload 880.55 KiB (gzip 147.72 KiB); ภายหลังได้ deploy จริงตาม M-16/M-21 |
| M-13 | **Output cap** (ตั้ง `AI_MAX_OUTPUT_CHARS=120` → clamp เป็น 500 + prompt 200 chars) | หยุดที่ 500 chars · 41 events · `RESPONSE_LIMIT_REACHED` · ไม่มี `done` · persisted `status=error` 500 chars |
| M-14 | **Provider timeout** (`AI_TIMEOUT_SECONDS=1`, `MOCK_DELAY_MS=200`) | ใช้เวลา 1,069 ms · 7 events · 53 chars · `PROVIDER_TIMEOUT` · ไม่มี `done` · persisted `status=error` 53 chars |
| M-15 | **Lazy Markdown chunk + static serving** | main JS 262,161 bytes · Markdown chunk 339,147 bytes · ทั้งคู่ HTTP 200 · SPA fallback 200 · CSP header ยังอยู่ |
| M-16 | **Deploy staging จริง** | `https://ai-web-staging.peerapatmatprasong.workers.dev` · version `820e706c-cf10-48d2-9c13-44405d021b85` |
| M-17 | **Staging flow smoke** | register 201 (admin) · cookie `HttpOnly/Secure/SameSite=Lax` · me 200 · chat 55 events/53 delta/492 chars/`done` · persist user+assistant `complete` · CSRF 403 |
| M-18 | **Staging output cap** | 500 chars · 41 events · `RESPONSE_LIMIT_REACHED` · no `done` · persisted `status=error` 500 chars |
| M-19 | **Staging provider timeout** | 1,859 ms · 7 events · 53 chars · `PROVIDER_TIMEOUT` · no `done` · persisted `status=error` 53 chars |
| M-20 | **Staging abort** | ตัดที่ 1s · SSE 97 chars · persisted `status=aborted` 109 chars |
| M-21 | **Deploy production จริง** | `https://ai-web.peerapatmatprasong.workers.dev` · version `bcb17774-fdf8-4e0b-8f52-4bdef92dd6f9` |
| M-22 | **Production smoke** | health `production/database:ok` · `/` 200 · Markdown asset 200 · unauthenticated 401 · bad invite 403 · CSRF 403 · headers ครบ · D1 tables ครบ · users = 0 |

### 4.1 Generation guardrails (HARD-01)

เพิ่มตัวแปรและโค้ดดังนี้:

- `AI_TIMEOUT_SECONDS` (default 90, ช่วง 1–300): timer abort upstream และตอบ SSE `PROVIDER_TIMEOUT`
- `AI_MAX_OUTPUT_CHARS` (default 32,000, ช่วง 500–200,000): ตัด delta สุดท้ายให้พอดีเพดาน แล้วตอบ `RESPONSE_LIMIT_REACHED`
- `MOCK_DELAY_MS` (Mock only): ใช้เร่ง/หน่วง streaming สำหรับ demo และทดสอบ timeout
- ทั้งสองกรณีบันทึก assistant message บางส่วนด้วย `status=error`; ไม่มี `done`
- การทดสอบ route ทำด้วย `.dev.vars` ชั่วคราวแล้ว restore กลับเป็นค่าเดิม (ไม่ commit ค่า test)

## 5. Build result

คำสั่ง: `npm run build`

```text
dist/client/index.html                     0.68 kB │ gzip:   0.43 kB
dist/client/assets/index-O8KHdmsY.css     42.85 kB │ gzip:   8.38 kB
dist/client/assets/index-BB21c37s.js     262.16 kB │ gzip:  80.35 kB
dist/client/assets/Markdown-HhpVFRTl.js  339.15 kB │ gzip: 103.38 kB
✓ built in ~22s
```

- **ผล:** ผ่าน
- **ไม่มี warning chunk > 500 kB**
- `react-markdown` + `rehype-highlight` ถูกแยกเป็น lazy chunk และโหลดเมื่อมี assistant message
- มี asset ครบ, lazy chunk เสิร์ฟ 200, SPA fallback 200 และ CSP ยังทำงานใน `wrangler dev`

## 6. สิ่งที่ยังไม่ทดสอบ (ต้องไม่ถือว่าผ่าน)

| ID | รายการ | เหตุผล | วิธีทดสอบเมื่อมีทรัพยากร |
|---|---|---|---|
| LIVE-01 | OpenAI จริง | ไม่มี `OPENAI_API_KEY` | ตั้ง secret, เปิด model ที่บัญชีมี, ส่งข้อความสั้น, ตรวจ SSE/error/usage |
| LIVE-02 | Gemini จริง | ไม่มี `GEMINI_API_KEY` | เช่นเดียวกับ LIVE-01 |
| QA-01 | Browser visual/responsive + CSP console | สภาพแวดล้อมเป็น terminal-only ไม่มี browser | เปิด staging/production ที่ 360/768/1280px, ทดสอบ login/chat/stop/copy/rename/delete/refresh |
| QA-02 | E2E อัตโนมัติ (Playwright) | ยังไม่มี dependency/browser | เพิ่มหลัง QA-01 |
| DEPLOY-03 | CPU/PBKDF2 บน Free plan | ยังไม่ได้วัด CPU จาก metrics | วัด login latency/CPU ผ่าน metrics/`wrangler tail` |
| SEC-01 | Rate limit ภายใต้ concurrency จริง | D1-only fixed window ยังไม่ได้ stress test | ยิง concurrent ที่ staging แล้วตรวจว่าไม่เกินเพดาน |
| QA-04 | Live-provider guardrail test | ไม่มี OpenAI/Gemini keys | ทดสอบ timeout/cap กับ provider จริงหลัง LIVE-01/02 |

## 7. ข้อจำกัดที่ทราบ

1. **Abort ก่อน token แรก** — ถ้าตัดการเชื่อมต่อก่อนได้รับ content จะไม่มี assistant row (ระบบเว้นว่างโดยเจตนา) และมีเพียง user message; ไม่ถือว่าเป็นข้อมูลสูญหาย แต่ควรแจ้งผู้ใช้เมื่อกลับมาเปิดบทสนทนา
2. **Abort เป็น best-effort** — ทดสอบบน staging แล้วได้ persisted `status=aborted` แต่ยังเป็น Mock provider และไม่มี browser test
3. **PBKDF2 100k** — ยังไม่วัด CPU บน Cloudflare Free
4. **CSP** — ตรวจเฉพาะ header ที่เสิร์ฟ ยังไม่ได้เปิด browser console
5. **Provider model IDs** — unit test ใช้ mocked fetch; ไม่ยืนยันสิทธิ์การเข้าถึง model ของบัญชีจริง
6. **Lazy Markdown chunk** — ตรวจได้ว่าไฟล์ถูกเสิร์ฟ แต่ยังไม่ได้ยืนยันการโหลด/แสดงผลในเบราว์เซอร์จริง (QA-01)
7. **Timeout/cap** — ทดสอบบน staging ด้วย Mock provider แล้ว แต่ยังไม่ได้ทดสอบกับ OpenAI/Gemini จริง

## 8. วิธีรันซ้ำ

```bash
cd /workspaces/Ai-web
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npx wrangler d1 migrations apply DB --local
npx wrangler dev --port 8787 --ip 127.0.0.1
```

Abort test แบบ manual (ต้อง login และมี local user ก่อน):

```bash
curl -sS -c /tmp/cookies.txt -X POST http://127.0.0.1:8787/api/auth/login \
  -H 'content-type: application/json' -H 'origin: http://127.0.0.1:8787' \
  --data '{"email":"owner@example.com","password":"<local-password>"}'

curl -sS -N --max-time 0.18 -b /tmp/cookies.txt \
  -X POST http://127.0.0.1:8787/api/chat \
  -H 'content-type: application/json' -H 'origin: http://127.0.0.1:8787' \
  --data '{"conversationId":null,"content":"abort test","provider":"mock","model":"mock-echo"}'

# รอ ~2 วินาที แล้วเปิด conversationId จาก event meta
curl -sS -b /tmp/cookies.txt \
  http://127.0.0.1:8787/api/conversations/<conversationId>
```

Timeout/cap test แบบ manual (แก้ `.dev.vars` ชั่วคราวแล้ว restart):

```dotenv
AI_TIMEOUT_SECONDS=1
AI_MAX_OUTPUT_CHARS=500
MOCK_DELAY_MS=200
```

จากนั้นส่งแชทด้วย Mock แล้วตรวจ SSE `error` และ `status` ของ assistant ใน conversation.
ห้าม commit `.dev.vars`; ให้ restore `AI_TIMEOUT_SECONDS=90` / `AI_MAX_OUTPUT_CHARS=32000` หลังทดสอบ

## 9. หลักฐานใน repository

- `tests/unit/**` — 26 unit tests (รวม `output-budget.test.ts`)
- `tests/integration/api.test.ts` — 16 integration tests (รวม abort)
- `vitest.config.ts`, `vitest.workers.config.ts` — test configuration
- `.github/workflows/ci.yml` — typecheck/lint/test/build; รันบน GitHub Actions ผ่านใน PR #1 ([run 39400469357](https://github.com/Beam091/Ai-web/actions/runs/39400469357))
- `worker/routes/chat.ts` — SSE + abort persistence
- `worker/routes/auth.ts`, `worker/middleware/auth.ts` — auth/CSRF

## 10. สถานะปิดงาน

| Task | สถานะ | หมายเหตุ |
|---|---|---|
| TEST-01 | DONE | unit 26/26 |
| TEST-02 | DONE | integration 16/16 |
| API-02 | DONE | SSE + abort partial persistence มี automated test |
| DEPLOY-01 | DONE | local deploy-equivalent ผ่าน |
| DEPLOY-02 | DONE | deploy staging + production จริงและตรวจ health/SPA/flow |
| DOC-03 | DONE | เอกสารมี URL/version/ผลตรวจหลัง deploy |
| QA-03 | DONE | abort/timeout/cap บน staging ผ่าน (Mock provider) |
| QA-01 | TODO | ต้องมี browser |
| LIVE-01/02 | BLOCKED | ต้องมี API keys |
| HARD-01 | DONE | timeout + output cap + unit/manual tests |
| POLISH-01 | DONE | main chunk 262 kB; Markdown lazy chunk 339 kB; ไม่มี warning |
