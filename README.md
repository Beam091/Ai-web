# Nova Chat (AI Web)

เว็บแชท AI บน **Cloudflare Workers + D1** พร้อม frontend **React 19 + TypeScript + Vite + Tailwind CSS 4**
รองรับผู้ให้บริการหลายรายผ่าน adapter: **OpenAI**, **Google Gemini** และ **Mock Provider** สำหรับทดสอบโดยไม่ต้องใช้ API key

> **สถานะ:** deploy จริงแล้วทั้ง staging และ production โดยใช้ **Mock Provider** — ยังไม่ทดสอบ OpenAI/Gemini จริงเพราะยังไม่มี API keys
> - Staging: <https://ai-web-staging.peerapatmatprasong.workers.dev>
> - Production: <https://ai-web.peerapatmatprasong.workers.dev>
>
> รายละเอียดสถานะ/งานค้างทั้งหมดอยู่ใน [`แผนงาน/14-HANDOFF.md`](แผนงาน/14-HANDOFF.md)

## ความสามารถ

- สมัครด้วยรหัสเชิญ, login/logout, session cookie (HttpOnly/SameSite/Secure บน non-dev)
- แยกข้อมูลผู้ใช้ (ownership isolation), CSRF guard, rate limiting
- Streaming คำตอบผ่าน SSE, ปุ่ม Stop, บันทึกข้อความบางส่วนเมื่อ abort
- Guardrails: timeout 90s และเพดานคำตอบ 32,000 ตัวอักษร (ปรับผ่าน env ได้)
- ประวัติบทสนทนาใน D1, เปลี่ยนชื่อ/ลบ, multi-turn context
- Markdown/GFM, code highlight, copy
- UI responsive พร้อม mobile sidebar drawer
- Mock Provider ใช้ทดสอบ UI/DB/streaming ได้ทันที (ติดป้าย DEMO)

## Quickstart

ต้องใช้ **Node.js >= 22**

```bash
npm ci
cp .env.example .dev.vars   # แล้วตั้ง SIGNUP_CODE อย่างน้อย
npm run db:migrate:local
npm run dev                 # Vite :5173 + Worker :8787
```

เปิด `http://localhost:5173` แล้วสมัครด้วยรหัสเชิญจาก `.dev.vars`
หรือทดสอบ API โดยตรงที่ `http://127.0.0.1:8787`

### คำสั่งหลัก

```bash
npm run typecheck          # TypeScript 3 projects
npm run lint               # ESLint
npm test                   # unit (Node) + integration (workerd + D1)
npm run build              # frontend -> dist/client
npm run deploy:staging     # build + deploy staging (D1/secrets ตั้งไว้แล้ว)
npm run deploy:production  # build + deploy production
```

## โครงสร้าง

```text
worker/            Hono API, auth, provider adapters, D1 queries
src/               React frontend
migrations/        D1 migrations
tests/             unit + integration tests
public/            static assets (_headers, favicon)
แผนงาน/             เอกสารแผนงาน/ส่งต่อ 18 ไฟล์ (ภาษาไทย)
wrangler.jsonc     Worker + assets + D1 + staging/production env
```

## ความปลอดภัย

- API keys อยู่ฝั่ง Worker เท่านั้น (secrets) ไม่ส่งลง client
- Session เก็บเป็น hash ใน D1; cookie เป็น HttpOnly
- SQL ใช้ parameterized queries; ไม่ render HTML ดิบจาก Markdown
- CSP และ security headers อยู่ที่ `public/_headers` + Worker middleware
- จำกัดเวลา/ความยาว generation ฝั่ง server และไม่รับค่าจาก client
- อย่า commit `.dev.vars`/`.env` หรือ secret ใด ๆ

## เอกสาร

เริ่มที่ [`แผนงาน/00-README.md`](แผนงาน/00-README.md) จากนั้นอ่าน [`14-HANDOFF.md`](แผนงาน/14-HANDOFF.md), [`05-TASK-BOARD.md`](แผนงาน/05-TASK-BOARD.md) และ [`08-TEST-REPORT.md`](แผนงาน/08-TEST-REPORT.md)
