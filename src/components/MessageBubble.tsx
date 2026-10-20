import { useState } from 'react';
import type { ChatMessage } from '../types';
import { Markdown } from './MarkdownLazy';
import { CheckIcon, CopyIcon, SparkIcon } from './Icons';

function timeLabel(timestamp: number): string {
  return new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' }).format(timestamp);
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  if (isUser) {
    return (
      <div className="group flex justify-end gap-3 px-1 py-3">
        <div className="flex max-w-[85%] flex-col items-end gap-1.5">
          <div className="rounded-2xl rounded-br-md bg-indigo-500/90 px-4 py-2.5 text-[15px] leading-relaxed text-white shadow-lg shadow-indigo-950/30 whitespace-pre-wrap break-words">
            {message.content}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span>{timeLabel(message.createdAt)}</span>
            <button
              type="button"
              onClick={copy}
              className="rounded p-1 opacity-0 transition hover:bg-white/10 hover:text-zinc-200 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-indigo-400 group-hover:opacity-100"
              aria-label="คัดลอกข้อความของผู้ใช้"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
        </div>
        <div className="mt-1 hidden size-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-zinc-300 sm:grid">
          คุณ
        </div>
      </div>
    );
  }

  const pending = message.pending && message.content.length === 0;

  return (
    <div className="group flex gap-3 px-1 py-3">
      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-950/40">
        <SparkIcon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
          <span className="font-medium text-zinc-300">Nova</span>
          {message.model && <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">{message.model}</span>}
          <span>{timeLabel(message.createdAt)}</span>
        </div>

        {pending ? (
          <div className="flex items-center gap-1.5 py-2" aria-label="กำลังสร้างคำตอบ">
            <span className="typing-dot" />
            <span className="typing-dot" style={{ animationDelay: '120ms' }} />
            <span className="typing-dot" style={{ animationDelay: '240ms' }} />
          </div>
        ) : (
          <div className="min-w-0 text-[15px] text-zinc-200">
            <Markdown content={message.content} />
            {message.pending && <span className="stream-caret" aria-hidden="true" />}
          </div>
        )}

        {message.status === 'aborted' && (
          <p className="mt-2 text-xs text-amber-400/80">หยุดการสร้างคำตอบแล้ว</p>
        )}
        {message.status === 'error' && (
          <p className="mt-2 text-xs text-rose-400/80">คำตอบนี้ไม่สมบูรณ์เนื่องจากเกิดข้อผิดพลาด</p>
        )}

        {!pending && message.content.length > 0 && (
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] text-zinc-500 opacity-0 transition hover:bg-white/10 hover:text-zinc-200 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-indigo-400 group-hover:opacity-100"
              aria-label="คัดลอกคำตอบ"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
