# 06 — DECISIONS (ADR Log)

> ห้ามลบรายการเก่า — ถ้าตัดสินใจใหม่ให้เพิ่มรายการใหม่พร้อมวันที่และอ้างอิงของเดิม
> สถานะ "ทดสอบแล้ว" หมายถึงมีหลักฐานจาก test/คำสั่งจริงใน Repository นี้

---

## D-001 — เลือก Single Worker + Static Assets

**วันที่:** 2026-10-20
**สถานะ:** ใช้งานจริง
**บริบท:** ต้องมี frontend + API + D1 บน Cloudflare โดยดูแลง่าย

**ทางเลือก**
1. Cloudflare Pages + Functions แยกโปรเจกต์
2. Worker + Static Assets (เลือก)
3. Monorepo หลาย Worker

**เหตุผลที่เลือก:** deploy ชิ้นเดียว, asset binding ในตัว, SPA fallback ผ่าน `not_found_handling`, routing `/api/*` ด้วย `run_worker_first` ชัดเจน, ลด CORS/config ข้ามโดเมน

**ข้อดี:** พาธเดียว, secrets ชุดเดียว, local dev ง่าย
**ข้อเสีย:** Worker และ frontend ผูก deploy cycle เดียวกัน; asset files ต้อง build ก่อน deploy

**ทดสอบแล้ว:** ใช่ — `npm run build` + `wrangler dev` เสิร์ฟ `/` และ `/api/health` ได้ (curl 200)

---

## D-002 — ใช้ Hono เป็น API framework

**วันที่:** 2026-10-20
**สถานะ:** ใช้งานจริง
**บริบท:** ต้องการ router + middleware ที่เบาและรองรับ Web Standard

**ทางเลือก:** Hono, itty-router,  escribirเองด้วย `fetch`, Express (ไม่รองรับ Workers)

**เหตุผลที่เลือก:** middleware (`bodyLimit`, cookie helpers), TypeScript types ดี, ขนาดเล็ก, ไม่ผูก Node APIs

**ข้อเสีย:** dependency เพิ่มหนึ่งตัว; ต้องอ่าน docs เวลาอัปเกรด
**ทดสอบแล้ว:** ใช่ — typecheck/build/integration ผ่าน

---

## D-003 — ใช้ Cloudflare D1 ไม่ใช้ KV/DO/Postgres

**วันที่:** 2026-10-20
**สถานะ:** ใช้งานจริง
**บริบท:** ข้อมูลมีความสัมพันธ์ (user → conversation → message) และต้องการ query/filter/order

**ทางเลือก:** D1, KV, Durable Objects storage, Hyperdrive + Postgres, Supabase

**เหตุผลที่เลือก:** relational + SQL + migrations ผ่าน Wrangler + Free tier เพียงพอ MVP + latency ต่ำเมื่ออยู่กับ Worker

**ข้อเสีย:** DB เดียวประมวลผลทีละ query, Free 500 MB, ไม่เหมาะ scale สูงมาก
**ทดสอบแล้ว:** ใช่ — migration apply local + 16 integration tests

---

## D-004 — Authentication ด้วย session cookie ใน D1 (ไม่ใช้ JWT/OAuth)

**วันที่:** 2026-10-20
**สถานะ:** ใช้งานจริง
**บริบท:** ต้องมี auth จริงก่อนเปิด endpoint AI; ต้อง revoke ได้

**ทางเลือก:** JWT, cookie session + D1, Cloudflare Access, OAuth provider, Better Auth/Lucia

**เหตุผลที่เลือก:** opaque token + SHA-256 ใน DB ทำให้ logout/revoke ทันที, ไม่ต้องจัดการ signing secret/rotation, ใช้ Web Crypto เท่านั้น; SameSite=Lax + Origin check ลด CSRF

**ข้อเสีย:** ทุก request ที่ auth ต้อง query D1 (1 query), ไม่เหมาะ stateless scale สูง
**ทดสอบแล้ว:** ใช่ — login/logout/me + session invalidation test

---

## D-005 — Streaming ไป client ด้วย SSE ผ่าน POST

