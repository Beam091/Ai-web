# 17 — AGENT PROTOCOL

> กติกาสำหรับ AI Agent ทุกตัวที่ทำงานกับ Repository นี้
> เป้าหมาย: ส่งต่องานได้โดยไม่ต้องมีประวัติแชท และไม่ทำลายงานของกัน

## 1. ก่อนเริ่มงาน (บังคับ)

```bash
pwd
git status --short --branch
git log --oneline -5
```

1. อ่าน `แผนงาน/00-README.md`
2. อ่าน `แผนงาน/14-HANDOFF.md`
3. อ่าน `แผนงาน/05-TASK-BOARD.md`
4. อ่านเอกสารเฉพาะทางของงานนั้น
5. ตรวจ `git status` และ diff ถ้ามีไฟล์ที่ถูกแก้ค้างอยู่
6. รัน baseline:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

7. ระบุ Task ID ที่จะทำ และ Acceptance Criteria ก่อนลงมือ

> ถ้า baseline ไม่ผ่าน ให้บันทึกว่าเป็นปัญหาก่อนหน้า ห้ามอ้างว่าเกิดจากงานตัวเองหรือแก้ให้ผ่านแบบปิด security

## 2. การรับงาน

- งานต้องมี Task ID ใน `05-TASK-BOARD.md`
- ถ้าเป็นงานใหม่ ให้เพิ่ม Task ID ใหม่ (รูปแบบ `<AREA>-<NN>`)
- เปลี่ยนสถานะเป็น `IN_PROGRESS` ก่อนเริ่ม (และอัปเดต Handoff ถ้างานยาว)
- งานที่ไม่มี dependency ครบ → `BLOCKED` พร้อมระบุสิ่งที่ต้องขอ

## 3. กติกาการแก้ไขไฟล์

1. อ่านไฟล์ก่อนแก้เสมอ
2. แก้เฉพาะส่วนที่จำเป็นต่อ Task
3. ห้ามลบ/เขียนทับงานของ Agent อื่นโดยไม่ตรวจ diff
4. ถ้าไฟล์ถูกแก้โดยคนอื่นระหว่างทำงาน ให้หยุดและ merge ด้วยความเข้าใจ ไม่ใช้ `git checkout --` ทับ
5. ห้าม commit secret, `.dev.vars`, `.env`, `.wrangler/`, `node_modules/`, `dist/`
6. ห้ามแก้ migration ที่ apply แล้ว
7. ห้ามปิด rate limit/CSRF/auth เพื่อให้ test ผ่าน
8. ถ้าเพิ่ม dependency ต้องอัปเดต `03-TECH-STACK.md` และอธิบายเหตุผล
9. ถ้าเปลี่ยน schema/API/architecture ต้องอัปเดตเอกสารในงานเดียวกัน

## 4. Definition of Done

งานจะ `DONE` ได้เมื่อ:

- [ ] ตรง Acceptance Criteria ของ Task
- [ ] `npm run typecheck` ผ่าน
- [ ] `npm run lint` ผ่าน
- [ ] `npm test` ผ่าน (หรือระบุว่า test ใดยังไม่ได้ทำและเพราะอะไร)
- [ ] `npm run build` ผ่าน
- [ ] ไม่มี secret ใน diff (`git diff` + ตรวจไฟล์)
- [ ] อัปเดต `05-TASK-BOARD.md`
- [ ] อัปเดต `08-TEST-REPORT.md` (ถ้ามีการทดสอบ)
- [ ] อัปเดต `15-CHANGELOG.md`
- [ ] อัปเดต `14-HANDOFF.md`
- [ ] ถ้าเจอปัญหา/ความเสี่ยงใหม่ อัปเดต `07-ISSUES-AND-RISKS.md` / `16-OPEN-QUESTIONS.md`

## 5. การจัดการงานที่ทำไม่เสร็จ

เมื่อ Context ใกล้เต็ม / ต้องหยุด / ติด blocker:

1. หยุดเริ่มงานใหม่
2. บันทึกสถานะลง `14-HANDOFF.md` ทันที
3. ระบุ:
   - Task ID และเป้าหมาย
   - ไฟล์ที่แก้
   - สิ่งที่ทำเสร็จแล้ว
   - สิ่งที่ยังเหลือ + วิธีทำต่อ
   - คำสั่งที่รันล่าสุด + ผล
   - error/blocker
4. อัปเดต Task Board เป็น `IN_PROGRESS` หรือ `BLOCKED` (ห้าม `DONE`)
5. ตรวจ `git status` และ `git diff`
6. ห้าม revert งานที่ยังไม่ commit โดยไม่มีเหตุผล

