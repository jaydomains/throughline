# Phase E / E18 — Closure-verification appendix

- **Date:** 2026-06-01
- **Slice:** E18 (the closing slice of the Phase E — Full Audit-Fix Close chain).
- **Purpose:** certify, with code + test evidence, the findings the chain routed to E18 as
  *verify-already-closed* (incidentally closed by prior work or by current-`main` state the
  audit text predated), and record the chain's overall close. Per the base plan: a doc
  recording the closure **with code evidence**, plus a verification test **only where a
  regression lock was missing**.

---

## Verified-closed with new regression locks (this slice)

### F4-04 — C-D12 per-type status validation (the headline)
- **Audit finding (audit-3, Minor):** "per-type transitions parsed but not enforced at
  create/update" — flagged because C-D12's one-line summary said "enforce transitions" while
  its body specified status-**membership** validation (the load-bearing wording ambiguity).
- **Ruling (E17, cluster B):** RULE status-only. **C-D12 amended** (CODE_SPEC §C-D12,
  2026-06-01): create/update validate status **membership** against the type's lifecycle;
  transition **adjacency** is *not* runtime-enforced (the parsed `transitions:` field is
  recorded for consumers/tooling, not used as a write guard). Rationale: reconcile,
  auto-reconcile-on-merge, and dump-zone-apply legitimately set a status directly
  (e.g. `open → done`) without walking intermediate states.
- **Code evidence (matches the amended body):**
  - **create** — `items/service.ts:524-533`: rejects a type not in `policy.types`, then a
    status not in `policy.statuses_by_type[type] ?? policy.statuses`.
  - **update** — `items/service.ts:602-609`: same membership check on the next type/status.
  - **Bulk writers inherit it** — reconcile-apply, auto-reconcile-on-merge, dump-zone-apply,
    and bootstrap-ingest all write through `items.create` / `items.update`, so they get the
    same membership guard with no adjacency restriction (which is exactly why adjacency is
    not enforced — it would reject these valid platform writes).
- **Regression lock (new):** `test/test-bundle.test.ts` — using the test-bundle `task`
  lifecycle `[open, doing, blocked, done]` (declared edges `open→doing→blocked→doing→done→open`):
  a direct **`open → done`** update (a member status, but **not** a declared adjacent edge) is
  **accepted** (membership-only), while a status outside the lifecycle (`archived`) is
  rejected. This is the distinctive F4-04 assertion the prior membership test
  (`test-bundle.test.ts:64`) did not cover.
- **Status: VERIFIED-CLOSED.**

### S6-02 — reconcile `ItemPolicyError` / route-layer fragility
- **Audit finding (audit-2, Medium):** "reconcile `ItemPolicyError` — now caught by the
  central handler; route-layer fragile" (mostly closed).
- **Code evidence:** `ItemPolicyError extends DomainError` with `statusCode: 400`,
  `code: 'policy_violation'` (`items/service.ts:43`); the central C-D23 handler
  (`http/error-handler.ts`, registered `server.ts:145`) maps any thrown `DomainError` to its
  canonical status + `ErrorResponse` body — so reconcile-apply no longer needs a hand-rolled
  try/catch to avoid an unhandled 500.
- **Regression lock (new):** `test/error-handler.test.ts` — a thrown `ItemPolicyError`
  surfaces as **400 `policy_violation`** (not 500); and a generic 5xx is logged but its
  message never leaks to the client (the C-D23 no-leak contract).
- **Status: VERIFIED-CLOSED.**

---

## Verified-closed by prior work (recorded; locks already exist)

| Finding | Sev | Closure | Evidence / lock |
|---|---|---|---|
| **F1-01** | Major | Phase B/D — T-D51 amendment makes `repo_path` non-omittable + the loader's 3-arm bundle precedence; "wrong methodology bundle" cannot recur. | `projects.test.ts` (repo-path normalisation, dup-path), `loader.test.ts`. |
| **SF1-01 bulk** + **SF1-03** + **S1-03** (audit-4/2 twins) | Crit/Low | **E7** — a quarantine **copy-failure** now leaves a counted marker, so `quarantineCount > 0` and the C-D25 surface shows it (no longer a silent "no quarantine"). | E7's quarantine copy-failure test (`bootstrap` worker suite). |
| **SF6-01 / SF6-02** (item/session load fail → "empty project") | Crit | Phase C / E12 closed-records (empty-vs-failure split). | recorded in the E12 / E15 execution-log notes. |
| **SF6-08** (DriftInbox actions) | Med | Phase C — `DriftInbox` `act` → `setActionError` → `<LoadError>`. | recorded in §E15 (S8-04 DriftInbox-closed note). |
| **SF6-09** (PrBadges success-shaped swallow) | High | **E15** — `ProjectPrsResult.poll_healthy/poll_error` (T-D60) + the three PrBadges states. | `github-prs-health.test.ts`, `frontendRaces.test.tsx`. |
| **SF6-10 / SF6-11** (IntelligenceView / SettingsView loaders) | Med | **E24** — `<LoadError>` surfaces (accumulated) instead of empty/stuck panels. | `intelligenceView.test.tsx`, `settingsView.test.tsx`. |
| **S5-02** | — | Re-examined → Major **F1-01** (above); no separate residual. | — |
| **Phase-D locks** (safe-regex, atomic writes, etc.) | — | Present on `main`; reused by E13/E23 (safe-regex), E25 (tier-1). | `discipline-*` + `gates` + `github` suites. |

---

## Deferred tail (carried forward — not closed here, by ruling)

| Item | Disposition | Where it lives |
|---|---|---|
| **SF4-05 / SF4-06** (cost under-count) | DEFER → **Phase F** | base-plan Phase-F deferred-tail register. |
| **F3-01** (§7.14-vs-T-D57 scan-gate layer) | DEFER → separate spec-author decision | E17 decision record, "Open — re-surfaced". |
| **SF4-04 / SF4-05 frontend Mediums beyond E24** (e.g. **SF6-12** LibraryView edits) | Phase F | noted in §E24; out of the Low-tier E24 scope. |
| **Dependency remediation** (vite 5→6, esbuild, protobufjs 6→7, fastify 4→5, fast-uri) | **DEFERRED-MAJOR** → future fastify-v5 migration phase | E17a deferral record (§E17a) + the E17 accepted-advisories register. |
| **SF5-07/09/10, SF6-13/14/15** (undescribed Low tally IDs) | No defensible residual site (background clean; frontend residuals = the SF6-10/11 Mediums, fixed in E24) | §E24 accountability table. |
| Pre-existing test flakes (`rag.test.ts`, `directives.test.tsx`) | Phase-F (out of scope, halt-8) | PLATFORM_STATUS. |

---

## Chain close

Phase E — Full Audit-Fix Close is **complete**. Every audit finding across audits 1–4 (and
the audit-2 twins) is now either **fixed-and-merged**, **verified-closed** (this appendix),
**descoped/scheduled** (E17 registers), or **deferred with a recorded home** (the tail above).
No finding is silently dropped — the audit-ID set-diff gate held across the chain.

- **Anchors minted (3, all planned):** T-D60 (E1), C-D26 (E5), C-D25 (E6); plus the
  **T-D10 amendment** (E20a, `project_spec`, no new number). No anchor minted outside this set.
- **Slices E1–E26 + E17a + E18 + E20b** merged; one PR per slice; every PR Gitar-approved and
  green on the CI gate. Per-slice detail (PR #, merge SHA, fix-rounds, halt/flake flags) is in
  `phase-e-execution-log.md`.
