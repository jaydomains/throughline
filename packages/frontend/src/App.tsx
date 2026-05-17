import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Header } from './components/Header.js';
import { CommandPalette } from './components/CommandPalette.js';
import { HelpModal } from './components/HelpModal.js';
import { DownBanner } from './components/DownBanner.js';
import { useProjects } from './hooks/useProjects.js';
import { useMethodologies, findBundle } from './hooks/useMethodologies.js';
import { useSSE } from './hooks/useSSE.js';
import { useBackendHealth } from './hooks/useBackendHealth.js';
import { KeyboardProvider, useKeyboardRegistry } from './keyboard/registry.js';
import { ModalStackProvider } from './keyboard/modalStack.js';
import { useHotkey } from './keyboard/useHotkey.js';
import {
  GraphView,
  HomeView,
  ModulesView,
  ProjectsView,
} from './views/stubs.js';
import { GatesView } from './views/GatesView.js';
import { DirectivesView } from './views/DirectivesView.js';
import { LibraryView } from './views/LibraryView.js';
import { SessionsIndex } from './views/SessionsIndex.js';
import { SessionView } from './views/SessionView.js';
import { TreeView } from './views/TreeView.js';
import { DriftInbox } from './views/DriftInbox.js';
import { IntelligenceView } from './views/IntelligenceView.js';
import { SettingsView } from './views/SettingsView.js';
import { api } from './api.js';

function activeProjectIdFromPath(path: string): string | null {
  const m = /^\/projects\/([^/]+)/.exec(path);
  return m ? (m[1] ?? null) : null;
}

function RootRedirect({ lastActiveProjectId }: { lastActiveProjectId: string | null }) {
  if (lastActiveProjectId) return <Navigate to={`/projects/${lastActiveProjectId}`} replace />;
  return <Navigate to="/projects" replace />;
}

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, refresh: refreshProjects } = useProjects();
  const { bundles } = useMethodologies();
  const { connected } = useSSE();
  const { healthy } = useBackendHealth();
  const registry = useKeyboardRegistry();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [lastActive, setLastActive] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then((r) => {
        const value = r.settings['last_active_project_id'];
        if (typeof value === 'string') setLastActive(value);
      })
      .catch(() => {});
  }, []);

  const activeProjectId = activeProjectIdFromPath(location.pathname);

  // Register global keybindings exactly once each.
  useEffect(() => {
    return registry.register({
      id: 'cmd-palette',
      combo: '⌘K / Ctrl+K',
      description: 'Open command palette',
      scope: 'global',
    });
  }, [registry]);
  useEffect(() => {
    return registry.register({
      id: 'help',
      combo: '?',
      description: 'Open keyboard reference',
      scope: 'global',
    });
  }, [registry]);
  useEffect(() => {
    return registry.register({
      id: 'esc',
      combo: 'Esc',
      description: 'Close the topmost modal',
      scope: 'global',
    });
  }, [registry]);
  useEffect(() => {
    return registry.register({
      id: 'arrow-list',
      combo: '↑ / ↓',
      description: 'Move selection in lists (consumers land in Phase 3)',
      scope: 'list',
    });
  }, [registry]);
  useEffect(() => {
    return registry.register({
      id: 'tab-indent',
      combo: 'Tab / Shift+Tab',
      description: 'Indent / outdent in lists (consumers land in Phase 3)',
      scope: 'list',
    });
  }, [registry]);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  useHotkey('mod+k', (e) => {
    e.preventDefault();
    setPaletteOpen(true);
  }, { allowInInput: true });

  useHotkey('?', (e) => {
    e.preventDefault();
    setHelpOpen(true);
  });

  const banner = healthy === false;

  // Navigate redirect helper used by ProjectScopedRoutes when the route's :id
  // doesn't match a known project (e.g., deleted).
  useEffect(() => {
    if (activeProjectId && projects.length > 0 && !projects.find((p) => p.id === activeProjectId)) {
      navigate('/projects', { replace: true });
    }
  }, [activeProjectId, projects, navigate]);

  return (
    <div className="app-shell">
      <DownBanner visible={banner} />
      <Header
        projects={projects}
        bundles={bundles}
        activeProjectId={activeProjectId}
        onOpenPalette={openPalette}
        sseConnected={connected}
      />
      <main className="view" role="main">
        <Routes>
          <Route path="/" element={<RootRedirect lastActiveProjectId={lastActive} />} />
          <Route
            path="/projects"
            element={
              <ProjectsView
                projects={projects}
                bundles={bundles}
                onCreated={async (project) => {
                  await refreshProjects();
                  void api.switchProject(project.id).catch(() => {});
                  navigate(`/projects/${project.id}`);
                }}
              />
            }
          />
          <Route path="/projects/:id" element={<HomeView />} />
          <Route path="/projects/:id/sessions" element={<SessionsIndex />} />
          <Route path="/projects/:id/sessions/:sessionId" element={<SessionView />} />
          <Route
            path="/projects/:id/modules"
            element={
              <ProjectBundleGuard projects={projects} bundles={bundles}>
                {(bundleId) => <ModulesView bundles={bundles} projectBundleId={bundleId} />}
              </ProjectBundleGuard>
            }
          />
          <Route path="/projects/:id/tree" element={<TreeView />} />
          <Route path="/projects/:id/graph" element={<GraphView />} />
          <Route path="/projects/:id/library" element={<LibraryView />} />
          <Route path="/projects/:id/directives" element={<DirectivesView />} />
          <Route path="/projects/:id/intelligence" element={<IntelligenceView />} />
          <Route path="/projects/:id/drift-inbox" element={<DriftInbox />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route
            path="/projects/:id/methodology-gates"
            element={
              <ProjectBundleGuard projects={projects} bundles={bundles}>
                {(bundleId) => <GatesView bundles={bundles} projectBundleId={bundleId} />}
              </ProjectBundleGuard>
            }
          />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        projects={projects}
        bundles={bundles}
        activeProjectId={activeProjectId}
      />
      <HelpModal open={helpOpen} onClose={closeHelp} />
    </div>
  );
}

function ProjectBundleGuard({
  projects,
  bundles,
  children,
}: {
  projects: import('@throughline/shared').Project[];
  bundles: import('./api.js').MethodologySummary[];
  children: (bundleId: string) => JSX.Element;
}) {
  const { id } = useParams();
  if (!id) return <Navigate to="/projects" replace />;
  // While projects haven't loaded, render nothing rather than ping-pong-redirecting.
  if (projects.length === 0) return null;
  const project = projects.find((p) => p.id === id);
  if (!project) return <Navigate to="/projects" replace />;
  if (bundles.length === 0) return null;
  const bundle = findBundle(bundles, project.bundle_id);
  // Hidden when bundle declares no primary unit (modules) or no gates (gates).
  // Each child also rechecks; the guard saves an extra render frame.
  if (!bundle) return <Navigate to={`/projects/${id}`} replace />;
  return children(project.bundle_id);
}

export function App() {
  return (
    <KeyboardProvider>
      <ModalStackProvider>
        <AppInner />
      </ModalStackProvider>
    </KeyboardProvider>
  );
}
