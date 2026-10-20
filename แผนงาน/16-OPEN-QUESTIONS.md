# 16 — OPEN QUESTIONS

> อัปเดต: 2026-10-20 · คำถามที่ยังไม่มีข้อสรุป / สมมติฐานที่ต้องตรวจสอบ
> ค่าเริ่มต้นที่เลือกใช้ชั่วคราวถูกระบุไว้เพื่อให้งานเดินต่อได้ — เปลี่ยนได้เมื่อเจ้าของตัดสินใจ

## 1. คำถามที่ต้องการคำตอบจากเจ้าของ

| ID | คำถาม | ผลกระทบถ้าไม่ตัดสินใจ | ค่าเริ่มต้นชั่วคราว |
|---|---|---|---|
| OQ-01 | จะใช้ Workers Free หรือ Paid? | Free CPU 10 ms อาจทำให้ login/PBKDF2 ล้มเหลว | ออกแบบให้รันได้ทั้งสอง; ต้องวัดจริง |
| OQ-02 | โดเมนที่จะใช้คืออะไร? | cookie/CORS/SEO/URL | ใช้ worker URL ชั่วคราว |
| OQ-03 | ผู้ใช้กลุ่มแรกมีจำนวนเท่าไร? | schema/rate limit/DB size | สมมติ ≤ 50 คน |
| OQ-04 | จะเปิดรับสมัครเองหรือแจก invite เท่านั้น? | security/cost | ใช้ invite code |
| OQ-05 | ต้องการ Admin Dashboard หรือไม่? | ต้องเพิ่ม role-based endpoints/UI | ยังไม่มี (role admin เก็บไว้) |
| OQ-06 | นโยบายเก็บข้อมูลแชทนานเท่าไร? | D1 size/privacy/legal | เก็บจนผู้ใช้ลบเอง |
| OQ-07 | ต้องมี password reset / email verification? | ต้องใช้ email service/ค่าใช้จ่าย | ยังไม่มี |
| OQ-08 | งบประมาณ AI ต่อเดือนเท่าไร? | เลือก model/limit | ใช้ Mock เป็นค่าเริ่มต้น + rate limit 20/5นาที |
| OQ-09 | ต้องรองรับภาษาอะไรบ้าง? | prompt/UI/i18n | ไทย + อังกฤษ (โมเดลตอบตามภาษา) |
| OQ-10 | ต้องมี MFA/SSO สำหรับองค์กร? | auth architecture | ไม่มีใน MVP |
| OQ-11 | ต้องเก็บ log/audit หรือไม่? | privacy/compliance | ไม่เก็บเนื้อหาแชท; เก็บเฉพาะ error code |
| OQ-12 | ต้องมี backup อัตโนมัติ? | data loss | ใช้ D1 Time Travel เมื่อ deploy |
| OQ-13 | จะใช้ Cloudflare Access/WAF เสริม? | security ops/cost | ยังไม่ใช้ |
| OQ-14 | ต้องแจ้ง privacy policy อย่างไร? | legal/compliance | ยังไม่มีหน้า policy |
| OQ-15 | ต้องการ dark/light toggle? | UI work | dark อย่างเดียว |

## 2. สมมติฐานที่ต้องตรวจสอบ (NEEDS VERIFICATION)

| ID | สมมติฐาน | วิธีตรวจ |
|---|---|---|
| AS-01 | Model IDs ใน allowlist ใช้ได้กับบัญชีจริง | เรียก `/api/models` + ทดสอบ chat จริง |
| AS-02 | PBKDF2 100k อยู่ใน CPU 10 ms |  deploy + ดู CPU metrics/1102 error |
| AS-03 | `request.signal`/stream cancel ทำงานสม่ำเสมอ | ยืนยันแล้วใน workerd/local curl (abort partial ถูกบันทึก); ทดสอบซ้ำหลายรอบบน staging |
| AS-04 | D1 rate limit ไม่ overshoot เกินรับได้ | ยิง concurrent requests ใน staging |
| AS-05 | CSP ไม่ทำให้แอปพัง | เปิด browser console (QA-01) |
| AS-06 | `_headers` ถูกใช้กับ Workers Assets | ตรวจ response headers บน deploy จริง |
| AS-07 | Streaming ผ่าน proxy/CDN ไม่ถูก buffer | ทดสอบบน production URL |
| AS-08 | Gemini `systemInstruction` + role mapping ถูกต้องกับ API รุ่นปัจจุบัน | live test |
| AS-09 | OpenAI `stream:true` + `[DONE]` handling ครบ | live test |
| AS-10 | Session cookie ทำงานกับ custom domain | login หลังตั้งโดเมน |

## 3. ข้อมูลที่ต้องการจากเจ้าของ (สรุปสั้น)

1. Cloudflare account + D1 IDs
2. API keys (OpenAI/Gemini) และโมเดลที่อนุญาต
3. โดเมน
4. งบประมาณ/เพดานรายเดือน
5. นโยบาย retention + privacy
6. ต้องการ admin/email reset/MFA หรือไม่

## 4. ผลกระทบหากยังไม่ตัดสินใจ

- **ไม่ deploy:** ผู้ใช้จริงเข้าไม่ได้; แต่ทีมยังพัฒนา/ทดสอบ local ได้
- **ไม่มี API key:** ใช้ได้เฉพาะ Mock (ต้องสื่อสารให้ชัดว่าไม่ใช่ AI จริง)
- **ไม่มี retention policy:** D1 อาจโตและมีข้อมูลส่วนบุคคลค้าง
- **ไม่มี budget limit:** เสี่ยงค่าใช้จ่าย API สูง
- **ไม่มี admin tools:** จัดการผู้ใช้ต้องแก้ DB ด้วยมือ
- **ไม่วัด CPU:** อาจเจอ login ล้มเหลวบน Free plan โดยไม่รู้สาเหตุ

## 5. ค่าเริ่มต้นที่เลือกใช้ชั่วคราว

| หัวข้อ | ค่า |
|---|---|
| Plan | Workers Free (ออกแบบให้ย้าย Paid ได้) |
| Registration | invite code |
| Default provider | `mock` |
| Chat rate limit | 20 / 5 นาที / user |
| Login rate limit | 10 / 15 นาที / IP+email |
| Session | 7 วัน |
| Data retention | ไม่ลบอัตโนมัติ |
| UI language | ไทย |
| Theme | dark only |
| Model list | OpenAI 3 + Gemini 2 + Mock 1 (ต้องยืนยันกับบัญชี) |
