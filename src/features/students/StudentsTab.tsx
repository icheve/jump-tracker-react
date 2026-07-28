import { useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore';
import { Sheet } from '../../components/Sheet';
import { fmtD, roleName, today } from '../../lib/utils';
import type { Profile } from '../../types';

export function StudentsTab({ setHead, goProgram }:
  { setHead: (t: string, s?: string) => void; goProgram: () => void }) {
  const app = useApp();
  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<Profile | null>(null);
  const [role, setRole] = useState('free');
  const [paid, setPaid] = useState('');
  const [opening, setOpening] = useState(false);

  useEffect(() => { setHead('Ученики'); }, [setHead]);
  useEffect(() => {
    void app.loadStudents().then((s) => { setStudents(s); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const f = filter.toLowerCase();
  const list = students.filter((p) =>
    (p.name ?? '').toLowerCase().includes(f) || (p.email ?? '').toLowerCase().includes(f));

  function openStudent(p: Profile) {
    setOpen(p); setRole(p.role); setPaid(p.paid_until ?? '');
  }

  async function save() {
    if (!open) return;
    const err = await app.updateStudent(open.id, role, paid || null);
    if (err) { alert(`Ошибка: ${err}`); return; }
    setStudents(students.map((s) => (s.id === open.id ? { ...s, role: role as Profile['role'], paid_until: paid || null } : s)));
    setOpen(null);
    app.toast('Сохранено ✓');
  }

  async function view() {
    if (!open) return;
    setOpening(true);
    const err = await app.viewStudent(open);
    setOpening(false);
    if (err) { alert(err); return; }
    setOpen(null);
    goProgram();
  }

  const roles = ['free', 'paid', ...(app.me?.role === 'admin' ? ['trainer', 'admin'] : [])];

  return (
    <>
      <input placeholder="🔍 поиск по имени или email..." value={filter}
        onChange={(e) => setFilter(e.target.value)} style={{ marginBottom: 10 }} />

      {loading && <div className="card mut">Загрузка…</div>}
      {!loading && list.length === 0 && <div className="card mut">Никого не найдено</div>}

      {list.map((p) => {
        const exp = p.role === 'paid' && !!p.paid_until && p.paid_until < today();
        return (
          <div key={p.id} className="card" style={{ cursor: 'pointer' }} onClick={() => openStudent(p)}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div><h3>{p.name || 'Без имени'}</h3><div className="mut">{p.email ?? ''}</div></div>
              <span className={`chip ${p.role === 'paid' && !exp ? 'on' : ''}`}
                style={exp ? { borderColor: 'var(--warn)', color: 'var(--warn)' } : undefined}>
                {roleName(p.role)}
                {p.role === 'paid' && p.paid_until ? `${exp ? ' истекла ' : ' до '}${fmtD(p.paid_until)}` : ''}
              </span>
            </div>
          </div>
        );
      })}

      {open && (
        <Sheet onClose={() => setOpen(null)}>
          <h3>{open.name || 'Без имени'}</h3>
          <div className="mut">{open.email ?? ''} · сейчас: {roleName(open.role)}</div>
          <label>Роль</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}
          </select>
          <label>Подписка оплачена до</label>
          <input type="date" value={paid} onChange={(e) => setPaid(e.target.value)} />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" onClick={() => void save()}>Сохранить</button>
            <button className="btn sec" disabled={opening} onClick={() => void view()}>
              {opening ? 'Загрузка…' : '📋 Открыть данные'}
            </button>
            <button className="btn sec" onClick={() => setOpen(null)}>Отмена</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
