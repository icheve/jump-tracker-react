import { useEffect, type ReactNode } from 'react';

/** Нижняя шторка (аналог модалки из старой версии) */
export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      className="modal"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="box" role="dialog" aria-modal="true">
        <div className="sheet-head">
          <button className="sheet-close" type="button" aria-label="Закрыть" onClick={onClose}>✕</button>
        </div>
        <div className="sheet-scroll">{children}</div>
      </div>
    </div>
  );
}
