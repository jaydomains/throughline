import { useCallback, useEffect, useRef, useState } from 'react';

// Voice input per §7.6. Browser-native SpeechRecognition. Desktop-only in v1 — when the
// browser does not expose SpeechRecognition (Firefox, mobile-Safari, the test jsdom env),
// the button renders disabled with a tooltip explaining why.
//
// Destination selection is handled by the dump-zone component the VoiceCapture is mounted
// inside (the toggle in §7.6 is conceptually "session vs library"; we surface it as
// "voice button lives inside the session/library dump zone" — each surface already has its
// own VoiceCapture instance, so the destination is unambiguous and the user picks by
// opening the session vs library dump zone before recording).

// Vendor-prefixed access; jsdom in tests doesn't define this so we treat absence as
// "unsupported" gracefully.
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike;
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface VoiceCaptureProps {
  // Called incrementally as the recognizer returns partial transcripts.
  onTranscript: (text: string) => void;
  // Called once when the user clicks "Submit" on a final transcript so the dump zone can
  // route directly into propose() without an extra click.
  onSubmit?: (text: string) => void;
  lang?: string;
}

export function VoiceCapture({ onTranscript, onSubmit, lang = 'en-US' }: VoiceCaptureProps) {
  const [supported] = useState(() => getRecognitionCtor() !== null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const stop = useCallback(() => {
    const r = recognitionRef.current;
    if (r) {
      try {
        r.stop();
      } catch {
        // Stop on an already-stopped recogniser throws; ignored.
      }
    }
    setRecording(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    setError(null);
    setTranscript('');
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (ev) => {
      let combined = '';
      for (let i = 0; i < ev.results.length; i++) {
        combined += ev.results[i]![0]!.transcript;
      }
      setTranscript(combined);
      onTranscript(combined);
    };
    r.onerror = (ev) => {
      setError(ev.error ?? 'speech-recognition-error');
      setRecording(false);
    };
    r.onend = () => {
      setRecording(false);
    };
    recognitionRef.current = r;
    try {
      r.start();
      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!supported) {
    return (
      <button
        type="button"
        disabled
        title="Voice input requires a browser with SpeechRecognition (Chrome / Edge on desktop)."
        data-testid="voice-capture-unsupported"
      >
        🎙 voice (unsupported)
      </button>
    );
  }

  return (
    <span className="voice-capture">
      <button
        type="button"
        onClick={() => (recording ? stop() : start())}
        data-testid="voice-capture-toggle"
        aria-pressed={recording}
      >
        {recording ? '◼ stop' : '🎙 voice'}
      </button>
      {recording && <span className="form-hint">listening…</span>}
      {transcript && !recording && onSubmit && (
        <button
          type="button"
          onClick={() => onSubmit(transcript)}
          data-testid="voice-capture-submit"
        >
          Send to dump zone
        </button>
      )}
      {error && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
