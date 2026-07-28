import { useCallback, useEffect, useState } from 'react';
import { useApp } from './store/AppStore';
import { AuthScreen } from './features/auth/AuthScreen';
import { RecoveryScreen } from './features/auth/RecoveryScreen';
import { ProgramTab } from './features/program/ProgramTab';
import { WorkoutTab } from './features/workout/WorkoutTab';
import { MetricsTab } from './features/metrics/MetricsTab';
import { StatsTab } from './features/stats/StatsTab';
import { StudentsTab } from './features/students/StudentsTab';
import { SettingsTab } from './features/settings/SettingsTab';
import { RestTimer } from './components/RestTimer';

type Tab = 'prog' | 'wo' | 'meas' | 'stat' | 'stud' | 'set';

export function App() {
  const app = useApp();
  const [tab, setTab] = useState<Tab>('prog');
  const [head, setHeadState] = useState({ t: 'Jump Tracker', s: '' });

  const setHead = useCallback((t: string, s = '') => setHeadState({ t, s }), []);
  useEffect(() => { window.scrollTo(0, 0); }, [tab]);

  if (!app.ready) {
    return <main><div className="card mut" style={{ marginTop: 24 }}>Загрузка…</div></main>;
  }
  if (app.recovery) return <RecoveryScreen />;
  if (app.cloud && !app.session) return <AuthScreen />;

  const tabs: [Tab, string, string][] = [
    ['prog', '📋', 'Программа'],
    ['wo', '🏋️', 'Тренировка'],
    ['meas', '📏', 'Замеры'],
    ['stat', '📈', 'Прогресс'],
    ...(app.isStaff ? [['stud', '👥', 'Ученики'] as [Tab, string, string]] : []),
    ['set', '⚙️', 'Ещё'],
  ];

  return (
    <>
      <header><h1>{head.t}</h1><span className="mut">{head.s}</span></header>

      <main>
        {app.viewing && (
          <div className="card viewbar">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>👤 <b>{app.viewing.name}</b> — режим тренера</div>
              <button className="btn sm sec"
                onClick={() => { void app.exitViewing(); setTab('stud'); }}>✕ Выйти</button>
            </div>
          </div>
        )}

        {tab === 'prog' && <ProgramTab setHead={setHead} goWorkout={() => setTab('wo')} />}
        {tab === 'wo' && <WorkoutTab setHead={setHead} goStats={() => setTab('stat')} goProgram={() => setTab('prog')} />}
        {tab === 'meas' && <MetricsTab setHead={setHead} />}
        {tab === 'stat' && <StatsTab setHead={setHead} />}
        {tab === 'stud' && app.isStaff && <StudentsTab setHead={setHead} goProgram={() => setTab('prog')} />}
        {tab === 'set' && <SettingsTab setHead={setHead} />}
      </main>

      {tab === 'wo' && app.aw && !app.viewing && <RestTimer />}

      <nav className="tabs">
        {tabs.map(([id, icon, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <span>{icon}</span>{label}
          </button>
        ))}
      </nav>

      <div className={`toast ${app.toastMsg ? 'show' : ''}`}>{app.toastMsg}</div>
    </>
  );
}
