import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import "./App.css";
import "./AuctionTimer.css";
import "./AuctionShortcuts.css";
import "./SmartBidding.css";
import "./AuctionDivision.css";
import "./PlayerCategory.css";
import "./PlayerStats.css";
import "./PlayerTransfer.css";

import UserManagement from "./UserManagement";
import AuctionRecovery from "./AuctionRecovery";
import AuctionAudit from "./AuctionAudit";
import AuctionSummary from "./AuctionSummary";
import AuctionExports from "./AuctionExports";
import PreAuctionHealth from "./PreAuctionHealth";

import {
  supabase,
} from "./supabase";

import {
  deleteAuctionPlayerRecord,
  insertAuctionPlayer,
  insertTeamRecord,
  loadAuctionHistory,
  loadAuctionPlayers,
  loadAuctionState,
  loadTeams,
  loadTournamentSettings,
  markPlayerUnsold,
  resetDatabaseAuction,
  saveAuctionState,
  saveTournamentSettings,
  sellPlayer,
  transferOrSwapPurchasedPlayer,
  undoLastDatabaseAction,
  updateTeamRecord,
  updateAuctionPlayerCategory,
  getPlayerCategory,
  getCategoryBasePrice,
  getCategoryBidIncrement,
  getPlayerStats,
  updateAuctionPlayerStats,
  EMPTY_PLAYER_STATS,
  type AuctionDivision,
  type PlayerCategory,
  type PlayerStats,
  type DatabaseHistoryEntry,
  triggerSoldDisplayEvent,
  triggerUnsoldDisplayEvent,
  clearDisplayEvent,
} from "./database";

import {
  uploadPlayerPhoto,
  uploadTeamLogo,
} from "./storage";

import type {
  AuctionCallState,
  AuctionPlayer,
  AuctionTimerStatus,
  PlayerRole,
  Team,
  TournamentSettings,
} from "./types";

type Screen =
  | "board"
  | "team"
  | "control"
  | "players"
  | "teams"
  | "users"
  | "recovery"
  | "audit"
  | "summary"
  | "exports"
  | "health";

