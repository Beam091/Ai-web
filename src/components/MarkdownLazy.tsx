import { Component, lazy, Suspense, type ReactNode } from 'react';

const MarkdownImpl = lazy(async () => {
  const module = await import('./Markdown');
  return { default: module.Markdown };
});

class MarkdownBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * The Markdown renderer (react-markdown + syntax highlighting) is the largest
 * frontend dependency. Load it only when the first assistant message appears so
 * login and the empty state stay light. If the chunk cannot be loaded, fall
 * back to readable plain text instead of crashing the chat.
 */
export function Markdown({ content }: { content: string }) {
  const fallback = (
    <div className="md whitespace-pre-wrap break-words" aria-busy="true">
      {content}
    </div>
  );

  return (
    <MarkdownBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <MarkdownImpl content={content} />
      </Suspense>
    </MarkdownBoundary>
  );
}