**วันที่:** 2026-10-20
**สถานะ:** ใช้งานจริง
**บริบท:** ต้องส่งคำตอบทีละส่วน และส่ง payload ขนาดใหญ่ (ข้อความ + conversationId)

**ทางเลือก:** `EventSource` (GET only), fetch + ReadableStream + SSE (เลือก), WebSocket, polling

**เหตุผลที่เลือก:** POST ได้, ใช้ HTTP ปกติ, parse ง่าย, ไม่ต้องมี connection state ฝั่ง server

**ข้อเสีย:** one-way; client ต้อง parse เอง; proxy บางตัวอาจ buffer (แก้ด้วย `x-accel-buffering: no`)
**ทดสอบแล้ว:** ใช่ — integration parse SSE + curl นับ 54 delta events (จำนวนอาจต่างตาม tokenizer)

---

## D-006 — Provider Adapter + Server-side Allowlist

**วันที่:** 2026-10-20
**สถานะ:** ใช้งานจริง
**บริบท:** ต้องรองรับหลาย provider โดยไม่ให้ business logic ผูก vendor และต้องกัน client ส่ง URL/model อะไรก็ได้

**ทางเลือก:** เรียก SDK ของแต่ละ vendor ตรง ๆ, ใช้ AI SDK กลาง, เขียน adapter เอง + allowlist (เลือก)

**เหตุผลที่เลือก:** ควบคุม request/error/stream format ได้, เพิ่ม provider ใหม่ได้โดยไม่แตะ route, allowlist ป้องกัน model ที่ไม่ได้รับอนุญาตและ URL ปลายทาง

**ข้อเสีย:** ต้องดูแล mapping เมื่อ API เปลี่ยน; ไม่ได้ใช้ฟีเจอร์ขั้นสูงของ vendor
**ทดสอบแล้ว:** ใช่ — unit tests ด้วย mocked fetch; **ยังไม่ทดสอบ API จริง**

---

## D-007 — Tailwind CSS 4 (CSS-first) ไม่ใช้ UI library

**วันที่:** 2026-10-20
**สถานะ:** ใช้งานจริง
**บริบท:** ต้องการ UI dark theme ที่ควบคุมได้และ bundle ไม่ใหญ่เกิน

**ทางเลือก:** Tailwind, CSS Modules, styled-components, shadcn/ui

**เหตุผลที่เลือก:** เขียน markup เร็ว, ไม่มี runtime CSS-in-JS, ปรับ theme ได้ใน `styles.css`
**ข้อเสีย:** class ยาวใน JSX; ต้องมี design token discipline
**ทดสอบแล้ว:** ใช่ — build ผ่าน, CSS 42.30 kB (gzip 8.34 kB)

---

## D-008 — แยก Vitest เป็น unit (Node) + integration (workerd)

**วันที่:** 2026-10-20
**สถานะ:** ใช้งานจริง
**บริบท:** integration ต้องใช้ D1 และ `SELF.fetch`; unit test ธรรมดาไม่ต้องใช้ workerd

**ทางเลือก:** ใช้ workerd ทั้งหมด, ใช้ Node ทั้งหมดพร้อม mock D1, แยกสอง config (เลือก)

**เหตุผลที่เลือก:** unit เร็วและ debug ง่าย; integration ใช้ D1 จริงและ middleware จริง; ลดเวลา test

**ข้อเสีย:** ต้องรันสองคำสั่ง (ถูกห่อใน `npm test` แล้ว)
**ทดสอบแล้ว:** ใช่ — 28 unit + 16 integration ผ่าน

---

## D-009 — Registration ด้วยรหัสเชิญ (invite code)

**วันที่:** 2026-10-20
**สถานะ:** ใช้งานจริง
**บริบท:** ยังไม่มีระบบอีเมล/องค์กร แต่ต้องคุมใครเข้าใช้ได้ (เพราะมีค่าใช้จ่าย AI)

**ทางเลือก:** เปิดสมัครอิสระ, invite code, ปิดสมัครถาวร, OAuth

**เหตุผลที่เลือก:** ปลอดภัยกว่าเปิดอิสระ, ไม่ต้องมี email service, เจ้าของแจกโค้ดได้เอง; ผู้ใช้คนแรกเป็น admin

