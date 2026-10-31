import { useMemo } from 'react';
import { renderMarkdown } from '../lib/markdown';

export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  // Safe: renderMarkdown HTML-escapes all input before adding its own fixed set of tags.
  return <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
