import {
  useCallback,
  useEffect,
  useState,
} from "react";

import "./OwnerDashboard.css";
import "./OwnerDashboardLive.css";

import {
  loadAuctionState,
  loadAuctionPlayers,
  loadTeams,
  loadTournamentSettings,
} from "./database";

import {
  signOut,
  type UserProfile,
} from "./auth";

import {
  supabase,
} from "./supabase";

import type {
  AuctionCallState,
  AuctionPlayer,
  AuctionTimerStatus,
  Team,
  TournamentSettings,
} from "./types";

type OwnerDashboardProps = {
  profile: UserProfile;
};

function OwnerDashboard({
  profile,
}: OwnerDashboardProps) {
  const [
    team,
    setTeam,
  ] =
    useState<Team | null>(
      null
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

  /* =====================================================
     REFRESH OWNER DATA
  ===================================================== */

  const refresh =
    useCallback(
      async () => {
        try {
          const [
            allTeams,
            tournamentSettings,
            players,
            auctionState,
          ] =
            await Promise.all([
              loadTeams(),
              loadTournamentSettings(),
              loadAuctionPlayers(),
              loadAuctionState(),
            ]);

          const ownerTeam =
            allTeams.find(
              (item) =>
                item.id ===
                profile.teamId
            ) ??
            null;

          setTeam(
            ownerTeam
          );

          setSettings(
            tournamentSettings
          );

          setAuctionPlayers(
            players
          );

          setCurrentPlayerIndex(
            auctionState.currentPlayerIndex
          );

          setCurrentBid(
            auctionState.currentBid
          );

          setBiddingTeamId(
            auctionState.biddingTeamId
          );

          setTimerDuration(
            auctionState.timerDuration
          );

          setTimerStatus(
            auctionState.timerStatus
          );

          setTimerEndsAt(
            auctionState.timerEndsAt
          );

          setTimerPausedRemaining(
            auctionState.timerPausedRemaining
          );

          setCallState(
            auctionState.callState
          );

          if (
            auctionState.timerStatus ===
              "RUNNING" &&
            auctionState.timerEndsAt
          ) {
            setTimerRemaining(
              Math.max(
                0,
                Math.ceil(
                  (
                    new Date(
                      auctionState.timerEndsAt
                    ).getTime() -
                    Date.now()
                  ) /
                    1000
                )
              )
            );
          } else if (
            auctionState.timerStatus ===
            "PAUSED"
          ) {
            setTimerRemaining(
              auctionState.timerPausedRemaining ??
                auctionState.timerDuration
            );
          } else {
            setTimerRemaining(
              auctionState.callState ===
                "FINAL_CALL"
                ? 0
                : auctionState.timerDuration
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
              : "Unable to load team dashboard."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        profile.teamId,
      ]
    );

  /* =====================================================
     INITIAL LOAD
  ===================================================== */

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /* =====================================================
     LIVE TIMER
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
        "STOPPED" &&
        callState !==
          "FINAL_CALL"
      ) {
        setTimerRemaining(
          timerDuration
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
     REALTIME
  ===================================================== */

  useEffect(() => {
    const channel =
      supabase
        .channel(
          `owner-team-${profile.id}`
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "teams",
          },
          () => {
            void refresh();
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "purchases",
          },
          () => {
            void refresh();
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "auction_state",
          },
          () => {
            void refresh();
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "auction_players",
          },
          () => {
            void refresh();
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "tournament_settings",
          },
          () => {
            void refresh();
          }
        )

        .subscribe();

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [
    profile.id,
    refresh,
  ]);

  /* =====================================================
     HELPERS
  ===================================================== */

  const getInitials = (
    name: string
  ) => {
    return name
      .split(" ")
      .filter(Boolean)
      .map(
        (word) =>
          word[0]
      )
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div className="owner-loading">

        <div>

          <div className="owner-loading-icon">
            🏏
          </div>

          <h2>
            Loading Team Dashboard
          </h2>

        </div>

      </div>
    );
  }

  /* =====================================================
     ERROR
  ===================================================== */

  if (errorMessage) {
    return (
      <div className="owner-loading">

        <div>

          <h2>
            Unable to load dashboard
          </h2>

          <p>
            {
              errorMessage
            }
          </p>

          <button
            onClick={() =>
              void refresh()
            }
          >
            RETRY
          </button>

        </div>

      </div>
    );
  }

  /* =====================================================
     NO ASSIGNED TEAM
  ===================================================== */

  if (!team) {
    return (
      <div className="owner-loading">

        <div>

          <h2>
            No Team Assigned
          </h2>

          <p>
            This account has not yet
            been assigned to a franchise.
          </p>

          <button
            onClick={() =>
              void signOut()
            }
          >
            SIGN OUT
          </button>

        </div>

      </div>
    );
  }

  const spent =
    team.players.reduce(
      (
        total,
        player
      ) =>
        total +
        player.purchasePrice,
      0
    );

  const remaining =
    team.startingPurse -
    spent;

  const currentPlayer =
    auctionPlayers[
      currentPlayerIndex
    ];

  const teamIsLeading =
    biddingTeamId ===
    team.id;

  const automaticCallState:
    AuctionCallState =
      timerRemaining <= 0
        ? "FINAL_CALL"
        : timerRemaining <= 2
        ? "GOING_TWICE"
        : timerRemaining <= 5
        ? "GOING_ONCE"
        : callState ===
          "FINAL_CALL"
        ? "FINAL_CALL"
        : "BIDDING";

  const teamAtSquadLimit =
    team.players.length >=
    settings.squadLimit;

  const teamCanAffordBid =
    remaining >=
    currentBid;

  const ownerBidStatus =
    teamAtSquadLimit
      ? "SQUAD FULL"
      : !teamCanAffordBid
      ? "INSUFFICIENT PURSE"
      : teamIsLeading
      ? "YOUR TEAM IS LEADING"
      : "ELIGIBLE TO BID";

  return (
    <div className="owner-dashboard">

      <header className="owner-header">

        <div>

          <p className="owner-kicker">
            TEAM OWNER PORTAL
          </p>

          <h1>
            {
              settings.tournamentName
            }
          </h1>

          <span>
            {
              settings.seasonName
            }
          </span>

        </div>

        <div className="owner-header-right">

          <div className="owner-account-info">

            <strong>
              {
                profile.fullName
              }
            </strong>

            <span>
              {
                profile.email
              }
            </span>

          </div>

          <button
            onClick={() =>
              void signOut()
            }
          >
            SIGN OUT
          </button>

        </div>

      </header>

      <div className="owner-mobile-quickbar">
        <div>
          <span>
            PURSE
          </span>

          <strong>
            ₹
            {remaining.toFixed(
              2
            )}{" "}
            Cr
          </strong>
        </div>

        <div>
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

        <div
          className={
            timerRemaining <=
            5
              ? "critical"
              : timerRemaining <=
                10
              ? "warning"
              : ""
          }
        >
          <span>
            TIMER
          </span>

          <strong>
            {timerRemaining}s
          </strong>
        </div>
      </div>

      <main className="owner-content">

        <section className="owner-team-hero">

          <div
            className={`owner-team-logo ${
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

          <div className="owner-team-name">

            <p>
              YOUR FRANCHISE
            </p>

            <h2>
              {team.name}
            </h2>

            <span>
              Owner:{" "}
              {team.owner}
            </span>

          </div>

          <div className="owner-purse">

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

        {currentPlayer && (

          <section className="owner-live-auction">

            <div className="owner-live-heading">

              <div>

                <p>
                  LIVE AUCTION
                </p>

                <h2>
                  Current Player
                </h2>

              </div>

              <div className="owner-live-badge">
                <span />
                LIVE
              </div>

            </div>

            <div className="owner-current-player">

              <div className="owner-current-photo">

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

              <div className="owner-current-info">

                <h3>
                  {
                    currentPlayer.name
                  }
                </h3>

                <span>
                  {
                    currentPlayer.role
                  }
                </span>

                <small>
                  Base ₹
                  {currentPlayer.basePrice.toFixed(
                    2
                  )}{" "}
                  Cr
                </small>

              </div>

              <div className="owner-current-bid">

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

                {teamIsLeading ? (

                  <div className="owner-leading">
                    YOUR TEAM IS LEADING
                  </div>

                ) : (

                  <small>
                    {biddingTeamId
                      ? "Another team is leading"
                      : "Awaiting bid"}
                  </small>

                )}

              </div>

            </div>

            <div className="owner-live-status-grid">

              <div
                className={`owner-auction-clock ${
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
                  AUCTION TIMER
                </span>

                <strong>
                  {timerRemaining}
                </strong>

                <small>
                  SECONDS
                </small>
              </div>

              <div className="owner-call-status">
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

              <div
                className={`owner-bid-eligibility ${
                  teamIsLeading
                    ? "leading"
                    : teamAtSquadLimit ||
                      !teamCanAffordBid
                    ? "blocked"
                    : "eligible"
                }`}
              >
                <span>
                  YOUR TEAM
                </span>

                <strong>
                  {ownerBidStatus}
                </strong>

                <small>
                  Purse ₹
                  {remaining.toFixed(
                    2
                  )}{" "}
                  Cr
                </small>
              </div>

            </div>

          </section>

        )}

        <section className="owner-stats">

          <div>

            <span>
              STARTING PURSE
            </span>

            <strong>
              ₹
              {team.startingPurse.toFixed(
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
                team.players.length
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
                  team.players.length
              )}
            </strong>

          </div>

        </section>

        <section className="owner-squad">

          <div className="owner-section-title">

            <div>

              <p>
                SQUAD
              </p>

              <h2>
                Purchased Players
              </h2>

            </div>

            <strong>
              {
                team.players.length
              }{" "}
              Players
            </strong>

          </div>

          {team.players.length ===
          0 ? (

            <div className="owner-empty">

              <div>
                🏏
              </div>

              No players purchased yet.

            </div>

          ) : (

            <div className="owner-player-grid">

              {team.players.map(
                (
                  player
                ) => (

                  <article
                    className="owner-player-card"
                    key={
                      player.id
                    }
                  >

                    <div className="owner-player-photo">

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

                    <div className="owner-player-info">

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

                      <div className="owner-player-prices">

                        <div>

                          <small>
                            BASE
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
                            BOUGHT FOR
                          </small>

                          <strong className="owner-purchase-price">
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

export default OwnerDashboard;