**ข้อเสีย:** โค้ดเดียวใช้ร่วมกันทั้งหมด (เปลี่ยน/rotate ต้องแก้ secret); ไม่มี audit ว่าใครใช้โค้ด
**ทดสอบแล้ว:** ใช่ — register ถูก/ผิดรหัส + first-admin test

---

## D-010 — สร้างชื่อบทสนทนาจากข้อความแรก (ไม่เรียก AI)

**วันที่:** 2026-10-20
**สถานะ:** ใช้งานจริง
**บริบท:** ต้องมีชื่อใน sidebar โดยไม่เพิ่มค่าใช้จ่าย/latency

**ทางเลือก:** เรียก AI สรุปชื่อ, ใช้ข้อความแรก (เลือก), ให้ผู้ใช้ตั้งเอง

**เหตุผลที่เลือก:** ฟรี, เร็ว, คาดเดาได้; ผู้ใช้เปลี่ยนชื่อเองได้
**ข้อเสีย:** ชื่ออาจยาว/ไม่สวย (ตัดที่ 48 ตัวอักษร + `…`)
**ทดสอบแล้ว:** ใช่ — unit title + integration title

---

## D-011 — Rate limit ด้วย D1 fixed window

**วันที่:** 2026-10-20
**สถานะ:** ใช้งานจริง
**บริบท:** ต้องมีเบรกกันใช้ API เกิน/ brute force โดยไม่เพิ่มบริการ

**ทางเลือก:** Cloudflare Rate Limiting (paid/feature), Durable Object, D1 counter (เลือก), in-memory (ไม่คงอยู่)

**เหตุผลที่เลือก:** ใช้ D1 ที่มีอยู่, คงอยู่ข้าม instance, ตั้งค่าได้ผ่าน env
**ข้อเสีย:** race condition เล็กน้อย, เพิ่ม write ทุก request, D1 เป็น single-threaded; ไม่ใช่ distributed精确
**ทดสอบแล้ว:** บางส่วน — โค้ดทำงานใน integration (ไม่ชน limit); **ยังไม่ทดสอบ boundary/ยิงพร้อมกัน**

---

## D-012 — PBKDF2-SHA256 100,000 รอบ

**วันที่:** 2026-10-20
**สถานะ:** ใช้งานจริง — **ต้องตรวจสอบบน production**
**บริบท:** ต้อง hash รหัสผ่านด้วย Web Crypto และ Workers Free มี CPU 10 ms/request

**ทางเลือก:** PBKDF2 600k (OWASP แนะนำสำหรับ SHA-256), PBKDF2 100k (เลือก), scrypt/Argon2 (ไม่รองรับ native), ใช้บริการ auth ภายนอก

**เหตุผลที่เลือก:** สมดุลระหว่างความปลอดภัยและ CPU; login ถูก rate limit; เป็นค่าที่ทดสอบใน workerd ได้
**ข้อเสีย:** ต่ำกว่าคำแนะนำ OWASP; อาจเกิน CPU Free plan (RISK-01)
**ทดสอบแล้ว:** ใช่ในเชิงฟังก์ชัน (round-trip/wrong password); **ยังไม่วัด CPU บน Cloudflare จริง**

---

## D-013 — Mock Provider เปิดใช้เสมอ และแสดงป้าย DEMO

**วันที่:** 2026-10-20
**สถานะ:** ใช้งานจริง
**บริบท:** ต้องพัฒนา/ทดสอบ UI ได้โดยไม่มี API key และห้ามหลอกว่าเป็น AI จริง

**ทางเลือก:** ปิด mock ใน production, เปิดเสมอแต่ติดป้าย (เลือก), ใช้ fixture แยกเฉพาะ test

**เหตุผลที่เลือก:** ทำให้ demo/test ได้ทุก environment; UI แสดง `DEMO` และข้อความในคำตอบระบุชัดว่าเป็น mock
**ข้อเสีย:** ผู้ใช้อาจสับสนหากไม่สังเกตป้าย — mitigate ด้วย label + ข้อความในคำตอบ
**ทดสอบแล้ว:** ใช่ — integration + curl

---

## D-014 — ไม่มี retry อัตโนมัติเมื่อ provider ล้มเหลว

