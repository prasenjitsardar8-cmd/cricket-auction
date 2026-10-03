import { supabase } from "./supabase";
import {
  loadFixtures,
  type FixtureMatch,
} from "./fixturesDatabase";

export type MatchDayRosterPlayer = {
  id: number;
  teamName: string;
  playerName: string;
  present: boolean;
  sortOrder: number;
};

export type MatchParticipationRole =
  | "STARTER"
  | "SUPER_SUB";

export type MatchParticipation = {
  id: number;
  fixtureId: number;
  teamName: string;
  playerId: number;
  role: MatchParticipationRole;
  participated: boolean;
};

type RosterRow = {
  id: number | string;
  team_name: string;
  player_name: string;
  present: boolean;
  sort_order: number | string;
};

type ParticipationRow = {
  id: number | string;
  fixture_id: number | string;
  team_name: string;
  player_id: number | string;
  role: MatchParticipationRole | string;
  participated: boolean;
};

export async function loadMatchDayData(): Promise<{
  fixtures: FixtureMatch[];
  roster: MatchDayRosterPlayer[];
  participation: MatchParticipation[];
}> {
  const [fixtures, rosterResult, participationResult] =
    await Promise.all([
      loadFixtures(),
      supabase
        .from("match_day_roster")
        .select("*")
        .order("team_name", { ascending: true })
        .order("sort_order", { ascending: true }),
      supabase
        .from("match_participation")
        .select("*")
        .order("fixture_id", { ascending: true }),
    ]);

  if (rosterResult.error) throw rosterResult.error;
  if (participationResult.error) throw participationResult.error;

  const roster = ((rosterResult.data ?? []) as RosterRow[]).map(
    (row): MatchDayRosterPlayer => ({
      id: Number(row.id),
      teamName: row.team_name,
      playerName: row.player_name,
      present: row.present !== false,
      sortOrder: Number(row.sort_order),
    })
  );

  const participation =
    ((participationResult.data ?? []) as ParticipationRow[]).map(
      (row): MatchParticipation => ({
        id: Number(row.id),
        fixtureId: Number(row.fixture_id),
        teamName: row.team_name,
        playerId: Number(row.player_id),
        role: row.role === "SUPER_SUB" ? "SUPER_SUB" : "STARTER",
        participated: row.participated === true,
      })
    );

  return { fixtures, roster, participation };
}

export async function setRosterPresence(
  playerId: number,
  present: boolean
) {
  const { error } = await supabase
    .from("match_day_roster")
    .update({
      present,
      updated_at: new Date().toISOString(),
    })
    .eq("id", playerId);

  if (error) throw error;
}

export async function setWholeTeamPresence(
  teamName: string,
  present: boolean
) {
  const { error } = await supabase
    .from("match_day_roster")
    .update({
      present,
      updated_at: new Date().toISOString(),
    })
    .eq("team_name", teamName);

  if (error) throw error;
}

export async function saveMatchLineup(params: {
  fixtureId: number;
  teamName: string;
  starterIds: number[];
  superSubId: number | null;
  superSubUsed: boolean;
}) {
  const { error } = await supabase.rpc(
    "save_match_lineup",
    {
      p_fixture_id: params.fixtureId,
      p_team_name: params.teamName,
      p_starter_ids: params.starterIds,
      p_super_sub_id: params.superSubId,
      p_super_sub_used: params.superSubUsed,
    }
  );

  if (error) throw error;
}

export function countPlayerAppearances(
  playerId: number,
  participation: MatchParticipation[]
) {
  return participation.filter(
    (entry) =>
      entry.playerId === playerId &&
      entry.participated
  ).length;
}

export function getTeamRemainingMatches(
  teamName: string,
  fixtures: FixtureMatch[]
) {
  return fixtures.filter(
    (fixture) =>
      fixture.slotType === "MATCH" &&
      fixture.status !== "COMPLETED" &&
      (fixture.team1 === teamName ||
        fixture.team2 === teamName)
  ).length;
}
