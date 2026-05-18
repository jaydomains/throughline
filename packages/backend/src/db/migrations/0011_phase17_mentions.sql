-- Phase 17 — Item mentions as a first-class relation (SPEC §7.11, §7.17; WN-1b-a).
-- SPEC §7.11 graph edges include "cross-session mentions" and §7.17 "Linked items"
-- lists "items mentioning this one / mentioned by this one", but the Item model had
-- no mention relation (Pass 1b deferred it as WN-1b-a). Mentions are a derived
-- projection of description text: a user references another item with the explicit
-- token @item:<id>. Stored as a join table mirroring item_blockers /
-- item_session_memberships (the established many-to-many precedent) and re-derived
-- on every items.create / items.update. The reverse index serves the
-- "items mentioning this one" lookup. SPEC §7.11/§7.17 ratification is a separate
-- follow-up clarification PR; this migration carries no functional/SPEC change.

CREATE TABLE item_mentions (
  item_id           TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  mentions_item_id  TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, mentions_item_id)
);

CREATE INDEX idx_item_mentions_target ON item_mentions(mentions_item_id);
