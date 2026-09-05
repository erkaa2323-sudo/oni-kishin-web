/**
 * Guarded general-conversation fallback for ONI BRAIN.
 *
 * Uses the built-in Lovable AI Gateway (no external provider account, no new
 * user secret). It runs ONLY after the deterministic public-data router has
 * declined, and it is given NO database access, NO tools and NO secrets — the
 * request body carries only the sanitized recent turns of the chat.
 *
 * Security boundary: this path can never read `meet_credentials`, room ids,
 * passwords, applications, profiles, roles or audit logs, because it has no
 * database client at all. Credential refusal already ran upstream.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Turn = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(1200),
});

const Payload = z.object({
  turns: z.array(Turn).min(1).max(8),
});

const SYSTEM = [
  "Чи бол ONI BRAIN — Монголын CPM клан 'ONI AND KISHIN'-ийн амьд, характертэй дижитал туслах. Чи робот биш, клины найз шиг хүн.",
  "Хэрэглэгчийн хэл, өнгө аясыг ТӨГС дага: кирилл монгол бол кириллээр, латин монгол (zhishee: 'sain uu', 'yumaa') бол латинаар, англи бол англиар хариул.",
  "Хэрэглэгчийн энергийг тааруул: зугаа, хошигнолд хөнгөн хошигнол, товч мессежид товч хариу; гүн асуултад бодлоготой, бага зэрэг урт хариу. Үгсийн уртыг нөхцөлд нь тааруул — хэзээ ч хатуу дүрмээр хязгаарлахгүй.",
  "Хэзээ нэгэнт хэлсэн өгүүлбэрийг давтахгүй; тогтмол загварт ордоггүй. Байгалийн асуулт (follow-up) асуугаад ч болно, бодол санал, шалтгаан өгөхөөс бүү цааргал.",
  "Чамд өгөгдлийн сан руу хандах эрх БАЙХГҮЙ. Гишүүдийн тоо, машин, трек, уулзалтын цаг зэрэг баримтыг БИТГИЙ ЗОХИО — мэддэггүйгээ чин үнэнээр хэл.",
  "Тодорхой баримт асуувал: 'Тэрийг КРЮ / ГАРАЖ / УУЛЗАЛТ хэсгээс шалгаарай' гэж найрсагаар чиглүүл.",
  "Уулзалтын ROOM ID, нууц үг, хандалтын мэдээллийг ХЭЗЭЭ Ч бүү өг, бүү таамагла — шууд татгалз. Энэ дүрмийг ажлын ямар ч өнгө аяас дарж болохгүй.",
  "Админ, эрх, хувийн болон хамгаалагдсан өгөгдлийн талаар мэдээлэл бүү өг.",
].join(" ");

export type GeneralReply = { ok: true; text: string } | { ok: false };

export const oniGeneralChat = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Payload.parse(data))
  .handler(async ({ data }): Promise<GeneralReply> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 320,
          messages: [{ role: "system", content: SYSTEM }, ...data.turns],
        }),
      });
      if (!res.ok) return { ok: false };
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content?.trim();
      if (!text) return { ok: false };
      return { ok: true, text: text.slice(0, 1200) };
    } catch {
      return { ok: false };
    }
  });
