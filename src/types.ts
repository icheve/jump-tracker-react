/** Схема подхода: [количество подходов, повторы, интенсивность] — как в старом приложении и в БД */
export type SetScheme = [count: number, reps: string, intensity: string];

export interface Exercise {
  n: string;      // название, варианты через " / "
  v: string;      // основная/первая ссылка на видео (совместимость со старыми данными)
  videos?: string[]; // ссылки по индексам вариантов названия
  block?: string; // метка парного/кругового блока: A, B, C…
  superset?: string; // номер суперсета внутри общего блока
  blockRest?: string; // общая инструкция по отдыху внутри блока
  s: SetScheme[]; // подходы
  rest: string;   // отдых
  note: string;   // «каждая нога» и т.п.
}

export interface Day {
  t: string; // «День 1»
  s: string; // подзаголовок «ГМВ 50 + КОР + УВМ»
  e: Exercise[];
  structureVersion?: number; // версия эталонной разбивки на блоки/суперсеты
}

export interface LogSet { w: string; r: string; done: boolean }
export interface LogExercise { n: string; unote: string; sets: LogSet[] }

export interface WorkoutLog {
  id: number; // client id = Date.now(), он же cid в БД
  date: string;
  dayIdx: number;
  dayTitle: string;
  dur: number; // минуты
  ex: LogExercise[];
}

/** Замер: id, дата + произвольные числовые показатели (weight, jumpst, ...) */
export interface Measurement {
  id: number;
  d: string;
  [metric: string]: number | string;
}

export interface CustomMetric { k: string; n: string }
export interface Settings { customMetrics: CustomMetric[]; rm: Record<string, number> }

export type Role = 'admin' | 'trainer' | 'paid' | 'free';

export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  role: Role;
  paid_until: string | null;
  prefs: unknown;
  created_at?: string;
}

export interface Template {
  id: string;
  owner: string;
  title: string;
  subtitle: string | null;
  day: Day;
  shared: boolean;
  created_at: string;
}

/** Активная (незавершённая) тренировка */
export interface ActiveRow { plan: string; int: string; w: string; r: string; done: boolean }
export interface ActiveExercise {
  n: string; v: string; videos?: string[]; rest: string; note: string;
  block?: string; superset?: string; blockRest?: string;
  variant: number; unote: string; rows: ActiveRow[];
}
export interface ActiveWorkout { dayIdx: number; dayTitle: string; start: number; ex: ActiveExercise[] }

export interface Viewing { id: string; name: string }
