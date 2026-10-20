# 02 — ARCHITECTURE

> อัปเดต: 2026-10-20 · อ้างอิงข้อจำกัด Cloudflare จากเอกสารทางการ (Workers limits อัปเดต 2026-10-12, D1 limits อัปเดต 2026-04-21)

## 1. ภาพรวม

สถาปัตยกรรมที่เลือกคือ **Single Cloudflare Worker + Static Assets + D1** ไม่ใช่ Pages + Functions แยกส่วน และไม่ใช่ monorepo หลาย Worker

```
Browser (React SPA)
  │  GET /                → Static Assets (dist/client)
  │  /api/*               → Worker (Hono)
  ▼
Cloudflare Worker (worker/index.ts)
  ├── middleware: request-id, security headers, CSRF, body limit
  ├── /api/auth/*        → session cookie + D1
  ├── /api/models        → provider catalog + availability
  ├── /api/conversations → CRUD + ownership
  └── /api/chat          → SSE stream
        │
        ├── ProviderRegistry → OpenAIProvider  ──fetch──▶ api.openai.com
        │                    → GeminiProvider  ──fetch──▶ generativelanguage.googleapis.com
        │                    → MockProvider    (in-process, no network)
        │
        └── D1 (DB binding)
              users / sessions / conversations / messages / rate_limits
```

## 2. การไหลของข้อมูล

### 2.1 โหลดแอป
1. Browser ขอ `/` → Workers Static Assets ตอบ `index.html` (SPA fallback สำหรับ path อื่น)
2. React เรียก `GET /api/auth/me`
3. ถ้า 401 → แสดงหน้า Login/Register
4. ถ้า 200 → เรียก `GET /api/models` + `GET /api/conversations` พร้อมกัน

### 2.2 สมัคร/เข้าสู่ระบบ
1. `POST /api/auth/register` ตรวจรหัสเชิญ (`SIGNUP_CODE`), rate limit, อีเมลซ้ำ
2. hash รหัสผ่านด้วย PBKDF2-SHA256 100,000 รอบ + salt 16 bytes
3. ถ้าเป็นผู้ใช้คนแรก → role `admin`
4. สร้าง session token 32 bytes แบบสุ่ม, เก็บ **SHA-256 ของ token** ใน D1, ส่ง token ดิบใน cookie
5. Cookie: `HttpOnly; SameSite=Lax; Path=/; Max-Age=7d; Secure` (Secure เมื่อ `APP_ENV !== development`)
6. `POST /api/auth/logout` ลบ session row + clear cookie

### 2.3 ส่งข้อความ + Streaming
```
Client POST /api/chat {conversationId?, content, provider, model}
  → requireAuth
  → validate (zod)
  → allowlist provider/model + ตรวจว่า provider มี key
  → rate limit (D1 fixed window)
  → create conversation (ถ้าไม่มี) / ตรวจ ownership
  → INSERT user message
  → โหลด context 40 ข้อความล่าสุด (budget 24k ตัวอักษร)
  → ตอบ 200 text/event-stream ทันที
       event: meta   {conversationId, messageIds, title}
       event: delta  {text}   (หลายครั้ง)
       event: done   {assistantMessageId, characters}
       event: error  {code, message}  (กรณีล้มเหลว)
  → เมื่อจบ: INSERT assistant message + UPDATE conversation.updated_at
```

- ฝั่ง client ใช้ `fetch()` + `ReadableStream` (ไม่ใช้ `EventSource` เพราะต้อง POST)
- ปุ่ม Stop เรียก `AbortController.abort()` → Worker รับ `cancel()` ของ stream แล้ว abort fetch upstream
- ข้อความ assistant ที่ได้บางส่วนจะถูกบันทึกด้วย status `aborted` หรือ `error` (best-effort)
- **ไม่มี retry อัตโนมัติ** เพื่อป้องกันการเรียกซ้ำ/คิดเงินซ้ำ — ผู้ใช้กดส่งใหม่เอง

### 2.4 โหลดประวัติ
- `GET /api/conversations` คืน 200 รายการล่าสุด เรียง `updated_at DESC`
- `GET /api/conversations/:id` ตรวจ `user_id` ก่อน แล้วคืน messages สูงสุด 500
- Client ไม่ถือ user id เอง — server ใช้ session user เท่านั้น

## 3. หน้าที่ของแต่ละส่วน

### Frontend (`src/`)
- React 19 SPA, state อยู่ใน `App.tsx` (ไม่มี state library)
- `api.ts` รวม HTTP + SSE parser ฝั่ง client
- `components/` แยก AuthScreen, Sidebar, ChatView, MessageBubble, Composer, ModelSelector, Markdown
- Markdown render ด้วย `react-markdown` + `remark-gfm` + `rehype-highlight`
- **ไม่ render HTML ดิบ** (ไม่ใช้ `rehype-raw`) จึงลด XSS จาก Markdown

