import { useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore';
import { sb } from '../../lib/supabase';
import { pctKg } from '../../lib/utils';
import type { Exercise } from '../../types';
import { VideoButton } from '../../components/VideoPlayer';
import { ExerciseEditor } from './ExerciseEditor';

export function DayView({ dayIdx, setHead, onBack, goWorkout }:
  { dayIdx: number; setHead: (t: string, s?: string) => void; onBack: () => void; goWorkout: () => void }) {
  const app = useApp();
  const d = app.prog[dayIdx];
  const [editIdx, setEditIdx] = useState<number | null | 'new'>(null);

  useEffect(() => { setHead(d.t, d.s); }, [d.t, d.s, setHead]);

  function rename() {
    const t = prompt('Название дня', d.t); if (t === null) return;
    const s = prompt('Подзаголовок (тип)', d.s); if (s === null) return;
    const next = app.prog.map((day, i) => (i === dayIdx ? { ...day, t, s } : day));
    app.saveProgram(next);
  }

  function removeDay() {
    if (!confirm(`Удалить ${d.t}?`)) return;
    app.saveProgram(app.prog.filter((_, i) => i !== dayIdx));
    onBack();
  }

  async function saveAsTemplate() {
    if (!sb || !app.session) { alert('Библиотека шаблонов работает только с облаком'); return; }
    if (!d.e.length) { alert('В дне нет упражнений — нечего сохранять'); return; }
    const shared = confirm('Сделать шаблон общим для всех тренеров?\n\nOK — общий · Отмена — только мой');
    const r = await sb.from('templates').insert({
      owner: app.session.user.id, title: d.t, subtitle: d.s, day: d, shared,
    });
    if (r.error) { alert(`Ошибка: ${r.error.message}`); return; }
    app.toast('Сохранено в шаблоны ✓');
  }

  function saveExercise(x: Exercise) {
    const e = editIdx === 'new' ? [...d.e, x] : d.e.map((old, j) => (j === editIdx ? x : old));
    app.saveProgram(app.prog.map((day, i) => (i === dayIdx ? { ...day, e } : day)));
    setEditIdx(null);
  }

  function startWorkout() {
    if (app.aw && !confirm('Есть незавершённая тренировка. Начать новую? Текущая будет удалена.')) return;
    app.setAw({
      dayIdx,
      dayTitle: `${d.t} · ${d.s}`,
      start: Date.now(),
      ex: d.e.map((x) => ({
        n: x.n, v: x.v, videos: x.videos, rest: x.rest, note: x.note,
        block: x.block, blockRest: x.blockRest, variant: 0, unote: '',
        rows: x.s.flatMap((g) =>
          Array.from({ length: g[0] }, () => ({ plan: g[1], int: g[2], w: '', r: '', done: false }))),
      })),
    });
    goWorkout();
  }

  function deleteExercise() {
    if (editIdx === 'new' || editIdx === null) return;
    if (!confirm('Удалить упражнение?')) return;
    const e = d.e.filter((_, j) => j !== editIdx);
    app.saveProgram(app.prog.map((day, i) => (i === dayIdx ? { ...day, e } : day)));
    setEditIdx(null);
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="btn sm sec" onClick={onBack}>← Назад</button>
        <button className="btn sm sec" onClick={rename}>✎ День</button>
        {app.isStaff && <button className="btn sm sec" onClick={() => void saveAsTemplate()}>💾 В шаблоны</button>}
        <button className="btn sm danger" onClick={removeDay}>Удалить</button>
      </div>

      {d.e.length === 0 && <div className="card mut">Упражнений пока нет — добавь ниже</div>}
      {d.e.map((x, j) => {
        const rm = app.settings.rm[x.n];
        const variants = x.n.split(' / ');
        const videos = x.videos?.length ? x.videos : (x.v ? [x.v] : []);
        const block = x.block?.trim();
        const blockStart = !!block && d.e[j - 1]?.block !== block;
        const blockEnd = !!block && d.e[j + 1]?.block !== block;
        const blockIndex = block ? d.e.slice(0, j + 1).filter((item) => item.block === block).length : 0;
        return (
          <div key={j} className={block ? 'training-block-entry' : ''}>
            {blockStart && (
              <div className="training-block-head">
                <div><b>Блок {block}</b><span>выполнять по кругу</span></div>
                {x.blockRest && <div className="mut">⏱ {x.blockRest}</div>}
              </div>
            )}
            <div className={`card ${block ? `training-block-item ${blockEnd ? 'last' : ''}` : ''}`}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="exname" style={{ flex: 1 }}>
                {block && <span className="block-code">{block}{blockIndex}</span>}{x.n}
              </div>
              <button className="btn sm sec" onClick={() => setEditIdx(j)}>✎</button>
            </div>
            <div className="setsline">
              {x.s.map((g, k) => {
                const kg = g[2] ? pctKg(g[2], rm) : '';
                return (
                  <span key={k}>
                    {k > 0 && <span> &nbsp;·&nbsp; </span>}
                    <b>{g[0]}×{g[1]}</b>{g[2] ? ` @ ${g[2]}` : ''}{kg && <span className="acc"> {kg}</span>}
                  </span>
                );
              })}
            </div>
            {(!block || x.note) && (
              <div className="mut" style={{ marginTop: 4 }}>
                {!block && <>⏱ {x.rest}</>}{!block && x.note ? ' · ' : ''}{x.note}
              </div>
            )}
            {videos.some(Boolean) && (
              <div className="row" style={{ marginTop: 8 }}>
                {videos.map((url, index) => url && (
                  <VideoButton
                    key={`${url}-${index}`}
                    url={url}
                    label={videos.length > 1 ? variants[index] ?? `Вариант ${index + 1}` : 'Видео'}
                  />
                ))}
              </div>
            )}
            </div>
          </div>
        );
      })}

      <button className="btn sec wide" onClick={() => setEditIdx('new')}>+ Упражнение</button>
      {d.e.length > 0 && !app.viewing && (
        <button className="btn wide" onClick={startWorkout}>🏋️ Начать тренировку</button>
      )}

      {editIdx !== null && (
        <ExerciseEditor
          initial={editIdx === 'new' ? null : d.e[editIdx]}
          onSave={saveExercise}
          onDelete={editIdx === 'new' ? undefined : deleteExercise}
          onClose={() => setEditIdx(null)}
        />
      )}
    </>
  );
}
