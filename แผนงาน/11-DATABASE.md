# 11 — DATABASE (Cloudflare D1)

> อัปเดต: 2026-10-20 · Schema จริงอยู่ใน `migrations/0001_init.sql`
> Timestamp ทั้งหมดเป็น Unix epoch milliseconds (`INTEGER`)

## 1. ER Diagram

```
users 1 ──── * sessions
  │
  └──── * conversations 1 ──── * messages

rate_limits (standalone)
```

ความสัมพันธ์:

- `sessions.user_id → users.id` (ON DELETE CASCADE)
- `conversations.user_id → users.id` (ON DELETE CASCADE)
- `messages.conversation_id → conversations.id` (ON DELETE CASCADE)

## 2. ตาราง

### `users`

| คอลัมน์ | ชนิด | ข้อกำหนด | ความหมาย |
|---|---|---|---|
| `id` | TEXT | PK | UUID |
| `email` | TEXT | NOT NULL, UNIQUE, COLLATE NOCASE | อีเมล (lowercase ในแอป) |
| `password_hash` | TEXT | NOT NULL | `pbkdf2$<iter>$<saltB64>$<hashB64>` |
| `role` | TEXT | NOT NULL, DEFAULT `user`, CHECK in (`admin`,`user`) | สิทธิ์ |
| `created_at` | INTEGER | NOT NULL | epoch ms |

### `sessions`

| คอลัมน์ | ชนิด | ข้อกำหนด | ความหมาย |
|---|---|---|---|
| `token_hash` | TEXT | PK | SHA-256 hex ของ token (ไม่เก็บ token ดิบ) |
| `user_id` | TEXT | NOT NULL, FK users | เจ้าของ session |
| `created_at` | INTEGER | NOT NULL | |
| `expires_at` | INTEGER | NOT NULL | now + 7 วัน |

### `conversations`

| คอลัมน์ | ชนิด | ข้อกำหนด | ความหมาย |
|---|---|---|---|
| `id` | TEXT | PK | UUID |
| `user_id` | TEXT | NOT NULL, FK users | เจ้าของ |
| `title` | TEXT | NOT NULL | ชื่อที่ตัดจากข้อความแรก หรือผู้ใช้แก้ |
| `provider` | TEXT | NOT NULL | provider ล่าสุดที่ใช้ |
| `model` | TEXT | NOT NULL | model ล่าสุดที่ใช้ |
| `created_at` | INTEGER | NOT NULL | |
| `updated_at` | INTEGER | NOT NULL | ใช้เรียงใน sidebar |

### `messages`

| คอลัมน์ | ชนิด | ข้อกำหนด | ความหมาย |
|---|---|---|---|
| `id` | TEXT | PK | UUID |
| `conversation_id` | TEXT | NOT NULL, FK conversations | |
| `role` | TEXT | NOT NULL, CHECK (`user`,`assistant`) | |
| `content` | TEXT | NOT NULL | ข้อความ (อาจเป็น partial เมื่อ abort) |
| `provider` | TEXT | NULL | provider ของ assistant message |
| `model` | TEXT | NULL | model ของ assistant message |
| `status` | TEXT | NOT NULL, DEFAULT `complete`, CHECK (`complete`,`error`,`aborted`) | สถานะคำตอบ |
| `seq` | INTEGER | NOT NULL | ลำดับในบทสนทนา |
| `created_at` | INTEGER | NOT NULL | |
| — | — | UNIQUE (`conversation_id`,`seq`) | กันลำดับซ้ำ |

### `rate_limits`

| คอลัมน์ | ชนิด | ข้อกำหนด | ความหมาย |
|---|---|---|---|
| `key` | TEXT | PK | เช่น `chat:<userId>`, `login:<ip>:<email>` |
| `window_start` | INTEGER | NOT NULL | จุดเริ่ม window |
| `count` | INTEGER | NOT NULL | จำนวนใน window |

## 3. Indexes

