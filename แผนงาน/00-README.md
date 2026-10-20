# 00 — README (จุดเริ่มต้นของโปรเจกต์)

> **อัปเดตล่าสุด:** 2026-10-20
> **สถานะ:** Deploy จริงแล้วทั้ง staging และ production (Mock Provider) — ยังไม่ทดสอบ Provider จริง
> **ชื่อผลิตภัณฑ์:** Nova Chat (AI Web Platform)
> **Staging:** https://ai-web-staging.peerapatmatprasong.workers.dev
> **Production:** https://ai-web.peerapatmatprasong.workers.dev

## 1. โปรเจกต์นี้คืออะไร

เว็บแชท AI ที่มีประสบการณ์ใช้งานใกล้เคียง Open WebUI แต่สร้างใหม่ทั้งหมดบน **Cloudflare Workers + D1 + React/Vite**
รองรับผู้ให้บริการ AI หลายรายผ่าน Adapter (ปัจจุบัน: OpenAI, Google Gemini และ Mock Provider สำหรับทดสอบ)
มีระบบสมาชิกด้วยรหัสเชิญ, แยกข้อมูลผู้ใช้, Streaming, บันทึกประวัติ, Markdown/Code Block และ UI ที่รองรับมือถือ

ซอร์สโค้ดทั้งหมดอยู่ใน Repository นี้ และ **ทุกอย่างที่ Agents ต้องรู้ถูกเก็บไว้ในโฟลเดอร์ `แผนงาน/`** ไม่ได้พึ่งประวัติแชท

## 2. ลำดับการอ่านเอกสาร (บังคับสำหรับ Agent คนถัดไป)

1. `แผนงาน/00-README.md` (ไฟล์นี้)
2. `แผนงาน/14-HANDOFF.md` — สถานะล่าสุด + งานถัดไป + prompt รับช่วงงาน
3. `แผนงาน/05-TASK-BOARD.md` — งานทั้งหมดและสถานะ
4. `แผนงาน/01-PROJECT-SCOPE.md` — scope และเกณฑ์ยอมรับ
5. `แผนงาน/02-ARCHITECTURE.md` — สถาปัตยกรรมจริง
6. เอกสารเฉพาะทางตามงานที่จะทำ: `11-DATABASE.md`, `12-API-REFERENCE.md`, `13-SECURITY.md`, `09-DEPLOYMENT.md`
7. `แผนงาน/06-DECISIONS.md` และ `07-ISSUES-AND-RISKS.md` ก่อนเปลี่ยนสิ่งที่มีอยู่
8. `แผนงาน/17-AGENT-PROTOCOL.md` — กติกาการทำงาน/ส่งต่อ

## 3. ลำดับความสำคัญของข้อมูล (Source of Truth)

เมื่อข้อมูลขัดกัน ให้ยึดตามลำดับนี้:

1. **โค้ดและผลทดสอบที่รันจริง** (`worker/`, `src/`, `migrations/`, `tests/`, ผลคำสั่งใน `08-TEST-REPORT.md`)
2. `แผนงาน/14-HANDOFF.md` (สถานะล่าสุด)
3. `แผนงาน/05-TASK-BOARD.md` และ `แผนงาน/06-DECISIONS.md`
4. เอกสารอื่น ๆ ใน `แผนงาน/`

หากเอกสารไม่ตรงกับโค้ด ให้ถือว่า **เอกสารผิด** และต้องแก้เอกสารในงานเดียวกัน ห้ามแก้โค้ดให้ตรงกับเอกสารเก่าโดยไม่ตรวจสอบ

## 4. ข้อเท็จจริงสำคัญของ Repository

