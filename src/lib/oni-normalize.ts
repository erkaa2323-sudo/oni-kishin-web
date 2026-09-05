/**
 * Mongolian input normalization for ONI BRAIN.
 *
 * Users type Mongolian in Cyrillic, in Latin transliteration ("uulzalt hezee
 * bn"), with slang and with repeated/typo characters. This module produces a
 * single searchable haystack that contains BOTH the cleaned original and a
 * Latin -> Cyrillic transliteration, so keyword stems only need Cyrillic forms.
 *
 * Pure string logic. No network, no data access, no storage.
 */

/** Longest-first Latin digraphs, then single letters. */
const TRANSLIT: Array<[string, string]> = [
  ["shch", "щ"],
  ["kh", "х"],
  ["ch", "ч"],
  ["sh", "ш"],
  ["ts", "ц"],
  ["ya", "я"],
  ["yo", "ё"],
  ["yu", "ю"],
  ["ye", "е"],
  ["ee", "э"],
  ["ii", "и"],
  ["a", "а"],
  ["b", "б"],
  ["c", "ц"],
  ["d", "д"],
  ["e", "э"],
  ["f", "ф"],
  ["g", "г"],
  ["h", "х"],
  ["i", "и"],
  ["j", "ж"],
  ["k", "к"],
  ["l", "л"],
  ["m", "м"],
  ["n", "н"],
  ["o", "о"],
  ["p", "п"],
  ["q", "к"],
  ["r", "р"],
  ["s", "с"],
  ["t", "т"],
  ["u", "у"],
  ["v", "в"],
  ["w", "в"],
  ["x", "х"],
  ["y", "й"],
  ["z", "з"],
];

/** Common chat slang / shorthand expanded before matching. */
const SLANG: Array<[RegExp, string]> = [
  [/\bsn\b/g, "sain"],
  [/\bbn\b/g, "baina"],
  [/\bbnu\b/g, "baina uu"],
  [/\byu\b/g, "yu"],
  [/\bhz\b/g, "hezee"],
  [/\bzaa?\b/g, "za"],
  [/\bbro\b/g, "naiz"],
  [/\bплз\b/g, "гуй"],
  [/\bсн\b/g, "сайн"],
  [/\bбн\b/g, "байна"],
  [/\bхз\b/g, "хэзээ"],
  [/\bмаш(ин|ины)\b/g, "машин"],
];

function transliterate(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    let matched = false;
    for (const [lat, cyr] of TRANSLIT) {
      if (s.startsWith(lat, i)) {
        out += cyr;
        i += lat.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out += s[i];
      i += 1;
    }
  }
  return out;
}

/** Collapse 3+ repeated characters ("гоооё" -> "гооё") and strip punctuation. */
function squash(s: string): string {
  return s
    .replace(/[^\p{L}\p{N}\s?!]/gu, " ")
    .replace(/(.)\1{2,}/gu, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
}

export type NormalizedInput = {
  /** Original trimmed text, unchanged — used for display and for the model. */
  raw: string;
  /** Lowercased, punctuation-stripped text. */
  clean: string;
  /** clean + " " + transliterated clean. Match keyword stems against this. */
  haystack: string;
};

export function normalizeInput(raw: string): NormalizedInput {
  const trimmed = raw.trim();
  let clean = squash(trimmed.toLowerCase());
  for (const [re, rep] of SLANG) clean = clean.replace(re, rep);
  const cyr = transliterate(clean);
  return { raw: trimmed, clean, haystack: `${clean} ${cyr}` };
}

/** Does the normalized haystack contain any of these Cyrillic/latin stems? */
export function hasStem(n: NormalizedInput, ...stems: string[]): boolean {
  return stems.some((w) => n.haystack.includes(w));
}
