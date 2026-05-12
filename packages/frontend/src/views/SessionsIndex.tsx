import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useSessions } from '../hooks/useSessions.js';

export function SessionsIndex() {
  const { id } = useParams();
  const projectId = id ?? null;
  const navigate = useNavigate();
  const { sessions, refresh } = useSessions(projectId);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!projectId || name.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.createSession(projectId, { name: name.trim() });
      setName('');
      refresh();
      navigate(`/projects/${projectId}/sessions/${r.session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!projectId) return null;

  return (
    <div className="sessions-index" data-testid="sessions-index">
      <h1>Sessions</h1>
      <form
        className="session-create"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <input
          aria-label="New session name"
          placeholder="New session name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
        <button type="submit" disabled={busy || name.trim().length === 0}>
          Create session
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <ul className="session-list">
        {sessions.length === 0 && <li className="empty">No sessions yet. Create one above.</li>}
        {sessions.map((s) => (
          <li key={s.id}>
            <Link to={`/projects/${projectId}/sessions/${s.id}`}>{s.name}</Link>
            {s.branch_ref && <span className="muted"> · {s.branch_ref}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
