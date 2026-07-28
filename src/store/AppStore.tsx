/* Центральное состояние приложения + синхронизация localStorage ↔ Supabase.
   Логика 1:1 повторяет старый index.html, но данные меняются только через действия (actions). */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { sb } from '../lib/supabase';
import { LS, lsKey } from '../lib/storage';
import { normSettings, today, deepCopy } from '../lib/utils';
import { DEFAULT_PROGRAM } from '../data/program';
import type {
  ActiveWorkout, Day, Measurement, Profile, Settings, Viewing, WorkoutLog,
} from '../types';

interface Store {
  ready: boolean;
  cloud: boolean;               // подключён ли Supabase
  session: Session | null;
  me: Profile | null;
  viewing: Viewing | null;
  isStaff: boolean;
  prog: Day[];
  logs: WorkoutLog[];
  metrics: Measurement[];
  settings: Settings;
  aw: ActiveWorkout | null;
  toastMsg: string;

  recovery: boolean;            // пришли по ссылке «восстановить пароль»
  toast(msg: string): void;
  signIn(email: string, pw: string): Promise<string | null>;
  signUp(name: string, email: string, pw: string): Promise<string | null>;
  resetPassword(email: string): Promise<string | null>;
  updatePassword(pw: string): Promise<string | null>;
  logout(): Promise<void>;

  saveProgram(next: Day[]): void;
  resetProgram(): void;
  addLog(l: WorkoutLog): void;
  deleteLog(id: number): void;
  addMetric(m: Measurement): void;
  deleteMetric(id: number): void;
  saveSettings(next: Settings): void;
  setAw(next: ActiveWorkout | null): void;

  importAll(data: { prog: Day[]; logs: WorkoutLog[]; metrics?: Measurement[]; settings?: unknown }): Promise<string | null>;

