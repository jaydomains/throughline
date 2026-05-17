// Direction-specific wordmark (design handoff). Shared API across A/B/C.
// Presentational only — the caller makes it clickable (navigates home).
// The Direction-A through-line stroke is the conceptual hook of the name;
// keep it if this is ever re-drawn.

interface WordmarkProps {
  direction: 'A' | 'B' | 'C';
}

export function Wordmark({ direction }: WordmarkProps) {
  if (direction === 'B') {
    return (
      <div className="wordmark">
        <span className="wm-b">
          <span>Throughline</span>
          <span className="sub">Methodology runtime</span>
        </span>
      </div>
    );
  }
  if (direction === 'C') {
    return (
      <div className="wordmark">
        <span className="wm-c">
          <span className="prompt">$</span>
          <span>throughline</span>
          <span className="cursor" aria-hidden="true" />
        </span>
      </div>
    );
  }
  // A — geometric sans with the hairline running through it.
  return (
    <div className="wordmark">
      <span className="glyph">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
          <path d="M2 5.5h7" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5.5 2v7" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />
        </svg>
      </span>
      <span className="wm-a">THROUGHLINE</span>
    </div>
  );
}
