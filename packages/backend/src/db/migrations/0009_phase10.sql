-- Phase 10 — GitHub integration & code-drift detection (C-D16, T-D6/7/18/21/33/34).
-- No new tables/columns: confidence + undo provenance ride in audit_log.trigger_context_json
-- (CODE_SPEC §6/§16); item_pr_associations / orphaned_rules / github_state_cache /
-- drift_signals / item_verifier_rules / item_code_refs already carry the needed shapes.
-- This migration is index-only — the Phase-10 hot paths (drift-inbox queries, code-drift
-- per-item badge lookups, PR-association joins, orphan-rule listing) all filter on columns
-- that 0001 left unindexed.

CREATE INDEX IF NOT EXISTS idx_drift_signals_project_stream
  ON drift_signals(project_id, stream, dismissed_at);

CREATE INDEX IF NOT EXISTS idx_drift_signals_item
  ON drift_signals(item_id);

CREATE INDEX IF NOT EXISTS idx_orphaned_rules_project
  ON orphaned_rules(project_id, dismissed_at);

CREATE INDEX IF NOT EXISTS idx_item_pr_assoc_repo_pr
  ON item_pr_associations(repo, pr_number);

CREATE INDEX IF NOT EXISTS idx_item_verifier_rules_item
  ON item_verifier_rules(item_id);
