import { useEffect, useRef, useState } from 'react';

function beep() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.4, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.3);
      o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.3);
    });
  } catch { /* без звука */ }
}

/** Таймер отдыха — панель над нижней навигацией */
export function RestTimer({ workoutStart }: { workoutStart: number }) {
  const [end, setEnd] = useState<number | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const int = useRef<number>();

  useEffect(() => {
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - workoutStart) / 1000)));
    tick();
    const elapsedInterval = window.setInterval(tick, 1000);
    return () => window.clearInterval(elapsedInterval);
  }, [workoutStart]);

  useEffect(() => {
    if (end === null) { setLeft(null); return; }
    const tick = () => {
      const l = Math.ceil((end - Date.now()) / 1000);
      setLeft(l);
      if (l <= 0) {
        window.clearInterval(int.current);
        beep();
        navigator.vibrate?.([300, 150, 300, 150, 500]);
      }
    };
    tick();
    int.current = window.setInterval(tick, 250);
    return () => window.clearInterval(int.current);
  }, [end]);

  const disp = left === null ? '–:––'
    : left <= 0 ? '0:00'
    : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const elapsedDisp = [
    Math.floor(elapsed / 3600),
    Math.floor((elapsed % 3600) / 60),
    elapsed % 60,
  ].map((part) => String(part).padStart(2, '0')).join(':');

  return (
    <div className="timerbar">
      {[60, 90, 120, 180].map((s) => (
        <button key={s} className="btn sm sec" onClick={() => setEnd(Date.now() + s * 1000)}>
          {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
        </button>
      ))}
      <div className="timer-readouts">
        <div className={`tdisp ${left !== null && left <= 0 ? 'alert' : ''}`}>{disp}</div>
        <div className="workout-duration">Всего {elapsedDisp}</div>
      </div>
      <button className="btn sm danger" onClick={() => setEnd(null)}>✕</button>
    </div>
  );
}
