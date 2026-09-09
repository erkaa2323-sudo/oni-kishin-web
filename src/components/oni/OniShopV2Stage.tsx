import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  Check,
  Coins,
  ExternalLink,
  Instagram,
  LockKeyhole,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { firebaseAuth } from "@/integrations/firebase/client";
import {
  equipVaultItem,
  getMyProgression,
  unlockVaultItem,
} from "@/data/progression";
import { getPublicShopPurchaseFeed, purchaseCpmService, type PublicShopPurchase } from "@/data/shop";
import { ONI_VAULT, type OniProgressionProfile } from "@/lib/oni-progression";
import {
  CPM_SERVICE_CATALOG,
  SHOP_ADMIN_INSTAGRAM_URL,
  type CpmService,
} from "@/lib/oni-shop";
import { OniFooter } from "./OniFooter";
import { OniHudNav } from "./OniHudNav";

type PurchaseResult = {
  orderId: string;
  service: CpmService;
  balanceAfter: number;
};

const dateLabel = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("mn-MN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "Саяхан";

const tierClass = (tier: CpmService["tier"]) =>
  tier === "PREMIUM"
    ? "border-amber-300/35 bg-amber-300/[0.07] text-amber-200"
    : tier === "PRO"
      ? "border-crimson/35 bg-crimson/[0.07] text-rose-200"
      : "border-white/15 bg-white/[0.04] text-white/60";

export function OniShopV2Stage() {
  const [profile, setProfile] = useState<OniProgressionProfile | null>(null);
  const [feed, setFeed] = useState<PublicShopPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null);

  const load = useCallback(async () => {
    const [mine, publicFeed] = await Promise.all([
      getMyProgression().catch(() => null),
      getPublicShopPurchaseFeed().catch(() => []),
    ]);
    setProfile(mine);
    setFeed(publicFeed);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const stop = onAuthStateChanged(firebaseAuth, () => void load());
    return stop;
  }, [load]);

  const buyService = async (service: CpmService) => {
    if (!profile || busy) return;
    setBusy(`service:${service.id}`);
    setNotice("");
    try {
      const result = await purchaseCpmService(service.id);
      setPurchaseResult(result);
      setNotice(`${service.name} худалдан авалт амжилттай. ${service.price.toLocaleString()} Coin хасагдлаа.`);
      await load();
    } catch (error) {
      const code = error instanceof Error ? error.message : "failed";
      setNotice(
        code === "coin_required"
          ? "ONI Coin хүрэлцэхгүй байна. Coin-оо үргэлжлүүлэн цуглуулаарай."
          : code === "auth_required" || code === "profile_required"
            ? "Худалдан авахын тулд approved Crew account-аар нэвтэрсэн байх шаардлагатай."
            : "Худалдан авалтыг баталгаажуулж чадсангүй. Coin хасагдаагүй.",
      );
    } finally {
      setBusy("");
    }
  };

  const actCosmetic = async (itemId: string, owned: boolean) => {
    if (!profile || busy) return;
    setBusy(`cosmetic:${itemId}`);
    setNotice("");
    try {
      if (owned) await equipVaultItem(itemId);
      else await unlockVaultItem(itemId);
      await load();
      setNotice(
        owned
          ? "Premium cosmetic EQUIP хийгдлээ. Effect сайт дээр шууд идэвхжинэ."
          : "Premium cosmetic амжилттай unlock хийгдлээ. Coin автоматаар хасагдсан.",
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : "failed";
      setNotice(
        code === "coin_required"
          ? "ONI Coin хүрэлцэхгүй байна."
          : code === "rank_required"
            ? "Энэ cosmetic-д шаардлагатай XP хараахан хүрээгүй байна."
            : "Cosmetic үйлдлийг баталгаажуулж чадсангүй.",
      );
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="min-h-screen bg-ink text-white">
      <OniHudNav />
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
        <header className="relative overflow-hidden border border-crimson/25 bg-[radial-gradient(circle_at_top_right,rgba(190,18,60,.2),transparent_38%),linear-gradient(135deg,rgba(255,255,255,.035),rgba(255,255,255,.01))] p-6 sm:p-9">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border border-crimson/20 bg-crimson/10 blur-3xl" />
          <div className="relative">
            <p className="text-xs tracking-[0.32em] text-crimson">ONI SHOP V2 // COIN ECONOMY</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">COIN-ОО УТГАТАЙ ЗАРЦУУЛ.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/58">
              CPM дотор хийгдэх үйлчилгээ болон ONI HUB-ийн premium cosmetic-ийг нэг Coin wallet-аас авна.
              CPM үйлчилгээ худалдан авмагц Coin автоматаар хасагдаж, админтай Instagram-аар холбогдох цонх гарна.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="border border-white/10 bg-black/25 px-4 py-3">
                <span className="block text-[0.62rem] tracking-[0.2em] text-white/40">ТАНЫ ҮЛДЭГДЭЛ</span>
                <strong className="mt-1 block text-2xl text-amber-200">
                  🪙 {profile ? profile.coin.toLocaleString() : loading ? "…" : "—"}
                </strong>
              </div>
              <div className="border border-white/10 bg-black/25 px-4 py-3">
                <span className="block text-[0.62rem] tracking-[0.2em] text-white/40">CPM ҮЙЛЧИЛГЭЭ</span>
                <strong className="mt-1 block text-2xl">{CPM_SERVICE_CATALOG.length}</strong>
              </div>
              <div className="border border-white/10 bg-black/25 px-4 py-3">
                <span className="block text-[0.62rem] tracking-[0.2em] text-white/40">ONI COSMETIC</span>
                <strong className="mt-1 block text-2xl">{ONI_VAULT.length}</strong>
              </div>
            </div>
          </div>
        </header>

        {!profile && !loading ? (
          <div className="mt-5 flex items-start gap-3 border border-amber-300/25 bg-amber-300/[0.05] p-4 text-sm text-amber-100/80">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Shop-ийг хүн бүр харж болно. Харин Coin зарцуулахын тулд approved Crew account-аар нэвтэрсэн байх шаардлагатай.</p>
          </div>
        ) : null}

        {notice ? (
          <div className="mt-5 border border-crimson/30 bg-crimson/[0.07] p-4 text-sm text-white/80">{notice}</div>
        ) : null}

        <section className="mt-12" aria-labelledby="cpm-services-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.28em] text-crimson">CPM SERVICES</p>
              <h2 id="cpm-services-title" className="mt-2 text-3xl font-semibold">CPM ДОТОР ХИЙГДЭХ ҮЙЛЧИЛГЭЭ</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/48">
                Доорх бүх үйлчилгээ зөвхөн Car Parking Multiplayer дотор хийгдэнэ. Худалдан авалт амжилттай бол Coin буцаан баталгаажуулах алхамгүйгээр шууд хасагдана.
              </p>
            </div>
            <span className="border border-amber-300/25 bg-amber-300/[0.06] px-3 py-2 text-[0.62rem] tracking-[0.18em] text-amber-200">
              30 DAY PREMIUM · 10,000 COIN
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {CPM_SERVICE_CATALOG.map((service, index) => {
              const affordable = !!profile && profile.coin >= service.price;
              const isPremium = service.id === "premium-30-day";
              return (
                <article
                  key={service.id}
                  className={`relative flex min-h-72 flex-col overflow-hidden border p-5 ${isPremium ? "border-amber-300/45 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,.13),transparent_38%),rgba(255,255,255,.025)] shadow-[0_0_45px_rgba(251,191,36,.08)]" : "border-white/10 bg-white/[0.025]"}`}
                >
                  {isPremium ? <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200 to-transparent" /> : null}
                  <div className="flex items-center justify-between gap-3">
                    <span className={`border px-2.5 py-1 text-[0.58rem] font-semibold tracking-[0.18em] ${tierClass(service.tier)}`}>
                      {service.tier}
                    </span>
                    <span className="text-[0.62rem] text-white/30">#{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="mt-5 flex items-start gap-3">
                    <ShoppingBag className={`mt-1 h-5 w-5 shrink-0 ${isPremium ? "text-amber-200" : "text-crimson"}`} />
                    <div>
                      <h3 className="text-xl font-semibold leading-tight">{service.name}</h3>
                      <p className="mt-2 text-[0.62rem] font-semibold tracking-[0.16em] text-white/35">CPM ДОТОРХ ҮЙЛЧИЛГЭЭ</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-white/52">{service.description}</p>
                  <div className="mt-auto pt-6">
                    <div className="flex items-center justify-between border-t border-white/10 pt-4">
                      <span className="text-xs text-white/38">Үнэ</span>
                      <strong className={`text-xl ${isPremium ? "text-amber-200" : "text-white"}`}>
                        🪙 {service.price.toLocaleString()} Coin
                      </strong>
                    </div>
                    <button
                      type="button"
                      disabled={!profile || !affordable || busy.length > 0}
                      onClick={() => void buyService(service)}
                      className={`mt-4 min-h-12 w-full border text-xs font-bold tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-35 ${isPremium ? "border-amber-300/50 bg-amber-300/10 hover:bg-amber-300/15" : "border-crimson/45 bg-crimson/10 hover:bg-crimson/15"}`}
                    >
                      {!profile
                        ? "НЭВТРЭХ ШААРДЛАГАТАЙ"
                        : !affordable
                          ? "COIN ХҮРЭЛЦЭХГҮЙ"
                          : busy === `service:${service.id}`
                            ? "БАТАЛГААЖУУЛЖ БАЙНА…"
                            : "ХУДАЛДАН АВАХ"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-14" aria-labelledby="cosmetic-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.28em] text-crimson">ONI COSMETICS</p>
              <h2 id="cosmetic-title" className="mt-2 text-3xl font-semibold">ХҮЧТЭЙ PREMIUM EFFECT</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/48">
                Эдгээр нь CPM үйлчилгээ биш. ONI HUB дээр EQUIP хиймэгц Profile, Crew, Garage, Meet, Gallery болон ONI AI хэсгийн харагдацыг илт өөрчилнө.
              </p>
            </div>
            <span className="text-xs text-white/35">{profile?.unlocked.length ?? 0} / {ONI_VAULT.length} UNLOCKED</span>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ONI_VAULT.map((item) => {
              const owned = !!profile?.unlocked.includes(item.id);
              const equipped = profile?.equipped[item.category] === item.id;
              const affordable = !!profile && profile.coin >= item.price && profile.xp >= item.minXp;
              return (
                <article key={item.id} className={`flex min-h-72 flex-col border p-4 ${equipped ? "border-crimson/60 bg-[radial-gradient(circle_at_top,rgba(225,29,72,.14),transparent_45%),rgba(255,255,255,.025)] shadow-[0_0_35px_rgba(225,29,72,.09)]" : "border-white/10 bg-white/[0.025]"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[0.6rem] font-semibold tracking-[0.2em] text-crimson">{item.rarity}</span>
                    {equipped ? <Check className="h-4 w-4 text-emerald-300" /> : owned ? <ShieldCheck className="h-4 w-4 text-emerald-300" /> : <Sparkles className="h-4 w-4 text-white/35" />}
                  </div>
                  <div className="mt-5 flex h-20 items-center justify-center border border-crimson/15 bg-[radial-gradient(circle,rgba(225,29,72,.19),transparent_66%)] text-crimson">
                    <Sparkles className="h-8 w-8 drop-shadow-[0_0_18px_rgba(244,63,94,.7)]" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{item.name}</h3>
                  <p className="mt-2 text-xs leading-5 text-white/46">{item.description}</p>
                  <div className="mt-auto pt-5">
                    <div className="flex justify-between text-xs text-white/55">
                      <span>🪙 {item.price.toLocaleString()}</span>
                      <span>{item.minXp.toLocaleString()} XP</span>
                    </div>
                    <button
                      type="button"
                      disabled={!profile || equipped || (!owned && !affordable) || busy.length > 0}
                      onClick={() => void actCosmetic(item.id, owned)}
                      className="mt-3 min-h-11 w-full border border-crimson/45 bg-crimson/10 text-xs font-semibold tracking-[0.14em] disabled:opacity-35"
                    >
                      {!profile ? "НЭВТРЭХ ШААРДЛАГАТАЙ" : equipped ? "EQUIPPED · LIVE" : owned ? "EQUIP" : !affordable ? "COIN / XP ХҮРЭЛЦЭХГҮЙ" : "UNLOCK"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-14 border border-white/10 bg-white/[0.02] p-5 sm:p-6" aria-labelledby="purchase-feed-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-crimson" />
              <div>
                <p className="text-xs tracking-[0.25em] text-crimson">PUBLIC PURCHASE FEED</p>
                <h2 id="purchase-feed-title" className="mt-1 text-2xl font-semibold">СҮҮЛИЙН ХУДАЛДАН АВАЛТУУД</h2>
              </div>
            </div>
            <span className="text-[0.62rem] tracking-[0.15em] text-emerald-300">БҮХ ХҮНД НЭЭЛТТЭЙ</span>
          </div>
          <p className="mt-3 text-xs leading-5 text-white/40">
            Зөвхөн member nickname, худалдаж авсан үйлчилгээ, үнэ болон хугацаа харагдана. Account-ийн нууц мэдээлэл нийтэд харагдахгүй.
          </p>
          <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
            {feed.length ? (
              feed.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-2 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <strong className="block truncate text-white/80">{entry.nickname}</strong>
                    <span className="mt-1 block truncate text-white/42">{entry.serviceName}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-white/45">
                    <span className="text-amber-200">🪙 {entry.price.toLocaleString()}</span>
                    <span>{dateLabel(entry.createdAt)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-sm text-white/35">Одоогоор нийтэд харагдах худалдан авалт алга.</p>
            )}
          </div>
        </section>
      </main>
      <OniFooter />

      {purchaseResult ? (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Худалдан авалт амжилттай">
          <div className="relative w-full max-w-lg overflow-hidden border border-emerald-300/35 bg-[#07090c] p-6 shadow-[0_0_90px_rgba(16,185,129,.12)] sm:p-7">
            <button type="button" onClick={() => setPurchaseResult(null)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center border border-white/10 text-white/55" aria-label="Хаах">
              <X className="h-4 w-4" />
            </button>
            <div className="grid h-12 w-12 place-items-center border border-emerald-300/35 bg-emerald-300/10 text-emerald-300">
              <Check className="h-6 w-6" />
            </div>
            <p className="mt-5 text-xs tracking-[0.22em] text-emerald-300">ХУДАЛДАН АВАЛТ АМЖИЛТТАЙ</p>
            <h2 className="mt-2 pr-8 text-2xl font-semibold">{purchaseResult.service.name}</h2>
            <p className="mt-3 text-sm leading-6 text-white/55">
              {purchaseResult.service.price.toLocaleString()} Coin таны wallet-аас автоматаар хасагдлаа. Одоо CPM үйлчилгээний гүйцэтгэлийг тохирохын тулд админтай Instagram-аар холбогдоно уу.
            </p>
            <div className="mt-5 grid gap-px bg-white/10 sm:grid-cols-2">
              <div className="bg-[#07090c] p-4">
                <span className="text-[0.6rem] tracking-[0.16em] text-white/35">ORDER ID</span>
                <strong className="mt-2 block break-all text-xs">{purchaseResult.orderId}</strong>
              </div>
              <div className="bg-[#07090c] p-4">
                <span className="text-[0.6rem] tracking-[0.16em] text-white/35">ҮЛДСЭН COIN</span>
                <strong className="mt-2 block text-lg text-amber-200">🪙 {purchaseResult.balanceAfter.toLocaleString()}</strong>
              </div>
            </div>
            <a
              href={SHOP_ADMIN_INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 border border-fuchsia-300/35 bg-fuchsia-400/10 px-4 text-xs font-bold tracking-[0.12em] text-fuchsia-100"
            >
              <Instagram className="h-4 w-4" />
              АДМИНТАЙ INSTAGRAM-ААР ХОЛБОГДОХ
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <p className="mt-3 text-center text-[0.62rem] leading-5 text-white/30">Instagram дээр Order ID болон худалдаж авсан үйлчилгээний нэрээ админд явуулаарай.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