function App() {
  /* =====================================================
     SCREEN
  ===================================================== */

  const [
    screen,
    setScreen,
  ] =
    useState<Screen>(
      "board"
    );

  const [
    activeDivision,
    setActiveDivision,
  ] =
    useState<AuctionDivision>(
      "MEN"
    );

  /* =====================================================
     DATABASE DATA
  ===================================================== */

  const [
    teams,
    setTeams,
  ] =
    useState<Team[]>(
      []
    );

  const [
    settings,
    setSettings,
  ] =
    useState<TournamentSettings>({
      tournamentName:
        "CRICKET AUCTION ARENA",

      seasonName:
        "Season 2026",

      squadLimit:
        18,
    });

  const [
    auctionPlayers,
    setAuctionPlayers,
  ] =
    useState<AuctionPlayer[]>(
      []
    );

  const [
    history,
    setHistory,
  ] =
    useState<DatabaseHistoryEntry[]>(
      []
    );

  const [
    currentPlayerIndex,
    setCurrentPlayerIndex,
  ] =
    useState(0);

  const [
    currentBid,
    setCurrentBid,
  ] =
    useState(0);

  const [
    biddingTeamId,
    setBiddingTeamId,
  ] =
    useState<
      number | null
    >(null);

  const [
    timerDuration,
    setTimerDuration,
  ] =
    useState(30);

  const [
    timerStatus,
    setTimerStatus,
  ] =
    useState<AuctionTimerStatus>(
      "STOPPED"
    );

  const [
    timerEndsAt,
    setTimerEndsAt,
  ] =
    useState<string | null>(
      null
    );

  const [
    timerPausedRemaining,
    setTimerPausedRemaining,
  ] =
    useState<number | null>(
      null
    );

  const [
    callState,
    setCallState,
  ] =
    useState<AuctionCallState>(
      "BIDDING"
    );

  const [
    timerRemaining,
    setTimerRemaining,
  ] =
    useState(30);

  const soldShortcutLocked =
    useRef(false);

  const unsoldShortcutLocked =
    useRef(false);

  /* =====================================================
     UI STATE
  ===================================================== */

  const [
    selectedTeamId,
    setSelectedTeamId,
  ] =
    useState<
      number | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    saving,
    setSaving,
  ] =
    useState(false);


  /* =====================================================
     PLAYER TRANSFER / SWAP STATE
  ===================================================== */

  const [
    transferMode,
    setTransferMode,
  ] =
    useState<
      "TRANSFER" | "SWAP"
    >("TRANSFER");

  const [
    transferPlayerId,
    setTransferPlayerId,
  ] =
    useState<
      number | null
    >(null);

  const [
    transferTargetTeamId,
    setTransferTargetTeamId,
  ] =
    useState<
      number | null
    >(null);

  const [
    swapPlayerId,
    setSwapPlayerId,
  ] =
    useState<
      number | null
    >(null);

  const [
    transferMessage,
    setTransferMessage,
  ] =
    useState("");

  /* =====================================================
     PLAYER FORM
  ===================================================== */

  const [
    playerName,
    setPlayerName,
  ] =
    useState("");

  const [
    playerRole,
    setPlayerRole,
  ] =
    useState<PlayerRole>(
      "Batter"
    );

  const [
    playerCategory,
    setPlayerCategory,
  ] =
    useState<PlayerCategory>(
      "SILVER"
    );

  const [
    playerBasePrice,
    setPlayerBasePrice,
  ] =
    useState(
      getCategoryBasePrice(
        "SILVER"
      )
    );

  const [
    playerStats,
    setPlayerStats,
  ] =
    useState<PlayerStats>({
      ...EMPTY_PLAYER_STATS,
    });

  const [
    statsEditorPlayerId,
    setStatsEditorPlayerId,
  ] =
    useState<number | null>(
      null
    );

  const [
    editPlayerStats,
    setEditPlayerStats,
  ] =
    useState<PlayerStats>({
      ...EMPTY_PLAYER_STATS,
    });

  const [
    playerPhotoFile,
    setPlayerPhotoFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    playerPhotoPreview,
    setPlayerPhotoPreview,
  ] =
    useState("");

  const [
    newTeamName,
    setNewTeamName,
  ] =
    useState("");

  const [
    newTeamShortName,
    setNewTeamShortName,
  ] =
    useState("");

  const [
    newTeamOwner,
    setNewTeamOwner,
  ] =
    useState("");

  const [
    newTeamPurse,
    setNewTeamPurse,
  ] =
    useState(10);

  /* =====================================================
     LOAD ALL DATA
  ===================================================== */

  const refreshData =
    useCallback(
      async (
        showLoader =
          false
      ) => {
        try {
          if (
            showLoader
          ) {
            setLoading(
              true
            );
          }

          const [
            loadedSettings,
            loadedTeams,
            loadedPlayers,
            loadedHistory,
            loadedState,
          ] =
            await Promise.all([
              loadTournamentSettings(
                activeDivision
              ),
              loadTeams(
                activeDivision
              ),
              loadAuctionPlayers(
                activeDivision
              ),
              loadAuctionHistory(
                activeDivision
              ),
              loadAuctionState(
                activeDivision
              ),
            ]);

          setSettings(
            loadedSettings
          );

          setTeams(
            loadedTeams
          );

          setAuctionPlayers(
            loadedPlayers
          );

          setHistory(
            loadedHistory
          );

          setCurrentPlayerIndex(
            loadedState.currentPlayerIndex
          );

          setCurrentBid(
            loadedState.currentBid
          );

          setBiddingTeamId(
            loadedState.biddingTeamId
          );

          setTimerDuration(
            loadedState.timerDuration
          );

          setTimerStatus(
            loadedState.timerStatus
          );

          setTimerEndsAt(
            loadedState.timerEndsAt
          );

          setTimerPausedRemaining(
            loadedState.timerPausedRemaining
          );

          setCallState(
            loadedState.callState
          );

          if (
            loadedState.timerStatus ===
              "RUNNING" &&
            loadedState.timerEndsAt
          ) {
            setTimerRemaining(
              Math.max(
                0,
                Math.ceil(
                  (
                    new Date(
                      loadedState.timerEndsAt
                    ).getTime() -
                    Date.now()
                  ) /
                    1000
                )
              )
            );
          } else if (
            loadedState.timerStatus ===
            "PAUSED"
          ) {
            setTimerRemaining(
              loadedState.timerPausedRemaining ??
                loadedState.timerDuration
            );
          } else {
            setTimerRemaining(
              loadedState.timerDuration
            );
          }

          setErrorMessage(
            ""
          );
        } catch (
          error
        ) {
          console.error(
            error
          );

          setErrorMessage(
            error instanceof
              Error
              ? error.message
              : "Unable to load auction data."
          );
        } finally {
          if (
            showLoader
          ) {
            setLoading(
              false
            );
          }
        }
      },
      [
        activeDivision,
      ]
    );

  /* =====================================================
     INITIAL LOAD
  ===================================================== */

  useEffect(() => {
    void refreshData(
      true
    );
  }, [refreshData]);

  /* =====================================================
     REALTIME
  ===================================================== */

  useEffect(() => {
    const channel =
      supabase
        .channel(
          `${activeDivision.toLowerCase()}-admin-auction-live`
        )

        .on(
          "postgres_changes",
          {
            event:
              "*",
            schema:
              "public",
            table:
              "teams",
          },
          () => {
            void refreshData();
          }
        )

        .on(
          "postgres_changes",
          {
            event:
              "*",
            schema:
              "public",
            table:
              "tournament_settings",
          },
          () => {
            void refreshData();
          }
        )

        .on(
          "postgres_changes",
          {
            event:
              "*",
            schema:
              "public",
            table:
              "auction_players",
          },
          () => {
            void refreshData();
          }
        )

        .on(
          "postgres_changes",
          {
            event:
              "*",
            schema:
              "public",
            table:
              "purchases",
          },
          () => {
            void refreshData();
          }
        )

        .on(
          "postgres_changes",
          {
            event:
              "*",
            schema:
              "public",
            table:
              "auction_history",
          },
          () => {
            void refreshData();
          }
        )

        .on(
          "postgres_changes",
          {
            event:
              "*",
            schema:
              "public",
            table:
              "auction_state",
          },
          () => {
            void refreshData();
          }
        )

        .subscribe();

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [
    refreshData,
  ]);

  /* =====================================================
     LIVE AUCTION TIMER
  ===================================================== */

  useEffect(() => {
    if (
      timerStatus !==
        "RUNNING" ||
      !timerEndsAt
    ) {
      return;
    }

    const updateRemaining =
      () => {
        const remaining =
          Math.max(
            0,
            Math.ceil(
              (
                new Date(
                  timerEndsAt
                ).getTime() -
                Date.now()
              ) /
                1000
            )
          );

        setTimerRemaining(
          remaining
        );
      };

    updateRemaining();

    const interval =
      window.setInterval(
        updateRemaining,
        250
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    timerStatus,
    timerEndsAt,
  ]);

  const automaticCallState:
    AuctionCallState =
      timerRemaining <= 0
        ? "FINAL_CALL"
        : timerRemaining <= 2
        ? "GOING_TWICE"
        : timerRemaining <= 5
        ? "GOING_ONCE"
        : "BIDDING";

  useEffect(() => {
    const nextCallState =
      automaticCallState;

    if (
      nextCallState ===
      callState
    ) {
      return;
    }

    const syncCallState =
      async () => {
        setCallState(
          nextCallState
        );

        const shouldStop =
          nextCallState ===
          "FINAL_CALL";

        if (shouldStop) {
          setTimerStatus(
            "STOPPED"
          );

          setTimerEndsAt(
            null
          );

          setTimerPausedRemaining(
            null
          );
        }

        try {
          await saveAuctionState({
            currentPlayerIndex,
            currentBid,
            biddingTeamId,
            timerDuration,
            timerStatus:
              shouldStop
                ? "STOPPED"
                : timerStatus,
            timerEndsAt:
              shouldStop
                ? null
                : timerEndsAt,
            timerPausedRemaining:
              shouldStop
                ? null
                : timerPausedRemaining,
            callState:
              nextCallState,
          },
          activeDivision);
        } catch (error) {
          console.error(
            "Unable to sync auction call state.",
            error
          );
        }
      };

    void syncCallState();
  }, [
    automaticCallState,
    callState,
    currentPlayerIndex,
    currentBid,
    biddingTeamId,
    timerDuration,
    timerStatus,
    timerEndsAt,
    timerPausedRemaining,
  ]);

  const startTimer =
    async (
      duration:
        number =
          timerDuration
    ) => {
      const safeDuration =
        Math.max(
          5,
          Math.round(
            duration
          )
        );

      const endsAt =
        new Date(
          Date.now() +
            safeDuration *
              1000
        ).toISOString();

      setTimerDuration(
        safeDuration
      );

      setTimerStatus(
        "RUNNING"
      );

      setTimerEndsAt(
        endsAt
      );

      setTimerPausedRemaining(
        null
      );

      setTimerRemaining(
        safeDuration
      );

      setCallState(
        "BIDDING"
      );

      await saveAuctionState({
        currentPlayerIndex,
        currentBid,
        biddingTeamId,
        timerDuration:
          safeDuration,
        timerStatus:
          "RUNNING",
        timerEndsAt:
          endsAt,
        timerPausedRemaining:
          null,
        callState:
          "BIDDING",
      },
          activeDivision);
    };

  const pauseTimer =
    async () => {
      if (
        timerStatus !==
        "RUNNING"
      ) {
        return;
      }

      const remaining =
        Math.max(
          0,
          timerRemaining
        );

      setTimerStatus(
        "PAUSED"
      );

      setTimerEndsAt(
        null
      );

      setTimerPausedRemaining(
        remaining
      );

      await saveAuctionState({
        currentPlayerIndex,
        currentBid,
        biddingTeamId,
        timerDuration,
        timerStatus:
          "PAUSED",
        timerEndsAt:
          null,
        timerPausedRemaining:
          remaining,
        callState,
      },
          activeDivision);
    };

  const resumeTimer =
    async () => {
      if (
        timerStatus !==
        "PAUSED"
      ) {
        return;
      }

      const remaining =
        Math.max(
          1,
          timerPausedRemaining ??
            timerRemaining ??
            timerDuration
        );

      const endsAt =
        new Date(
          Date.now() +
            remaining *
              1000
        ).toISOString();

      setTimerStatus(
        "RUNNING"
      );

      setTimerEndsAt(
        endsAt
      );

      setTimerPausedRemaining(
        null
      );

      setTimerRemaining(
        remaining
      );

      await saveAuctionState({
        currentPlayerIndex,
        currentBid,
        biddingTeamId,
        timerDuration,
        timerStatus:
          "RUNNING",
        timerEndsAt:
          endsAt,
        timerPausedRemaining:
          null,
        callState,
      },
          activeDivision);
    };

  const resetTimer =
    async () => {
      setTimerStatus(
        "STOPPED"
      );

      setTimerEndsAt(
        null
      );

      setTimerPausedRemaining(
        null
      );

      setTimerRemaining(
        timerDuration
      );

      setCallState(
        "BIDDING"
      );

      await saveAuctionState({
        currentPlayerIndex,
        currentBid,
        biddingTeamId,
        timerDuration,
        timerStatus:
          "STOPPED",
        timerEndsAt:
          null,
        timerPausedRemaining:
          null,
        callState:
          "BIDDING",
      },
          activeDivision);
    };

  const changeTimerDuration =
    async (
      duration: number
    ) => {
      const safeDuration =
        Math.max(
          5,
          Math.round(
            duration
          )
        );

      setTimerDuration(
        safeDuration
      );

      setTimerRemaining(
        safeDuration
      );

      setTimerStatus(
        "STOPPED"
      );

      setTimerEndsAt(
        null
      );

      setTimerPausedRemaining(
        null
      );

      setCallState(
        "BIDDING"
      );

      await saveAuctionState({
        currentPlayerIndex,
        currentBid,
        biddingTeamId,
        timerDuration:
          safeDuration,
        timerStatus:
          "STOPPED",
        timerEndsAt:
          null,
        timerPausedRemaining:
          null,
        callState:
          "BIDDING",
      },
          activeDivision);
    };



  /* =====================================================
     HELPERS
  ===================================================== */

  const calculateSpent = (
    team: Team
  ) => {
    return team.players.reduce(
      (
        total,
        player
      ) =>
        total +
        player.purchasePrice,
      0
    );
  };

  const calculateRemaining = (
    team: Team
  ) => {
    return (
      team.startingPurse -
      calculateSpent(
        team
      )
    );
  };

  const getTeamBidEligibility = (
    team: Team,
    bid:
      number =
        currentBid
  ) => {
    const remaining =
      calculateRemaining(
        team
      );

    if (
      team.players.length >=
      settings.squadLimit
    ) {
      return {
        eligible: false,
        reason:
          "SQUAD FULL",
        remaining,
      };
    }

    if (
      remaining <
      bid
    ) {
      return {
        eligible: false,
        reason:
          "INSUFFICIENT PURSE",
        remaining,
      };
    }

    return {
      eligible: true,
      reason:
        "ELIGIBLE",
      remaining,
    };
  };

  const getInitials = (
    name: string
  ) => {
    return name
      .split(" ")
      .filter(
        Boolean
      )
      .map(
        (word) =>
          word[0]
      )
      .join("")
      .slice(
        0,
        2
      )
      .toUpperCase();
  };

  const selectedTeam =
    teams.find(
      (team) =>
        team.id ===
        selectedTeamId
    ) ??
    null;

  const biddingTeam =
    teams.find(
      (team) =>
        team.id ===
        biddingTeamId
    ) ??
    null;

  const currentPlayer =
    auctionPlayers[
      currentPlayerIndex
    ];

  const openTeam = (
    team: Team
  ) => {
    setSelectedTeamId(
      team.id
    );

    setTransferMode(
      "TRANSFER"
    );

    setTransferPlayerId(
      null
    );

    setTransferTargetTeamId(
      null
    );

    setSwapPlayerId(
      null
    );

    setTransferMessage(
      ""
    );

    setScreen(
      "team"
    );
  };

  const changeDivision = (
    division:
      AuctionDivision
  ) => {
    if (
      division ===
      activeDivision
    ) {
      return;
    }

    setSelectedTeamId(
      null
    );

    setBiddingTeamId(
      null
    );

    setScreen(
      "board"
    );

    setActiveDivision(
      division
    );
  };

  const addTeam =
    async () => {
      if (
        !newTeamName.trim()
      ) {
        alert(
          "Please enter the team name."
        );

        return;
      }

      if (
        !newTeamShortName.trim()
      ) {
        alert(
          "Please enter the team short code."
        );

        return;
      }

      if (
        newTeamPurse <=
        0
      ) {
        alert(
          "Starting purse must be greater than zero."
        );

        return;
      }

      try {
        setSaving(
          true
        );

        await insertTeamRecord(
          {
            name:
              newTeamName.trim(),

            shortName:
              newTeamShortName
                .trim()
                .toUpperCase()
                .slice(
                  0,
                  4
                ),

            owner:
              newTeamOwner.trim(),

            startingPurse:
              newTeamPurse,
          },
          activeDivision
        );

        setNewTeamName(
          ""
        );

        setNewTeamShortName(
          ""
        );

        setNewTeamOwner(
          ""
        );

        await refreshData();

        alert(
          `${activeDivision === "WOMEN" ? "Women's" : "Men's"} team added successfully.`
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        alert(
          error instanceof
            Error
            ? error.message
            : "Unable to add team."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /* =====================================================
     TOURNAMENT SETTINGS
  ===================================================== */

  const handleSaveSettings =
    async () => {
      try {
        setSaving(
          true
        );

        await saveTournamentSettings(
          settings,
          activeDivision
        );

        await refreshData();

        alert(
          "Tournament settings saved."
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        alert(
          "Unable to save tournament settings."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /* =====================================================
     TEAM LOCAL EDIT
  ===================================================== */

  const updateTeamLocal = (
    teamId: number,
    field:
      | "name"
      | "shortName"
      | "owner"
      | "startingPurse",
    value: string
  ) => {
    setTeams(
      (
        previousTeams
      ) =>
        previousTeams.map(
          (team) => {
            if (
              team.id !==
              teamId
            ) {
              return team;
            }

            if (
              field ===
              "startingPurse"
            ) {
              return {
                ...team,

                startingPurse:
                  Number(
                    value
                  ) ||
                  0,
              };
            }

            if (
              field ===
              "shortName"
            ) {
              return {
                ...team,

                shortName:
                  value
                    .toUpperCase()
                    .slice(
                      0,
                      4
                    ),
              };
            }

            return {
              ...team,
              [field]:
                value,
            };
          }
        )
    );
  };

  const saveTeam =
    async (
      team: Team
    ) => {
      try {
        setSaving(
          true
        );

        await updateTeamRecord(
          team,
          activeDivision
        );

        await refreshData();

        alert(
          `${team.name} saved.`
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        alert(
          "Unable to save team."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /* =====================================================
     TEAM LOGO STORAGE
  ===================================================== */

  const updateTeamLogo =
    async (
      team: Team,
      file?: File
    ) => {
      if (!file) {
        return;
      }

      try {
        setSaving(
          true
        );

        const {
          publicUrl,
        } =
          await uploadTeamLogo(
            team.id,
            file
          );

        await updateTeamRecord(
          {
            ...team,
            logo:
              publicUrl,
          },
          activeDivision
        );

        await refreshData();

        alert(
          `${team.name} logo uploaded.`
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        alert(
          error instanceof
            Error
            ? error.message
            : "Unable to upload team logo."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  const removeTeamLogo =
    async (
      team: Team
    ) => {
      try {
        setSaving(
          true
        );

        await updateTeamRecord(
          {
            ...team,
            logo:
              undefined,
          },
          activeDivision
        );

        await refreshData();
      } catch (
        error
      ) {
        console.error(
          error
        );

        alert(
          "Unable to remove team logo."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /* =====================================================
     PLAYER PHOTO FILE
  ===================================================== */

  const handlePlayerPhoto = (
    file?: File
  ) => {
    if (!file) {
      return;
    }

    setPlayerPhotoFile(
      file
    );

    if (
      playerPhotoPreview
    ) {
      URL.revokeObjectURL(
        playerPhotoPreview
      );
    }

    setPlayerPhotoPreview(
      URL.createObjectURL(
        file
      )
    );
  };

  const clearPlayerPhoto =
    () => {
      if (
        playerPhotoPreview
      ) {
        URL.revokeObjectURL(
          playerPhotoPreview
        );
      }

      setPlayerPhotoPreview(
        ""
      );

      setPlayerPhotoFile(
        null
      );
    };

  /* =====================================================
     ADD PLAYER + STORAGE PHOTO
  ===================================================== */

  const addPlayer =
    async () => {
      if (
        !playerName.trim()
      ) {
        alert(
          "Please enter the player name."
        );

        return;
      }

      if (
        playerBasePrice <=
        0
      ) {
        alert(
          "Base price must be greater than zero."
        );

        return;
      }

      try {
        setSaving(
          true
        );

        const playerId =
          Date.now();

        let photoUrl:
          | string
          | undefined;

        if (
          playerPhotoFile
        ) {
          const uploaded =
            await uploadPlayerPhoto(
              playerId,
              playerPhotoFile
            );

          photoUrl =
            uploaded.publicUrl;
        }

        const player: AuctionPlayer =
          {
            id:
              playerId,

            name:
              playerName.trim(),

            role:
              playerRole,

            basePrice:
              getCategoryBasePrice(
                playerCategory
              ),

            photo:
              photoUrl,
          };

        await insertAuctionPlayer(
          player,
          auctionPlayers.length +
            1,
          activeDivision,
          playerCategory,
          playerStats
        );

        setPlayerName(
          ""
        );

        setPlayerRole(
          "Batter"
        );

        setPlayerCategory(
          "SILVER"
        );

        setPlayerBasePrice(
          getCategoryBasePrice(
            "SILVER"
          )
        );

        setPlayerStats({
          ...EMPTY_PLAYER_STATS,
        });

        clearPlayerPhoto();

        await refreshData();

        alert(
          `${player.name} added successfully.`
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        alert(
          error instanceof
            Error
            ? error.message
            : "Unable to add player."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /* =====================================================
     DELETE PLAYER
  ===================================================== */

  const deletePlayer =
    async (
      player: AuctionPlayer,
      index: number
    ) => {
      if (
        index <
        currentPlayerIndex
      ) {
        alert(
          "You cannot delete a player who has already passed through the auction."
        );

        return;
      }

      const used =
        history.some(
          (entry) =>
            entry.playerId ===
            player.id
        );

      if (used) {
        alert(
          "This player has already been processed."
        );

        return;
      }

      if (
        !window.confirm(
          `Delete ${player.name}?`
        )
      ) {
        return;
      }

      try {
        setSaving(
          true
        );

        await deleteAuctionPlayerRecord(
          player.id,
          activeDivision
        );

        await refreshData();
      } catch (
        error
      ) {
        console.error(
          error
        );

        alert(
          "Unable to delete player."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  const openStatsEditor = (
    player: AuctionPlayer
  ) => {
    setStatsEditorPlayerId(
      player.id
    );

    setEditPlayerStats(
      getPlayerStats(
        player
      )
    );
  };

  const saveEditedStats =
    async () => {
      if (
        statsEditorPlayerId ===
        null
      ) {
        return;
      }

      try {
        setSaving(
          true
        );

        await updateAuctionPlayerStats(
          statsEditorPlayerId,
          editPlayerStats,
          activeDivision
        );

        await refreshData();

        setStatsEditorPlayerId(
          null
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        alert(
          "Unable to update player stats."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /* =====================================================
     CSV IMPORT
  ===================================================== */

  const handleCSVImport = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target
        .files?.[0];

    if (!file) {
      return;
    }

    const reader =
      new FileReader();

    reader.onload =
      async () => {
        try {
          setSaving(
            true
          );

          const text =
            String(
              reader.result
            );

          const rows =
            text
              .split(
                /\r?\n/
              )
              .map(
                (row) =>
                  row.trim()
              )
              .filter(
                Boolean
              );

          const normalizeRole =
            (
              rawRole: string
            ): PlayerRole | null => {
              const normalized =
                rawRole
                  .trim()
                  .toLowerCase()
                  .replace(
                    /[\s_-]+/g,
                    ""
                  );

              if (
                normalized ===
                "batter"
              ) {
                return "Batter";
              }

              if (
                normalized ===
                "bowler"
              ) {
                return "Bowler";
              }

              if (
                normalized ===
                  "allrounder" ||
                normalized ===
                  "allround"
              ) {
                return "All-Rounder";
              }

              if (
                normalized ===
                  "wicketkeeper" ||
                normalized ===
                  "keeper"
              ) {
                return "Wicketkeeper";
              }

              return null;
            };

          let imported =
            0;

          let skipped =
            0;

          for (
            let i = 1;
            i <
            rows.length;
            i++
          ) {
            const columns =
              rows[i]
                .split(",")
                .map(
                  (
                    value
                  ) =>
                    value.trim()
                );

            const [
              name,
              roleRaw,
              baseRaw,
              categoryRaw,
              matchesRaw,
              runsRaw,
              battingAverageRaw,
              strikeRateRaw,
              wicketsRaw,
              economyRateRaw,
            ] =
              columns;

            if (
              !name ||
              !roleRaw ||
              !baseRaw
            ) {
              continue;
            }

            const role =
              normalizeRole(
                roleRaw
              );

            if (!role) {
              skipped++;
              continue;
            }

            const suppliedBasePrice =
              Number(
                baseRaw
                  .toUpperCase()
                  .replace(
                    /\s*CR\s*/g,
                    ""
                  )
                  .replace(
                    /₹/g,
                    ""
                  )
                  .trim()
              );

            if (
              Number.isNaN(
                suppliedBasePrice
              ) ||
              suppliedBasePrice <=
                0
            ) {
              skipped++;
              continue;
            }

            const category:
              PlayerCategory =
                categoryRaw
                  ?.trim()
                  .toUpperCase() ===
                "MARQUEE"
                  ? "MARQUEE"
                  : categoryRaw
                      ?.trim()
                      .toUpperCase() ===
                    "GOLD"
                  ? "GOLD"
                  : "SILVER";

            const stats: PlayerStats = {
              matches: Number(matchesRaw ?? 0) || 0,
              runs: Number(runsRaw ?? 0) || 0,
              battingAverage:
                Number(battingAverageRaw ?? 0) || 0,
              strikeRate:
                Number(strikeRateRaw ?? 0) || 0,
              wickets: Number(wicketsRaw ?? 0) || 0,
              economyRate:
                Number(economyRateRaw ?? 0) || 0,
            };

            await insertAuctionPlayer(
              {
                id:
                  Date.now() +
                  i,

                name,

                role,

                basePrice:
                  getCategoryBasePrice(
                    category
                  ),
              },

              auctionPlayers.length +
                imported +
                1,
              activeDivision,
              category,
              stats
            );

            imported++;
          }

          await refreshData();

          alert(
            `${imported} players imported.${
              skipped > 0
                ? ` ${skipped} rows skipped.`
                : ""
            }`
          );

          event.target.value =
            "";
        } catch (
          error
        ) {
          console.error(
            error
          );

          alert(
            "Unable to import CSV."
          );
        } finally {
          setSaving(
            false
          );
        }
      };

    reader.readAsText(
      file
    );
  };

  /* =====================================================
     BID CONTROLS
  ===================================================== */

  const currentPlayerCategory =
    currentPlayer
      ? getPlayerCategory(
          currentPlayer
        )
      : "SILVER";

  const currentBidIncrement =
    getCategoryBidIncrement(
      currentPlayerCategory
    );

  const changeBid =
    async (
      newBid: number
    ) => {
      if (
        !currentPlayer
      ) {
        return;
      }

      const finalBid =
        Math.max(
          currentPlayer.basePrice,

          Number(
            newBid.toFixed(
              2
            )
          )
        );

      const selectedTeamStillEligible =
        biddingTeam
          ? getTeamBidEligibility(
              biddingTeam,
              finalBid
            ).eligible
          : true;

      const nextBiddingTeamId =
        selectedTeamStillEligible
          ? biddingTeamId
          : null;

      setCurrentBid(
        finalBid
      );

      if (
        !selectedTeamStillEligible
      ) {
        setBiddingTeamId(
          null
        );
      }

      const isBidIncrease =
        finalBid >
        currentBid;

      const nextTimerStatus =
        isBidIncrease
          ? "RUNNING"
          : timerStatus;

      const shouldResetRunningTimer =
        nextTimerStatus ===
        "RUNNING";

      const resetEndsAt =
        shouldResetRunningTimer
          ? new Date(
              Date.now() +
                timerDuration *
                  1000
            ).toISOString()
          : null;

      const nextPausedRemaining =
        nextTimerStatus ===
        "PAUSED"
          ? timerDuration
          : null;

      if (
        shouldResetRunningTimer
      ) {
        setTimerStatus(
          "RUNNING"
        );

        setTimerEndsAt(
          resetEndsAt
        );

        setTimerPausedRemaining(
          null
        );

        setTimerRemaining(
          timerDuration
        );
      } else if (
        nextTimerStatus ===
        "PAUSED"
      ) {
        setTimerPausedRemaining(
          timerDuration
        );

        setTimerRemaining(
          timerDuration
        );
      }

      setCallState(
        "BIDDING"
      );

      try {
        await saveAuctionState({
          currentPlayerIndex,

          currentBid:
            finalBid,

          biddingTeamId:
            nextBiddingTeamId,

          timerDuration,

          timerStatus:
            nextTimerStatus,

          timerEndsAt:
            nextTimerStatus ===
            "RUNNING"
              ? resetEndsAt
              : timerEndsAt,

          timerPausedRemaining:
            nextTimerStatus ===
            "PAUSED"
              ? nextPausedRemaining
              : null,

          callState:
            "BIDDING",
        },
          activeDivision);
      } catch (
        error
      ) {
        console.error(
          error
        );
      }
    };

  const selectBiddingTeam =
    async (
      teamId: number
    ) => {
      const team =
        teams.find(
          (item) =>
            item.id ===
            teamId
        );

      if (!team) {
        return;
      }

      const eligibility =
        getTeamBidEligibility(
          team
        );

      if (
        !eligibility.eligible
      ) {
        return;
      }

      setBiddingTeamId(
        teamId
      );

      try {
        await saveAuctionState({
          currentPlayerIndex,

          currentBid,

          biddingTeamId:
            teamId,

          timerDuration,

          timerStatus,

          timerEndsAt,

          timerPausedRemaining,

          callState,
        },
          activeDivision);
      } catch (
        error
      ) {
        console.error(
          error
        );
      }
    };

  /* =====================================================
     NEXT PLAYER
  ===================================================== */

  const moveToNextPlayer =
    async (
      completedStatus:
        | "SOLD"
        | "UNSOLD"
    ) => {
      /*
        Include the action that has just completed because
        refreshData() runs after this function.
      */
      const effectiveHistory =
        currentPlayer
          ? [
              ...history,
              {
                id:
                  Date.now(),

                playerId:
                  currentPlayer.id,

                playerName:
                  currentPlayer.name,

                status:
                  completedStatus,
              },
            ]
          : history;

      /*
        ROUND 1
        Pick randomly from players who have never been
        processed in the auction.
      */
      const firstRoundPlayers =
        auctionPlayers
          .map(
            (
              player,
              index
            ) => ({
              player,
              index,
            })
          )
          .filter(
            ({
              player,
            }) =>
              !effectiveHistory.some(
                (entry) =>
                  entry.playerId ===
                  player.id
              )
          );

      /*
        ROUND 2 - UNSOLD RE-AUCTION
        Starts only when Round 1 is complete.

        A player qualifies when:
        - never SOLD
        - exactly one UNSOLD result exists

        If the player is UNSOLD again, the count becomes 2
        and the player will not return a third time.
      */
      const reauctionPlayers =
        firstRoundPlayers.length ===
        0
          ? auctionPlayers
              .map(
                (
                  player,
                  index
                ) => ({
                  player,
                  index,
                })
              )
              .filter(
                ({
                  player,
                }) => {
                  const playerHistory =
                    effectiveHistory.filter(
                      (entry) =>
                        entry.playerId ===
                        player.id
                    );

                  const wasSold =
                    playerHistory.some(
                      (entry) =>
                        entry.status ===
                        "SOLD"
                    );

                  const unsoldCount =
                    playerHistory.filter(
                      (entry) =>
                        entry.status ===
                        "UNSOLD"
                    ).length;

                  return (
                    !wasSold &&
                    unsoldCount ===
                      1
                  );
                }
              )
          : [];

      const eligiblePlayers =
        firstRoundPlayers.length >
        0
          ? firstRoundPlayers
          : reauctionPlayers;

      const randomSelection =
        eligiblePlayers.length >
        0
          ? eligiblePlayers[
              Math.floor(
                Math.random() *
                  eligiblePlayers.length
              )
            ]
          : null;

      const nextIndex =
        randomSelection
          ?.index ??
        auctionPlayers.length;

      const nextPlayer =
        randomSelection
          ?.player;

      const nextBid =
        nextPlayer
          ?.basePrice ??
        0;

      await saveAuctionState({
        currentPlayerIndex:
          nextIndex,

        currentBid:
          nextBid,

        biddingTeamId:
          null,

        timerDuration,

        timerStatus:
          "STOPPED",

        timerEndsAt:
          null,

        timerPausedRemaining:
          null,

        callState:
          "BIDDING",
      },
          activeDivision);

      setCurrentPlayerIndex(
        nextIndex
      );

      setCurrentBid(
        nextBid
      );

      setBiddingTeamId(
        null
      );

      setTimerStatus(
        "STOPPED"
      );

      setTimerEndsAt(
        null
      );

      setTimerPausedRemaining(
        null
      );

      setCallState(
        "BIDDING"
      );

      setTimerRemaining(
        timerDuration
      );
    };

  /* =====================================================
     PROJECTOR EVENT AUTO-CLEAR
  ===================================================== */

  const scheduleDisplayEventClear = (
    eventType: "SOLD" | "UNSOLD",
    playerId: number,
    delayMs: number
  ) => {
    window.setTimeout(() => {
      void (async () => {
        try {
          const {
            data,
            error,
          } = await supabase
            .from("display_event")
            .select("event_type, player_id")
            .eq("id", 1)
            .maybeSingle();

          if (error) {
            throw error;
          }

          const isSameEvent =
            data?.event_type === eventType &&
            String(data?.player_id ?? "") ===
              String(playerId);

          if (isSameEvent) {
            await clearDisplayEvent(activeDivision);
          }
        } catch (error) {
          console.error(
            "Unable to clear projector display event:",
            error
          );
        }
      })();
    }, delayMs);
  };

  /* =====================================================
     AUDIT LOGGER

     Audit logging is intentionally non-blocking.
     A failed audit write must never stop a live
     SOLD / UNSOLD / UNDO / RESET action.
  ===================================================== */

  const recordAuditEvent =
    async (
      action: string,
      data: {
        playerId?: number | null;
        playerName?: string | null;
        teamId?: number | null;
        teamName?: string | null;
        amount?: number | null;
        details?: Record<string, unknown>;
      } = {}
    ) => {
      try {
        const {
          error,
        } =
          await supabase.rpc(
            "log_auction_audit",
            {
              p_action:
                action,

              p_player_id:
                data.playerId ??
                null,

              p_player_name:
                data.playerName ??
                null,

              p_team_id:
                data.teamId ??
                null,

              p_team_name:
                data.teamName ??
                null,

              p_amount:
                data.amount ??
                null,

              p_details:
                data.details ??
                {},

              p_division:
                activeDivision,
            }
          );

        if (error) {
          throw error;
        }
      } catch (error) {
        console.error(
          "Unable to write audit log.",
          error
        );
      }
    };

  /* =====================================================
     SOLD
  ===================================================== */

  const handleSold =
    async () => {
      if (!currentPlayer) {
        return;
      }

      if (!biddingTeam) {
        alert(
          "Please select the winning team."
        );

        return;
      }

      if (
        currentBid >
        calculateRemaining(
          biddingTeam
        )
      ) {
        alert(
          `${biddingTeam.name} does not have enough purse remaining.`
        );

        return;
      }

      if (
        biddingTeam.players
          .length >=
        settings.squadLimit
      ) {
        alert(
          `${biddingTeam.name} has reached the squad limit.`
        );

        return;
      }

      const soldPlayer =
        currentPlayer;

      const winningTeam =
        biddingTeam;

      const soldPrice =
        currentBid;

      try {
        setSaving(true);

        await sellPlayer(
          soldPlayer,
          winningTeam,
          soldPrice
        ,
          activeDivision);

        /*
          Update local history immediately so the
          UNSOLD RE-AUCTION counter drops as soon
          as the player is SOLD. refreshData()
          will replace this with the canonical DB
          history a moment later.
        */
        setHistory(
          (
            currentHistory
          ) => [
            ...currentHistory,
            {
              id:
                Date.now(),

              playerId:
                soldPlayer.id,

              playerName:
                soldPlayer.name,

              status:
                "SOLD",

              teamId:
                winningTeam.id,

              teamName:
                winningTeam.name,

              price:
                soldPrice,

              createdAt:
                new Date().toISOString(),
            },
          ]
        );

        void recordAuditEvent(
          "SOLD",
          {
            playerId:
              soldPlayer.id,

            playerName:
              soldPlayer.name,

            teamId:
              winningTeam.id,

            teamName:
              winningTeam.name,

            amount:
              soldPrice,

            details: {
              summary:
                `${soldPlayer.name} sold to ${winningTeam.name} for ₹${soldPrice.toFixed(2)} Cr`,
            },
          }
        );

        /*
          Trigger the projector event immediately.
          The admin screen does NOT wait for the
          animation to finish before moving on.
        */

        await triggerSoldDisplayEvent(
          soldPlayer,
          winningTeam,
          soldPrice
        ,
          activeDivision);

        scheduleDisplayEventClear(
          "SOLD",
          soldPlayer.id,
          4000
        );

        await moveToNextPlayer(
          "SOLD"
        );

        await refreshData();
      } catch (error) {
        console.error(error);

        alert(
          error instanceof Error
            ? error.message
            : "Unable to complete sale."
        );
      } finally {
        setSaving(false);
      }
    };

  /* =====================================================
     UNSOLD
  ===================================================== */

  const handleUnsold =
    async () => {
      if (!currentPlayer) {
        return;
      }

      const unsoldPlayer =
        currentPlayer;

      try {
        setSaving(true);

        await markPlayerUnsold(
          unsoldPlayer
        ,
          activeDivision);

        /*
          Update local history immediately.
          If this is the player's second UNSOLD
          attempt, the re-auction counter will
          reduce straight away.
        */
        setHistory(
          (
            currentHistory
          ) => [
            ...currentHistory,
            {
              id:
                Date.now(),

              playerId:
                unsoldPlayer.id,

              playerName:
                unsoldPlayer.name,

              status:
                "UNSOLD",

              createdAt:
                new Date().toISOString(),
            },
          ]
        );

        void recordAuditEvent(
          "UNSOLD",
          {
            playerId:
              unsoldPlayer.id,

            playerName:
              unsoldPlayer.name,

            details: {
              summary:
                `${unsoldPlayer.name} marked UNSOLD`,
            },
          }
        );

        /*
          Trigger the projector event immediately.
          The auction controller can continue
          without waiting for the animation.
        */

        await triggerUnsoldDisplayEvent(
          unsoldPlayer
        ,
          activeDivision);

        scheduleDisplayEventClear(
          "UNSOLD",
          unsoldPlayer.id,
          3000
        );

        await moveToNextPlayer(
          "UNSOLD"
        );

        await refreshData();
      } catch (error) {
        console.error(error);

        alert(
          error instanceof Error
            ? error.message
            : "Unable to mark player unsold."
        );
      } finally {
        setSaving(false);
      }
    };

  /* =====================================================
     UNDO
  ===================================================== */

  const undoLastAction =
    async () => {
      if (
        history.length ===
        0
      ) {
        alert(
          "Nothing to undo."
        );

        return;
      }

      try {
        setSaving(
          true
        );

        const actionBeingUndone =
          history[
            history.length -
              1
          ] ??
          null;

        await undoLastDatabaseAction(activeDivision);

        if (
          actionBeingUndone
        ) {
          void recordAuditEvent(
            "UNDO",
            {
              playerId:
                actionBeingUndone.playerId,

              playerName:
                actionBeingUndone.playerName,

              teamId:
                actionBeingUndone.teamId ??
                null,

              teamName:
                actionBeingUndone.teamName ??
                null,

              amount:
                actionBeingUndone.price ??
                null,

              details: {
                summary:
                  `Undid ${actionBeingUndone.status} action for ${actionBeingUndone.playerName}`,

                previousStatus:
                  actionBeingUndone.status,
              },
            }
          );
        }

        const previousIndex =
          actionBeingUndone
            ? Math.max(
                0,
                auctionPlayers.findIndex(
                  (player) =>
                    player.id ===
                    actionBeingUndone.playerId
                )
              )
            : Math.max(
                0,
                currentPlayerIndex
              );

        const previousPlayer =
          auctionPlayers[
            previousIndex
          ];

        await saveAuctionState({
          currentPlayerIndex:
            previousIndex,

          currentBid:
            previousPlayer
              ?.basePrice ??
            0,

          biddingTeamId:
            null,

          timerDuration,

          timerStatus:
            "STOPPED",

          timerEndsAt:
            null,

          timerPausedRemaining:
            null,

          callState:
            "BIDDING",
        },
          activeDivision);

        setTimerStatus(
          "STOPPED"
        );

        setTimerEndsAt(
          null
        );

        setTimerPausedRemaining(
          null
        );

        setCallState(
          "BIDDING"
        );

        await refreshData();
      } catch (
        error
      ) {
        console.error(
          error
        );

        alert(
          "Unable to undo the last action."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /* =====================================================
     RESET
  ===================================================== */

  const resetAuction =
    async () => {
      if (
        !window.confirm(
          "Reset all auction purchases and history?\n\nTeam and player setup will remain."
        )
      ) {
        return;
      }

      try {
        setSaving(
          true
        );

        const resetSummary = {
          purchaseCount:
            teams.reduce(
              (
                total,
                team
              ) =>
                total +
                team.players.length,
              0
            ),

          historyCount:
            history.length,

          currentPlayerIndex,
        };

        await resetDatabaseAuction(
          auctionPlayers[0]
            ?.basePrice ??
            0
        ,
          activeDivision);

        void recordAuditEvent(
          "RESET",
          {
            details: {
              summary:
                "Auction purchases and history were reset.",

              ...resetSummary,
            },
          }
        );

        await refreshData();

        setScreen(
          "board"
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        alert(
          "Unable to reset auction."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /* =====================================================
     AUCTIONEER KEYBOARD SHORTCUTS
     Space = Start/Pause/Resume timer
     R = Reset timer
     1/2/3/4 = Bid increments
     S = SOLD
     U = UNSOLD
  ===================================================== */

  useEffect(() => {
    if (
      screen !==
      "control"
    ) {
      return;
    }

    const handleKeyDown =
      (
        event:
          KeyboardEvent
      ) => {
        const target =
          event.target as
            | HTMLElement
            | null;

        const tag =
          target?.tagName
            ?.toLowerCase();

        if (
          tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          target?.isContentEditable
        ) {
          return;
        }

        if (
          event.code ===
          "Space"
        ) {
          event.preventDefault();

          if (
            timerStatus ===
            "RUNNING"
          ) {
            void pauseTimer();
          } else if (
            timerStatus ===
            "PAUSED"
          ) {
            void resumeTimer();
          } else {
            void startTimer();
          }

          return;
        }

        if (
          event.key.toLowerCase() ===
          "r"
        ) {
          void resetTimer();
          return;
        }

        if (
          event.key ===
          "1"
        ) {
          void changeBid(
            currentBid +
              currentBidIncrement
          );
          return;
        }

        if (
          event.key ===
          "2"
        ) {
          void changeBid(
            currentBid +
              currentBidIncrement
          );
          return;
        }

        if (
          event.key ===
          "3"
        ) {
          void changeBid(
            currentBid +
              currentBidIncrement
          );
          return;
        }

        if (
          event.key ===
          "4"
        ) {
          void changeBid(
            currentBid -
              currentBidIncrement
          );
          return;
        }

        if (
          event.key.toLowerCase() ===
          "s" &&
          !soldShortcutLocked
            .current
        ) {
          soldShortcutLocked
            .current =
              true;

          void handleSold()
            .finally(
              () => {
                soldShortcutLocked
                  .current =
                    false;
              }
            );

          return;
        }

        if (
          event.key.toLowerCase() ===
          "u" &&
          !unsoldShortcutLocked
            .current
        ) {
          unsoldShortcutLocked
            .current =
              true;

          void handleUnsold()
            .finally(
              () => {
                unsoldShortcutLocked
                  .current =
                    false;
              }
            );
        }
      };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    screen,
    timerStatus,
    currentBid,
    currentPlayer,
    biddingTeam,
    saving,
    timerDuration,
    timerEndsAt,
    timerPausedRemaining,
    callState,
  ]);

  /* =====================================================
     LOADING
  ===================================================== */

  if (
    loading
  ) {
    return (
      <div className="app">
        <div
          style={{
            minHeight:
              "100vh",

            display:
              "grid",

            placeItems:
              "center",

            textAlign:
              "center",
          }}
        >
          <div>
            <p className="eyebrow">
              CONNECTING
            </p>

            <h1>
              Loading Auction...
            </h1>
          </div>
        </div>
      </div>
    );
  }

  /* =====================================================
     ERROR
  ===================================================== */

  if (
    errorMessage
  ) {
    return (
      <div className="app">
        <div
          style={{
            minHeight:
              "100vh",

            display:
              "grid",

            placeItems:
              "center",

            padding:
              "30px",
          }}
        >
          <div
            className="player-manager-card"
            style={{
              maxWidth:
                "700px",
            }}
          >
            <p className="eyebrow">
              DATABASE ERROR
            </p>

            <h2>
              Unable to load auction
            </h2>

            <p>
              {
                errorMessage
              }
            </p>

            <button
              className="auction-control-button"
              onClick={() =>
                void refreshData(
                  true
                )
              }
            >
              RETRY
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =====================================================
     PRE-AUCTION HEALTH CHECK
  ===================================================== */

  if (
    screen ===
    "health"
  ) {
    return (
      <PreAuctionHealth
        division={
          activeDivision
        }
        onBack={() =>
          setScreen(
            "board"
          )
        }
      />
    );
  }

  /* =====================================================
     RESULTS EXPORT
  ===================================================== */

  if (
    screen ===
    "exports"
  ) {
    return (
      <AuctionExports
        division={
          activeDivision
        }
        onBack={() =>
          setScreen(
            "board"
          )
        }
      />
    );
  }

  /* =====================================================
     LIVE AUCTION SUMMARY
  ===================================================== */

  if (
    screen ===
    "summary"
  ) {
    return (
      <AuctionSummary
        division={
          activeDivision
        }
        onBack={() =>
          setScreen(
            "board"
          )
        }
      />
    );
  }

  /* =====================================================
     AUDIT LOG
  ===================================================== */

  if (
    screen ===
    "audit"
  ) {
    return (
      <AuctionAudit
        division={
          activeDivision
        }
        onBack={() =>
          setScreen(
            "board"
          )
        }
      />
    );
  }

  /* =====================================================
     BACKUP & RECOVERY
  ===================================================== */

  if (
    screen ===
    "recovery"
  ) {
    return (
      <AuctionRecovery
        division={
          activeDivision
        }
        onBack={() =>
          setScreen(
            "board"
          )
        }
        onRecovered={async () => {
          await refreshData(
            true
          );

          setScreen(
            "control"
          );
        }}
      />
    );
  }

  /* =====================================================
     USER MANAGEMENT
  ===================================================== */

  if (
    screen ===
    "users"
  ) {
    return (
      <UserManagement
        teams={
          teams
        }
        onBack={() =>
          setScreen(
            "board"
          )
        }
      />
    );
  }

  /* =====================================================
     TEAM MANAGER
  ===================================================== */

  if (
    screen ===
    "teams"
  ) {
    return (
      <div className="app">
        <div className="top-bar control-top-bar">
          <button
            className="back-button"
            onClick={() =>
              setScreen(
                "board"
              )
            }
          >
            ← Back to Auction Board
          </button>

          <div className="control-status">
            STORAGE + DATABASE LIVE
          </div>
        </div>

        <main className="control-room">
          <section className="control-header">
            <p className="eyebrow">
              TOURNAMENT SETUP
            </p>

            <h1>
              TEAM MANAGER
            </h1>

            <div
              className={`division-screen-badge ${activeDivision.toLowerCase()}`}
            >
              {
                activeDivision ===
                "MEN"
                  ? "MEN'S AUCTION"
                  : "WOMEN'S AUCTION"
              }
            </div>

            <p>
              Logos are now stored in Supabase Storage
            </p>
          </section>

          <section className="player-manager-card">
            <p className="eyebrow">
              TOURNAMENT
            </p>

            <h2>
              Tournament Settings
            </h2>

            <div className="settings-grid">
              <div>
                <label>
                  TOURNAMENT NAME
                </label>

                <input
                  value={
                    settings.tournamentName
                  }
                  onChange={(
                    event
                  ) =>
                    setSettings({
                      ...settings,

                      tournamentName:
                        event
                          .target
                          .value,
                    })
                  }
                />
              </div>

              <div>
                <label>
                  SEASON
                </label>

                <input
                  value={
                    settings.seasonName
                  }
                  onChange={(
                    event
                  ) =>
                    setSettings({
                      ...settings,

                      seasonName:
                        event
                          .target
                          .value,
                    })
                  }
                />
              </div>

              <div>
                <label>
                  SQUAD LIMIT
                </label>

                <input
                  type="number"
                  min="1"
                  value={
                    settings.squadLimit
                  }
                  onChange={(
                    event
                  ) =>
                    setSettings({
                      ...settings,

                      squadLimit:
                        Number(
                          event
                            .target
                            .value
                        ) ||
                        1,
                    })
                  }
                />
              </div>
            </div>

            <button
              className="add-player-button"
              style={{
                marginTop:
                  "20px",
              }}
              disabled={
                saving
              }
              onClick={
                handleSaveSettings
              }
            >
              SAVE TOURNAMENT SETTINGS
            </button>
          </section>

          <section className="player-manager-card">
            <p className="eyebrow">
              {
                activeDivision ===
                "MEN"
                  ? "MEN'S FRANCHISES"
                  : "WOMEN'S FRANCHISES"
              }
            </p>

            <h2>
              Add Team
            </h2>

            <div className="settings-grid division-team-form">
              <div>
                <label>
                  TEAM NAME
                </label>

                <input
                  value={
                    newTeamName
                  }
                  onChange={(
                    event
                  ) =>
                    setNewTeamName(
                      event.target.value
                    )
                  }
                />
              </div>

              <div>
                <label>
                  SHORT CODE
                </label>

                <input
                  value={
                    newTeamShortName
                  }
                  maxLength={
                    4
                  }
                  onChange={(
                    event
                  ) =>
                    setNewTeamShortName(
                      event.target.value.toUpperCase()
                    )
                  }
                />
              </div>

              <div>
                <label>
                  OWNER
                </label>

                <input
                  value={
                    newTeamOwner
                  }
                  onChange={(
                    event
                  ) =>
                    setNewTeamOwner(
                      event.target.value
                    )
                  }
                />
              </div>

              <div>
                <label>
                  STARTING PURSE (CR)
                </label>

                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={
                    newTeamPurse
                  }
                  onChange={(
                    event
                  ) =>
                    setNewTeamPurse(
                      Number(
                        event.target.value
                      ) ||
                        0
                    )
                  }
                />
              </div>
            </div>

            <button
              className="add-player-button"
              style={{
                marginTop:
                  "20px",
              }}
              disabled={
                saving
              }
              onClick={() =>
                void addTeam()
              }
            >
              ADD {
                activeDivision ===
                "MEN"
                  ? "MEN'S"
                  : "WOMEN'S"
              } TEAM
            </button>
          </section>

          <section className="player-manager-card">
            <div className="history-header">
              <div>
                <p className="eyebrow">
                  FRANCHISES
                </p>

                <h2>
                  {
                    activeDivision ===
                    "MEN"
                      ? "Men's Teams"
                      : "Women's Teams"
                  }
                </h2>
              </div>

              <strong>
                {
                  teams.length
                }{" "}
                Teams
              </strong>
            </div>

            <div className="team-manager-list">
              {teams.map(
                (
                  team
                ) => (
                  <div
                    key={
                      team.id
                    }
                    className="team-manager-card"
                  >
                    <div className="team-manager-heading">
                      <div className="team-logo-upload-area">
                        <label className="team-logo-upload">
                          {team.logo ? (
                            <img
                              src={
                                team.logo
                              }
                              alt={
                                team.name
                              }
                            />
                          ) : (
                            team.shortName
                          )}

                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            disabled={
                              saving
                            }
                            onChange={(
                              event
                            ) =>
                              void updateTeamLogo(
                                team,
                                event
                                  .target
                                  .files?.[0]
                              )
                            }
                          />
                        </label>

                        <span className="upload-hint">
                          STORAGE UPLOAD
                        </span>

                        {team.logo && (
                          <button
                            className="remove-image-button"
                            disabled={
                              saving
                            }
                            onClick={() =>
                              void removeTeamLogo(
                                team
                              )
                            }
                          >
                            REMOVE LOGO
                          </button>
                        )}
                      </div>

                      <div>
                        <strong>
                          {
                            team.name
                          }
                        </strong>

                        <div className="team-number">
                          Team #
                          {
                            team.id
                          }
                        </div>
                      </div>
                    </div>

                    <div className="team-manager-grid">
                      <div>
                        <label>
                          TEAM NAME
                        </label>

                        <input
                          value={
                            team.name
                          }
                          onChange={(
                            event
                          ) =>
                            updateTeamLocal(
                              team.id,
                              "name",
                              event
                                .target
                                .value
                            )
                          }
                        />
                      </div>

                      <div>
                        <label>
                          SHORT CODE
                        </label>

                        <input
                          value={
                            team.shortName
                          }
                          onChange={(
                            event
                          ) =>
                            updateTeamLocal(
                              team.id,
                              "shortName",
                              event
                                .target
                                .value
                            )
                          }
                        />
                      </div>

                      <div>
                        <label>
                          OWNER
                        </label>

                        <input
                          value={
                            team.owner
                          }
                          onChange={(
                            event
                          ) =>
                            updateTeamLocal(
                              team.id,
                              "owner",
                              event
                                .target
                                .value
                            )
                          }
                        />
                      </div>

                      <div>
                        <label>
                          PURSE (CR)
                        </label>

                        <input
                          type="number"
                          step="0.25"
                          value={
                            team.startingPurse
                          }
                          onChange={(
                            event
                          ) =>
                            updateTeamLocal(
                              team.id,
                              "startingPurse",
                              event
                                .target
                                .value
                            )
                          }
                        />
                      </div>
                    </div>

                    <button
                      className="add-player-button"
                      style={{
                        marginTop:
                          "15px",
                      }}
                      disabled={
                        saving
                      }
                      onClick={() =>
                        void saveTeam(
                          team
                        )
                      }
                    >
                      SAVE TEAM
                    </button>
                  </div>
                )
              )}
            </div>
          </section>
        </main>
      </div>
    );
  }

  /* =====================================================
     PLAYER MANAGER
  ===================================================== */

  if (
    screen ===
    "players"
  ) {
    return (
      <div className="app">
        <div className="top-bar control-top-bar">
          <button
            className="back-button"
            onClick={() =>
              setScreen(
                "board"
              )
            }
          >
            ← Back to Auction Board
          </button>

          <div className="control-status">
            STORAGE + DATABASE LIVE
          </div>
        </div>

        <main className="control-room">
          <section className="control-header">
            <p className="eyebrow">
              AUCTION SETUP
            </p>

            <h1>
              PLAYER MANAGER
            </h1>

            <div
              className={`division-screen-badge ${activeDivision.toLowerCase()}`}
            >
              {
                activeDivision ===
                "MEN"
                  ? "MEN'S AUCTION"
                  : "WOMEN'S AUCTION"
              }
            </div>

            <p>
              Player photos now upload to Supabase Storage
            </p>
          </section>

          <section className="player-manager-card">
            <h2>
              Add Player
            </h2>

            <div className="player-form-grid player-form-grid-photo">
              <div>
                <label>
                  PLAYER NAME
                </label>

                <input
                  value={
                    playerName
                  }
                  onChange={(
                    event
                  ) =>
                    setPlayerName(
                      event
                        .target
                        .value
                    )
                  }
                />
              </div>

              <div>
                <label>
                  ROLE
                </label>

                <select
                  value={
                    playerRole
                  }
                  onChange={(
                    event
                  ) =>
                    setPlayerRole(
                      event
                        .target
                        .value as PlayerRole
                    )
                  }
                >
                  <option>
                    Batter
                  </option>

                  <option>
                    Bowler
                  </option>

                  <option>
                    All-Rounder
                  </option>

                  <option>
                    Wicketkeeper
                  </option>
                </select>
              </div>

              <div>
                <label>
                  PLAYER CATEGORY
                </label>

                <select
                  value={
                    playerCategory
                  }
                  onChange={(
                    event
                  ) => {
                    const nextCategory =
                      event
                        .target
                        .value as PlayerCategory;

                    setPlayerCategory(
                      nextCategory
                    );

                    setPlayerBasePrice(
                      getCategoryBasePrice(
                        nextCategory
                      )
                    );
                  }}
                >
                  <option value="MARQUEE">
                    Marquee Player
                  </option>

                  <option value="GOLD">
                    Gold Player
                  </option>

                  <option value="SILVER">
                    Silver Player
                  </option>
                </select>
              </div>

              <div>
                <label>
                  BASE PRICE
                </label>

                <input
                  type="number"
                  value={
                    playerBasePrice
                  }
                  readOnly
                  title="Base price is automatically set by player category."
                />

                <small>
                  Auto-set by category
                </small>
              </div>

              <div className="player-stats-entry-grid">
                <div>
                  <label>MATCHES</label>
                  <input
                    type="number"
                    min="0"
                    value={playerStats.matches}
                    onChange={(event) =>
                      setPlayerStats((current) => ({
                        ...current,
                        matches: Number(event.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label>RUNS</label>
                  <input
                    type="number"
                    min="0"
                    value={playerStats.runs}
                    onChange={(event) =>
                      setPlayerStats((current) => ({
                        ...current,
                        runs: Number(event.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label>BATTING AVG</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={playerStats.battingAverage}
                    onChange={(event) =>
                      setPlayerStats((current) => ({
                        ...current,
                        battingAverage: Number(event.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label>STRIKE RATE</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={playerStats.strikeRate}
                    onChange={(event) =>
                      setPlayerStats((current) => ({
                        ...current,
                        strikeRate: Number(event.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label>WICKETS</label>
                  <input
                    type="number"
                    min="0"
                    value={playerStats.wickets}
                    onChange={(event) =>
                      setPlayerStats((current) => ({
                        ...current,
                        wickets: Number(event.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label>ECONOMY</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={playerStats.economyRate}
                    onChange={(event) =>
                      setPlayerStats((current) => ({
                        ...current,
                        economyRate: Number(event.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              <div>
                <label>
                  PLAYER PHOTO
                </label>

                <label className="image-upload-box">
                  {playerPhotoPreview ? (
                    <img
                      className="upload-preview"
                      src={
                        playerPhotoPreview
                      }
                      alt="Player preview"
                    />
                  ) : (
                    "+ PHOTO"
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(
                      event
                    ) =>
                      handlePlayerPhoto(
                        event
                          .target
                          .files?.[0]
                      )
                    }
                  />
                </label>

                {playerPhotoFile && (
                  <button
                    type="button"
                    className="clear-photo-button"
                    onClick={
                      clearPlayerPhoto
                    }
                  >
                    REMOVE PHOTO
                  </button>
                )}
              </div>

              <button
                className="add-player-button"
                disabled={
                  saving
                }
                onClick={() =>
                  void addPlayer()
                }
              >
                {saving
                  ? "UPLOADING..."
                  : "+ ADD PLAYER"}
              </button>
            </div>
          </section>

          <section className="player-manager-card">
            <div className="import-header">
              <div>
                <p className="eyebrow">
                  BULK IMPORT
                </p>

                <h2>
                  CSV Import
                </h2>
              </div>

              <label className="csv-upload-button">
                IMPORT CSV

                <input
                  type="file"
                  hidden
                  accept=".csv"
                  onChange={
                    handleCSVImport
                  }
                />
              </label>
            </div>
          </section>

          <section className="player-manager-card">
            <div className="history-header">
              <h2>
                Auction Players
              </h2>

              <strong>
                {
                  auctionPlayers.length
                }
              </strong>
            </div>

            <div className="player-admin-list">
              {auctionPlayers.map(
                (
                  player,
                  index
                ) => (
                  <div
                    className="player-admin-row"
                    key={
                      player.id
                    }
                  >
                    <div className="player-admin-photo">
                      {player.photo ? (
                        <img
                          src={
                            player.photo
                          }
                          alt={
                            player.name
                          }
                        />
                      ) : (
                        getInitials(
                          player.name
                        )
                      )}
                    </div>

                    <div className="player-admin-name">
                      <strong>
                        {
                          player.name
                        }
                      </strong>

                      <span>
                        #
                        {
                          index +
                          1
                        }{" "}
                        •{" "}
                        {
                          player.role
                        }
                      </span>
                    </div>

                    <div className={`player-category-pill ${getPlayerCategory(player).toLowerCase()}`}>
                      {
                        getPlayerCategory(
                          player
                        ) === "MARQUEE"
                          ? "MARQUEE"
                          : getPlayerCategory(
                              player
                            ) === "GOLD"
                          ? "GOLD"
                          : "SILVER"
                      }
                    </div>

                    <select
                      className="player-category-select"
                      value={
                        getPlayerCategory(
                          player
                        )
                      }
                      disabled={
                        saving
                      }
                      onChange={async (
                        event
                      ) => {
                        try {
                          setSaving(
                            true
                          );

                          await updateAuctionPlayerCategory(
                            player.id,
                            event.target.value as PlayerCategory,
                            activeDivision
                          );

                          await refreshData();
                        } catch (
                          error
                        ) {
                          console.error(
                            error
                          );

                          alert(
                            "Unable to update player category."
                          );
                        } finally {
                          setSaving(
                            false
                          );
                        }
                      }}
                    >
                      <option value="MARQUEE">
                        Marquee
                      </option>

                      <option value="GOLD">
                        Gold
                      </option>

                      <option value="SILVER">
                        Silver
                      </option>
                    </select>

                    <div className="player-admin-stats">
                      <span>
                        M {getPlayerStats(player).matches}
                      </span>
                      <span>
                        R {getPlayerStats(player).runs}
                      </span>
                      <span>
                        W {getPlayerStats(player).wickets}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="edit-stats-button"
                      disabled={saving}
                      onClick={() =>
                        openStatsEditor(
                          player
                        )
                      }
                    >
                      EDIT STATS
                    </button>

                    <div className="player-admin-price">
                      ₹
                      {player.basePrice.toFixed(
                        2
                      )}{" "}
                      Cr
                    </div>

                    <button
                      className="delete-player-button"
                      disabled={
                        saving
                      }
                      onClick={() =>
                        void deletePlayer(
                          player,
                          index
                        )
                      }
                    >
                      DELETE
                    </button>
                  </div>
                )
              )}
            </div>
          </section>
                  {statsEditorPlayerId !== null && (
            <div className="stats-modal-backdrop">
              <div className="stats-modal">
                <div className="stats-modal-header">
                  <div>
                    <p className="eyebrow">
                      PLAYER PERFORMANCE
                    </p>
                    <h2>Edit Stats</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setStatsEditorPlayerId(
                        null
                      )
                    }
                  >
                    ✕
                  </button>
                </div>

                <div className="stats-modal-grid">
                  {[
                    ["matches", "Matches", 1],
                    ["runs", "Runs", 1],
                    ["battingAverage", "Batting Average", 0.01],
                    ["strikeRate", "Strike Rate", 0.01],
                    ["wickets", "Wickets", 1],
                    ["economyRate", "Economy Rate", 0.01],
                  ].map(([key, label, step]) => (
                    <label key={key}>
                      <span>{label}</span>
                      <input
                        type="number"
                        min="0"
                        step={step}
                        value={
                          editPlayerStats[
                            key as keyof PlayerStats
                          ]
                        }
                        onChange={(event) =>
                          setEditPlayerStats((current) => ({
                            ...current,
                            [key]: Number(event.target.value),
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>

                <div className="stats-modal-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() =>
                      setStatsEditorPlayerId(
                        null
                      )
                    }
                  >
                    CANCEL
                  </button>

                  <button
                    type="button"
                    className="add-player-button"
                    disabled={saving}
                    onClick={() =>
                      void saveEditedStats()
                    }
                  >
                    {saving
                      ? "SAVING..."
                      : "SAVE STATS"}
                  </button>
                </div>
              </div>
            </div>
          )}

</main>
      </div>
    );
  }

  const firstRoundComplete =
    auctionPlayers.length >
      0 &&
    auctionPlayers.every(
      (player) =>
        history.some(
          (entry) =>
            entry.playerId ===
            player.id
        )
    );

  const unsoldReauctionRemaining =
    auctionPlayers.filter(
      (player) => {
        const playerHistory =
          history.filter(
            (entry) =>
              entry.playerId ===
              player.id
          );

        const wasSold =
          playerHistory.some(
            (entry) =>
              entry.status ===
              "SOLD"
          );

        const unsoldCount =
          playerHistory.filter(
            (entry) =>
              entry.status ===
              "UNSOLD"
          ).length;

        return (
          !wasSold &&
          unsoldCount === 1
        );
      }
    ).length;

  /* =====================================================
     AUCTION CONTROL
  ===================================================== */

  if (
    screen ===
    "control"
  ) {
    return (
      <div className="app">
        <div className="top-bar control-top-bar">
          <button
            className="back-button"
            onClick={() =>
              setScreen(
                "board"
              )
            }
          >
            ← Back to Auction Board
          </button>

          <div className="control-top-actions">
            <button
              className="undo-button"
              disabled={
                saving
              }
              onClick={() =>
                void undoLastAction()
              }
            >
              ↶ UNDO LAST
            </button>

            <div className="control-status">
              REALTIME LIVE
            </div>
          </div>
        </div>

        <main className="control-room">
          <section className="control-header">
            <p className="eyebrow">
              LIVE CRICKET AUCTION
            </p>

            <h1>
              {
                activeDivision ===
                  "MEN"
                  ? "MEN'S AUCTION CONTROL ROOM"
                  : "WOMEN'S AUCTION CONTROL ROOM"
              }
            </h1>

            <p>
              Player{" "}
              {Math.min(
                currentPlayerIndex +
                  1,
                auctionPlayers.length
              )}{" "}
              of{" "}
              {
                auctionPlayers.length
              }
            </p>
          </section>

          {firstRoundComplete &&
            unsoldReauctionRemaining >
              0 && (
              <div
                style={{
                  margin:
                    "0 auto 18px",
                  width:
                    "min(100%, 980px)",
                  padding:
                    "10px 16px",
                  borderRadius:
                    "12px",
                  border:
                    "1px solid rgba(245, 158, 11, 0.35)",
                  background:
                    "rgba(245, 158, 11, 0.10)",
                  textAlign:
                    "center",
                  fontWeight:
                    900,
                  letterSpacing:
                    "0.06em",
                }}
              >
                UNSOLD RE-AUCTION ROUND •{" "}
                {
                  unsoldReauctionRemaining
                }{" "}
                PLAYER
                {
                  unsoldReauctionRemaining ===
                  1
                    ? ""
                    : "S"
                }{" "}
                REMAINING
              </div>
            )}

          {currentPlayer ? (
            <>
              <section
                className={`current-player-panel player-category-bg ${getPlayerCategory(currentPlayer).toLowerCase()}`}
              >
                <div className="current-player-label">
                  CURRENT PLAYER
                </div>

                <div className={`player-category-badge ${getPlayerCategory(currentPlayer).toLowerCase()}`}>
                  {
                    getPlayerCategory(
                      currentPlayer
                    ) === "MARQUEE"
                      ? "MARQUEE PLAYER"
                      : getPlayerCategory(
                          currentPlayer
                        ) === "GOLD"
                      ? "GOLD PLAYER"
                      : "SILVER PLAYER"
                  }
                </div>

                <div
                  className={`current-player-avatar ${
                    currentPlayer.photo
                      ? "has-photo"
                      : ""
                  }`}
                >
                  {currentPlayer.photo ? (
                    <img
                      src={
                        currentPlayer.photo
                      }
                      alt={
                        currentPlayer.name
                      }
                    />
                  ) : (
                    getInitials(
                      currentPlayer.name
                    )
                  )}
                </div>

                <h2>
                  {
                    currentPlayer.name
                  }
                </h2>

                <span className="current-player-role">
                  {
                    currentPlayer.role
                  }
                </span>

                <div className="player-stats-grid">
                  <div>
                    <span>MATCHES</span>
                    <strong>{getPlayerStats(currentPlayer).matches}</strong>
                  </div>
                  <div>
                    <span>RUNS</span>
                    <strong>{getPlayerStats(currentPlayer).runs}</strong>
                  </div>
                  <div>
                    <span>BAT AVG</span>
                    <strong>{getPlayerStats(currentPlayer).battingAverage.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span>STRIKE RATE</span>
                    <strong>{getPlayerStats(currentPlayer).strikeRate.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span>WICKETS</span>
                    <strong>{getPlayerStats(currentPlayer).wickets}</strong>
                  </div>
                  <div>
                    <span>ECONOMY</span>
                    <strong>{getPlayerStats(currentPlayer).economyRate.toFixed(2)}</strong>
                  </div>
                </div>

                <div className="base-price">
                  BASE PRICE

                  <strong>
                    ₹
                    {currentPlayer.basePrice.toFixed(
                      2
                    )}{" "}
                    Cr
                  </strong>
                </div>
              </section>

              <section className="next-player-preview">
                <span>
                  NEXT PLAYER
                </span>

                <strong>
                  RANDOM SELECTION
                </strong>
              </section>

              <section className="auction-timer-panel">
                <div className="auction-timer-header">
                  <div>
                    <p className="eyebrow">
                      AUCTION CLOCK
                    </p>

                    <h2>
                      Live Countdown
                    </h2>
                  </div>

                  <div
                    className={`auction-call-badge ${automaticCallState
                      .toLowerCase()
                      .replace(
                        /_/g,
                        "-"
                      )}`}
                  >
                    {automaticCallState ===
                    "BIDDING"
                      ? "BIDDING"
                      : automaticCallState ===
                        "GOING_ONCE"
                      ? "GOING ONCE"
                      : automaticCallState ===
                        "GOING_TWICE"
                      ? "GOING TWICE"
                      : "FINAL CALL"}
                  </div>
                </div>

                <div className="auction-timer-body">
                  <div
                    className={`auction-clock ${
                      timerRemaining <=
                      5
                        ? "critical"
                        : timerRemaining <=
                          10
                        ? "warning"
                        : ""
                    }`}
                  >
                    <span>
                      {timerRemaining}
                    </span>

                    <small>
                      SECONDS
                    </small>
                  </div>

                  <div className="auction-timer-controls">
                    <div className="timer-duration-row">
                      {[15, 30, 45, 60].map(
                        (
                          seconds
                        ) => (
                          <button
                            key={
                              seconds
                            }
                            className={`timer-duration-button ${
                              timerDuration ===
                              seconds
                                ? "active"
                                : ""
                            }`}
                            disabled={
                              saving ||
                              timerStatus ===
                                "RUNNING"
                            }
                            onClick={() =>
                              void changeTimerDuration(
                                seconds
                              )
                            }
                          >
                            {seconds}s
                          </button>
                        )
                      )}
                    </div>

                    <div className="timer-action-row">
                      {timerStatus ===
                      "RUNNING" ? (
                        <button
                          className="timer-main-button pause"
                          disabled={
                            saving
                          }
                          onClick={() =>
                            void pauseTimer()
                          }
                        >
                          PAUSE
                        </button>
                      ) : timerStatus ===
                        "PAUSED" ? (
                        <button
                          className="timer-main-button start"
                          disabled={
                            saving
                          }
                          onClick={() =>
                            void resumeTimer()
                          }
                        >
                          RESUME
                        </button>
                      ) : (
                        <button
                          className="timer-main-button start"
                          disabled={
                            saving
                          }
                          onClick={() =>
                            void startTimer()
                          }
                        >
                          START TIMER
                        </button>
                      )}

                      <button
                        className="timer-main-button reset"
                        disabled={
                          saving
                        }
                        onClick={() =>
                          void resetTimer()
                        }
                      >
                        RESET
                      </button>
                    </div>

                    <p className="timer-help-text">
                      A new bid automatically resets the clock while it is running.
                    </p>
                  </div>
                </div>

                <div className="auction-call-auto-note">
                  <strong>
                    AUTOMATIC CALL SEQUENCE
                  </strong>

                  <span>
                    5s → GOING ONCE
                    {"  •  "}
                    2s → GOING TWICE
                    {"  •  "}
                    0s → FINAL CALL
                  </span>
                </div>
              </section>

              <section className="bid-panel">
                <p className="eyebrow">
                  CURRENT BID
                </p>

                <div className="current-bid">
                  ₹
                  {currentBid.toFixed(
                    2
                  )}{" "}
                  Cr
                </div>

                <div className="bid-controls">
                  <button
                    className="bid-button minus"
                    onClick={() =>
                      void changeBid(
                        currentBid -
                          currentBidIncrement
                      )
                    }
                  >
                    - ₹
                    {currentBidIncrement.toFixed(
                      1
                    )}{" "}
                    Cr
                  </button>

                  <button
                    className="bid-button"
                    onClick={() =>
                      void changeBid(
                        currentBid +
                          currentBidIncrement
                      )
                    }
                  >
                    + ₹
                    {currentBidIncrement.toFixed(
                      1
                    )}{" "}
                    Cr
                  </button>
                </div>

                <div className="bid-increment-note">
                  {
                    currentPlayerCategory ===
                    "MARQUEE"
                      ? "Marquee"
                      : currentPlayerCategory ===
                        "GOLD"
                      ? "Gold"
                      : "Silver"
                  }{" "}
                  Player • Bid Increment ₹
                  {currentBidIncrement.toFixed(
                    1
                  )}{" "}
                  Cr
                </div>
              </section>

              <section className="team-selection-section">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">
                      WINNING TEAM
                    </p>

                    <h2>
                      Select Team
                    </h2>
                  </div>
                </div>

                <div className="control-team-grid">
                  {teams.map(
                    (
                      team
                    ) => {
                      const eligibility =
                        getTeamBidEligibility(
                          team
                        );

                      const remaining =
                        eligibility.remaining;

                      const selected =
                        team.id ===
                        biddingTeamId;

                      return (
                        <button
                          className={`control-team-card ${
                            selected
                              ? "selected"
                              : ""
                          } ${
                            !eligibility.eligible
                              ? "bid-ineligible"
                              : ""
                          }`}
                          key={
                            team.id
                          }
                          disabled={
                            !eligibility.eligible
                          }
                          onClick={() =>
                            void selectBiddingTeam(
                              team.id
                            )
                          }
                        >
                          <div
                            className={`control-team-logo ${
                              team.logo
                                ? "has-logo"
                                : ""
                            }`}
                          >
                            {team.logo ? (
                              <img
                                src={
                                  team.logo
                                }
                                alt={
                                  team.name
                                }
                              />
                            ) : (
                              team.shortName
                            )}
                          </div>

                          <div className="control-team-info">
                            <strong>
                              {
                                team.name
                              }
                            </strong>

                            <span>
                              Purse ₹
                              {remaining.toFixed(
                                2
                              )}{" "}
                              Cr
                            </span>

                            <span>
                              {
                                team.players
                                  .length
                              }
                              /
                              {
                                settings.squadLimit
                              }
                            </span>

                            <span
                              className={`team-bid-status ${
                                eligibility.eligible
                                  ? "eligible"
                                  : "ineligible"
                              }`}
                            >
                              {
                                eligibility.reason
                              }
                            </span>
                          </div>

                          {selected && (
                            <div className="selected-check">
                              ✓
                            </div>
                          )}
                        </button>
                      );
                    }
                  )}
                </div>
              </section>

              <section className="smart-bidding-summary">
                <div>
                  <span>
                    SMART BID VALIDATION
                  </span>

                  <strong>
                    Teams that cannot afford the current bid or have a full squad are disabled automatically.
                  </strong>
                </div>

                <div className="smart-bidding-count">
                  {
                    teams.filter(
                      (team) =>
                        getTeamBidEligibility(
                          team
                        ).eligible
                    ).length
                  }{" "}
                  /{" "}
                  {teams.length}{" "}
                  TEAMS ELIGIBLE
                </div>
              </section>

              <section className="auction-shortcuts-bar">
                <span>
                  KEYBOARD:
                </span>

                <strong>
                  SPACE Start/Pause
                </strong>

                <strong>
                  1 +₹25L
                </strong>

                <strong>
                  2 +₹50L
                </strong>

                <strong>
                  3 +₹1Cr
                </strong>

                <strong>
                  4 -₹25L
                </strong>

                <strong>
                  S SOLD
                </strong>

                <strong>
                  U UNSOLD
                </strong>

                <strong>
                  R RESET TIMER
                </strong>
              </section>

              <section className="auction-actions">
                <button
                  className="unsold-button"
                  disabled={
                    saving
                  }
                  onClick={() =>
                    void handleUnsold()
                  }
                >
                  UNSOLD
                </button>

                <button
                  className="sold-button"
                  disabled={
                    saving
                  }
                  onClick={() =>
                    void handleSold()
                  }
                >
                  {saving
                    ? "PROCESSING..."
                    : "SOLD"}
                </button>
              </section>
            </>
          ) : (
            <section className="auction-complete">
              <div className="auction-complete-icon">
                🏆
              </div>

              <h2>
                Auction Complete
              </h2>
            </section>
          )}

          <section className="history-section">
            <div className="history-header">
              <div>
                <p className="eyebrow">
                  AUCTION LOG
                </p>

                <h2>
                  Auction History
                </h2>
              </div>

              <strong>
                {
                  history.length
                }{" "}
                Actions
              </strong>
            </div>

            {history.length ===
            0 ? (
              <div className="history-empty">
                No activity yet.
              </div>
            ) : (
              <div className="history-list">
                {[...history]
                  .reverse()
                  .map(
                    (
                      entry
                    ) => (
                      <div
                        className="history-row"
                        key={
                          entry.id
                        }
                      >
                        <div className="history-player">
                          <strong>
                            {
                              entry.playerName
                            }
                          </strong>
                        </div>

                        <div>
                          {entry.status ===
                          "SOLD"
                            ? entry.teamName
                            : "UNSOLD"}
                        </div>

                        <div className="history-price">
                          {entry.price !==
                          undefined
                            ? `₹${entry.price.toFixed(
                                2
                              )} Cr`
                            : "-"}
                        </div>

                        <div
                          className={`history-status ${
                            entry.status ===
                            "SOLD"
                              ? "sold-history"
                              : "unsold-history"
                          }`}
                        >
                          {
                            entry.status
                          }
                        </div>
                      </div>
                    )
                  )}
              </div>
            )}
          </section>

          <div className="danger-zone">
            <button
              className="reset-auction-button"
              onClick={() =>
                void resetAuction()
              }
            >
              RESET AUCTION
            </button>
          </div>
        </main>
      </div>
    );
  }

  /* =====================================================
     PLAYER TRANSFER / SWAP
  ===================================================== */

  const handlePlayerTransfer =
    async () => {
      if (
        !selectedTeam ||
        transferPlayerId ===
          null ||
        transferTargetTeamId ===
          null
      ) {
        setTransferMessage(
          "Select the player and destination team."
        );

        return;
      }

      const sourcePlayer =
        selectedTeam.players.find(
          (player) =>
            player.id ===
            transferPlayerId
        );

      const targetTeam =
        teams.find(
          (team) =>
            team.id ===
            transferTargetTeamId
        );

      if (
        !sourcePlayer ||
        !targetTeam
      ) {
        setTransferMessage(
          "Unable to find the selected player or team."
        );

        return;
      }

      if (
        selectedTeam.id ===
        targetTeam.id
      ) {
        setTransferMessage(
          "Source and destination teams must be different."
        );

        return;
      }

      let targetSwapPlayer:
        (typeof targetTeam.players)[number] |
        undefined;

      if (
        transferMode ===
        "SWAP"
      ) {
        if (
          swapPlayerId ===
          null
        ) {
          setTransferMessage(
            "Select a player from the destination team to swap."
          );

          return;
        }

        targetSwapPlayer =
          targetTeam.players.find(
            (player) =>
              player.id ===
              swapPlayerId
          );

        if (
          !targetSwapPlayer
        ) {
          setTransferMessage(
            "The destination player could not be found."
          );

          return;
        }
      }

      const sourceRemaining =
        calculateRemaining(
          selectedTeam
        );

      const targetRemaining =
        calculateRemaining(
          targetTeam
        );

      if (
        transferMode ===
        "TRANSFER"
      ) {
        if (
          targetTeam.players
            .length >=
          settings.squadLimit
        ) {
          setTransferMessage(
            `${targetTeam.name} has already reached the squad limit.`
          );

          return;
        }

        if (
          targetRemaining <
          sourcePlayer.purchasePrice
        ) {
          setTransferMessage(
            `${targetTeam.name} does not have enough purse for this transfer.`
          );

          return;
        }
      } else if (
        targetSwapPlayer
      ) {
        const sourceRemainingAfterSwap =
          sourceRemaining +
          sourcePlayer.purchasePrice -
          targetSwapPlayer.purchasePrice;

        const targetRemainingAfterSwap =
          targetRemaining +
          targetSwapPlayer.purchasePrice -
          sourcePlayer.purchasePrice;

        if (
          sourceRemainingAfterSwap <
            0 ||
          targetRemainingAfterSwap <
            0
        ) {
          setTransferMessage(
            "This swap would make one of the team purses negative."
          );

          return;
        }
      }

      const actionText =
        transferMode ===
        "SWAP" &&
        targetSwapPlayer
          ? `Swap ${sourcePlayer.name} (${selectedTeam.name}) with ${targetSwapPlayer.name} (${targetTeam.name})?`
          : `Transfer ${sourcePlayer.name} from ${selectedTeam.name} to ${targetTeam.name} for the original purchase price of ₹${sourcePlayer.purchasePrice.toFixed(
              2
            )} Cr?`;

      if (
        !window.confirm(
          actionText
        )
      ) {
        return;
      }

      try {
        setSaving(
          true
        );

        setTransferMessage(
          ""
        );

        await transferOrSwapPurchasedPlayer(
          {
            division:
              activeDivision,

            playerId:
              sourcePlayer.id,

            fromTeamId:
              selectedTeam.id,

            toTeamId:
              targetTeam.id,

            swapPlayerId:
              transferMode ===
              "SWAP"
                ? targetSwapPlayer
                    ?.id ??
                  null
                : null,
          }
        );

        void recordAuditEvent(
          transferMode ===
            "SWAP"
            ? "PLAYER_SWAP"
            : "PLAYER_TRANSFER",
          {
            playerId:
              sourcePlayer.id,

            playerName:
              sourcePlayer.name,

            teamId:
              targetTeam.id,

            teamName:
              targetTeam.name,

            amount:
              sourcePlayer.purchasePrice,

            details: {
              mode:
                transferMode,

              fromTeamId:
                selectedTeam.id,

              fromTeamName:
                selectedTeam.name,

              toTeamId:
                targetTeam.id,

              toTeamName:
                targetTeam.name,

              swapPlayerId:
                targetSwapPlayer
                  ?.id ??
                null,

              swapPlayerName:
                targetSwapPlayer
                  ?.name ??
                null,
            },
          }
        );

        await refreshData(
          true
        );

        setTransferPlayerId(
          null
        );

        setTransferTargetTeamId(
          null
        );

        setSwapPlayerId(
          null
        );

        setTransferMessage(
          transferMode ===
            "SWAP"
            ? "Players swapped successfully."
            : "Player transferred successfully."
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        setTransferMessage(
          error instanceof
            Error
            ? error.message
            : "Unable to complete the player transfer."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /* =====================================================
     TEAM PAGE
  ===================================================== */

  if (
    screen ===
      "team" &&
    selectedTeam
  ) {
    const spent =
      calculateSpent(
        selectedTeam
      );

    const remaining =
      calculateRemaining(
        selectedTeam
      );

    const transferTargetTeam =
      teams.find(
        (team) =>
          team.id ===
          transferTargetTeamId
      ) ??
      null;

    return (
      <div className="app">
        <div className="top-bar">
          <button
            className="back-button"
            onClick={() =>
              setScreen(
                "board"
              )
            }
          >
            ← Back to Auction Board
          </button>
        </div>

        <main className="team-page">
          <section className="team-page-header">
            <div
              className={`team-logo-large ${
                selectedTeam.logo
                  ? "has-logo"
                  : ""
              }`}
            >
              {selectedTeam.logo ? (
                <img
                  src={
                    selectedTeam.logo
                  }
                  alt={
                    selectedTeam.name
                  }
                />
              ) : (
                selectedTeam.shortName
              )}
            </div>

            <div>
              <p className="eyebrow">
                TEAM DASHBOARD
              </p>

              <h1>
                {
                  selectedTeam.name
                }
              </h1>

              <p className="owner">
                Owner:{" "}
                {
                  selectedTeam.owner
                }
              </p>
            </div>

            <div className="team-purse-large">
              <span>
                PURSE REMAINING
              </span>

              <strong>
                ₹
                {remaining.toFixed(
                  2
                )}{" "}
                Cr
              </strong>
            </div>
          </section>

          <section className="stats-row">
            <div className="stat">
              <span>
                STARTING PURSE
              </span>

              <strong>
                ₹
                {selectedTeam.startingPurse.toFixed(
                  2
                )}{" "}
                Cr
              </strong>
            </div>

            <div className="stat">
              <span>
                TOTAL SPENT
              </span>

              <strong>
                ₹
                {spent.toFixed(
                  2
                )}{" "}
                Cr
              </strong>
            </div>

            <div className="stat">
              <span>
                PLAYERS
              </span>

              <strong>
                {
                  selectedTeam.players
                    .length
                }
              </strong>
            </div>

            <div className="stat">
              <span>
                SLOTS REMAINING
              </span>

              <strong>
                {Math.max(
                  0,

                  settings.squadLimit -
                    selectedTeam
                      .players
                      .length
                )}
              </strong>
            </div>
          </section>

          <section className="player-transfer-card">
            <div className="player-transfer-heading">
              <div>
                <p className="eyebrow">
                  TEAM MANAGEMENT
                </p>

                <h2>
                  Player Transfer / Swap
                </h2>
              </div>

              <span className="transfer-source-team">
                FROM: {
                  selectedTeam.shortName
                }
              </span>
            </div>

            <div className="player-transfer-mode">
              <button
                type="button"
                className={
                  transferMode ===
                  "TRANSFER"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setTransferMode(
                    "TRANSFER"
                  );

                  setSwapPlayerId(
                    null
                  );

                  setTransferMessage(
                    ""
                  );
                }}
              >
                TRANSFER PLAYER
              </button>

              <button
                type="button"
                className={
                  transferMode ===
                  "SWAP"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setTransferMode(
                    "SWAP"
                  );

                  setTransferMessage(
                    ""
                  );
                }}
              >
                SWAP PLAYERS
              </button>
            </div>

            <div className="player-transfer-grid">
              <div>
                <label>
                  {
                    transferMode ===
                    "SWAP"
                      ? "PLAYER FROM THIS TEAM"
                      : "PLAYER TO TRANSFER"
                  }
                </label>

                <select
                  value={
                    transferPlayerId ??
                    ""
                  }
                  onChange={(
                    event
                  ) => {
                    setTransferPlayerId(
                      event.target
                        .value
                        ? Number(
                            event
                              .target
                              .value
                          )
                        : null
                    );

                    setTransferMessage(
                      ""
                    );
                  }}
                >
                  <option value="">
                    Select player
                  </option>

                  {selectedTeam.players.map(
                    (
                      player
                    ) => (
                      <option
                        key={
                          player.id
                        }
                        value={
                          player.id
                        }
                      >
                        {
                          player.name
                        }{" "}
                        — ₹
                        {player.purchasePrice.toFixed(
                          2
                        )}{" "}
                        Cr
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label>
                  DESTINATION TEAM
                </label>

                <select
                  value={
                    transferTargetTeamId ??
                    ""
                  }
                  onChange={(
                    event
                  ) => {
                    setTransferTargetTeamId(
                      event.target
                        .value
                        ? Number(
                            event
                              .target
                              .value
                          )
                        : null
                    );

                    setSwapPlayerId(
                      null
                    );

                    setTransferMessage(
                      ""
                    );
                  }}
                >
                  <option value="">
                    Select team
                  </option>

                  {teams
                    .filter(
                      (
                        team
                      ) =>
                        team.id !==
                        selectedTeam.id
                    )
                    .map(
                      (
                        team
                      ) => (
                        <option
                          key={
                            team.id
                          }
                          value={
                            team.id
                          }
                        >
                          {
                            team.name
                          }{" "}
                          — ₹
                          {calculateRemaining(
                            team
                          ).toFixed(
                            2
                          )}{" "}
                          Cr left
                        </option>
                      )
                    )}
                </select>
              </div>

              {transferMode ===
                "SWAP" && (
                <div>
                  <label>
                    PLAYER FROM DESTINATION TEAM
                  </label>

                  <select
                    value={
                      swapPlayerId ??
                      ""
                    }
                    disabled={
                      !transferTargetTeam
                    }
                    onChange={(
                      event
                    ) => {
                      setSwapPlayerId(
                        event.target
                          .value
                          ? Number(
                              event
                                .target
                                .value
                            )
                          : null
                      );

                      setTransferMessage(
                        ""
                      );
                    }}
                  >
                    <option value="">
                      {
                        transferTargetTeam
                          ? "Select player to swap"
                          : "Select destination team first"
                      }
                    </option>

                    {transferTargetTeam
                      ?.players.map(
                        (
                          player
                        ) => (
                          <option
                            key={
                              player.id
                            }
                            value={
                              player.id
                            }
                          >
                            {
                              player.name
                            }{" "}
                            — ₹
                            {player.purchasePrice.toFixed(
                              2
                            )}{" "}
                            Cr
                          </option>
                        )
                      )}
                  </select>
                </div>
              )}
            </div>

            <div className="player-transfer-footer">
              <div className="player-transfer-note">
                {transferMode ===
                "TRANSFER"
                  ? "The player keeps the original auction purchase price. The source team gets that purse back and the destination team spends the same amount."
                  : "Both players keep their original auction purchase prices. Their teams are exchanged and both purses are recalculated automatically."}
              </div>

              <button
                type="button"
                className="player-transfer-submit"
                disabled={
                  saving ||
                  transferPlayerId ===
                    null ||
                  transferTargetTeamId ===
                    null ||
                  (
                    transferMode ===
                      "SWAP" &&
                    swapPlayerId ===
                      null
                  )
                }
                onClick={() =>
                  void handlePlayerTransfer()
                }
              >
                {
                  saving
                    ? "UPDATING..."
                    : transferMode ===
                      "SWAP"
                      ? "SWAP PLAYERS"
                      : "TRANSFER PLAYER"
                }
              </button>
            </div>

            {transferMessage && (
              <div className="player-transfer-message">
                {
                  transferMessage
                }
              </div>
            )}
          </section>

          <section className="squad-section">
            <div className="section-title">
              <div>
                <p className="eyebrow">
                  SQUAD
                </p>

                <h2>
                  Purchased Players
                </h2>
              </div>

              <span>
                {
                  selectedTeam.players
                    .length
                }
                /
                {
                  settings.squadLimit
                }
              </span>
            </div>

            {selectedTeam.players
              .length ===
            0 ? (
              <div className="empty-squad">
                No players purchased yet.
              </div>
            ) : (
              <div className="player-grid">
                {selectedTeam.players.map(
                  (
                    player
                  ) => (
                    <article
                      className="player-card"
                      key={
                        player.id
                      }
                    >
                      <div
                        className={`player-avatar ${
                          player.photo
                            ? "has-photo"
                            : ""
                        }`}
                      >
                        {player.photo ? (
                          <img
                            src={
                              player.photo
                            }
                            alt={
                              player.name
                            }
                          />
                        ) : (
                          getInitials(
                            player.name
                          )
                        )}
                      </div>

                      <div className="player-details">
                        <h3>
                          {
                            player.name
                          }
                        </h3>

                        <span className="role">
                          {
                            player.role
                          }
                        </span>

                        <div className="player-price-row">
                          <div>
                            <small>
                              BASE PRICE
                            </small>

                            <strong>
                              ₹
                              {player.basePrice.toFixed(
                                2
                              )}{" "}
                              Cr
                            </strong>
                          </div>

                          <div>
                            <small>
                              PURCHASED FOR
                            </small>

                            <strong className="sold-price">
                              ₹
                              {player.purchasePrice.toFixed(
                                2
                              )}{" "}
                              Cr
                            </strong>
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  /* =====================================================
     MAIN BOARD
  ===================================================== */

  return (
    <div className="app">
      <header className="auction-header">
        <p className="eyebrow">
          LIVE CRICKET AUCTION
        </p>

        <h1>
          {
            settings.tournamentName
          }
        </h1>

        <p className="subtitle">
          {
            settings.seasonName
          }{" "}
          • Team Purse & Squad Dashboard
        </p>

        <div
          className="auction-division-switch"
          role="group"
          aria-label="Auction division"
        >
          <button
            className={
              activeDivision ===
              "MEN"
                ? "active"
                : ""
            }
            onClick={() =>
              changeDivision(
                "MEN"
              )
            }
          >
            MEN'S AUCTION
          </button>

          <button
            className={
              activeDivision ===
              "WOMEN"
                ? "active"
                : ""
            }
            onClick={() =>
              changeDivision(
                "WOMEN"
              )
            }
          >
            WOMEN'S AUCTION
          </button>
        </div>

        <div className="main-admin-buttons">
          <button
            className="auction-control-button"
            onClick={() =>
              setScreen(
                "control"
              )
            }
          >
            AUCTION CONTROL
          </button>

          <button
            className="auction-control-button"
            onClick={() =>
              setScreen(
                "players"
              )
            }
          >
            PLAYER MANAGER
          </button>

          <button
            className="auction-control-button"
            onClick={() =>
              setScreen(
                "teams"
              )
            }
          >
            TEAM MANAGER
          </button>

          <button
            className="auction-control-button"
            onClick={() =>
              setScreen(
                "users"
              )
            }
          >
            USER MANAGEMENT
          </button>

          <button
            className="auction-control-button"
            onClick={() =>
              setScreen(
                "recovery"
              )
            }
          >
            BACKUP & RECOVERY
          </button>

          <button
            className="auction-control-button"
            onClick={() =>
              setScreen(
                "audit"
              )
            }
          >
            AUDIT LOG
          </button>

          <button
            className="auction-control-button"
            onClick={() =>
              setScreen(
                "summary"
              )
            }
          >
            LIVE SUMMARY
          </button>

          <button
            className="auction-control-button"
            onClick={() =>
              setScreen(
                "exports"
              )
            }
          >
            RESULTS EXPORT
          </button>

          <button
            className="auction-control-button"
            onClick={() =>
              setScreen(
                "health"
              )
            }
          >
            PRE-AUCTION CHECK
          </button>
        </div>
      </header>

      <main className="board">
        <div className="board-heading">
          <div>
            <p className="eyebrow">
              FRANCHISES
            </p>

            <h2>
              {
                activeDivision ===
                "MEN"
                  ? "Men's Auction Board"
                  : "Women's Auction Board"
              }
            </h2>
          </div>

          <div className="live-badge">
            <span className="live-dot" />
            REALTIME LIVE
          </div>
        </div>

        {teams.length ===
        0 && (
          <div className="division-empty-state">
            <strong>
              No {
                activeDivision ===
                "MEN"
                  ? "men's"
                  : "women's"
              } teams configured yet.
            </strong>

            <span>
              Open Team Manager to add teams for this auction.
            </span>
          </div>
        )}

        <div className="team-grid">
          {teams.map(
            (
              team
            ) => {
              const spent =
                calculateSpent(
                  team
                );

              const remaining =
                calculateRemaining(
                  team
                );

              return (
                <article
                  className="team-card"
                  key={
                    team.id
                  }
                  onClick={() =>
                    openTeam(
                      team
                    )
                  }
                >
                  <div className="card-main">
                    <div className="team-card-header">
                      <div
                        className={`team-logo ${
                          team.logo
                            ? "has-logo"
                            : ""
                        }`}
                      >
                        {team.logo ? (
                          <img
                            src={
                              team.logo
                            }
                            alt={
                              team.name
                            }
                          />
                        ) : (
                          team.shortName
                        )}
                      </div>

                      <div>
                        <h3>
                          {
                            team.name
                          }
                        </h3>

                        <p>
                          Owner:{" "}
                          {
                            team.owner
                          }
                        </p>
                      </div>
                    </div>

                    <div className="purse-section">
                      <span>
                        PURSE REMAINING
                      </span>

                      <strong>
                        ₹
                        {remaining.toFixed(
                          2
                        )}{" "}
                        Cr
                      </strong>
                    </div>

                    <div className="team-stats">
                      <div>
                        <span>
                          SPENT
                        </span>

                        <strong>
                          ₹
                          {spent.toFixed(
                            2
                          )}{" "}
                          Cr
                        </strong>
                      </div>

                      <div>
                        <span>
                          PLAYERS
                        </span>

                        <strong>
                          {
                            team.players
                              .length
                          }
                          /
                          {
                            settings.squadLimit
                          }
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="hover-panel">
                    <p className="hover-title">
                      PURCHASED PLAYERS
                    </p>

                    {team.players.length ===
                    0 ? (
                      <p className="no-player">
                        No purchases yet
                      </p>
                    ) : (
                      team.players
                        .slice(
                          -4
                        )
                        .reverse()
                        .map(
                          (
                            player
                          ) => (
                            <div
                              className="hover-player"
                              key={
                                player.id
                              }
                            >
                              <span>
                                {
                                  player.name
                                }
                              </span>

                              <strong>
                                ₹
                                {player.purchasePrice.toFixed(
                                  2
                                )}{" "}
                                Cr
                              </strong>
                            </div>
                          )
                        )
                    )}

                    <button className="view-team">
                      VIEW FULL TEAM →
                    </button>
                  </div>
                </article>
              );
            }
          )}
        </div>
      </main>
    </div>
  );
}

export default App;