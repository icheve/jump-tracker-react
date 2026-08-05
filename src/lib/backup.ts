import type { Day, Measurement, Settings, WorkoutLog } from '../types';
import { normSettings } from './utils';

export interface BackupData {
  prog: Day[];
  logs: WorkoutLog[];
  metrics: Measurement[];
  settings: Settings;
}

const obj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown): x is string => typeof x === 'string';
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function isDay(x: unknown): x is Day {
  if (!obj(x) || !str(x.t) || !str(x.s) || !Array.isArray(x.e)) return false;
  return x.e.every((e) => obj(e) && str(e.n) && str(e.v) && str(e.rest) && str(e.note)
    && (e.videos === undefined || (Array.isArray(e.videos) && e.videos.every(str)))
    && (e.block === undefined || str(e.block))
    && (e.blockRest === undefined || str(e.blockRest))
    && Array.isArray(e.s) && e.s.every((set) => Array.isArray(set) && set.length === 3
      && num(set[0]) && set[0] >= 0 && str(set[1]) && str(set[2])));
}

function isLog(x: unknown): x is WorkoutLog {
  if (!obj(x) || !num(x.id) || !str(x.date) || !num(x.dayIdx) || !str(x.dayTitle) || !num(x.dur) || !Array.isArray(x.ex)) return false;
  return x.ex.every((e) => obj(e) && str(e.n) && str(e.unote) && Array.isArray(e.sets)
    && e.sets.every((set) => obj(set) && str(set.w) && str(set.r) && typeof set.done === 'boolean'));
}

function isMetric(x: unknown): x is Measurement {
  return obj(x) && num(x.id) && str(x.d)
    && Object.values(x).every((v) => str(v) || num(v));
}

export function parseBackup(text: string): BackupData {
  const data: unknown = JSON.parse(text);
  if (!obj(data) || !Array.isArray(data.prog) || !data.prog.every(isDay)
    || !Array.isArray(data.logs) || !data.logs.every(isLog)
    || (data.metrics !== undefined && (!Array.isArray(data.metrics) || !data.metrics.every(isMetric)))) {
    throw new Error('Неверный формат бэкапа');
  }
  return {
    prog: data.prog,
    logs: data.logs,
    metrics: (data.metrics ?? []) as Measurement[],
    settings: normSettings(data.settings),
  };
}
