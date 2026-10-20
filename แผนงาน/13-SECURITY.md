# 13 — SECURITY

> อัปเดต: 2026-10-20 · หลักการ: Secure by Default
> เอกสารนี้ระบุสิ่งที่ทำแล้วและข้อจำกัดที่ยังเหลือ — ห้ามตีความว่า system นี้ผ่าน security audit

## 1. Threat Model

### Assets
- API keys ของ OpenAI/Gemini (ต้นทุนเงิน + สิทธิ์ใช้งาน)
- เนื้อหาบทสนทนาและอีเมลผู้ใช้
- session tokens
- `SIGNUP_CODE`
- ฐานข้อมูล D1

### Actors
- ผู้ไม่รู้จัก (anonymous internet)
- ผู้ใช้ที่ login แล้ว
- ผู้ดูแลระบบ/เจ้าของ (operator)
- ผู้ให้บริการ AI ภายนอก
- ผู้โจมตี supply chain (npm)

### Threats และ Controls

| Threat | ตัวอย่าง | Control ที่มี |
|---|---|---|
| Brute force login | เดารหัสผ่านซ้ำ ๆ | PBKDF2, rate limit ต่อ IP+email, ข้อความ error เหมือนกัน |
| Invite code guessing | เดารหัสเชิญ | รหัสสุ่ม 8 ตัวอักษร (~40-bit hex), rate limit register 10 ครั้ง/15 นาที, เปลี่ยน secret ได้ |
| Session theft | XSS/อุปกรณ์ถูกขโมย | HttpOnly, SameSite=Lax, Secure (non-dev), อายุ 7 วัน, logout revoke |
| CSRF | ฟอร์มจากเว็บอื่นส่ง POST | SameSite=Lax + Origin/Host check + `Sec-Fetch-Site` |
| IDOR | เปลี่ยน conversation id | ownership check ทุก query, คืน 404 |
| XSS ผ่าน Markdown | `<img onerror>` / `javascript:` | ไม่ render HTML ดิบ, react-markdown URL sanitization, CSP |
| SQL injection | `' OR 1=1` | prepared statements + bound params ทั้งหมด |
| API abuse / cost | ยิง `/api/chat` รัว | auth + rate limit + allowlist + output/timeout cap + provider budget (ต้องตั้งเอง) |
| Long-running / hanging generation | provider ค้างหรือตอบยาวมาก | `AI_TIMEOUT_SECONDS` (90s) + `AI_MAX_OUTPUT_CHARS` (32k) + abort upstream |
| Secret leakage | key ไปอยู่ใน bundle/log | secrets ฝั่ง Worker, ไม่ส่ง client, ไม่ log env |
| SSRF | client ส่ง URL ปลายทาง | ไม่รับ URL จาก client; base URL จาก env + บังคับ HTTPS |
| Provider error leakage | ส่ง body ดิบของ vendor | map เป็นข้อความปลอดภัย, ไม่ส่ง response body |
| Oversized request | ส่ง body หลาย MB | `bodyLimit` 256 KB + zod max |
| Enumeration | เดา email/มีบัญชีหรือไม่ | login ตอบ 401 เหมือนกัน; register บอกอีเมลซ้ำ (ยอมรับได้เพื่อ UX) |

## 2. Secrets

- เก็บใน Worker Secrets: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `SIGNUP_CODE`
- `.dev.vars` / `.env` ถูก `.gitignore`; repo มีเฉพาะ `.env.example` placeholder
- ไม่มี secret ใน frontend bundle (ตรวจ `dist/client` ด้วย grep แล้ว)
- `wrangler.jsonc` ไม่มี secret
- Log ไม่มี `c.env`, token, cookie, เนื้อหาแชท
- `openai`/`gemini` base URL มาจาก env ไม่ใช่ client

**ข้อจำกัด:** ไม่มี secret rotation อัตโนมัติ; เจ้าของต้องหมุนเอง

## 3. Authentication

