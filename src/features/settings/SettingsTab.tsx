import { useEffect, useRef } from 'react';
import { useApp } from '../../store/AppStore';
import { fmtD, roleName, today } from '../../lib/utils';
import { parseBackup } from '../../lib/backup';

export function SettingsTab({ setHead }: { setHead: (t: string, s?: string) => void }) {
  const app = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHead('Ещё', app.viewing ? `ученик: ${app.viewing.name}` : 'настройки и данные');
  }, [app.viewing, setHead]);

  /** Упражнения с процентной интенсивностью — для них есть смысл указывать 1ПМ */
  const rmNames = [...new Set(
    app.prog.flatMap((d) => d.e.filter((x) => x.s.some((g) => /^\d+(-\d+)?%$/.test(g[2] ?? ''))).map((x) => x.n)),
  )];

  function setRm(name: string, value: string) {
    const v = parseFloat(value.replace(',', '.'));
    const rm = { ...app.settings.rm };
    if (v > 0) rm[name] = v; else delete rm[name];
    app.saveSettings({ ...app.settings, rm });
  }

  function addCustomMetric() {
    const n = prompt('Название показателя (с единицей, напр. «Обхват бедра, см»)');
    if (!n) return;
    app.saveSettings({
      ...app.settings,
      customMetrics: [...app.settings.customMetrics, { k: `c${Date.now()}`, n }],
    });
  }

  function delCustomMetric(i: number) {
    if (!confirm('Удалить показатель? (значения в истории останутся, но перестанут показываться)')) return;
    app.saveSettings({
      ...app.settings,
      customMetrics: app.settings.customMetrics.filter((_, j) => j !== i),
    });
  }

  function exportData() {
    const blob = new Blob(
      [JSON.stringify({ prog: app.prog, logs: app.logs, metrics: app.metrics, settings: app.settings }, null, 1)],
      { type: 'application/json' },
    );
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `jump-tracker-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file: File) {
    const r = new FileReader();
    r.onload = async () => {
      try {
        const d = parseBackup(String(r.result));
        const target = app.viewing ? `ученика «${app.viewing.name}»` : 'текущие данные';
        if (!confirm(`Полностью заменить ${target} данными из бэкапа?`)) return;
        const warning = await app.importAll(d);
        alert(warning ? `Импорт выполнен. ${warning}` : 'Импорт выполнен');
      } catch {
        alert('Не удалось прочитать файл бэкапа');
      }
    };
    r.readAsText(file);
  }

  return (
    <>
      {app.viewing && (
        <div className="card viewbar">
          Настройки, экспорт и импорт относятся к ученику <b>{app.viewing.name}</b>.
        </div>
      )}
      {app.me && (
        <div className="card">
          <h3>👤 {app.me.name || 'Профиль'}</h3>
          <div className="mut" style={{ margin: '4px 0 8px' }}>
            {app.me.email ?? ''} · {roleName(app.me.role)}
            {app.me.role === 'paid' && app.me.paid_until ? ` · подписка до ${fmtD(app.me.paid_until)}` : ''}
          </div>
          <button className="btn sec wide"
            onClick={() => { if (confirm('Выйти из аккаунта?')) void app.logout(); }}>
            Выйти из аккаунта
          </button>
        </div>
      )}

      {rmNames.length > 0 && (
        <div className="card">
          <h3>1ПМ — твои максимумы, кг</h3>
          <p className="mut" style={{ margin: '6px 0' }}>
            Укажи максимум на 1 повтор — проценты в программе будут показываться в килограммах.
          </p>
          {rmNames.map((n) => (
            <div key={n}>
              <label>{n}</label>
              <input inputMode="decimal" placeholder="—" defaultValue={app.settings.rm[n] ?? ''}
                onBlur={(e) => setRm(n, e.target.value)} />
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Свои показатели</h3>
        <p className="mut" style={{ margin: '6px 0' }}>
          Добавь свой показатель для замеров (например, «Обхват бедра, см»)
        </p>
        {app.settings.customMetrics.map((m, i) => (
          <div key={m.k} className="row" style={{ marginTop: 6, justifyContent: 'space-between' }}>
            <span>{m.n}</span>
            <button className="btn sm danger" onClick={() => delCustomMetric(i)}>✕</button>
          </div>
        ))}
        <button className="btn sec wide" onClick={addCustomMetric}>+ Показатель</button>
      </div>

      <div className="card">
        <h3>Данные</h3>
        <p className="mut" style={{ margin: '6px 0' }}>
          {app.cloud ? 'Данные синхронизируются с облаком. Бэкап всё равно не помешает.' : 'Всё хранится только на этом устройстве. Делай бэкап.'}
        </p>
        <button className="btn wide" onClick={exportData}>⬇ Экспорт (JSON-бэкап)</button>
        <button className="btn sec wide" onClick={() => fileRef.current?.click()}>⬆ Импорт из бэкапа</button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ''; }} />
      </div>

      <div className="card">
        <h3>Программа</h3>
        <button className="btn danger wide" onClick={() => {
          if (confirm('Вернуть программу к исходной? Твои правки упражнений будут потеряны (журнал и замеры останутся).'))
            app.resetProgram();
        }}>
          Сбросить программу к исходной
        </button>
      </div>

      <div className="card">
        <h3>Установка на телефон</h3>
        <p className="mut" style={{ marginTop: 6 }}>
          Открой сайт в браузере телефона: <b>iPhone</b> — Safari → Поделиться → «На экран "Домой"».{' '}
          <b>Android</b> — меню Chrome → «Добавить на главный экран».
        </p>
      </div>
    </>
  );
}
