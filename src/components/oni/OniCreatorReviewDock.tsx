import { useEffect, useState } from "react";
import { Check, Images, Loader2, RefreshCw, X } from "lucide-react";

import {
  listCreatorPublishRequests,
  reviewCreatorPublishRequest,
  type CreatorPublishRequest,
} from "@/data/creator-publish";
import { useOniAuth } from "@/hooks/useOniAuth";

const PRESET_LABEL: Record<string, string> = {
  profile: "ПРОФАЙЛ",
  garage: "ГАРАЖ",
  instagram: "ИНСТАГРАМ",
  meet: "УУЛЗАЛТ",
  crew: "БАГ",
};

export function OniCreatorReviewDock() {
  const auth = useOniAuth();
  const authorized = auth.phase === "authorized";
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CreatorPublishRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    if (!authorized) return;
    setLoading(true);
    setNotice("");
    try {
      setRows(await listCreatorPublishRequests("pending"));
    } catch {
      setNotice("Нийтлүүлэхээр ирүүлсэн зургийн хүсэлтүүдийг ачаалж чадсангүй.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && authorized) void load();
  }, [open, authorized]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!authorized) return null;

  const review = async (row: CreatorPublishRequest, decision: "approved" | "rejected") => {
    setBusyId(row.id);
    setNotice("");
    try {
      await reviewCreatorPublishRequest(row.id, decision);
      setNotice(
        decision === "approved"
          ? "Зураг галерейд нийтлэгдлээ."
          : "Зургийн хүсэлтийг татгалзлаа.",
      );
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Зургийн хүсэлтийг шинэчилж чадсангүй.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[4.75rem] left-4 z-[66] inline-flex min-h-11 items-center gap-2 border border-crimson/45 bg-ink/95 px-3 text-[.62rem] font-semibold tracking-[.1em] text-foreground shadow-2xl clip-notch"
      >
        <Images className="h-4 w-4 text-crimson" />
        ЗУРГИЙН ХҮСЭЛТ
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/90 p-0 backdrop-blur-lg sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Нийтлүүлэх зургийн хүсэлт хянах"
        >
          <section className="flex max-h-[90svh] w-full max-w-4xl flex-col overflow-hidden border border-crimson/40 bg-ink sm:clip-notch">
            <header className="flex items-center gap-3 border-b border-border p-4">
              <Images className="h-5 w-5 text-crimson" />
              <div className="min-w-0 flex-1">
                <span className="hud-label block text-crimson/85">КОНТЕНТ ХЯНАЛТ</span>
                <h2 className="text-cinema text-2xl text-foreground">ЗУРГИЙН ХҮСЭЛТҮҮД</h2>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="grid h-11 w-11 place-items-center border border-border text-foreground clip-notch"
                aria-label="Шинэчлэх"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 place-items-center border border-border text-foreground clip-notch"
                aria-label="Хаах"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {notice ? (
                <p className="mb-4 border border-border bg-midnight/50 p-3 text-xs text-muted-foreground">
                  {notice}
                </p>
              ) : null}
              {loading ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ачаалж байна…
                </p>
              ) : rows.length === 0 ? (
                <div className="border border-dashed border-border p-8 text-center">
                  <span className="hud-label">ХҮЛЭЭГДЭЖ БУЙ ЗУРАГ АЛГА</span>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Нийтлүүлэхээр ирүүлсэн шинэ зургийн хүсэлт одоогоор алга.
                  </p>
                </div>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {rows.map((row) => (
                    <li
                      key={row.id}
                      className="overflow-hidden border border-border bg-midnight/40"
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-ink">
                        <img
                          src={row.image}
                          alt={row.title}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="p-4">
                        <span className="hud-label text-crimson/80">
                          {PRESET_LABEL[row.preset] ?? row.preset.toUpperCase()}
                        </span>
                        <p className="mt-1 truncate text-cinema text-xl text-foreground">
                          {row.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.nickname}
                          {row.cpmId ? ` · CPM ${row.cpmId}` : ""}
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void review(row, "approved")}
                            className="inline-flex min-h-11 items-center justify-center gap-2 border border-emerald-500/50 bg-emerald-500/10 text-xs text-emerald-200 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                            БАТЛАХ
                          </button>
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void review(row, "rejected")}
                            className="inline-flex min-h-11 items-center justify-center gap-2 border border-crimson/50 bg-crimson/10 text-xs text-crimson disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                            ТАТГАЛЗАХ
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
