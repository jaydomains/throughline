import type { FastifyInstance } from 'fastify';

// SSE channel for backend-pushed updates. Phase 2 established the channel and
// proved connectivity with a periodic ping. The UI-redesign Slice 4 adds the
// first real producer: a `settings-changed` broadcast so theme changes
// hot-reload every open tab. The hub keeps a registry of connected writers so
// any backend service can fan out an event (CODE_SPEC §1).

const PING_INTERVAL_MS = 15_000;

type SendFn = (event: string, data: unknown) => void;

export interface SSEHub {
  broadcast: (event: string, data: unknown) => void;
  // exposed for tests / introspection
  clientCount: () => number;
  // internal — used by the events route to track a connection
  _add: (send: SendFn) => () => void;
}

export function createSSEHub(): SSEHub {
  const clients = new Set<SendFn>();
  return {
    broadcast(event, data) {
      for (const send of clients) {
        try {
          send(event, data);
        } catch {
          // A broken pipe surfaces on the next write; drop it defensively so
          // one dead connection can't break the fan-out for the rest.
          clients.delete(send);
        }
      }
    },
    clientCount: () => clients.size,
    _add(send) {
      clients.add(send);
      return () => clients.delete(send);
    },
  };
}

export function registerEventsRoute(app: FastifyInstance, hub: SSEHub): void {
  app.get('/events', (req, reply) => {
    // Tell Fastify we are taking over the response — we write SSE frames
    // directly to the raw socket and keep the connection open.
    reply.hijack();

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });

    const send: SendFn = (event, data) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send('welcome', { at: new Date().toISOString() });
    const unregister = hub._add(send);

    let seq = 0;
    const interval = setInterval(() => {
      seq += 1;
      send('ping', { seq, at: new Date().toISOString() });
    }, PING_INTERVAL_MS);

    // Cleanup may fire twice (close + error on the same socket); guard so the
    // second call is a no-op. Convention: any cleanup registered on multiple
    // events should be idempotent by default.
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      unregister();
      clearInterval(interval);
      reply.raw.end();
    };

    req.raw.on('close', cleanup);
    req.raw.on('error', cleanup);
  });
}
