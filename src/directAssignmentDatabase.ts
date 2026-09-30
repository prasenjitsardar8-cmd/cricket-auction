import { supabase } from "./supabase";

export type AuctionDivision = "MEN" | "WOMEN";

export type DirectAssignmentPlayer = {
  id: number;
  name: string;
  role: string;
  basePrice: number;
  photoUrl: string | null;
};

export type DirectAssignmentTeam = {
  id: number;
  name: string;
  shortName: string;
  startingPurse: number;
  spent: number;
  remaining: number;
};

export type DirectAssignmentRecord = {
  playerId: number;
  playerName: string;
  teamId: number;
  teamName: string;
  amount: number;
};

type RelatedName = { name: string } | { name: string }[] | null;

const firstName = (value: RelatedName) =>
  Array.isArray(value) ? value[0]?.name ?? "" : value?.name ?? "";

export async function loadDirectAssignmentData(division: AuctionDivision) {
  const [playersResult, teamsResult, purchasesResult] = await Promise.all([
    supabase
      .from("auction_players")
      .select("id,name,role,base_price,photo_url,is_preassigned")
      .eq("division", division)
      .order("name"),
    supabase
      .from("teams")
      .select("id,name,short_name,starting_purse")
      .eq("division", division)
      .order("id"),
    supabase
      .from("purchases")
      .select(`
        player_id,
        team_id,
        purchase_price,
        acquisition_type,
        auction_players(name),
        teams(name)
      `)
      .eq("division", division),
  ]);

  if (playersResult.error) throw playersResult.error;
  if (teamsResult.error) throw teamsResult.error;
  if (purchasesResult.error) throw purchasesResult.error;

  const purchases = (purchasesResult.data ?? []) as unknown as Array<{
    player_id: number | string;
    team_id: number | string;
    purchase_price: number | string;
    acquisition_type: string | null;
    auction_players: RelatedName;
    teams: RelatedName;
  }>;

  const purchasedPlayerIds = new Set(purchases.map((p) => Number(p.player_id)));

  const players: DirectAssignmentPlayer[] = (playersResult.data ?? [])
    .filter((row: any) => row.is_preassigned !== true && !purchasedPlayerIds.has(Number(row.id)))
    .map((row: any) => ({
      id: Number(row.id),
      name: row.name,
      role: row.role,
      basePrice: Number(row.base_price),
      photoUrl: row.photo_url ?? null,
    }));

  const spentByTeam = new Map<number, number>();
  for (const purchase of purchases) {
    const teamId = Number(purchase.team_id);
    spentByTeam.set(
      teamId,
      (spentByTeam.get(teamId) ?? 0) + Number(purchase.purchase_price || 0)
    );
  }

  const teams: DirectAssignmentTeam[] = (teamsResult.data ?? []).map((row: any) => {
    const id = Number(row.id);
    const startingPurse = Number(row.starting_purse);
    const spent = spentByTeam.get(id) ?? 0;
    return {
      id,
      name: row.name,
      shortName: row.short_name,
      startingPurse,
      spent,
      remaining: startingPurse - spent,
    };
  });

  const assignments: DirectAssignmentRecord[] = purchases
    .filter((p) => p.acquisition_type === "DIRECT")
    .map((p) => ({
      playerId: Number(p.player_id),
      playerName: firstName(p.auction_players) || `Player ${p.player_id}`,
      teamId: Number(p.team_id),
      teamName: firstName(p.teams) || `Team ${p.team_id}`,
      amount: Number(p.purchase_price),
    }));

  return { players, teams, assignments };
}

export async function assignPlayerDirectly(params: {
  playerId: number;
  teamId: number;
  amount: number;
  division: AuctionDivision;
}) {
  const { error } = await supabase.rpc("assign_player_directly", {
    p_player_id: params.playerId,
    p_team_id: params.teamId,
    p_amount: params.amount,
    p_division: params.division,
  });
  if (error) throw error;
}

export async function removeDirectAssignment(params: {
  playerId: number;
  division: AuctionDivision;
}) {
  const { error } = await supabase.rpc("remove_direct_assignment", {
    p_player_id: params.playerId,
    p_division: params.division,
  });
  if (error) throw error;
}
