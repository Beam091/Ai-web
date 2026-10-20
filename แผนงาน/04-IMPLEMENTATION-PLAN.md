# 04 — IMPLEMENTATION PLAN

> อัปเดต: 2026-10-20 · แผนนี้สะท้อนสิ่งที่ทำจริงแล้วและสิ่งที่เหลือ

## ภาพรวม Phase

| Phase | เป้าหมาย | สถานะ |
|---|---|---|
| 0 | สำรวจ Repository / Git / toolchain | DONE |
| 1 | สร้างโฟลเดอร์และเอกสารแผนงาน 18 ไฟล์ | DONE |
| 2 | ตรวจสอบเทคโนโลยี/ข้อจำกัด Cloudflare | DONE |
| 3 | ออกแบบสถาปัตยกรรม + task breakdown | DONE |
| 4 | MVP-01 Project setup + health check | DONE |
| 5 | MVP-02 UI foundation | DONE (รอ visual QA) |
| 6 | MVP-03 Provider layer | DONE (adapter + unit test; live ยังไม่ทดสอบ) |
| 7 | MVP-04 Chat API + streaming | DONE |
| 8 | MVP-05 Database + history | DONE |
| 9 | MVP-06 Authentication/Authorization | DONE |
| 10 | MVP-07 Testing | DONE |
| 11 | MVP-08 Deployment | DONE — staging + production deploy จริง, smoke ผ่าน |
| 12 | Live provider verification | BLOCKED — ยังไม่มี OpenAI/Gemini keys |
| 13 | Production hardening / polish | DONE (timeout/cap, lazy bundle, เอกสาร) — เหลือ CPU/rate-limit/browser QA |

## Phase 0 — สำรวจ Repository

**งาน**
- ตรวจ cwd, ไฟล์ทั้งหมด, Git status/branch, README, ไม่มี package.json เดิม
- พบเพียง `README.md` (1 บรรทัด) และ `prompt.txt`

**เกณฑ์เสร็จ:** ระบุสถานะ repo และสิ่งที่ไม่รู้ได้
**ผล:** DONE — repo ว่าง, branch `main`, commit `804d028`

## Phase 1 — แผนงาน

**งาน**
- สร้าง `แผนงาน/` และเอกสาร 00–17 (18 ไฟล์)
- กำหนด scope, architecture, task board, acceptance criteria, risks
- ระบุสมมติฐาน/คำถามเปิด

**เกณฑ์เสร็จ:** Agent ใหม่สามารถอ่านแล้วเข้าใจสถานะ/งานถัดไป
**ทดสอบ:** ตรวจ link และความสอดคล้องกับโค้ดจริง
**ผล:** DONE

## Phase 2 — ตรวจสอบเทคโนโลยี

**งาน**
- ตรวจเวอร์ชันล่าสุดของ Hono, Wrangler, Vite, React, Tailwind, Vitest, Cloudflare plugin
- อ่านข้อจำกัด Workers และ D1 จากเอกสารทางการ (2026-10)
- พบว่า `@cloudflare/vitest-pool-workers` ถูกเปลี่ยนชื่อเป็น `@cloudflare/vitest-plugin`
- ตรวจว่า Open WebUI ไม่สามารถรันตรงบน Workers ได้ → สร้างใหม่

**เกณฑ์เสร็จ:** ระบุเวอร์ชัน/ข้อจำกัดและเหตุผลได้
**ผล:** DONE

## Phase 3 — Architecture

**งาน**
- เลือก Single Worker + Static Assets + D1
- ออกแบบ auth (session), provider adapter, SSE protocol, schema
- บันทึก ADR ใน `06-DECISIONS.md`

**เกณฑ์เสร็จ:** มี diagram, data flow, เหตุผล/ทางเลือก
**ผล:** DONE

## Phase 4 — MVP-01 Project Setup

**งาน**
- `package.json`, tsconfig 3 projects, Vite, Tailwind, Wrangler
- Worker + Hono + `/api/health`
- SPA + static assets config
- ESLint, Prettier ไม่ได้ใช้ (จัดรูปแบบด้วยมือตามสไตล์เดียวกัน)
- `.gitignore`, `.env.example`
- CI workflow

**เกณฑ์เสร็จ:** `npm run build`, typecheck, lint ผ่าน
**ทดสอบ:** build + health ผ่าน local
**ผล:** DONE

## Phase 5 — MVP-02 UI Foundation

**งาน**
- Layout, Sidebar (desktop/mobile drawer), ChatView, Composer
- Model/Provider selector, empty state, loading, error banner
- Markdown + code highlight + copy
- Responsive breakpoints, keyboard/a11y basis
- Streaming caret/typing indicator, Stop button

**เกณฑ์เสร็จ:** ใช้งาน flow หลักได้บน local
**ทดสอบ:** build/typecheck/lint + ตรวจ HTML served
**ยังเหลือ:** visual QA บน browser/อุปกรณ์จริง (QA-01)

## Phase 6 — MVP-03 Provider Layer

**งาน**
- `AIProvider` interface + normalized errors
- OpenAI adapter (Chat Completions, SSE)
- Gemini adapter (streamGenerateContent, alt=sse)
- Mock adapter
- catalog + allowlist + availability
- SSE parser กลาง

