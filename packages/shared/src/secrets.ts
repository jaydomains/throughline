// Secrets presence (T-D4). API keys live in a backend file separate from the datastore
// and are NEVER returned to the browser — the settings panel only ever learns whether a
// key is set, never its value.

export interface SecretsPresenceResult {
  anthropic_api_key: boolean;
  github_pat: boolean;
}

export interface SecretsWriteInput {
  // Each field is optional. An empty string clears the secret; an absent field leaves
  // the stored value untouched.
  anthropic_api_key?: string;
  github_pat?: string;
}
