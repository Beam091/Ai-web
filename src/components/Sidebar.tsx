import { useState } from 'react';
import type { Conversation, User } from '../types';
import {
  ChatIcon,
  CloseIcon,
  LogoutIcon,
  PencilIcon,
  PlusIcon,
  SparkIcon,
  TrashIcon,
} from './Icons';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  user: User;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onLogout: () => void;
}

function groupLabel(timestamp: number): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  if (timestamp >= startOfToday) return 'วันนี้';
  if (timestamp >= startOfYesterday) return 'เมื่อวาน';
  if (timestamp >= startOfToday - 7 * 86_400_000) return '7 วันที่ผ่านมา';
  return 'เก่ากว่า';
}

export function Sidebar({
  open,
  onClose,
  user,
  conversations,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onLogout,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const groups: Array<{ label: string; items: Conversation[] }> = [];
  for (const conversation of conversations) {
    const label = groupLabel(conversation.updatedAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(conversation);
    else groups.push({ label, items: [conversation] });
  }

  const saveTitle = async (id: string) => {
    const trimmed = title.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    setBusyId(id);
    try {
      await onRename(id, trimmed);
      setEditingId(null);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (conversation: Conversation) => {
    if (!window.confirm(`ลบบทสนทนา “${conversation.title}” หรือไม่? การลบไม่สามารถย้อนกลับได้`)) return;
    setBusyId(conversation.id);
    try {
      await onDelete(conversation.id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          aria-label="ปิดเมนูด้านข้าง"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-white/[0.06] bg-[#0c1018] transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="เมนูด้านข้าง"
      >
        <div className="flex items-center justify-between px-4 py-4">
          <button
            type="button"
            onClick={onNew}
            className="flex items-center gap-2.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-indigo-400"
            aria-label="กลับหน้าหลัก"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
              <SparkIcon className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-tight text-zinc-100">Nova Chat</span>
              <span className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500">AI Platform</span>
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100 md:hidden"
            aria-label="ปิดเมนู"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="px-3">
          <button
            type="button"
            onClick={onNew}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
          >
            <PlusIcon className="size-4" />
            แชทใหม่
          </button>
        </div>

        <nav className="mt-4 flex-1 overflow-y-auto px-2 pb-4" aria-label="ประวัติการสนทนา">
          {conversations.length === 0 ? (
            <div className="mx-2 mt-6 rounded-xl border border-dashed border-white/10 p-4 text-center">
              <ChatIcon className="mx-auto size-5 text-zinc-600" />
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">ยังไม่มีประวัติการสนทนา<br />เริ่มแชทแรกของคุณได้เลย</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-3">
                <h2 className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  {group.label}
                </h2>
                <ul className="space-y-0.5">
                  {group.items.map((conversation) => {
                    const active = conversation.id === activeId;
                    const editing = editingId === conversation.id;
                    return (
                      <li key={conversation.id} className="group/item relative">
                        {editing ? (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              void saveTitle(conversation.id);
                            }}
                            className="px-1 py-0.5"
                          >
                            <input
                              autoFocus
                              value={title}
                              maxLength={80}
                              onChange={(event) => setTitle(event.target.value)}
                              onBlur={() => void saveTitle(conversation.id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') setEditingId(null);
                              }}
                              className="w-full rounded-lg border border-indigo-400/50 bg-white/5 px-2 py-2 text-xs text-zinc-100 focus:outline-none"
                              aria-label="ชื่อบทสนทนาใหม่"
                            />
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              onSelect(conversation.id);
                              onClose();
                            }}
                            disabled={busyId === conversation.id}
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 pr-14 text-left text-[13px] transition focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-50 ${
                              active
                                ? 'bg-white/[0.08] text-zinc-100'
                                : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                            }`}
                            aria-current={active ? 'page' : undefined}
                          >
                            <ChatIcon className={`size-3.5 shrink-0 ${active ? 'text-indigo-400' : 'text-zinc-600'}`} />
                            <span className="truncate">{conversation.title}</span>
                          </button>
                        )}

                        {!editing && (
                          <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover/item:opacity-100 sm:group-focus-within/item:opacity-100">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(conversation.id);
                                setTitle(conversation.title);
                              }}
                              className="rounded p-1.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-indigo-400"
                              aria-label={`เปลี่ยนชื่อ ${conversation.title}`}
                            >
                              <PencilIcon className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void remove(conversation)}
                              className="rounded p-1.5 text-zinc-500 hover:bg-rose-500/20 hover:text-rose-300 focus-visible:outline-2 focus-visible:outline-rose-400"
                              aria-label={`ลบ ${conversation.title}`}
                            >
                              <TrashIcon className="size-3.5" />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </nav>

        <div className="border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-2.5 py-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 text-xs font-semibold uppercase text-white">
              {user.email.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-zinc-200" title={user.email}>
                {user.email}
              </p>
              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <span className="uppercase tracking-wider">{user.role === 'admin' ? 'Admin' : 'Member'}</span>
                <span className="font-mono text-zinc-600">v{__APP_VERSION__}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-indigo-400"
              aria-label="ออกจากระบบ"
              title="ออกจากระบบ"
            >
              <LogoutIcon />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
