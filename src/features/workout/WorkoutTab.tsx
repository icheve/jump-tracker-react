import { useEffect } from 'react';
import { VideoButton } from '../../components/VideoPlayer';
import { useApp, buildLog } from '../../store/AppStore';
import { fmtD, lastFor, pctKg } from '../../lib/utils';
import type { ActiveWorkout } from '../../types';

export function WorkoutTab({ setHead, goStats, goProgram }:
  { setHead: (t: string, s?: string) => void; goStats: () => void; goProgram: () => void }) {
  const app = useApp();
  const aw = app.aw;

  useEffect(() => {
    if (!aw) { setHead('Тренировка'); return; }
    const el = Math.floor((Date.now() - aw.start) / 60000);
    setHead('Тренировка', `${aw.dayTitle} · ${el} мин`);
  }, [aw, setHead]);

  if (app.viewing) {
    return <div className="card mut">В режиме тренера тренировка недоступна — журнал ученика смотри во вкладке «Прогресс».</div>;
  }

  if (!aw) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 30 }}>
        <div style={{ fontSize: 40 }}>🏋️</div>
        <p className="mut" style={{ margin: '10px 0' }}>Нет активной тренировки</p>
        <button className="btn" onClick={goProgram}>Выбрать день</button>
      </div>
    );
  }

  /** Иммутабельное обновление активной тренировки */
  function patch(fn: (draft: ActiveWorkout) => ActiveWorkout) {
    if (app.aw) app.setAw(fn(app.aw));
  }
  const patchEx = (j: number, ex: Partial<ActiveWorkout['ex'][number]>) =>
    patch((a) => ({ ...a, ex: a.ex.map((x, i) => (i === j ? { ...x, ...ex } : x)) }));
  const patchRow = (j: number, k: number, row: Partial<ActiveWorkout['ex'][number]['rows'][number]>) =>
    patch((a) => ({
      ...a,
      ex: a.ex.map((x, i) =>
        i === j ? { ...x, rows: x.rows.map((r, m) => (m === k ? { ...r, ...row } : r)) } : x),
    }));

  function finish() {
    const log = buildLog(aw!);
    if (!log.ex.length) {
      alert('Заполни или отметь хотя бы один подход');
      return;
    }
    app.addLog(log);
    app.setAw(null);
    goStats();
  }

  function cancel() {
    if (!confirm('Удалить тренировку без сохранения?')) return;
    app.setAw(null);
  }

  return (
    <div className="workout-active">
      {aw.ex.map((x, j) => {
        const vars = x.n.split(' / ');
        const selectedVideo = x.videos?.[x.variant] || x.v;
        const videos = vars.length === 1 && x.videos?.length
          ? x.videos.filter(Boolean)
          : (selectedVideo ? [selectedVideo] : []);
        const doneCnt = x.rows.filter((r) => r.done).length;
        const prev = lastFor(app.logs, x.n);
        const rm = app.settings.rm[x.n];
        return (
          <div key={j} className="card">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="exname" style={{ flex: 1 }}>
                {vars[0]}{x.note && <span className="mut"> ({x.note})</span>}
              </div>
              <span className="mut">{doneCnt}/{x.rows.length}</span>
            </div>

            {vars.length > 1 && (
              <div className="variant-seg">
                {vars.map((v, k) => (
                  <span key={k} className={`chip ${x.variant === k ? 'on' : ''}`}
                    onClick={() => patchEx(j, { variant: k })}>{v}</span>
                ))}
              </div>
            )}

            <div className="mut">⏱ {x.rest}</div>
            {prev && (
              <div className="mut" style={{ marginTop: 4, color: 'var(--acc2)' }}>
                ↩ {fmtD(prev.date)}: {prev.sets.map((s) => `${s.w || '—'}×${s.r || '—'}`).join(', ')}
              </div>
            )}
            {videos.length > 0 && (
              <div className="row" style={{ marginTop: 6 }}>
                {videos.map((video, index) => (
                  <VideoButton
                    key={`${video}-${index}`}
                    url={video}
                    label={vars.length > 1
                      ? `Видео: ${vars[x.variant]}`
                      : videos.length > 1 ? `Видео ${index + 1}` : 'Видео'}
                  />
                ))}
              </div>
            )}

            <div className="setline" style={{ marginTop: 8 }}>
              <span className="num">#</span><span className="plan">План</span>
              <span className="plan" style={{ textAlign: 'center' }}>Вес, кг</span>
              <span className="plan" style={{ textAlign: 'center' }}>Повт.</span><span />
            </div>
            {x.rows.map((r, k) => {
              const kg = pctKg(r.int, rm);
              return (
                <div key={k} className="setline">
                  <span className="num">{k + 1}</span>
                  <span className="plan">
                    {r.plan}{r.int ? ` @ ${r.int}` : ''}{kg && <span className="acc"> {kg}</span>}
                  </span>
                  <input inputMode="decimal" value={r.w}
                    placeholder={prev?.sets[k]?.w || ''}
                    onChange={(e) => patchRow(j, k, { w: e.target.value })} />
                  <input inputMode="numeric" value={r.r}
                    placeholder={prev?.sets[k]?.r || ''}
                    onChange={(e) => patchRow(j, k, { r: e.target.value })} />
                  <button className={`done-btn ${r.done ? 'on' : ''}`}
                    onClick={() => patchRow(j, k, { done: !r.done })}>✓</button>
                </div>
              );
            })}

            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn sm sec"
                onClick={() => patchEx(j, { rows: [...x.rows, { plan: '', int: '', w: '', r: '', done: false }] })}>
                + подход
              </button>
              <input placeholder="заметка..." style={{ flex: 1, width: 'auto' }} value={x.unote}
                onChange={(e) => patchEx(j, { unote: e.target.value })} />
            </div>
          </div>
        );
      })}

      <button className="btn wide" onClick={finish}>✅ Завершить и сохранить</button>
      <button className="btn danger wide" onClick={cancel}>Отменить тренировку</button>
    </div>
  );
}
