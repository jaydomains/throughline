-- Phase 8 (C-D6) — the gate_firings table ships in 0001_init.sql; the methodology-gates
-- view queries it project-scoped and latest-per-(moment,gate). Add the supporting
-- indexes so those reads stay cheap as firings accumulate.

CREATE INDEX IF NOT EXISTS idx_gate_firings_project ON gate_firings(project_id);
CREATE INDEX IF NOT EXISTS idx_gate_firings_lookup ON gate_firings(project_id, moment, gate_id, created_at);
