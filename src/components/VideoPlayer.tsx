import { useMemo, useState } from 'react';
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

function VideoPlayer({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const resolved = useMemo(() => resolveVideo(url), [url]);

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

      {resolved.kind === 'file' && !error && (
        <video
          key={attempt}
          className="video-player"
          src={resolved.src}
          controls
          controlsList="nodownload"
          playsInline
          preload="metadata"
          onError={() => setError('Не удалось загрузить подготовленную версию видео.')}
        >
          Ваш браузер не поддерживает воспроизведение видео.
        </video>
      )}

      {error && (
        <div className="video-error" aria-live="polite">
          <b>Видео не открылось</b>
          <div className="mut">{error}</div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn sm" type="button" onClick={() => {
              setError('');
              setAttempt((value) => value + 1);
            }}>
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
      {resolved.optimized && (
        <div className="mut video-hint">
          Оптимизированная H.264-копия открывается прямо в приложении.
        </div>
      )}
    </Sheet>
  );
}

export function VideoButton({ url, label }: VideoButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="vbtn" type="button" onClick={() => setOpen(true)}>▶ {label}</button>
      {open && <VideoPlayer url={url} title={label} onClose={() => setOpen(false)} />}
    </>
  );
}
