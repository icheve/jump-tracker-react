interface VideoButtonProps {
  url: string;
  label: string;
}

/** Видео открываются только по исходным внешним ссылкам. */
export function VideoButton({ url, label }: VideoButtonProps) {
  return (
    <a className="vbtn" href={url} target="_blank" rel="noopener noreferrer">
      ▶ {label} ↗
    </a>
  );
}