| รายการ | ค่า |
|---|---|
| Working directory | `/workspaces/Ai-web` |
| Branch | `main` |
| Commit ล่าสุด | ดู `git log` (เริ่มจาก `804d028 Initial commit` + commit รอบ deploy) |
| Runtime | Cloudflare Workers (workerd), `compatibility_date = 2026-10-01` |
| Frontend | React 19 + TypeScript + Vite 7 + Tailwind CSS 4 |
| Backend | Hono 4 บน Worker (`worker/index.ts`) |
| Database | Cloudflare D1 (SQLite), migrations ใน `migrations/` |
| Static hosting | Workers Static Assets จาก `dist/client` (SPA fallback) |
| Tests | Vitest 4: unit 26 tests (Node) + integration 16 tests (workerd + D1 จริงในเครื่อง) — ผ่านทั้งหมด |
| Deploy | **Deploy แล้ว** staging + production (Cloudflare Workers + D1, region APAC) เมื่อ 2026-10-20 |
| Provider จริง | **ยังไม่เคยเรียก OpenAI/Gemini จริง** — ไม่มี API Key; ทั้งสอง env ใช้ `DEFAULT_PROVIDER=mock` |

## 5. โครงสร้างโฟลเดอร์โดยย่อ

```
worker/            API (Hono), auth, providers, D1 queries
src/               React frontend
migrations/        D1 SQL migrations
tests/unit/        unit tests (Node)
tests/integration/ integration tests (workerd + D1)
public/            static assets (_headers, favicon)
แผนงาน/            เอกสารแผนงาน/ส่งต่อทั้งหมด (18 ไฟล์)
wrangler.jsonc     Worker + assets + D1 + env (staging/production)
wrangler.test.jsonc config สำหรับ integration tests
```

## 6. คำสั่งหลัก

```bash
npm ci
npm run dev              # Vite (5173) + wrangler dev (8787)
npm run typecheck        # tsc 3 projects
npm run lint             # ESLint (flat config)
npm test                 # unit + integration
npm run build            # frontend -> dist/client
npm run deploy           # build + wrangler deploy (ยังไม่ควรใช้จนตั้งค่า D1/secrets)
```

## 7. เอกสารทั้งหมด

| ไฟล์ | เนื้อหา |
|---|---|
| `01-PROJECT-SCOPE.md` | เป้าหมาย, scope, acceptance criteria |
| `02-ARCHITECTURE.md` | สถาปัตยกรรม, data flow, ข้อจำกัด Cloudflare |
| `03-TECH-STACK.md` | เวอร์ชันจริง, dependencies, free tier |
| `04-IMPLEMENTATION-PLAN.md` | แผน Phase, dependencies, ความเสี่ยง |
| `05-TASK-BOARD.md` | Task ID + สถานะ |
| `06-DECISIONS.md` | ADR / เหตุผลการตัดสินใจ |
| `07-ISSUES-AND-RISKS.md` | ปัญหาที่พบและความเสี่ยงคงเหลือ |
| `08-TEST-REPORT.md` | ผลทดสอบจริง แยกผ่าน/ไม่ผ่าน/ยังไม่ทดสอบ |
| `09-DEPLOYMENT.md` | ขั้นตอน deploy, rollback, สิ่งที่เจ้าของต้องทำ |
| `10-ENVIRONMENT.md` | ตัวแปร env และ secrets ทั้งหมด |
| `11-DATABASE.md` | ER diagram, schema, migrations, backup |
| `12-API-REFERENCE.md` | API ทุก endpoint + ตัวอย่าง |
| `13-SECURITY.md` | Threat model, controls, ข้อจำกัด |
| `14-HANDOFF.md` | ส่งต่องาน + prompt พร้อมใช้ |
| `15-CHANGELOG.md` | ประวัติการเปลี่ยนแปลง |
| `16-OPEN-QUESTIONS.md` | คำถาม/สมมติฐานที่ยังไม่ปิด |
| `17-AGENT-PROTOCOL.md` | กติกา Agent-to-Agent |

## 8. กติกาสั้น ๆ

- ห้าม commit secret หรือไฟล์ `.dev.vars` / `.env`
- ห้ามบอกว่า Deploy สำเร็จหรือทดสอบ Provider จริงแล้วถ้าไม่มีหลักฐาน
- ทุกงานต้องอัปเดต Task Board + Test Report + Changelog และปิดท้ายด้วย Handoff
- งานที่ยังไม่ผ่านเกณฑ์ห้ามตั้งเป็น `DONE` (ใช้ `TODO` / `IN_PROGRESS` / `BLOCKED` / `DEFERRED`)
