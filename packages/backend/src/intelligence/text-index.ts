import { createHash } from 'node:crypto';
import type { DB } from '../db/index.js';
import type { ItemsService } from '../items/service.js';
import type { LibraryService } from '../library/service.js';
import type { ProjectsService } from '../projects/service.js';
import { cosine, type TextEmbedder } from './embeddings.js';

// C-D2 text substrate index. Indexed entities: item title+description and library entries
// (notes, prompts, snippets, and `imported_doc` — repo `.md` ingestion lands docs as
// library entries, so "project docs" are covered without a separate doc table).
//
// Incremental: each entity carries a content_hash; ensureFresh re-embeds only entities
// whose hash changed and prunes vectors for entities that no longer exist. This is the
// observable contract of "embeddings generated incrementally on content edit" (C-D2)
// without a per-service write hook and without background AI (T-D22 kin) — an edited
// entity yields a fresh vector the next time the substrate is read. Single chunk per
// entity in v1 (chunk_index 0); the schema keeps chunk_index for future splitting.

export interface IndexedEntity {
  entity_type: 'item' | 'library';
  entity_id: string;
  project_id: string;
  label: string;
  text: string;
}

export interface TextHit {
  entity_type: string;
  entity_id: string;
  label: string;
  snippet: string;
  score: number;
}

export interface TextIndex {
  ensureFresh(projectId: string | null): Promise<{ reembedded: number; total: number }>;
  search(
    projectId: string | null,
    query: string,
    k: number,
  ): Promise<TextHit[]>;
}

interface CreateOptions {
  db: DB;
  projects: ProjectsService;
  items: ItemsService;
  library: LibraryService;
  embedder: TextEmbedder;
}

function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}

function vecToBlob(v: number[]): Buffer {
  const f = new Float32Array(v);
  return Buffer.from(f.buffer, f.byteOffset, f.byteLength);
}

function blobToVec(blob: Buffer): number[] {
  const f = new Float32Array(
    blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength),
  );
  return Array.from(f);
}

function snippetOf(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 280 ? `${t.slice(0, 277)}…` : t;
}

export function createTextIndex(opts: CreateOptions): TextIndex {
  const { db, projects, items, library, embedder } = opts;

  function gather(projectId: string | null): IndexedEntity[] {
    const pids =
      projectId === null
        ? projects.list({ includeArchived: true }).map((p) => p.id)
        : [projectId];
    const out: IndexedEntity[] = [];
    for (const pid of pids) {
      for (const it of items.list({ project_id: pid })) {
        const text = `${it.title}\n${it.description}`.trim();
        if (text === '') continue;
        out.push({
          entity_type: 'item',
          entity_id: it.id,
          project_id: pid,
          label: it.title,
          text,
        });
      }
      for (const e of library.list({ projectId: pid })) {
        const text = `${e.title}\n${e.body}`.trim();
        if (text === '') continue;
        out.push({
          entity_type: 'library',
          entity_id: e.id,
          project_id: pid,
          label: e.title,
          text,
        });
      }
    }
    return out;
  }

  async function ensureFresh(projectId: string | null) {
    const entities = gather(projectId);
    const liveIds = new Set(entities.map((e) => `${e.entity_type}:${e.entity_id}`));

    const scopeRows = (
      projectId === null
        ? (db
            .prepare(
              `SELECT entity_type, entity_id, content_hash FROM text_embeddings`,
            )
            .all() as Array<{ entity_type: string; entity_id: string; content_hash: string | null }>)
        : (db
            .prepare(
              `SELECT entity_type, entity_id, content_hash FROM text_embeddings WHERE project_id = ?`,
            )
            .all(projectId) as Array<{
            entity_type: string;
            entity_id: string;
            content_hash: string | null;
          }>)
    );
    const stored = new Map(
      scopeRows.map((r) => [`${r.entity_type}:${r.entity_id}`, r.content_hash]),
    );

    const stale: IndexedEntity[] = [];
    for (const e of entities) {
      const key = `${e.entity_type}:${e.entity_id}`;
      if (stored.get(key) !== contentHash(e.text)) stale.push(e);
    }

    const del = db.prepare(
      `DELETE FROM text_embeddings WHERE entity_type = ? AND entity_id = ?`,
    );
    // Prune vectors whose source entity is gone (within scope).
    for (const r of scopeRows) {
      if (!liveIds.has(`${r.entity_type}:${r.entity_id}`)) {
        del.run(r.entity_type, r.entity_id);
      }
    }

    if (stale.length > 0) {
      const vecs = await embedder.embed(stale.map((e) => e.text));
      const ins = db.prepare(
        `INSERT INTO text_embeddings
           (entity_type, entity_id, chunk_index, embedding_blob, project_id, content_hash, chunk_text)
           VALUES (?, ?, 0, ?, ?, ?, ?)`,
      );
      const tx = db.transaction(() => {
        for (let i = 0; i < stale.length; i++) {
          const e = stale[i]!;
          del.run(e.entity_type, e.entity_id);
          ins.run(
            e.entity_type,
            e.entity_id,
            vecToBlob(vecs[i]!),
            e.project_id,
            contentHash(e.text),
            snippetOf(e.text),
          );
        }
      });
      tx();
    }

    return { reembedded: stale.length, total: entities.length };
  }

  return {
    ensureFresh,

    async search(projectId, query, k) {
      await ensureFresh(projectId);
      const rows = (
        projectId === null
          ? (db
              .prepare(
                `SELECT entity_type, entity_id, embedding_blob, chunk_text FROM text_embeddings`,
              )
              .all() as Array<{
              entity_type: string;
              entity_id: string;
              embedding_blob: Buffer;
              chunk_text: string | null;
            }>)
          : (db
              .prepare(
                `SELECT entity_type, entity_id, embedding_blob, chunk_text
                   FROM text_embeddings WHERE project_id = ?`,
              )
              .all(projectId) as Array<{
              entity_type: string;
              entity_id: string;
              embedding_blob: Buffer;
              chunk_text: string | null;
            }>)
      );
      if (rows.length === 0) return [];
      const [qv] = await embedder.embed([query]);
      if (!qv) return [];
      const scored = rows.map((r) => ({
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        label: '',
        snippet: r.chunk_text ?? '',
        score: cosine(qv, blobToVec(r.embedding_blob)),
      }));
      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, k).filter((s) => s.score > 0);
      // Resolve a human label lazily for the survivors only.
      for (const s of top) {
        if (s.entity_type === 'item') {
          s.label = items.get(s.entity_id)?.title ?? s.entity_id;
        } else {
          s.label = library.get(s.entity_id)?.title ?? s.entity_id;
        }
      }
      return top;
    },
  };
}