  loadStudents(): Promise<Profile[]>;
  updateStudent(id: string, role: string, paidUntil: string | null): Promise<string | null>;
  viewStudent(p: Profile): Promise<string | null>;
  exitViewing(): Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function useApp(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useApp вне AppProvider');
  return s;
}

function seedProgram(me: Profile | null): Day[] {
  return me?.role === 'free'
    ? [{ t: 'Мой день 1', s: 'моя программа', e: [] }]
    : deepCopy(DEFAULT_PROGRAM);
}

/** Дополняет прежние полные версии программы новыми днями.
 *  Пользовательские программы и уже добавленные дни не перезаписываются. */
function upgradeLegacyProgram(days: Day[], profile: Profile | null): Day[] {
  if (profile?.role === 'free') return days;
  const legacy = DEFAULT_PROGRAM.slice(0, 17);
  const hasCompleteLegacy = legacy.every((base) => days.some((day) => day.t === base.t));
  if (!hasCompleteLegacy) return days;

  let next = days;
  const days18to23 = DEFAULT_PROGRAM.slice(17, 23);
  const hasAnyDay18to23 = days18to23.some((base) => next.some((day) => day.t === base.t));
  if (!hasAnyDay18to23) next = [...next, ...deepCopy(days18to23)];

  const hasCompletePreviousProgram = DEFAULT_PROGRAM
    .slice(0, 23)
    .every((base) => next.some((day) => day.t === base.t));
  if (!hasCompletePreviousProgram) return next;

  const missingNewDays = DEFAULT_PROGRAM
    .slice(23)
    .filter((base) => !next.some((day) => day.t === base.t));
  return missingNewDays.length ? [...next, ...deepCopy(missingNewDays)] : next;
}

/** Добавляет только отсутствующие ссылки из эталонной программы.
 *  Названия, параметры упражнений и уже заданные пользователем видео не меняются. */
function enrichProgramVideos(days: Day[]): Day[] {
  let programChanged = false;
  const next = days.map((day) => {
    const sourceDay = DEFAULT_PROGRAM.find((source) => source.t === day.t);
    if (!sourceDay) return day;

    let dayChanged = false;
    const exercises = day.e.map((exercise) => {
      const source = sourceDay.e.find((candidate) => candidate.n === exercise.n);
      if (!source) return exercise;

      const needsPrimary = !exercise.v && !!source.v;
      const needsVariants = !exercise.videos?.some(Boolean) && !!source.videos?.some(Boolean);
      if (!needsPrimary && !needsVariants) return exercise;

      dayChanged = true;
      return {
        ...exercise,
        v: needsPrimary ? source.v : exercise.v,
        videos: needsVariants ? source.videos : exercise.videos,
      };
    });

    if (!dayChanged) return day;
    programChanged = true;
    return { ...day, e: exercises };
  });
  return programChanged ? next : days;
}

/** Логируем ошибки записи в облако, не роняя интерфейс */
type CloudMutation =
  | { qid: string; kind: 'program'; userId: string; days: Day[] }
  | { qid: string; kind: 'workout-upsert'; userId: string; log: WorkoutLog }
  | { qid: string; kind: 'workout-delete'; userId: string; cid: number }
  | { qid: string; kind: 'metric-upsert'; userId: string; metric: Measurement }
  | { qid: string; kind: 'metric-delete'; userId: string; cid: number }
  | { qid: string; kind: 'settings'; userId: string; settings: Settings }
  | { qid: string; kind: 'replace-all'; userId: string; prog: Day[]; logs: WorkoutLog[]; metrics: Measurement[]; settings: Settings };
type NewCloudMutation = CloudMutation extends infer M
  ? M extends CloudMutation ? Omit<M, 'qid'> : never
  : never;

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [viewing, setViewing] = useState<Viewing | null>(null);
  const [prog, setProg] = useState<Day[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [metrics, setMetrics] = useState<Measurement[]>([]);
  const [settings, setSettings] = useState<Settings>({ customMetrics: [], rm: {} });
  const [aw, setAwState] = useState<ActiveWorkout | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [recovery, setRecovery] = useState(false);
  const toastTimer = useRef<number>();
  const flushes = useRef<Partial<Record<string, Promise<boolean>>>>({});
  const pendingTargets = useRef(new Set<string>());

  const uid = session?.user.id ?? 'anon';
  const duid = viewing?.id ?? uid; // чьи данные сейчас редактируем (тренер может открыть ученика)
  const key = (n: string) => lsKey(uid, n);
  const isStaff = !!me && (me.role === 'admin' || me.role === 'trainer');

  const pendingKey = (userId: string) => lsKey(userId, 'pending');

  async function executeMutation(m: CloudMutation): Promise<unknown | null> {
    if (!sb) return 'Supabase is not configured';
    if (m.kind === 'program') {
      const r = await sb.from('programs').upsert({ user_id: m.userId, days: m.days, updated_at: new Date().toISOString() });
      return r.error;
    }
    if (m.kind === 'workout-upsert') {
      const l = m.log;
      const r = await sb.from('workouts').upsert({ user_id: m.userId, cid: l.id, date: l.date, day_title: l.dayTitle, dur: l.dur, data: l });
      return r.error;
    }
    if (m.kind === 'workout-delete') {
      const r = await sb.from('workouts').delete().eq('user_id', m.userId).eq('cid', m.cid);
      return r.error;
    }
    if (m.kind === 'metric-upsert') {
      const x = m.metric;
      const r = await sb.from('metrics').upsert({ user_id: m.userId, cid: x.id, d: x.d, data: x });
      return r.error;
    }
    if (m.kind === 'metric-delete') {
      const r = await sb.from('metrics').delete().eq('user_id', m.userId).eq('cid', m.cid);
      return r.error;
    }
    if (m.kind === 'settings') {
      const r = await sb.from('profiles').update({ prefs: m.settings }).eq('id', m.userId);
      return r.error;
    }

    // Полное восстановление бэкапа: удаляем отсутствующие записи и затем загружаем снимок.
    const [oldWo, oldMt] = await Promise.all([
      sb.from('workouts').select('cid').eq('user_id', m.userId),
      sb.from('metrics').select('cid').eq('user_id', m.userId),
    ]);
    if (oldWo.error || oldMt.error) return oldWo.error || oldMt.error;
    const logIds = new Set(m.logs.map((x) => x.id));
    const metricIds = new Set(m.metrics.map((x) => x.id));
    const staleLogs = (oldWo.data ?? []).map((x) => Number(x.cid)).filter((id) => !logIds.has(id));
    const staleMetrics = (oldMt.data ?? []).map((x) => Number(x.cid)).filter((id) => !metricIds.has(id));

    const writes = await Promise.all([
      sb.from('programs').upsert({ user_id: m.userId, days: m.prog, updated_at: new Date().toISOString() }),
      sb.from('profiles').update({ prefs: m.settings }).eq('id', m.userId),
      ...(staleLogs.length ? [sb.from('workouts').delete().eq('user_id', m.userId).in('cid', staleLogs)] : []),
      ...(staleMetrics.length ? [sb.from('metrics').delete().eq('user_id', m.userId).in('cid', staleMetrics)] : []),
      ...(m.logs.length ? [sb.from('workouts').upsert(m.logs.map((l) => ({ user_id: m.userId, cid: l.id, date: l.date, day_title: l.dayTitle, dur: l.dur, data: l })))] : []),
      ...(m.metrics.length ? [sb.from('metrics').upsert(m.metrics.map((x) => ({ user_id: m.userId, cid: x.id, d: x.d, data: x })))] : []),
    ]);
    return writes.find((r) => r.error)?.error ?? null;
  }

  function flushPending(userId: string): Promise<boolean> {
    if (!sb) return Promise.resolve(false);
    if (flushes.current[userId]) return flushes.current[userId];
    const task = (async () => {
      while (true) {
        const queue = LS.get<CloudMutation[]>(pendingKey(userId), []);
        const first = queue[0];
        if (!first) {
          pendingTargets.current.delete(userId);
          return true;
        }
        let error: unknown | null;
        try {
          error = await executeMutation(first);
        } catch (e) {
          console.error(e);
          return false;
        }
        if (error) { console.error(error); return false; }
        const latest = LS.get<CloudMutation[]>(pendingKey(userId), []);
        if (!LS.set(pendingKey(userId), latest.filter((x) => x.qid !== first.qid))) {
          return false;
        }
      }
    })().finally(() => { delete flushes.current[userId]; });
    flushes.current[userId] = task;
    return task;
  }

  function queueMutation(m: NewCloudMutation) {
    if (!sb) return;
    pendingTargets.current.add(m.userId);
    const item = { ...m, qid: `${Date.now()}-${crypto.randomUUID()}` } as CloudMutation;
    let queue = LS.get<CloudMutation[]>(pendingKey(m.userId), []);
    if (m.kind === 'replace-all') queue = [];
    if (m.kind === 'program' || m.kind === 'settings') {
      queue = queue.filter((x) => x.kind !== m.kind);
    }
    if (!LS.set(pendingKey(m.userId), [...queue, item])) {
      void executeMutation(item)
        .then((error) => {
          if (error) {
            console.error(error);
            toast('⚠ Изменение не сохранено: хранилище браузера недоступно');
          }
        })
        .catch((error) => {
          console.error(error);
          toast('⚠ Изменение не сохранено: хранилище браузера недоступно');
        });
      return;
    }
    void flushPending(m.userId).then((ok) => { if (!ok) toast('⚠ Изменения сохранены локально и ждут синхронизации'); });
  }

  function toast(msg: string) {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 2500);
  }

