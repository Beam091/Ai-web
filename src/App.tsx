import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  deleteConversation,
  getConversation,
  getMe,
  getModels,
  listConversations,
  logout,
  renameConversation,
  streamChat,
  type StreamMeta,
} from './api';
import type { ChatMessage, Conversation, ProviderInfo, Selection, User } from './types';
import { AuthScreen } from './components/AuthScreen';
import { ChatView } from './components/ChatView';
import { Composer } from './components/Composer';
import { ModelSelector } from './components/ModelSelector';
import { Sidebar } from './components/Sidebar';
import { MenuIcon, SparkIcon } from './components/Icons';

const SELECTION_KEY = 'nova.selection';

function isSelectionValid(providers: ProviderInfo[], selection: Selection | null): boolean {
  if (!selection) return false;
  const provider = providers.find((item) => item.id === selection.provider);
  return Boolean(provider?.available && provider.models.some((model) => model.id === selection.model));
}

function readStoredSelection(): Selection | null {
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Selection>;
    if (typeof parsed.provider !== 'string' || typeof parsed.model !== 'string') return null;
    return { provider: parsed.provider, model: parsed.model };
  } catch {
    return null;
  }
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const loadTokenRef = useRef(0);

  const loadWorkspace = useCallback(async () => {
    const [models, conversationList] = await Promise.all([getModels(), listConversations()]);
    setProviders(models.providers);
    setConversations(conversationList);
    setSelection((current) => {
      if (isSelectionValid(models.providers, current)) return current;
      const stored = readStoredSelection();
      if (isSelectionValid(models.providers, stored)) return stored;
      return models.default;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await getMe();
        if (cancelled) return;
        if (me) {
          setUser(me);
          await loadWorkspace();
        }
      } catch (caught) {
        if (!cancelled) {
          setBootError(caught instanceof ApiError ? caught.message : 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ');
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadWorkspace]);

  useEffect(() => {
    if (selection) localStorage.setItem(SELECTION_KEY, JSON.stringify(selection));
  }, [selection]);

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await listConversations());
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) setUser(null);
    }
  }, []);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleAuthenticated = async (authenticated: User) => {
    setUser(authenticated);
    setError(null);
    try {
      await loadWorkspace();
    } catch {
      setError('โหลดข้อมูลเริ่มต้นไม่สำเร็จ กรุณารีเฟรชหน้า');
    }
  };

  const newChat = useCallback(() => {
    stopStream();
    loadTokenRef.current += 1;
    setActiveId(null);
    setMessages([]);
    setError(null);
    setLoadingConversation(false);
    setSidebarOpen(false);
  }, [stopStream]);

  const openConversation = async (id: string) => {
    stopStream();
    const token = ++loadTokenRef.current;
    setActiveId(id);
    setMessages([]);
    setError(null);
    setLoadingConversation(true);
    try {
      const detail = await getConversation(id);
      if (token !== loadTokenRef.current) return;
      setMessages(detail.messages.map((message) => ({ ...message, pending: false })));
    } catch (caught) {
      if (token !== loadTokenRef.current) return;
      if (caught instanceof ApiError && caught.status === 404) {
        setConversations((prev) => prev.filter((conversation) => conversation.id !== id));
        setActiveId(null);
      } else {
        setError(caught instanceof ApiError ? caught.message : 'โหลดบทสนทนาไม่สำเร็จ');
      }
    } finally {
      if (token === loadTokenRef.current) setLoadingConversation(false);
    }
  };

  const sendMessage = async (rawContent: string) => {
    const content = rawContent.trim();
    if (!content || streaming || !selection) return;

    stopStream();
    setError(null);
    setLoadingConversation(false);
    loadTokenRef.current += 1;

    const now = Date.now();
    const assistantTempId = `local-assistant-${now}`;
    const conversationIdAtSend = activeId;

    setMessages((prev) => [
      ...prev,
      {
        id: `local-user-${now}`,
        role: 'user',
        content,
        provider: selection.provider,
        model: selection.model,
        status: 'complete',
        createdAt: now,
      },
      {
        id: assistantTempId,
        role: 'assistant',
        content: '',
        provider: selection.provider,
        model: selection.model,
        status: 'complete',
        createdAt: now,
        pending: true,
      },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);

    try {
      await streamChat(
        { conversationId: conversationIdAtSend, content, selection },
        {
          onMeta: (meta: StreamMeta) => {
            setActiveId(meta.conversationId);
            setConversations((prev) => {
              if (prev.some((conversation) => conversation.id === meta.conversationId)) return prev;
              return [
                {
                  id: meta.conversationId,
                  title: meta.title,
                  provider: meta.provider,
                  model: meta.model,
                  createdAt: now,
                  updatedAt: now,
                },
                ...prev,
              ];
            });
          },
          onDelta: (text) => {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantTempId ? { ...message, content: message.content + text } : message,
              ),
            );
          },
          onDone: () => {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantTempId
                  ? { ...message, pending: false, status: 'complete' }
                  : message,
              ),
            );
          },
          onError: (streamError) => {
            setError(streamError.message);
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantTempId
                  ? { ...message, pending: false, status: 'error' }
                  : message,
              ),
            );
          },
        },
        controller.signal,
      );
    } catch (caught) {
      if (controller.signal.aborted) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantTempId ? { ...message, pending: false, status: 'aborted' } : message,
          ),
        );
      } else {
        setError(caught instanceof ApiError ? caught.message : 'ส่งข้อความไม่สำเร็จ กรุณาลองใหม่');
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantTempId ? { ...message, pending: false, status: 'error' } : message,
          ),
        );
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStreaming(false);
      void refreshConversations();
    }
  };

  const handleRename = async (id: string, title: string) => {
    await renameConversation(id, title);
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === id ? { ...conversation, title, updatedAt: Date.now() } : conversation,
      ),
    );
  };

  const handleDelete = async (id: string) => {
    await deleteConversation(id);
    setConversations((prev) => prev.filter((conversation) => conversation.id !== id));
    if (id === activeId) newChat();
  };

  const handleLogout = async () => {
    stopStream();
    try {
      await logout();
    } catch {
      // Clear local state anyway; the cookie may already be invalid.
    }
    setUser(null);
    setConversations([]);
    setMessages([]);
    setActiveId(null);
    setProviders([]);
    setSelection(null);
    setError(null);
  };

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? null,
    [conversations, activeId],
  );

  if (booting) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#0a0d12] text-zinc-400">
        <div className="flex flex-col items-center gap-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
            <SparkIcon className="size-6" />
          </span>
          <span className="size-5 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-400" />
          <p className="text-xs">กำลังโหลด Nova Chat…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen initialNotice={bootError} onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-[#0a0d12] text-zinc-100">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => void openConversation(id)}
        onNew={newChat}
        onRename={handleRename}
        onDelete={handleDelete}
        onLogout={() => void handleLogout()}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.06] bg-[#0a0d12]/80 px-3 backdrop-blur sm:gap-3 sm:px-5">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100 md:hidden"
            aria-label="เปิดเมนูด้านข้าง"
          >
            <MenuIcon />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-medium text-zinc-200">
              {activeConversation?.title ?? 'แชทใหม่'}
            </h1>
            <p className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              {streaming ? (
                <>
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
                  กำลังสร้างคำตอบ…
                </>
              ) : (
                `${messages.length} ข้อความ`
              )}
            </p>
          </div>

          <ModelSelector
            providers={providers}
            selection={selection}
            onChange={setSelection}
            disabled={streaming}
          />
        </header>

        <ChatView
          messages={messages}
          streaming={streaming}
          loading={loadingConversation}
          error={error}
          onDismissError={() => setError(null)}
          onSuggestion={(prompt) => void sendMessage(prompt)}
        />

        <Composer
          onSend={(content) => void sendMessage(content)}
          onStop={stopStream}
          streaming={streaming}
          disabled={!selection || loadingConversation}
        />
      </main>
    </div>
  );
}
