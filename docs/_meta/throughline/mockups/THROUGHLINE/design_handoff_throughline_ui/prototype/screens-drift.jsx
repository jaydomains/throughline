// Drift inbox — code drift (4 tiers) + discipline drift (bundle-defined categories).

const TIER_DESC = {
  1: { lbl: 'Semgrep fail', desc: 'verifier rule on done item failed CI', color: 'var(--danger)' },
  2: { lbl: 'Revert',       desc: 'GitHub revert on associated PR',       color: '#e8821e' },
  3: { lbl: 'PR touch',     desc: 'new PR touches a done item\'s code refs', color: 'var(--warn)' },
  4: { lbl: 'Dedup match',  desc: 'dump-zone proposal matches a done item', color: 'var(--fg-muted)' },
};

const DRIFT_CATS = {
  banned_string:  'Banned-string violation',
  cross_reference:'Cross-reference failure',
  structural:     'Structural conformance',
  marker_in_phase:'Marker in wrong phase',
};

const DriftScreen = ({ direction }) => {
  const [tab, setTab] = React.useState('code');
  const code = DRIFT.filter(d => d.stream === 'code');
  const disc = DRIFT.filter(d => d.stream === 'discipline');
  const list = tab === 'code' ? code : disc;

  const tierCounts = {
    1: code.filter(d => d.tier === 1).length,
    2: code.filter(d => d.tier === 2).length,
    3: code.filter(d => d.tier === 3).length,
    4: code.filter(d => d.tier === 4).length,
  };

  return (
    <div className="view">
      <div className="eyebrow">Drift · two streams · code + discipline</div>
      <h1 className="h1" style={{ marginTop: 6, marginBottom: 18, display: 'flex', alignItems: 'baseline', gap: 14 }}>
        {direction === 'B' ? 'Drift inbox.' : 'Drift inbox'}
        <span className="mono" style={{ fontSize: 14, color: 'var(--fg-muted)', fontWeight: 400, letterSpacing: 0 }}>
          {DRIFT.length} open · 5 code · 3 discipline
        </span>
      </h1>

      <div className="drift-tabs">
        <div className={`drift-tab ${tab === 'code' ? 'active' : ''}`} onClick={() => setTab('code')}>
          <Icon name="drift" size={13} />
          <span>Code drift</span>
          <span className="count mono">{code.length}</span>
        </div>
        <div className={`drift-tab ${tab === 'discipline' ? 'active' : ''}`} onClick={() => setTab('discipline')}>
          <Icon name="gate" size={13} />
          <span>Discipline drift</span>
          <span className="count mono">{disc.length}</span>
        </div>
        <span style={{ flex: 1 }} />
        <div className="drift-tab" style={{ borderBottom: 0 }}>
          <span className="mono faint" style={{ fontSize: 11 }}>auto-dismiss t4 after 7d (T-D21)</span>
        </div>
      </div>

      {tab === 'code' && (
        <>
          <div className="drift-tiers">
            {[1, 2, 3, 4].map(t => (
              <div key={t} className={`tier-card t${t}`}>
                <span className="lbl">Tier {t} · {TIER_DESC[t].lbl}</span>
                <span className="n">{tierCounts[t]}</span>
                <span className="desc">{TIER_DESC[t].desc}</span>
              </div>
            ))}
          </div>

          <div className="drift-feed">
            {code.map(d => {
              const td = TIER_DESC[d.tier];
              return (
                <div key={d.id} className="drift-card">
                  <div className="tier-label">
                    <span style={{ color: td.color, fontSize: 13 }}>tier {d.tier}</span>
                    <span className="mono faint" style={{ fontSize: 10.5 }}>{td.lbl}</span>
                    <span className="mono faint" style={{ fontSize: 10.5 }}>{d.when}</span>
                  </div>
                  <div className="reason">
                    <div style={{ marginBottom: 4 }}>{d.reason}</div>
                    <div className="mono faint" style={{ fontSize: 11 }}>
                      {d.item && <><span className="item-ref">{d.item}</span> · </>}{d.item_title}
                    </div>
                    {d.ai_reverify && (
                      <div className="ai-note">ai re-verify · {d.ai_reverify}</div>
                    )}
                  </div>
                  <div className="actions">
                    {d.pr && <span className="pill mono ghost" style={{ fontSize: 11 }}>PR #{d.pr}</span>}
                    <div style={{ display: 'flex', gap: 4 }}>
                      {d.tier === 4 ? (
                        <>
                          <button className="btn ghost" style={{ fontSize: 11, padding: '3px 8px' }}>dismiss</button>
                          <button className="btn" style={{ fontSize: 11, padding: '3px 8px' }}>open as item</button>
                        </>
                      ) : (
                        <>
                          <button className="btn ghost" style={{ fontSize: 11, padding: '3px 8px' }}>re-verify · ai</button>
                          <button className="btn" style={{ fontSize: 11, padding: '3px 8px' }}>re-open item</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'discipline' && (
        <>
          <div className="muted" style={{ fontSize: 13, marginBottom: 16, fontStyle: direction === 'B' ? 'italic' : 'normal' }}>
            Categories come from the bundle's <span className="mono" style={{ color: 'var(--fg-2)' }}>{PROJECT.bundle_id}</span>'s
            validation-rules section — nothing hardcoded in the runtime. Items in affected primary units inherit a discipline-drift indicator.
          </div>
          <div className="drift-feed">
            {disc.map(d => (
              <div key={d.id} className="drift-card">
                <div className="tier-label">
                  <span style={{ color: 'var(--info)', fontSize: 13 }}>discipline</span>
                  <span className="mono faint" style={{ fontSize: 10.5 }}>{DRIFT_CATS[d.category]}</span>
                  <span className="mono faint" style={{ fontSize: 10.5 }}>{d.when}</span>
                </div>
                <div className="reason">
                  <div style={{ marginBottom: 4 }}>{d.reason}</div>
                  <div className="mono faint" style={{ fontSize: 11 }}>
                    {d.item && <><span className="item-ref">{d.item}</span> · </>}{d.item_title}
                    {d.primary_unit && <span style={{ marginLeft: 8 }}>↳ primary_unit <span style={{ color: 'var(--fg-2)' }}>{d.primary_unit}</span></span>}
                  </div>
                </div>
                <div className="actions">
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn ghost" style={{ fontSize: 11, padding: '3px 8px' }}>dismiss</button>
                    <button className="btn" style={{ fontSize: 11, padding: '3px 8px' }}>jump to source</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

window.DriftScreen = DriftScreen;
