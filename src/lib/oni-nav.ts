/**
 * ONI HUB — navigation destinations.
 *
 * Single source of truth for the game-HUD navigation. Each destination maps to
 * a route file under src/routes/. Future database-backed modules
 * (crew roster, garage, music, meet, ONI AI, admin) plug into these same paths.
 */

export type OniDestination = {
  /** Route path (must match a file in src/routes) */
  to: "/" | "/crew" | "/garage" | "/gallery" | "/music" | "/join" | "/meet" | "/oni-ai" | "/admin";
  /** Primary interface language: Mongolian */
  label: string;
  /** Decorative game-world code label */
  code: string;
  /** Short Mongolian description used on the HUD */
  desc: string;
  /** Sector index shown in the HUD */
  index: string;
};

export const ONI_DESTINATIONS: OniDestination[] = [
  {
    to: "/",
    label: "НҮҮР",
    code: "HOME",
    desc: "ОНИ хотын гол хаалга",
    index: "00",
  },
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
    desc: "ONI Brain туслах ба хөгжмийн танхим",
    index: "03",
  },
  {
    to: "/join",
    label: "НЭГДЭХ",
    code: "JOIN",
    desc: "Элсэлтийн хүсэлт",
    index: "04",
  },
  {
    to: "/meet",
    label: "УУЛЗАЛТ",
    code: "MEET",
    desc: "Цугларалт ба уулзалт",
    index: "05",
  },
  {
    to: "/gallery",
    label: "ГАЛЕРЕЙ",
    code: "GALLERY",
    desc: "Кланы зураг ба дурсамж",
    index: "06",
  },
  {
    to: "/admin",
    label: "УДИРДЛАГА",
    code: "ADMIN",
    desc: "Хяналтын самбар",
    index: "07",
  },
];

export const CLAN_NAME = "Oni And Kishin";
export const CLAN_NAME_MN = "ОНИ БОЛОН КИШИН";
