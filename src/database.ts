import { supabase } from "./supabase";

import type {
  AuctionPlayer,
  Player,
  Team,
  TournamentSettings,
} from "./types";

export type AuctionDivision =
  | "MEN"
  | "WOMEN";

export type PlayerCategory =
  | "MARQUEE"
  | "GOLD"
  | "SILVER";

export function getPlayerCategory(
  player: AuctionPlayer
): PlayerCategory {
  const raw =
    (
      player as AuctionPlayer & {
        category?: string;
      }
    ).category;

  if (raw === "MARQUEE") {
    return "MARQUEE";
  }

  if (raw === "GOLD") {
    return "GOLD";
  }

  return "SILVER";
}

export type DatabaseHistoryEntry = {
  id: number;
  playerId: number;
  playerName: string;
  status: "SOLD" | "UNSOLD";
  teamId?: number;
  teamName?: string;
  price?: number;
  createdAt?: string;
};

export type AuctionTimerStatus =
  | "STOPPED"
  | "RUNNING"
  | "PAUSED";

export type AuctionCallState =
  | "BIDDING"
  | "GOING_ONCE"
  | "GOING_TWICE"
  | "FINAL_CALL";

export type AuctionState = {
  currentPlayerIndex: number;
  currentBid: number;
  biddingTeamId: number | null;
  timerDuration: number;
  timerStatus: AuctionTimerStatus;
  timerEndsAt: string | null;
  timerPausedRemaining: number | null;
  callState: AuctionCallState;
};

export type DisplayEventType =
  | "NONE"
  | "SOLD"
  | "UNSOLD";

export type DisplayEvent = {
  eventType: DisplayEventType;
  playerId: number | null;
  playerName: string | null;
  playerPhotoUrl: string | null;
  teamId: number | null;
  teamName: string | null;
  teamLogoUrl: string | null;
  price: number | null;
  updatedAt: string | null;
};


export function getCategoryBasePrice(
  category: PlayerCategory
): number {
  if (category === "MARQUEE") {
    return 4;
  }

  if (category === "GOLD") {
    return 3;
  }

  return 2;
}

export function getCategoryBidIncrement(
  category: PlayerCategory
): number {
  if (category === "MARQUEE") {
    return 2;
  }

  if (category === "GOLD") {
    return 1.5;
  }

  return 1;
}


export type PlayerStats = {
  matches: number;
  runs: number;
  battingAverage: number;
  strikeRate: number;
  wickets: number;
  economyRate: number;
};

export const EMPTY_PLAYER_STATS: PlayerStats = {
  matches: 0,
  runs: 0,
  battingAverage: 0,
  strikeRate: 0,
  wickets: 0,
  economyRate: 0,
};

export function getPlayerStats(
  player: AuctionPlayer
): PlayerStats {
  const raw =
    player as AuctionPlayer & {
      matches?: number;
      runs?: number;
      battingAverage?: number;
      strikeRate?: number;
      wickets?: number;
      economyRate?: number;
    };

  return {
    matches: Number(raw.matches ?? 0),
    runs: Number(raw.runs ?? 0),
    battingAverage: Number(raw.battingAverage ?? 0),
    strikeRate: Number(raw.strikeRate ?? 0),
    wickets: Number(raw.wickets ?? 0),
    economyRate: Number(raw.economyRate ?? 0),
  };
}


type TeamRow = {
  id: number;
  name: string;
  short_name: string;
  owner: string;
  starting_purse:
    | number
    | string;
  logo_url:
    | string
    | null;
};

type PlayerRow = {
  id: number;
  name: string;
  role: string;
  base_price:
    | number
    | string;
  photo_url:
    | string
    | null;
  queue_position: number;
  status: string;
  category:
    | PlayerCategory
    | string
    | null;
  matches: number | string | null;
  runs: number | string | null;
  batting_average: number | string | null;
  strike_rate: number | string | null;
  wickets: number | string | null;
  economy_rate: number | string | null;
};

type RelatedPlayerRow = {
  id: number;
  name: string;
  role: string;
  base_price:
    | number
    | string;
  photo_url:
    | string
    | null;
};

type PurchaseRow = {
  team_id: number;
  purchase_price:
    | number
    | string;

  auction_players:
    | RelatedPlayerRow
    | RelatedPlayerRow[]
    | null;
};

/* =====================================================
   TOURNAMENT SETTINGS
===================================================== */

