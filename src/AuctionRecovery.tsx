import {
  useCallback,
  useEffect,
  useState,
} from "react";

import "./AuctionRecovery.css";

import type { AuctionDivision } from "./database";

import {
  supabase,
} from "./supabase";

type AuctionBackup = {
  id: number;
  backupType: string;
  label: string;
  createdAt: string;
};

type AuctionRecoveryProps = {
  onBack: () => void;
  onRecovered: () => Promise<void>;
  division: AuctionDivision;
};


function getSupabaseErrorMessage(
  error: unknown
) {
  if (
    error &&
    typeof error ===
      "object"
  ) {
    const possibleError =
      error as {
        message?: unknown;
        details?: unknown;
        hint?: unknown;
        code?: unknown;
      };

    const parts: string[] =
      [];

    if (
      typeof possibleError.message ===
      "string" &&
      possibleError.message
    ) {
      parts.push(
        possibleError.message
      );
    }

    if (
      typeof possibleError.details ===
      "string" &&
      possibleError.details
    ) {
      parts.push(
        `Details: ${possibleError.details}`
      );
    }

    if (
      typeof possibleError.hint ===
      "string" &&
      possibleError.hint
    ) {
      parts.push(
        `Hint: ${possibleError.hint}`
      );
    }

    if (
      typeof possibleError.code ===
      "string" &&
      possibleError.code
    ) {
      parts.push(
        `Code: ${possibleError.code}`
      );
    }

    if (
      parts.length >
      0
    ) {
      return parts.join(
        " | "
      );
    }
  }

  if (
    error instanceof
    Error
  ) {
    return error.message;
  }

  return "Unknown recovery error.";
}

