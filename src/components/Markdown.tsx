import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CheckIcon, CopyIcon } from './Icons';

interface HastNode {
  type?: string;
  value?: string;
  tagName?: string;
  properties?: { className?: unknown };
  children?: HastNode[];
}

function textOf(node?: HastNode): string {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textOf).join('');
}

function languageOf(node?: HastNode): string {
  const codeNode = node?.children?.find((child) => child.tagName === 'code');
  const raw = codeNode?.properties?.className;
  const classes = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? raw.split(' ') : [];
  const found = classes.find((item) => item.startsWith('language-'));
  return found ? found.slice('language-'.length) : '';
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ text, label = 'คัดลอก' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-indigo-400"
      aria-label={copied ? 'คัดลอกแล้ว' : label}
      onClick={async () => {
        const ok = await copyText(text);
        if (ok) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span>{copied ? 'คัดลอกแล้ว' : label}</span>
    </button>
  );
}

function CodeBlock({ code, language, children }: { code: string; language: string; children: ReactNode }) {
  return (
    <div className="code-block group/code my-4 overflow-hidden rounded-xl border border-white/10 bg-[#0b0f17]">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          {language || 'code'}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">{children}</pre>
    </div>
  );
}

export function Markdown({ content }: { content: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={{
          pre({ node, children }) {
            const hast = node as unknown as HastNode;
            return (
              <CodeBlock code={textOf(hast)} language={languageOf(hast)}>
                {children}
              </CodeBlock>
            );
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="my-4 overflow-x-auto rounded-lg border border-white/10">
                <table>{children}</table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
