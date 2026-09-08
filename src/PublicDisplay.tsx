import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import "./PublicDisplay.css";

import { supabase } from "./supabase";

import {
  loadAuctionHistory,
  loadAuctionPlayers,
  loadAuctionState,
  loadTeams,
  loadTournamentSettings,
  type DatabaseHistoryEntry,
} from "./database";

import type {
  AuctionCallState,
  AuctionPlayer,
  AuctionTimerStatus,
  Team,
  TournamentSettings,
} from "./types";

type DisplayEventRow = {
  id: number;
  event_type: "NONE" | "SOLD" | "UNSOLD" | string;
  player_name: string | null;
  player_photo_url: string | null;
  team_name: string | null;
  team_logo_url: string | null;
  price: number | string | null;
  updated_at: string | null;
};

function PublicDisplay() {
  const [settings, setSettings] =
    useState<TournamentSettings>({
      tournamentName: "CRICKET AUCTION ARENA",
      seasonName: "Season 2026",
      squadLimit: 18,
    });

  const [teams, setTeams] =
    useState<Team[]>([]);

  const [auctionPlayers, setAuctionPlayers] =
    useState<AuctionPlayer[]>([]);

  const [history, setHistory] =
    useState<DatabaseHistoryEntry[]>([]);

  const [
    currentPlayerIndex,
    setCurrentPlayerIndex,
  ] = useState(0);

  const [currentBid, setCurrentBid] =
    useState(0);

  const [
    biddingTeamId,
    setBiddingTeamId,
  ] = useState<number | null>(null);

  const [
    timerDuration,
    setTimerDuration,
  ] = useState(30);

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

  const [
    displayEvent,
    setDisplayEvent,
  ] = useState<DisplayEventRow | null>(
    null
  );

  const [
    selectedTeamId,
    setSelectedTeamId,
  ] = useState<number | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    soundEnabled,
    setSoundEnabled,
  ] = useState(false);

  const audioContextRef =
    useRef<AudioContext | null>(
      null
    );

  const lastSoundKeyRef =
    useRef("");

  const lastResultEventRef =
    useRef("");

  /* =====================================================
     HELPERS
  ===================================================== */

  const calculateSpent = (
    team: Team
  ) =>
    team.players.reduce(
      (total, player) =>
        total + player.purchasePrice,
      0
    );

  const calculateRemaining = (
    team: Team
  ) =>
    team.startingPurse -
    calculateSpent(team);

  const getInitials = (
    name: string
  ) =>
    name
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const formatPrice = (
    value: number | string | null | undefined
  ) => {
    const numberValue =
      Number(value ?? 0);

    return Number.isFinite(numberValue)
      ? numberValue.toFixed(2)
      : "0.00";
  };

  /* =====================================================
     AUCTION DATA
  ===================================================== */

  const loadAuctionData =
    useCallback(
      async (
        showLoader = false
      ) => {
        try {
          if (showLoader) {
            setLoading(true);
          }

          const [
            loadedSettings,
            loadedTeams,
            loadedPlayers,
            loadedHistory,
            loadedState,
          ] =
            await Promise.all([
              loadTournamentSettings(),
              loadTeams(),
              loadAuctionPlayers(),
              loadAuctionHistory(),
              loadAuctionState(),
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

          setErrorMessage("");
        } catch (error) {
          console.error(
            "PUBLIC DISPLAY DATA ERROR",
            error
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load auction data."
          );
        } finally {
          if (showLoader) {
            setLoading(false);
          }
        }
      },
      []
    );

  /* =====================================================
     DISPLAY EVENT
     IMPORTANT:
     This stays separate from normal auction refreshes.
     The diagnostic polling method already proved reliable.
  ===================================================== */

  const loadDisplayEvent =
    useCallback(
      async () => {
        try {
          const {
            data,
            error,
          } =
            await supabase
              .from(
                "display_event"
              )
              .select(`
                id,
                event_type,
                player_name,
                player_photo_url,
                team_name,
                team_logo_url,
                price,
                updated_at
              `)
              .eq(
                "id",
                1
              )
              .maybeSingle();

          if (error) {
            console.error(
              "DISPLAY EVENT ERROR",
              error
            );

            return;
          }

          setDisplayEvent(
            data as
              | DisplayEventRow
              | null
          );
        } catch (error) {
          console.error(
            "DISPLAY EVENT POLL ERROR",
            error
          );
        }
      },
      []
    );

  /* =====================================================
     INITIAL LOAD
  ===================================================== */

  useEffect(() => {
    void loadAuctionData(
      true
    );

    void loadDisplayEvent();
  }, [
    loadAuctionData,
    loadDisplayEvent,
  ]);

  /* =====================================================
     RELIABLE DISPLAY EVENT POLLING
  ===================================================== */

  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          void loadDisplayEvent();
        },
        500
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [loadDisplayEvent]);

  /* =====================================================
     LOCAL PROJECTOR COUNTDOWN
  ===================================================== */

  useEffect(() => {
    if (
      timerStatus !==
        "RUNNING" ||
      !timerEndsAt
    ) {
      if (
        timerStatus ===
        "PAUSED"
      ) {
        setTimerRemaining(
          timerPausedRemaining ??
            timerDuration
        );
      }

      if (
        timerStatus ===
        "STOPPED"
      ) {
        setTimerRemaining(
          callState ===
            "FINAL_CALL"
            ? 0
            : timerDuration
        );
      }

      return;
    }

    const updateRemaining =
      () => {
        setTimerRemaining(
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
          )
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
    timerPausedRemaining,
    timerDuration,
    callState,
  ]);

  /* =====================================================
     REALTIME AUCTION DATA
     Does NOT modify displayEvent.
  ===================================================== */

  useEffect(() => {
    const channel =
      supabase
        .channel(
          "projector-auction-live"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "teams",
          },
          () => {
            void loadAuctionData();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "tournament_settings",
          },
          () => {
            void loadAuctionData();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "auction_players",
          },
          () => {
            void loadAuctionData();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "purchases",
          },
          () => {
            void loadAuctionData();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "auction_history",
          },
          () => {
            void loadAuctionData();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "auction_state",
          },
          () => {
            void loadAuctionData();
          }
        )
        .subscribe();

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [loadAuctionData]);

  /* =====================================================
     DERIVED DATA
  ===================================================== */

  const currentPlayer =
    auctionPlayers[
      currentPlayerIndex
    ];

  const nextPlayer =
    auctionPlayers[
      currentPlayerIndex + 1
    ];

  const biddingTeam =
    teams.find(
      (team) =>
        team.id ===
        biddingTeamId
    ) ?? null;

  const selectedTeam =
    teams.find(
      (team) =>
        team.id ===
        selectedTeamId
    ) ?? null;

  const lastSold =
    [...history]
      .reverse()
      .find(
        (entry) =>
          entry.status ===
          "SOLD"
      );

  const automaticCallState:
    AuctionCallState =
      timerRemaining <= 0
        ? "FINAL_CALL"
        : timerRemaining <= 2
        ? "GOING_TWICE"
        : timerRemaining <= 5
        ? "GOING_ONCE"
        : "BIDDING";

  /* =====================================================
     PROJECTOR SOUND CUES
  ===================================================== */

  const playTone =
    (
      frequency: number,
      duration:
        number =
          0.18,
      volume:
        number =
          0.08
    ) => {
      if (
        !soundEnabled
      ) {
        return;
      }

      try {
        const AudioContextClass =
          window.AudioContext ??
          (
            window as unknown as {
              webkitAudioContext?:
                typeof AudioContext;
            }
          ).webkitAudioContext;

        if (
          !AudioContextClass
        ) {
          return;
        }

        if (
          !audioContextRef
            .current
        ) {
          audioContextRef.current =
            new AudioContextClass();
        }

        const context =
          audioContextRef.current;

        if (
          context.state ===
          "suspended"
        ) {
          void context.resume();
        }

        const oscillator =
          context.createOscillator();

        const gain =
          context.createGain();

        oscillator.type =
          "sine";

        oscillator.frequency
          .setValueAtTime(
            frequency,
            context.currentTime
          );

        gain.gain
          .setValueAtTime(
            volume,
            context.currentTime
          );

        gain.gain
          .exponentialRampToValueAtTime(
            0.001,
            context.currentTime +
              duration
          );

        oscillator.connect(
          gain
        );

        gain.connect(
          context.destination
        );

        oscillator.start();

        oscillator.stop(
          context.currentTime +
            duration
        );
      } catch (error) {
        console.error(
          "Unable to play projector sound.",
          error
        );
      }
    };

  const enableSound =
    () => {
      setSoundEnabled(
        true
      );

      try {
        const AudioContextClass =
          window.AudioContext ??
          (
            window as unknown as {
              webkitAudioContext?:
                typeof AudioContext;
            }
          ).webkitAudioContext;

        if (
          AudioContextClass &&
          !audioContextRef
            .current
        ) {
          audioContextRef.current =
            new AudioContextClass();
        }

        if (
          audioContextRef
            .current?.state ===
          "suspended"
        ) {
          void audioContextRef
            .current
            .resume();
        }
      } catch (error) {
        console.error(
          "Unable to enable sound.",
          error
        );
      }
    };

  useEffect(() => {
    if (
      !soundEnabled
    ) {
      return;
    }

    let soundKey =
      "";

    if (
      automaticCallState ===
      "GOING_ONCE"
    ) {
      soundKey =
        `once-${currentPlayerIndex}`;
    }

    if (
      automaticCallState ===
      "GOING_TWICE"
    ) {
      soundKey =
        `twice-${currentPlayerIndex}`;
    }

    if (
      automaticCallState ===
      "FINAL_CALL"
    ) {
      soundKey =
        `final-${currentPlayerIndex}`;
    }

    if (
      !soundKey ||
      soundKey ===
        lastSoundKeyRef.current
    ) {
      return;
    }

    lastSoundKeyRef.current =
      soundKey;

    if (
      automaticCallState ===
      "GOING_ONCE"
    ) {
      playTone(
        660,
        0.16,
        0.07
      );
    } else if (
      automaticCallState ===
      "GOING_TWICE"
    ) {
      playTone(
        520,
        0.22,
        0.08
      );
    } else if (
      automaticCallState ===
      "FINAL_CALL"
    ) {
      playTone(
        380,
        0.34,
        0.09
      );
    }
  }, [
    automaticCallState,
    currentPlayerIndex,
    soundEnabled,
  ]);

  useEffect(() => {
    if (
      !soundEnabled ||
      !displayEvent
    ) {
      return;
    }

    if (
      displayEvent.event_type !==
        "SOLD" &&
      displayEvent.event_type !==
        "UNSOLD"
    ) {
      return;
    }

    const eventKey =
      `${displayEvent.event_type}-${displayEvent.updated_at ?? ""}`;

    if (
      eventKey ===
      lastResultEventRef.current
    ) {
      return;
    }

    lastResultEventRef.current =
      eventKey;

    if (
      displayEvent.event_type ===
      "SOLD"
    ) {
      playTone(
        880,
        0.16,
        0.08
      );

      window.setTimeout(
        () =>
          playTone(
            1175,
            0.22,
            0.08
          ),
        170
      );
    } else {
      playTone(
        260,
        0.28,
        0.08
      );
    }
  }, [
    displayEvent,
    soundEnabled,
  ]);

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div className="display-loading-screen">
        <div className="display-loading-card">
          <div className="display-kicker">
            CONNECTING TO LIVE AUCTION
          </div>

          <h1>
            {settings.tournamentName}
          </h1>

          <div className="display-loader" />

          <p>
            Preparing projector display...
          </p>
        </div>
      </div>
    );
  }

  /* =====================================================
     ERROR
  ===================================================== */

  if (errorMessage) {
    return (
      <div className="display-error-screen">
        <div className="display-error-card">
          <div className="display-kicker">
            CONNECTION ERROR
          </div>

          <h1>
            Unable to load auction
          </h1>

          <p>
            {errorMessage}
          </p>

          <button
            className="display-retry-button"
            onClick={() =>
              void loadAuctionData(
                true
              )
            }
          >
            RETRY
          </button>
        </div>
      </div>
    );
  }

  /* =====================================================
     SOLD TAKEOVER
  ===================================================== */

  if (
    displayEvent?.event_type ===
    "SOLD"
  ) {
    return (
      <div className="result-screen sold-result-screen">
        <div className="result-glow result-glow-one" />
        <div className="result-glow result-glow-two" />

        <div className="result-content">
          <div className="result-top-label">
            HAMMER DOWN
          </div>

          <div className="result-word sold-word">
            SOLD
          </div>

          <div className="result-player-row">
            <div className="result-player-photo">
              {displayEvent.player_photo_url ? (
                <img
                  src={
                    displayEvent.player_photo_url
                  }
                  alt={
                    displayEvent.player_name ??
                    "Player"
                  }
                />
              ) : (
                <span>
                  {getInitials(
                    displayEvent.player_name ??
                      "Player"
                  )}
                </span>
              )}
            </div>

            <div className="result-player-copy">
              <div className="result-caption">
                PLAYER
              </div>

              <h1>
                {displayEvent.player_name ??
                  "Player"}
              </h1>
            </div>
          </div>

          <div className="sold-divider" />

          <div className="sold-team-row">
            <div className="sold-team-logo">
              {displayEvent.team_logo_url ? (
                <img
                  src={
                    displayEvent.team_logo_url
                  }
                  alt={
                    displayEvent.team_name ??
                    "Team"
                  }
                />
              ) : (
                <span>
                  {getInitials(
                    displayEvent.team_name ??
                      "Team"
                  )}
                </span>
              )}
            </div>

            <div className="sold-team-copy">
              <div className="result-caption">
                PURCHASED BY
              </div>

              <h2>
                {displayEvent.team_name ??
                  "Winning Team"}
              </h2>
            </div>

            <div className="sold-price-block">
              <div className="result-caption">
                FINAL PRICE
              </div>

              <strong>
                ₹
                {formatPrice(
                  displayEvent.price
                )}{" "}
                Cr
              </strong>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* =====================================================
     UNSOLD TAKEOVER
  ===================================================== */

  if (
    displayEvent?.event_type ===
    "UNSOLD"
  ) {
    return (
      <div className="result-screen unsold-result-screen">
        <div className="result-glow result-glow-one" />
        <div className="result-glow result-glow-two" />

        <div className="result-content">
          <div className="result-top-label">
            AUCTION RESULT
          </div>

          <div className="result-word unsold-word">
            UNSOLD
          </div>

          <div className="unsold-player-card">
            <div className="result-player-photo unsold-photo">
              {displayEvent.player_photo_url ? (
                <img
                  src={
                    displayEvent.player_photo_url
                  }
                  alt={
                    displayEvent.player_name ??
                    "Player"
                  }
                />
              ) : (
                <span>
                  {getInitials(
                    displayEvent.player_name ??
                      "Player"
                  )}
                </span>
              )}
            </div>

            <div>
              <div className="result-caption">
                PLAYER
              </div>

              <h1>
                {displayEvent.player_name ??
                  "Player"}
              </h1>

              <p>
                No winning bid
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* =====================================================
     FULL TEAM VIEW
  ===================================================== */

  if (selectedTeam) {
    const spent =
      calculateSpent(
        selectedTeam
      );

    const remaining =
      calculateRemaining(
        selectedTeam
      );

    return (
      <div className="projector-shell">
        <header className="projector-header">
          <div>
            <div className="display-kicker">
              {settings.seasonName}
            </div>

            <h1>
              {settings.tournamentName}
            </h1>
          </div>

          <button
            className="projector-back-button"
            onClick={() =>
              setSelectedTeamId(
                null
              )
            }
          >
            ← BACK TO LIVE BOARD
          </button>
        </header>

        <main className="team-detail-display">
          <section className="team-detail-hero">
            <div
              className={`team-detail-logo ${
                selectedTeam.logo
                  ? "has-image"
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

            <div className="team-detail-title">
              <div className="display-kicker">
                FRANCHISE SQUAD
              </div>

              <h2>
                {selectedTeam.name}
              </h2>

              <p>
                Owner:{" "}
                {selectedTeam.owner}
              </p>
            </div>

            <div className="team-detail-purse">
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

          <section className="team-detail-stats">
            <div>
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

            <div>
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

            <div>
              <span>
                PLAYERS
              </span>

              <strong>
                {
                  selectedTeam.players
                    .length
                }
                /
                {
                  settings.squadLimit
                }
              </strong>
            </div>

            <div>
              <span>
                SLOTS LEFT
              </span>

              <strong>
                {Math.max(
                  0,
                  settings.squadLimit -
                    selectedTeam.players
                      .length
                )}
              </strong>
            </div>
          </section>

          <section className="team-squad-section">
            <div className="projector-section-heading">
              <div>
                <div className="display-kicker">
                  PURCHASED PLAYERS
                </div>

                <h2>
                  Full Squad
                </h2>
              </div>

              <strong>
                {
                  selectedTeam.players
                    .length
                }{" "}
                Players
              </strong>
            </div>

            {selectedTeam.players
              .length === 0 ? (
              <div className="team-squad-empty">
                No players purchased yet.
              </div>
            ) : (
              <div className="team-squad-grid">
                {selectedTeam.players.map(
                  (player) => (
                    <article
                      className="team-squad-player"
                      key={
                        player.id
                      }
                    >
                      <div
                        className={`team-squad-photo ${
                          player.photo
                            ? "has-image"
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

                      <div className="team-squad-player-info">
                        <h3>
                          {
                            player.name
                          }
                        </h3>

                        <span>
                          {
                            player.role
                          }
                        </span>
                      </div>

                      <div className="team-squad-price">
                        ₹
                        {player.purchasePrice.toFixed(
                          2
                        )}{" "}
                        Cr
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
     MAIN LIVE PROJECTOR DASHBOARD
  ===================================================== */

  return (
    <div className="projector-shell">
      <header className="projector-header">
        <div>
          <div className="display-kicker">
            {settings.seasonName}
          </div>

          <h1>
            {settings.tournamentName}
          </h1>
        </div>

        <div className="projector-header-actions">
          {!soundEnabled && (
            <button
              className="projector-sound-button"
              onClick={
                enableSound
              }
            >
              ENABLE SOUND
            </button>
          )}

          <div className="projector-live-badge">
            <span />
            LIVE AUCTION
          </div>
        </div>
      </header>

      <main className="projector-main">
        <section className="projector-live-grid">
          <article className="projector-current-card">
            <div className="display-kicker">
              CURRENT PLAYER
            </div>

            {currentPlayer ? (
              <>
                <div
                  className={`projector-player-photo ${
                    currentPlayer.photo
                      ? "has-image"
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
                  {currentPlayer.name}
                </h2>

                <div className="projector-player-role">
                  {currentPlayer.role}
                </div>

                <div className="projector-price-row">
                  <div>
                    <span>
                      BASE PRICE
                    </span>

                    <strong>
                      ₹
                      {currentPlayer.basePrice.toFixed(
                        2
                      )}{" "}
                      Cr
                    </strong>
                  </div>

                  <div className="current-bid-display">
                    <span>
                      CURRENT BID
                    </span>

                    <strong>
                      ₹
                      {currentBid.toFixed(
                        2
                      )}{" "}
                      Cr
                    </strong>
                  </div>
                </div>

                <div className="projector-timer-strip">
                  <div
                    className={`projector-clock ${
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
                      SEC
                    </small>
                  </div>

                  <div className="projector-call-state">
                    <span>
                      AUCTION STATUS
                    </span>

                    <strong>
                      {automaticCallState ===
                      "BIDDING"
                        ? timerStatus ===
                          "PAUSED"
                          ? "PAUSED"
                          : timerStatus ===
                            "STOPPED"
                          ? "READY"
                          : "BIDDING"
                        : automaticCallState ===
                          "GOING_ONCE"
                        ? "GOING ONCE"
                        : automaticCallState ===
                          "GOING_TWICE"
                        ? "GOING TWICE"
                        : "FINAL CALL"}
                    </strong>
                  </div>
                </div>
              </>
            ) : (
              <div className="auction-finished-block">
                <div>
                  🏆
                </div>

                <h2>
                  Auction Complete
                </h2>
              </div>
            )}
          </article>

          <article className="projector-status-card">
            <div>
              <div className="display-kicker">
                LEADING TEAM
              </div>

              {biddingTeam ? (
                <div className="leading-team">
                  <div
                    className={`leading-team-logo ${
                      biddingTeam.logo
                        ? "has-image"
                        : ""
                    }`}
                  >
                    {biddingTeam.logo ? (
                      <img
                        src={
                          biddingTeam.logo
                        }
                        alt={
                          biddingTeam.name
                        }
                      />
                    ) : (
                      biddingTeam.shortName
                    )}
                  </div>

                  <div>
                    <h3>
                      {biddingTeam.name}
                    </h3>

                    <p>
                      Purse available ₹
                      {calculateRemaining(
                        biddingTeam
                      ).toFixed(
                        2
                      )}{" "}
                      Cr
                    </p>
                  </div>
                </div>
              ) : (
                <div className="waiting-bid">
                  Waiting for team selection
                </div>
              )}
            </div>

            <div className="status-separator" />

            <div>
              <div className="display-kicker">
                NEXT PLAYER
              </div>

              <div className="next-player-display">
                <strong>
                  {nextPlayer?.name ??
                    "End of Auction"}
                </strong>

                {nextPlayer && (
                  <span>
                    {
                      nextPlayer.role
                    }{" "}
                    • ₹
                    {nextPlayer.basePrice.toFixed(
                      2
                    )}{" "}
                    Cr
                  </span>
                )}
              </div>
            </div>

            <div className="status-separator" />

            <div>
              <div className="display-kicker">
                LAST PURCHASE
              </div>

              {lastSold ? (
                <div className="last-purchase-display">
                  <strong>
                    {
                      lastSold.playerName
                    }
                  </strong>

                  <span>
                    {
                      lastSold.teamName
                    }
                    {lastSold.price !==
                    undefined
                      ? ` • ₹${lastSold.price.toFixed(
                          2
                        )} Cr`
                      : ""}
                  </span>
                </div>
              ) : (
                <div className="waiting-bid">
                  No completed sale yet
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="projector-teams-section">
          <div className="projector-section-heading">
            <div>
              <div className="display-kicker">
                FRANCHISES
              </div>

              <h2>
                Team Board
              </h2>
            </div>

            <span>
              Select a team to view its full squad
            </span>
          </div>

          <div className="projector-team-grid">
            {teams.map(
              (team) => {
                const spent =
                  calculateSpent(
                    team
                  );

                const remaining =
                  calculateRemaining(
                    team
                  );

                const latestPlayer =
                  team.players[
                    team.players.length -
                      1
                  ];

                return (
                  <button
                    className="projector-team-card"
                    key={team.id}
                    onClick={() =>
                      setSelectedTeamId(
                        team.id
                      )
                    }
                  >
                    <div className="projector-team-heading">
                      <div
                        className={`projector-team-logo ${
                          team.logo
                            ? "has-image"
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
                          {team.name}
                        </h3>

                        <p>
                          {team.owner}
                        </p>
                      </div>
                    </div>

                    <div className="projector-team-purse">
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

                    <div className="projector-team-stats">
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
                          SQUAD
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

                    <div className="projector-team-last">
                      <span>
                        LATEST BUY
                      </span>

                      <strong>
                        {latestPlayer
                          ? `${latestPlayer.name} • ₹${latestPlayer.purchasePrice.toFixed(
                              2
                            )} Cr`
                          : "No purchases yet"}
                      </strong>
                    </div>

                    <div className="projector-view-team">
                      VIEW FULL TEAM →
                    </div>
                  </button>
                );
              }
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default PublicDisplay;
