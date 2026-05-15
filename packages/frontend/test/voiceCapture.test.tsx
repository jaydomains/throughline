import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModalStackProvider } from '../src/keyboard/modalStack.js';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { DumpZone } from '../src/components/DumpZone.js';
import { VoiceCapture } from '../src/components/VoiceCapture.js';
import { resetMockApi } from './fixtures/mockApi.js';
import type { ItemPolicy } from '@throughline/shared';

// Mock SpeechRecognition so we can fire onresult events from the test and verify the
// transcript-duplication regression: cumulative interim transcripts must REPLACE the
// streamed portion, never append.

interface MockResultEvent {
  results: Array<{ 0: { transcript: string }; isFinal: boolean }>;
}

let mockInstance: {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  fireResult: (transcript: string) => void;
  fireEnd: () => void;
} | null = null;

class MockSpeechRecognition {
  lang = '';
  interimResults = false;
  continuous = false;
  onresult: ((ev: MockResultEvent) => void) | null = null;
  onerror: ((ev: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();

  constructor() {
    mockInstance = {
      start: this.start,
      stop: this.stop,
      fireResult: (transcript: string) => {
        this.onresult?.({ results: [{ 0: { transcript }, isFinal: false }] });
      },
      fireEnd: () => this.onend?.(),
    };
  }
}

beforeEach(() => {
  resetMockApi();
  (window as unknown as { SpeechRecognition: typeof MockSpeechRecognition }).SpeechRecognition =
    MockSpeechRecognition;
});

afterEach(() => {
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  mockInstance = null;
});

const freeformPolicy: ItemPolicy = {
  bundle_id: 'freeform',
  types: ['task'],
  statuses: ['open', 'done'],
  statuses_by_type: { task: ['open', 'done'] },
  boards: [{ id: 'tasks', label: 'Tasks', type: 'task', statuses: ['open', 'done'] }],
};

describe('VoiceCapture transcript-duplication regression', () => {
  it('passes the same cumulative transcript on each interim update (not a delta)', async () => {
    const onTranscript = vi.fn();
    const onStart = vi.fn();
    render(<VoiceCapture onTranscript={onTranscript} onStart={onStart} />);
    await userEvent.click(screen.getByTestId('voice-capture-toggle'));
    expect(onStart).toHaveBeenCalledTimes(1);

    act(() => {
      mockInstance!.fireResult('hello');
    });
    act(() => {
      mockInstance!.fireResult('hello world');
    });
    act(() => {
      mockInstance!.fireResult('hello world today');
    });
    // Each call is a full cumulative transcript, not a delta.
    expect(onTranscript).toHaveBeenNthCalledWith(1, 'hello');
    expect(onTranscript).toHaveBeenNthCalledWith(2, 'hello world');
    expect(onTranscript).toHaveBeenNthCalledWith(3, 'hello world today');
  });

  it('DumpZone preserves pre-voice typed text and replaces streamed portion on each update', async () => {
    const user = userEvent.setup();
    render(
      <ModalStackProvider>
        <DumpZone
          projectId="p1"
          target="session"
          policy={freeformPolicy}
          sessions={[]}
          defaultSessionId={null}
        />
      </ModalStackProvider>,
    );
    // Type some pre-voice text.
    const textarea = screen.getByTestId('dump-zone-textarea') as HTMLTextAreaElement;
    await user.type(textarea, 'typed first');

    // Start voice capture.
    await user.click(screen.getByTestId('voice-capture-toggle'));

    // Stream three cumulative transcripts.
    act(() => mockInstance!.fireResult('one'));
    expect(textarea.value).toBe('typed first\n\none');

    act(() => mockInstance!.fireResult('one two'));
    expect(textarea.value).toBe('typed first\n\none two');

    act(() => mockInstance!.fireResult('one two three'));
    expect(textarea.value).toBe('typed first\n\none two three');

    // Critically: the streamed portion was REPLACED each time, not APPENDED. If the bug
    // were back, textarea.value would be "typed first\n\none\n\none two\n\none two three"
    // by this point — almost three times the length.
    expect(textarea.value.length).toBeLessThan('typed first one two three'.length + 10);
  });

  it('discarding voice clears the snapshot so the next session starts fresh', async () => {
    const user = userEvent.setup();
    render(
      <ModalStackProvider>
        <DumpZone
          projectId="p1"
          target="session"
          policy={freeformPolicy}
          sessions={[]}
          defaultSessionId={null}
        />
      </ModalStackProvider>,
    );
    const textarea = screen.getByTestId('dump-zone-textarea') as HTMLTextAreaElement;

    // First voice session.
    await user.click(screen.getByTestId('voice-capture-toggle'));
    act(() => mockInstance!.fireResult('first attempt'));
    act(() => mockInstance!.fireEnd());
    expect(textarea.value).toBe('first attempt');

    // Discard the first attempt.
    await user.click(screen.getByTestId('voice-capture-discard'));
    // Textarea still holds the committed value (Discard only clears the local transcript
    // state inside VoiceCapture so the user can re-record). The pre-voice snapshot in
    // DumpZone is also cleared via onCancel, so the next start re-snapshots fresh.

    // Second voice session — start with the previously-committed text in place.
    await user.click(screen.getByTestId('voice-capture-toggle'));
    act(() => mockInstance!.fireResult('second attempt'));
    // The second session's snapshot was "first attempt", so the textarea becomes
    // "first attempt\n\nsecond attempt" — not "first attempt\n\nfirst attempt\n\nsecond attempt"
    // (which would indicate a stale snapshot from session 1).
    expect(textarea.value).toBe('first attempt\n\nsecond attempt');
  });
});
