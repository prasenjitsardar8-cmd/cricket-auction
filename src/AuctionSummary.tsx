import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import "./AuctionSummary.css";

import {
  loadAuctionHistory,
  loadAuctionPlayers,
  loadTeams,
  loadTournamentSettings,
  type AuctionDivision,
  type DatabaseHistoryEntry,
} from "./database";

import {
  supabase,
} from "./supabase";

import type {
  AuctionPlayer,
  Team,
  TournamentSettings,
} from "./types";

type AuctionSummaryProps = {
  onBack: () => void;
  division: AuctionDivision;
};

function AuctionSummary({
  onBack,
  division,
}: AuctionSummaryProps) {
  const [
    teams,
    setTeams,
  ] =
    useState<Team[]>([]);

  const [
    players,
    setPlayers,
  ] =
    useState<AuctionPlayer[]>([]);

  const [
    history,
    setHistory,
  ] =
    useState<
      DatabaseHistoryEntry[]
    >([]);

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
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const refresh =
    useCallback(
      async () => {
        try {
          setErrorMessage("");

          const [
            loadedTeams,
            loadedPlayers,
            loadedHistory,
            loadedSettings,
          ] =
            await Promise.all([
              loadTeams(division),
              loadAuctionPlayers(division),
              loadAuctionHistory(division),
              loadTournamentSettings(division),
            ]);

          setTeams(
            loadedTeams
          );

          setPlayers(
            loadedPlayers
          );

          setHistory(
            loadedHistory
          );

          setSettings(
            loadedSettings
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
              : "Unable to load auction summary."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [division]
    );

  useEffect(() => {
    void refresh();

    const channel =
      supabase
        .channel(
          "auction-summary-live"
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
            void refresh();
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
            void refresh();
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
            void refresh();
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
              "teams",
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
  }, [refresh]);

  const soldEntries =
    useMemo(
      () =>
        history.filter(
          (entry) =>
            entry.status ===
            "SOLD"
        ),
      [history]
    );

  const unsoldEntries =
    useMemo(
      () =>
        history.filter(
          (entry) =>
            entry.status ===
            "UNSOLD"
        ),
      [history]
    );

  const totalSpent =
    useMemo(
      () =>
        teams.reduce(
          (
            grandTotal,
            team
          ) =>
            grandTotal +
            team.players.reduce(
              (
                teamTotal,
                player
              ) =>
                teamTotal +
                player.purchasePrice,
              0
            ),
          0
        ),
      [teams]
    );

  const totalStartingPurse =
    useMemo(
      () =>
        teams.reduce(
          (
            total,
            team
          ) =>
            total +
            team.startingPurse,
          0
        ),
      [teams]
    );

  const remainingPurse =
    totalStartingPurse -
    totalSpent;

  const highestPurchase =
    useMemo(
      () => {
        const purchased =
          teams.flatMap(
            (team) =>
              team.players.map(
                (player) => ({
                  player,
                  team,
                })
              )
          );

        if (
          purchased.length ===
          0
        ) {
          return null;
        }

        return purchased.reduce(
          (
            highest,
            item
          ) =>
            item.player.purchasePrice >
            highest.player.purchasePrice
              ? item
              : highest
        );
      },
      [teams]
    );

  const totalProcessed =
    soldEntries.length +
    unsoldEntries.length;

  const pendingPlayers =
    Math.max(
      0,
      players.length -
        totalProcessed
    );

  const averageSoldPrice =
    soldEntries.length >
    0
      ? soldEntries.reduce(
          (
            total,
            entry
          ) =>
            total +
            (
              entry.price ??
              0
            ),
          0
        ) /
        soldEntries.length
      : 0;

  const teamRows =
    useMemo(
      () =>
        teams
          .map(
            (team) => {
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

              return {
                team,
                spent,
                remaining:
                  team.startingPurse -
                  spent,
                slotsLeft:
                  Math.max(
                    0,
                    settings.squadLimit -
                      team.players.length
                  ),
              };
            }
          )
          .sort(
            (
              a,
              b
            ) =>
              b.spent -
              a.spent
          ),
      [
        teams,
        settings.squadLimit,
      ]
    );

  const soldPercentage =
    players.length >
    0
      ? Math.round(
          (
            soldEntries.length /
            players.length
          ) *
            100
        )
      : 0;

  const processedPercentage =
    players.length >
    0
      ? Math.round(
          (
            totalProcessed /
            players.length
          ) *
            100
        )
      : 0;

  if (
    loading
  ) {
    return (
      <div className="auction-summary-loading">
        Loading live auction summary...
      </div>
    );
  }

  return (
    <div className="auction-summary-page">
      <div className="auction-summary-topbar">
        <button
          onClick={
            onBack
          }
        >
          ← Back to Auction Board
        </button>

        <div>
          ADMIN • LIVE SUMMARY
        </div>
      </div>

      <main className="auction-summary-content">
        <section className="auction-summary-hero">
          <div>
            <p>
              {
                settings.seasonName
              }
            </p>

            <h1>
              Live Auction Summary
            </h1>

            <span>
              {
                settings.tournamentName
              }
            </span>
          </div>

          <button
            onClick={() =>
              void refresh()
            }
          >
            REFRESH
          </button>
        </section>

        {errorMessage && (
          <div className="auction-summary-error">
            {
              errorMessage
            }
          </div>
        )}

        <section className="auction-summary-kpis">
          <div>
            <span>
              PLAYERS SOLD
            </span>

            <strong>
              {
                soldEntries.length
              }
            </strong>

            <small>
              {
                soldPercentage
              }
              % of player pool
            </small>
          </div>

          <div>
            <span>
              UNSOLD
            </span>

            <strong>
              {
                unsoldEntries.length
              }
            </strong>

            <small>
              Auctioned but not purchased
            </small>
          </div>

          <div>
            <span>
              REMAINING PLAYERS
            </span>

            <strong>
              {
                pendingPlayers
              }
            </strong>

            <small>
              {
                processedPercentage
              }
              % processed
            </small>
          </div>

          <div>
            <span>
              TOTAL SPENT
            </span>

            <strong>
              ₹
              {
                totalSpent.toFixed(
                  2
                )
              }{" "}
              Cr
            </strong>

            <small>
              Across all teams
            </small>
          </div>

          <div>
            <span>
              PURSE REMAINING
            </span>

            <strong>
              ₹
              {
                remainingPurse.toFixed(
                  2
                )
              }{" "}
              Cr
            </strong>

            <small>
              Across all teams
            </small>
          </div>

          <div>
            <span>
              AVG SOLD PRICE
            </span>

            <strong>
              ₹
              {
                averageSoldPrice.toFixed(
                  2
                )
              }{" "}
              Cr
            </strong>

            <small>
              Sold players only
            </small>
          </div>
        </section>

        <section className="auction-summary-grid">
          <article className="auction-summary-highlight">
            <p>
              HIGHEST PURCHASE
            </p>

            {highestPurchase ? (
              <>
                <h2>
                  {
                    highestPurchase.player.name
                  }
                </h2>

                <strong>
                  ₹
                  {
                    highestPurchase.player.purchasePrice.toFixed(
                      2
                    )
                  }{" "}
                  Cr
                </strong>

                <span>
                  {
                    highestPurchase.team.name
                  }
                </span>
              </>
            ) : (
              <div className="auction-summary-empty">
                No purchases yet.
              </div>
            )}
          </article>

          <article className="auction-summary-highlight">
            <p>
              AUCTION PROGRESS
            </p>

            <h2>
              {
                totalProcessed
              }
              /
              {
                players.length
              }
            </h2>

            <div className="auction-summary-progress">
              <div
                style={{
                  width:
                    `${processedPercentage}%`,
                }}
              />
            </div>

            <span>
              {
                processedPercentage
              }
              % complete
            </span>
          </article>
        </section>

        <section className="auction-summary-team-card">
          <div className="auction-summary-heading">
            <div>
              <p>
                TEAM OVERVIEW
              </p>

              <h2>
                Purse & Squad Status
              </h2>
            </div>

            <strong>
              {
                teams.length
              }{" "}
              TEAMS
            </strong>
          </div>

          <div className="auction-summary-team-list">
            {teamRows.map(
              (
                row
              ) => (
                <article
                  className="auction-summary-team-row"
                  key={
                    row.team.id
                  }
                >
                  <div className="auction-summary-team-name">
                    <strong>
                      {
                        row.team.name
                      }
                    </strong>

                    <span>
                      {
                        row.team.shortName
                      }
                    </span>
                  </div>

                  <div>
                    <span>
                      PLAYERS
                    </span>

                    <strong>
                      {
                        row.team.players.length
                      }
                      /
                      {
                        settings.squadLimit
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      SPENT
                    </span>

                    <strong>
                      ₹
                      {
                        row.spent.toFixed(
                          2
                        )
                      }{" "}
                      Cr
                    </strong>
                  </div>

                  <div>
                    <span>
                      PURSE LEFT
                    </span>

                    <strong className="auction-summary-positive">
                      ₹
                      {
                        row.remaining.toFixed(
                          2
                        )
                      }{" "}
                      Cr
                    </strong>
                  </div>

                  <div>
                    <span>
                      SLOTS LEFT
                    </span>

                    <strong>
                      {
                        row.slotsLeft
                      }
                    </strong>
                  </div>
                </article>
              )
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default AuctionSummary;
