import { useEffect, useMemo, useRef, useState } from 'react';
import type { CreateProjectInput, Project } from '@throughline/shared';
import { api, type MethodologySummary } from '../api.js';
import { useModalRegistration } from '../keyboard/modalStack.js';

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
  bundles: MethodologySummary[];
}

const FREEFORM = 'freeform';

export function NewProjectModal({ open, onClose, onCreated, bundles }: NewProjectModalProps) {
  useModalRegistration('new-project', open, onClose);

  const loadedBundles = useMemo(
    () => bundles.filter((b) => b.status === 'loaded'),
    [bundles],
  );
  const defaultBundleId = useMemo(() => {
    if (loadedBundles.some((b) => b.bundle_id === FREEFORM)) return FREEFORM;
    return loadedBundles[0]?.bundle_id ?? '';
  }, [loadedBundles]);

  const [name, setName] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [bundleId, setBundleId] = useState(defaultBundleId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setRepoPath('');
      setBundleId(defaultBundleId);
      setSubmitting(false);
      setError(null);
      // Focus after the modal mounts.
      queueMicrotask(() => nameRef.current?.focus());
    }
  }, [open, defaultBundleId]);

  if (!open) return null;

  const trimmedName = name.trim();
  const trimmedRepo = repoPath.trim();
  const canSubmit =
    !submitting && trimmedName.length > 0 && trimmedRepo.length > 0 && bundleId.length > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const input: CreateProjectInput = {
        name: trimmedName,
        repo_path: trimmedRepo,
        bundle_id: bundleId,
      };
      const { project } = await api.createProject(input);
      onCreated(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-label="New project"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal new-project-modal">
        <h2 style={{ marginTop: 0 }}>New project</h2>
        <form onSubmit={onSubmit}>
          <label className="form-row">
            <span>Name</span>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              autoComplete="off"
              data-testid="new-project-name"
            />
          </label>
          <label className="form-row">
            <span>Repo path</span>
            <input
              type="text"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="/absolute/path/to/repo"
              autoComplete="off"
              data-testid="new-project-repo"
            />
          </label>
          <label className="form-row">
            <span>Methodology bundle</span>
            <select
              value={bundleId}
              onChange={(e) => setBundleId(e.target.value)}
              data-testid="new-project-bundle"
              disabled={loadedBundles.length === 0}
            >
              {loadedBundles.length === 0 && <option value="">No bundles loaded</option>}
              {loadedBundles.map((b) => {
                const label = b.identity
                  ? `${b.identity.name} (${b.identity.version})`
                  : b.bundle_id;
                return (
                  <option key={b.bundle_id} value={b.bundle_id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </label>
          {error && (
            <p className="form-error" role="alert" data-testid="new-project-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="primary"
              disabled={!canSubmit}
              data-testid="new-project-submit"
            >
              {submitting ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
