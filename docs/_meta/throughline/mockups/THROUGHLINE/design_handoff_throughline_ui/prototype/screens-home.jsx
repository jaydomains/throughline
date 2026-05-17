// Home / dashboard — across-everything surface scoped to the current project.

const Sparkline = () => {
  // 14 data points, gentle wave
  const data = [3, 5, 4, 6, 7, 5, 8, 6, 9, 7, 10, 8, 11, 9];
  const w = 200, h = 26;
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d - min) / (max - min || 1)) * (h - 4) - 2;
    return [x, y];
  });
  const line = 'M ' + pts.map(p => p.join(' ')).join(' L ');
  const area = line + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path className="area" d={area} />
      <path className="line" d={line} />
    </svg>
  );
};

const HomeScreen = ({ direction, onNav, onItem }) => {
  const inProgress = ITEMS.filter(i => i.status === 'in_progress');
  const blocked = ITEMS.filter(i => i.status === 'blocked');
  const drifts = DRIFT.slice(0, 5);

  return (
    <div className="view">
      {/* HERO */}
      <div className="home-hero">
        <div className="home-hero-meta">
          <div className="eyebrow">Project · {PROJECT.bundle_id} · {PROJECT.repo_path}</div>
          <h1 className="h1">
            {direction === 'B' ? 'Sunday morning.' : 'Sunday morning'}
            <span className="when">17 May · week 20</span>
          </h1>
          <div className="muted" style={{ fontSize: 13 }}>
            7 items in progress · 2 blocked · {drifts.length} drift signals open · phase 15 (hygiene + cleanup)
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn ghost"><Icon name="prompt" /> Session start</button>
          <button className="btn primary" onClick={() => onNav('capture')}>+ Capture</button>
        </div>
      </div>

      {/* STATS */}
      <div className="home-stats">
        <div className="stat">
          <span className="stat-label">In progress</span>
          <span className="stat-value">{inProgress.length}<span className="delta up">+2 this week</span></span>
          <Sparkline />
        </div>
        <div className="stat">
          <span className="stat-label">Blocked</span>
          <span className="stat-value">{blocked.length}<span className="delta warn">+1 since Friday</span></span>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>longest · 9d</div>
        </div>
        <div className="stat">
          <span className="stat-label">Drift open</span>
          <span className="stat-value">{drifts.length}<span className="delta warn">2 tier-1</span></span>
          <div style={{ display: 'flex', gap: 4 }}>
            <span className="pill danger mono">t1·1</span>
            <span className="pill warn mono">t2·1</span>
            <span className="pill warn mono">t3·2</span>
          </div>
        </div>
        <div className="stat">
          <span className="stat-label">Today's spend</span>
          <span className="stat-value">$2.14<span className="delta">of $5 cap</span></span>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>haiku · sonnet · sonnet</div>
        </div>
      </div>

      {/* IN PROGRESS / BLOCKED + TIMELINE */}
      <div className="home-grid">
        <div>
          <div className="section-divider">
            <span className="num">§01</span>
            <h2 className="h2">In progress · this week</h2>
          </div>
          <div className="card" style={{ padding: 0 }}>
            {inProgress.map((it, i) => (
              <div key={it.id} onClick={() => onItem(it)}
                   style={{
                     display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: 14,
                     padding: '12px 16px', alignItems: 'center',
                     borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
                     cursor: 'pointer',
                   }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{it.id}</span>
                <div>
                  <div style={{ color: 'var(--fg)', fontWeight: 500, marginBottom: 2 }}>{it.title}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {it.anchor && <span className="anchor-chip">{it.anchor}</span>}
                    {it.tags.map(t => <span key={t} className="tag">{t}</span>)}
                    {it.branch && <span className="mono faint" style={{ fontSize: 10.5 }}>↳ {it.branch}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {it.pr && <span className="pill mono" style={{
                    background: it.pr.state === 'merged' ? 'var(--ok-soft)' : 'var(--accent-soft)',
                    color: it.pr.state === 'merged' ? 'var(--ok)' : 'var(--accent)',
                    border: '1px solid transparent',
                  }}>#{it.pr.number}</span>}
                  {it.drift_tier && <span className="pill warn mono" title={it.drift_reason}>↯ drift t{it.drift_tier}</span>}
                </div>
              </div>
            ))}
          </div>

          {blocked.length > 0 && (
            <>
              <div className="section-divider" style={{ marginTop: 28 }}>
                <span className="num">§02</span>
                <h2 className="h2">Blocked</h2>
              </div>
              <div className="card" style={{ padding: 0 }}>
                {blocked.map((it, i) => (
                  <div key={it.id} onClick={() => onItem(it)}
                       style={{
                         display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: 14,
                         padding: '12px 16px', alignItems: 'center',
                         borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
                         cursor: 'pointer',
                       }}>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{it.id}</span>
                    <div>
                      <div style={{ color: 'var(--fg)', fontWeight: 500, marginBottom: 2 }}>{it.title}</div>
                      <div className="muted" style={{ fontSize: 12, fontStyle: direction === 'B' ? 'italic' : 'normal' }}>
                        ↳ {it.blocker_text}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span className="pill warn mono">stale {it.stale_days}d</span>
                      <span className="mono faint" style={{ fontSize: 10.5 }}>{it.anchor || ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="section-divider" style={{ marginTop: 28 }}>
            <span className="num">§03</span>
            <h2 className="h2">Drift · code + discipline</h2>
            <span style={{ flex: 1 }} />
            <button className="btn ghost" onClick={() => onNav('drift')}>open inbox <Icon name="chevron" size={11} /></button>
          </div>
          <div className="drift-list">
            {drifts.map(d => (
              <div key={d.id} className="drift-row" onClick={() => onNav('drift')}>
                <span className={`tier ${d.stream === 'discipline' ? 'disc' : 't' + d.tier}`}>
                  {d.stream === 'discipline' ? 'DISC' : `t${d.tier}`}
                </span>
                <div>
                  <div className="reason">{d.reason}</div>
                  {d.item && <div className="ref">{d.item} · {d.item_title}</div>}
                </div>
                <span className="ref">{d.when}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Phase ring */}
          <div className="card">
            <div className="card-h">
              <h3 className="h3">Phase · gate state</h3>
              <span className="mono faint">{PROJECT.bundle_id}</span>
            </div>
            <div className="phase-bar" style={{ marginBottom: 10 }}>
              <div className="done">scope</div>
              <div className="done">spec</div>
              <div className="active">code-PR</div>
              <div>shipped</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span className="pill danger mono">fail</span>
                <span style={{ flex: 1, color: 'var(--fg-2)' }}>per-commit · <span className="mono">verify-structure.sh</span></span>
                <span className="mono faint" style={{ fontSize: 10.5 }}>08:42</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span className="pill danger mono">fail</span>
                <span style={{ flex: 1, color: 'var(--fg-2)' }}>per-commit · <span className="mono">banned-string-sweep</span></span>
                <span className="mono faint" style={{ fontSize: 10.5 }}>08:42</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span className="pill ok mono">pass</span>
                <span style={{ flex: 1, color: 'var(--fg-2)' }}>pre-write · <span className="mono">anchors-resolve</span></span>
                <span className="mono faint" style={{ fontSize: 10.5 }}>09:14</span>
              </div>
              <button className="btn" style={{ marginTop: 6 }} onClick={() => onNav('gates')}>Review gate firings</button>
            </div>
          </div>

          {/* Claude Code timeline */}
          <div className="card">
            <div className="card-h">
              <h3 className="h3">Claude Code · recent push</h3>
              <span className="mono faint">cc_inbox</span>
            </div>
            <div className="timeline">
              {PUSHES.map((p, i) => (
                <div key={i} className={`tl-item ${p.accent ? 'accent' : ''}`}>
                  <div className="when">{p.when}</div>
                  <div className="what">{p.what}</div>
                  <div className="ref">{p.ref}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Periodic review nudge */}
          <div className="card" style={{ borderLeft: '2px solid var(--accent)' }}>
            <h3 className="h3" style={{ color: 'var(--accent)' }}>Periodic review</h3>
            <p style={{ margin: '8px 0', color: 'var(--fg-2)', fontSize: 13 }}>
              Due Tuesday. Throughline will surface stale decisions, untouched sessions, longest-held blockers, and orphan rules awaiting cleanup.
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn primary">Run now</button>
              <button className="btn ghost">Skip · push 7d</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.HomeScreen = HomeScreen;
