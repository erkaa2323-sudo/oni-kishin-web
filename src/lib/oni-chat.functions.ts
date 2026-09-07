/** Guarded general-conversation path for public ONI BRAIN. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Turn = z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(1200) });
const Payload = z.object({ turns: z.array(Turn).min(1).max(12), publicContext: z.string().max(6000).optional() });

const ONI_WORKER_ENDPOINT = "https://oni-kishin-web.erkaa2323.workers.dev/api/oni-ai";
const ONI_WORKER_ORIGIN = "https://erkaa2323-sudo.github.io";
// Mobile users should never sit in a long frozen thinking state. If the Worker
// cannot answer promptly, return control to the local safe fallback.
const WORKER_TIMEOUT_MS = 12_000;

export type GeneralReply =
  | { ok: true; text: string; sources: Array<{ url: string; title: string }> }
  | { ok: false };

async function requestOniWorker(data: z.infer<typeof Payload>): Promise<GeneralReply> {
  const latest = data.turns.at(-1)?.content.trim();
  if (!latest) return { ok: false };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);
  try {
    const response = await fetch(ONI_WORKER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ONI_WORKER_ORIGIN },
      body: JSON.stringify({
        message: latest,
        history: data.turns.slice(0, -1).map((turn) => ({ role: turn.role === "assistant" ? "ai" : "user", text: turn.content })),
        knowledge: data.publicContext ?? "",
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn("[oni-brain] worker unavailable", { status: response.status });
      return { ok: false };
    }
    const packet = (await response.json()) as { ok?: boolean; reply?: unknown; text?: unknown; sources?: unknown };
    const text = typeof packet.reply === "string" ? packet.reply.trim() : typeof packet.text === "string" ? packet.text.trim() : "";
    if (!packet.ok || !text) return { ok: false };
    const sources = Array.isArray(packet.sources)
      ? packet.sources.flatMap((source) => {
          if (!source || typeof source !== "object") return [];
          const item = source as { url?: unknown; title?: unknown };
          if (typeof item.url !== "string" || !/^https?:\/\//i.test(item.url)) return [];
          return [{ url: item.url, title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : new URL(item.url).hostname }];
        }).filter((source, index, all) => all.findIndex((item) => item.url === source.url) === index).slice(0, 5)
      : [];
    return { ok: true, text: text.slice(0, 3200), sources };
  } catch (error) {
    console.warn("[oni-brain] worker request failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

export const oniGeneralChat = createServerFn({ method: "POST" })
  .validator((data: unknown) => Payload.parse(data))
  .handler(async ({ data }): Promise<GeneralReply> => requestOniWorker(data));
