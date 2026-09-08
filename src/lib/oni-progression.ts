export const ONI_RANKS = [
  { name: "AWAKENED", minXp: 0 },
  { name: "ONI I", minXp: 500 },
  { name: "ONI II", minXp: 1500 },
  { name: "ONI III", minXp: 3000 },
  { name: "KISHIN I", minXp: 5500 },
  { name: "KISHIN II", minXp: 8500 },
  { name: "KISHIN III", minXp: 12500 },
  { name: "SHURA", minXp: 18000 },
  { name: "LEGEND", minXp: 26000 },
] as const;

export type OniProgressionProfile = {
  uid: string;
  nickname: string;
  xp: number;
  coin: number;
  lifetimeXp: number;
  seasonXp: number;
  prestige: number;
  meetCount: number;
  creatorCount: number;
  eventCount: number;
  unlocked: string[];
  equipped: Record<string, string>;
};

export type OniVaultItem = {
  id: string;
  name: string;
  category: "frame" | "aura" | "garage" | "shizuki" | "title" | "entrance" | "creator" | "trophy";
  rarity: "RARE" | "EPIC" | "LEGENDARY";
  price: number;
  minXp: number;
  description: string;
};

export const ONI_VAULT: OniVaultItem[] = [
  {
    id: "frame-crimson",
    name: "CRIMSON ONI FRAME",
    category: "frame",
    rarity: "RARE",
    price: 700,
    minXp: 500,
    description:
      "Худалдан аваад EQUIP хийхэд таны Crew/Profile card crimson ONI хүрээтэй болж, бусад member-ээс шууд ялгарна.",
  },
  {
    id: "aura-red-moon",
    name: "RED MOON AURA",
    category: "aura",
    rarity: "EPIC",
    price: 1800,
    minXp: 3000,
    description:
      "EQUIP хийхэд таны Profile card-ийн ард хөдөлгөөнт Red Moon aura асаж, profile-ийн visual presence илүү хүчтэй болно.",
  },
  {
    id: "garage-neon",
    name: "NEXUS NEON GARAGE",
    category: "garage",
    rarity: "EPIC",
    price: 2200,
    minXp: 3000,
    description:
      "EQUIP хийхэд таны Garage showcase cyber-neon орчин, гэрэлтүүлгийн cosmetic effect-тэй болж харагдана.",
  },
  {
    id: "shizuki-kitsune",
    name: "SHIZUKI // KITSUNE MODE",
    category: "shizuki",
    rarity: "LEGENDARY",
    price: 4500,
    minXp: 8500,
    description:
      "EQUIP хийхэд ONI AI / Shizuki хэсэг Kitsune theme visual mode-д шилжиж, тусгай character cosmetic мэдрэмж өгнө.",
  },
  {
    id: "title-night-rider",
    name: "NIGHT RIDER",
    category: "title",
    rarity: "RARE",
    price: 900,
    minXp: 1500,
    description:
      "EQUIP хийхэд таны Profile дээр NIGHT RIDER тусгай title харагдаж, member identity-ийн нэг хэсэг болно.",
  },
  {
    id: "entrance-kishin",
    name: "KISHIN ARRIVAL",
    category: "entrance",
    rarity: "LEGENDARY",
    price: 5000,
    minXp: 12500,
    description:
      "EQUIP хийсэн member Meet-д оролцох үед participant card дээр legendary KISHIN entrance cosmetic ажиллана.",
  },
  {
    id: "creator-red-moon",
    name: "RED MOON CREATOR PACK",
    category: "creator",
    rarity: "EPIC",
    price: 2600,
    minXp: 5500,
    description:
      "EQUIP хийхэд Creator/Gallery дахь таны контент Red Moon visual treatment авч, creator post-ууд илүү ялгарах cosmetic pack болно.",
  },
  {
    id: "trophy-vault",
    name: "TROPHY VAULT SLOT",
    category: "trophy",
    rarity: "RARE",
    price: 1200,
    minXp: 1500,
    description:
      "Худалдан авснаар Profile collection-д нэмэлт Trophy Vault slot нээгдэж, achievement/trophy collection-оо өргөжүүлэх боломжтой болно.",
  },
];

export function rankForXp(xp: number) {
  return [...ONI_RANKS].reverse().find((rank) => xp >= rank.minXp) ?? ONI_RANKS[0];
}

export function levelForXp(xp: number) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 125)) + 1);
}

export function nextRankForXp(xp: number) {
  return ONI_RANKS.find((rank) => rank.minXp > xp) ?? null;
}
