import { useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore';
import { TRAINER_CONTACT } from '../../lib/config';
import { DayView } from './DayView';
import { TemplatesSheet } from './TemplatesSheet';

export function ProgramTab({ setHead, goWorkout }: { setHead: (t: string, s?: string) => void; goWorkout: () => void }) {
  const app = useApp();
  const [dayOpen, setDayOpen] = useState<number | null>(null);
  const [tplOpen, setTplOpen] = useState(false);

  useEffect(() => {
    if (dayOpen === null) {
      setHead('Программа', app.viewing ? `ученик: ${app.viewing.name}` : `${app.prog.length} дн.`);
    }
  }, [dayOpen, app.prog.length, app.viewing, setHead]);

  if (dayOpen !== null && app.prog[dayOpen]) {
    return <DayView dayIdx={dayOpen} setHead={setHead} onBack={() => setDayOpen(null)} goWorkout={goWorkout} />;
  }

  const showCta = app.me?.role === 'free' && !app.viewing;

  return (
    <>
      {showCta && (
        <div className="card" style={{ borderColor: 'var(--acc)' }}>
          <h3>🎯 Личное ведение тренера</h3>
          <p className="mut" style={{ margin: '6px 0' }}>
            По подписке: индивидуальная программа для роста вертикального прыжка, видео техники каждого
            упражнения, контроль и корректировки от тренера.
          </p>
          {TRAINER_CONTACT
            ? <a className="btn wide" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
                href={TRAINER_CONTACT} target="_blank" rel="noopener noreferrer">Написать тренеру</a>
            : <p className="mut">Свяжись с тренером, чтобы подключить.</p>}
        </div>
      )}

      {app.prog.map((d, i) => {
        const done = app.logs.filter((l) => l.dayIdx === i).length;
        return (
          <div key={i} className="card" style={{ cursor: 'pointer' }} onClick={() => setDayOpen(i)}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div><h3>{d.t}</h3><div className="mut">{d.s}</div></div>
              <div style={{ textAlign: 'right' }}>
                <div className="big acc">{d.e.length}</div>
                <div className="mut">упр.{done ? ` · ${done}×` : ''}</div>
              </div>
            </div>
          </div>
        );
      })}

      <button className="btn sec wide"
        onClick={() => app.saveProgram([...app.prog, { t: `День ${app.prog.length + 1}`, s: '', e: [] }])}>
        + Добавить день
      </button>
      {app.isStaff && (
        <button className="btn sec wide" onClick={() => setTplOpen(true)}>📚 День из шаблонов</button>
      )}
      {tplOpen && <TemplatesSheet onClose={() => setTplOpen(false)} />}
    </>
  );
}
