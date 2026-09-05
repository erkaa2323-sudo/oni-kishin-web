/**
 * ONI character state machine (frontend only).
 *
 * The chat UI never talks to the character directly — it emits a state name
 * and this module owns everything visual about that state. When the real ONI
 * Brain backend (or a Live2D / Rive / multi-expression asset set) arrives it
 * only has to emit the same `OniState` names; no chat logic changes.
 *
 * IMPORTANT: only ONE character image asset exists today, so states are
 * expressed through motion, framing, lighting and labels — never claim a
 * facial expression swap.
 */

export type OniState =
  | "idle"
  | "listening"
  | "thinking"
  | "happy"
  | "excited"
  | "concerned"
  | "serious"
  | "surprised"
  | "music";

export type OniStateVisual = {
  /** Mongolian status line shown under the unit name. */
  label: string;
  /** Decorative latin badge. */
  code: string;
  /** Tailwind classes applied to the character image wrapper. */
  motion: string;
  /** Rim/ambient light intensity 0..1 driving the crimson glow. */
  glow: number;
  /** Priority — higher states are not overridden by ambient music state. */
  priority: number;
};

export const ONI_STATE_VISUALS: Record<OniState, OniStateVisual> = {
  idle: {
    label: "ХҮЛЭЭЛТИЙН ГОРИМ",
    code: "IDLE",
    motion: "oni-anim-idle",
    glow: 0.25,
    priority: 0,
  },
  music: {
    label: "ХӨГЖИМ СОНСОЖ БАЙНА",
    code: "MUSIC",
    motion: "oni-anim-music",
    glow: 0.45,
    priority: 1,
  },
  listening: {
    label: "СОНСОЖ БАЙНА",
    code: "LISTENING",
    motion: "oni-anim-listening",
    glow: 0.4,
    priority: 2,
  },
  thinking: {
    label: "БОДОЖ БАЙНА",
    code: "THINKING",
    motion: "oni-anim-thinking",
    glow: 0.55,
    priority: 3,
  },
  happy: {
    label: "БАЯРТАЙ БАЙНА",
    code: "HAPPY",
    motion: "oni-anim-happy",
    glow: 0.6,
    priority: 3,
  },
  excited: {
    label: "СЭТГЭЛ ХӨДӨЛСӨН",
    code: "EXCITED",
    motion: "oni-anim-excited",
    glow: 0.8,
    priority: 4,
  },
  surprised: {
    label: "ГЭНЭТ ГАЙХСАН",
    code: "SURPRISED",
    motion: "oni-anim-surprised",
    glow: 0.7,
    priority: 4,
  },
  concerned: {
    label: "САНАА ЗОВНИЖ БАЙНА",
    code: "CONCERNED",
    motion: "oni-anim-concerned",
    glow: 0.3,
    priority: 3,
  },
  serious: {
    label: "НОЦТОЙ ГОРИМ",
    code: "SERIOUS",
    motion: "oni-anim-serious",
    glow: 0.5,
    priority: 3,
  },
};

/**
 * Transparent local heuristic — NOT a language model.
 * Maps submitted text to a conversational state using simple keyword sets.
 */
export function detectState(raw: string): OniState {
  const t = raw.toLowerCase();
  const has = (words: string[]) => words.some((w) => t.includes(w));

  if (has(["хөгжим", "дуу", "трэк", "music", "play", "тавь"])) return "music";
  if (has(["баяр", "гоё", "супер", "хаха", "инээ", "love", "❤", "😄", "😊"])) return "happy";
  if (has(["!!", "вау", "гайхал", "wow", "яамай", "🔥"])) return "excited";
  if (has(["гунигтай", "муу", "уучлаа", "асуудал", "тусла", "😢", "sorry"])) return "concerned";
  if (has(["дүрэм", "хууль", "анхаар", "аюул", "хатуу", "сануулга"])) return "serious";
  if (has(["үнэхээр", "яаж", "юу гэж", "really", "?!"])) return "surprised";
  return "thinking";
}

/**
 * Infer a visible reaction from BOTH the user's message and ONI's own reply.
 * Used for model-written answers so the character reflects tone instead of
 * freezing in a neutral pose. Uses existing states only; cheap and local.
 */
export function inferReplyState(userRaw: string, replyText: string): OniState {
  const user = detectState(userRaw);
  const t = replyText.toLowerCase();
  const has = (words: string[]) => words.some((w) => t.includes(w));

  if (has(["хаха", "хехе", "😄", "😂", "зүгээр шүү", "гоё байна", "баяртай"])) return "happy";
  if (has(["!!", "гайхалтай", "🔥", "гацууртай", "гоё"])) return "excited";
  if (has(["?!", "юу гэж", "үхээр", "🤔"])) return "surprised";
  if (has(["харамсалтай", "уучлаарай", "😢", "гунигтай"])) return "concerned";
  if (has(["бүү ", "хэзээ ч", "татгалз", "анхаар", "зөвшөөрөхгүй"])) return "serious";
  // Mirror strong user emotion when the reply itself is neutral.
  if (user === "excited" || user === "surprised") return user;
  if (user === "concerned") return "concerned";
  if (user === "happy") return "happy";
  return "happy";
}

/** Resolve which state should be shown given conversation + music context. */
export function resolveState(conversational: OniState | null, musicPlaying: boolean): OniState {
  if (conversational && ONI_STATE_VISUALS[conversational].priority > 1) return conversational;
  if (musicPlaying) return "music";
  return conversational ?? "idle";
}
