import type { Settings, WorkoutLog } from '../types';

/** Локальная календарная дата пользователя, без сдвига в UTC около полуночи. */
export const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

/** 2026-07-06 → 06.07.26 */
export const fmtD = (d: string) => {
  const p = String(d).split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0].slice(2)}` : d;
};

/** Интенсивность «60-70%» + 1ПМ → «≈45–52.5 кг» (округление до 2.5 кг). '' если не применимо */
export function pctKg(intensity: string, rm: number | undefined): string {
  if (!rm) return '';
  const m = String(intensity).match(/^(\d+)(?:-(\d+))?%$/);
  if (!m) return '';
  const f = (v: number) => Math.round((v * rm) / 100 / 2.5) * 2.5;
  const lo = f(+m[1]);
  const hi = m[2] ? f(+m[2]) : null;
  return `≈${lo}${hi && hi !== lo ? `–${hi}` : ''} кг`;
}

/** Последнее выполнение упражнения (учитывая варианты через " / ") */
export function lastFor(logs: WorkoutLog[], name: string) {
  const vars = name.split(' / ');
  for (let i = logs.length - 1; i >= 0; i--) {
    const f = logs[i].ex.find((e) => e.n === name || vars.includes(e.n));
    if (f && f.sets.length) return { date: logs[i].date, sets: f.sets };
  }
  return null;
}

export function normSettings(s: unknown): Settings {
  const o = (s && typeof s === 'object' ? s : {}) as Partial<Settings>;
  return {
    customMetrics: Array.isArray(o.customMetrics) ? o.customMetrics : [],
    rm: o.rm && typeof o.rm === 'object' ? o.rm : {},
  };
}

export function ruErr(m: string): string {
  if (/invalid login/i.test(m)) return 'Неверный email или пароль';
  if (/already registered/i.test(m)) return 'Такой email уже зарегистрирован';
  if (/at least 6/i.test(m)) return 'Пароль должен быть не короче 6 символов';
  if (/valid email/i.test(m)) return 'Некорректный email';
  if (/rate limit/i.test(m)) return 'Слишком много попыток, подожди минуту';
  return m;
}

export const roleName = (r: string) =>
  ({ admin: 'админ', trainer: 'тренер', paid: 'подписка', free: 'бесплатный' }[r] ?? r);

export const deepCopy = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
