import { useState } from 'react';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  ariaLabel?: string;
  testId?: string;
}

// Lightweight tag chips editor — Enter adds, × removes, no duplicates.
// First used by Phase 6a library editor; the item detail panel still uses its inline
// add-tag form, but future passes can reuse this component for consistency.
export function TagChipsEditor({
  tags,
  onChange,
  placeholder = 'add tag…',
  ariaLabel = 'Add tag',
  testId,
}: Props) {
  const [draft, setDraft] = useState('');
  function addCurrent() {
    const t = draft.trim();
    if (t.length === 0) return;
    if (tags.includes(t)) {
      setDraft('');
      return;
    }
    onChange([...tags, t]);
    setDraft('');
  }
  return (
    <div className="tag-list" data-testid={testId}>
      {tags.map((t) => (
        <span key={t} className="tag removable">
          {t}{' '}
          <button
            type="button"
            aria-label={`Remove tag ${t}`}
            onClick={() => onChange(tags.filter((x) => x !== t))}
          >
            ×
          </button>
        </span>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addCurrent();
        }}
        style={{ display: 'inline' }}
      >
        <input
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={addCurrent}
          style={{ minWidth: 80, padding: '2px 6px' }}
        />
      </form>
    </div>
  );
}
