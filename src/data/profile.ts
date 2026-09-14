import { fallbackPortrait, safePortraitUrl } from "@/data/crew";
import { fetchVehicles, type Vehicle } from "@/data/garage";
import type { MemberAccount } from "@/data/member-auth";

export type OniIdentity = {
  oniId: string;
  nickname: string;
  cpmId: string;
  role: string;
  joinedAt: string | null;
  portrait: string;
  vehicles: Vehicle[];
  mainVehicle: Vehicle | null;
};

const same = (left: string | undefined, right: string | undefined) =>
  Boolean(
    left &&
    right &&
    left.trim().toLocaleLowerCase("mn-MN") === right.trim().toLocaleLowerCase("mn-MN"),
  );

export async function fetchMyOniIdentity(account: MemberAccount): Promise<OniIdentity> {
  const [{ membersService }, garage] = await Promise.all([
    import("@/services/domains"),
    fetchVehicles(),
  ]);
  const crew = await membersService.listPublic();
  const member = crew.ok
    ? (crew.data.find((row) => row.id === account.memberId) ??
      crew.data.find((row) => same(row.cpmId, account.cpmId)))
    : undefined;
  const allVehicles = garage.status === "ok" ? garage.rows : [];
  const vehicles = allVehicles.filter(
    (vehicle) =>
      vehicle.ownerMemberId === account.memberId ||
      vehicle.ownerMemberId === member?.oniId ||
      (!vehicle.ownerMemberId && same(vehicle.ownerCallsign, account.nickname)),
  );

  return {
    oniId: member?.oniId || account.memberId,
    nickname: member?.cpmNickname || account.nickname,
    cpmId: member?.cpmId || account.cpmId,
    role: member?.role || "CREW MEMBER",
    joinedAt: member?.joinedAt?.slice(0, 10) ?? null,
    portrait:
      safePortraitUrl(member?.portraitUrl) ?? fallbackPortrait(account.nickname, member?.role, 0),
    vehicles,
    mainVehicle: vehicles.find((vehicle) => vehicle.featured) ?? vehicles[0] ?? null,
  };
}
