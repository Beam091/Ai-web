import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { SendIcon, StopIcon } from './Icons';

interface ComposerProps {
  onSend: (content: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled: boolean;
}

const MAX_LENGTH = 8000;

export function Composer({ onSend, onStop, streaming, disabled }: ComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || streaming) return;
    onSend(trimmed);
    setValue('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-white/[0.06] bg-gradient-to-t from-[#0a0d12] via-[#0a0d12] to-transparent px-3 pb-4 pt-3 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-2xl shadow-black/40 transition focus-within:border-indigo-400/50 focus-within:ring-1 focus-within:ring-indigo-400/30">
          <label htmlFor="chat-input" className="sr-only">
            พิมพ์ข้อความ
          </label>
          <textarea
            id="chat-input"
            ref={textareaRef}
            rows={1}
            value={value}
            maxLength={MAX_LENGTH}
            disabled={disabled}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={disabled ? 'ยังไม่มีโมเดลที่ใช้งานได้' : 'พิมพ์ข้อความ… (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)'}
            className="max-h-[220px] min-h-[44px] flex-1 resize-none bg-transparent px-2.5 py-2.5 text-[15px] leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:cursor-not-allowed"
            aria-describedby="composer-hint"
          />
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              className="mb-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-rose-500/90 text-white transition hover:bg-rose-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
              aria-label="หยุดการสร้างคำตอบ"
            >
              <StopIcon className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={disabled || value.trim().length === 0}
              className="mb-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
              aria-label="ส่งข้อความ"
            >
              <SendIcon className="size-4" />
            </button>
          )}
        </div>
        <div id="composer-hint" className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-zinc-600">
          <span>AI อาจให้ข้อมูลที่ไม่ถูกต้อง ตรวจสอบก่อนนำไปใช้</span>
          {value.length > MAX_LENGTH - 1000 && (
            <span className={value.length >= MAX_LENGTH ? 'text-rose-400' : 'text-amber-400'}>
              {value.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
