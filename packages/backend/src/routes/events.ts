import type { FastifyInstance } from 'fastify';

// SSE channel for backend-pushed updates. Phase 2 establishes the channel and
// proves connectivity with a periodic ping. Later phases multiplex drift signals,
// gate firings, cost meter, polling state, and bundle reloads through this stream
// (CODE_SPEC §1).

const PING_INTERVAL_MS = 15_000;

export function registerEventsRoute(app: FastifyInstance): void {
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

    const send = (event: string, data: unknown): void => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send('welcome', { at: new Date().toISOString() });

    let seq = 0;
    const interval = setInterval(() => {
      seq += 1;
      send('ping', { seq, at: new Date().toISOString() });
    }, PING_INTERVAL_MS);

    const cleanup = () => {
      clearInterval(interval);
      reply.raw.end();
    };

    req.raw.on('close', cleanup);
    req.raw.on('error', cleanup);
  });
}