- อีเมล + รหัสผ่าน + รหัสเชิญ
- PBKDF2-SHA256 100,000 รอบ + salt 16 bytes (Web Crypto)
- เก็บเฉพาะ hash ของ session token (SHA-256) ใน D1
- Session cookie: `ai_session`, `HttpOnly`, `SameSite=Lax`, `Secure` เมื่อ `APP_ENV !== development`, `Max-Age` 7 วัน
- Session หมดอายุตรวจทุก request (`expires_at > now`)
- Login ผิดตอบ `401` ข้อความเดียวกัน และยังคำนวณ PBKDF2 กับ dummy hash เพื่อลด timing difference

**ข้อจำกัด:**
- ไม่มี MFA, ไม่มี email verification, ไม่มี password reset
- ไม่มี session list/revoke-all
- PBKDF2 100k ต่ำกว่าคำแนะนำ OWASP และอาจติด CPU limit (RISK-01)

## 4. Authorization

- ทุก endpoint ที่มีข้อมูลผู้ใช้ใช้ `requireAuth`
- `conversations` ทุก query มี `user_id` ในเงื่อนไข
- `messages` เข้าถึงผ่าน conversation ที่ตรวจ ownership แล้วเท่านั้น
- Client ส่ง user id ไม่ได้ — server ใช้ session
- Role `admin` มีใน schema แต่ **ยังไม่มี endpoint ที่ให้สิทธิ์พิเศษ** (ลด attack surface)
- IDOR คืน 404 ไม่ใช่ 403

ทดสอบแล้ว: อ่าน/เปลี่ยนชื่อ/ลบ/ส่งแชทเข้า conversation ของคนอื่น → 404 ทั้งหมด

## 5. Rate Limiting

- Chat: 20/5 นาที/ผู้ใช้
- Login: 10/15 นาที/IP+email
- Register: 10/15 นาที/IP
- เก็บใน D1 (`rate_limits`) แบบ fixed window

**ข้อจำกัด:**
- D1 counter ไม่ atomic ระดับ distributed สูงสุด; อาจ overshoot เล็กน้อย
- ผู้ใช้หลายบัญชี (มี invite) ใช้ quota แยกกัน
- ไม่มี WAF/Cloudflare Rate Limiting
- ไม่แทน billing limit ของ provider — **ต้องตั้ง budget ที่ OpenAI/Google เอง**

## 6. Input Validation

- zod ฝั่ง server ทุก endpoint ที่รับ JSON
- อีเมล ≤ 254, password 10–200, ข้อความ ≤ 8,000, title 1–80, invite ≤ 200
- `conversationId` ต้องเป็น UUID
- ตรวจ provider/model กับ allowlist ก่อนแตะ D1/provider
- Body limit 256 KB
- Rate limit key ใช้ค่าที่ normalize แล้ว (email lowercase)

## 7. XSS / Injection