**วันที่:** 2026-10-20
**สถานะ:** ใช้งานจริง
**บริบท:** retry อาจทำให้เกิดค่าใช้จ่ายซ้ำ/คำตอบซ้ำ และซับซ้อนเรื่อง idempotency

**ทางเลือก:** retry 3 ครั้ง, retry เฉพาะ network error, ไม่ retry (เลือก)

**เหตุผลที่เลือก:** ให้ผู้ใช้ตัดสินใจเอง, ลดความเสี่ยงคิดเงินซ้ำ, โค้ดเรียบง่าย
**ข้อเสีย:** ผู้ใช้ต้องกดส่งใหม่เมื่อ error ชั่วคราว
**ทดสอบแล้ว:** ใช่ — error path ใน integration (model ไม่อนุญาต/oversize)

---

## D-015 — ใช้ `@cloudflare/vitest-plugin` แทน `vitest-pool-workers`

**วันที่:** 2026-10-20
**สถานะ:** ใช้งานจริง
**บริบท:** แพ็กเกจ `@cloudflare/vitest-pool-workers@0.23.0` ไม่มี export `./config` ทำให้ config โหลดไม่ได้ และประกาศว่าเปลี่ยนชื่อแล้ว

**ทางเลือก:** downgrade pool-workers, ใช้ `@cloudflare/vitest-plugin` (เลือก), เปลี่ยนไปใช้ mock D1

**เหตุผลที่เลือก:** เป็นแพ็กเกจทางการรุ่นใหม่ รองรับ Vitest 4, ใช้ `cloudflareTest()` plugin, D1 migrations ผ่าน `readD1Migrations`
**ข้อเสีย:** API ใหม่ เอกสาร/ตัวอย่างบนอินเทอร์เน็ตอาจยังอ้างชื่อเก่า
**ทดสอบแล้ว:** ใช่ — integration 16 tests ผ่าน

---

## D-016 — รหัสผ่านขั้นต่ำ 8 ตัว และรหัสเชิญ 8 ตัว + ปุ่มแสดง/ซ่อน

**วันที่:** 2026-10-20
**สถานะ:** ใช้งานจริง
**บริบท:** เจ้าของต้องการให้กรอกง่าย โดยใช้รหัส 8 ตัว และดูรหัสได้ระหว่างกรอก

**ทางเลือก:** คงรหัสผ่าน 10 + invite ยาว, ลด password เป็น 8 (เลือก), บังคับ invite 8 ตัว (เลือก), ใช้ magic link

**เหตุผลที่เลือก:** ตรงกับ requirement; invite 8 ตัวสุ่ม hex + rate limit ยังเดายากพอสำหรับ MVP; normalize uppercase ลดปัญหากรอกผิด
**ข้อเสีย:** password 8 ตัวอ่อนกว่าค่าแนะนำทั่วไป (RISK-14); invite 8 ตัวสั้นกว่าเดิม
**ทดสอบแล้ว:** ใช่ — unit 2 tests + staging register/login/invite length/chat

---

## D-017 — ใช้ GitHub Actions เป็น CD แทน Cloudflare Workers Builds

**วันที่:** 2026-10-20
**สถานะ:** ใช้งานจริง
**บริบท:** ต้องการให้ push GitHub แล้ว Cloudflare อัปเดตอัตโนมัติ แต่ token ที่มีเป็น account-owned และ Workers Builds API ตอบ `Invalid token`; Git integration ต้องติดตั้ง GitHub App ผ่าน dashboard

**ทางเลือก:** รอ user-scoped token + authorize GitHub App, ใช้ GitHub Actions + Wrangler (เลือก), deploy มือ

**เหตุผลที่เลือก:** ทำงานได้ทันทีด้วย token ที่มี, เก็บ secret ใน GitHub Secrets, ตรวจ test ก่อน deploy, ไม่ผูกกับ dashboard state
**ข้อเสีย:** ไม่มี preview build อัตโนมัติต่อ PR และยังไม่เห็น build logs ใน Cloudflare dashboard
**ทดสอบแล้ว:** ใช่หลัง push `main` — ดู Actions run `Deploy production`
