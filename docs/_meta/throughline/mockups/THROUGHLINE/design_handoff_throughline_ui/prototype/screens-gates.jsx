// Methodology gates view — phase moments with gate firings.

const MOMENT_LABELS = {
  'pre-write':   { name: 'pre-write',   key: 'POST /api/gate-trigger',    desc: 'fires before Claude Code writes to docs' },
  'per-commit':  { name: 'per-commit',  key: '.git/hooks/pre-commit',     desc: 'fires on item-state transition or git pre-commit hook' },
  'plan-mode':   { name: 'plan-mode',   key: 'POST /api/gate-trigger',    desc: 'fires when CC enters plan mode' },
  'post-commit': { name: 'post-commit', key: '.git/hooks/post-commit',    desc: 'fires after commit lands' },
  'pr-open':     { name: 'pr-open',     key: 'GH polling · 60s active',   desc: 'fires when a PR opens on the watched repo' },
};

const STATUS_GLYPH = { pass: '✓', fail: '✕', skipped: '–', error: '!' };

const GatesScreen = ({ direction }) => {
  const grouped = {};
  GATE_FIRINGS.forEach(g => { (grouped[g.moment] = grouped[g.moment] || []).push(g); });
  const moments = Object.keys(MOMENT_LABELS);
  const totals = {
    pass: GATE_FIRINGS.filter(g => g.status === 'pass').length,
    fail: GATE_FIRINGS.filter(g => g.status === 'fail').length,
    skip: GATE_FIRINGS.filter(g => g.status === 'skipped').length,
  };

  return (
    <div className="view">
      <div className="eyebrow">Methodology · {PROJECT.bundle_id} · gates are advisory, never block</div>
      <h1 className="h1" style={{ marginTop: 6, marginBottom: 14, display: 'flex', alignItems: 'baseline', gap: 14 }}>
        {direction === 'B' ? 'Gates.' : 'Methodology gates'}
        <span className="mono" style={{ fontSize: 14, color: 'var(--fg-muted)', fontWeight: 400, letterSpacing: 0 }}>
          {totals.pass + totals.fail + totals.skip} firings · last 24h
        </span>
      </h1>

      <div className="home-stats" style={{ marginBottom: 24 }}>
        <div className="stat">
          <span className="stat-label">Passing</span>
          <span className="stat-value" style={{ color: 'var(--ok)' }}>{totals.pass}</span>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>across {moments.length} phase moments</div>
        </div>
        <div className="stat">
          <span className="stat-label">Failing</span>
          <span className="stat-value" style={{ color: 'var(--danger)' }}>{totals.fail}</span>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>per-commit · phase/15-hygiene</div>
        </div>
        <div className="stat">
          <span className="stat-label">Skipped</span>
          <span className="stat-value" style={{ color: 'var(--fg-muted)' }}>{totals.skip}</span>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>upstream-gate dependent</div>
        </div>
        <div className="stat">
          <span className="stat-label">Hooks</span>
          <span className="stat-value mono" style={{ fontSize: 18, fontFamily: 'var(--font-mono)' }}>installed</span>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>pre-commit · post-commit · advisory (T-D44)</div>
        </div>
      </div>

      {/* INFO BANNER */}
      <div className="card" style={{ borderLeft: '2px solid var(--accent)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--accent)' }}><Icon name="flag" /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--fg)' }}>Failures surface as proposals. Throughline never silently blocks.</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Override with reason (audit-logged), or fix &amp; retry. Both options on every firing.</div>
          </div>
        </div>
      </div>

      {moments.map(m => {
        const firings = grouped[m] || [];
        if (firings.length === 0) return null;
        const ml = MOMENT_LABELS[m];
        return (
          <div key={m} className="gates-moment">
            <div className="moment-h">
              <div className="name">
                <h3>{ml.name}</h3>
                <span className="key">{ml.key}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {firings.some(f => f.status === 'fail') && <span className="pill danger mono">{firings.filter(f => f.status === 'fail').length} failing</span>}
                {firings.some(f => f.status === 'pass') && <span className="pill ok mono">{firings.filter(f => f.status === 'pass').length} pass</span>}
                <span className="mono faint" style={{ fontSize: 11 }}>{ml.desc}</span>
              </div>
            </div>
            {firings.map((f, i) => (
              <div key={i} className="gate-firing">
                <span className={`status ${f.status}`} title={f.status}>{STATUS_GLYPH[f.status]}</span>
                <div className="body">
                  <div className="title">
                    {f.key.replace(/-/g, ' ')}
                    <span className="gate-key">{f.key}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    target · <span className="mono">{f.target}</span>
                  </div>
                  {f.findings.length > 0 && (
                    <div className="findings">
                      {f.findings.map((fd, j) => (
                        <div key={j} className="finding">
                          <span>{fd.msg}</span>
                          {fd.loc && <span className="loc">{fd.loc}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="actions">
                  <span className="when">{f.when}</span>
                  {f.status === 'fail' && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <button className="btn ghost" style={{ fontSize: 11, padding: '3px 8px' }}>override</button>
                      <button className="btn" style={{ fontSize: 11, padding: '3px 8px' }}>fix & retry</button>
                    </div>
                  )}
                  {f.status === 'pass' && (
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ok)' }}>0 findings</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      <div className="section-divider" style={{ marginTop: 36 }}>
        <span className="num">§</span>
        <h2 className="h2">Hooks · installed in repo</h2>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {[
          ['pre-commit',  '~/code/throughline/.git/hooks/pre-commit',  'chained · advisory · exit 0 (T-D44)', 'installed 2026-04-12'],
          ['post-commit', '~/code/throughline/.git/hooks/post-commit', 'chained · advisory · exit 0 (T-D44)', 'installed 2026-04-12'],
        ].map((row, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '120px 1fr auto',
            gap: 16, padding: '12px 18px', alignItems: 'center',
            borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
          }}>
            <span className="pill ok mono">{row[0]}</span>
            <div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{row[1]}</div>
              <div className="muted" style={{ fontSize: 11 }}>{row[2]}</div>
            </div>
            <span className="mono faint" style={{ fontSize: 10.5 }}>{row[3]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

window.GatesScreen = GatesScreen;
