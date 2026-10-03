import { supabase } from "./supabase";

export type FixtureSlotType = "MATCH" | "BREAK";
export type FixtureStatus = "UPCOMING" | "CURRENT" | "COMPLETED";
export type FixtureResultType =
  | "TEAM1"
  | "TEAM2"
  | "TIE"
  | "NO_RESULT"
  | null;

export type FixtureMatch = {
  id: number;
  matchNumber: number | null;
  slotOrder: number;
  slotType: FixtureSlotType;
  startTime: string;
  endTime: string;
  team1: string | null;
  team2: string | null;
  status: FixtureStatus;
  team1Runs: number | null;
  team1Wickets: number | null;
  team1Overs: string | null;
  team2Runs: number | null;
  team2Wickets: number | null;
  team2Overs: string | null;
  resultType: FixtureResultType;
  resultText: string | null;
  updatedAt: string | null;
};

export type FixtureResultInput = {
  team1Runs: number | null;
  team1Wickets: number | null;
  team1Overs: string | null;
  team2Runs: number | null;
  team2Wickets: number | null;
  team2Overs: string | null;
  resultType: FixtureResultType;
  resultText?: string;
};

export type PointsRow = {
  position: number;
  team: string;
  played: number;
  won: number;
  lost: number;
  tiedOrNoResult: number;
  points: number;
  runsFor: number;
  ballsFaced: number;
  runsAgainst: number;
  ballsBowled: number;
  nrr: number;
};

type FixtureRow = {
  id: number | string;
  match_number: number | string | null;
  slot_order: number | string;
  slot_type: FixtureSlotType | string;
  start_time: string;
  end_time: string;
  team1: string | null;
  team2: string | null;
  status: FixtureStatus | string;
  team1_runs: number | string | null;
  team1_wickets: number | string | null;
  team1_overs: string | number | null;
  team2_runs: number | string | null;
  team2_wickets: number | string | null;
  team2_overs: string | number | null;
  result_type: FixtureResultType | string | null;
  result_text: string | null;
  updated_at: string | null;
};

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapFixture(row: FixtureRow): FixtureMatch {
  return {
    id: Number(row.id),
    matchNumber: numberOrNull(row.match_number),
    slotOrder: Number(row.slot_order),
    slotType: row.slot_type === "BREAK" ? "BREAK" : "MATCH",
    startTime: row.start_time,
    endTime: row.end_time,
    team1: row.team1,
    team2: row.team2,
    status:
      row.status === "CURRENT"
        ? "CURRENT"
        : row.status === "COMPLETED"
        ? "COMPLETED"
        : "UPCOMING",
    team1Runs: numberOrNull(row.team1_runs),
    team1Wickets: numberOrNull(row.team1_wickets),
    team1Overs:
      row.team1_overs === null || row.team1_overs === undefined
        ? null
        : String(row.team1_overs),
    team2Runs: numberOrNull(row.team2_runs),
    team2Wickets: numberOrNull(row.team2_wickets),
    team2Overs:
      row.team2_overs === null || row.team2_overs === undefined
        ? null
        : String(row.team2_overs),
    resultType:
      row.result_type === "TEAM1" ||
      row.result_type === "TEAM2" ||
      row.result_type === "TIE" ||
      row.result_type === "NO_RESULT"
        ? row.result_type
        : null,
    resultText: row.result_text,
    updatedAt: row.updated_at,
  };
}

export async function loadFixtures(): Promise<FixtureMatch[]> {
  const { data, error } = await supabase
    .from("fixtures_matches")
    .select("*")
    .order("slot_order", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as FixtureRow[]).map(mapFixture);
}

export async function setCurrentFixture(matchId: number) {
  const now = new Date().toISOString();

  const { error: clearError } = await supabase
    .from("fixtures_matches")
    .update({
      status: "UPCOMING",
      updated_at: now,
    })
    .eq("status", "CURRENT");

  if (clearError) {
    throw clearError;
  }

  const { error } = await supabase
    .from("fixtures_matches")
    .update({
      status: "CURRENT",
      updated_at: now,
    })
    .eq("id", matchId)
    .eq("slot_type", "MATCH");

  if (error) {
    throw error;
  }
}

