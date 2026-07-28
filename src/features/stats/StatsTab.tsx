import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip,
} from 'chart.js';
import { useApp } from '../../store/AppStore';
import { BASE_METR } from '../../data/program';
import { fmtD } from '../../lib/utils';
import { Sheet } from '../../components/Sheet';
import type { WorkoutLog } from '../../types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const chartOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#8b93a5' }, grid: { color: '#2c3342' } },
    y: { ticks: { color: '#8b93a5' }, grid: { color: '#2c3342' } },
  },
} as const;

const lineData = (labels: string[], values: number[], color: string, bg: string) => ({
  labels,
  datasets: [{ data: values, borderColor: color, backgroundColor: bg, fill: true, tension: 0.3, pointRadius: 4 }],
});

export function StatsTab({ setHead }: { setHead: (t: string, s?: string) => void }) {
  const app = useApp();
  const M: [string, string][] = [...BASE_METR, ...app.settings.customMetrics.map((m) => [m.k, m.n] as [string, string])];

  const [metr, setMetr] = useState('jumpst');
  const [period, setPeriod] = useState(0);
  const [logOpen, setLogOpen] = useState<WorkoutLog | null>(null);

  const exNames = [...new Set(app.logs.flatMap((l) => l.ex.map((x) => x.n)))];
  const [ex, setEx] = useState('');
  const exSel = exNames.includes(ex) ? ex : (exNames[0] ?? '');

  useEffect(() => {
    setHead('Прогресс', app.viewing ? `ученик: ${app.viewing.name}` : '');
  }, [app.viewing, setHead]);

  const metrKey = M.find(([k]) => k === metr) ? metr : M[0][0];
  const cutoff = period ? new Date(Date.now() - period * 864e5).toISOString().slice(0, 10) : '';

  const pts = app.metrics
    .filter((e) => e[metrKey] != null && String(e.d) >= cutoff)
    .sort((a, b) => String(a.d).localeCompare(String(b.d)));

  const exPts = app.logs
    .filter((l) => l.date >= cutoff)
    .map((l) => {
      const x = l.ex.find((x) => x.n === exSel);
      if (!x) return null;
      const mx = Math.max(...x.sets.map((s) => parseFloat(String(s.w).replace(',', '.')) || 0));
      return mx > 0 ? { d: l.date, v: mx } : null;
    })
    .filter((p): p is { d: string; v: number } => p !== null);

  return (
    <>
      <h2 className="sect" style={{ marginTop: 0 }}>Показатели</h2>
      <div className="chips">
        {M.map(([k, label]) => (
          <span key={k} className={`chip ${metrKey === k ? 'on' : ''}`} onClick={() => setMetr(k)}>
            {label.split(',')[0]}
          </span>
        ))}
      </div>
      <div className="chips">
        {([[0, 'Всё время'], [30, 'Месяц'], [90, '3 месяца']] as const).map(([p, label]) => (
          <span key={p} className={`chip ${period === p ? 'on' : ''}`} onClick={() => setPeriod(p)}>{label}</span>
        ))}
      </div>
      <div style={{ height: 230 }}>
        <Line options={chartOpts}
          data={lineData(pts.map((p) => fmtD(String(p.d))), pts.map((p) => Number(p[metrKey])), '#4ade80', 'rgba(74,222,128,.15)')} />
      </div>

      {exNames.length > 0 && (<>
        <h2 className="sect">Рабочий вес в упражнении</h2>
        <select value={exSel} onChange={(e) => setEx(e.target.value)}>
          {exNames.map((n) => <option key={n}>{n}</option>)}
        </select>
        <div style={{ height: 210, marginTop: 8 }}>
          <Line options={chartOpts}
            data={lineData(exPts.map((p) => fmtD(p.d)), exPts.map((p) => p.v), '#60a5fa', 'rgba(96,165,250,.15)')} />
        </div>
      </>)}

      <h2 className="sect">Журнал тренировок ({app.logs.length})</h2>
      {app.logs.length === 0 && <div className="card mut">Тренировок пока нет</div>}
      {[...app.logs].reverse().map((l) => (
        <div key={l.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setLogOpen(l)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <h3>{l.dayTitle}</h3>
              <div className="mut">{fmtD(l.date)} · {l.dur} мин · {l.ex.length} упр.</div>
            </div>
            {!app.viewing && (
              <button className="btn sm danger" onClick={(e) => {
                e.stopPropagation();
                if (confirm('Удалить тренировку из журнала?')) app.deleteLog(l.id);
              }}>✕</button>
            )}
          </div>
        </div>
      ))}

      {logOpen && (
        <Sheet onClose={() => setLogOpen(null)}>
          <h3>{logOpen.dayTitle}</h3>
          <div className="mut" style={{ marginBottom: 10 }}>{fmtD(logOpen.date)} · {logOpen.dur} мин</div>
          {logOpen.ex.map((x, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div className="exname">{x.n}</div>
              <div className="mut">
                {x.sets.map((s) => `${s.w ? `${s.w} кг` : '—'} × ${s.r || '—'}${s.done ? ' ✓' : ''}`).join(' · ')}
              </div>
              {x.unote && <div className="mut">📝 {x.unote}</div>}
            </div>
          ))}
          <button className="btn sec wide" onClick={() => setLogOpen(null)}>Закрыть</button>
        </Sheet>
      )}
    </>
  );
}
