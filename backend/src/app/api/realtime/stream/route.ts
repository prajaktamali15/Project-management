import { NextRequest } from "next/server";

// Minimal Server-Sent Events endpoint for optional real-time updates
// Clients can connect and receive keep-alive pings. You can extend this by
// emitting domain events to all clients via a global subscribers set.

export const runtime = "nodejs";

type Subscriber = {
  id: string;
  write: (chunk: string) => void;
  close: () => void;
};

// In-memory subscribers (best-effort; not durable across server instances)
const subscribers = new Set<Subscriber>();

function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  subscribers.forEach((s) => {
    try { s.write(payload); } catch {}
  });
}

export async function GET(_: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const close = () => controller.close();
      const id = Math.random().toString(36).slice(2);

      const subscriber: Subscriber = { id, write, close };
      subscribers.add(subscriber);

      // Initial hello
      write(`event: hello\n` + `data: {"ok":true}\n\n`);

      // Keep-alive every 25s
      const interval = setInterval(() => {
        try { write(`event: ping\n` + `data: {"t":${Date.now()}}\n\n`); } catch {}
      }, 25000);

      // On cancel/close, clean up
      (controller as any).signal?.addEventListener?.("abort", () => {
        clearInterval(interval);
        subscribers.delete(subscriber);
      });
    },
    cancel() {
      // no-op
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

// Optional: export a simple broadcaster for other routes to import and send events
export const Realtime = { broadcast };



