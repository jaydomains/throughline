// Session view — sessions rail + boards split by item type + slide-in detail panel.

const ItemCard = ({ item, onClick, selected }) => {
  return (
    <div className={`item ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className="title">{item.title}</div>
      <div className="meta">
        <span className="id">{item.id}</span>
        {item.anchor && <span className="anchor">{item.anchor}</span>}
        {item.tags.slice(0, 3).map(t => <span key={t} className="tag">{t}</span>)}
        <span style={{ flex: 1 }} />
        {item.stale_days && <span className="flag-stale" title={`Stale ${item.stale_days}d`}>⚑</span>}
        {item.drift_tier && (
          <span className={`flag-drift t${item.drift_tier}`} title={item.drift_reason}>↯</span>
        )}
        {item.pr && <span className="mono faint" style={{ fontSize: 10 }}>#{item.pr.number}</span>}
      </div>
    </div>
  );
};

const DetailPanel = ({ item, onClose, allItems, onNavItem }) => {
  React.useEffect(() => {
    const onKey = (e) => {
      if (!item) return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const idx = allItems.findIndex(x => x.id === item.id);
        if (idx < 0) return;
        e.preventDefault();
        const next = e.key === 'ArrowDown' ? (idx + 1) % allItems.length : (idx - 1 + allItems.length) % allItems.length;
        onNavItem(allItems[next]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, allItems]);

  return (
    <>
      <div className={`panel-backdrop ${item ? 'open' : ''}`} onClick={onClose} />
      <div className={`detail-panel ${item ? 'open' : ''}`}>
        {item && (
          <>
            <div className="detail-h">
              <div className="top">
                <span className="id mono">{item.id}</span>
                <span className="pill ghost mono" style={{ fontSize: 10 }}>{item.type}</span>
                <span className={`pill ${
                  item.status === 'done' ? 'ok' :
                  item.status === 'blocked' ? 'warn' :
                  item.status === 'in_progress' ? 'accent' :
                  item.status === 'locked' ? 'accent' :
                  ''}`}>{item.status.replace('_', ' ')}</span>
                {item.stale_days && <span className="pill warn">⚑ stale {item.stale_days}d</span>}
                {item.drift_tier && <span className="pill warn">↯ drift t{item.drift_tier}</span>}
                <span style={{ flex: 1 }} />
                <button className="btn ghost" onClick={onClose} aria-label="close"><Icon name="x" size={12} /></button>
              </div>
              <div className="title">{item.title}</div>
              <div className="meta">
                {item.anchor && <span className="anchor-chip">{item.anchor}</span>}
                {item.tags.map(t => <span key={t} className="tag">{t}</span>)}
              </div>
            </div>
            <div className="detail-body">
              {/* Description */}
              <div className="detail-section">
                <span className="h3">Description</span>
                <div className="detail-md">{item.description}</div>
              </div>

              {/* Methodology context */}
              <div className="detail-section">
                <span className="h3">Methodology context</span>
                <div className="detail-row"><span className="label">primary unit</span><span className="value mono">{item.primary_unit || '—'}</span></div>
                <div className="detail-row"><span className="label">phase</span><span className="value mono">{item.phase || '—'}</span></div>
                <div className="detail-row"><span className="label">anchor</span><span className="value mono">{item.anchor || '—'}</span></div>
                <div className="detail-row"><span className="label">cites</span><span className="value mono">T-D38, C-D9, §7.{Math.floor(Math.random()*20)+1}</span></div>
              </div>

              {/* Blockers */}
              {(item.blocker_text || item.blockers.length > 0) && (
                <div className="detail-section">
                  <span className="h3">Blockers</span>
                  {item.blocker_text && <div className="value" style={{ fontSize: 13, color: 'var(--warn)' }}>↳ {item.blocker_text}</div>}
                  {item.blockers.map(b => (
                    <div key={b.id} className="detail-row"><span className="label">blocked by</span>
                      <span className="value"><span className="mono" style={{ color: 'var(--accent)' }}>{b.id}</span> · {b.title}</span></div>
                  ))}
                </div>
              )}

              {/* Git */}
              <div className="detail-section">
                <span className="h3">Git</span>
                <div className="detail-row"><span className="label">branch</span><span className="value mono">{item.branch || '—'}</span></div>
                {item.pr && (
                  <div className="detail-row"><span className="label">pr</span>
                    <span className="value mono">
                      #{item.pr.number} · <span style={{ color: item.pr.state === 'merged' ? 'var(--ok)' : 'var(--accent)' }}>{item.pr.state}</span>
                    </span></div>
                )}
                <div className="detail-row"><span className="label">sessions</span>
                  <span className="value mono">{item.sessions.map(s => SESSIONS.find(x => x.id === s)?.name).join(' · ') || '—'}</span></div>
              </div>

              {/* Code refs */}
              {item.code_refs.length > 0 && (
                <div className="detail-section">
                  <span className="h3">Code references · semble</span>
                  {item.code_refs.map((c, i) => (
                    <div key={i} className="detail-row"><span className="label">{c.sym}</span>
                      <span className="value mono" style={{ fontSize: 11 }}>{c.path}:{c.line}</span></div>
                  ))}
                </div>
              )}

              {/* Audit */}
              <div className="detail-section">
                <span className="h3">Activity · audit history</span>
                <div className="detail-audit">
                  {(item.audit || []).map((a, i) => (
                    <div key={i} className="audit-row">
                      <span className="when">{a.when}</span>
                      <span className="actor">{a.actor}</span>
                      <span className="field">
                        <code>{a.what}</code>
                        {a.from && <> · <span className="faint">{a.from}</span> → <span style={{ color: 'var(--ok)' }}>{a.to}</span></>}
                        {!a.from && a.to && <> · {a.to}</>}
                        {a.pr && <span className="mono faint"> · pr#{a.pr}</span>}
                      </span>
                    </div>
                  ))}
                  {item.audit.length === 0 && <div className="muted" style={{ fontSize: 12 }}>No mutations recorded.</div>}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

const SessionScreen = ({ direction, openItem, onItem, onCloseItem }) => {
  const [activeSession, setActiveSession] = React.useState('s1');
  const session = SESSIONS.find(s => s.id === activeSession);
  const sessionItems = ITEMS.filter(i => i.sessions.includes(activeSession));

  const todos = sessionItems.filter(i => i.type === 'todo');
  const decisions = sessionItems.filter(i => i.type === 'decision');
  const todoCols = {
    todo:       todos.filter(i => i.status === 'todo'),
    in_progress: todos.filter(i => i.status === 'in_progress'),
    blocked:    todos.filter(i => i.status === 'blocked'),
    done:       todos.filter(i => i.status === 'done'),
  };
  const decisionCols = {
    open:       decisions.filter(i => i.status === 'open'),
    locked:     decisions.filter(i => i.status === 'locked'),
    superseded: decisions.filter(i => i.status === 'superseded'),
  };

  return (
    <div className="session-shell">
      <aside className="sessions-rail">
        <div className="eyebrow" style={{ marginBottom: 10, paddingLeft: 6 }}>Sessions · {SESSIONS.length}</div>
        {SESSIONS.map(s => (
          <div key={s.id} className={`session-link ${activeSession === s.id ? 'active' : ''}`}
               onClick={() => setActiveSession(s.id)}>
            <div className="name">{s.name}</div>
            <div className="meta">
              <span>{s.open} open</span>
              {s.pr_state && <span>· pr <span style={{ color: s.pr_state === 'merged' ? 'var(--ok)' : s.pr_state === 'review' ? 'var(--accent)' : 'var(--warn)' }}>{s.pr_state}</span></span>}
              {s.branch && <span>· {s.branch}</span>}
            </div>
          </div>
        ))}
        <hr className="rule" />
        <button className="btn ghost" style={{ width: '100%', justifyContent: 'center' }}>+ new session</button>
      </aside>

      <div className="session-main">
        <div className="session-header">
          <div>
            <div className="eyebrow">Session · {session.id}</div>
            <h1 className="h1" style={{ marginTop: 4 }}>{session.name}</h1>
            <div className="branch" style={{ marginTop: 6 }}>
              ⌥ {session.open} open · {todos.length} todos · {decisions.length} decisions
              {session.branch && <> · branch <span style={{ color: 'var(--fg)' }}>{session.branch}</span></>}
            </div>
          </div>
          <div className="session-toolbar">
            <button className="btn ghost"><Icon name="prompt" size={12} /> session-start</button>
            <button className="btn ghost"><Icon name="note" size={12} /> retro</button>
            <button className="btn primary">+ item</button>
          </div>
        </div>

        {/* TODOS BOARD */}
        <div className="board">
          <div className="board-h">
            <h3 className="h3">Todos</h3>
            <span className="count mono">{todos.length}</span>
          </div>
          <div className="board-cols">
            {[
              ['todo',        'open',        'open'],
              ['in_progress', 'in progress', 'progress'],
              ['blocked',     'blocked',     'blocked'],
              ['done',        'done',        'done'],
            ].map(([k, label, dot]) => (
              <div key={k} className="board-col">
                <div className="board-col-h">
                  <span className={`dot ${dot}`} />
                  <span>{label}</span>
                  <span style={{ flex: 1 }} />
                  <span className="count">{todoCols[k].length}</span>
                </div>
                {todoCols[k].map(it => (
                  <ItemCard key={it.id} item={it} selected={openItem && openItem.id === it.id} onClick={() => onItem(it)} />
                ))}
                {todoCols[k].length === 0 && <div className="muted" style={{ fontSize: 11, padding: '6px 4px' }}>—</div>}
              </div>
            ))}
          </div>
        </div>

        {/* DECISIONS BOARD */}
        {decisions.length > 0 && (
          <div className="board">
            <div className="board-h">
              <h3 className="h3">Decisions</h3>
              <span className="count mono">{decisions.length}</span>
            </div>
            <div className="board-cols">
              {[
                ['open',        'open',       'open'],
                ['locked',      'locked',     'locked'],
                ['superseded',  'superseded', 'superseded'],
              ].map(([k, label, dot]) => (
                <div key={k} className="board-col">
                  <div className="board-col-h">
                    <span className={`dot ${dot}`} />
                    <span>{label}</span>
                    <span style={{ flex: 1 }} />
                    <span className="count">{decisionCols[k].length}</span>
                  </div>
                  {decisionCols[k].map(it => (
                    <ItemCard key={it.id} item={it} selected={openItem && openItem.id === it.id} onClick={() => onItem(it)} />
                  ))}
                  {decisionCols[k].length === 0 && <div className="muted" style={{ fontSize: 11, padding: '6px 4px' }}>—</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Capture link */}
        <div style={{ marginTop: 28, padding: '14px 18px', border: '1px dashed var(--hairline)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Icon name="note" size={14} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--fg)' }}>Capture into this session</div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
              Paste a Claude Code transcript, drop a `.md`, or speak. AI extracts items + classifies against {PROJECT.bundle_id}; nothing lands without review.
            </div>
          </div>
          <button className="btn">Open dump zone →</button>
        </div>
      </div>

      <DetailPanel item={openItem} onClose={onCloseItem} allItems={sessionItems} onNavItem={onItem} />
    </div>
  );
};

Object.assign(window, { SessionScreen, DetailPanel, ItemCard });