- Markdown render ด้วย `react-markdown` โดยไม่มี `rehype-raw` → HTML ดิบถูก escape
- Link ถูกเปิด `target=_blank rel="noopener noreferrer nofollow"`
- CSP ใน `public/_headers`:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`
- SQL ใช้ parameterized queries ทั้งหมด
- ไม่มี `dangerouslySetInnerHTML` ใน frontend

**ข้อจำกัด:** `style-src 'unsafe-inline'` จำเป็นเพราะ React inline styles; ยังไม่ได้ทดสอบ CSP ในเบราว์เซอร์จริง

## 8. CORS และ CSRF

- Frontend/API same origin → ไม่เปิด CORS
- ไม่มี `Access-Control-Allow-Origin: *`
- CSRF: cookie SameSite=Lax + ตรวจ Origin/Host + block `Sec-Fetch-Site: cross-site`
- Logout เป็น POST

**ข้อจำกัด:** ไม่ได้ใช้ double-submit CSRF token; ถ้าอนาคตมี frontend คนละ origin ต้องออกแบบใหม่

## 9. การป้องกันค่าใช้จ่ายจากการใช้ API

ทำแล้ว:
- ต้อง login + invite
- allowlist model
- rate limit chat
- จำกัดขนาดข้อความ/context
- จำกัดเวลาคำตอบด้วย `AI_TIMEOUT_SECONDS` และ abort upstream
- จำกัดความยาวคำตอบด้วย `AI_MAX_OUTPUT_CHARS` และตัด delta ให้พอดี
- ไม่มี retry อัตโนมัติ
- Mock provider สำหรับ demo

ยังต้องทำ (เจ้าของ):
- ตั้ง usage/billing limit ที่ OpenAI และ Google
- ติดตาม dashboard/alert
- พิจารณา quota ต่อผู้ใช้/วัน
- ทดสอบ timeout/cap ซ้ำบน staging กับ provider จริง (`QA-03`)
- ปิดรับสมัครเมื่อครบผู้ใช้ (`SIGNUP_CODE` ว่าง = ปิด)

## 10. Privacy และ Data Retention

- เก็บอีเมล, hash รหัสผ่าน, บทสนทนา, ข้อความ, เวลา, provider/model
- เนื้อหาแชทถูกส่งไปยัง provider ที่ผู้ใช้เลือก (OpenAI/Google) — ต้องแจ้งผู้ใช้และตรวจนโยบาย provider
- ไม่มี analytics/tracking/third-party script
- ไม่มี retention อัตโนมัติ; ผู้ใช้ลบ conversation เองได้ (cascade)
- Backup/export ต้องเก็บอย่างปลอดภัย (มีข้อมูลส่วนบุคคล)
- Cookie ใช้เพื่อ session เท่านั้น

## 11. ข้อจำกัดที่ยังแก้ไม่ได้ / ยังไม่ทำ

1. ไม่มี MFA และ email verification
2. ไม่มี password reset (ต้องให้ admin ลบ/สร้างบัญชี)
3. ไม่มี audit log ว่าใครใช้ invite code
4. ไม่มี session management UI/revoke-all
5. PBKDF2 ต่ำกว่า OWASP recommendation และยังไม่วัด CPU จริง
6. Rate limit เป็น D1 fixed window ไม่ distributed แบบแข็งแรง
7. ไม่มี WAF/Cloudflare Access
8. CSP ยังไม่ผ่าน browser test
9. ไม่มี automated dependency scanning (npm audit / Dependabot)
10. ไม่มี security headers test (เช่น observatory)
11. ไม่มี encryption at application layer — พึ่ง Cloudflare/D1
12. Prompt injection: ผู้ใช้อาจสั่งโมเดลให้ทำสิ่งที่ไม่พึงประสงค์; ปัจจุบันไม่มี tool/function calling จึงยังไม่มีความเสี่ยงระดับ tool execution แต่เนื้อหาที่โมเดลตอบอาจไม่ถูกต้อง
13. ไม่มี data residency/region control
14. Timeout/cap ถูกทดสอบบน staging ด้วย Mock แล้ว แต่ยังไม่ได้ยืนยันกับ provider จริง
15. รหัสผ่านขั้นต่ำ 8 ตัวอักษรตาม requirement; ถือว่าอ่อนกว่าค่าแนะนำทั่วไป ควรใช้ 12+ เมื่อเปิดผู้ใช้จริงหรือเพิ่ม passphrase policy

## 12. Checklist ก่อนเปิดให้ผู้ใช้จริง

- [ ] เปลี่ยน `SIGNUP_CODE` เป็นค่าสุ่มใหม่
- [ ] ตั้ง `APP_ENV=production`
- [ ] ตรวจว่า cookie มี `Secure` บน HTTPS
- [ ] ตั้ง billing limit ที่ provider
- [ ] ทดสอบ `PROVIDER_TIMEOUT` / `RESPONSE_LIMIT_REACHED` บน staging กับ provider จริง
- [ ] ตรวจ CSP ใน browser console
- [ ] วัด CPU ของ login บน Free plan
- [ ] จำกัดจำนวนผู้ใช้/ปิดรับสมัครเมื่อเหมาะสม
- [ ] ตรวจ logs ว่าไม่มี secret/เนื้อหาแชท
- [ ] วางนโยบายความเป็นส่วนตัวและระยะเก็บข้อมูล
- [ ] หมุน API key ก่อน production
