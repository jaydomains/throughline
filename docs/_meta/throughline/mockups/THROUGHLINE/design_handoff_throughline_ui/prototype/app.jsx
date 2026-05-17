// App — root component. Owns route state, theme/direction tweaks, palette overlay.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "direction": "A",
  "theme": "dark",
  "density": "comfortable",
  "accentA": "#5b6cff",
  "accentB": "#b8542a",
  "accentC": "#f0a235"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = React.useState('home');     // home | sessions | gates | drift | modules | tree | graph | library | directives | settings
  const [openItem, setOpenItem] = React.useState(null); // item or null
  const [palette, setPalette] = React.useState(false);

  // Apply direction + theme + density to <body> for CSS to react.
  React.useEffect(() => {
    document.body.setAttribute('data-direction', t.direction);
    document.body.setAttribute('data-theme', t.theme);
    document.body.setAttribute('data-density', t.density);
  }, [t.direction, t.theme, t.density]);

  // Apply per-direction accent override
  React.useEffect(() => {
    const accent =
      t.direction === 'A' ? t.accentA :
      t.direction === 'B' ? t.accentB :
      t.accentC;
    if (accent) {
      document.body.style.setProperty('--accent', accent);
      // accent-fg defaults: light direction-fg or near-bg
      const isLight = t.theme === 'light';
      document.body.style.setProperty('--accent-fg', isLight ? '#ffffff' : '#0a0a0a');
      // accent-soft: 14% mix
      document.body.style.setProperty('--accent-soft', accent + '24');
    }
  }, [t.direction, t.theme, t.accentA, t.accentB, t.accentC]);

  React.useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(p => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navigate = (key, maybeItem) => {
    setRoute(key);
    if (maybeItem) {
      setOpenItem(maybeItem);
      if (key !== 'sessions') setRoute('sessions');
    } else {
      setOpenItem(null);
    }
  };

  return (
    <div className="app">
      <Header direction={t.direction} onOpenPalette={() => setPalette(true)} onNav={navigate} />
      <Sidebar active={route} onNav={navigate} />
      <main className="main" key={route}>
        {route === 'home'     && <HomeScreen   direction={t.direction} onNav={navigate} onItem={(it) => { setOpenItem(it); setRoute('sessions'); }} />}
        {route === 'capture'  && <CaptureScreen direction={t.direction} />}
        {route === 'sessions' && <SessionScreen direction={t.direction} openItem={openItem} onItem={setOpenItem} onCloseItem={() => setOpenItem(null)} />}
        {route === 'gates'    && <GatesScreen  direction={t.direction} />}
        {route === 'drift'    && <DriftScreen  direction={t.direction} />}
        {route === 'modules'  && <StubScreen   title="Primary units"  body="The modules view groups items by their methodology-declared primary unit (test-bundle calls these `units`). Tier, phase, anchor + marker counts, drift state per unit." />}
        {route === 'tree'     && <StubScreen   title="Tree"           body="File-explorer hierarchy with grouping selector (tag, session, primary unit, status, blocker). Drag-drop to re-tag." />}
        {route === 'graph'    && <StubScreen   title="Graph"          body="Interactive node-edge rendering. Parent-child, blocked-by, cross-session mentions. Communication-model layer when bundle declares one." />}
        {route === 'library'  && <StubScreen   title="Library"        body="Notes · prompts · snippets · imported docs. FTS5 over body+tags, semantic search via Semble (code) or local embeddings (text)." />}
        {route === 'directives' && <StubScreen title="Directives"     body="Pins · reminders · include-in-session-prompt. Grouped by type, reminders sorted by next firing." />}
        {route === 'settings' && <StubScreen   title="Settings"       body="Anthropic key (backend), GitHub PAT (backend), per-project bundle binding, stale threshold, periodic-review interval, backup nudge, cost-meter daily cap, orphaned-rule cleanup." />}
      </main>

      <CommandPalette open={palette} onClose={() => setPalette(false)} onJump={navigate} />

      {/* TWEAKS */}
      <TweaksPanel>
        <TweakSection label="Visual direction" />
        <TweakRadio
          label="Direction"
          value={t.direction}
          options={[
            { value: 'A', label: 'A · Quiet' },
            { value: 'B', label: 'B · Spec' },
            { value: 'C', label: 'C · Term' },
          ]}
          onChange={(v) => setTweak('direction', v)}
        />
        <TweakRadio
          label="Theme"
          value={t.theme}
          options={['light', 'dark']}
          onChange={(v) => setTweak('theme', v)}
        />
        <TweakRadio
          label="Density"
          value={t.density}
          options={['compact', 'comfortable', 'spacious']}
          onChange={(v) => setTweak('density', v)}
        />
        <TweakSection label="Accent · this direction" />
        {t.direction === 'A' && (
          <TweakColor
            label="Direction A"
            value={t.accentA}
            options={['#5b6cff', '#4f46e5', '#16a34a', '#dc2626', '#0a0a0a']}
            onChange={(v) => setTweak('accentA', v)}
          />
        )}
        {t.direction === 'B' && (
          <TweakColor
            label="Direction B"
            value={t.accentB}
            options={['#b8542a', '#7a2e1e', '#1e40af', '#166534', '#5a3a1e']}
            onChange={(v) => setTweak('accentB', v)}
          />
        )}
        {t.direction === 'C' && (
          <TweakColor
            label="Direction C"
            value={t.accentC}
            options={['#f0a235', '#7fb800', '#22d3ee', '#ef5350', '#d4d4aa']}
            onChange={(v) => setTweak('accentC', v)}
          />
        )}
        <TweakSection label="Try" />
        <TweakButton label="Open command palette" onClick={() => setPalette(true)} />
        <TweakButton label="Jump · sessions" onClick={() => { setRoute('sessions'); setOpenItem(null); }} />
        <TweakButton label="Jump · dump zone" onClick={() => setRoute('capture')} />
        <TweakButton label="Jump · gates" onClick={() => setRoute('gates')} />
        <TweakButton label="Jump · drift inbox" onClick={() => setRoute('drift')} />
        <TweakButton label="Jump · home" onClick={() => { setRoute('home'); setOpenItem(null); }} />
      </TweaksPanel>
    </div>
  );
}

function StubScreen({ title, body }) {
  return (
    <div className="view">
      <div className="eyebrow">Coming up next</div>
      <h1 className="h1" style={{ marginTop: 6, marginBottom: 16 }}>{title}</h1>
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="muted" style={{ fontSize: 14, lineHeight: 1.65 }}>{body}</div>
        <hr className="rule" style={{ margin: '14px 0' }} />
        <div className="mono faint" style={{ fontSize: 11 }}>
          This surface is in the build plan (CHECKLIST.md). The home, sessions, gates, drift, and ⌘K palette are the ones designed in this prototype.
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
