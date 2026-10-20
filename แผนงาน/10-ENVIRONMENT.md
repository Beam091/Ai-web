# 10 — ENVIRONMENT

> อัปเดต: 2026-10-20
> **ห้ามบันทึก secret จริงในไฟล์นี้หรือ commit** — ตัวอย่างทั้งหมดเป็น placeholder

## 1. ภาพรวม

- Local dev: อ่านจาก `.dev.vars` (gitignored)
- Cloudflare: `vars` (ไม่ลับ) ใน `wrangler.jsonc` + Secrets (`wrangler secret put`)
- Integration tests: ใช้ `wrangler.test.jsonc` + miniflare bindings
- Worker เข้าถึงผ่าน `c.env` (ชนิดข้อมูลใน `worker/types.ts`)

## 2. ตัวแปรทั้งหมด

| ชื่อ | จำเป็น | Secret | ค่าเริ่มต้น / ตัวอย่าง | ใช้ทำอะไร |
|---|---|---|---|---|
| `SIGNUP_CODE` | **ใช่** (ถ้าจะสมัครสมาชิก) | ✅ ใช่ | `REPLACE8` (8 ตัวอักษร) | รหัสเชิญสำหรับ `POST /api/auth/register`; ต้องยาว 8 ตัวและ normalize เป็นตัวพิมพ์ใหญ่; ถ้าไม่ตั้งจะปิดรับสมัคร (403) |
| `OPENAI_API_KEY` | ไม่ (ถ้าใช้ OpenAI) | ✅ ใช่ | `sk-replace-me` | เรียก OpenAI; ถ้าไม่ตั้ง provider จะแสดง unavailable |
| `GEMINI_API_KEY` | ไม่ (ถ้าใช้ Gemini) | ✅ ใช่ | `replace-me` | เรียก Gemini; ถ้าไม่ตั้ง provider จะ unavailable |
| `APP_ENV` | ควรตั้ง | ❌ ไม่ | `development` / `staging` / `production` | ใช้ตัดสิน cookie `Secure` (production/staging = true) และแสดงใน health |
| `DEFAULT_PROVIDER` | ไม่ | ❌ ไม่ | `mock` | provider เริ่มต้นใน model selector (ถ้าไม่พร้อมจะ fallback) |
| `OPENAI_BASE_URL` | ไม่ | ❌ ไม่ | `https://api.openai.com/v1` | เปลี่ยน endpoint (ต้อง HTTPS) — ใช้กับ proxy/compatible API ที่ตั้งใจ |
| `GEMINI_BASE_URL` | ไม่ | ❌ ไม่ | `https://generativelanguage.googleapis.com/v1beta` | เปลี่ยน endpoint (ต้อง HTTPS) |
| `EXTRA_OPENAI_MODELS` | ไม่ | ❌ ไม่ | `gpt-4.1-nano,gpt-4.1-mini` | เพิ่ม model id เข้า allowlist (คั่นด้วย comma) |
| `EXTRA_GEMINI_MODELS` | ไม่ | ❌ ไม่ | `gemini-2.0-flash` | เพิ่ม model id เข้า allowlist |
| `CHAT_RATE_LIMIT` | ไม่ | ❌ ไม่ | `20` | จำนวนคำขอแชทต่อ window ต่อผู้ใช้ |
| `CHAT_RATE_WINDOW_MINUTES` | ไม่ | ❌ ไม่ | `5` | ความยาว window ของแชท (นาที) |
| `LOGIN_RATE_LIMIT` | ไม่ | ❌ ไม่ | `10` | จำนวน login/register ต่อ window ต่อ IP(+email) |
| `LOGIN_RATE_WINDOW_MINUTES` | ไม่ | ❌ ไม่ | `15` | ความยาว window ของ login (นาที) |
| `AI_TIMEOUT_SECONDS` | ไม่ | ❌ ไม่ | `90` (ช่วง 1–300) | ยกเลิก upstream เมื่อใช้เวลาเกิน และส่ง SSE `PROVIDER_TIMEOUT` |
| `AI_MAX_OUTPUT_CHARS` | ไม่ | ❌ ไม่ | `32000` (ช่วง 500–200,000) | เพดานตัวอักษรของคำตอบ; เกินแล้วหยุดและส่ง `RESPONSE_LIMIT_REACHED` |
| `MOCK_DELAY_MS` | ไม่ | ❌ ไม่ | `8` (ช่วง 0–500) | หน่วงระหว่าง token ของ Mock provider สำหรับ demo/ทดสอบ timeout |

### ค่าที่ hardcode ในโค้ด (ไม่ใช่ env)

