import { buildCoverUrl } from '../api';

interface JacketProps {
  songInfoUrl: string;
  imageName: string | null;
  title: string;
}

export function Jacket({ songInfoUrl, imageName, title }: JacketProps) {
  if (!imageName) {
    return <div className="jacket fallback">{title.slice(0, 1).toUpperCase()}</div>;
  }

  return (
    <img
      className="jacket"
      loading="lazy"
      src={buildCoverUrl(songInfoUrl, imageName)}
      alt={`${title} jacket`}
      referrerPolicy="no-referrer"
    />
  );
}
