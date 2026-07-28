import { useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore';
import { BASE_METR } from '../../data/program';
import { fmtD, today } from '../../lib/utils';
import type { Measurement } from '../../types';

export function MetricsTab({ setHead }: { setHead: (t: string, s?: string) => void }) {
  const app = useApp();
  const [d, setD] = useState(today());
  const [vals, setVals] = useState<Record<string, string>>({});

  useEffect(() => {
    setHead('Замеры', app.viewing ? `ученик: ${app.viewing.name}` : 'отслеживание формы');
  }, [app.viewing, setHead]);

  const M: [string, string][] = [...BASE_METR, ...app.settings.customMetrics.map((m) => [m.k, m.n] as [string, string])];

  function save() {
    const e: Measurement = { id: Date.now(), d: d || today() };
    let any = false;
    for (const [k] of M) {
      const v = (vals[k] ?? '').trim().replace(',', '.');
      if (v !== '' && !Number.isNaN(+v)) { e[k] = +v; any = true; }
    }
    if (!any) { alert('Введи хотя бы один показатель'); return; }
    app.addMetric(e);
    setVals({});
  }

  const sorted = [...app.metrics].sort((a, b) => String(b.d).localeCompare(String(a.d)));

  return (
    <>
      {!app.viewing && (
        <div className="card">
          <label>Дата</label>
          <input type="date" value={d} onChange={(e) => setD(e.target.value)} />
          <div className="grid2">
            {M.map(([k, label]) => (
              <div key={k}>
                <label>{label}</label>
                <input inputMode="decimal" placeholder="—" value={vals[k] ?? ''}
                  onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <button className="btn wide" onClick={save}>Сохранить замер</button>
        </div>
      )}

      <h2 className="sect">История</h2>
      {sorted.length === 0 ? (
        <div className="card mut">Замеров пока нет</div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                {M.map(([k, label]) => <th key={k}>{label.split(',')[0]}</th>)}
                {!app.viewing && <th />}
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.id}>
                  <td>{fmtD(String(e.d))}</td>
                  {M.map(([k]) => <td key={k}>{e[k] ?? '—'}</td>)}
                  {!app.viewing && (
                    <td>
                      <button className="btn sm danger"
                        onClick={() => { if (confirm('Удалить замер?')) app.deleteMetric(e.id); }}>✕</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