### Backend (`worker/`)
- Hono app ผูก `basePath('/api')`
- `routes/` จัดกลุ่ม endpoint
- `db/queries.ts` รวม SQL ทั้งหมด (parameterized)
- `providers/` adapter + catalog + registry
- `lib/` crypto, validation, rate limit, errors, compare
- `middleware/auth.ts` session + CSRF

### Database (D1)
- เก็บ user, session, conversation, message, rate limit
- ใช้ FK + `ON DELETE CASCADE` กับ session/conversation/message
- ดู schema เต็มที่ `11-DATABASE.md`

### AI Provider
- Adapter แปลง request/response ของแต่ละ vendor เป็น text delta มาตรฐาน
- Business logic ไม่รู้จัก JSON ของ OpenAI/Gemini
- การเพิ่ม provider ใหม่: สร้าง class implements `AIProvider` → เพิ่มใน registry + catalog (ดู `12-API-REFERENCE.md`)

## 4. Authentication และ Authorization

- **Authentication:** session cookie (opaque token) + D1 lookup; ไม่มี JWT เพื่อให้ revoke ได้ทันที
- **Authorization:** ทุก query ที่แตะ conversation/message ใส่ `user_id` ใน WHERE หรือตรวจ ownership ก่อน
- **IDOR:** คืน 404 (ไม่ใช่ 403) เมื่อ resource ไม่ใช่ของ user เพื่อไม่เปิดเผยว่ามีอยู่
- **CSRF:** SameSite=Lax + ตรวจ `Sec-Fetch-Site: cross-site` + ตรวจ `Origin` ให้ตรง Host
- **Role:** เก็บ `role` แต่ MVP ยังไม่มี endpoint ที่ใช้สิทธิ์ admin (มีไว้ต่อยอด)

## 5. การจัดการ Streaming

- ใช้ SSE format มาตรฐาน (`event:` + `data:`) ผ่าน POST
- Worker ส่ง response headers: `text/event-stream`, `no-cache`, `x-accel-buffering: no`
- สะสมข้อความ assistant เพื่อบันทึกตอนจบ โดยมีเพดาน `AI_MAX_OUTPUT_CHARS` (default 32,000) และตัด delta สุดท้ายให้ไม่เกินเพดาน
- `AI_TIMEOUT_SECONDS` (default 90) abort upstream หากใช้เวลานานเกิน และส่ง SSE `PROVIDER_TIMEOUT`
- Client parser รองรับ event ที่ถูกตัดข้าม chunk, CRLF, หลาย `data:` ต่อ event
- เมื่อ client ตัดการเชื่อมต่อ งานเบื้องหลังอาจถูกยกเลิกโดย runtime; การบันทึก partial จึงเป็น best-effort

## 6. Error และ Retry

| ชั้น | พฤติกรรม |
|---|---|
| Validation | 400 + code `VALIDATION_ERROR` / `MODEL_NOT_ALLOWED` |
| Auth | 401 `UNAUTHORIZED` |
| Ownership | 404 `NOT_FOUND` |
| Rate limit | 429 `RATE_LIMITED` |
| Provider auth | 502 `PROVIDER_AUTH_ERROR` (ไม่ส่ง body ของ vendor) |
| Provider rate limit | 429 `PROVIDER_RATE_LIMITED` |
| Provider 5xx/network | 502 `PROVIDER_UNAVAILABLE` |
| Provider ส่งข้อความว่าง | 502 `PROVIDER_EMPTY_RESPONSE` |
| เกินเวลา generate | SSE `PROVIDER_TIMEOUT` (HTTP ยังเป็น 200) |
| เกินเพดานคำตอบ | SSE `RESPONSE_LIMIT_REACHED` (HTTP ยังเป็น 200) |
| ไม่คาดคิด | 500 `INTERNAL_ERROR` + log เฉพาะ requestId/ชื่อ error |

- Retry: **ไม่มี** โดยเจตนา
- Timeout: `AI_TIMEOUT_SECONDS` (default 90, 1–300) abort upstream; client abort ยังทำงานแยกกัน
- Output cap: `AI_MAX_OUTPUT_CHARS` (default 32,000, 500–200,000) บันทึก partial เป็น `status=error`
- Log: ไม่ log เนื้อหาแชท, API key, cookie หรือ token

## 7. Secrets และ API Keys

