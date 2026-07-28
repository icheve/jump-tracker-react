import type { ReactNode } from 'react';

/** Нижняя шторка (аналог модалки из старой версии) */
export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="box">{children}</div>
    </div>
  );
}
