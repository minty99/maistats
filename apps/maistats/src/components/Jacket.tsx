import { useEffect, useState } from 'react';

import { buildCoverUrl } from '../api';

interface JacketProps {
  songInfoUrl: string;
  imageName: string | null;
  title: string;
  className?: string;
}

export function Jacket({ songInfoUrl, imageName, title, className }: JacketProps) {
  const jacketClassName = ['jacket', className].filter(Boolean).join(' ');
  const coverUrl = imageName ? buildCoverUrl(songInfoUrl, imageName) : null;
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasLoaded(false);
    setHasError(false);
  }, [coverUrl]);

  if (!imageName || hasError) {
    return <div className={`${jacketClassName} fallback`}>{title.slice(0, 1).toUpperCase()}</div>;
  }

  return (
    <div className="jacket-frame">
      {!hasLoaded ? (
        <div className={`${jacketClassName} fallback`}>{title.slice(0, 1).toUpperCase()}</div>
      ) : null}
      <img
        className={`${jacketClassName} jacket-image${hasLoaded ? ' loaded' : ''}`}
        src={coverUrl ?? undefined}
        alt={`${title} jacket`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setHasLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
}
