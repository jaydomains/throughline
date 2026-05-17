// THROUGHLINE wordmark — direction-specific treatment.
// A: Geometric sans, hairline rule running through (the literal "through-line")
// B: Editorial italic serif w/ small-caps subline
// C: Terminal prompt with blinking cursor

const Wordmark = ({ direction }) => {
  if (direction === 'A') {
    return (
      <div className="wordmark">
        <span className="glyph">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M2 5.5h7" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5.5 2v7" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />
          </svg>
        </span>
        <span className="wm-a">THROUGHLINE</span>
      </div>
    );
  }
  if (direction === 'B') {
    return (
      <div className="wordmark">
        <span className="wm-b">
          <span>Throughline</span>
          <span className="sub">No. 01 · Phase 15</span>
        </span>
      </div>
    );
  }
  // C — terminal
  return (
    <div className="wordmark">
      <span className="wm-c">
        <span className="prompt">$</span>
        <span>throughline</span>
        <span className="cursor"></span>
      </span>
    </div>
  );
};

window.Wordmark = Wordmark;
