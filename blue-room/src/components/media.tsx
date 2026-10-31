import { useRef, useState } from 'react';
import { Icon } from './Icon';
import { Button, Modal, useToast } from './ui';
import { useAttachments } from '../app/hooks';
import { addAttachment, ValidationError } from '../data/repo';

/** Edit attachments for a record: add (validated) and remove. Removal only detaches; storage is cleaned on save/delete. */
export function AttachmentPicker({ value, onChange, label = 'Photos', accept = 'image/*', allowPdf = false, hint }: {
  value: string[]; onChange: (ids: string[]) => void; label?: string; accept?: string; allowPdf?: boolean; hint?: string;
}) {
  const items = useAttachments(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [viewing, setViewing] = useState<string | null>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErrors([]);
    const ids: string[] = [];
    const errs: string[] = [];
    for (const f of Array.from(files)) {
      try { ids.push((await addAttachment(f)).id); }
      catch (e) { errs.push(e instanceof ValidationError ? e.errors[0] : `Couldn’t add “${f.name}”.`); }
    }
    if (ids.length) onChange([...value, ...ids]);
    setErrors(errs);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
    if (ids.length) toast(ids.length === 1 ? 'Added 1 file' : `Added ${ids.length} files`);
  };

  return (
    <div className="field">
      <div className="label">{label}{hint && <span className="hint">{hint}</span>}</div>
      {items.length > 0 && (
        <div className="attach-grid">
          {items.map((a) => (
            <div className="attach" key={a.id}>
              {a.mime.startsWith('image/')
                ? <button type="button" onClick={() => setViewing(a.url)} style={{ all: 'unset', cursor: 'zoom-in', display: 'block', width: '100%', height: '100%' }} aria-label={`View ${a.name}`}><img src={a.url} alt={a.name} loading="lazy" /></button>
                : <a className="file" href={a.url} target="_blank" rel="noreferrer">{a.name}</a>}
              <button type="button" className="rm" aria-label={`Remove ${a.name}`} onClick={() => onChange(value.filter((id) => id !== a.id))}><Icon name="x" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="dropzone">
        <input ref={inputRef} type="file" accept={allowPdf ? `${accept},application/pdf` : accept} multiple hidden onChange={(e) => onFiles(e.target.files)} />
        <Button size="sm" icon="image" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? 'Adding…' : 'Add files'}</Button>
        <div className="tiny faint" style={{ marginTop: 6 }}>PNG, JPEG, WebP, GIF{allowPdf ? ' or PDF' : ''} · up to 15 MB each · stored privately in this browser</div>
      </div>
      {errors.map((e) => <div className="err" key={e} role="alert">{e}</div>)}
      <Lightbox src={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

export function Lightbox({ src, onClose, alt = 'Photo' }: { src: string | null; onClose: () => void; alt?: string }) {
  return (
    <Modal open={!!src} onClose={onClose} title={alt} size="lg">
      {src && <img src={src} alt={alt} style={{ width: '100%', maxHeight: '70dvh', objectFit: 'contain', borderRadius: 12 }} />}
    </Modal>
  );
}

/** Read-only gallery for detail views. */
export function AttachmentGallery({ ids, cols }: { ids: string[]; cols?: number }) {
  const items = useAttachments(ids);
  const [viewing, setViewing] = useState<{ url: string; name: string } | null>(null);
  if (!items.length) return null;
  return (
    <>
      <div className="attach-grid" style={cols ? { gridTemplateColumns: `repeat(${cols}, 1fr)` } : undefined}>
        {items.map((a) => (
          <div className="attach" key={a.id}>
            {a.mime.startsWith('image/')
              ? <button type="button" onClick={() => setViewing({ url: a.url, name: a.name })} style={{ all: 'unset', cursor: 'zoom-in', display: 'block', width: '100%', height: '100%' }} aria-label={`View ${a.name}`}><img src={a.url} alt={a.name} loading="lazy" /></button>
              : <a className="file" href={a.url} target="_blank" rel="noreferrer">{a.name}</a>}
          </div>
        ))}
      </div>
      <Lightbox src={viewing?.url ?? null} alt={viewing?.name} onClose={() => setViewing(null)} />
    </>
  );
}

/** First image of a record as a hook-free tiny component (used on cards). */
export function CoverImage({ ids, className = '', alt = '' }: { ids: string[]; className?: string; alt?: string }) {
  const items = useAttachments(ids.slice(0, 1));
  const first = items.find((i) => i.mime.startsWith('image/'));
  if (!first) return null;
  return <img className={className} src={first.url} alt={alt} loading="lazy" />;
}
