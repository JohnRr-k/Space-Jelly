import { useId, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { useMeta } from '../lib/hooks';
import { cx } from './ui';

const norm = (s: string) => s.trim().replace(/^#/, '').replace(/\s+/g, '-').toLowerCase();

export function TagInput({ value, onChange, placeholder = 'Add tags…', className, id }: { value: string[]; onChange: (tags: string[]) => void; placeholder?: string; className?: string; id?: string }) {
  const [text, setText] = useState('');
  const meta = useMeta();
  const listId = useId();
  const add = (raw: string) => {
    const parts = raw.split(',').map(norm).filter(Boolean);
    if (!parts.length) return;
    onChange([...new Set([...value, ...parts])]);
    setText('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (text.trim()) {
        e.preventDefault();
        add(text);
      }
    } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
  };
  return (
    <div className={cx('flex min-h-8 flex-wrap items-center gap-1 rounded-md border border-line-strong bg-surface px-1.5 py-1 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20', className)}>
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-0.5 rounded bg-hover pl-1.5 pr-0.5 text-ui-sm text-ink-2">
          #{t}
          <button type="button" aria-label={`Remove ${t}`} className="rounded p-0.5 text-ink-3 hover:text-ink" onClick={() => onChange(value.filter((x) => x !== t))}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        list={listId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => text.trim() && add(text)}
        placeholder={value.length ? '' : placeholder}
        className="min-w-24 flex-1 bg-transparent px-1 text-ui outline-none placeholder:text-ink-3"
      />
      <datalist id={listId}>
        {meta.data?.tags.slice(0, 200).map((t) => (
          <option key={t.id} value={t.name} />
        ))}
      </datalist>
    </div>
  );
}
