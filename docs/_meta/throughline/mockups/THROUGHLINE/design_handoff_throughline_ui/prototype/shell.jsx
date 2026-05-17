// App shell — header, sidebar, command palette overlay.

const Header = ({ direction, onOpenPalette, onNav }) => {
  return (
    <header className="head">
      <div onClick={() => onNav('home')} style={{ cursor: 'pointer' }}>
        <Wordmark direction={direction} />
      </div>
      <span style={{ width: 1, height: 22, background: 'var(--hairline)', margin: '0 6px' }} />
      <button className="project-switch" type="button">
        <span className="badge">{PROJECT.short}</span>
        <span>{PROJECT.name}</span>
        <span className="meta">· {PROJECT.bundle_id}</span>
        <Icon name="chevron-down" size={12} />
      </button>
      <div className="spacer" />
      <button className="head-pill" type="button" title="Scratchpad — friction-free capture">
        <Icon name="note" size={12} />
        <span>scratchpad</span>
        <span className="mono" style={{ color: 'var(--fg)' }}>{SCRATCHPAD_JOTS}</span>
      </button>
      <span className="head-pill" title="Anthropic spend today / month">
        <span className="dot ok" />
        <span>cost</span>
        <span className="mono"><span style={{ color: 'var(--fg)' }}>$2.14</span> / day</span>
      </span>
      <span className="head-pill" title="SSE live channel">
        <span className="dot live" />
        <span>live</span>
      </span>
      <button className="head-pill" type="button" onClick={onOpenPalette}>
        <Icon name="search" size={12} />
        <span>jump</span>
        <span className="kbd">⌘K</span>
      </button>
    </header>
  );
};

const NAV = [
  { key: 'home',       label: 'Home',           icon: 'home',       count: null },
  { key: 'capture',    label: 'Dump zone',      icon: 'note',       count: null },
  { key: 'sessions',   label: 'Sessions',       icon: 'session',    count: 6 },
  { key: 'modules',    label: 'Primary units',  icon: 'modules',    count: 7 },
  { key: 'tree',       label: 'Tree',           icon: 'tree',       count: null },
  { key: 'graph',      label: 'Graph',          icon: 'graph',      count: null },
  { key: 'library',    label: 'Library',        icon: 'library',    count: NOTES_COUNT },
  { key: 'gates',      label: 'Gates',          icon: 'gate',       count: 4, warn: 2 },
  { key: 'drift',      label: 'Drift inbox',    icon: 'drift',      count: 8, warn: 5 },
  { key: 'directives', label: 'Directives',     icon: 'directives', count: 12 },
];

