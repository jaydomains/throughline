import { readSecrets } from '../secrets/store.js';

// Phase 10 (C-D16) — thin GitHub REST client over `fetch`, no @octokit dependency.
// This mirrors the deliberate idiom established by `ai/anthropic.ts` (talk JSON over
// HTTPS directly, injectable `fetchImpl` so the surface is offline-testable, promote to
// the SDK only if the surface grows) and the `gates/hook-installer.ts` precedent of not
// pulling a heavyweight dependency for a small, well-understood surface.
//
// Rate-limit posture (C-D16): conditional GETs that return 304 do NOT count against the
// authenticated primary rate limit, so ETag-cached lifecycle polling is effectively
// free. The genuinely expensive calls are diff/file payloads — those go local-git-first
// (see local-git.ts); this client carries only the small GitHub-only metadata facts.
//
// T-D31: outbound HTTPS originates here in the backend, never the browser.

const GH_API = 'https://api.github.com';
const UA = 'throughline';

export interface GhPull {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: 'open' | 'closed';
  merged_at: string | null;
  updated_at: string;
  created_at: string;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
}

export interface GhReview {
  state: string; // APPROVED | CHANGES_REQUESTED | COMMENTED | DISMISSED
  submitted_at: string | null;
}

export interface GhAnnotation {
  path: string;
  annotation_level: string; // failure | warning | notice
  message: string;
  title: string | null;
  // Semgrep posts the rule id in the annotation; we match it to item_verifier_rules.
  raw_details?: string | null;
}

export interface GhConditionalResult<T> {
  // 304 → unchanged; caller reuses its cached payload.
  status: 'ok' | 'not-modified' | 'unavailable';
  etag: string | null;
  data: T | null;
}

export class GitHubAuthError extends Error {
  constructor() {
    super('GitHub PAT is not configured');
  }
}

export interface GitHubApi {
  available(): boolean;
  listPulls(
    owner: string,
    repo: string,
    etag: string | null,
  ): Promise<GhConditionalResult<GhPull[]>>;
  getPull(owner: string, repo: string, n: number): Promise<GhPull | null>;
  listReviews(owner: string, repo: string, n: number): Promise<GhReview[]>;
  listAnnotations(owner: string, repo: string, sha: string): Promise<GhAnnotation[]>;
  findPullForBranch(owner: string, repo: string, branch: string): Promise<GhPull | null>;
  // The repo's default branch (orphan cleanup PRs must target it, not a hardcoded name).
  getDefaultBranch(owner: string, repo: string): Promise<string>;
  // Documented C-D16 fallback: the one expensive payload call. Only used when LocalGit
  // cannot resolve the PR refs; the common path never touches it.
  listPullFiles(owner: string, repo: string, n: number): Promise<string[]>;
  fileExists(owner: string, repo: string, path: string, ref: string): Promise<boolean>;
  // Orphan cleanup PR-draft (T-D33): branch + file-removal commit + PR, via the contents
  // API so no local clone write is required. Returns the opened PR.
  draftRuleRemovalPr(input: DraftRuleRemovalInput): Promise<{ url: string; number: number }>;
}

export interface DraftRuleRemovalInput {
  owner: string;
  repo: string;
  baseBranch: string;
  newBranch: string;
  rulePath: string;
  itemId: string;
}

interface CreateOptions {
  secretsPath: string;
  fetchImpl?: typeof fetch;
}

