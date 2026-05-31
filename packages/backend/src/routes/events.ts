import type { FastifyInstance } from 'fastify';

// SSE channel for backend-pushed updates. Phase 2 established the channel and
// proved connectivity with a periodic ping. The UI-redesign Slice 4 adds the
// first real producer: a `settings-changed` broadcast so theme changes
// hot-reload every open tab. The hub keeps a registry of connected writers so
// any backend service can fan out an event (CODE_SPEC §1).

const PING_INTERVAL_MS = 15_000;

type SendFn = (event: string, data: unknown) => void;

interface SSEConn {
  send: SendFn;
  // Tear down the underlying connection (clear the ping interval, end the socket).
  // Optional so test connections registered with just a `send` still work.
  close?: () => void;
}

export interface SSEHub {
  broadcast: (event: string, data: unknown) => void;
  // exposed for tests / introspection
  clientCount: () => number;
  // internal — used by the events route to track a connection (with its teardown).
  _add: (send: SendFn, close?: () => void) => () => void;
  // S7-02 — end every live connection at shutdown. SSE sockets are `reply.hijack()`'d,
  // so `app.close()` does not track or end them; without this they hang shutdown / leak.
  closeAll: () => void;
}

export function createSSEHub(): SSEHub {
  const clients = new Set<SSEConn>();
  return {
    broadcast(event, data) {
      for (const conn of clients) {
        try {
          conn.send(event, data);
        } catch {
          // A broken pipe surfaces on the next write; drop it defensively so
          // one dead connection can't break the fan-out for the rest.
          clients.delete(conn);
        }
      }
    },
    clientCount: () => clients.size,
    _add(send, close) {
      const conn: SSEConn = close ? { send, close } : { send };
      clients.add(conn);
      return () => clients.delete(conn);
    },
    closeAll() {
      // Snapshot first — each close() runs the connection's own cleanup (which also
      // unregisters it); deleting here too keeps the set consistent if close is absent.
      for (const conn of [...clients]) {
        try {
          conn.close?.();
        } catch {
          // Best-effort teardown; a throw on one socket must not abort the rest.
        }
        clients.delete(conn);
      }
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

    // Forward-declared so `send` (which may trigger teardown on a broken pipe) and the
    // ping interval can both reference cleanup before it is assigned below.
    let cleaned = false;
    let unregister: () => void = () => {};
    let interval: ReturnType<typeof setInterval> | null = null;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      unregister();
      if (interval) clearInterval(interval);
      try {
        reply.raw.end();
      } catch {
        // Socket already torn down — end() on a dead socket can throw; ignore.
      }
    };

    const send: SendFn = (event, data) => {
      // Guard the raw writes (SF5-11): a write to a broken pipe throws, and this `send` is
      // called both from the ping interval and from hub.broadcast — an unguarded throw
      // would escape the interval callback (and only the hub's broadcast had a guard). On
      // failure, tear down this connection.
      try {
        reply.raw.write(`event: ${event}\n`);
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch {
        cleanup();
      }
    };

    send('welcome', { at: new Date().toISOString() });
    // Register with the teardown so shutdown (hub.closeAll) can end this hijacked socket.
    unregister = hub._add(send, cleanup);

    let seq = 0;
    interval = setInterval(() => {
      seq += 1;
      send('ping', { seq, at: new Date().toISOString() });
    }, PING_INTERVAL_MS);
    // Don't keep the event loop / process alive solely for the SSE ping (S7-02).
    interval.unref?.();

    req.raw.on('close', cleanup);
    req.raw.on('error', cleanup);
  });
}
