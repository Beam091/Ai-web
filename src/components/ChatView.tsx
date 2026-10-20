import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';
import { AlertIcon, ChatIcon, CloseIcon, SparkIcon } from './Icons';

interface ChatViewProps {
  messages: ChatMessage[];
  streaming: boolean;
  loading: boolean;
  error: string | null;
  onDismissError: () => void;
  onSuggestion: (prompt: string) => void;
}

const SUGGESTIONS = [
  {
    title: 'อธิบายแนวคิด',
    prompt: 'อธิบายความแตกต่างระหว่าง REST และ GraphQL พร้อมตัวอย่างการใช้งาน',
  },
  {
    title: 'ช่วยเขียนโค้ด',
    prompt: 'เขียนฟังก์ชัน TypeScript สำหรับตรวจสอบอีเมล พร้อมอธิบายว่าใช้ regular expression อะไรและเพราะเหตุใด',
  },
  {
    title: 'สรุปเนื้อหา',
    prompt: 'สรุปหลักการออกแบบฐานข้อมูลเชิงสัมพันธ์ให้เข้าใจง่ายภายใน 5 ข้อ',
  },
  {
    title: 'วางแผนงาน',
    prompt: 'ช่วยวางแผนพัฒนาเว็บแอป MVP ภายใน 4 สัปดาห์ โดยแบ่งเป็น sprint และระบุความเสี่ยง',
  },
];

export function ChatView({ messages, streaming, loading, error, onDismissError, onSuggestion }: ChatViewProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: streaming ? 'auto' : 'smooth' });
  }, [messages, streaming]);

  return (
    <div className="relative flex-1 overflow-y-auto">
      {error && (
        <div className="sticky top-0 z-10 mx-auto flex max-w-3xl items-start gap-2 border-b border-rose-500/20 bg-rose-950/70 px-4 py-2.5 text-sm text-rose-200 backdrop-blur">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          <p className="flex-1">{error}</p>
          <button
            type="button"
            onClick={onDismissError}
            className="rounded p-1 text-rose-300 hover:bg-white/10"
            aria-label="ปิดข้อความแจ้งเตือน"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex h-full items-center justify-center text-sm text-zinc-500">
          <span className="mr-2 size-4 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-400" />
          กำลังโหลดบทสนทนา…
        </div>
      ) : messages.length === 0 ? (
        <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-4 py-12 text-center">
          <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-xl shadow-indigo-950/50">
            <SparkIcon className="size-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            วันนี้อยากให้ช่วยเรื่องอะไร?
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
            เลือกโมเดลด้านบน แล้วเริ่มสนทนาได้เลย ประวัติทั้งหมดจะถูกบันทึกไว้ในบัญชีของคุณ
          </p>

          <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
            {SUGGESTIONS.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => onSuggestion(item.prompt)}
                className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-indigo-400/40 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-indigo-400"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                  <ChatIcon className="size-4 text-indigo-400" />
                  {item.title}
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-500 group-hover:text-zinc-400">
                  {item.prompt}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6" role="log" aria-live="polite" aria-relevant="additions text">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          <div ref={endRef} className="h-2" />
        </div>
      )}
    </div>
  );
}
