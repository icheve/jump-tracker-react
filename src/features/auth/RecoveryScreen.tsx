import { useState } from 'react';
import { useApp } from '../../store/AppStore';
import { ruErr } from '../../lib/utils';

/** Форма нового пароля — открывается по ссылке «восстановить пароль» из письма */
export function RecoveryScreen() {
  const app = useApp();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr('');
    if (pw.length < 6) return setErr('Минимум 6 символов');
    setBusy(true);
    const e = await app.updatePassword(pw);
    setBusy(false);
    if (e) setErr(ruErr(e));
  }

  return (
    <main>
      <div className="card" style={{ marginTop: 24 }}>
        <h3>Придумай новый пароль</h3>
        <label>Новый пароль (минимум 6 символов)</label>
        <input type="password" autoComplete="new-password" value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }} />
        {err && <div style={{ color: 'var(--warn)', fontSize: 13, marginTop: 8 }}>{err}</div>}
        <button className="btn wide" disabled={busy} onClick={() => void submit()}>
          {busy ? '…' : 'Сохранить и войти'}
        </button>
      </div>
    </main>
  );
}