  function cacheLocal(name: string, value: unknown) {
    if (!LS.set(key(name), value)) {
      toast('⚠ Не удалось сохранить данные на устройстве');
      return false;
    }
    return true;
  }

  /* ---------- локальный кэш ---------- */
  function loadLocalFor(userId: string, profile: Profile | null) {
    const k = (n: string) => lsKey(userId, n);
    const cachedProgram = LS.get<Day[] | null>(k('program'), null) ?? (sb ? [] : seedProgram(profile));
    const upgradedProgram = upgradeLegacyProgram(cachedProgram, profile);
    setProg(upgradedProgram);
    if (!sb && upgradedProgram !== cachedProgram) LS.set(k('program'), upgradedProgram);
    setLogs(LS.get(k('logs'), []));
    setMetrics(LS.get(k('metrics'), []));
    setSettings(normSettings(LS.get(k('settings'), null)));
    setAwState(LS.get(k('active'), null));
  }

  /* ---------- загрузка своих данных из облака ---------- */
  async function loadCloudOwn(s: Session) {
    if (!sb) return;
    const userId = s.user.id;
    const k = (n: string) => lsKey(userId, n);

    // Сначала отправляем накопленные офлайн-изменения. Пока они не ушли,
    // облачный снимок нельзя загружать поверх локального.
    const pending = LS.get<CloudMutation[]>(pendingKey(userId), []);
    if (pending.length && !(await flushPending(userId))) {
      toast('⚠ Нет связи с сервером — изменения сохранены на устройстве');
      return;
    }

    const p = await sb.from('profiles').select('*').eq('id', userId).single();
    if (p.error) { toast('⚠ Не удалось загрузить профиль'); console.error(p.error); return; }
    const profile = p.data as Profile;
    setMe(profile);
    const st = normSettings(profile.prefs);
    setSettings(st);

    const pr = await sb.from('programs').select('days').eq('user_id', userId).maybeSingle();
    let days: Day[];
    if (pr.error) {
      console.error(pr.error);
      toast('⚠ Программа не загружена — оставлена локальная копия');
      days = LS.get<Day[]>(k('program'), seedProgram(profile));
    } else if (pr.data && Array.isArray(pr.data.days) && pr.data.days.length) {
      days = pr.data.days as Day[];
    } else {
      days = seedProgram(profile);
      queueMutation({ kind: 'program', userId, days });
    }
    const upgradedDays = upgradeLegacyProgram(days, profile);
    const addedDays = upgradedDays !== days;
    const enrichedDays = enrichProgramVideos(upgradedDays);
    if (enrichedDays !== days) {
      days = enrichedDays;
      queueMutation({ kind: 'program', userId, days });
      toast(addedDays ? 'Программа обновлена ✓' : 'Ссылки на видео добавлены ✓');
    }
    setProg(days);

    const wo = await sb.from('workouts').select('data').eq('user_id', userId);
    const lg = wo.error
      ? LS.get<WorkoutLog[]>(k('logs'), [])
      : ((wo.data ?? []) as { data: WorkoutLog }[]).map((r) => r.data).sort((a, b) => a.id - b.id);
    if (wo.error) { console.error(wo.error); toast('⚠ Журнал не загружен — оставлена локальная копия'); }
    setLogs(lg);

    const mt = await sb.from('metrics').select('data').eq('user_id', userId);
    const ms = mt.error
      ? LS.get<Measurement[]>(k('metrics'), [])
      : ((mt.data ?? []) as { data: Measurement }[]).map((r) => r.data).sort((a, b) => a.id - b.id);
    if (mt.error) { console.error(mt.error); toast('⚠ Замеры не загружены — оставлена локальная копия'); }
    setMetrics(ms);

    const cached = [
      LS.set(k('program'), days), LS.set(k('logs'), lg),
      LS.set(k('metrics'), ms), LS.set(k('settings'), st),
    ];
    if (cached.some((ok) => !ok)) toast('⚠ Облачные данные загружены, но локальный кэш недоступен');
  }