| Index | คอลัมน์ | ใช้กับ |
|---|---|---|
| `idx_sessions_user` | `sessions(user_id)` | ลบ/ตรวจ session ตาม user |
| `idx_sessions_expires` | `sessions(expires_at)` | cleanup |
| `idx_conversations_user_updated` | `conversations(user_id, updated_at DESC)` | sidebar list |
| `idx_messages_conversation_seq` | `messages(conversation_id, seq)` | โหลดประวัติ/context |
| (unique) | `users(email)` | login/register |
| (unique) | `messages(conversation_id, seq)` | integrity |

## 4. Data Integrity

- ใช้ **prepared statements + bound parameters** ทุก query (ไม่มี string interpolation ของ user input)
- Foreign keys + `ON DELETE CASCADE` — ลบ user จะลบ session/conversation/message
- `role` และ `status` มี CHECK constraint
- `email` unique แบบ NOCASE กันสมัครซ้ำด้วยตัวพิมพ์ต่าง
- `seq` กำหนดด้วย `COALESCE(MAX(seq),0)+1` ภายใน INSERT … SELECT (ต่อ conversation)
- Ownership ถูกบังคับใน WHERE (`id = ? AND user_id = ?`) ไม่พึ่ง UI
- ข้อความว่างจะไม่ถูกส่งให้ provider (`content <> ''`) และ assistant ที่ว่างจะไม่ถูกบันทึก

## 5. Migration History

| ลำดับ | ไฟล์ | เนื้อหา | วันที่ | สถานะ |
|---|---|---|---|---|
| 0001 | `migrations/0001_init.sql` | สร้าง 5 ตาราง + indexes | 2026-10-20 | apply local สำเร็จ (11 statements) |

คำสั่ง:

```bash
npm run db:migrate:local
npx wrangler d1 migrations apply DB --remote --env staging
npx wrangler d1 migrations apply DB --remote --env production
npx wrangler d1 migrations list DB --local
```

## 6. Backup และกู้คืน

### D1 Time Travel (แนะนำ)
- Free: ย้อนได้ 7 วัน; Paid: 30 วัน
- ตรวจสถานะ: `npx wrangler d1 time-travel info DB --env production`
- กู้คืน: `npx wrangler d1 time-travel restore DB --timestamp <ISO-8601> --env production`
- ก่อน restore: export ข้อมูลปัจจุบันไว้ด้วย

### Export
```bash
npx wrangler d1 export DB --remote --env production --output backup-$(date +%F).sql
```

### หมายเหตุ
- การ export อาจมีข้อมูลผู้ใช้ (อีเมล, เนื้อหาแชท) — เก็บอย่างปลอดภัยและลบเมื่อไม่ใช้
- ไม่มี automated backup ใน repo นี้; ต้องตั้งกระบวนการเอง

## 7. การเปลี่ยน Schema ในอนาคต

1. สร้างไฟล์ใหม่ `migrations/000N_<description>.sql` (ห้ามแก้ migration ที่ apply แล้ว)
2. ใช้การเปลี่ยนแปลงแบบ additive ก่อน (ADD COLUMN, CREATE INDEX) เพื่อความเข้ากันได้
3. ทดสอบ local: `npm run db:migrate:local` + `npm test`
4. Deploy staging → ตรวจ → production
5. อัปเดตเอกสารนี้, `08-TEST-REPORT.md`, `15-CHANGELOG.md`

ข้อควรระวัง D1:
- ไม่มี `ALTER COLUMN` แบบซับซ้อน → ต้องสร้างตารางใหม่ + copy + rename
- หลีกเลี่ยง query ที่แก้ข้อมูลจำนวนมากในครั้งเดียว (จำกัดเวลา/ขนาด)
- ระวัง `PRAGMA foreign_keys` ระหว่าง rebuild ตาราง

## 8. ข้อจำกัดที่ทราบ

- ไม่มี soft delete (ลบแล้วหายถาวร)
- ไม่มีตาราง audit log
- ข้อความเก่าไม่มี retention/partition
- ไม่มี full-text search
- D1 ต่อ database ประมวลผลแบบ single-threaded
