import { useState, type FormEvent } from 'react';
import { ApiError, login, register } from '../api';
import type { User } from '../types';
import { EyeIcon, EyeOffIcon, SparkIcon } from './Icons';

interface AuthScreenProps {
  onAuthenticated: (user: User) => void;
  initialNotice?: string | null;
}

export function AuthScreen({ onAuthenticated, initialNotice }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [error, setError] = useState<string | null>(initialNotice ?? null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (mode === 'register' && password.length < 8) {
      setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    setBusy(true);
    try {
      const result =
        mode === 'login'
          ? await login(email.trim(), password)
          : await register(email.trim(), password, inviteCode.trim().toUpperCase());
      onAuthenticated(result.user);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#0a0d12] text-zinc-100 lg:grid lg:grid-cols-[1.1fr_1fr]">
      <div className="pointer-events-none absolute -left-32 -top-40 size-[28rem] rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-0 size-[24rem] rounded-full bg-fuchsia-600/10 blur-3xl" />

      <section className="relative hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-950/50">
            <SparkIcon className="size-5" />
          </span>
          <div>
            <p className="text-base font-semibold tracking-tight">Nova Chat</p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">AI Platform</p>
          </div>
        </div>

        <div className="max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white">
            แชทกับ AI หลายโมเดล
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
              ในที่เดียว
            </span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            ใช้งาน OpenAI และ Google Gemini ผ่านอินเทอร์เฟซเดียว พร้อมบันทึกประวัติการสนทนาอย่างปลอดภัยบน Cloudflare
          </p>
          <ul className="mt-8 space-y-3 text-sm text-zinc-400">
            {[
              'สลับผู้ให้บริการและโมเดลได้ทันที',
              'ตอบแบบ Streaming ทีละส่วน พร้อมหยุดได้',
              'ประวัติแยกตามผู้ใช้ ไม่ปะปนกัน',
              'API Key เก็บฝั่งเซิร์ฟเวอร์เท่านั้น',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="grid size-5 place-items-center rounded-full bg-emerald-400/10 text-[10px] text-emerald-400">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-zinc-600">Built for Cloudflare Workers · D1 · React</p>
      </section>

      <section className="relative flex min-h-dvh items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
              <SparkIcon className="size-5" />
            </span>
            <div>
              <p className="text-base font-semibold tracking-tight">Nova Chat</p>
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">AI Platform</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-7">
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1" role="tablist" aria-label="เข้าสู่ระบบหรือสมัครสมาชิก">
              {(
                [
                  ['login', 'เข้าสู่ระบบ'],
                  ['register', 'สมัครสมาชิก'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => {
                    setMode(value);
                    setError(null);
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-indigo-400 ${
                    mode === value
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <h2 className="text-lg font-semibold tracking-tight">
              {mode === 'login' ? 'ยินดีต้อนรับกลับ' : 'สร้างบัญชีใหม่'}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {mode === 'login'
                ? 'เข้าสู่ระบบเพื่อดูประวัติการสนทนาของคุณ'
                : 'ต้องใช้รหัสเชิญจากผู้ดูแลระบบเท่านั้น'}
            </p>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-zinc-400">
                  อีเมล
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/60 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-zinc-400">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={mode === 'register' ? 8 : 1}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === 'register' ? 'อย่างน้อย 8 ตัวอักษร' : '••••••••••'}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 pr-11 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/60 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    aria-pressed={showPassword}
                    title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-indigo-400"
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label htmlFor="invite" className="mb-1.5 block text-xs font-medium text-zinc-400">
                    รหัสเชิญ <span className="font-normal text-zinc-600">(8 ตัวอักษร)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="invite"
                      type={showInviteCode ? 'text' : 'password'}
                      required
                      minLength={8}
                      maxLength={8}
                      autoComplete="off"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      value={inviteCode}
                      onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                      placeholder="เช่น A1B2C3D4"
                      aria-describedby="invite-help"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 pr-11 text-sm uppercase tracking-[0.18em] text-zinc-100 placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-600 focus:border-indigo-400/60 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowInviteCode((current) => !current)}
                      aria-label={showInviteCode ? 'ซ่อนรหัสเชิญ' : 'แสดงรหัสเชิญ'}
                      aria-pressed={showInviteCode}
                      title={showInviteCode ? 'ซ่อนรหัสเชิญ' : 'แสดงรหัสเชิญ'}
                      className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-indigo-400"
                    >
                      {showInviteCode ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  <p id="invite-help" className="mt-1.5 text-[11px] text-zinc-600">
                    รับรหัส 8 ตัวอักษรจากผู้ดูแลระบบ
                  </p>
                </div>
              )}

              {error && (
                <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
              >
                {busy && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                {busy ? 'กำลังดำเนินการ…' : mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-zinc-600">
            ผู้ใช้คนแรกของระบบจะได้รับสิทธิ์ Administrator
            <br />
            การใช้งานอยู่ภายใต้นโยบายความเป็นส่วนตัวของเจ้าของเว็บไซต์
          </p>
        </div>
      </section>
    </div>
  );
}