| ค่า | ที่มา | หมายเหตุ |
|---|---|---|
| Session TTL 7 วัน | `worker/middleware/auth.ts` | เปลี่ยนได้ในโค้ด |
| PBKDF2 100,000 รอบ | `worker/lib/crypto.ts` | ดู RISK-01 |
| ข้อความสูงสุด 8,000 ตัวอักษร | `worker/lib/validation.ts` | ตรงกับ frontend |
| รหัสผ่าน 8–200 ตัวอักษร | `worker/lib/validation.ts` | ตาม requirement รอบนี้; 8 ตัวเป็นขั้นต่ำ |
| รหัสเชิญ 8 ตัวอักษร | `worker/lib/validation.ts` | normalize เป็นตัวพิมพ์ใหญ่ทั้ง client/server |
| Context 40 ข้อความ / 24,000 ตัวอักษร | `worker/routes/chat.ts` | คนละค่ากับเพดานคำตอบ |
| คำตอบสูงสุด 32,000 ตัวอักษร (default) | `worker/routes/chat.ts` + `AI_MAX_OUTPUT_CHARS` | ปรับผ่าน env ได้ |
| Timeout 90 วินาที (default) | `worker/routes/chat.ts` + `AI_TIMEOUT_SECONDS` | ปรับผ่าน env ได้ |
| Request body 256 KB | `worker/index.ts` | |
| ชื่อ cookie `ai_session` | `worker/middleware/auth.ts` | |

## 3. การตั้งค่า Local

1. คัดลอกตัวอย่าง:

```bash
cp .env.example .dev.vars
```

2. แก้ `.dev.vars` (ไฟล์นี้ถูก ignore):

```dotenv
APP_ENV=development
SIGNUP_CODE=DEV2026
DEFAULT_PROVIDER=mock
AI_TIMEOUT_SECONDS=90
AI_MAX_OUTPUT_CHARS=32000
# OPENAI_API_KEY=sk-...
# GEMINI_API_KEY=...
# MOCK_DELAY_MS=8
```

3. รัน migration local ครั้งแรก:

```bash
npm run db:migrate:local
```

4. รัน dev:

```bash
npm run dev
# Vite: http://localhost:5173
# Worker: http://127.0.0.1:8787
```

> `.env.example` มีเฉพาะ placeholder — ห้ามใส่ key จริง

## 4. การตั้งค่า Cloudflare

### vars (ไม่ลับ)

แก้ใน `wrangler.jsonc` ตาม environment:

```jsonc
"vars": {
  "APP_ENV": "production",
  "DEFAULT_PROVIDER": "mock",
  "CHAT_RATE_LIMIT": "20",
  "CHAT_RATE_WINDOW_MINUTES": "5",
  "AI_TIMEOUT_SECONDS": "90",
  "AI_MAX_OUTPUT_CHARS": "32000"
}
```

### secrets (ลับ)

```bash
npx wrangler secret put SIGNUP_CODE --env production
npx wrangler secret put OPENAI_API_KEY --env production
npx wrangler secret put GEMINI_API_KEY --env production
```

ตรวจรายการ (ไม่แสดงค่า):

```bash
npx wrangler secret list --env production
```

## 5. ตัวอย่างค่าแบบ Placeholder

```dotenv
APP_ENV=production
SIGNUP_CODE=<8-char-random-code>
OPENAI_API_KEY=sk-<your-key>
GEMINI_API_KEY=<your-key>
DEFAULT_PROVIDER=openai
CHAT_RATE_LIMIT=20
CHAT_RATE_WINDOW_MINUTES=5
LOGIN_RATE_LIMIT=10
LOGIN_RATE_WINDOW_MINUTES=15
AI_TIMEOUT_SECONDS=90
AI_MAX_OUTPUT_CHARS=32000
```

## 6. กฎความปลอดภัยของ Secrets

1. ห้าม commit `.env`, `.dev.vars`, key, token, password
2. ห้ามใส่ secret ใน `wrangler.jsonc` `vars` (vars ไม่ถูกเข้ารหัส/แสดงใน dashboard)
3. ห้าม log `c.env` ทั้งก้อน
4. หมุน key ทันทีถ้าสงสัยว่าหลุด
5. ใช้ secret แยกตาม environment (staging key ไม่ควรเหมือน production)
6. ตรวจ `git diff` ก่อน commit ทุกครั้ง

## 7. การตรวจสอบว่า env ถูกโหลด

- `GET /api/health` แสดง `environment` (ไม่แสดง secret)
- `GET /api/models` แสดง provider ที่ `available: true` ตาม key ที่มี
- ถ้า OpenAI/Gemini ขึ้น unavailable → key ยังไม่ถูกตั้ง/ชื่อผิด
- ถ้า `/api/auth/register` ตอบ 403 ว่าไม่ได้ตั้ง `SIGNUP_CODE` → ยังไม่ตั้ง secret

## 8. ข้อควรระวัง

- การเปลี่ยน `SIGNUP_CODE` ไม่ทำให้ผู้ใช้เดิมหลุด
- การลบ `OPENAI_API_KEY` แล้ว deploy ใหม่จะทำให้ provider นั้น unavailable ทันที
- `APP_ENV` ไม่ใช่ security boundary — เป็นเพียง flag สำหรับ cookie/health
- Rate limit values เป็น string; โค้ด parse เป็น integer และ clamp ช่วงปลอดภัย
- `AI_TIMEOUT_SECONDS` clamp 1–300 และ `AI_MAX_OUTPUT_CHARS` clamp 500–200,000; ค่าที่น้อย/มากเกินถูกปรับอัตโนมัติ
- `MOCK_DELAY_MS` มีผลเฉพาะ Mock provider (0–500 ms) และไม่กระทบ provider จริง
- ระหว่างทดสอบ local: `.dev.vars` มีสิทธิ์เหนือกว่า `vars` ใน `wrangler.jsonc` เมื่อชื่อซ้ำ — อย่าลืม restore ค่าก่อนวัดผล production-like
