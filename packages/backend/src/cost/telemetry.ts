import { nanoid } from 'nanoid';
import type { DB } from '../db/index.js';

// T-D29 stub: schema is in place; producers (AI feature wirings) land in later phases.
// Exporting the writer now keeps the audit-log + cost-telemetry write paths uniform
// across the codebase.

export interface RecordCostInput {
  projectId: string | null;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  usdEstimate: number;
}

export function recordCost(db: DB, input: RecordCostInput): string {
  const id = nanoid();
  db.prepare(
    `INSERT INTO cost_telemetry
      (id, project_id, timestamp, feature, model, input_tokens, output_tokens, usd_estimate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.projectId,
    new Date().toISOString(),
    input.feature,
    input.model,
    input.inputTokens,
    input.outputTokens,
    input.usdEstimate,
  );
  return id;
}