function AuctionRecovery({
  onBack,
  onRecovered,
  division,
}: AuctionRecoveryProps) {
  const [
    backups,
    setBackups,
  ] =
    useState<AuctionBackup[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    working,
    setWorking,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const loadBackups =
    useCallback(
      async () => {
        try {
          setErrorMessage(
            ""
          );

          const {
            data,
            error,
          } =
            await supabase
              .from(
                "auction_backups"
              )
              .select(`
                id,
                backup_type,
                label,
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
              .limit(
                100
              );

          if (error) {
            throw error;
          }

          setBackups(
            (
              data ??
              []
            ).map(
              (
                row
              ) => ({
                id:
                  Number(
                    row.id
                  ),

                backupType:
                  String(
                    row.backup_type ??
                    "MANUAL"
                  ),

                label:
                  String(
                    row.label ??
                    ""
                  ),

                createdAt:
                  String(
                    row.created_at
                  ),
              })
            )
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
              : "Unable to load auction backups."
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
    void loadBackups();
  }, [loadBackups]);

  useEffect(() => {
    const channel =
      supabase
        .channel(
          `${division.toLowerCase()}-auction-backup-list`
        )
        .on(
          "postgres_changes",
          {
            event:
              "*",

            schema:
              "public",

            table:
              "auction_backups",
          },
          () => {
            void loadBackups();
          }
        )
        .subscribe();

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [loadBackups]);

  const recordAuditEvent =
    async (
      action: string,
      details:
        Record<
          string,
          unknown
        >
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
                null,

              p_player_name:
                null,

              p_team_id:
                null,

              p_team_name:
                null,

              p_amount:
                null,

              p_details:
                details,

              p_division:
                division,
            }
          );

        if (error) {
          throw error;
        }
      } catch (error) {
        console.error(
          "Unable to write recovery audit event.",
          error
        );
      }
    };

  const createCheckpoint =
    async () => {
      try {
        const label =
          window.prompt(
            "Checkpoint name:",
            `Manual checkpoint ${new Date().toLocaleTimeString()}`
          );

        if (
          label ===
          null
        ) {
          return;
        }

        setWorking(
          true
        );

        setMessage(
          ""
        );

        setErrorMessage(
          ""
        );

        const {
          error,
        } =
          await supabase
            .rpc(
              "create_auction_backup",
              {
                p_label:
                  label.trim() ||
                  "Manual checkpoint",

                p_type:
                  "MANUAL",

                p_division:
                  division,
              }
            );

        if (error) {
          throw error;
        }

        void recordAuditEvent(
          "BACKUP_CREATED",
          {
            summary:
              `Manual checkpoint created: ${label.trim() || "Manual checkpoint"}`,

            label:
              label.trim() ||
              "Manual checkpoint",
          }
        );

        setMessage(
          "Checkpoint created successfully."
        );

        await loadBackups();
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
              : "Unable to create checkpoint."
        );
      } finally {
        setWorking(
          false
        );
      }
    };

  const restoreBackup =
    async (
      backup:
        AuctionBackup
    ) => {
      const confirmed =
        window.confirm(
          `Restore this auction checkpoint?\n\n${backup.label || `Backup #${backup.id}`}\n${new Date(
            backup.createdAt
          ).toLocaleString()}\n\nCurrent auction progress will first be saved as a PRE-RESTORE backup.\n\nIf the saved timer was running, it will recover in PAUSED state so you can verify everything before resuming.`
        );

      if (
        !confirmed
      ) {
        return;
      }

      try {
        setWorking(
          true
        );

        setMessage(
          ""
        );

        setErrorMessage(
          ""
        );

        const {
          error,
        } =
          await supabase
            .rpc(
              "restore_auction_backup",
              {
                p_backup_id:
                  backup.id,

                p_division:
                  division,
              }
            );

        if (error) {
          throw error;
        }

        void recordAuditEvent(
          "RESTORE",
          {
            summary:
              `Auction restored from backup #${backup.id}: ${backup.label || "Unnamed checkpoint"}`,

            backupId:
              backup.id,

            backupType:
              backup.backupType,

            backupLabel:
              backup.label,

            backupCreatedAt:
              backup.createdAt,
          }
        );

        setMessage(
          "Auction recovered successfully. Reloading live auction data..."
        );

        await onRecovered();

        await loadBackups();
      } catch (
        error
      ) {
        console.error(
          error
        );

        setErrorMessage(
          getSupabaseErrorMessage(
            error
          )
        );
      } finally {
        setWorking(
          false
        );
      }
    };

  const deleteBackup =
    async (
      backup:
        AuctionBackup
    ) => {
      if (
        !window.confirm(
          `Delete "${backup.label || `Backup #${backup.id}`}"?\n\nThis does not change the live auction.`
        )
      ) {
        return;
      }

      try {
        setWorking(
          true
        );

        setMessage(
          ""
        );

        setErrorMessage(
          ""
        );

        const {
          error,
        } =
          await supabase
            .from(
              "auction_backups"
            )
            .delete()
            .eq(
              "id",
              backup.id
            );

        if (error) {
          throw error;
        }

        await loadBackups();
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
              : "Unable to delete backup."
        );
      } finally {
        setWorking(
          false
        );
      }
    };

  return (
    <div className="auction-recovery-page">
      <div className="auction-recovery-topbar">
        <button
          onClick={
            onBack
          }
        >
          ← Back to Auction Board
        </button>

        <div>
          ADMIN • RECOVERY
        </div>
      </div>

      <main className="auction-recovery-content">
        <section className="auction-recovery-hero">
          <div>
            <p>
              AUCTION SAFETY
            </p>

            <h1>
              Backup & Recovery
            </h1>

            <span>
              Recover the live auction after an accidental reset, undo, browser failure, or operator mistake.
            </span>
          </div>

          <button
            disabled={
              working
            }
            onClick={() =>
              void createCheckpoint()
            }
          >
            + CREATE CHECKPOINT
          </button>
        </section>

        <section className="auction-recovery-info">
          <div>
            <strong>
              LIVE STATE IS ALREADY PERSISTENT
            </strong>

            <span>
              Refreshing the page, closing the browser, restarting the laptop, or opening Admin on another device will reload the current auction from Supabase.
            </span>
          </div>

          <div>
            <strong>
              AUTOMATIC CHECKPOINTS
            </strong>

            <span>
              The database creates checkpoints when the auction advances to another player and before history is deleted by Undo/Reset.
            </span>
          </div>

          <div>
            <strong>
              SAFE TIMER RECOVERY
            </strong>

            <span>
              A running timer is restored as PAUSED with its saved remaining seconds. Resume it only after validating the recovered state.
            </span>
          </div>
        </section>

        {errorMessage && (
          <div className="auction-recovery-message error">
            {
              errorMessage
            }
          </div>
        )}

        {message && (
          <div className="auction-recovery-message success">
            {
              message
            }
          </div>
        )}

        <section className="auction-recovery-list-card">
          <div className="auction-recovery-heading">
            <div>
              <p>
                RECOVERY POINTS
              </p>

              <h2>
                Saved Checkpoints
              </h2>
            </div>

            <strong>
              {
                backups.length
              }{" "}
              AVAILABLE
            </strong>
          </div>

          {loading ? (
            <div className="auction-recovery-empty">
              Loading checkpoints...
            </div>
          ) : backups.length ===
            0 ? (
            <div className="auction-recovery-empty">
              No checkpoints yet. Create a manual checkpoint or advance the auction to generate automatic recovery points.
            </div>
          ) : (
            <div className="auction-recovery-list">
              {backups.map(
                (
                  backup
                ) => (
                  <article
                    className="auction-recovery-row"
                    key={
                      backup.id
                    }
                  >
                    <div
                      className={`auction-recovery-type ${
                        backup.backupType.toLowerCase()
                      }`}
                    >
                      {
                        backup.backupType
                      }
                    </div>

                    <div className="auction-recovery-details">
                      <strong>
                        {backup.label ||
                          `Backup #${backup.id}`}
                      </strong>

                      <span>
                        {new Date(
                          backup.createdAt
                        ).toLocaleString()}
                      </span>
                    </div>

                    <div className="auction-recovery-actions">
                      <button
                        className="restore"
                        disabled={
                          working
                        }
                        onClick={() =>
                          void restoreBackup(
                            backup
                          )
                        }
                      >
                        RESTORE
                      </button>

                      <button
                        className="delete"
                        disabled={
                          working
                        }
                        onClick={() =>
                          void deleteBackup(
                            backup
                          )
                        }
                      >
                        DELETE
                      </button>
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

export default AuctionRecovery;
