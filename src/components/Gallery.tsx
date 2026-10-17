'use client';

import { useState } from 'react';

export interface GalleryImage {
  url: string;
  alt: string;
}

export default function Gallery({
  images,
  caption,
}: {
  images: GalleryImage[];
  caption?: string;
}) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) return null;

  const safeIndex = Math.min(index, images.length - 1);
  const active = images[safeIndex];

  return (
    <figure className="stack" style={{ margin: 0 }}>
      <div className="card" style={{ borderRadius: 'var(--r-lg)' }}>
        <div className="card-media" style={{ aspectRatio: '16 / 9' }}>
          <img
            src={active.url}
            alt={active.alt}
            loading="eager"
            decoding="async"
            width={1200}
            height={675}
          />
        </div>
      </div>

      {images.length > 1 && (
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
            gap: 'var(--s2)',
          }}
        >
          {images.map((image, i) => {
            const isActive = i === safeIndex;
            return (
              <button
                key={`${image.url}-${i}`}
                type="button"
                className="card"
                aria-pressed={isActive}
                aria-label={`Show photo ${i + 1} of ${images.length}: ${image.alt}`}
                onClick={() => setIndex(i)}
                style={{
                  padding: 0,
                  cursor: 'pointer',
                  borderColor: isActive ? 'var(--accent)' : undefined,
                  outline: isActive ? '1px solid var(--accent)' : 'none',
                  opacity: isActive ? 1 : 0.72,
                }}
              >
                <span className="card-media" style={{ display: 'block' }}>
                  <img
                    src={image.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={300}
                    height={200}
                  />
                </span>
              </button>
            );
          })}
        </div>
      )}

      <figcaption className="hint">
        {caption ? `${caption} · ` : ''}
        Photo {safeIndex + 1} of {images.length} — {active.alt}
      </figcaption>
    </figure>
  );
}