export async function loadTournamentSettings(
  division: AuctionDivision = "MEN"
): Promise<TournamentSettings> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "tournament_settings"
      )
      .select("*")
      .eq(
        "division",
        division
      )
      .single();

  if (error) {
    throw error;
  }

  return {
    tournamentName:
      data.tournament_name,

    seasonName:
      data.season_name,

    squadLimit:
      Number(
        data.squad_limit
      ),
  };
}

export async function saveTournamentSettings(
  settings: TournamentSettings,
  division: AuctionDivision = "MEN"
) {
  const {
    error,
  } =
    await supabase
      .from(
        "tournament_settings"
      )
      .update({
        tournament_name:
          settings.tournamentName,

        season_name:
          settings.seasonName,

        squad_limit:
          settings.squadLimit,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "division",
        division
      );

  if (error) {
    throw error;
  }
}

/* =====================================================
   TEAMS
===================================================== */

export async function loadTeams(
  division: AuctionDivision = "MEN"
): Promise<Team[]> {
  const {
    data: teamData,
    error: teamError,
  } =
    await supabase
      .from("teams")
      .select("*")
      .eq(
        "division",
        division
      )
      .order("id");

  if (teamError) {
    throw teamError;
  }

  const {
    data: purchaseData,
    error: purchaseError,
  } =
    await supabase
      .from("purchases")
      .select(`
        team_id,
        purchase_price,
        auction_players (
          id,
          name,
          role,
          base_price,
          photo_url
        )
      `)
      .eq(
        "division",
        division
      );

  if (purchaseError) {
    throw purchaseError;
  }

  const teamRows =
    (teamData ?? []) as TeamRow[];

  const purchaseRows =
    (purchaseData ??
      []) as unknown as PurchaseRow[];

  return teamRows.map(
    (teamRow) => {
      const players: Player[] =
        [];

      for (
        const purchase of
          purchaseRows
      ) {
        if (
          Number(
            purchase.team_id
          ) !==
          Number(
            teamRow.id
          )
        ) {
          continue;
        }

        let playerData:
          | RelatedPlayerRow
          | undefined;

        if (
          Array.isArray(
            purchase.auction_players
          )
        ) {
          playerData =
            purchase
              .auction_players[0];
        } else {
          playerData =
            purchase.auction_players ??
            undefined;
        }

        if (!playerData) {
          continue;
        }

        const player: Player = {
          id:
            Number(
              playerData.id
            ),

          name:
            playerData.name,

          role:
            playerData.role as Player["role"],

          basePrice:
            Number(
              playerData.base_price
            ),

          purchasePrice:
            Number(
              purchase.purchase_price
            ),
        };

        if (
          playerData.photo_url
        ) {
          player.photo =
            playerData.photo_url;
        }

        players.push(
          player
        );
      }

      const team: Team = {
        id:
          Number(
            teamRow.id
          ),

        name:
          teamRow.name,

        shortName:
          teamRow.short_name,

        owner:
          teamRow.owner,

        startingPurse:
          Number(
            teamRow.starting_purse
          ),

        players,
      };

      if (
        teamRow.logo_url
      ) {
        team.logo =
          teamRow.logo_url;
      }

      return team;
    }
  );
}

export async function updateTeamRecord(
  team: Team,
  division: AuctionDivision = "MEN"
) {
  const {
    error,
  } =
    await supabase
      .from("teams")
      .update({
        name:
          team.name,

        short_name:
          team.shortName,

        owner:
          team.owner,

        starting_purse:
          team.startingPurse,

        logo_url:
          team.logo ??
          null,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        team.id
      )
      .eq(
        "division",
        division
      );

  if (error) {
    throw error;
  }
}

export type NewTeamRecord = {
  name: string;
  shortName: string;
  owner: string;
  startingPurse: number;
};

export async function insertTeamRecord(
  team: NewTeamRecord,
  division: AuctionDivision = "MEN"
): Promise<number> {
  /*
    The original teams table was created with fixed numeric IDs.
    Unlike newer tables, its ID is not guaranteed to auto-generate.
    Read the highest existing ID and explicitly allocate the next one.
  */
  const {
    data:
      existingTeams,
    error:
      idError,
  } =
    await supabase
      .from(
        "teams"
      )
      .select(
        "id"
      )
      .order(
        "id",
        {
          ascending:
            false,
        }
      )
      .limit(1);

  if (idError) {
    throw new Error(
      idError.message
    );
  }

  const nextId =
    (
      existingTeams &&
      existingTeams.length >
        0
        ? Number(
            existingTeams[0].id
          )
        : 0
    ) +
    1;

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "teams"
      )
      .insert({
        id:
          nextId,

        name:
          team.name,

        short_name:
          team.shortName,

        owner:
          team.owner,

        starting_purse:
          team.startingPurse,

        logo_url:
          null,

        division,

        updated_at:
          new Date().toISOString(),
      })
      .select(
        "id"
      )
      .single();

  if (error) {
    throw new Error(
      [
        error.message,
        error.details,
        error.hint,
      ]
        .filter(
          Boolean
        )
        .join(
          " | "
        )
    );
  }

  return Number(
    data.id
  );
}

/* =====================================================
   AUCTION PLAYERS
===================================================== */

export async function loadAuctionPlayers(
  division: AuctionDivision = "MEN"
): Promise<AuctionPlayer[]> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "auction_players"
      )
      .select("*")
      .eq(
        "division",
        division
      )
      .order(
        "queue_position",
        {
          ascending: true,
        }
      );

  if (error) {
    throw error;
  }

  return (
    (data ??
      []) as PlayerRow[]
  ).map(
    (row) => {
      const player:
        AuctionPlayer =
        {
          id:
            Number(
              row.id
            ),

          name:
            row.name,

          role:
            row.role as AuctionPlayer["role"],

          basePrice:
            Number(
              row.base_price
            ),
        };

      if (
        row.photo_url
      ) {
        player.photo =
          row.photo_url;
      }

      const extendedPlayer =
        player as AuctionPlayer & {
          category?: PlayerCategory;
          matches?: number;
          runs?: number;
          battingAverage?: number;
          strikeRate?: number;
          wickets?: number;
          economyRate?: number;
        };

      extendedPlayer.category =
        row.category === "MARQUEE"
          ? "MARQUEE"
          : row.category === "GOLD"
          ? "GOLD"
          : "SILVER";

      extendedPlayer.matches =
        Number(row.matches ?? 0);
      extendedPlayer.runs =
        Number(row.runs ?? 0);
      extendedPlayer.battingAverage =
        Number(row.batting_average ?? 0);
      extendedPlayer.strikeRate =
        Number(row.strike_rate ?? 0);
      extendedPlayer.wickets =
        Number(row.wickets ?? 0);
      extendedPlayer.economyRate =
        Number(row.economy_rate ?? 0);

      return player;
    }
  );
}

