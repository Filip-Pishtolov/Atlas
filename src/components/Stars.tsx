export default function Stars({
  rating,
  count,
  showValue = true,
}: {
  rating: number | null;
  count?: number;
  showValue?: boolean;
}) {
  if (rating === null || rating === undefined) {
    return <span className="muted" style={{ fontSize: '0.86rem' }}>No reviews yet</span>;
  }

  const rounded = Math.round(rating);
  const label = `${rating.toFixed(1)} out of 5`;

  return (
    <span className="rating">
      <span className="stars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={i <= rounded ? undefined : 'stars-empty'}>
            ★
          </span>
        ))}
      </span>
      <span className="sr-only">{label}</span>
      {showValue && (
        <span className="tabular" aria-hidden="true">
          {rating.toFixed(1)}
        </span>
      )}
      {typeof count === 'number' && count > 0 && (
        <span className="muted" aria-hidden="true">
          ({count})
        </span>
      )}
    </span>
  );
}