export function createGitHubApi({ secretsPath, fetchImpl }: CreateOptions): GitHubApi {
  const doFetch = fetchImpl ?? fetch;

  function token(): string | null {
    const s = readSecrets(secretsPath);
    return typeof s.github_pat === 'string' && s.github_pat.length > 0 ? s.github_pat : null;
  }

  async function gh(
    method: string,
    path: string,
    opts: { etag?: string | null; body?: unknown } = {},
  ): Promise<{ status: number; etag: string | null; json: unknown }> {
    const key = token();
    if (!key) throw new GitHubAuthError();
    const headers: Record<string, string> = {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${key}`,
      'user-agent': UA,
      'x-github-api-version': '2022-11-28',
    };
    if (opts.etag) headers['if-none-match'] = opts.etag;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    const init: RequestInit = { method, headers };
    if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
    const res = await doFetch(`${GH_API}${path}`, init);
    const etag = res.headers.get('etag');
    if (res.status === 304) return { status: 304, etag, json: null };
    if (res.status === 404) return { status: 404, etag, json: null };
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GitHub ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = res.status === 204 ? null : await res.json().catch(() => null);
    return { status: res.status, etag, json };
  }

  return {
    available() {
      return token() !== null;
    },

    async listPulls(owner, repo, etag) {
      try {
        const r = await gh('GET', `/repos/${owner}/${repo}/pulls?state=all&per_page=50`, {
          etag,
        });
        if (r.status === 304) return { status: 'not-modified', etag: r.etag ?? etag, data: null };
        return { status: 'ok', etag: r.etag, data: (r.json as GhPull[]) ?? [] };
      } catch (err) {
        if (err instanceof GitHubAuthError) throw err;
        return { status: 'unavailable', etag, data: null };
      }
    },

    async getPull(owner, repo, n) {
      const r = await gh('GET', `/repos/${owner}/${repo}/pulls/${n}`);
      return r.status === 404 ? null : (r.json as GhPull);
    },

    async listReviews(owner, repo, n) {
      const r = await gh('GET', `/repos/${owner}/${repo}/pulls/${n}/reviews?per_page=100`);
      return (r.json as GhReview[]) ?? [];
    },

    async listAnnotations(owner, repo, sha) {
      const runs = await gh('GET', `/repos/${owner}/${repo}/commits/${sha}/check-runs`);
      const checkRuns =
        (runs.json as { check_runs?: Array<{ id: number }> } | null)?.check_runs ?? [];
      const out: GhAnnotation[] = [];
      for (const run of checkRuns) {
        const ann = await gh(
          'GET',
          `/repos/${owner}/${repo}/check-runs/${run.id}/annotations?per_page=100`,
        );
        for (const a of (ann.json as GhAnnotation[]) ?? []) out.push(a);
      }
      return out;
    },

    async getDefaultBranch(owner, repo) {
      const r = await gh('GET', `/repos/${owner}/${repo}`);
      const b = (r.json as { default_branch?: string } | null)?.default_branch;
      return b && b.length > 0 ? b : 'main';
    },

    async findPullForBranch(owner, repo, branch) {
      const r = await gh(
        'GET',
        `/repos/${owner}/${repo}/pulls?head=${owner}:${encodeURIComponent(branch)}&state=all&per_page=10`,
      );
      const pulls = (r.json as GhPull[]) ?? [];
      return pulls[0] ?? null;
    },

    async listPullFiles(owner, repo, n) {
      const out: string[] = [];
      for (let page = 1; page <= 10; page += 1) {
        const r = await gh(
          'GET',
          `/repos/${owner}/${repo}/pulls/${n}/files?per_page=100&page=${page}`,
        );
        const files = (r.json as Array<{ filename: string }>) ?? [];
        for (const f of files) out.push(f.filename);
        if (files.length < 100) break;
      }
      return out;
    },

    async fileExists(owner, repo, path, ref) {
      const r = await gh(
        'GET',
        `/repos/${owner}/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`,
      );
      return r.status !== 404 && r.json !== null;
    },

    async draftRuleRemovalPr(input) {
      const { owner, repo, baseBranch, newBranch, rulePath, itemId } = input;
      const enc = rulePath.split('/').map(encodeURIComponent).join('/');
      const baseRef = await gh('GET', `/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`);
      const baseSha = (baseRef.json as { object?: { sha: string } } | null)?.object?.sha;
      if (!baseSha) throw new Error(`cannot resolve base branch ${baseBranch}`);
      await gh('POST', `/repos/${owner}/${repo}/git/refs`, {
        body: { ref: `refs/heads/${newBranch}`, sha: baseSha },
      });
      const existing = await gh(
        'GET',
        `/repos/${owner}/${repo}/contents/${enc}?ref=${encodeURIComponent(baseBranch)}`,
      );
      const fileSha = (existing.json as { sha?: string } | null)?.sha;
      if (fileSha) {
        await gh('DELETE', `/repos/${owner}/${repo}/contents/${enc}`, {
          body: {
            message: `chore: remove orphaned verifier rule for deleted item ${itemId}`,
            sha: fileSha,
            branch: newBranch,
          },
        });
      }
      const pr = await gh('POST', `/repos/${owner}/${repo}/pulls`, {
        body: {
          title: `Remove orphaned verifier rule (${rulePath})`,
          head: newBranch,
          base: baseBranch,
          body:
            `This PR removes the verifier rule \`${rulePath}\` whose Throughline item ` +
            `(\`${itemId}\`) was deleted. Drafted automatically per T-D33; review and merge ` +
            `to clear the orphan from both the repo and Throughline's tracking.`,
        },
      });
      const prJson = pr.json as { html_url: string; number: number };
      return { url: prJson.html_url, number: prJson.number };
    },
  };
}
