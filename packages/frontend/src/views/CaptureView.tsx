import { useParams } from 'react-router-dom';
import { useItemPolicy } from '../hooks/useItemPolicy.js';
import { useSessions } from '../hooks/useSessions.js';
import { DumpZone } from '../components/DumpZone.js';

// First-class capture surface (UI redesign Slice 3). The dump zone was an
// embedded footnote inside SessionView; here it gets its own route. The
// existing DumpZoneReviewModal stays the review-before-apply sheet (T-D5).

export function CaptureView() {
  const { id: projectId } = useParams();
  const { policy } = useItemPolicy(projectId ?? null);
  const { sessions } = useSessions(projectId ?? null);

  return (
    <div className="capture" data-testid="view-capture">
      <div className="home-hero">
        <div className="home-hero-meta">
          <div className="eyebrow">Capture</div>
          <h1 className="h1">Dump zone</h1>
          <div className="muted">
            Paste or drop anything. Everything funnels through review-before-apply.
          </div>
        </div>
      </div>

      {!projectId && <p className="muted">Open a project to capture.</p>}
      {projectId && policy && (
        <DumpZone projectId={projectId} target="session" policy={policy} sessions={sessions} />
      )}
    </div>
  );
}
