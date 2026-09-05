import { collection, getDocs } from "firebase/firestore";

import { firebaseDb } from "@/integrations/firebase/client";

export type GalleryCategory = "anime" | "clean" | "drift" | "other";

export type GalleryItem = {
  id: string;
  title: string;
  owner: string;
  category: GalleryCategory;
  build: string;
  image: string;
  createdAt: string | null;
};

export type GalleryLoad =
  { status: "ok"; rows: GalleryItem[] } | { status: "error"; reason: string };

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const dateValue = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
};

const categoryValue = (value: unknown): GalleryCategory => {
  const category = text(value).toLowerCase();
  return category === "anime" || category === "clean" || category === "drift" ? category : "other";
};

/** Public legacy gallery projection. Admin identity fields are never returned. */
export async function fetchGallery(): Promise<GalleryLoad> {
  try {
    const snapshot = await getDocs(collection(firebaseDb, "gallery"));
    const rows = snapshot.docs
      .map((entry): GalleryItem => {
        const row = entry.data();
        return {
          id: entry.id,
          title: text(row["title"]) || "ONI MOMENT",
          owner: text(row["owner"]) || "Oni And Kishin",
          category: categoryValue(row["category"]),
          build: text(row["build"]),
          image: text(row["image"]),
          createdAt: dateValue(row["createdAt"]),
        };
      })
      .filter((row) => row.image.startsWith("https://"))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return { status: "ok", rows };
  } catch {
    return { status: "error", reason: "Галерейн мэдээлэл ачаалж чадсангүй." };
  }
}

export const GALLERY_CATEGORIES: { id: GalleryCategory; label: string; code: string }[] = [
  { id: "anime", label: "АНИМЭ", code: "ANIME" },
  { id: "clean", label: "ЦЭВЭР", code: "CLEAN" },
  { id: "drift", label: "ДРИФТ", code: "DRIFT" },
];
