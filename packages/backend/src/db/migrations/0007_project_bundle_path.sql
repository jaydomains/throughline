-- C-D14 — optional per-project external bundle directory. When set, the bundle
-- loader resolves `<bundle_path>/bundle.md` instead of the install-shipped
-- `methodologies/<bundle_id>/bundle.md`. Nullable; `bundle_id` stays NOT NULL
-- (T-D47) and remains the project's declared bundle identifier either way.

ALTER TABLE projects ADD COLUMN bundle_path TEXT;