const Sidebar = ({ active, onNav }) => {
  return (
    <aside className="side">
      <div className="section-label">Project</div>
      {NAV.slice(0, 7).map(n => (
        <div key={n.key} className={`nav-item ${active === n.key ? 'active' : ''}`} onClick={() => onNav(n.key)}>
          <span className="ico"><Icon name={n.icon} /></span>
          <span>{n.label}</span>
          {n.count != null && <span className="count mono">{n.count}</span>}
        </div>
      ))}
      <div className="section-label">Methodology</div>
      {NAV.slice(7, 10).map(n => (
        <div key={n.key} className={`nav-item ${active === n.key ? 'active' : ''}`} onClick={() => onNav(n.key)}>
          <span className="ico"><Icon name={n.icon} /></span>
          <span>{n.label}</span>
          {n.warn ? <span className="badge-warn">{n.warn}</span> : null}
          {n.count != null && <span className="count mono">{n.count}</span>}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div className="section-label">Phase</div>
      <div style={{ padding: '4px 10px 10px' }}>
        <div className="phase-bar" style={{ fontSize: 10 }}>
          <div className="done">scope</div>
          <div className="done">spec</div>
          <div className="active">p15</div>
          <div>v1</div>
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 6 }}>
          {PROJECT.branch}
        </div>
      </div>
      <div className="nav-item" onClick={() => onNav('settings')} style={{ borderTop: '1px dashed var(--hairline)', marginTop: 4, paddingTop: 10 }}>
        <span className="ico"><Icon name="settings" /></span>
        <span>Settings</span>
      </div>
    </aside>
  );
};

// ─── COMMAND PALETTE ────────────────────────────────────────────────
const CommandPalette = ({ open, onClose, onJump }) => {
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState(0);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => inputRef.current && inputRef.current.focus(), 30);
    }
  }, [open]);

  const groups = React.useMemo(() => {
    const ql = q.toLowerCase().trim();
    const match = (s) => !ql || s.toLowerCase().includes(ql);

    const projects = [
      { kind: 'project', label: 'Throughline', sub: 'test-bundle · ~/code/throughline', icon: 'project', action: () => onJump('home') },
      { kind: 'project', label: 'Kunda · website', sub: 'freeform · ~/code/kunda-site', icon: 'project' },
    ].filter(x => match(x.label) || match(x.sub));

    const views = NAV.filter(n => match(n.label)).map(n => ({
      kind: 'view', label: `Go to ${n.label}`, sub: null, icon: n.icon, action: () => onJump(n.key),
    }));

    const items = ITEMS.filter(i => match(i.title) || match(i.id)).slice(0, 6).map(i => ({
      kind: i.type, label: i.title, sub: `${i.id} · ${i.tags.join(' · ')}`, icon: 'item',
      action: () => onJump('sessions', i),
    }));

    const actions = [
      { kind: 'action', label: 'New item',                            icon: 'action' },
      { kind: 'action', label: 'New session',                         icon: 'action' },
      { kind: 'action', label: 'Generate session-start prompt',       icon: 'prompt' },
      { kind: 'action', label: 'Run periodic review',                 icon: 'spark' },
      { kind: 'action', label: 'Re-fire per-commit gates',            icon: 'gate', action: () => onJump('gates') },
      { kind: 'action', label: 'Export sessions to markdown',         icon: 'note' },
    ].filter(x => match(x.label));

    return [
      { title: 'Projects', rows: projects },
      { title: 'Views',    rows: views },
      { title: 'Items',    rows: items },
      { title: 'Actions',  rows: actions },
    ].filter(g => g.rows.length);
  }, [q]);

  const flat = groups.flatMap(g => g.rows);

  React.useEffect(() => {
    const onKey = (e) => {
      if (!open) return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(flat.length - 1, s + 1)); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
      else if (e.key === 'Enter')     { e.preventDefault(); const r = flat[sel]; if (r && r.action) { r.action(); onClose(); } else { onClose(); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flat, sel]);

  if (!open) return <div className="cp-backdrop" />;
  let i = 0;
  return (
    <div className="cp-backdrop open" onClick={onClose}>
      <div className="cp" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          placeholder="Jump to project, session, item, or action…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
        />
        <ul>
          {groups.map(g => (
            <React.Fragment key={g.title}>
              <li className="group-h" style={{ display: 'block', cursor: 'default' }}>{g.title}</li>
              {g.rows.map(r => {
                const idx = i++;
                return (
                  <li key={`${g.title}-${idx}`} aria-selected={idx === sel}
                      onMouseEnter={() => setSel(idx)}
                      onClick={() => { if (r.action) r.action(); onClose(); }}>
                    <span className="ico"><Icon name={r.icon} /></span>
                    <span>
                      <div className="label">{r.label}</div>
                      {r.sub && <div className="sub mono">{r.sub}</div>}
                    </span>
                    <span className="kind">{r.kind}</span>
                  </li>
                );
              })}
            </React.Fragment>
          ))}
          {flat.length === 0 && (
            <li style={{ color: 'var(--fg-faint)', cursor: 'default' }}>No matches.</li>
          )}
        </ul>
        <div className="cp-foot">
          <span className="key"><span className="kbd">↑</span><span className="kbd">↓</span> navigate</span>
          <span className="key"><span className="kbd">↵</span> open</span>
          <span className="key"><span className="kbd">esc</span> close</span>
          <span style={{ marginLeft: 'auto' }} className="mono">⌘K · throughline</span>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { Header, Sidebar, CommandPalette, NAV });
