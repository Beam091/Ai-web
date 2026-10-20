# 07 — ISSUES AND RISKS

> อัปเดต: 2026-10-20 · ทุก issue ด้านล่างเกิดจริงระหว่างพัฒนาและได้รับการแก้แล้ว เว้นแต่ระบุว่าเปิดอยู่

## 1. ปัญหาที่พบและแก้แล้ว

### ISSUE-01 — Vitest โหลด config ไม่ได้ (`Missing "./config" specifier`)
- **อาการ:** `npm test` ล้มทันที `Missing "./config" specifier in "@cloudflare/vitest-pool-workers" package`
- **บริบท:** ใช้ `@cloudflare/vitest-pool-workers@0.23.0` + Vitest 4.1.12
- **สาเหตุที่ยืนยัน:** package exports มีเพียง `.` และ `./types`; แพ็กเกจประกาศว่าถูกเปลี่ยนชื่อเป็น `@cloudflare/vitest-plugin`
- **วิธีแก้ที่ลอง:** ตรวจ `package.json` exports → เปลี่ยนไปใช้ `@cloudflare/vitest-plugin@1.4.5`, ใช้ `cloudflareTest()` + `readD1Migrations()` จาก root export
- **ผล:** integration tests รันได้ 16 tests ผ่าน (เพิ่ม abort case ภายหลัง)
- **ป้องกัน:** ตรวจ export/เวอร์ชันก่อนตั้ง test toolchain; บันทึกใน `06-DECISIONS.md` D-015

### ISSUE-02 — Unit test import path ผิด
- **อาการ:** `Cannot find module '../worker/lib/crypto'`
- **สาเหตุ:** ไฟล์อยู่ใน `tests/unit/` จึงต้องใช้ `../../worker/...` ไม่ใช่ `../worker/...`
- **วิธีแก้:** แก้ import ทั้งหมด
- **ผล:** unit tests ผ่าน 22 tests (ภายหลังเพิ่ม output-budget เป็น 26)
- **ป้องกัน:** ใช้ path ที่สัมพันธ์กับตำแหน่งไฟล์จริง; typecheck/test จับได้ทันที

### ISSUE-03 — Integration test multi-turn ไม่เห็น assistant message
- **อาการ:** คาด 4 messages แต่ได้ 3 (ขาด assistant ของเทิร์นสอง)
- **สาเหตุ:** ไม่ได้อ่าน response body ของ `SELF.fetch` เทิร์นสอง ทำให้ stream ไม่ถูก pump และการบันทึกยังไม่เกิด
- **วิธีแก้:** `await second.text()` ก่อน query detail
- **ผล:** ผ่าน
- **บทเรียน:** Worker stream เป็น lazy — ต้อง consume response ใน test

### ISSUE-04 — TypeScript/Lint จับ type ของ conversation และ originHost
- **อาการ:** `Type 'ConversationRow | null' is not assignable` และ ESLint `no-useless-assignment`
- **สาเหตุ:** narrow type หลัง throw ไม่ครอบคลุมการ assign ให้ตัวแปรที่ประกาศแยก; ตัวแปรถูก init แล้ว assign ทับ
- **วิธีแก้:** ใช้ `const existing` แล้วตรวจก่อน assign; ประกาศ `let originHost: string` ไม่ init
- **ผล:** typecheck/lint ผ่าน
- **ป้องกัน:** รัน typecheck+lint ทุกครั้งหลังแก้

### ISSUE-05 — `database_id` เป็น placeholder ใน local (ปิดแล้ว)
- **อาการเดิม:** ไม่มี error เมื่อใช้ `wrangler d1 migrations apply --local` / `wrangler dev` แม้ `database_id` เป็น placeholder
- **สาเหตุ:** local D1 ใช้ชื่อ/ID ภายใน `.wrangler/state` ไม่ตรวจรูปแบบกับ Cloudflare
- **วิธีแก้:** สร้าง D1 จริง staging `3c73db62...` และ production `4f59bd66...` แล้วใส่ใน `wrangler.jsonc` ครบทุก env
- **ผล:** deploy remote + migrate สำเร็จทั้งสอง env
- **ป้องกัน:** ห้ามใช้ placeholder ใน config ที่ commit แล้ว; ตรวจ `wrangler d1 list` ก่อน deploy

