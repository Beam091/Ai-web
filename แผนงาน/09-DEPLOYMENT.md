# 09 — DEPLOYMENT

> อัปเดต: 2026-10-20
> **สถานะ: deploy จริงแล้วทั้ง staging และ production (Mock provider เท่านั้น)**
> - Staging: https://ai-web-staging.peerapatmatprasong.workers.dev
> - Production: https://ai-web.peerapatmatprasong.workers.dev
> - ยังไม่มี live provider test (ไม่มี OpenAI/Gemini keys) และยังไม่มี custom domain

## 1. สิ่งที่ต้องมีก่อนเริ่ม

- Cloudflare account (Free หรือ Paid)
- Node.js ≥ 22 และ `npm ci` สำเร็จ
- สิทธิ์สร้าง Workers + D1 ใน account
- API keys (ถ้าจะใช้ provider จริง)
- ตัดสินใจชื่อ Worker/โดเมน

## 2. Environment ที่มีใน config

`wrangler.jsonc` มี 3 ชุด:

| Environment | Worker name | D1 database | database_id | ใช้เมื่อ |
|---|---|---|---|---|
| default (top-level) | `ai-web` | `ai-web-db-staging` | `3c73db62-b00f-4b52-8b5f-774ff53dec3a` | local dev / ค่าเริ่มต้น |
| `staging` | `ai-web-staging` | `ai-web-db-staging` | `3c73db62-b00f-4b52-8b5f-774ff53dec3a` | ก่อน production |
| `production` | `ai-web` | `ai-web-db-prod` | `4f59bd66-bbf1-4072-8aa4-3ca502514f6d` | ผู้ใช้จริง |

> D1 ทั้งสองถูกสร้างที่ region APAC และ apply migration `0001_init.sql` แล้ว (11 statements)
> top-level ชี้ staging เพื่อให้คำสั่ง local/default ปลอดภัย ส่วน deploy production ใช้ `--env production`

## 3. ขั้นตอน Deploy (Staging ก่อน)

### 3.1 Login

ดำเนินการแล้วด้วย API token (ไม่บันทึก token ใน repo) ตรวจสิทธิ์ผ่าน Cloudflare API และ `wrangler d1 create` สำเร็จ

```bash
npx wrangler login
npx wrangler whoami
```

### 3.2 สร้าง D1

ดำเนินการแล้ว:

```bash
npx wrangler d1 create ai-web-db-staging --location apac
npx wrangler d1 create ai-web-db-prod --location apac
```

`database_id` ถูกใส่ใน `wrangler.jsonc` ครบทั้ง top-level, staging และ production แล้ว

### 3.3 รัน Migrations (ก่อน deploy)

```bash
npx wrangler d1 migrations apply DB --remote --env staging
```

ตรวจว่ามีตารางครบ:

```bash
npx wrangler d1 execute DB --remote --env staging --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

### 3.4 ตั้ง Secrets

ต้องตั้ง **แยกทุก environment**:

```bash
npx wrangler secret put SIGNUP_CODE --env staging
npx wrangler secret put OPENAI_API_KEY --env staging     # ถ้าใช้
npx wrangler secret put GEMINI_API_KEY --env staging     # ถ้าใช้

npx wrangler secret put SIGNUP_CODE --env production
npx wrangler secret put OPENAI_API_KEY --env production
npx wrangler secret put GEMINI_API_KEY --env production
```

- `SIGNUP_CODE` ต้องเป็น **8 ตัวอักษร** (ระบบ normalize เป็นตัวพิมพ์ใหญ่) เช่น `openssl rand -hex 4 | tr 'a-f' 'A-F'`
- ห้ามใส่ secret ใน `wrangler.jsonc` หรือ commit
- ตัวแปรที่ไม่ลับ (rate limit, `DEFAULT_PROVIDER`, `AI_TIMEOUT_SECONDS`, `AI_MAX_OUTPUT_CHARS`) ใส่ใน `vars` ของ config ได้

### 3.5 Build + Deploy

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npx wrangler deploy --env staging
```

หรือใช้ script:

```bash
npm run deploy:staging
npm run deploy:production
```