export async function insertAuctionPlayer(
  player: AuctionPlayer,
  queuePosition: number,
  division: AuctionDivision = "MEN",
  category: PlayerCategory = "SILVER",
  stats: PlayerStats = EMPTY_PLAYER_STATS
) {
  const {
    error,
  } =
    await supabase
      .from(
        "auction_players"
      )
      .insert({
        id:
          player.id,

        name:
          player.name,

        role:
          player.role,

        base_price:
          getCategoryBasePrice(
            category
          ),

        photo_url:
          player.photo ??
          null,

        queue_position:
          queuePosition,

        status:
          "PENDING",

        category,

        matches:
          stats.matches,

        runs:
          stats.runs,

        batting_average:
          stats.battingAverage,

        strike_rate:
          stats.strikeRate,

        wickets:
          stats.wickets,

        economy_rate:
          stats.economyRate,

        division,

        updated_at:
          new Date().toISOString(),
      });

  if (error) {
    throw new Error(
      [
        error.message,
        error.details,
        error.hint,
      ]
        .filter(
          Boolean
        )
        .join(
          " | "
        )
    );
  }
}

export async function updateAuctionPlayerStats(
  playerId: number,
  stats: PlayerStats,
  division: AuctionDivision = "MEN"
) {
  const { error } =
    await supabase
      .from("auction_players")
      .update({
        matches: stats.matches,
        runs: stats.runs,
        batting_average: stats.battingAverage,
        strike_rate: stats.strikeRate,
        wickets: stats.wickets,
        economy_rate: stats.economyRate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", playerId)
      .eq("division", division);

  if (error) {
    throw error;
  }
}

export async function updateAuctionPlayerCategory(
  playerId: number,
  category: PlayerCategory,
  division: AuctionDivision = "MEN"
) {
  const {
    error,
  } =
    await supabase
      .from(
        "auction_players"
      )
      .update({
        category,

        base_price:
          getCategoryBasePrice(
            category
          ),

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        playerId
      )
      .eq(
        "division",
        division
      );

  if (error) {
    throw error;
  }
}

export async function deleteAuctionPlayerRecord(
  playerId: number,
  division: AuctionDivision = "MEN"
) {
  const {
    error,
  } =
    await supabase
      .from(
        "auction_players"
      )
      .delete()
      .eq(
        "id",
        playerId
      )
      .eq(
        "division",
        division
      );

  if (error) {
    throw error;
  }
}

/* =====================================================
   AUCTION HISTORY
===================================================== */

export async function loadAuctionHistory(
  division: AuctionDivision = "MEN"
): Promise<
  DatabaseHistoryEntry[]
> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "auction_history"
      )
      .select("*")
      .eq(
        "division",
        division
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

  if (error) {
    throw error;
  }

  return (
    data ?? []
  ).map(
    (row) => {
      const entry:
        DatabaseHistoryEntry =
        {
          id:
            Number(
              row.id
            ),

          playerId:
            Number(
              row.player_id
            ),

          playerName:
            row.player_name,

          status:
            row.status as
              | "SOLD"
              | "UNSOLD",
        };

      if (
        row.team_id !==
        null
      ) {
        entry.teamId =
          Number(
            row.team_id
          );
      }

      if (
        row.team_name
      ) {
        entry.teamName =
          row.team_name;
      }

      if (
        row.price !==
        null
      ) {
        entry.price =
          Number(
            row.price
          );
      }

      if (
        row.created_at
      ) {
        entry.createdAt =
          row.created_at;
      }

      return entry;
    }
  );
}

/* =====================================================
   AUCTION STATE
===================================================== */

export async function loadAuctionState(
  division: AuctionDivision = "MEN"
): Promise<AuctionState> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "auction_state"
      )
      .select("*")
      .eq(
        "division",
        division
      )
      .single();

  if (error) {
    throw error;
  }

  return {
    currentPlayerIndex:
      Number(
        data.current_player_index
      ),

    currentBid:
      Number(
        data.current_bid
      ),

    biddingTeamId:
      data.bidding_team_id ===
      null
        ? null
        : Number(
            data.bidding_team_id
          ),

    timerDuration:
      Number(
        data.timer_duration ??
          30
      ),

    timerStatus:
      (data.timer_status ??
        "STOPPED") as
        AuctionTimerStatus,

    timerEndsAt:
      data.timer_ends_at ??
      null,

    timerPausedRemaining:
      data.timer_paused_remaining ===
      null ||
      data.timer_paused_remaining ===
      undefined
        ? null
        : Number(
            data.timer_paused_remaining
          ),

    callState:
      (data.call_state ??
        "BIDDING") as
        AuctionCallState,
  };
}

