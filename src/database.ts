import { supabase } from "./supabase";

import type {
  AuctionPlayer,
  Player,
  Team,
  TournamentSettings,
} from "./types";

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

export async function loadTournamentSettings(): Promise<TournamentSettings> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "tournament_settings"
      )
      .select("*")
      .eq("id", 1)
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
  settings: TournamentSettings
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
      .eq("id", 1);

  if (error) {
    throw error;
  }
}

/* =====================================================
   TEAMS
===================================================== */

export async function loadTeams(): Promise<Team[]> {
  const {
    data: teamData,
    error: teamError,
  } =
    await supabase
      .from("teams")
      .select("*")
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
      `);

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
  team: Team
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
      );

  if (error) {
    throw error;
  }
}

/* =====================================================
   AUCTION PLAYERS
===================================================== */

export async function loadAuctionPlayers(): Promise<AuctionPlayer[]> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "auction_players"
      )
      .select("*")
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

      return player;
    }
  );
}

export async function insertAuctionPlayer(
  player: AuctionPlayer,
  queuePosition: number
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
          player.basePrice,

        photo_url:
          player.photo ??
          null,

        queue_position:
          queuePosition,

        status:
          "PENDING",

        updated_at:
          new Date().toISOString(),
      });

  if (error) {
    throw error;
  }
}

export async function deleteAuctionPlayerRecord(
  playerId: number
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
      );

  if (error) {
    throw error;
  }
}

/* =====================================================
   AUCTION HISTORY
===================================================== */

export async function loadAuctionHistory(): Promise<
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

export async function loadAuctionState(): Promise<AuctionState> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "auction_state"
      )
      .select("*")
      .eq("id", 1)
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
  state: AuctionState
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
      .eq("id", 1);

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

export async function loadDisplayEvent(): Promise<DisplayEvent> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "display_event"
      )
      .select("*")
      .eq("id", 1)
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
  price: number
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
      .eq("id", 1);

  if (error) {
    throw error;
  }
}

export async function triggerUnsoldDisplayEvent(
  player: AuctionPlayer
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
      .eq("id", 1);

  if (error) {
    throw error;
  }
}

export async function clearDisplayEvent() {
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
      .eq("id", 1);

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
  price: number
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
  player: AuctionPlayer
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

export async function undoLastDatabaseAction() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "auction_history"
      )
      .select("*")
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
  firstBasePrice: number
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
      .gte(
        "id",
        0
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
      .gte(
        "id",
        0
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
      .neq(
        "status",
        "__never__"
      );

  if (
    playerError
  ) {
    throw playerError;
  }

  await saveAuctionState({
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
  });

  await clearDisplayEvent();
}
