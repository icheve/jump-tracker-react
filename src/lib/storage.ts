/** Обёртка над localStorage. Ключи те же, что в старой версии (vjt_<uid>_<имя>),
 *  поэтому кэш совместим между старым и новым приложением. */
export const LS = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      /* Переполнение/приватный режим — вызывающий код должен предупредить пользователя. */
      return false;
    }
  },
};

export const lsKey = (uid: string, name: string) => `vjt_${uid}_${name}`;
