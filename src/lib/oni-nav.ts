/**
 * ONI HUB — navigation destinations.
 *
 * Single source of truth for the game-HUD navigation. Each destination maps to
 * a route file under src/routes/.
 */

export type OniDestination = {
  to:
    | "/"
    | "/crew"
    | "/garage"
    | "/gallery"
    | "/music"
    | "/join"
    | "/meet"
    | "/oni-ai"
    | "/shop"
    | "/admin";
  label: string;
  code: string;
  desc: string;
  index: string;
};

export const ONI_DESTINATIONS: OniDestination[] = [
  { to: "/", label: "НҮҮР", code: "HOME", desc: "ОНИ хотын гол хаалга", index: "00" },
  {
    to: "/crew",
    label: "БҮРЭЛДЭХҮҮН",
    code: "CREW",
    desc: "Кланы гишүүдийн бүртгэл",
    index: "01",
  },
  {
    to: "/garage",
    label: "ГАРАЖ",
    code: "GARAGE",
    desc: "Автомашины цуглуулга",
    index: "02",
  },
  {
    to: "/oni-ai",
    label: "ОНИ АЙ",
    code: "ONI AI / MUSIC",
    desc: "Oni Shizuki туслах ба хөгжмийн танхим",
    index: "03",
  },
  {
    to: "/shop",
    label: "ОНИ ШОП",
    code: "SHOP / VAULT",
    desc: "ONI Coin-оор effect, cosmetic unlock хийж equip хийх",
    index: "04",
  },
  { to: "/join", label: "НЭГДЭХ", code: "JOIN", desc: "Элсэлтийн хүсэлт", index: "05" },
  { to: "/meet", label: "УУЛЗАЛТ", code: "MEET", desc: "Цугларалт ба уулзалт", index: "06" },
  {
    to: "/gallery",
    label: "ГАЛЕРЕЙ",
    code: "GALLERY",
    desc: "Кланы зураг ба дурсамж",
    index: "07",
  },
  {
    to: "/admin",
    label: "УДИРДЛАГА",
    code: "ADMIN",
    desc: "Хяналтын самбар",
    index: "08",
  },
];

export const CLAN_NAME = "Oni And Kishin";
export const CLAN_NAME_MN = "ОНИ БОЛОН КИШИН";
