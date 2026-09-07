/**
 * ONI character state machine (frontend only).
 *
 * The chat UI never talks to the character directly — it emits a state name
 * and this module owns everything visual about that state. A Live2D renderer
 * can consume the same states without coupling itself to the chat logic.
 */

export type OniState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "happy"
  | "excited"
  | "concerned"
  | "serious"
  | "surprised"
  | "music";

export type OniStateVisual = {
  label: string;
  code: string;
  motion: string;
  glow: number;
  priority: number;
};

export const ONI_STATE_VISUALS: Record<OniState, OniStateVisual> = {
  idle: { label: "ХҮЛЭЭЛТИЙН ГОРИМ", code: "IDLE", motion: "oni-anim-idle", glow: 0.25, priority: 0 },
  music: { label: "ХӨГЖИМ СОНСОЖ БАЙНА", code: "MUSIC", motion: "oni-anim-music", glow: 0.45, priority: 1 },
  listening: { label: "СОНСОЖ БАЙНА", code: "LISTENING", motion: "oni-anim-listening", glow: 0.4, priority: 2 },
  thinking: { label: "БОДОЖ БАЙНА", code: "THINKING", motion: "oni-anim-thinking", glow: 0.55, priority: 3 },
  speaking: { label: "ХАРИУЛЖ БАЙНА", code: "VOICE", motion: "oni-anim-speaking", glow: 0.68, priority: 4 },
  happy: { label: "БАЯРТАЙ БАЙНА", code: "HAPPY", motion: "oni-anim-happy", glow: 0.6, priority: 3 },
  excited: { label: "СЭТГЭЛ ХӨДӨЛСӨН", code: "EXCITED", motion: "oni-anim-excited", glow: 0.8, priority: 4 },
  surprised: { label: "ГЭНЭТ ГАЙХСАН", code: "SURPRISED", motion: "oni-anim-surprised", glow: 0.7, priority: 4 },
  concerned: { label: "САНАА ЗОВНИЖ БАЙНА", code: "CONCERNED", motion: "oni-anim-concerned", glow: 0.3, priority: 3 },
  serious: { label: "НОЦТОЙ ГОРИМ", code: "SERIOUS", motion: "oni-anim-serious", glow: 0.5, priority: 3 },
};

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function scoreText(text: string) {
  const t = text.toLowerCase();
  const scores: Partial<Record<OniState, number>> = {};
  const add = (state: OniState, weight: number) => {
    scores[state] = (scores[state] ?? 0) + weight;
  };

  if (includesAny(t, ["хөгжим", "дуу", "трэк", "music", "play", "тавь", "сонсъё"])) add("music", 4);

  if (includesAny(t, ["баярлалаа", "баяртай", "гоё", "сайхан", "хөөрхөн", "мундаг", "супер", "хаха", "хэхэ", "love", "😄", "😊", "❤️", "❤"])) add("happy", 4);
  if (includesAny(t, ["вау", "wow", "гайхалтай", "тасархай", "аймар гоё", "яамай", "🔥", "!!", "ёстой гоё"])) add("excited", 5);
  if (includesAny(t, ["гайхлаа", "үнэхээр", "нээрээ", "really", "?!", "яаж", "яагаад", "юу гэж", "ийм гэж үү"])) add("surprised", 3);

  if (includesAny(t, ["гуниг", "гунигтай", "муу байна", "хэцүү", "асуудал", "санаа зов", "уучлаарай", "харамсалтай", "туслаач", "😢", "😭", "sorry"])) add("concerned", 5);
  if (includesAny(t, ["аюул", "аюултай", "анхаар", "хатуу", "сануулга", "хориг", "зөвшөөрөхгүй", "болохгүй", "дүрэм", "хууль", "эрсдэл", "ноцтой", "яаралтай"])) add("serious", 5);

  if (includesAny(t, ["бодъё", "бодож", "судлая", "шалгая", "нягтал", "дүгнэ", "тооцоол", "анализ", "analysis"])) add("thinking", 3);

  return scores;
}

function bestScoredState(scores: Partial<Record<OniState, number>>, fallback: OniState) {
  let best = fallback;
  let bestScore = -1;
  for (const [state, score] of Object.entries(scores) as Array<[OniState, number]>) {
    if (score > bestScore) {
      best = state;
      bestScore = score;
    }
  }
  return best;
}

/** Transparent local heuristic — NOT a language model. */
export function detectState(raw: string): OniState {
  return bestScoredState(scoreText(raw), "thinking");
}

/**
 * Infer a visible reaction from BOTH the user's message and ONI's own reply.
 * Reply wording has slightly more weight, while strong user emotion is kept as
 * a tie-breaker so ONI visibly mirrors the conversation instead of defaulting
 * to a smile after every answer.
 */
export function inferReplyState(userRaw: string, replyText: string): OniState {
  const userScores = scoreText(userRaw);
  const replyScores = scoreText(replyText);
  const combined: Partial<Record<OniState, number>> = {};

  const merge = (source: Partial<Record<OniState, number>>, multiplier: number) => {
    for (const [state, score] of Object.entries(source) as Array<[OniState, number]>) {
      combined[state] = (combined[state] ?? 0) + score * multiplier;
    }
  };

  merge(userScores, 0.8);
  merge(replyScores, 1.25);

  const reply = replyText.toLowerCase();
  if (reply.includes("анхаар") || reply.includes("эрсдэл") || reply.includes("болохгүй")) {
    combined.serious = (combined.serious ?? 0) + 3;
  }
  if (reply.includes("уучлаарай") || reply.includes("харамсалтай")) {
    combined.concerned = (combined.concerned ?? 0) + 3;
  }
  if (reply.includes("баяртай") || reply.includes("гоё байна")) {
    combined.happy = (combined.happy ?? 0) + 2;
  }

  const best = bestScoredState(combined, "happy");
  return best === "music" ? "happy" : best;
}

/** Resolve which state should be shown given conversation + music context. */
export function resolveState(conversational: OniState | null, musicPlaying: boolean): OniState {
  if (conversational && ONI_STATE_VISUALS[conversational].priority > 1) return conversational;
  if (musicPlaying) return "music";
  return conversational ?? "idle";
}
