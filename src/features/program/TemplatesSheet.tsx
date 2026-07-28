import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { useApp } from '../../store/AppStore';
import { sb } from '../../lib/supabase';
import { DEFAULT_PROGRAM } from '../../data/program';
import { deepCopy } from '../../lib/utils';
import type { Day, Template } from '../../types';

/** Библиотека шаблонов: свои/общие из Supabase + встроенная базовая программа */
export function TemplatesSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [tpls, setTpls] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!sb || !app.session) { setLoading(false); return; }
    const r = await sb.from('templates').select('*').order('created_at', { ascending: false });
    if (r.error) console.error(r.error); else setTpls((r.data ?? []) as Template[]);
    setLoading(false);
  }
  useEffect(() => { void load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  function addDay(day: Day, msg = 'День добавлен ✓') {
    app.saveProgram([...app.prog, deepCopy(day)]);
    app.toast(msg);
    onClose();
  }

  async function removeTpl(t: Template) {
    if (!sb) return;
    if (!confirm(`Удалить шаблон «${t.title}» из библиотеки?`)) return;
    const r = await sb.from('templates').delete().eq('id', t.id);
    if (r.error) { alert(`Ошибка: ${r.error.message}`); return; }
    void load();
  }

  const myId = app.session?.user.id;

  return (
    <Sheet onClose={onClose}>
      <h3>Шаблоны дней</h3>
      <p className="mut" style={{ margin: '4px 0 10px' }}>
        Нажми на день, чтобы добавить его {app.viewing ? 'ученику' : 'себе'}
      </p>

      {loading && <div className="mut" style={{ padding: '20px 0' }}>Загрузка шаблонов…</div>}

      {tpls.length > 0 && (<>
        <h2 className="sect" style={{ marginTop: 6 }}>Библиотека</h2>
        {tpls.map((t) => (
          <div key={t.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => addDay(t.day)}>
                <h3>{t.title}</h3>
                <div className="mut">{t.subtitle ?? ''}{t.shared ? ' · общий' : ' · личный'}</div>
              </div>
              <span className="big acc">{t.day?.e?.length ?? 0}</span>
              {(t.owner === myId || app.me?.role === 'admin') && (
                <button className="btn sm danger" onClick={() => void removeTpl(t)}>✕</button>
              )}
            </div>
          </div>
        ))}
      </>)}

      <h2 className="sect" style={{ marginTop: 6 }}>Базовая программа «Вертикальный прыжок»</h2>
      {DEFAULT_PROGRAM.map((d, i) => (
        <div key={i} className="card" style={{ cursor: 'pointer' }} onClick={() => addDay(d)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div><h3>{d.t}</h3><div className="mut">{d.s}</div></div>
            <span className="big acc">{d.e.length}</span>
          </div>
        </div>
      ))}
      <button className="btn wide" onClick={() => {
        app.saveProgram([...app.prog, ...deepCopy(DEFAULT_PROGRAM)]);
        app.toast(`${DEFAULT_PROGRAM.length} дней добавлены ✓`);
        onClose();
      }}>
        Добавить все {DEFAULT_PROGRAM.length} базовых дней
      </button>
      <button className="btn sec wide" onClick={onClose}>Закрыть</button>
    </Sheet>
  );
}
