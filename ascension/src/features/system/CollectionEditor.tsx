import { useState } from "react";
import { Card } from "../../ui/Card";
import { Chip } from "../../ui/Chip";

/**
 * One editor for every configurable collection — protocol steps, standards,
 * wardrobe, fragrances. Rows read like the Daily screen; adding is tucked
 * behind a single quiet action to keep System calm.
 */

export interface EditorItem {
  id: string;
  primary: string;
  secondary?: string;
  tag?: string;
}

export interface EditorField {
  key: string;
  placeholder: string;
}

export interface EditorSelect {
  key: string;
  options: { value: string; label: string }[];
}

interface CollectionEditorProps {
  label: string;
  addLabel: string;
  items: EditorItem[];
  /** Text inputs for the add form; the first one is required. */
  fields: EditorField[];
  select?: EditorSelect;
  onAdd: (values: Record<string, string>) => void;
  onRemove: (id: string) => void;
}

export function CollectionEditor({
  label,
  addLabel,
  items,
  fields,
  select,
  onAdd,
  onRemove,
}: CollectionEditorProps) {
  const [adding, setAdding] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const selected = select
    ? (values[select.key] ?? select.options[0].value)
    : undefined;

  const submit = () => {
    const primary = (values[fields[0].key] ?? "").trim();
    if (!primary) return;
    const payload: Record<string, string> = {};
    for (const f of fields) {
      const v = (values[f.key] ?? "").trim();
      if (v) payload[f.key] = v;
    }
    if (select && selected) payload[select.key] = selected;
    onAdd(payload);
    setValues({});
    setAdding(false);
  };

  return (
    <Card label={label}>
      <div className="hairline-rows">
        {items.map((item) => (
          <div key={item.id} className="editor-row">
            <div className="editor-body">
              <div className="editor-primary">{item.primary}</div>
              {item.secondary && (
                <div className="editor-secondary">{item.secondary}</div>
              )}
            </div>
            {item.tag && <span className="tag">{item.tag}</span>}
            <button
              type="button"
              className="editor-remove"
              aria-label={`Remove ${item.primary}`}
              onClick={() => onRemove(item.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="editor-add">
          {fields.map((f, i) => (
            <input
              key={f.key}
              className="input"
              value={values[f.key] ?? ""}
              placeholder={f.placeholder}
              autoFocus={i === 0}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") setAdding(false);
              }}
            />
          ))}
          {select && (
            <div className="chip-row">
              {select.options.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  selected={selected === o.value}
                  onSelect={() =>
                    setValues((v) => ({ ...v, [select.key]: o.value }))
                  }
                />
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="textbtn"
              onClick={submit}
            >
              Add
            </button>
            <button
              type="button"
              className="textbtn is-muted"
              onClick={() => {
                setValues({});
                setAdding(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="editor-add">
          <button
            type="button"
            className="textbtn editor-addbtn"
            onClick={() => setAdding(true)}
          >
            + {addLabel}
          </button>
        </div>
      )}
    </Card>
  );
}