### ISSUE-06 — npm เตือน install scripts ของ workerd/esbuild
- **อาการ:** `npm install` แจ้ง postinstall ยังไม่ได้รับอนุมัติ (`workerd`, `esbuild`)
- **ผล:** เครื่องมือยังทำงานได้ (binary มาจาก optional dependency) — build/test/dev ผ่านทั้งหมด
- **สถานะ:** ไม่บล็อก; หาก CI ล้มด้วยปัญหา binary ให้รัน `npm install-scripts approve` หรือใช้ `npm ci` ใน CI ปกติ

### ISSUE-07 — Bundle frontend ใหญ่เกิน 500 KB
- **อาการเดิม:** Vite เตือน chunk 601.38 kB (gzip 184.37 kB)
- **สาเหตุ:** `highlight.js` + `react-markdown` + UI ถูก bundle รวมกับ main
- **วิธีแก้:** แยก `Markdown` เป็น lazy chunk ผ่าน `src/components/MarkdownLazy.tsx` + Suspense/error boundary; main chunk เหลือ 262.16 kB และ Markdown chunk 339.15 kB
- **สถานะ:** แก้แล้ว (POLISH-01 DONE) — ยังต้องยืนยันการโหลดในเบราว์เซอร์จริงที่ QA-01

### ISSUE-08 — การบันทึกข้อความเมื่อ client ตัดการเชื่อมต่อเป็น best-effort
- **อาการเดิม:** ยิง curl แล้วปิด pipe ทันที พบ conversation ที่มีเพียง user message เพราะการบันทึก partial ไม่ได้ผูกกับ `waitUntil`
- **สาเหตุ:** เมื่อ request context ถูกยกเลิก งานเขียน D1 ที่ยังค้างอยู่อาจถูกตัดก่อนเสร็จ
- **วิธีแก้:** เรียก `persistAfterDisconnect('aborted')` จากทั้ง `request.signal` และ `cancel()` โดยใช้ `c.executionCtx.waitUntil()` พร้อม guard `persisted` กันเขียนซ้ำ
- **ผล:** integration test ใหม่ `persists the partial assistant message when the client stops reading` ผ่าน; manual curl abort ได้ assistant `status=aborted` 207 chars
- **ผลบน staging:** ตัดที่ 1s ได้ persisted `status=aborted` 109 chars (SSE ได้ 97 chars ก่อนตัด)
- **ข้อจำกัดที่เหลือ:** ถ้า abort ก่อน token แรก จะไม่มี assistant row (เว้นว่างโดยเจตนา); ยังไม่ได้ทดสอบใน browser จริง

### ISSUE-09 — ไม่มีเพดานเวลา/ความยาวคำตอบ และ listener cleanup ผิดตัว
- **อาการ:** provider ที่ค้างหรือตอบยาวมากใช้ resource ต่อเนื่อง; `finally` ลบ abort listener ผิดฟังก์ชัน
- **วิธีแก้:** เพิ่ม `AI_TIMEOUT_SECONDS` และ `AI_MAX_OUTPUT_CHARS`, ตัด delta ตาม budget, ส่ง error code ชัดเจน, เก็บ timeout handle และลบ `handleRequestAbort` ตัวจริงใน `finally`
- **ผล:** unit tests 4 รายการผ่าน; manual timeout 1.07s และ cap 500 chars ผ่าน (ดู `08-TEST-REPORT.md`)
- **ผลบน staging:** timeout 53 chars ที่ 1,859 ms (`PROVIDER_TIMEOUT`); cap 500 chars (`RESPONSE_LIMIT_REACHED`); persisted `status=error` ทั้งคู่
- **ข้อจำกัด:** ยังไม่ได้ทดสอบกับ provider จริง (Mock เท่านั้น)

## 2. สมมติฐานที่ยังไม่ยืนยัน