> `npm run deploy` ชี้ไป production โดยตั้งใจ — อย่าใช้ถ้ายังไม่ได้ตั้งค่า D1/secrets

### 3.6 Preview version (ไม่รับ traffic)

```bash
npx wrangler versions upload --env staging
```

ใช้ตรวจก่อน promote เป็น deployment จริงตาม workflow ของ Cloudflare

## 4. ตรวจสอบหลัง Deploy

ผลจริงรอบล่าสุด:

| การตรวจ | Staging | Production |
|---|---|---|
| `/api/health` | 200 `status=ok, database=ok, environment=staging` | 200 `status=ok, database=ok, environment=production` |
| `/` | 200 `text/html` | 200 `text/html` |
| SPA fallback | 200 | 200 |
| lazy Markdown asset | 200 (339,147 bytes) | 200 (339,147 bytes) |
| unauthenticated `/api/models` | 401 | 401 |
| CSRF cross-site | 403 | 403 |
| Security headers | CSP / permissions / referrer / nosniff / frame deny | เหมือน staging |
| Register + chat + persist | ผ่าน (ลบ test user หลังทดสอบแล้ว) | ยังไม่สร้างผู้ใช้จริง |

```bash
curl -sS https://ai-web-staging.peerapatmatprasong.workers.dev/api/health
curl -sS https://ai-web.peerapatmatprasong.workers.dev/api/health
curl -sS -o /dev/null -w "%{http_code}\n" https://ai-web.peerapatmatprasong.workers.dev/
```

คาดหวัง:

- `/api/health` → `{"status":"ok","database":"ok","environment":"..."}` (ห้ามมี secret ใน response)
- `/` → 200 และเป็น HTML ของแอป
- `/any/spa/path` → 200 (SPA fallback)

ตรวจ flow จริง (ครั้งแรกจะได้ admin):

```bash
curl -i -X POST https://<worker-url>/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"owner@example.com","password":"<strong-password>","inviteCode":"<SIGNUP_CODE>"}'
```

จากนั้นเปิดเบราว์เซอร์ ทดสอบ:

1. login
2. เลือก Mock → ส่งข้อความ → เห็น streaming
3. refresh → ประวัติยังอยู่
4. เปลี่ยนชื่อ/ลบ
5. ถ้ามี key จริง → เลือก OpenAI/Gemini → ส่งข้อความสั้น → ตรวจว่าได้คำตอบจริง
6. ตรวจ DevTools ว่าไม่มี API key/secret ใน network response

ตรวจ logs:

```bash
npx wrangler tail --env production
```

ตรวจ CPU time ของ request login (สำคัญกับ RISK-01) ใน dashboard/metrics

## 5. Custom Domain

1. Cloudflare Dashboard → Workers & Pages → Worker → Settings → Domains & Routes
2. Add Custom Domain เช่น `chat.example.com`
3. ตั้ง DNS ตามที่ dashboard แนะนำ
4. ตรวจ `APP_ENV=production` เพื่อให้ cookie มี `Secure`
5. ทดสอบ login ใหม่หลังเปลี่ยนโดเมน (cookie ผูก host)

## 6. Rollback

### Worker code

```bash
npx wrangler versions list --env production
npx wrangler rollback <version-id> --env production
```

หรือ Dashboard → Deployments → เลือก version ก่อนหน้า → Rollback

### Database

D1 มี Time Travel (Free 7 วัน / Paid 30 วัน):

```bash
npx wrangler d1 time-travel info DB --env production
npx wrangler d1 time-travel restore DB --timestamp <ISO-8601> --env production
```

> ก่อน restore ต้องแน่ใจว่าไม่ทำให้ข้อมูลใหม่หาย — ควร backup/export ก่อนเสมอ
> ตรวจ syntax ล่าสุดที่ https://developers.cloudflare.com/d1/reference/time-travel/

### Secrets

- หมุน key ที่ provider แล้ว `wrangler secret put ...` ใหม่
- การ rollback code ไม่ย้อน secret โดยอัตโนมัติ

## 6.5 Auto deploy จาก GitHub (ตั้งค่าแล้ว)

Workflow `.github/workflows/deploy.yml` ทำงานเมื่อ push เข้า `main` หรือกด `workflow_dispatch`:

1. `npm ci`
2. typecheck / lint / unit + integration tests / build
3. `npx wrangler d1 migrations apply DB --remote --env production`
4. `npx wrangler deploy --env production`

GitHub repository secrets ที่ตั้งไว้:

- `CLOUDFLARE_API_TOKEN` — token ที่ใช้ deploy (ไม่ปรากฏใน repo)
- `CLOUDFLARE_ACCOUNT_ID`

ข้อจำกัด: **Cloudflare Workers Builds Git integration** (หน้า Settings > Builds) ต้องติดตั้ง Cloudflare GitHub App ผ่าน dashboard และใช้ user-scoped token สำหรับ Builds API; token แบบ account-owned ที่ใช้อยู่นี้เรียก Builds API ไม่ได้ (`Invalid token`) จึงใช้ GitHub Actions เป็นตัว deploy อัตโนมัติแทน และยังสามารถเชื่อม Workers Builds ภายหลังได้โดยไม่กระทบ workflow นี้

## 7. Troubleshooting

| อาการ | สาเหตุที่เป็นไปได้ | วิธีแก้ |
|---|---|---|
| `Authentication error` ตอน deploy | ยังไม่ login/หมดสิทธิ์ | `wrangler login`, ตรวจ account |
| `Couldn't find a D1 DB with binding DB` | database_id ผิดหรือชี้คนละ account | ตรวจ `wrangler d1 list` แล้วใส่ ID ให้ env ที่ deploy |
| `/api/*` ตอบ 404 HTML | `run_worker_first` ไม่ครบ/asset config ผิด | ตรวจ `assets.run_worker_first` |
| หน้าเว็บโหลดแต่ API 404 | build ไม่มี `dist/client` หรือ deploy ผิด env | `npm run build` แล้ว deploy ใหม่ |
| Login ค้าง/1102 | CPU เกิน Free 10 ms (PBKDF2) | วัด CPU; ลด iterations หรือใช้ Paid |
| `no such table` | ยังไม่รัน migration กับ env นั้น | `d1 migrations apply ... --env ...` |
| 401 ทุกครั้งหลัง deploy | cookie `Secure` + เข้า http / คนละโดเมน | ใช้ https และโดเมนเดียวกัน |
| CORS error | ปกติไม่ควรเกิด (same origin) | ตรวจว่า frontend เรียก path `/api` เดียวกัน |
| `Too many requests` | rate limit | รอตาม window หรือปรับ env (ระวังค่าใช้จ่าย) |

## 8. สิ่งที่เจ้าของโปรเจกต์ต้องดำเนินการเอง

- [x] สร้าง/ยืนยัน Cloudflare account และสิทธิ์ Workers + D1
- [x] ใช้ API token สำหรับ deploy (ไม่เก็บ token ใน repo)
- [x] สร้าง D1 staging + production และใส่ `database_id`
- [x] ตั้ง `SIGNUP_CODE` ทั้ง staging และ production
- [x] รัน migrations + deploy staging
- [x] deploy production
- [x] ทดสอบ health/SPA/asset/auth guard/CSRF/security headers/chat บน staging
- [x] ตั้ง GitHub Actions auto deploy ไป production เมื่อ push `main`
- [ ] ตัดสินใจ custom domain
- [ ] ตั้ง `OPENAI_API_KEY` / `GEMINI_API_KEY` แล้วเปลี่ยน `DEFAULT_PROVIDER`
- [ ] อนุมัติค่าใช้จ่าย/เพดาน provider และตั้ง billing limit/alert
- [ ] วัด CPU ของ PBKDF2 บน Free plan
- [ ] ทดสอบ UI ในเบราว์เซอร์จริง (QA-01)

## 9. สิ่งที่ยังไม่ได้ทำในเอกสารนี้

- ยังไม่มี live provider test (OpenAI/Gemini)
- ใช้ GitHub Actions เป็น CD; ยังไม่ได้เชื่อม Cloudflare Workers Builds ผ่าน GitHub App
- ยังไม่มี custom domain/access policy
- Production ยังไม่มีผู้ใช้ — ผู้สมัครคนแรกจะได้ role `admin`
