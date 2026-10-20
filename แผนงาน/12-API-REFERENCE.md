# 12 — API REFERENCE

> Base path: `/api` · อัปเดต: 2026-10-20
> ทุก endpoint (ยกเว้น health/register/login) ต้องมี session cookie `ai_session`
> Response เป็น JSON ยกเว้น `/api/chat` ที่เป็น `text/event-stream`

## 1. รูปแบบ Error มาตรฐาน

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "ข้อความภาษาไทยที่ปลอดภัยสำหรับผู้ใช้"
  }
}
```

| HTTP | Code | ความหมาย |
|---|---|---|
| 400 | `BAD_REQUEST` / `VALIDATION_ERROR` / `MODEL_NOT_ALLOWED` | ข้อมูลไม่ถูกต้อง/โมเดลไม่อนุญาต |
| 401 | `UNAUTHORIZED` | ไม่มี/หมดอายุ session หรือ login ผิด |
| 403 | `FORBIDDEN` | รหัสเชิญผิด, CSRF, ปิดรับสมัคร |
| 404 | `NOT_FOUND` | ไม่พบ resource หรือไม่มีสิทธิ์ (IDOR) |
| 409 | `CONFLICT` | อีเมลซ้ำ |
| 413 | `PAYLOAD_TOO_LARGE` | body > 256 KB |
| 429 | `RATE_LIMITED` / `PROVIDER_RATE_LIMITED` | ถูกจำกัดความถี่ |
| 500 | `INTERNAL_ERROR` | ข้อผิดพลาดภายใน |
| 502 | `PROVIDER_AUTH_ERROR` / `PROVIDER_UNAVAILABLE` / `PROVIDER_BAD_RESPONSE` / `PROVIDER_EMPTY_RESPONSE` / `PROVIDER_MODEL_UNAVAILABLE` | ปัญหาจาก provider |
| 503 | `PROVIDER_NOT_CONFIGURED` | ยังไม่ตั้ง API key (ปกติ endpoint นี้ไม่ถึง เพราะ allowlist กรองก่อน) |

## 2. Health

### `GET /api/health` — public

```json
{
  "status": "ok",
  "service": "ai-web",
  "environment": "development",
  "database": "ok",
  "time": "2026-10-20T08:22:40.944Z"
}
```

- `status`: `ok` หรือ `degraded` (ถ้า D1 ใช้งานไม่ได้)
- ไม่มี secret ใด ๆ

## 3. Authentication

### `POST /api/auth/register`

Request:

```json
{
  "email": "user@example.com",
  "password": "อย่างน้อย 8 ตัวอักษร",
  "inviteCode": "AB12CD34"
}
```

Response `201`:

```json
{
  "user": { "id": "uuid", "email": "user@example.com", "role": "admin" }
}
```

- ผู้ใช้คนแรกของระบบได้ `admin`, ถัดไปได้ `user`
- ตั้ง cookie `ai_session` (HttpOnly, SameSite=Lax, Secure ตาม APP_ENV, 7 วัน)
- ถ้าไม่ได้ตั้ง `SIGNUP_CODE` → 403
- รหัสเชิญต้องมี **8 ตัวอักษร** (ตัวพิมพ์เล็ก/ใหญ่ได้; server normalize เป็นตัวพิมพ์ใหญ่); ผิดความยาว → 400 `VALIDATION_ERROR`
- รหัสผ่าน 8–200 ตัวอักษร; อีเมลถูก lowercase

### `POST /api/auth/login`

```json
{ "email": "user@example.com", "password": "..." }
```

Response `200`: `{ "user": {...} }` + cookie ใหม่
ผิดรหัส/ไม่มี user → `401 UNAUTHORIZED` (ข้อความเดียวกันเสมอ)

### `POST /api/auth/logout` — auth

ลบ session ใน D1 + clear cookie → `{ "ok": true }`

### `GET /api/auth/me` — auth

```json
{ "user": { "id": "uuid", "email": "...", "role": "user" } }
```

## 4. Models

### `GET /api/models` — auth

```json
{
  "providers": [
    {
      "id": "mock",
      "label": "Mock (Demo)",
      "available": true,
      "models": [{ "id": "mock-echo", "label": "Mock Echo — ทดสอบ UI ไม่เรียก AI จริง" }]
    },
    {
      "id": "openai",
      "label": "OpenAI",
      "available": false,
      "models": [
        { "id": "gpt-4.1-mini", "label": "GPT-4.1 mini" },
        { "id": "gpt-4.1", "label": "GPT-4.1" },
        { "id": "gpt-4o-mini", "label": "GPT-4o mini" }
      ]
    }
  ],
  "default": { "provider": "mock", "model": "mock-echo" }
}
```

- `available` ขึ้นกับการมี API key (mock = true เสมอ)
- โมเดลที่ไม่อยู่ใน catalog/allowlist จะถูกปฏิเสธที่ `/api/chat`

## 5. Conversations

### `GET /api/conversations` — auth

```json
{
  "conversations": [
    {
      "id": "uuid",
      "title": "ทดสอบระบบ",
      "provider": "mock",
      "model": "mock-echo",
      "createdAt": 1792484564536,
      "updatedAt": 1792484564536
    }
  ]
}
```

สูงสุด 200 รายการ เรียง `updatedAt` ใหม่สุดก่อน

### `POST /api/conversations` — auth

ไม่บังคับสำหรับ flow ปกติ (สร้างอัตโนมัติเมื่อแชท) แต่มีไว้สำหรับสร้างเปล่า:

```json
{ "title": "บทสนทนาใหม่", "provider": "mock", "model": "mock-echo" }
```

Response `201`: `{ "conversation": {...} }`

### `GET /api/conversations/:id` — auth

```json
{
  "conversation": { "id": "uuid", "title": "...", "provider": "...", "model": "...", "createdAt": 0, "updatedAt": 0 },
  "messages": [
    { "id": "uuid", "role": "user", "content": "...", "provider": null, "model": null, "status": "complete", "createdAt": 0 },
    { "id": "uuid", "role": "assistant", "content": "...", "provider": "mock", "model": "mock-echo", "status": "complete", "createdAt": 0 }
  ]
}
```

- ถ้าไม่ใช่เจ้าของ → `404` (ไม่เปิดเผยการมีอยู่)
- messages สูงสุด 500 เรียงตาม `seq`

### `PATCH /api/conversations/:id` — auth

```json
{ "title": "ชื่อใหม่" }
```

→ `{ "ok": true, "title": "ชื่อใหม่" }` (1–80 ตัวอักษร)

### `DELETE /api/conversations/:id` — auth

→ `{ "ok": true }` (ลบ messages ตาม FK cascade)

## 6. Chat (Streaming)

### `POST /api/chat` — auth

Request:

```json
{
  "conversationId": null,
  "content": "สวัสดี",
  "provider": "mock",
  "model": "mock-echo"
}
```

| ฟิลด์ | กฎ |
|---|---|
| `conversationId` | UUID หรือ `null`/ไม่ส่ง = สร้างใหม่ |
| `content` | 1–8,000 ตัวอักษร (trim ก่อน) |
| `provider` | ต้องตรงกับ catalog |
| `model` | ต้องอยู่ใน provider นั้นและ provider พร้อมใช้งาน |

Response `200` headers:

```
content-type: text/event-stream; charset=utf-8
cache-control: no-cache, no-transform
x-accel-buffering: no
```

#### SSE Events

```
event: meta
data: {"conversationId":"uuid","userMessageId":"uuid","assistantMessageId":"uuid","provider":"mock","model":"mock-echo","title":"สวัสดี"}