- เก็บเป็น Worker Secrets: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `SIGNUP_CODE`
- ใช้ผ่าน `c.env` ฝั่ง server เท่านั้น; ไม่มี endpoint ใดส่งค่ากลับ client
- `wrangler.jsonc` เก็บเฉพาะ `vars` ที่ไม่ลับ (`APP_ENV`, `DEFAULT_PROVIDER`, rate limit)
- `.dev.vars` ถูก `.gitignore`; `.env.example` มีแต่ placeholder
- Base URL ของ provider มาจาก env (ไม่รับจาก client) และบังคับ HTTPS

## 8. ข้อจำกัด Cloudflare ที่มีผลต่อการออกแบบ

| ข้อจำกัด | ค่า (Free / Paid) | ผลต่อระบบ |
|---|---|---|
| CPU time ต่อ request | **10 ms** / 5 นาที | เสี่ยงที่สุดกับ PBKDF2 login; ต้องวัดบน production จริง (RISK-01) |
| Requests/วัน | 100,000 / ไม่จำกัด | เพียงพอสำหรับ MVP แต่ static asset ก็กิน quota |
| Subrequests/request | 50 / 10,000 | 1 provider fetch + D1 queries (นับเป็น subrequest) ~6-8 ครั้ง/แชท |
| D1 database size | 500 MB / 10 GB | ข้อความแชทใช้พื้นที่น้อย แต่ต้องมี retention policy ระยะยาว |
| D1 queries/invocation | ~50 / 1000 | ระบบใช้ ~6-8 queries ต่อการส่งหนึ่งครั้ง |
| D1 rows read/written | มีโควตารายวันตาม plan | ต้องติดตามเมื่อผู้ใช้เพิ่ม |
| Request body | 100 MB (ไม่ใช่ตัวจำกัดจริง) | เราจำกัดเอง 256 KB |
| Worker size | 64 MiB | bundle ปัจจุบัน ~ไม่กี่ร้อย KB (frontend ไม่นับใน Worker bundle) |
| D1 concurrency | single-threaded ต่อ DB | เหมาะกับผู้ใช้ระดับเล็ก-กลาง |
| Duration HTTP | ไม่มี hard limit | Streaming ยาวได้ แต่ runtime update อาจตัดที่ ~20 นาที |

> ตัวเลขเหล่านี้อ้างอิงเอกสาร ณ 2026-10-20 และอาจเปลี่ยน — ต้องตรวจซ้ำก่อน scale

## 9. เหตุผลที่เลือกเทคโนโลยี

ดูรายละเอียดใน `06-DECISIONS.md` สรุป:

- **Workers + Static Assets:** deploy ชิ้นเดียว, routing ง่าย, SPA fallback ในตัว, ลด moving parts
- **Hono:** เบา, รองรับ Web Standard, middleware พร้อม, TypeScript ดี
- **D1:** ผูกกับ Workers, migrations ผ่าน Wrangler, เพียงพอสำหรับ relational data ของแชท
- **React + Vite:** ecosystem Markdown/Streaming ครบ, build เร็ว, static output ตรงกับ Workers Assets
- **Tailwind CSS 4:** ลด CSS ที่ต้องเขียนเอง, theme dark ทำได้เร็ว
- **SSE:** เรียบง่ายกว่า WebSocket, ทำงานผ่าน HTTP ปกติ, เหมาะกับ one-way token stream
- **Session cookie:** revoke ง่าย, ไม่ต้องจัดการ JWT secret/refresh token

## 10. ทางเลือกที่พิจารณาแล้วไม่เลือก

| ทางเลือก | เหตุผลที่ไม่เลือก |
|---|---|
| Open WebUI ตัวเต็มบน Workers | ผูกกับ Python/filesystem/process ไม่เข้ากับ Workers runtime |
| Cloudflare Pages + Functions แยก | เพิ่มความซับซ้อนเรื่อง routing/build โดยไม่จำเป็น |
| Durable Objects สำหรับ session/rate limit | เร็วและ consistent กว่า แต่เพิ่มค่าใช้จ่าย/ความซับซ้อนเกิน MVP |
| KV สำหรับ session | eventual consistency ทำให้ logout/revoke ไม่ทันที |
| JWT | revoke ยาก, ต้องจัดการ secret/rotation, ไม่ได้ประโยชน์กับ scale นี้ |
| WebSocket | two-way ไม่จำเป็น, จัดการ reconnect ยากกว่า |
| AI SDK / Vercel AI SDK | abstraction ใหญ่เกิน, ควบคุม request format/error ได้น้อยกว่า adapter เอง |
| Drizzle ORM | schema เล็ก, raw SQL + migrations ตรงไปตรงมาและเบากว่า |
| Queue/Workflow สำหรับบันทึกข้อความ | ยังไม่จำเป็นที่ scale นี้ |
