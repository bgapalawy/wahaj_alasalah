/**
 * Animated ring spinner. Deliberately NOT a percentage readout — this app
 * doesn't get incremental progress updates from a single request/response
 * API call, so a "%" number here would have to be fake. A spinning ring
 * honestly says "working" without inventing a number that isn't real.
 */
export function LoadingRing({ size = 22, label }) {
  return (
    <span className="loading-ring-wrap">
      <svg
        className="loading-ring"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-label={label ?? "Loading"}
        role="status"
      >
        <circle cx="12" cy="12" r="9" stroke="var(--color-border)" strokeWidth="3" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="var(--color-primary)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label && <span className="loading-ring-label">{label}</span>}
    </span>
  );
}
