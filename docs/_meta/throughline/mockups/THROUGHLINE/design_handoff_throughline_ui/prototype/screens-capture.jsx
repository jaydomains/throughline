// Capture surface — the dump zone, voice, Claude Code inbox, code TODO scan,
// + the AI-proposed review modal. Per SPEC §7.6 every non-scratchpad path
// funnels through review-before-apply.

const SAMPLE_PASTE = `Wrap session — Phase 15 hygiene.

Did:
- Banned-string regex bug found + fixed in branch drift/cleanup (TL-398)
- Periodic-review buckets render — drafting AI-on toggle behaviour
- Tier-4 dedup confirmed working on 0.78 score, AI confirmation pass clean

Open:
- Need to wire up the "stale-decisions" bucket query — it currently returns 0 because the cutoff isn't being read from settings
- Cost meter showing wrong daily total — investigate, looks like the audit log isn't being summed by date in local TZ
- Stakeholder render cache invalidates too eagerly on tag edits — should it?

Decisions:
- Companion runtime: judgement steps will always show ai-handoff option even when no Anthropic key (degraded fallback)
- Drift inbox: tier-4 stale auto-dismiss confirmed at 7d
`;

const RECENT_DUMPS = [
  { kind: 'paste',     when: '17 May · 09:14', size: '2.4 kB',  source: 'session/Phase 15',     items_proposed: 4, items_landed: 3, state: 'applied' },
  { kind: 'cc-push',   when: '17 May · 08:30', size: '12.1 kB', source: 'cc_2026-05-17_0830.md', items_proposed: 7, items_landed: 7, state: 'applied' },
  { kind: 'paste',     when: '16 May · 22:14', size: '1.1 kB',  source: 'session/Drift cleanup', items_proposed: 2, items_landed: 1, state: 'applied' },
  { kind: 'md-file',   when: '16 May · 18:00', size: '8.0 kB',  source: 'phase-14-handover.md',   items_proposed: 0, items_landed: 0, state: 'library' },
  { kind: 'voice',     when: '15 May · 11:20', size: '0:42',    source: '(voice transcript)',     items_proposed: 1, items_landed: 1, state: 'applied' },
  { kind: 'todo-scan', when: '14 May · 14:08', size: '38 files', source: 'repo scan · TODO/FIXME/XXX', items_proposed: 5, items_landed: 0, state: 'reviewing' },
];

const PROPOSED_ITEMS = [
  {
    id: 'p1', type: 'todo', accept: true,
    title: 'Wire up "stale-decisions" bucket cutoff from settings',
    description: 'Currently hardcoded — buckets returns 0 for stale decisions. Read `stale_threshold_days` from settings layer instead.',
    tags: ['ui', 'perf'],
    target_session: 's1',
    primary_unit: 'periodic_review',
    confidence: 0.92,
    suggested_codeRef: 'packages/backend/src/intelligence/periodic-review.ts:84',
    clarifying: null,
  },
  {
    id: 'p2', type: 'todo', accept: true,
    title: 'Cost meter daily total — verify TZ summation',
    description: 'Audit log summation may not be local-TZ — investigate. Surfaces wrong number in header pill.',
    tags: ['perf'],
    target_session: 's1',
    primary_unit: 'cost_meter',
    confidence: 0.81,
    suggested_codeRef: 'packages/backend/src/cost/aggregate.ts',
    clarifying: 'Should the daily window be local TZ or UTC?',
  },
  {
    id: 'p3', type: 'todo', accept: true,
    title: 'Stakeholder render cache: re-evaluate tag-edit invalidation',
    description: 'Cache invalidates on every tag change — possibly too eager. Confirm against the §13 default.',
    tags: ['rag', 'audit'],
    target_session: 's5',
    primary_unit: 'stakeholder_view',
    confidence: 0.74,
    suggested_codeRef: 'packages/backend/src/intelligence/stakeholder.ts',
    clarifying: null,
  },
  {
    id: 'p4', type: 'decision', accept: true,
    title: 'Companion runtime: always show ai-handoff (degraded fallback)',
    description: 'Judgement steps will surface the "ask AI" action even when no Anthropic key is configured — falling back to a deterministic "unclear" verdict.',
    tags: ['runtime'],
    target_session: 's4',
    primary_unit: 'companion_runtime',
    confidence: 0.88,
    suggested_codeRef: null,
    clarifying: null,
  },
];

