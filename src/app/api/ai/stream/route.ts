import { currentAiContext } from "@/lib/ai/actor";
import { askStream } from "@/lib/ai/orchestrator";

// POST /api/ai/stream — Server-Sent Events; streams the assistant answer token-by-token.
export async function POST(req: Request) {
  const ctx = await currentAiContext();
  if (!ctx) return new Response("event: error\ndata: Not signed in.\n\n", { status: 401, headers: { "content-type": "text/event-stream" } });
  const { actor: user, scope } = ctx;
  let body: { message?: string; conversationId?: number };
  try { body = await req.json(); } catch { return new Response("event: error\ndata: Invalid body.\n\n", { status: 400, headers: { "content-type": "text/event-stream" } }); }
  const message = (body.message ?? "").trim();
  if (!message) return new Response("event: error\ndata: Empty message.\n\n", { status: 422, headers: { "content-type": "text/event-stream" } });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        for await (const ev of askStream(user, { message, conversationId: body.conversationId ? Number(body.conversationId) : undefined }, scope)) {
          if (ev.chunk) send("chunk", ev.chunk);
          if (ev.done) send("done", ev.done);
        }
      } catch (e) {
        send("error", e instanceof Error ? e.message : "stream failed");
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
