import { useMemo, useRef, useState } from 'react';
import { Sheet } from './Sheet';

interface VideoButtonProps {
  url: string;
  label: string;
}

interface ResolvedVideo {
  kind: 'file' | 'youtube';
  src: string;
  optimized: boolean;
}

const VIDEO_RELEASE = 'https://github.com/icheve/jump-tracker-react/releases/download/videos-v1';
const LINK_ONLY_YANDEX_IDS = new Set([
  'I4op0LLx-cdKCQ',
  '8VCPLkBKcIhm9A',
  'gq5U67ua1c4SIg',
  'HbHMGUZG7ehTmA',
  'BRBB1pIR2DiNeg',
  'UEf7IU7-yi1LhA',
  '1piwfy9N8JZBmg',
]);

function youtubeEmbed(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    let id = '';

    if (host === 'youtu.be') id = parsed.pathname.split('/').filter(Boolean)[0] ?? '';
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      id = parsed.searchParams.get('v') ?? '';
      if (!id) {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts[0] === 'shorts' || parts[0] === 'embed') id = parts[1] ?? '';
      }
    }

    return /^[\w-]{6,}$/.test(id)
      ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`
      : null;
  } catch {
    return null;
  }
}

function yandexVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host !== 'disk.yandex.ru' && host !== 'disk.yandex.com' && host !== 'yadi.sk') return null;
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? null;
  } catch {
    return null;
  }
}

function resolveVideo(url: string): ResolvedVideo {
  const youtube = youtubeEmbed(url);
  if (youtube) return { kind: 'youtube', src: youtube, optimized: false };

  const yandexId = yandexVideoId(url);
  if (yandexId) {
    return {
      kind: 'file',
      src: `${VIDEO_RELEASE}/${encodeURIComponent(yandexId)}.mp4`,
      optimized: true,
    };
  }

  return { kind: 'file', src: url, optimized: false };
}

async function yandexDirectVideo(url: string): Promise<string> {
  const endpoint = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(url)}`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`Яндекс Диск вернул ${response.status}`);
  const data = await response.json() as { href?: unknown };
  if (typeof data.href !== 'string' || !data.href) {
    throw new Error('Яндекс Диск не вернул адрес видео');
  }
  return data.href;
}

function VideoPlayer({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const resolved = useMemo(() => resolveVideo(url), [url]);
  const [playerSrc, setPlayerSrc] = useState(resolved.src);
  const [sourceMode, setSourceMode] = useState<'optimized' | 'direct' | 'original'>(
    resolved.optimized ? 'optimized' : 'original',
  );
  const directAttempted = useRef(false);

  async function handleFileError() {
    if (resolved.optimized && sourceMode === 'optimized' && !directAttempted.current) {
      directAttempted.current = true;
      setFallbackLoading(true);
      try {
        const directUrl = await yandexDirectVideo(url);
        setPlayerSrc(directUrl);
        setSourceMode('direct');
        setAttempt((value) => value + 1);
        setFallbackLoading(false);
        return;
      } catch {
        setFallbackLoading(false);
        setError('Подготовленная копия ещё недоступна, а прямой поток получить не удалось.');
        return;
      }
    }

    setFallbackLoading(false);
    setError(sourceMode === 'direct'
      ? 'Браузер не смог воспроизвести исходный формат видео.'
      : 'Не удалось загрузить видео.');
  }

  function retry() {
    setError('');
    setFallbackLoading(false);
    directAttempted.current = false;
    setPlayerSrc(resolved.src);
    setSourceMode(resolved.optimized ? 'optimized' : 'original');
    setAttempt((value) => value + 1);
  }

  return (
    <Sheet onClose={onClose}>
      <div className="video-title">{title}</div>

      {resolved.kind === 'youtube' && !error && (
        <div className="video-frame">
          <iframe
            key={attempt}
            src={resolved.src}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {resolved.kind === 'file' && !error && !fallbackLoading && (
        <video
          key={attempt}
          className="video-player"
          src={playerSrc}
          controls
          controlsList="nodownload"
          playsInline
          preload="metadata"
          onError={() => { void handleFileError(); }}
        >
          Ваш браузер не поддерживает воспроизведение видео.
        </video>
      )}

      {fallbackLoading && (
        <div className="video-error" aria-live="polite">
          <b>Подготовленная копия ещё не готова</b>
          <div className="mut">Пробую открыть исходное видео с Яндекс.Диска…</div>
        </div>
      )}

      {error && (
        <div className="video-error" aria-live="polite">
          <b>Видео не открылось</b>
          <div className="mut">{error}</div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn sm" type="button" onClick={retry}>
              Повторить
            </button>
            <a className="btn sm sec" href={url} target="_blank" rel="noopener noreferrer">
              Открыть оригинал
            </a>
          </div>
        </div>
      )}

      {resolved.kind === 'youtube' && (
        <div className="mut video-hint">Видео воспроизводится через YouTube.</div>
      )}
      {resolved.optimized && sourceMode === 'optimized' && (
        <div className="mut video-hint">
          Оптимизированная H.264-копия открывается прямо в приложении.
        </div>
      )}
      {sourceMode === 'direct' && !error && (
        <div className="mut video-hint">
          Открыт оригинал с Яндекс.Диска. На некоторых устройствах формат HEVC может не поддерживаться.
        </div>
      )}
    </Sheet>
  );
}

export function VideoButton({ url, label }: VideoButtonProps) {
  const [open, setOpen] = useState(false);
  const yandexId = yandexVideoId(url);

  if (yandexId && LINK_ONLY_YANDEX_IDS.has(yandexId)) {
    return (
      <a className="vbtn" href={url} target="_blank" rel="noopener noreferrer">
        ▶ {label} ↗
      </a>
    );
  }

  return (
    <>
      <button className="vbtn" type="button" onClick={() => setOpen(true)}>▶ {label}</button>
      {open && <VideoPlayer url={url} title={label} onClose={() => setOpen(false)} />}
    </>
  );
}
