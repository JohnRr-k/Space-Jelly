'use client';

export default function CertLink({ id, label }: { id: string; label: string }) {
  return (
    <button
      type="button"
      className="ulink cert-link"
      aria-haspopup="dialog"
      aria-label={`View certificate: ${label}`}
      onClick={() => window.dispatchEvent(new CustomEvent('open-cert', { detail: id }))}
    >
      View certificate
    </button>
  );
}