export async function saveAuctionState(
  state: AuctionState,
  division: AuctionDivision = "MEN"
) {
  const {
    error,
  } =
    await supabase
      .from(
        "auction_state"
      )
      .update({
        current_player_index:
          state.currentPlayerIndex,

        current_bid:
          state.currentBid,

        bidding_team_id:
          state.biddingTeamId,

        timer_duration:
          state.timerDuration,

        timer_status:
          state.timerStatus,

        timer_ends_at:
          state.timerEndsAt,

        timer_paused_remaining:
          state.timerPausedRemaining,

        call_state:
          state.callState,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "division",
        division
      );

  if (error) {
    throw error;
  }
}


export function createRunningTimerState(
  state: AuctionState,
  durationSeconds:
    number =
      state.timerDuration
): AuctionState {
  const safeDuration =
    Math.max(
      5,
      Math.round(
        durationSeconds
      )
    );

  return {
    ...state,

    timerDuration:
      safeDuration,

    timerStatus:
      "RUNNING",

    timerEndsAt:
      new Date(
        Date.now() +
          safeDuration *
            1000
      ).toISOString(),

    timerPausedRemaining:
      null,

    callState:
      "BIDDING",
  };
}

export function createPausedTimerState(
  state: AuctionState,
  remainingSeconds: number
): AuctionState {
  return {
    ...state,

    timerStatus:
      "PAUSED",

    timerEndsAt:
      null,

    timerPausedRemaining:
      Math.max(
        0,
        Math.ceil(
          remainingSeconds
        )
      ),
  };
}

export function createStoppedTimerState(
  state: AuctionState
): AuctionState {
  return {
    ...state,

    timerStatus:
      "STOPPED",

    timerEndsAt:
      null,

    timerPausedRemaining:
      null,

    callState:
      "BIDDING",
  };
}

export function getTimerRemainingSeconds(
  state: AuctionState
): number {
  if (
    state.timerStatus ===
    "PAUSED"
  ) {
    return Math.max(
      0,
      state.timerPausedRemaining ??
        0
    );
  }

  if (
    state.timerStatus !==
      "RUNNING" ||
    !state.timerEndsAt
  ) {
    return Math.max(
      0,
      state.timerDuration
    );
  }

  return Math.max(
    0,
    Math.ceil(
      (
        new Date(
          state.timerEndsAt
        ).getTime() -
        Date.now()
      ) /
        1000
    )
  );
}

/* =====================================================
   DISPLAY EVENT
===================================================== */

export async function loadDisplayEvent(
  division: AuctionDivision = "MEN"
): Promise<DisplayEvent> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "display_event"
      )
      .select("*")
      .eq(
        "division",
        division
      )
      .single();

  if (error) {
    throw error;
  }

  return {
    eventType:
      data.event_type as DisplayEventType,

    playerId:
      data.player_id ===
      null
        ? null
        : Number(
            data.player_id
          ),

    playerName:
      data.player_name ??
      null,

    playerPhotoUrl:
      data.player_photo_url ??
      null,

    teamId:
      data.team_id ===
      null
        ? null
        : Number(
            data.team_id
          ),

    teamName:
      data.team_name ??
      null,

    teamLogoUrl:
      data.team_logo_url ??
      null,

    price:
      data.price ===
      null
        ? null
        : Number(
            data.price
          ),

    updatedAt:
      data.updated_at ??
      null,
  };
}

