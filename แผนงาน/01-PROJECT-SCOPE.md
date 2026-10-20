# 01 — PROJECT SCOPE

> อัปเดต: 2026-10-20 · สถานะ: deploy staging/production แล้วด้วย Mock provider; live provider ยังไม่ทดสอบ

## 1. เป้าหมาย

สร้างเว็บ AI Chat Platform ที่:

1. ใช้งานบน Desktop / Tablet / Mobile ผ่านเบราว์เซอร์
2. ทำงานบน Cloudflare เป็นหลัก (Workers + Static Assets + D1)
3. เชื่อมต่อ OpenAI และ Google Gemini ผ่าน Adapter ที่แยกส่วน
4. เพิ่ม Provider ใหม่ได้โดยไม่แตะ business logic หลัก
5. เก็บประวัติการสนทนาแยกตามผู้ใช้ อย่างปลอดภัย
6. รองรับ Streaming และหยุดการตอบกลางทาง
7. มี Authentication/Authorization จริง ไม่ใช่ซ่อนปุ่มบน UI
8. ใช้ Free Tier ให้มากที่สุดโดยไม่กล่าวอ้างว่าไม่มีค่าใช้จ่าย
9. มีเอกสารเพียงพอให้ Agent คนถัดไปทำงานต่อได้ทันที

## 2. ขอบเขตเวอร์ชันแรก (MVP)

### อยู่ใน scope

- ระบบสมาชิก: สมัครด้วย **รหัสเชิญ 8 ตัวอักษร**, รหัสผ่านขั้นต่ำ 8 ตัว, แสดง/ซ่อนรหัสขณะกรอก, session cookie
- ผู้ใช้คนแรกเป็น `admin`, คนถัดไปเป็น `user` (ยังไม่มี Admin Dashboard)
- Sidebar + New Chat + ประวัติ + เปลี่ยนชื่อ + ลบ
- Chat แบบหลายรอบ, ส่ง context ย้อนหลังตาม budget
- เลือก Provider/Model จาก allowlist ฝั่งเซิร์ฟเวอร์
- Streaming ผ่าน SSE (POST + fetch stream ฝั่ง client)
- Markdown, GFM table, code highlight, copy code/message
- ปุ่ม Stop, error banner, typing indicator, empty state
- Mock Provider สำหรับ demo/test โดยไม่ใช้ API Key
- D1 schema + migrations + ownership isolation
- Rate limiting พื้นฐาน (chat/login/register) ด้วย D1
- Tests: unit + integration (D1 จริงใน workerd)
- เอกสารแผนงาน 18 ไฟล์

### ยังไม่อยู่ใน scope (จงใจตัดออก)

- RAG / อัปโหลดไฟล์ / Web Search / Image Generation
- Regenerate / Edit & Resend / Export chat / ค้นหาประวัติ
- User settings, Admin dashboard, Usage/cost dashboard
- OAuth/SSO, อีเมลยืนยัน, ลืมรหัสผ่าน, MFA
- Billing/quota ระดับองค์กร, team/workspace
- Dark/light theme toggle (UI เป็น dark theme อย่างเดียว)
- custom domain / CI-CD ไปยัง Cloudflare (deploy ด้วย Wrangler จากเครื่องแล้ว)

## 3. ข้อกำหนดเชิงฟังก์ชัน

| ID | ข้อกำหนด | สถานะ |
|---|---|---|
| FR-01 | สมัครสมาชิกด้วยอีเมล + รหัสผ่าน (ขั้นต่ำ 8) + รหัสเชิญ (8 ตัว) | DONE |
| FR-02 | เข้า/ออกระบบด้วย session cookie (HttpOnly, SameSite=Lax) | DONE |
| FR-03 | ผู้ใช้เห็นเฉพาะบทสนทนาของตนเอง | DONE |
| FR-04 | สร้างบทสนทนาใหม่เมื่อส่งข้อความแรก | DONE |
| FR-05 | ส่งข้อความพร้อมเลือก provider/model จาก allowlist | DONE |
| FR-06 | ตอบแบบ streaming ทีละส่วน | DONE (Mock; Provider จริงยังไม่ทดสอบสด) |
| FR-07 | หยุดการตอบได้ | DONE (client abort; เก็บ partial แบบ best-effort) |
| FR-08 | บันทึก user + assistant message ลง D1 | DONE |
| FR-09 | โหลดประวัติเมื่อเปิดบทสนทนา | DONE |
| FR-10 | เปลี่ยนชื่อ/ลบบทสนทนา | DONE |
| FR-11 | แสดง Markdown/Code/Table อย่างปลอดภัย | DONE (ไม่ render HTML ดิบ) |
| FR-12 | Copy ข้อความ/โค้ด | DONE |
| FR-13 | แสดง error ที่ปลอดภัย ไม่ leak upstream body | DONE |
| FR-14 | Sidebar เปิด/ปิดได้ และเป็น drawer บนมือถือ | DONE (รอ visual QA) |
| FR-15 | Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่ | DONE |

## 4. ข้อกำหนดที่ไม่ใช่เชิงฟังก์ชัน

