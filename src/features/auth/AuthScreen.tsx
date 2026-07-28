import { useState } from 'react';
import { useApp } from '../../store/AppStore';
import { ruErr } from '../../lib/utils';

export function AuthScreen() {
  const app = useApp();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function forgot() {
    setErr(''); setInfo('');
    if (!email.trim()) return setErr('Введи email и нажми «Забыл пароль?» ещё раз');
    const e = await app.resetPassword(email.trim());
    if (e) setErr(ruErr(e));
    else setInfo('Письмо отправлено — открой ссылку из него (лучше на этом же устройстве)');
  }

  async function submit() {
    setErr(''); setInfo('');
    if (!email.trim()) return setErr('Введи email');
    if (pw.length < 6) return setErr('Пароль минимум 6 символов');
    if (mode === 'up' && !name.trim()) return setErr('Введи имя');
    setBusy(true);
    const e = mode === 'up'
      ? await app.signUp(name.trim(), email.trim(), pw)
      : await app.signIn(email.trim(), pw);
    setBusy(false);
    if (e) setErr(ruErr(e));
  }

  return (
    <main>
      <div className="card" style={{ marginTop: 24 }}>
        <div className="chips">
          <span className={`chip ${mode === 'in' ? 'on' : ''}`} onClick={() => setMode('in')}>Вход</span>
          <span className={`chip ${mode === 'up' ? 'on' : ''}`} onClick={() => setMode('up')}>Регистрация</span>
        </div>
        {mode === 'up' && (<>
          <label>Имя</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </>)}
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" />
        <label>Пароль (минимум 6 символов)</label>
        <input value={pw} onChange={(e) => setPw(e.target.value)} type="password"
          autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }} />
        {err && <div style={{ color: 'var(--warn)', fontSize: 13, marginTop: 8 }}>{err}</div>}
        {info && <div style={{ color: 'var(--acc)', fontSize: 13, marginTop: 8 }}>{info}</div>}
        <button className="btn wide" disabled={busy} onClick={() => void submit()}>
          {busy ? '…' : mode === 'up' ? 'Создать аккаунт' : 'Войти'}
        </button>
        {mode === 'in' && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <a href="#" className="mut" style={{ textDecoration: 'underline' }}
              onClick={(e) => { e.preventDefault(); void forgot(); }}>
              Забыл пароль?
            </a>
          </div>
        )}
        <p className="mut" style={{ marginTop: 12 }}>
          Тренировки для роста вертикального прыжка: программа, журнал, замеры и графики прогресса.
        </p>
      </div>
    </main>
  );
}
