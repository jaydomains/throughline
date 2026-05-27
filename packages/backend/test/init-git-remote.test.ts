import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectGitHubRemote, parseGitHubRemote } from '../src/init/git-remote.js';

describe('parseGitHubRemote (C-D19 surface 3)', () => {
  it('parses the SSH form (git@github.com:owner/repo.git)', () => {
    expect(parseGitHubRemote('git@github.com:jaydomains/throughline.git')).toEqual({
      owner: 'jaydomains',
      repo: 'throughline',
    });
  });

  it('parses the SSH form without trailing .git', () => {
    expect(parseGitHubRemote('git@github.com:jaydomains/throughline')).toEqual({
      owner: 'jaydomains',
      repo: 'throughline',
    });
  });

  it('parses the HTTPS form', () => {
    expect(parseGitHubRemote('https://github.com/jaydomains/throughline.git')).toEqual({
      owner: 'jaydomains',
      repo: 'throughline',
    });
  });

  it('parses the HTTPS form without trailing .git', () => {
    expect(parseGitHubRemote('https://github.com/jaydomains/throughline')).toEqual({
      owner: 'jaydomains',
      repo: 'throughline',
    });
  });

  it('parses the ssh:// scheme form', () => {
    expect(parseGitHubRemote('ssh://git@github.com/jaydomains/throughline.git')).toEqual({
      owner: 'jaydomains',
      repo: 'throughline',
    });
  });

  it('parses a HTTPS form with auth credentials', () => {
    expect(parseGitHubRemote('https://token@github.com/jaydomains/throughline.git')).toEqual({
      owner: 'jaydomains',
      repo: 'throughline',
    });
  });

  it('returns null for non-GitHub remotes', () => {
    expect(parseGitHubRemote('git@gitlab.com:foo/bar.git')).toBeNull();
    expect(parseGitHubRemote('https://gitlab.com/foo/bar.git')).toBeNull();
  });

  it('returns null for the empty string', () => {
    expect(parseGitHubRemote('')).toBeNull();
    expect(parseGitHubRemote('   ')).toBeNull();
  });

  it('returns null for malformed URLs', () => {
    expect(parseGitHubRemote('not a url')).toBeNull();
    expect(parseGitHubRemote('https://github.com/just-owner')).toBeNull();
  });
});

describe('detectGitHubRemote (C-D19 surface 3)', () => {
  it('returns null when the path is not a git repo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'throughline-not-a-repo-'));
    try {
      expect(detectGitHubRemote(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reads and parses a configured GitHub origin', () => {
    const dir = mkdtempSync(join(tmpdir(), 'throughline-repo-'));
    try {
      execFileSync('git', ['-C', dir, 'init', '-q'], { stdio: 'ignore' });
      execFileSync(
        'git',
        ['-C', dir, 'remote', 'add', 'origin', 'git@github.com:jaydomains/throughline.git'],
        { stdio: 'ignore' },
      );
      expect(detectGitHubRemote(dir)).toEqual({ owner: 'jaydomains', repo: 'throughline' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns null when origin points at a non-GitHub host', () => {
    const dir = mkdtempSync(join(tmpdir(), 'throughline-repo-'));
    try {
      execFileSync('git', ['-C', dir, 'init', '-q'], { stdio: 'ignore' });
      execFileSync(
        'git',
        ['-C', dir, 'remote', 'add', 'origin', 'git@gitlab.com:foo/bar.git'],
        { stdio: 'ignore' },
      );
      expect(detectGitHubRemote(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
