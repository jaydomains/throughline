<!-- Template version: 1.0 -->

# Throughline — Spec Clarification: Semble Wire / Auth / Lifecycle Handover

**Generated:** 2026-05-16 (UTC)
**Last commit SHA:** see PR head — branch `claude/analyze-semble-spec-gaps-XeqFC` (PR not yet merged; update to merge SHA on merge)
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-16-phase-10-github.md` (Phase 10 — GitHub integration & code-drift detection)

---

## Build State vs Spec

Docs-only spec-clarification PR. Resolves the three open Semble spec-author
questions (wire protocol / authentication / lifecycle) that gate Phase 11. No
code. Forced by a public-source finding: the real Semble (MinishLab/semble) is a
Python tool offering stdio-MCP **or** a one-shot CLI, with on-demand
session-cached indexing and no HTTP/socket/long-lived-service mode — the prior
"backend-managed local service that watches and re-indexes incrementally, read
via local socket" framing was inaccurate.

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Wire: per-query `execFile` CLI, no MCP/HTTP/socket | built | `SPEC.md` §7.15 ¶1; `CODE_SPEC.md` §4 Semble row, C-D17 | Reuses one-shot-child precedent |
| Auth: keyless; non-secret command setting | built | `CODE_SPEC.md` C-D17; T-D27 body | Not in `secrets.json`; `THROUGHLINE_SEMBLE_CMD` |
| Lifecycle: no supervisor, exits per call | built | `SPEC.md` §7.15 ¶1; `DECISIONS.md` T-D27 Implications; C-D17 | Falls out of wire choice |
| CODE_SPEC §1 diagram corrected | built | `CODE_SPEC.md` §1 (`execFile per query` / `Semble CLI (on demand)`) + process-boundaries line | _none_ |
| C-D17 minted | built | `CODE_SPEC.md` C-D17 (after C-D16, before §1) | Format matches C-D16 |
| T-D27 body revised, anchor retained | built | `DECISIONS.md` T-D27 (title + Decision/Rationale/Implications) | No new T-D anchor |
| Graceful degradation unchanged | built | `SPEC.md` §15 (confirmed, no edit) | "no Semble disables code Q&A + tier 3" intact |
| CHECKLIST Phase 11 reconciled | built | `CHECKLIST.md` Phase 11 (3 rows; file-watch row removed) | _none_ |
| SPEC §10 + §14 consistency cells | built | `SPEC.md` L515, L620 | Folded in per spec-author decision |

---

## Last Decision Minted

- **C-D17** — Semble integration: per-query `execFile` CLI invocation, keyless,
  capability-gated. Rationale: matches the in-repo one-shot-child precedent
  (`hook-installer.ts`, `gates/checks.ts`, `github/local-git.ts`,
  `github/pr-linking.ts`; C-D16), zero new dependencies, no MCP client, no
  supervisor; "configured" = command resolves, mirroring
  `AnthropicClient.available()` degradation. Lands in: `CODE_SPEC.md` (C-D17).

> No new T-D anchors. The underlying decision (use Semble; keyless; local) is
> unchanged from T-D27; only the implementation shape changed, captured in
> CODE_SPEC C-D17. T-D27's body was revised in place (anchor ID retained,
> canonical via SPEC §14).

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `docs/_meta/throughline/handovers/2026-05-16-spec-clarification-semble-wire-auth-lifecycle.md` — this handover.

**Modified:**
- `SPEC.md` — §7.15 ¶1 rewritten (on-demand invocation); §10 integration-points Semble row; §14 T-D27 anchor-row summary. §15 confirmed unchanged.
- `CODE_SPEC.md` — new C-D17; §1 process-boundaries line + rationale wording + architecture diagram; §4 integrations Semble row.
- `DECISIONS.md` — T-D27 title + Decision/Rationale/Implications revised (lifecycle revision note; no new anchor).
- `CHECKLIST.md` — Phase 11: spawn/lifecycle rows replaced with execFile/config-command rows; incremental-file-watch row removed.

**Deleted:**
- _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Residual service language beyond enumerated edits | `CODE_SPEC.md` §1 L25/L28, `DECISIONS.md` T-D27 title | Plan enumerated 10 edits; verification grep ("no remaining long-lived-service language") found the T-D27 heading and the §1 process-boundaries/rationale lines still asserted "local service / lifecycle-managed / child-process supervision", contradicting the just-revised body | Fixed in-slice as the same class as the folded-in consistency cells; satisfies the approved verification criterion rather than expanding scope |

---

## Open Questions

- [ ] Semble client module shape (`backend/src/semble/client.ts`: `available()` + `search(...)`, injectable exec impl) — lands in Phase 11 implementation, per C-D17 Implications.
- [ ] `THROUGHLINE_SEMBLE_CMD` wiring into `config.ts` `THROUGHLINE_*` family + §19 Settings surface — Phase 11.

---

## Recently Resolved

- Semble wire / auth / lifecycle — flagged across `SPEC.md` §7.15, `CODE_SPEC.md` §4 L579 ("MCP-style or HTTP API … local socket"), and the prior diagnostic session as the three Phase-11-gating spec-author questions; resolved here by spec-author decision + C-D17.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- Public Semble project (MinishLab/semble) — interface facts (Python; stdio-MCP or one-shot CLI; on-demand session-cached index; keyless; no HTTP/socket) that forced the SPEC correction.

**Downstream (consumes this slice):**
- Phase 11 (Semble integration) — now unblocked: implements the C-D17 client and consumers (done-time linking, code Q&A via `library/service.ts` `semanticSearch()` stub, dump-zone enrichment, dormant code-drift tier-3 in `drift/service.ts`). Consumer code pending.

---

## Reference

- Spec / decisions / build-state docs this slice operates against: `SPEC.md` (§7.15, §10, §14, §15), `CODE_SPEC.md` (§1, §4, C-D16/C-D17), `DECISIONS.md` (T-D27, T-D13), `CHECKLIST.md` (Phase 11), `ROADMAP.md` (Phase 11).
- PR: <link or number — fill on PR open>
