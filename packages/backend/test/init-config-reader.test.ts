import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BundleIdMismatchError,
  InvalidProjectConfigError,
  projectConfigExists,
  readProjectConfig,
} from '../src/init/config-reader.js';

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function makeRepo(): { repoPath: string; cleanup: () => void } {
  const repoPath = mkdtempSync(join(tmpdir(), 'throughline-cfg-'));
  mkdirSync(join(repoPath, '.throughline'), { recursive: true });
  return {
    repoPath,
    cleanup: () => rmSync(repoPath, { recursive: true, force: true }),
  };
}

function writeConfig(repoPath: string, contents: string | object): void {
  const body = typeof contents === 'string' ? contents : JSON.stringify(contents);
  writeFileSync(join(repoPath, '.throughline', 'project.json'), body);
}

describe('init config-reader (C-D19 surface 2)', () => {
  it('returns null when `.throughline/project.json` is absent', () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      expect(projectConfigExists(repoPath)).toBe(false);
      expect(readProjectConfig(repoPath)).toBeNull();
    } finally {
      cleanup();
    }
  });

  it('reads a minimal valid config (only bundle_id)', () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      writeConfig(repoPath, { bundle_id: 'freeform' });
      const cfg = readProjectConfig(repoPath);
      expect(cfg).toEqual({
        bundle_id: 'freeform',
        bundle_path: null,
        github_owner: null,
        github_repo: null,
        project_name: null,
      });
    } finally {
      cleanup();
    }
  });

  it('reads all five fields when present', () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      writeConfig(repoPath, {
        bundle_id: 'freeform',
        bundle_path: '/abs/path/to/external',
        github_owner: 'jaydomains',
        github_repo: 'throughline',
        project_name: 'Throughline',
      });
      const cfg = readProjectConfig(repoPath);
      expect(cfg?.bundle_id).toBe('freeform');
      expect(cfg?.bundle_path).toBe('/abs/path/to/external');
      expect(cfg?.github_owner).toBe('jaydomains');
      expect(cfg?.github_repo).toBe('throughline');
      expect(cfg?.project_name).toBe('Throughline');
    } finally {
      cleanup();
    }
  });

  it('resolves a relative bundle_path against repo_path', () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      writeConfig(repoPath, { bundle_id: 'freeform', bundle_path: 'methodologies/local' });
      const cfg = readProjectConfig(repoPath);
      expect(cfg?.bundle_path).toBe(join(repoPath, 'methodologies/local'));
    } finally {
      cleanup();
    }
  });

  it('rejects unknown top-level keys', () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      writeConfig(repoPath, { bundle_id: 'freeform', surprise_field: 'value' });
      expect(() => readProjectConfig(repoPath)).toThrow(InvalidProjectConfigError);
    } finally {
      cleanup();
    }
  });

  it('rejects missing bundle_id', () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      writeConfig(repoPath, { project_name: 'No bundle' });
      expect(() => readProjectConfig(repoPath)).toThrow(InvalidProjectConfigError);
    } finally {
      cleanup();
    }
  });

  it('rejects non-string bundle_id', () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      writeConfig(repoPath, { bundle_id: 42 });
      expect(() => readProjectConfig(repoPath)).toThrow(InvalidProjectConfigError);
    } finally {
      cleanup();
    }
  });

  it('rejects malformed JSON', () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      writeConfig(repoPath, '{not: "json"}');
      expect(() => readProjectConfig(repoPath)).toThrow(InvalidProjectConfigError);
    } finally {
      cleanup();
    }
  });

  it('rejects top-level non-object JSON', () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      writeConfig(repoPath, '"a string"');
      expect(() => readProjectConfig(repoPath)).toThrow(InvalidProjectConfigError);
      writeConfig(repoPath, '[1, 2, 3]');
      expect(() => readProjectConfig(repoPath)).toThrow(InvalidProjectConfigError);
    } finally {
      cleanup();
    }
  });

  it('raises BundleIdMismatchError when sibling bundle.md §1 Identity name disagrees with project.json bundle_id', () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      // Sibling bundle.md declares name: freeform
      copyFileSync(FREEFORM_BUNDLE_PATH, join(repoPath, '.throughline', 'bundle.md'));
      // project.json says a different bundle_id
      writeConfig(repoPath, { bundle_id: 'not-freeform' });
      expect(() => readProjectConfig(repoPath)).toThrow(BundleIdMismatchError);
    } finally {
      cleanup();
    }
  });

  it('accepts matching project.json bundle_id and sibling bundle.md §1 Identity name', () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      copyFileSync(FREEFORM_BUNDLE_PATH, join(repoPath, '.throughline', 'bundle.md'));
      writeConfig(repoPath, { bundle_id: 'freeform' });
      const cfg = readProjectConfig(repoPath);
      expect(cfg?.bundle_id).toBe('freeform');
    } finally {
      cleanup();
    }
  });

  it('skips the bundle_id cross-check when the sibling bundle.md fails to parse', () => {
    // A malformed sibling bundle.md is the loader's problem to surface (it
    // audits the parse error). project.json validation does not double-fault.
    const { repoPath, cleanup } = makeRepo();
    try {
      writeFileSync(join(repoPath, '.throughline', 'bundle.md'), '# unparseable\n');
      writeConfig(repoPath, { bundle_id: 'whatever' });
      expect(() => readProjectConfig(repoPath)).not.toThrow();
    } finally {
      cleanup();
    }
  });
});