**เกณฑ์เสร็จ:** adapter แปลง stream ได้, ไม่มี key หลุด client
**ทดสอบ:** unit tests ด้วย mocked fetch (ไม่ใช่ API จริง)
**ยังเหลือ:** live test ด้วย key จริง (LIVE-01/02)

## Phase 7 — MVP-04 Chat API

**งาน**
- `POST /api/chat` + validation + allowlist + rate limit
- ownership check, สร้าง conversation อัตโนมัติ
- SSE meta/delta/done/error, abort handling
- safe error mapping, ไม่ leak upstream body

**เกณฑ์เสร็จ:** ส่งข้อความ Mock แล้วได้ stream + บันทึกครบ
**ทดสอบ:** integration tests (streaming, persistence, allowlist, CSRF, size)
**ผล:** DONE

## Phase 8 — MVP-05 Database

**งาน**
- migration `0001_init.sql`
- ตาราง users/sessions/conversations/messages/rate_limits + indexes
- CRUD + history + ownership
- context budget

**เกณฑ์เสร็จ:** migration apply ได้, แยกข้อมูลผู้ใช้
**ทดสอบ:** integration tests + `wrangler d1 migrations apply --local`
**ผล:** DONE

## Phase 9 — MVP-06 Authentication

**งาน**
- register (invite code), login, logout, me
- PBKDF2 hash, session token hash ใน DB, cookie flags
- rate limit login/register
- CSRF guard
- frontend auth screen + session restore

**เกณฑ์เสร็จ:** ทุก protected endpoint ต้องมี session; IDOR ไม่ผ่าน
**ทดสอบ:** integration 6 auth cases + IDOR 4 operations
**ผล:** DONE

## Phase 10 — MVP-07 Testing

**งาน**
- unit: SSE parser, adapters, validation, catalog, crypto
- integration: health, auth, CSRF, chat, persistence, IDOR
- CI รัน typecheck/lint/test/build

**เกณฑ์เสร็จ:** ทุก suite ผ่าน, ระบุสิ่งที่ไม่ทดสอบ
**ผล:** DONE — 28 unit + 16 integration ผ่าน

## Phase 11 — MVP-08 Deployment

**งานที่ทำ**
- wrangler config + env staging/production
- คู่มือ deploy/rollback/secret/migrations
- local deploy-equivalent test (wrangler dev + D1 local)

**งานที่ยังไม่ทำ**
- สร้าง D1 บน Cloudflare จริง
- ตั้ง secrets จริง
- deploy staging/production
- ตรวจ health บน URL จริง

**สถานะ:** BLOCKED — ต้องมี Cloudflare credentials/บัญชีของเจ้าของ

## Phase 12 — Live Provider Verification

**ต้องมี:** `OPENAI_API_KEY`, `GEMINI_API_KEY` ที่ใช้งานได้และมี quota
**ทดสอบที่ต้องทำ:** ส่งข้อความสั้น, ตรวจ streaming, ตรวจ error เมื่อ key ผิด, วัด latency/CPU
**สถานะ:** BLOCKED

## Phase 13 — Production Hardening (IN_PROGRESS)

ทำแล้ว:
- เพิ่ม `AI_TIMEOUT_SECONDS` + `AI_MAX_OUTPUT_CHARS` พร้อม unit/manual tests
- แก้ abort listener cleanup และบันทึก partial ด้วย `status=aborted`/`error`
- ลด bundle ด้วย lazy Markdown/highlight (main ~264.61 kB, chunk แยก 339.15 kB)

ยังเหลือ:
- พิจารณา Cloudflare Rate Limiting/WAF แทน D1-only
- เพิ่ม admin/user management หรือปิด registration หลังสร้าง users
- password reset / email verification (ถ้าต้องการผู้ใช้ภายนอก)
- data retention/ลบข้อมูลตามนโยบาย
- E2E/visual regression
- observability dashboard + alerts
- ตรวจ CPU ของ PBKDF2 บน Free plan

## Dependencies ระหว่างงาน

```
DOC ─┬─> SETUP ─> UI ─────────────┐
     ├─> DB ─> CHAT API ─> UI integration
     └─> PROVIDERS ───────────────┘
AUTH ─> ทุก protected endpoint
CHAT API ─> TESTS ─> DEPLOY
DEPLOY ─> LIVE PROVIDER TEST
```

## ความเสี่ยงและแผนรับมือ (สรุป)

| ความเสี่ยง | แผนรับมือ |
|---|---|
| PBKDF2 เกิน CPU 10 ms บน Free | วัดจริง; ถ้าเกิน ลด iterations หรือใช้ Workers Paid / external auth |
| Provider API เปลี่ยน/model หมดอายุ | ตรวจเอกสารก่อน deploy, ใช้ allowlist ที่แก้ได้ผ่าน env |
| ค่าใช้จ่าย API บานปลาย | rate limit + timeout/output cap + ตั้ง budget ที่ provider + ติดตาม usage |
| D1 โควตา/ขนาด | retention policy, ลบข้อความเก่า, ติดตาม metrics |
| ไม่มี live test | ทำ LIVE-01/02 ก่อนเปิดผู้ใช้จริง |
| Bundle ใหญ่ | แก้แล้วด้วย POLISH-01 (lazy Markdown); main chunk ~264.61 kB |
| Streaming ถูกตัดกลางทาง | บันทึก partial (`aborted`/`error`) + แจ้งผู้ใช้ + ให้ส่งใหม่; timeout/cap ส่ง error code ชัดเจน |