### Performance
- ข้อความผู้ใช้ ≤ 8,000 ตัวอักษร
- context สูงสุด 40 ข้อความ และ ~24,000 ตัวอักษร
- request body ≤ 256 KB
- Streaming ต้องเริ่มส่ง meta ภายในเวลาอันสั้น (ไม่รอคำตอบครบ)
- Frontend main bundle ~264.61 KB (gzip ~80.84 KB) + lazy Markdown chunk ~339.15 KB (gzip ~103.38 KB); ไม่มี warning >500 KB

### Security
- API Key อยู่ฝั่ง Worker secrets เท่านั้น
- ทุก endpoint ที่มีข้อมูลผู้ใช้ต้องผ่าน `requireAuth`
- ทุก query ของ conversation/message ต้องมี `user_id` หรือ ownership check
- ตรวจ `Origin`/`Sec-Fetch-Site` สำหรับคำขอเปลี่ยนข้อมูล
- Rate limit ฝั่งแอป (ไม่แทน billing control ของ provider)
- ไม่ log API key/token/เนื้อหา secret

### Usability / Accessibility
- Responsive ตั้งแต่ 360px ถึง desktop
- Keyboard: Tab, Enter, Shift+Enter, Escape (ยกเลิก rename)
- `aria-label`, `role="log"`, focus-visible ring
- แสดงสถานะกำลังตอบ/หยุด/error อย่างชัดเจน
- ภาษาไทยเป็นภาษาหลักของ UI

### Maintainability / Handoff
- Provider interface กลาง + registry
- แยก route / db / lib / providers ชัดเจน
- เอกสารอัปเดตทุกครั้งที่พฤติกรรมเปลี่ยน
- CI รัน typecheck, lint, test, build

## 5. เกณฑ์ยอมรับ MVP (สถานะจริง)

| เกณฑ์ | สถานะ | หลักฐาน / หมายเหตุ |
|---|---|---|
| Frontend build ผ่าน | ✅ | `npm run build` สำเร็จ |
| Type check ผ่าน | ✅ | `npm run typecheck` ผ่าน 3 projects |
| Lint ผ่าน | ✅ | `npm run lint` (ESLint) ผ่าน 0 warning |
| หน้าเว็บ responsive | ⚠️ ยังไม่ยืนยัน | implement แล้ว แต่ยังไม่ได้ตรวจด้วยเบราว์เซอร์/อุปกรณ์จริง |
| สร้างบทสนทนาได้ | ✅ | integration test + curl |
| ส่งข้อความได้ | ✅ | integration test + curl |
| เรียก OpenAI ได้จริงเมื่อมี credentials | ⛔ ยังไม่ทดสอบ | adapter + unit test ด้วย mocked fetch เท่านั้น |
| เรียก Gemini ได้จริงเมื่อมี credentials | ⛔ ยังไม่ทดสอบ | adapter + unit test ด้วย mocked fetch เท่านั้น |
| Streaming ทำงานตามที่ออกแบบ | ✅ | SSE integration test (Mock) |
| บันทึก/โหลดประวัติได้ | ✅ | integration test + curl |
| ผู้ใช้เข้าถึงเฉพาะข้อมูลตัวเอง | ✅ | IDOR tests 4 กรณี |
| Secrets ไม่ปรากฏใน frontend/Git | ✅ | `.gitignore`, secret scan ใน `dist/client`, ไม่มี secret ใน repo |
| มี Error handling | ✅ | safe provider errors, error event, UI banner |
| มี Tests ที่เหมาะสม | ✅ | 28 unit + 16 integration |
| Deploy ตามขั้นตอนที่บันทึกได้ | ✅ | staging + production จริง; health/SPA/auth/chat/persist/CSRF/headers ผ่าน |
| เอกสารสอดคล้องระบบจริง | ✅ | ตรวจกับโค้ดรอบนี้ |
| Agent คนอื่นรับงานต่อได้ | ✅ | `14-HANDOFF.md` + prompt พร้อมใช้ |
| ข้อจำกัด/งานค้างระบุชัดเจน | ✅ | เอกสารนี้ + `07`, `08`, `16` |

> สรุป: **MVP deploy ได้และผ่านเกณฑ์ด้าน deploy/security/ownership แล้ว** แต่ยังไม่ถือว่าสมบูรณ์ครบทุกเกณฑ์ เพราะยังไม่ผ่าน live provider test และ browser QA

## 6. สมมติฐานที่ใช้

- ผู้ดูแลระบบเป็นผู้สร้างรหัสเชิญและแจกจ่ายเอง
- จำนวนผู้ใช้เริ่มต้นน้อย (หลักสิบ) จึงใช้ D1 rate limit/session แบบง่าย
- หนึ่งบทสนทนาใช้ provider/model ต่อการส่งแต่ละครั้งได้ (สลับได้กลางบทสนทนา)
- ยังไม่มีนโยบายลบข้อมูลอัตโนมัติ (ผู้ใช้ลบเองได้)
- ภาษา UI เป็นไทย, โมเดลตอบตามภาษาที่ผู้ใช้พิมพ์