const ReviewModal = ({ open, onClose }) => {
  const [accepted, setAccepted] = React.useState(() =>
    Object.fromEntries(PROPOSED_ITEMS.map(p => [p.id, p.accept])));

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  const acceptedCount = PROPOSED_ITEMS.filter(p => accepted[p.id]).length;

  return (
    <div className="cp-backdrop open" onClick={onClose}>
      <div className="review-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="review-h">
          <div>
            <div className="eyebrow">Review before apply · sonnet · {PROJECT.bundle_id}</div>
            <h2 className="h2" style={{ marginTop: 4 }}>AI proposed 4 items</h2>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Classified against the bundle's <span className="mono" style={{ color: 'var(--fg-2)' }}>{PROJECT.bundle_id}</span> item types · 1 clarifying question
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={onClose}>Apply {acceptedCount} of {PROPOSED_ITEMS.length}</button>
          </div>
        </div>

        <div className="review-body">
          <table className="proposal-tbl">
            <thead>
              <tr>
                <th style={{ width: 28 }}></th>
                <th>Title</th>
                <th style={{ width: 90 }}>Type</th>
                <th style={{ width: 140 }}>Session</th>
                <th style={{ width: 140 }}>Primary unit</th>
                <th style={{ width: 70 }}>Conf.</th>
              </tr>
            </thead>
            <tbody>
              {PROPOSED_ITEMS.map(p => {
                const session = SESSIONS.find(s => s.id === p.target_session);
                return (
                  <React.Fragment key={p.id}>
                    <tr className={accepted[p.id] ? '' : 'rejected'}>
                      <td>
                        <input type="checkbox" checked={!!accepted[p.id]}
                               onChange={(e) => setAccepted(a => ({ ...a, [p.id]: e.target.checked }))} />
                      </td>
                      <td>
                        <div style={{ color: 'var(--fg)', fontWeight: 500 }}>{p.title}</div>
                        <div className="muted" style={{ fontSize: 11, marginTop: 3, lineHeight: 1.5 }}>{p.description}</div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                          {p.tags.map(t => <span key={t} className="tag">{t}</span>)}
                          {p.suggested_codeRef && (
                            <span className="mono faint" style={{ fontSize: 10.5 }}>
                              ↳ <span style={{ color: 'var(--accent)' }}>semble</span> · {p.suggested_codeRef}
                            </span>
                          )}
                        </div>
                      </td>
                      <td><span className="pill ghost mono">{p.type}</span></td>
                      <td className="mono" style={{ fontSize: 11 }}>{session?.name}</td>
                      <td className="mono" style={{ fontSize: 11 }}>{p.primary_unit}</td>
                      <td className="mono" style={{ fontSize: 11, color: p.confidence > 0.85 ? 'var(--ok)' : 'var(--warn)' }}>
                        {p.confidence.toFixed(2)}
                      </td>
                    </tr>
                    {p.clarifying && (
                      <tr className="clarifying-row">
                        <td></td>
                        <td colSpan={5}>
                          <div className="clarifying">
                            <span className="eyebrow" style={{ marginRight: 8 }}>clarifying ·</span>
                            {p.clarifying}
                            <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                              <button className="btn ghost" style={{ fontSize: 11, padding: '2px 8px' }}>local TZ</button>
                              <button className="btn ghost" style={{ fontSize: 11, padding: '2px 8px' }}>UTC</button>
                              <button className="btn ghost" style={{ fontSize: 11, padding: '2px 8px' }}>skip</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="review-foot">
          <span className="mono faint" style={{ fontSize: 11 }}>cost · 0.03¢ · 1,840 tokens in · 612 tokens out · prompt fingerprint a8c41…</span>
        </div>
      </div>
    </div>
  );
};

const CaptureScreen = ({ direction }) => {
  const [destination, setDestination] = React.useState('session'); // session | library
  const [text, setText] = React.useState(SAMPLE_PASTE);
  const [activeSession, setActiveSession] = React.useState('s1');
  const [review, setReview] = React.useState(false);

  return (
    <div className="view">
      <div className="eyebrow">Capture · seven surfaces · all funnel through review-before-apply (T-D5)</div>
      <h1 className="h1" style={{ marginTop: 6, marginBottom: 14, display: 'flex', alignItems: 'baseline', gap: 14 }}>
        {direction === 'B' ? 'Dump zone.' : 'Dump zone'}
        <span className="mono" style={{ fontSize: 14, color: 'var(--fg-muted)', fontWeight: 400, letterSpacing: 0 }}>
          paste · drop · voice · cc-push · todo-scan
        </span>
      </h1>

      {/* DESTINATION TOGGLE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="seg">
          <button className={`seg-btn ${destination === 'session' ? 'on' : ''}`} onClick={() => setDestination('session')}>
            <Icon name="session" size={13} /> session items
          </button>
          <button className={`seg-btn ${destination === 'library' ? 'on' : ''}`} onClick={() => setDestination('library')}>
            <Icon name="library" size={13} /> library entries
          </button>
        </div>
        {destination === 'session' && (
          <div className="seg-meta">
            target session →
            <select className="sel" value={activeSession} onChange={(e) => setActiveSession(e.target.value)}>
              {SESSIONS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <span className="mono faint" style={{ fontSize: 11 }}>
              · AI will re-route per-item if it disagrees
            </span>
          </div>
        )}
        {destination === 'library' && (
          <div className="seg-meta">
            type →
            <select className="sel" defaultValue="note">
              <option value="note">note</option>
              <option value="prompt">prompt</option>
              <option value="snippet">snippet</option>
              <option value="imported_doc">imported doc</option>
            </select>
          </div>
        )}
      </div>

      {/* PASTE AREA */}
      <div className="dz">
        <div className="dz-h">
          <span className="mono faint" style={{ fontSize: 11 }}>paste text · drop .md / .txt files</span>
          <span style={{ flex: 1 }} />
          <span className="mono faint" style={{ fontSize: 11 }}>
            {text.length} chars · {text.split('\n').length} lines · ≈ {Math.ceil(text.length / 4)} tokens
          </span>
        </div>
        <textarea
          className="dz-area"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a Claude Code transcript, a stand-up dump, a half-formed thought&hellip; AI extracts items, classifies against this project's bundle, suggests tags + target session + primary unit. Always opens a review modal before anything lands."
          rows={12}
        />
        <div className="dz-actions">
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn ghost"><Icon name="action" size={12} /> drop file</button>
            <button className="btn ghost"><Icon name="spark" size={12} /> voice (⌃space)</button>
            <button className="btn ghost"><Icon name="prompt" size={12} /> chat mode</button>
            <button className="btn ghost" onClick={() => setText('')}>clear</button>
          </div>
          <span style={{ flex: 1 }} />
          <span className="muted" style={{ fontSize: 11 }}>cost · ≈ 0.04¢</span>
          <button className="btn primary" onClick={() => setReview(true)} disabled={!text.trim()}>
            Propose →
          </button>
        </div>
      </div>

      {/* SOURCES PANEL */}
      <div className="section-divider" style={{ marginTop: 32 }}>
        <span className="num">§</span>
        <h2 className="h2">Other capture sources</h2>
      </div>
      <div className="capture-sources">
        <div className="cap-card">
          <div className="cap-h">
            <span className="cap-key">cc-push</span>
            <span className="pill ok mono">watching</span>
          </div>
          <h4 className="cap-title">Claude Code · watched inbox</h4>
          <p className="cap-desc">Files drop into <span className="mono">~/.throughline/cc-inbox/</span>. Backend picks them up, routes by filename prefix, queues for review.</p>
          <div className="cap-meta">
            <span className="mono faint">3 processed today · 0 in queue · last 09:14</span>
          </div>
        </div>
        <div className="cap-card">
          <div className="cap-h">
            <span className="cap-key">todo-scan</span>
            <span className="pill ghost mono">manual</span>
          </div>
          <h4 className="cap-title">Repo · TODO / FIXME / XXX</h4>
          <p className="cap-desc">Manual scan. Patterns: <span className="mono">TODO:</span> · <span className="mono">FIXME:</span> · <span className="mono">XXX:</span>. Matches surface as candidate items with file:line refs.</p>
          <div className="cap-meta">
            <button className="btn">Scan repo now</button>
            <span className="mono faint" style={{ fontSize: 11 }}>last scan · 3d ago · 5 matches</span>
          </div>
        </div>
        <div className="cap-card">
          <div className="cap-h">
            <span className="cap-key">voice</span>
            <span className="pill ghost mono">desktop only</span>
          </div>
          <h4 className="cap-title">Voice · browser-native</h4>
          <p className="cap-desc">Hold ⌃space. Browser speech recognition. Destination toggle in the overlay (session vs library).</p>
          <div className="cap-meta">
            <span className="mono faint">supported · webkit speechrecognition</span>
          </div>
        </div>
        <div className="cap-card">
          <div className="cap-h">
            <span className="cap-key">manual</span>
            <span className="pill ghost mono">always</span>
          </div>
          <h4 className="cap-title">Inline · in any session view</h4>
          <p className="cap-desc">Click + or press <span className="kbd">n</span> in a session board to add an item without AI involvement.</p>
          <div className="cap-meta">
            <span className="mono faint">keyboard-driven · no review modal</span>
          </div>
        </div>
      </div>

      {/* RECENT DUMPS */}
      <div className="section-divider" style={{ marginTop: 32 }}>
        <span className="num">§</span>
        <h2 className="h2">Recent · last 5 dumps</h2>
      </div>
      <div className="recent-dumps">
        {RECENT_DUMPS.map((d, i) => (
          <div key={i} className="rd-row">
            <span className="rd-kind mono">{d.kind}</span>
            <div className="rd-body">
              <div className="rd-source">{d.source}</div>
              <div className="rd-meta mono faint">
                {d.when} · {d.size}
                {d.items_proposed > 0 && <> · {d.items_landed}/{d.items_proposed} items landed</>}
              </div>
            </div>
            <span className={`pill mono ${d.state === 'applied' ? 'ok' : d.state === 'reviewing' ? 'warn' : 'ghost'}`}>{d.state}</span>
          </div>
        ))}
      </div>

      <ReviewModal open={review} onClose={() => setReview(false)} />
    </div>
  );
};

window.CaptureScreen = CaptureScreen;
window.ReviewModal = ReviewModal;