- PBKDF2 100k รอบจะอยู่ใน CPU 10 ms ของ Workers Free หรือไม่ (ยังไม่วัดบน Cloudflare จริง)
- `request.signal`/`cancel()` ของ Workers จะ abort stream ได้สม่ำเสมอทุกกรณี — ยืนยันแล้วใน workerd/local curl และ staging (Mock) แต่ยังไม่ครบทุก network condition
- D1 rate-limit counter ภายใต้ concurrent requests จะไม่ overshoot เกินกว่าที่รับได้
- Model ID ใน allowlist ยังใช้งานได้กับบัญชีจริง ณ วัน deploy
- `_headers` CSP ไม่กระทบการทำงานของ Vite bundle/React (ทดสอบเฉพาะ local HTML)

## 3. ความเสี่ยงคงเหลือ

| ID | ความเสี่ยง | โอกาส | ผลกระทบ | แผนรับมือ | สถานะ |
|---|---|---|---|---|---|
| RISK-01 | PBKDF2 login เกิน CPU Free 10 ms | กลาง | login ล้มเหลว/timeout | วัดจริง; ลด iterations, ใช้ Paid, หรือ external auth | เปิด |
| RISK-02 | D1 rate limit overshoot/race | กลาง | ใช้ API เกินเล็กน้อย | ยอมรับใน MVP; พิจารณา DO/Cloudflare Rate Limiting | เปิด |
| RISK-03 | ค่าใช้จ่าย OpenAI/Gemini เกิน | กลาง | ค่าใช้จ่ายสูง | rate limit + timeout/output cap + ตั้ง budget ที่ provider + จำกัดผู้ใช้ | เปิด |
| RISK-04 | Model ID เปลี่ยน/เลิกใช้ | สูง | ส่งแชทไม่ได้ | allowlist แก้ผ่าน env/catalog + ตรวจ docs ก่อน deploy | เปิด |
| RISK-05 | ยังไม่ทดสอบ provider จริง | สูง | bug เฉพาะ vendor | LIVE-01/02 ก่อนเปิดใช้ | BLOCKED |
| RISK-06 | XSS จาก Markdown | ต่ำ | ขโมย session | ไม่ render HTML ดิบ, CSP, HttpOnly cookie | ควบคุมแล้ว |
| RISK-07 | Session ขโมยผ่าน XSS/อุปกรณ์ | ต่ำ-กลาง | เข้าถึงบัญชี | HttpOnly/Secure/SameSite, อายุ 7 วัน, logout revoke | ควบคุมแล้ว |
| RISK-08 | ไม่มี password reset/email verify | กลาง | ผู้ใช้ลืมรหัสผ่าน | admin สร้างใหม่/ลบ user (ยังไม่มี UI) | เปิด |
| RISK-09 | ไม่มี admin dashboard | ต่ำ | จัดการผู้ใช้ยาก | เพิ่ม HARD-02 | เปิด |
| RISK-10 | Streaming ยาว/ค้าง | ต่ำ | เปลือง resource | timeout 90s + cap 32k chars (HARD-01) | ควบคุมแล้ว; ทดสอบ staging ด้วย Mock |
| RISK-11 | D1 500 MB เต็ม | ต่ำ | เขียนไม่ได้ | retention policy (HARD-03) | เปิด |
| RISK-12 | Invite code หลุด | กลาง | คนนอกสมัครได้ | rotate `SIGNUP_CODE`, ปิดรับสมัครเมื่อครบ | เปิด |
| RISK-13 | CSP เข้มเกินทำให้ UI พัง | ต่ำ | หน้าเว็บใช้งานไม่ได้ | QA-01 ตรวจ console | เปิด |
| RISK-14 | ไม่มี retry ทำให้ UX แย่เมื่อ network สะดุด | กลาง | ต้องส่งใหม่ | แสดง error ชัด + พิจารณา retry แบบ idempotent | ยอมรับ |

## 4. แนวทางป้องกันในอนาคต

1. รัน `typecheck + lint + test + build` ก่อนจบทุกงาน (มี CI)
2. เพิ่ม integration test ทุกครั้งที่เพิ่ม endpoint หรือแก้ schema
3. วัด CPU/latency บน staging ก่อน production
4. ตรวจ model list กับบัญชีจริงทุกครั้งก่อน deploy
5. ไม่ log เนื้อหาแชท/secret; ใช้ requestId สำหรับ trace
6. หมุน `SIGNUP_CODE` และ API keys เมื่อสงสัยว่าหลุด
7. อ่าน `07` และ `16` ก่อนตัดสินใจเรื่อง security/cost/data
