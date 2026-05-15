import { useCallback, useEffect, useState } from 'react';
import type { MdIngestFolder, MdScanResult } from '@throughline/shared';
import { api } from '../api.js';

// Phase 6c — repo `.md` ingestion folder-opt-in selector (SPEC §7.9, T-D11).
// Collapsible panel in the library view (project scope only). Lists opted-in folders
// (relative to the project's repo_path), lets the user add/remove them, scan a folder
// for `.md` files, and ingest a selected subset as imported-doc entries.

interface Props {
  projectId: string;
  onIngested: () => void;
}

export function MdFolderManager({ projectId, onIngested }: Props) {
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<MdIngestFolder[]>([]);
  const [newPath, setNewPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<MdScanResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const refreshFolders = useCallback(async () => {
    try {
      const r = await api.listMdFolders(projectId);
      setFolders(r.folders);
    } catch {
      setFolders([]);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) void refreshFolders();
  }, [open, refreshFolders]);

  async function onAddFolder() {
    setError(null);
    const path = newPath.trim();
    if (path.length === 0) return;
    try {
      await api.addMdFolder(projectId, path);
      setNewPath('');
      await refreshFolders();
    } catch {
      setError(`Could not add "${path}" — folder must exist inside the project's repo path.`);
    }
  }

  async function onRemoveFolder(folderId: string) {
    await api.removeMdFolder(projectId, folderId);
    if (scan && scan.folder_id === folderId) {
      setScan(null);
      setSelected(new Set());
    }
    await refreshFolders();
  }

  async function onScan(folderId: string) {
    setError(null);
    setBusy(true);
    try {
      const r = await api.scanMdFolder(projectId, folderId);
      setScan(r.result);
      // Pre-select everything that's new or changed; unchanged stays unticked.
      setSelected(
        new Set(
          r.result.candidates
            .filter((c) => c.status !== 'unchanged')
            .map((c) => c.rel_path),
        ),
      );
    } catch {
      setError('Scan failed.');
    } finally {
      setBusy(false);
    }
  }

  function toggle(relPath: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) next.delete(relPath);
      else next.add(relPath);
      return next;
    });
  }

  async function onIngest() {
    if (!scan || selected.size === 0) return;
    setBusy(true);
    try {
      await api.ingestMd(projectId, scan.folder_id, [...selected]);
      setScan(null);
      setSelected(new Set());
      onIngested();
    } catch {
      setError('Ingest failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="md-folder-manager" data-testid="md-folder-manager">
      <button
        type="button"
        className="md-folder-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-testid="md-folder-toggle"
      >
        {open ? '▾' : '▸'} Repo .md ingestion ({folders.length})
      </button>
      {open && (
        <div className="md-folder-body">
          <div className="md-folder-add">
            <input
              type="text"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="folder path relative to repo (e.g. docs)"
              data-testid="md-folder-path-input"
            />
            <button
              type="button"
              onClick={() => void onAddFolder()}
              data-testid="md-folder-add-btn"
            >
              Add folder
            </button>
          </div>
          {error && (
            <p className="form-error" role="alert" data-testid="md-folder-error">
              {error}
            </p>
          )}
          <ul className="md-folder-list" data-testid="md-folder-list">
            {folders.length === 0 && (
              <li className="muted">
                No opted-in folders. Add one to scan it for .md docs.
              </li>
            )}
            {folders.map((f) => (
              <li key={f.id} data-testid={`md-folder-${f.id}`}>
                <code>{f.rel_path}</code>
                <button
                  type="button"
                  onClick={() => void onScan(f.id)}
                  disabled={busy}
                  data-testid={`md-folder-scan-${f.id}`}
                >
                  Scan
                </button>
                <button
                  type="button"
                  onClick={() => void onRemoveFolder(f.id)}
                  data-testid={`md-folder-remove-${f.id}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          {scan && (
            <div className="md-scan-result" data-testid="md-scan-result">
              {scan.candidates.length === 0 && (
                <p className="muted">No .md files found in this folder.</p>
              )}
              {scan.candidates.length > 0 && (
                <>
                  <ul className="md-scan-list">
                    {scan.candidates.map((c) => (
                      <li key={c.rel_path} data-testid={`md-candidate-${c.rel_path}`}>
                        <label>
                          <input
                            type="checkbox"
                            checked={selected.has(c.rel_path)}
                            onChange={() => toggle(c.rel_path)}
                            data-testid={`md-candidate-check-${c.rel_path}`}
                          />
                          <code>{c.rel_path}</code>
                          <span className={`md-status md-status-${c.status}`}>
                            {c.status}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => void onIngest()}
                    disabled={busy || selected.size === 0}
                    data-testid="md-ingest-btn"
                  >
                    Ingest selected ({selected.size})
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
