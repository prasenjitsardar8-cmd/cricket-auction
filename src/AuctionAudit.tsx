import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import "./AuctionAudit.css";

import type { AuctionDivision } from "./database";

import {
  supabase,
} from "./supabase";

type AuditRow = {
  id: number;
  action: string;
  playerId: number | null;
  playerName: string | null;
  teamId: number | null;
  teamName: string | null;
  amount: number | null;
  details: Record<string, unknown>;
  actorEmail: string | null;
  createdAt: string;
};

type AuctionAuditProps = {
  onBack: () => void;
  division: AuctionDivision;
};

function AuctionAudit({
  onBack,
  division,
}: AuctionAuditProps) {
  const [rows, setRows] =
    useState<AuditRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [filter, setFilter] =
    useState("ALL");

  const loadAudit =
    useCallback(
      async () => {
        try {
          setErrorMessage("");

          const {
            data,
            error,
          } =
            await supabase
              .from(
                "auction_audit_log"
              )
              .select(`
                id,
                action,
                player_id,
                player_name,
                team_id,
                team_name,
                amount,
                details,
                actor_email,
                created_at
              `)
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
              .limit(500);

          if (error) {
            throw error;
          }

          setRows(
            (data ?? []).map(
              (row) => ({
                id:
                  Number(row.id),

                action:
                  String(
                    row.action
                  ),

                playerId:
                  row.player_id ===
                  null
                    ? null
                    : Number(
                        row.player_id
                      ),

                playerName:
                  row.player_name ??
                  null,

                teamId:
                  row.team_id ===
                  null
                    ? null
                    : Number(
                        row.team_id
                      ),

                teamName:
                  row.team_name ??
                  null,

                amount:
                  row.amount ===
                  null
                    ? null
                    : Number(
                        row.amount
                      ),

                details:
                  (row.details ??
                    {}) as Record<
                    string,
                    unknown
                  >,

                actorEmail:
                  row.actor_email ??
                  null,

                createdAt:
                  String(
                    row.created_at
                  ),
              })
            )
          );
        } catch (error) {
          console.error(error);

          setErrorMessage(
            error instanceof
              Error
              ? error.message
              : "Unable to load audit history."
          );
        } finally {
          setLoading(false);
        }
      },
      [division]
    );

  useEffect(() => {
    void loadAudit();

    const channel =
      supabase
        .channel(
          `${division.toLowerCase()}-auction-audit-live`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "auction_audit_log",
          },
          () => {
            void loadAudit();
          }
        )
        .subscribe();

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [loadAudit]);

  const actionOptions =
    useMemo(() => {
      return [
        "ALL",
        ...Array.from(
          new Set(
            rows.map(
              (row) =>
                row.action
            )
          )
        ).sort(),
      ];
    }, [rows]);

  const visibleRows =
    useMemo(() => {
      if (
        filter ===
        "ALL"
      ) {
        return rows;
      }

      return rows.filter(
        (row) =>
          row.action ===
          filter
      );
    }, [
      rows,
      filter,
    ]);

  const formatAction =
    (
      action: string
    ) =>
      action
        .replaceAll(
          "_",
          " "
        )
        .toUpperCase();

  const detailText =
    (
      row: AuditRow
    ) => {
      const parts: string[] =
        [];

      if (
        row.playerName
      ) {
        parts.push(
          row.playerName
        );
      }

      if (
        row.teamName
      ) {
        parts.push(
          row.teamName
        );
      }

      if (
        row.amount !==
        null
      ) {
        parts.push(
          `₹${row.amount.toFixed(
            2
          )} Cr`
        );
      }

      if (
        parts.length >
        0
      ) {
        return parts.join(
          " • "
        );
      }

      const summary =
        row.details.summary;

      if (
        typeof summary ===
        "string"
      ) {
        return summary;
      }

      return "Auction administration event";
    };

  return (
    <div className="auction-audit-page">
      <div className="auction-audit-topbar">
        <button
          onClick={
            onBack
          }
        >
          ← Back to Auction Board
        </button>

        <div>
          ADMIN • AUDIT
        </div>
      </div>

      <main className="auction-audit-content">
        <section className="auction-audit-hero">
          <div>
            <p>
              AUCTION GOVERNANCE
            </p>

            <h1>
              Audit Log
            </h1>

            <span>
              A timestamped history of important auction actions performed by the administrator.
            </span>
          </div>

          <button
            onClick={() =>
              void loadAudit()
            }
          >
            REFRESH
          </button>
        </section>

        <section className="auction-audit-summary">
          <div>
            <span>
              TOTAL EVENTS
            </span>

            <strong>
              {rows.length}
            </strong>
          </div>

          <div>
            <span>
              SOLD
            </span>

            <strong>
              {
                rows.filter(
                  (row) =>
                    row.action ===
                    "SOLD"
                ).length
              }
            </strong>
          </div>

          <div>
            <span>
              UNSOLD
            </span>

            <strong>
              {
                rows.filter(
                  (row) =>
                    row.action ===
                    "UNSOLD"
                ).length
              }
            </strong>
          </div>

          <div>
            <span>
              RECOVERY EVENTS
            </span>

            <strong>
              {
                rows.filter(
                  (row) =>
                    row.action.includes(
                      "RESTORE"
                    ) ||
                    row.action.includes(
                      "BACKUP"
                    )
                ).length
              }
            </strong>
          </div>
        </section>

        <section className="auction-audit-card">
          <div className="auction-audit-heading">
            <div>
              <p>
                EVENT HISTORY
              </p>

              <h2>
                Recorded Actions
              </h2>
            </div>

            <select
              value={
                filter
              }
              onChange={(
                event
              ) =>
                setFilter(
                  event.target.value
                )
              }
            >
              {actionOptions.map(
                (
                  action
                ) => (
                  <option
                    key={
                      action
                    }
                    value={
                      action
                    }
                  >
                    {
                      formatAction(
                        action
                      )
                    }
                  </option>
                )
              )}
            </select>
          </div>

          {errorMessage && (
            <div className="auction-audit-error">
              {
                errorMessage
              }
            </div>
          )}

          {loading ? (
            <div className="auction-audit-empty">
              Loading audit log...
            </div>
          ) : visibleRows.length ===
            0 ? (
            <div className="auction-audit-empty">
              No audit events recorded yet.
            </div>
          ) : (
            <div className="auction-audit-list">
              {visibleRows.map(
                (
                  row
                ) => (
                  <article
                    className="auction-audit-row"
                    key={
                      row.id
                    }
                  >
                    <div
                      className={`auction-audit-action ${row.action.toLowerCase()}`}
                    >
                      {
                        formatAction(
                          row.action
                        )
                      }
                    </div>

                    <div className="auction-audit-main">
                      <strong>
                        {
                          detailText(
                            row
                          )
                        }
                      </strong>

                      <span>
                        {
                          new Date(
                            row.createdAt
                          ).toLocaleString()
                        }
                      </span>
                    </div>

                    <div className="auction-audit-actor">
                      <span>
                        ADMIN
                      </span>

                      <strong>
                        {
                          row.actorEmail ??
                          "Unknown"
                        }
                      </strong>
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

export default AuctionAudit;
