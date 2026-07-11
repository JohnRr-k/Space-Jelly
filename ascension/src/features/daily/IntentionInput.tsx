import { useEffect, useState } from "react";

interface IntentionInputProps {
  value: string;
  disabled?: boolean;
  onCommit: (text: string) => void;
}

/**
 * One line, set once, carried all day. Commits on blur or Enter so the
 * store (and localStorage) isn't written on every keystroke.
 */
export function IntentionInput({
  value,
  disabled = false,
  onCommit,
}: IntentionInputProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const text = draft.trim();
    if (text !== value) onCommit(text);
  };

  return (
    <input
      className="intention-input"
      type="text"
      value={draft}
      placeholder="Today's intention — one line."
      aria-label="Today's intention"
      disabled={disabled}
      maxLength={120}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