export async function updateFixtureScore(
  matchId: number,
  input: FixtureResultInput
) {
  const { error } = await supabase
    .from("fixtures_matches")
    .update({
      team1_runs: input.team1Runs,
      team1_wickets: input.team1Wickets,
      team1_overs: input.team1Overs,
      team2_runs: input.team2Runs,
      team2_wickets: input.team2Wickets,
      team2_overs: input.team2Overs,
      result_type: input.resultType,
      result_text: input.resultText?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (error) {
    throw error;
  }
}

export async function completeFixture(
  matchId: number,
  input: FixtureResultInput
) {
  const { error } = await supabase
    .from("fixtures_matches")
    .update({
      team1_runs: input.team1Runs,
      team1_wickets: input.team1Wickets,
      team1_overs: input.team1Overs,
      team2_runs: input.team2Runs,
      team2_wickets: input.team2Wickets,
      team2_overs: input.team2Overs,
      result_type: input.resultType,
      result_text: input.resultText?.trim() || null,
      status: "COMPLETED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (error) {
    throw error;
  }
}

export async function resetFixture(matchId: number) {
  const { error } = await supabase
    .from("fixtures_matches")
    .update({
      status: "UPCOMING",
      team1_runs: null,
      team1_wickets: null,
      team1_overs: null,
      team2_runs: null,
      team2_wickets: null,
      team2_overs: null,
      result_type: null,
      result_text: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (error) {
    throw error;
  }
}

export async function undoLastCompletedMatch() {
  const { data, error } = await supabase.rpc(
    "undo_last_completed_match"
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function resetEntireSchedule() {
  const { error } = await supabase.rpc(
    "reset_entire_schedule"
  );

  if (error) {
    throw error;
  }
}

export async function advanceToNextFixture(fixtures: FixtureMatch[]) {
  const currentIndex = fixtures.findIndex(
    (fixture) =>
      fixture.slotType === "MATCH" &&
      fixture.status === "CURRENT"
  );

  const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;

  const next = fixtures
    .slice(startIndex)
    .find(
      (fixture) =>
        fixture.slotType === "MATCH" &&
        fixture.status !== "COMPLETED"
    );

  if (!next) {
    throw new Error("There are no remaining matches.");
  }

  await setCurrentFixture(next.id);
}

export function getCurrentFixture(
  fixtures: FixtureMatch[]
): FixtureMatch | null {
  return (
    fixtures.find(
      (fixture) =>
        fixture.slotType === "MATCH" &&
        fixture.status === "CURRENT"
    ) ?? null
  );
}

export function getNextFixture(
  fixtures: FixtureMatch[]
): FixtureMatch | null {
  const current = getCurrentFixture(fixtures);

  if (current) {
    return (
      fixtures.find(
        (fixture) =>
          fixture.slotType === "MATCH" &&
          fixture.slotOrder > current.slotOrder &&
          fixture.status !== "COMPLETED"
      ) ?? null
    );
  }

  return (
    fixtures.find(
      (fixture) =>
        fixture.slotType === "MATCH" &&
        fixture.status === "UPCOMING"
    ) ?? null
  );
}

/*
  Cricket overs are base-6 in the decimal-looking part:
  "4.3" = 4 overs + 3 balls = 27 balls.
*/
export function oversToBalls(overs: string | null): number {
  if (!overs) {
    return 0;
  }

  const clean = overs.trim();
  if (!clean) {
    return 0;
  }

  const [wholeRaw, ballsRaw = "0"] = clean.split(".");
  const whole = Math.max(0, Number.parseInt(wholeRaw || "0", 10) || 0);
  const balls = Math.max(
    0,
    Math.min(5, Number.parseInt(ballsRaw || "0", 10) || 0)
  );

  return whole * 6 + balls;
}

function runRate(runs: number, balls: number): number {
  if (balls <= 0) {
    return 0;
  }

  return runs / (balls / 6);
}

export function calculatePointsTable(
  fixtures: FixtureMatch[]
): PointsRow[] {
  const teamNames = Array.from(
    new Set(
      fixtures
        .filter((fixture) => fixture.slotType === "MATCH")
        .flatMap((fixture) => [fixture.team1, fixture.team2])
        .filter((team): team is string => Boolean(team))
    )
  );

  const rows = new Map<string, Omit<PointsRow, "position" | "nrr">>();

  for (const team of teamNames) {
    rows.set(team, {
      team,
      played: 0,
      won: 0,
      lost: 0,
      tiedOrNoResult: 0,
      points: 0,
      runsFor: 0,
      ballsFaced: 0,
      runsAgainst: 0,
      ballsBowled: 0,
    });
  }

  for (const fixture of fixtures) {
    if (
      fixture.slotType !== "MATCH" ||
      fixture.status !== "COMPLETED" ||
      !fixture.team1 ||
      !fixture.team2
    ) {
      continue;
    }

    const team1 = rows.get(fixture.team1);
    const team2 = rows.get(fixture.team2);

    if (!team1 || !team2) {
      continue;
    }

    team1.played += 1;
    team2.played += 1;

    if (fixture.resultType === "TEAM1") {
      team1.won += 1;
      team1.points += 2;
      team2.lost += 1;
    } else if (fixture.resultType === "TEAM2") {
      team2.won += 1;
      team2.points += 2;
      team1.lost += 1;
    } else if (
      fixture.resultType === "TIE" ||
      fixture.resultType === "NO_RESULT"
    ) {
      team1.tiedOrNoResult += 1;
      team2.tiedOrNoResult += 1;
      team1.points += 1;
      team2.points += 1;
    }

    if (
      fixture.team1Runs !== null &&
      fixture.team2Runs !== null
    ) {
      const team1Balls = oversToBalls(fixture.team1Overs);
      const team2Balls = oversToBalls(fixture.team2Overs);

      team1.runsFor += fixture.team1Runs;
      team1.ballsFaced += team1Balls;
      team1.runsAgainst += fixture.team2Runs;
      team1.ballsBowled += team2Balls;

      team2.runsFor += fixture.team2Runs;
      team2.ballsFaced += team2Balls;
      team2.runsAgainst += fixture.team1Runs;
      team2.ballsBowled += team1Balls;
    }
  }

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      position: 0,
      nrr:
        runRate(row.runsFor, row.ballsFaced) -
        runRate(row.runsAgainst, row.ballsBowled),
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.nrr - a.nrr ||
        b.won - a.won ||
        a.team.localeCompare(b.team)
    )
    .map((row, index) => ({
      ...row,
      position: index + 1,
    }));
}

export function formatScore(
  runs: number | null,
  wickets: number | null,
  overs: string | null
) {
  if (runs === null) {
    return "—";
  }

  const wicketsText =
    wickets === null ? "" : `/${wickets}`;

  const oversText =
    overs && overs.trim()
      ? ` (${overs.trim()} ov)`
      : "";

  return `${runs}${wicketsText}${oversText}`;
}