event: delta
data: {"text":"**Mock"}

event: delta
data: {"text":" Provider**"}

event: done
data: {"assistantMessageId":"uuid","conversationId":"uuid","characters":490}
```

กรณี error **หลังเริ่ม stream** (HTTP status ยังเป็น `200`):

```
event: error
data: {"code":"PROVIDER_RATE_LIMITED","message":"ผู้ให้บริการจำกัดการใช้งานชั่วคราว กรุณาลองใหม่ภายหลัง"}
```

error code ที่เกี่ยวกับ guardrails:

| code | เมื่อเกิด | สิ่งที่บันทึก |
|---|---|---|
| `PROVIDER_TIMEOUT` | ใช้เวลาเกิน `AI_TIMEOUT_SECONDS` (default 90s) | assistant partial ที่มีอยู่ + `status=error` |
| `RESPONSE_LIMIT_REACHED` | คำตอบถึง `AI_MAX_OUTPUT_CHARS` (default 32,000) | assistant ที่ถูกตัดให้พอดีเพดาน + `status=error` |

กรณี error **ก่อนเริ่ม stream** (validation/auth/rate limit) → JSON error ตามปกติ (400/401/404/429)

#### พฤติกรรม

- `meta` ส่งก่อนเสมอ
- `delta` อาจมี 0..N ครั้ง; เมื่อถึงเพดาน delta สุดท้ายถูกตัดให้พอดี (ไม่เกินเพดาน)
- `done` ส่งเมื่อสำเร็จ; ถ้า error/timeout/cap จะไม่มี `done`
- หยุดกลางทาง: client abort → Worker พยายามบันทึก partial ด้วย status `aborted`
- Provider error/timeout/cap → assistant message (ถ้ามี content) status `error`
- ไม่มี retry อัตโนมัติ

#### Generation limits (ฝั่ง server)

| env | default | ช่วง | ผลเมื่อเกิน |
|---|---|---|---|
| `AI_TIMEOUT_SECONDS` | 90 | 1–300 | abort upstream + SSE `PROVIDER_TIMEOUT` |
| `AI_MAX_OUTPUT_CHARS` | 32,000 | 500–200,000 | หยุด stream + SSE `RESPONSE_LIMIT_REACHED` |

- Client ไม่สามารถส่งค่า limit มาเองได้; อ่านจาก env ฝั่ง Worker เท่านั้น
- ค่า `characters` ใน `done` คือจำนวนตัวอักษรจริงที่ส่งให้ client (ไม่เกินเพดาน)

#### ตัวอย่าง curl

```bash
curl -N -X POST http://127.0.0.1:8787/api/chat \
  -H 'content-type: application/json' \
  -b cookies.txt \
  -d '{"conversationId":null,"content":"สวัสดี","provider":"mock","model":"mock-echo"}'