  /* ---------- старт ---------- */
  useEffect(() => {
    let authSubscription: { unsubscribe(): void } | undefined;
    const syncWhenOnline = () => {
      if (!sb) return;
      void sb.auth.getSession()
        .then(({ data }) => {
          if (!data.session) return;
          const targets = new Set([data.session.user.id, ...pendingTargets.current]);
          void Promise.all([...targets].map((userId) => flushPending(userId))).then((results) => {
            if (results.some((ok) => !ok)) toast('⚠ Не все изменения удалось синхронизировать');
          });
        })
        .catch((error) => {
          console.error(error);
          toast('⚠ Не удалось возобновить синхронизацию');
        });
    };

    (async () => {
      if (sb) {
        // ссылка «восстановить пароль» из письма приводит сюда с событием PASSWORD_RECOVERY
        const listener = sb.auth.onAuthStateChange((e, s2) => {
          setSession(s2);
          if (!s2) {
            setMe(null); setViewing(null); setAwState(null);
            setProg([]); setLogs([]); setMetrics([]);
            setSettings({ customMetrics: [], rm: {} });
          }
          if (e === 'PASSWORD_RECOVERY') setRecovery(true);
        });
        authSubscription = listener.data.subscription;
        window.addEventListener('online', syncWhenOnline);
        try {
          const { data } = await sb.auth.getSession();
          if (data.session) {
            setSession(data.session);
            loadLocalFor(data.session.user.id, null); // мгновенно из кэша
            setReady(true);
            try { await loadCloudOwn(data.session); }
            catch (e) { console.error(e); toast('⚠ Нет связи с сервером — работаю из кэша'); }
            return;
          }
        } catch (e) { console.error(e); }
      } else {
        loadLocalFor('anon', null);
      }
      setReady(true);
    })();
    return () => {
      authSubscription?.unsubscribe();
      window.removeEventListener('online', syncWhenOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- авторизация ---------- */
  async function signIn(email: string, pw: string): Promise<string | null> {
    if (!sb) return 'Облако не настроено';
    const r = await sb.auth.signInWithPassword({ email, password: pw });
    if (r.error) return r.error.message;
    if (!r.data.session) return 'Подтверди почту по ссылке из письма, затем войди';
    setSession(r.data.session);
    loadLocalFor(r.data.session.user.id, null);
    await loadCloudOwn(r.data.session);
    return null;
  }

  async function signUp(name: string, email: string, pw: string): Promise<string | null> {
    if (!sb) return 'Облако не настроено';
    const r = await sb.auth.signUp({ email, password: pw, options: { data: { name } } });
    if (r.error) return r.error.message;
    if (!r.data.session) return 'Подтверди почту по ссылке из письма, затем войди';
    setSession(r.data.session);
    loadLocalFor(r.data.session.user.id, null);
    await loadCloudOwn(r.data.session);
    return null;
  }

  async function resetPassword(email: string): Promise<string | null> {
    if (!sb) return 'Облако не настроено';
    const r = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname,
    });
    return r.error ? r.error.message : null;
  }

  async function updatePassword(pw: string): Promise<string | null> {
    if (!sb) return 'Облако не настроено';
    const r = await sb.auth.updateUser({ password: pw });
    if (r.error) return r.error.message;
    const { data } = await sb.auth.getSession();
    if (data.session) {
      setSession(data.session);
      loadLocalFor(data.session.user.id, null);
      try { await loadCloudOwn(data.session); } catch (e) { console.error(e); }
    }
    setRecovery(false);
    toast('Пароль обновлён ✓');
    return null;
  }

  async function logout() {
    if (sb) await sb.auth.signOut();
    setSession(null); setMe(null); setViewing(null); setAwState(null);
    setProg([]); setLogs([]); setMetrics([]);
    setSettings({ customMetrics: [], rm: {} });
  }

  /* ---------- программа ---------- */
  function saveProgram(next: Day[]) {
    setProg(next);
    if (!viewing) cacheLocal('program', next);
    if (sb && session) queueMutation({ kind: 'program', userId: duid, days: next });
  }
  function resetProgram() { saveProgram(seedProgram(me)); }

  /* ---------- журнал ---------- */
  function addLog(l: WorkoutLog) {
    const next = [...logs, l];
    setLogs(next);
    if (!viewing) cacheLocal('logs', next);
    if (sb && session) queueMutation({ kind: 'workout-upsert', userId: duid, log: l });
  }
  function deleteLog(id: number) {
    const next = logs.filter((l) => l.id !== id);
    setLogs(next);
    if (!viewing) cacheLocal('logs', next);
    if (sb && session) queueMutation({ kind: 'workout-delete', userId: duid, cid: id });
  }

  /* ---------- замеры ---------- */
  function addMetric(m: Measurement) {
    const next = [...metrics, m];
    setMetrics(next);
    if (!viewing) cacheLocal('metrics', next);
    if (sb && session) queueMutation({ kind: 'metric-upsert', userId: duid, metric: m });
  }
  function deleteMetric(id: number) {
    const next = metrics.filter((m) => m.id !== id);
    setMetrics(next);
    if (!viewing) cacheLocal('metrics', next);
    if (sb && session) queueMutation({ kind: 'metric-delete', userId: duid, cid: id });
  }

  /* ---------- настройки ---------- */
  function saveSettings(next: Settings) {
    setSettings(next);
    if (!viewing) cacheLocal('settings', next);
    if (sb && session) queueMutation({ kind: 'settings', userId: duid, settings: next });
  }

  /* ---------- активная тренировка ---------- */
  function setAw(next: ActiveWorkout | null) {
    setAwState(next);
    cacheLocal('active', next);
  }

  /* ---------- импорт бэкапа ---------- */
  async function importAll(data: { prog: Day[]; logs: WorkoutLog[]; metrics?: Measurement[]; settings?: unknown }): Promise<string | null> {
    const nextSettings = normSettings(data.settings);
    setProg(data.prog);
    const lg = data.logs ?? [];
    const ms = data.metrics ?? [];
    setLogs(lg); setMetrics(ms);
    setSettings(nextSettings);
    if (!viewing) {
      cacheLocal('program', data.prog); cacheLocal('logs', lg);
      cacheLocal('metrics', ms); cacheLocal('settings', nextSettings);
    }
    if (sb && session) {
      queueMutation({ kind: 'replace-all', userId: duid, prog: data.prog, logs: lg, metrics: ms, settings: nextSettings });
      return (await flushPending(duid)) ? null : 'Данные сохранены локально, но облако пока недоступно';
    }
    return null;
  }

  /* ---------- тренерский режим ---------- */
  async function loadStudents(): Promise<Profile[]> {
    if (!sb) return [];
    const r = await sb.from('profiles').select('*').order('created_at');
    if (r.error) { console.error(r.error); return []; }
    return (r.data as Profile[]).filter((p) => p.id !== uid);
  }

  async function updateStudent(id: string, role: string, paidUntil: string | null): Promise<string | null> {
    if (!sb) return 'Облако не настроено';
    const r = await sb.from('profiles').update({ role, paid_until: paidUntil }).eq('id', id);
    return r.error ? r.error.message : null;
  }

  async function viewStudent(p: Profile): Promise<string | null> {
    if (!sb) return 'Облако не настроено';

    const pending = LS.get<CloudMutation[]>(pendingKey(p.id), []);
    if (pending.length && !(await flushPending(p.id))) {
      return 'Не удалось отправить предыдущие изменения ученика. Проверь соединение и повтори.';
    }

    let result;
    try {
      result = await Promise.all([
        sb.from('programs').select('days').eq('user_id', p.id).maybeSingle(),
        sb.from('workouts').select('data').eq('user_id', p.id),
        sb.from('metrics').select('data').eq('user_id', p.id),
      ]);
    } catch (error) {
      console.error(error);
      return 'Не удалось загрузить данные ученика. Локальные данные не были заменены.';
    }
    const [pr, wo, mt] = result;
    const error = pr.error || wo.error || mt.error;
    if (error) {
      console.error(error);
      return 'Не удалось загрузить данные ученика. Локальные данные не были заменены.';
    }

    const loadedDays = pr.data && Array.isArray(pr.data.days) && pr.data.days.length
      ? (pr.data.days as Day[])
      : [{ t: 'День 1', s: 'программа от тренера', e: [] }];
    const days = enrichProgramVideos(upgradeLegacyProgram(loadedDays, p));
    if (days !== loadedDays) queueMutation({ kind: 'program', userId: p.id, days });
    const studentLogs = ((wo.data ?? []) as { data: WorkoutLog }[]).map((r) => r.data).sort((a, b) => a.id - b.id);
    const studentMetrics = ((mt.data ?? []) as { data: Measurement }[]).map((r) => r.data).sort((a, b) => a.id - b.id);

    setViewing({ id: p.id, name: p.name || p.email || 'ученик' });
    setProg(days);
    setLogs(studentLogs);
    setMetrics(studentMetrics);
    setSettings(normSettings(p.prefs));
    return null;
  }

  async function exitViewing() {
    setViewing(null);
    loadLocalFor(uid, me);
    if (session) {
      try { await loadCloudOwn(session); } catch (e) { console.error(e); }
    }
  }

  const store: Store = {
    ready, cloud: !!sb, session, me, viewing, isStaff,
    prog, logs, metrics, settings, aw, toastMsg, recovery,
    toast, signIn, signUp, resetPassword, updatePassword, logout,
    saveProgram, resetProgram, addLog, deleteLog, addMetric, deleteMetric,
    saveSettings, setAw, importAll,
    loadStudents, updateStudent, viewStudent, exitViewing,
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

/** Завершение тренировки: активная → запись журнала */
export function buildLog(aw: ActiveWorkout): WorkoutLog {
  return {
    id: Date.now(),
    date: today(),
    dayIdx: aw.dayIdx,
    dayTitle: aw.dayTitle,
    dur: Math.round((Date.now() - aw.start) / 60000),
    ex: aw.ex
      .map((x) => ({
        n: x.n.split(' / ')[x.variant] || x.n,
        unote: x.unote,
        sets: x.rows.filter((r) => r.done || r.w || r.r).map((r) => ({ w: r.w, r: r.r, done: r.done })),
      }))
      .filter((x) => x.sets.length),
  };
}
