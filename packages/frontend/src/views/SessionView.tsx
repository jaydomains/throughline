import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Session } from '@throughline/shared';
import { useItems } from '../hooks/useItems.js';
import { useItemPolicy } from '../hooks/useItemPolicy.js';
import { useSessions } from '../hooks/useSessions.js';
import { useStaleThreshold } from '../hooks/useStaleThreshold.js';
import { useDirectives, directivesFor, isPinned } from '../hooks/useDirectives.js';
import { ItemDetailPanel } from '../components/ItemDetailPanel.js';
import { Board } from '../components/Board.js';
import { DumpZone } from '../components/DumpZone.js';
import { ReconcileComposer } from '../components/ReconcileComposer.js';
import { PrBadges } from '../components/PrBadges.js';
import { CopySessionMarkdown } from '../components/CopySessionMarkdown.js';
import { LoadError } from '../components/LoadError.js';

export function SessionView() {
  const { id, sessionId } = useParams();
  const projectId = id ?? null;
  const { sessions, error: sessionsError } = useSessions(projectId);
  const session: Session | null = useMemo(
    () => sessions.find((s) => s.id === sessionId) ?? null,
    [sessions, sessionId],
  );
  const { policy } = useItemPolicy(projectId);
  const { items, refresh, error: itemsError } = useItems({
    projectId,
    ...(sessionId ? { sessionId } : {}),
  });
  const staleDays = useStaleThreshold();
  const { byParent: directivesByParent, refresh: refreshDirectives } = useDirectives(projectId);
  const pinnedIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (isPinned(directivesFor(directivesByParent, 'item', item.id))) set.add(item.id);
    }
    return set;
  }, [items, directivesByParent]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const orderedIds = items.map((i) => i.id);

  // When detail panel cycles via arrow keys, keep selection in range.
  useEffect(() => {
    if (selectedId && !orderedIds.includes(selectedId)) setSelectedId(null);
  }, [orderedIds, selectedId]);

  if (!projectId || !sessionId) return null;

  return (
    <div className="session-view" data-testid="session-view">
      <div className="session-head">
        <h1>{session?.name ?? '…'}</h1>
        <CopySessionMarkdown session={session} items={items} />
      </div>
      <PrBadges projectId={projectId} />
      <LoadError error={sessionsError} what="sessions" />
      <LoadError error={itemsError} what="items" />
      {policy && (
        <div className="boards">
          {policy.boards.map((board) => (
            <Board
              key={board.id}
              projectId={projectId}
              sessionId={sessionId}
              board={board}
              policy={policy}
              items={items.filter((i) => i.type === board.type)}
              pinnedIds={pinnedIds}
              staleDays={staleDays}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRefresh={() => {
                refresh();
                void refreshDirectives();
              }}
            />
          ))}
        </div>
      )}

      {selectedId && policy && (
        <ItemDetailPanel
          projectId={projectId}
          itemId={selectedId}
          policy={policy}
          staleDays={staleDays}
          siblings={orderedIds}
          onCycle={(nextId) => setSelectedId(nextId)}
          onClose={() => setSelectedId(null)}
          onChanged={refresh}
        />
      )}

      {policy && (
        <DumpZone
          projectId={projectId}
          target="session"
          policy={policy}
          sessions={sessions}
          defaultSessionId={sessionId}
          onApplied={() => refresh()}
        />
      )}
      <ReconcileComposer
        projectId={projectId}
        sessionId={sessionId}
        onApplied={() => refresh()}
      />
    </div>
  );
}
