# 03 — TECH STACK

> อัปเดต: 2026-10-20 · เวอร์ชันด้านล่างคือเวอร์ชันที่ติดตั้งจริงใน `package-lock.json` (ตรวจด้วย `npm ls --depth=0`)

## 1. Runtime และเครื่องมือหลัก

| เทคโนโลยี | เวอร์ชันจริง | ใช้ทำอะไร | เหตุผล |
|---|---|---|---|
| Node.js (เครื่อง dev) | 24.21.0 | รัน Vite/Wrangler/Vitest | รองรับ toolchain ปัจจุบัน; CI ใช้ Node 22 |
| npm | 11.19.0 | package manager | ใช้ lockfile เดียว |
| Cloudflare Workers (workerd) | ตาม Wrangler 4.151.2 | runtime ของ API | Web Standard, scale อัตโนมัติ, ใกล้ D1 |
| Wrangler | 4.151.2 | dev/deploy/migrations | เครื่องมือทางการ |
| TypeScript | 5.9.3 | type safety ทั้ง frontend/worker | strict mode |
| Vite | 7.3.7 | build frontend | เร็ว, output static ตรงกับ Workers Assets |
| Vitest | 4.1.12 | unit/integration tests | ใช้ร่วมกับ Cloudflare plugin |
| `@cloudflare/vitest-plugin` | 1.4.5 | รัน integration test ใน workerd + D1 | แพ็กเกจใหม่แทน `vitest-pool-workers` |

## 2. Frontend

| แพ็กเกจ | เวอร์ชัน | หมายเหตุ |
|---|---|---|
| `react`, `react-dom` | 19.3.1 | UI |
| `@vitejs/plugin-react` | 5.2.0 | Fast Refresh / JSX |
| `tailwindcss` + `@tailwindcss/vite` | 4.3.3 | styling (CSS-first config) |
| `react-markdown` | 10.1.0 | render Markdown แบบปลอดภัย |
| `remark-gfm` | 4.0.1 | ตาราง, task list, strikethrough |
| `rehype-highlight` | 7.0.2 | syntax highlight |
| `highlight.js` | 11.12.0 | theme + grammar (ผ่าน rehype) |

**ไม่มี** state management library, router, หรือ UI kit — แอปมีหน้าเดียวและ state ไม่ซับซ้อน

## 3. Backend

| แพ็กเกจ | เวอร์ชัน | หมายเหตุ |
|---|---|---|
| `hono` | 4.13.13 | HTTP framework, middleware, cookie helpers |
| `zod` | 4.6.7 | schema validation ฝั่ง server (และ type inference) |
| Web Crypto | built-in | PBKDF2, SHA-256, random token |
| D1 | binding `DB` | SQLite บน Cloudflare |

ใช้ Web Standard API ล้วน (`Request`, `Response`, `ReadableStream`, `fetch`, `crypto`) — ไม่ใช้ Node.js APIs ใน Worker

## 4. Testing / Quality

| แพ็กเกจ | เวอร์ชัน | หมายเหตุ |
|---|---|---|
| `vitest` | 4.1.12 | test runner |
| `@cloudflare/vitest-plugin` | 1.4.5 | workerd environment + `SELF.fetch` + `applyD1Migrations` |
| `@cloudflare/workers-types` | 5.20261019.1 | types ของ Workers/D1 |
| `eslint` | 10.13.0 | lint (flat config) |
| `@eslint/js` | 10.0.1 | recommended rules |
| `typescript-eslint` | 8.72.0 | TS rules |
| `eslint-plugin-react-hooks` | 7.1.1 | hooks rules |
| `globals` | 17.13.0 | browser/worker/node globals |
| `concurrently` | 9.2.5 | รัน Vite + Wrangler พร้อมกัน |
| `@types/node` | 26.6.5 | config/test typings |
| `@types/react`, `@types/react-dom` | 19.3.0 | React types |

> หมายเหตุ: `@cloudflare/vitest-pool-workers@0.23.0` ถูกถอดออก เพราะเวอร์ชันนั้นไม่มี export `./config` และถูกเปลี่ยนชื่อเป็น `@cloudflare/vitest-plugin` แล้ว (ดู ISSUE-01)

## 5. วิธีติดตั้งและตรวจสอบ

```bash
node -v            # ต้อง >= 22 (พัฒนา/ทดสอบบน 24.21.0)
npm ci             # ติดตั้งตาม lockfile
npm ls --depth=0   # ตรวจเวอร์ชันจริง
npx wrangler --version
npx tsc --version
```

ตรวจว่า toolchain ทำงาน:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## 6. บริการภายนอกที่ต้องใช้

| บริการ | จำเป็นเมื่อ | ค่าใช้จ่าย |
|---|---|---|
| Cloudflare account + Workers | deploy | Free tier 100,000 req/วัน, CPU 10 ms/req; เกินแล้วต้องอัปเกรด |
| Cloudflare D1 | deploy | Free: DB ≤ 500 MB, storage รวม ≤ 5 GB, query ตามโควตา; เกินมีค่าใช้จ่าย |
| OpenAI API | ใช้โมเดล OpenAI | คิดตาม token — **ไม่ฟรี** |
| Google Gemini API | ใช้โมเดล Gemini | มี free tier/โควตาตามบัญชี แต่ **ไม่ควรถือว่าฟรีไม่จำกัด** |
| GitHub Actions | CI (ถ้าใช้ GitHub) | ฟรีตามโควตาของ repo |

## 7. Free Tier: อะไรฟรี และอะไรอาจมีค่าใช้จ่าย

### ฟรี (ภายในโควตา)
- Workers Static Assets และ API requests ภายใน 100,000 req/วัน
- D1 ภายใน 500 MB/DB และ 5 GB/บัญชี (Free)
- การรัน local dev (`wrangler dev`) ไม่มีค่าใช้จ่าย
- Mock Provider ไม่เรียกบริการภายนอก

### อาจมีค่าใช้จ่าย
- Workers/D1 เกิน Free quota
- OpenAI/Gemini token usage (แม้บางช่วงมี free tier ของ provider)
- Custom domain (ค่าจดโดเมน ถ้าซื้อใหม่)
- Logs/metrics เกินโควตาของ plan

> ระบบนี้ **ไม่ได้** ทำ billing control แทน provider — rate limit ฝั่งแอปเป็นเพียงเบรกกันการใช้เกินเท่านั้น ต้องตั้ง budget/limit ในบัญชี provider ด้วย

## 8. สิ่งที่ยังไม่ติดตั้ง / ตัดออก

- ไม่มี ORM (ใช้ D1 prepared statements)
- ไม่มี Redis/KV/DO
- ไม่มี Sentry/observability SaaS (ใช้ `wrangler tail` และ Cloudflare observability)
- ไม่มี Playwright/E2E (ยังไม่มี browser test)
- ไม่มี password reset/email service
