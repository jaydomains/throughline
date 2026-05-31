// Phase 6b / Phase E E4 — OS notification capability honesty (T-D32, T-D60; SPEC §7.25/§15).
// These shapes cross the wire between the backend notifier capability layer and the
// settings panel's grant/test surface.

// The disclosed result of attempting a notification delivery (T-D60: a non-delivery is
// reported truthfully, never masqueraded as success):
//   'delivered'   — the OS backend accepted and fired the notification.
//   'unavailable' — no OS backend is wired (e.g. node-notifier absent); nothing fired.
//   'failed'      — a backend is present but the fire failed (permission denied, daemon
//                   offline, etc.).
export type NotifyOutcome = 'delivered' | 'unavailable' | 'failed';

// Response of POST /api/notifications/test. The settings panel renders the outcome
// distinctly so the user is never told "notifications are working" when they are not.
export interface NotificationTestResult {
  outcome: NotifyOutcome;
  // Human-readable detail; present for 'unavailable' and 'failed'.
  message?: string;
}