## 6. การตรวจสอบ Git

```bash
git status --short
git diff --stat
git diff
git diff --cached
```

- ก่อน commit: ตรวจว่าไม่มี secret/ไฟล์ build หลุด
- อย่า commit/push เว้นแต่ผู้ใช้สั่ง
- ถ้ามี branch อื่น/งานค้าง ให้ระบุใน Handoff
- อย่า force push / reset --hard โดยไม่ได้รับอนุญาต

## 7. รูปแบบรายงานผล (ภาษาไทย)

ทุกครั้งที่จบรอบทำงาน ให้รายงาน:

1. **สรุป** — สิ่งที่ทำสำเร็จ
2. **ไฟล์ที่เปลี่ยนแปลง** — สร้าง/แก้/ลบ
3. **ผลการทดสอบ** — คำสั่ง + ผลจริง แยกผ่าน/ไม่ผ่าน/ยังไม่ได้ทดสอบ
4. **สถานะแผนงาน** — Task ID + สถานะ
5. **ปัญหาคงค้าง** — อะไรติดและต้องการอะไร
6. **งานถัดไป**
7. **การส่งต่องาน** — `14-HANDOFF.md` อัปเดตแล้วหรือไม่
8. **ข้อจำกัด** — สิ่งที่ยังยืนยันไม่ได้

## 8. กฎห้ามอ้างความสำเร็จโดยไม่มีหลักฐาน

- ห้ามบอกว่า deploy สำเร็จ ถ้าไม่ได้รัน `wrangler deploy` และตรวจ URL จริง
- ห้ามบอกว่าทดสอบ OpenAI/Gemini จริง ถ้าใช้ mocked fetch
- ห้ามบอกว่า responsive/a11y ผ่าน ถ้าไม่ได้เปิดเบราว์เซอร์ตรวจ
- ห้ามแต่งผลทดสอบ/ตัวเลข — ถ้าไม่ได้รัน ให้เขียน `NOT RUN` หรือ `NEEDS VERIFICATION`
- ถ้าไม่รู้ ให้เขียน `UNKNOWN` / `NEEDS VERIFICATION` ไม่ใช่เดา

## 9. ลำดับความสำคัญเมื่อขัดแย้ง

1. ความปลอดภัยและข้อมูลผู้ใช้
2. ความถูกต้องของข้อมูล/ความเสียหายที่ย้อนกลับไม่ได้
3. Acceptance Criteria
4. ความเร็วในการส่งงาน
5. ความสวยงาม/ฟีเจอร์เพิ่ม

หากการตัดสินใจกระทบ security, ค่าใช้จ่ายสูง, การลบข้อมูล หรือย้อนกลับยาก → **ถามเจ้าของก่อน**

## 10. การอัปเดตเอกสาร (Documentation Matrix)

| สิ่งที่เปลี่ยน | ต้องอัปเดต |
|---|---|
| Schema / query | `11-DATABASE.md`, `08`, `15` |
| API / SSE | `12-API-REFERENCE.md`, `08`, `15` |
| Auth/security | `13-SECURITY.md`, `10-ENVIRONMENT.md` ถ้าเพิ่ม env |
| Provider/model | `03`, `10`, `12`, `06` (ถ้าเป็นการตัดสินใจ) |
| Dependencies | `03-TECH-STACK.md` |
| Deploy/env | `09-DEPLOYMENT.md`, `10-ENVIRONMENT.md` |
| Task status | `05-TASK-BOARD.md` |
| ทุกงาน | `14-HANDOFF.md`, `15-CHANGELOG.md` |

## 11. การส่งต่อ

- Handoff ต้องสั้น อ่านเร็ว แต่มีคำสั่ง/สถานะ/งานถัดไปครบ
- ต้องมี prompt พร้อมคัดลอกท้ายไฟล์
- ระบุ branch/commit/เวลา/สถานะ credential
- งานถัดไปต้องมี Task ID และ Acceptance Criteria

## 12. สิ่งที่ห้ามทำ

- ห้ามสร้างโปรเจกต์ใหม่ทับของเดิมเมื่อมีงานอยู่แล้ว
- ห้ามลบเอกสาร/ประวัติ decision เก่า
- ห้ามใส่ secret/API key ในเอกสารหรือ commit
- ห้ามใช้ `any` เพื่อหลบ typecheck โดยไม่มีเหตุผล (และ lint จะจับ)
- ห้ามแก้ test ให้ผ่านด้วยการลดความเข้มงวดของ security
- ห้ามรายงานผลลัพธ์ที่ไม่ได้เกิดขึ้นจริง
