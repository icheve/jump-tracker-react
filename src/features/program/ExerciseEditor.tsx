import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { useApp } from '../../store/AppStore';
import { knownExercises } from '../../data/program';
import type { Exercise } from '../../types';

const setsToText = (x: Exercise) =>
  x.s.map((g) => `${g[0]} × ${g[1]}${g[2] ? ` @ ${g[2]}` : ''}`).join('\n');

function parseSets(text: string): Exercise['s'] {
  const rows = text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(\d+)\s*[×xXхХ*]\s*([^@]+?)(?:\s*@\s*(.+))?$/);
    return m ? ([+m[1], m[2].trim(), (m[3] ?? '').trim()] as Exercise['s'][number]) : ([1, l, ''] as Exercise['s'][number]);
  });
  return rows.length ? rows : [[1, '10', '']];
}

export function ExerciseEditor({ initial, onSave, onDelete, onClose }:
  { initial: Exercise | null; onSave: (x: Exercise) => void; onDelete?: () => void; onClose: () => void }) {
  const app = useApp();
  const isNew = initial === null;
  const x = initial ?? { n: '', v: '', s: [[1, '10', '']] as Exercise['s'], rest: '1-2 мин', note: '' };

  const [n, setN] = useState(x.n);
  const [videos, setVideos] = useState(x.videos?.length ? x.videos.join('\n') : x.v);
  const [sets, setSets] = useState(setsToText(x));
  const [rest, setRest] = useState(x.rest);
  const [note, setNote] = useState(x.note);
  const [block, setBlock] = useState(x.block ?? '');
  const [blockRest, setBlockRest] = useState(x.blockRest ?? '');

  const known = knownExercises(app.prog);

  /** Выбрано знакомое название — подставляем видео (и для нового — подходы/отдых/заметку) */
  function autofill(name: string) {
    setN(name);
    const k = known.get(name.trim());
    if (!k) return;
    if (!videos.trim()) setVideos(k.videos?.length ? k.videos.join('\n') : k.v || '');
    if (isNew) { setSets(setsToText(k)); setRest(k.rest || ''); setNote(k.note || ''); }
  }

  return (
    <Sheet onClose={onClose}>
      <h3 style={{ marginBottom: 6 }}>{isNew ? 'Новое упражнение' : 'Упражнение'}</h3>
      <label>Название (варианты через " / ")</label>
      <input list="exlist" value={n} onChange={(e) => autofill(e.target.value)} />
      <datalist id="exlist">
        {[...known.keys()].map((name) => <option key={name} value={name} />)}
      </datalist>
      <label>Ссылки на видео — по одной строке на каждый вариант</label>
      <textarea rows={2} value={videos} onChange={(e) => setVideos(e.target.value)} placeholder="https://..." />
      <label>Подходы — по строке: колво × повторы @ интенсивность</label>
      <textarea rows={4} value={sets} onChange={(e) => setSets(e.target.value)} />
      <label>Отдых</label>
      <input value={rest} onChange={(e) => setRest(e.target.value)} />
      <label>Заметка (каждая нога/рука и т.п.)</label>
      <input value={note} onChange={(e) => setNote(e.target.value)} />
      <label>Блок (A, B, C…)</label>
      <input value={block} onChange={(e) => setBlock(e.target.value.toUpperCase())} placeholder="не указан — отдельное упражнение" />
      <label>Общий отдых блока</label>
      <input value={blockRest} onChange={(e) => setBlockRest(e.target.value)} placeholder="1 мин между упражнениями…" />
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" onClick={() => {
          const videoList = videos.split('\n').map((url) => url.trim());
          while (videoList.length && !videoList[videoList.length - 1]) videoList.pop();
          onSave({
            n: n.trim() || 'Упражнение',
            v: videoList.find(Boolean) ?? '',
            videos: videoList.length > 1 ? videoList : undefined,
            block: block.trim() || undefined,
            blockRest: blockRest.trim() || undefined,
            s: parseSets(sets), rest: rest.trim(), note: note.trim(),
          });
        }}>
          Сохранить
        </button>
        {onDelete && <button className="btn danger" onClick={onDelete}>Удалить</button>}
        <button className="btn sec" onClick={onClose}>Отмена</button>
      </div>
    </Sheet>
  );
}
