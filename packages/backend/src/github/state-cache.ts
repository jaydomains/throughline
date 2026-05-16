import type { PrSnapshot } from '@throughline/shared';
import type { DB } from '../db/index.js';

// Phase 10 (C-D16; T-D7) — `github_state_cache` is the polling ETag + last-known-state
// store. One row per (repo, pr_number) holding the cached PrSnapshot; a synthetic
// pr_number = 0 row holds the repo-level list ETag (so a 304 on the PR-list poll costs
// nothing against the rate limit — schema stays exactly as 0001 declared it).

const LIST_PR_NUMBER = 0;

interface CacheRow {
  repo: string;
  pr_number: number;
  etag: string | null;
  last_payload_json: string | null;
  last_polled_at: string | null;
}

export interface GithubStateCache {
  getListEtag(repo: string): string | null;
  setListEtag(repo: string, etag: string | null): void;
  upsertSnapshot(snap: PrSnapshot): void;
  getSnapshot(repo: string, prNumber: number): PrSnapshot | null;
  listSnapshots(repo: string): PrSnapshot[];
}

export function createGithubStateCache(db: DB): GithubStateCache {
  const upsert = db.prepare(
    `INSERT INTO github_state_cache (repo, pr_number, etag, last_payload_json, last_polled_at)
       VALUES (@repo, @pr_number, @etag, @payload, @at)
     ON CONFLICT(repo, pr_number) DO UPDATE SET
       etag = excluded.etag,
       last_payload_json = excluded.last_payload_json,
       last_polled_at = excluded.last_polled_at`,
  );

  return {
    getListEtag(repo) {
      const row = db
        .prepare('SELECT etag FROM github_state_cache WHERE repo = ? AND pr_number = ?')
        .get(repo, LIST_PR_NUMBER) as { etag: string | null } | undefined;
      return row?.etag ?? null;
    },

    setListEtag(repo, etag) {
      upsert.run({
        repo,
        pr_number: LIST_PR_NUMBER,
        etag,
        payload: null,
        at: new Date().toISOString(),
      });
    },

    upsertSnapshot(snap) {
      upsert.run({
        repo: snap.repo,
        pr_number: snap.pr_number,
        etag: null,
        payload: JSON.stringify(snap),
        at: snap.last_polled_at,
      });
    },

    getSnapshot(repo, prNumber) {
      const row = db
        .prepare('SELECT * FROM github_state_cache WHERE repo = ? AND pr_number = ?')
        .get(repo, prNumber) as CacheRow | undefined;
      if (!row || !row.last_payload_json) return null;
      return JSON.parse(row.last_payload_json) as PrSnapshot;
    },

    listSnapshots(repo) {
      const rows = db
        .prepare(
          'SELECT * FROM github_state_cache WHERE repo = ? AND pr_number != ? ORDER BY pr_number DESC',
        )
        .all(repo, LIST_PR_NUMBER) as CacheRow[];
      return rows
        .filter((r) => r.last_payload_json)
        .map((r) => JSON.parse(r.last_payload_json!) as PrSnapshot);
    },
  };
}