```

## 7. Rate Limits (ฝั่งแอป)

| Endpoint | Key | ค่าเริ่มต้น |
|---|---|---|
| `POST /api/chat` | `chat:<userId>` | 20 ครั้ง / 5 นาที |
| `POST /api/auth/login` | `login:<ip>:<email>` | 10 ครั้ง / 15 นาที |
| `POST /api/auth/register` | `register:<ip>` | 10 ครั้ง / 15 นาที |

- Fixed window เก็บใน D1
- ตอบ `429` พร้อมข้อความ (ไม่ได้ส่ง `Retry-After` header ใน MVP)
- ไม่แทน billing limit ของ provider

## 8. CSRF / Origin

คำขอที่ไม่ใช่ GET/HEAD/OPTIONS:

- ถ้า `Sec-Fetch-Site: cross-site` → 403
- ถ้ามี `Origin` ต้องมี host ตรงกับ `Host` ของ request → ไม่งั้น 403
- curl ที่ไม่ส่ง Origin ทำงานได้ (ใช้สำหรับ automation/test)

## 9. การเพิ่ม Provider ใหม่

1. **สร้าง adapter** `worker/providers/foo.ts`
   - implements `AIProvider` (`id`, `isAvailable`, `streamChat`)
   - แปลง request เป็นรูปแบบ vendor และ yield เฉพาะ text delta
   - map error เป็น `ProviderError` (ห้ามส่ง body ดิบถึง client)
2. **ลงทะเบียน** ใน `worker/providers/registry.ts`
3. **เพิ่ม catalog** ใน `worker/providers/catalog.ts` (label, models, `configured`, extra models)
4. **เพิ่ม env** ใน `worker/types.ts` + `10-ENVIRONMENT.md` (secret key, base URL ถ้าจำเป็น)
5. **เพิ่ม unit test** ด้วย mocked fetch (stream ปกติ, error, ไม่มี key)
6. **อัปเดตเอกสาร**: API นี้, `03-TECH-STACK.md`, `15-CHANGELOG.md`
7. ไม่ต้องแก้ frontend — UI อ่านจาก `/api/models` อัตโนมัติ

ข้อกำหนด:
- ห้ามรับ URL ปลายทางจาก client
- ต้องมี allowlist ของ model
- ต้องรองรับ AbortSignal
- ต้องไม่ log/ส่งต่อ API key