export async function triggerSoldDisplayEvent(
  player: AuctionPlayer,
  team: Team,
  price: number,
  division: AuctionDivision = "MEN"
) {
  const {
    error,
  } =
    await supabase
      .from(
        "display_event"
      )
      .update({
        event_type:
          "SOLD",

        player_id:
          player.id,

        player_name:
          player.name,

        player_photo_url:
          player.photo ??
          null,

        team_id:
          team.id,

        team_name:
          team.name,

        team_logo_url:
          team.logo ??
          null,

        price,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "division",
        division
      );

  if (error) {
    throw error;
  }
}

export async function triggerUnsoldDisplayEvent(
  player: AuctionPlayer,
  division: AuctionDivision = "MEN"
) {
  const {
    error,
  } =
    await supabase
      .from(
        "display_event"
      )
      .update({
        event_type:
          "UNSOLD",

        player_id:
          player.id,

        player_name:
          player.name,

        player_photo_url:
          player.photo ??
          null,

        team_id:
          null,

        team_name:
          null,

        team_logo_url:
          null,

        price:
          null,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "division",
        division
      );

  if (error) {
    throw error;
  }
}

export async function clearDisplayEvent(
  division: AuctionDivision = "MEN"
) {
  const {
    error,
  } =
    await supabase
      .from(
        "display_event"
      )
      .update({
        event_type:
          "NONE",

        player_id:
          null,

        player_name:
          null,

        player_photo_url:
          null,

        team_id:
          null,

        team_name:
          null,

        team_logo_url:
          null,

        price:
          null,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "division",
        division
      );

  if (error) {
    throw error;
  }
}

/* =====================================================
   TRANSFER / SWAP PURCHASED PLAYERS
===================================================== */

export async function transferOrSwapPurchasedPlayer(
  params: {
    division: AuctionDivision;
    playerId: number;
    fromTeamId: number;
    toTeamId: number;
    swapPlayerId?: number | null;
  }
) {
  const {
    division,
    playerId,
    fromTeamId,
    toTeamId,
    swapPlayerId = null,
  } = params;

  const {
    error,
  } =
    await supabase.rpc(
      "transfer_or_swap_purchased_player",
      {
        p_division:
          division,

        p_player_id:
          playerId,

        p_from_team_id:
          fromTeamId,

        p_to_team_id:
          toTeamId,

        p_swap_player_id:
          swapPlayerId,
      }
    );

  if (error) {
    throw error;
  }
}

/* =====================================================
   SELL PLAYER
===================================================== */

export async function sellPlayer(
  player: AuctionPlayer,
  team: Team,
  price: number,
  division: AuctionDivision = "MEN"
) {
  const {
    error:
      purchaseError,
  } =
    await supabase
      .from(
        "purchases"
      )
      .insert({
        player_id:
          player.id,

        team_id:
          team.id,

        purchase_price:
          price,

        division,
      });

  if (
    purchaseError
  ) {
    throw purchaseError;
  }

  const {
    error:
      playerError,
  } =
    await supabase
      .from(
        "auction_players"
      )
      .update({
        status:
          "SOLD",

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        player.id
      )
      .eq(
        "division",
        division
      );

  if (
    playerError
  ) {
    throw playerError;
  }

  const {
    error:
      historyError,
  } =
    await supabase
      .from(
        "auction_history"
      )
      .insert({
        player_id:
          player.id,

        player_name:
          player.name,

        status:
          "SOLD",

        team_id:
          team.id,

        team_name:
          team.name,

        price,

        division,
      });

  if (
    historyError
  ) {
    throw historyError;
  }
}

/* =====================================================
   UNSOLD
===================================================== */

export async function markPlayerUnsold(
  player: AuctionPlayer,
  division: AuctionDivision = "MEN"
) {
  const {
    error:
      playerError,
  } =
    await supabase
      .from(
        "auction_players"
      )
      .update({
        status:
          "UNSOLD",

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        player.id
      )
      .eq(
        "division",
        division
      );

  if (
    playerError
  ) {
    throw playerError;
  }

  const {
    error:
      historyError,
  } =
    await supabase
      .from(
        "auction_history"
      )
      .insert({
        player_id:
          player.id,

        player_name:
          player.name,

        status:
          "UNSOLD",

        division,
      });

  if (
    historyError
  ) {
    throw historyError;
  }
}

/* =====================================================
   UNDO
===================================================== */

export async function undoLastDatabaseAction(
  division: AuctionDivision = "MEN"
) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "auction_history"
      )
      .select("*")
      .eq(
        "division",
        division
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const playerId =
    Number(
      data.player_id
    );

  if (
    data.status ===
    "SOLD"
  ) {
    const {
      error:
        purchaseDeleteError,
    } =
      await supabase
        .from(
          "purchases"
        )
        .delete()
        .eq(
          "player_id",
          playerId
        )
        .eq(
          "division",
          division
        );

    if (
      purchaseDeleteError
    ) {
      throw purchaseDeleteError;
    }
  }

  const {
    error:
      playerError,
  } =
    await supabase
      .from(
        "auction_players"
      )
      .update({
        status:
          "PENDING",

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        playerId
      )
      .eq(
        "division",
        division
      );

  if (
    playerError
  ) {
    throw playerError;
  }

  const {
    error:
      historyDeleteError,
  } =
    await supabase
      .from(
        "auction_history"
      )
      .delete()
      .eq(
        "id",
        data.id
      )
      .eq(
        "division",
        division
      );

  if (
    historyDeleteError
  ) {
    throw historyDeleteError;
  }

  return {
    playerId,

    status:
      data.status as
        | "SOLD"
        | "UNSOLD",
  };
}

/* =====================================================
   RESET
===================================================== */

export async function resetDatabaseAuction(
  firstBasePrice: number,
  division: AuctionDivision = "MEN"
) {
  const {
    error:
      purchaseError,
  } =
    await supabase
      .from(
        "purchases"
      )
      .delete()
      .eq(
        "division",
        division
      );

  if (
    purchaseError
  ) {
    throw purchaseError;
  }

  const {
    error:
      historyError,
  } =
    await supabase
      .from(
        "auction_history"
      )
      .delete()
      .eq(
        "division",
        division
      );

  if (
    historyError
  ) {
    throw historyError;
  }

  const {
    error:
      playerError,
  } =
    await supabase
      .from(
        "auction_players"
      )
      .update({
        status:
          "PENDING",

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "division",
        division
      );

  if (
    playerError
  ) {
    throw playerError;
  }

  await saveAuctionState(
    {
      currentPlayerIndex:
        0,

      currentBid:
        firstBasePrice,

      biddingTeamId:
        null,

      timerDuration:
        30,

      timerStatus:
        "STOPPED",

      timerEndsAt:
        null,

      timerPausedRemaining:
        null,

      callState:
        "BIDDING",
    },
    division
  );

  await clearDisplayEvent(
    division
  );
}
