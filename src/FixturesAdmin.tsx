import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import "./Fixtures.css";
import PlayerParticipationTracker from "./PlayerParticipationTracker";

import { supabase } from "./supabase";

import {
  advanceToNextFixture,
  calculatePointsTable,
  completeFixture,
  formatScore,
  getCurrentFixture,
  getNextFixture,
  loadFixtures,
  resetFixture,
  resetEntireSchedule,
  setCurrentFixture,
  updateFixtureScore,
  undoLastCompletedMatch,
  undoLastSavedFixture,
  hasUndoLastSaved,
  type FixtureMatch,
  type FixtureResultInput,
  type FixtureResultType,
} from "./fixturesDatabase";

type EditState = {
  team1Runs: string;
  team1Wickets: string;
  team1Overs: string;
  team2Runs: string;
  team2Wickets: string;
  team2Overs: string;
  resultType: "" | Exclude<FixtureResultType, null>;
  resultText: string;
};

const emptyEdit: EditState = {
  team1Runs: "",
  team1Wickets: "",
  team1Overs: "",
  team2Runs: "",
  team2Wickets: "",
  team2Overs: "",
  resultType: "",
  resultText: "",
};

function toNullableNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function FixturesAdmin() {
  const [fixtures, setFixtures] =
    useState<FixtureMatch[]>([]);

  const [selectedId, setSelectedId] =
    useState<number | null>(null);

  const [edit, setEdit] =
    useState<EditState>(emptyEdit);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [
    undoSavedAvailable,
    setUndoSavedAvailable,
  ] =
    useState(
      () =>
        hasUndoLastSaved()
    );

  const refresh = useCallback(
    async (showLoader = false) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        const loaded = await loadFixtures();
        setFixtures(loaded);

        setSelectedId((current) => {
          if (
            current &&
            loaded.some(
              (fixture) =>
                fixture.id === current &&
                fixture.slotType === "MATCH"
            )
          ) {
            return current;
          }

          return (
            getCurrentFixture(loaded)?.id ??
            loaded.find(
              (fixture) =>
                fixture.slotType === "MATCH" &&
                fixture.status === "UPCOMING"
            )?.id ??
            null
          );
        });

        setErrorMessage("");
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load fixtures."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void refresh(true);

    const channel = supabase
      .channel("fixtures-admin-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fixtures_matches",
        },
        () => {
          void refresh(false);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const selectedFixture =
    useMemo(
      () =>
        fixtures.find(
          (fixture) =>
            fixture.id === selectedId
        ) ?? null,
      [fixtures, selectedId]
    );

  useEffect(() => {
    if (!selectedFixture) {
      setEdit(emptyEdit);
      return;
    }

    setEdit({
      team1Runs:
        selectedFixture.team1Runs === null
          ? ""
          : String(selectedFixture.team1Runs),
      team1Wickets:
        selectedFixture.team1Wickets === null
          ? ""
          : String(selectedFixture.team1Wickets),
      team1Overs:
        selectedFixture.team1Overs ?? "",
      team2Runs:
        selectedFixture.team2Runs === null
          ? ""
          : String(selectedFixture.team2Runs),
      team2Wickets:
        selectedFixture.team2Wickets === null
          ? ""
          : String(selectedFixture.team2Wickets),
      team2Overs:
        selectedFixture.team2Overs ?? "",
      resultType:
        selectedFixture.resultType ?? "",
      resultText:
        selectedFixture.resultText ?? "",
    });
  }, [selectedFixture]);

  const currentFixture =
    getCurrentFixture(fixtures);

  const nextFixture =
    getNextFixture(fixtures);

  const points =
    calculatePointsTable(fixtures);

  const completedCount =
    fixtures.filter(
      (fixture) =>
        fixture.slotType === "MATCH" &&
        fixture.status === "COMPLETED"
    ).length;

  const totalMatches =
    fixtures.filter(
      (fixture) =>
        fixture.slotType === "MATCH"
    ).length;

  const makePayload =
    (): FixtureResultInput => ({
      team1Runs:
        toNullableNumber(edit.team1Runs),
      team1Wickets:
        toNullableNumber(edit.team1Wickets),
      team1Overs:
        edit.team1Overs.trim() || null,
      team2Runs:
        toNullableNumber(edit.team2Runs),
      team2Wickets:
        toNullableNumber(edit.team2Wickets),
      team2Overs:
        edit.team2Overs.trim() || null,
      resultType:
        edit.resultType || null,
      resultText:
        edit.resultText.trim(),
    });

  const runAction =
    async (
      action: () => Promise<void>,
      successMessage: string
    ) => {
      try {
        setSaving(true);
        setMessage("");
        setErrorMessage("");

        await action();
        await refresh(false);

        setUndoSavedAvailable(
          hasUndoLastSaved()
        );

        setMessage(successMessage);
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to save fixture changes."
        );
      } finally {
        setSaving(false);
      }
    };

  const saveScore = async () => {
    if (!selectedFixture) {
      return;
    }

    await runAction(
      () =>
        updateFixtureScore(
          selectedFixture.id,
          makePayload()
        ),
      "Score/details saved."
    );
  };

  const saveComplete = async () => {
    if (!selectedFixture) {
      return;
    }

    const payload = makePayload();

    if (!payload.resultType) {
      setErrorMessage(
        "Select the result before completing the match."
      );
      return;
    }

    await runAction(
      () =>
        completeFixture(
          selectedFixture.id,
          payload
        ),
      `Match ${selectedFixture.matchNumber} completed.`
    );
  };



  const handleUndoLastSaved =
    async () => {
      const confirmed =
        window.confirm(
          "UNDO LAST SAVED CHANGE?\n\nThis will restore the selected match to the exact score/result state it had immediately before the most recent SAVE SCORE, COMPLETE MATCH, or RESET action."
        );

      if (!confirmed) {
        return;
      }

      await runAction(
        async () => {
          await undoLastSavedFixture();
        },
        "Last saved fixture change was undone."
      );
    };

  const handleUndoLastCompleted =
    async () => {
      const confirmed =
        window.confirm(
          "UNDO LAST COMPLETED MATCH?\n\nThe most recently completed match will be reopened as CURRENT. Its score and result text will be kept, but it will stop counting in the points table until you complete it again."
        );

      if (!confirmed) {
        return;
      }

      await runAction(
        async () => {
          await undoLastCompletedMatch();
        },
        "Last completed match reopened."
      );
    };

  const handleResetEntireSchedule =
    async () => {
      const firstConfirm =
        window.confirm(
          "RESET THE ENTIRE MATCH SCHEDULE?\n\nThis will reset ALL 15 matches to UPCOMING and permanently clear:\n\n• all scores\n• all results\n• points-table progress\n• current match state\n• all saved match line-ups\n• all player appearance counts\n\nPlayer roster and Present/Absent attendance will be kept.\n\nThis cannot be undone from the browser."
        );

      if (!firstConfirm) {
        return;
      }

      const typed =
        window.prompt(
          'Type RESET SCHEDULE to confirm the full reset.'
        );

      if (typed !== "RESET SCHEDULE") {
        setErrorMessage(
          "Schedule reset cancelled. Confirmation text did not match."
        );
        return;
      }

      await runAction(
        async () => {
          await resetEntireSchedule();

          window.localStorage.setItem(
            "hpe-match-day-rotation-v2",
            JSON.stringify({
              ...(
                (() => {
                  try {
                    return JSON.parse(
                      window.localStorage.getItem(
                        "hpe-match-day-rotation-v2"
                      ) ?? "{}"
                    );
                  } catch {
                    return {};
                  }
                })()
              ),
              lineups: {},
            })
          );

          window.dispatchEvent(
            new Event(
              "match-day-full-reset"
            )
          );

          setUndoSavedAvailable(
            false
          );
        },
        "Entire match schedule reset."
      );
    };

  const goToPlayerAssignment =
    () => {
      document
        .getElementById(
          "player-assignment-section"
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    };

  if (loading) {
    return (
      <div className="fixtures-loading">
        Loading Match Day Control...
      </div>
    );
  }

  return (
    <div className="fixtures-admin-page">
      <header className="fixtures-admin-header">
        <div>
          <p className="fixtures-kicker">
            MATCH DAY CONTROL
          </p>

          <h1>
            Fixtures & Results
          </h1>

          <p>
            Control the live fixture, enter results,
            and update the points table in real time.
          </p>
        </div>

        <div className="fixtures-admin-header-actions">
          <button
            type="button"
            className="player-assignment-jump"
            onClick={goToPlayerAssignment}
          >
            PLAYER ASSIGNMENT
          </button>

          <button
            type="button"
            className="fixtures-undo-saved-button"
            disabled={
              saving ||
              !undoSavedAvailable
            }
            onClick={() =>
              void handleUndoLastSaved()
            }
          >
            ↶ UNDO LAST SAVED
          </button>

          <button
            type="button"
            className="fixtures-undo-button"
            disabled={saving || completedCount === 0}
            onClick={() =>
              void handleUndoLastCompleted()
            }
          >
            ↶ UNDO LAST COMPLETED
          </button>

          <button
            type="button"
            className="fixtures-reset-all-button"
            disabled={saving}
            onClick={() =>
              void handleResetEntireSchedule()
            }
          >
            RESET ENTIRE SCHEDULE
          </button>

          <a
            href="/fixtures/display"
            target="_blank"
            rel="noreferrer"
          >
            OPEN PROJECTOR
          </a>

          <button
            type="button"
            disabled={saving || !nextFixture}
            onClick={() =>
              void runAction(
                () =>
                  advanceToNextFixture(
                    fixtures
                  ),
                "Moved to the next match."
              )
            }
          >
            NEXT MATCH →
          </button>
        </div>
      </header>

      {(message || errorMessage) && (
        <div
          className={
            errorMessage
              ? "fixtures-message error"
              : "fixtures-message"
          }
        >
          {errorMessage || message}
        </div>
      )}

      <section className="fixtures-admin-summary">
        <div>
          <span>TOTAL MATCHES</span>
          <strong>{totalMatches}</strong>
        </div>

        <div>
          <span>COMPLETED</span>
          <strong>{completedCount}</strong>
        </div>

        <div>
          <span>REMAINING</span>
          <strong>
            {Math.max(
              0,
              totalMatches - completedCount
            )}
          </strong>
        </div>

        <div className="current">
          <span>CURRENT MATCH</span>
          <strong>
            {currentFixture
              ? `#${currentFixture.matchNumber}`
              : "—"}
          </strong>
        </div>

        <div>
          <span>NEXT MATCH</span>
          <strong>
            {nextFixture
              ? `#${nextFixture.matchNumber}`
              : "—"}
          </strong>
        </div>
      </section>

      <main className="fixtures-admin-layout">
        <section className="fixtures-admin-card fixtures-schedule-admin">
          <div className="fixtures-card-heading">
            <div>
              <p className="fixtures-kicker">
                FULL DAY
              </p>
              <h2>Fixture Schedule</h2>
            </div>

            <span>
              Click a match to edit
            </span>
          </div>

          <div className="fixtures-admin-list">
            {fixtures.map((fixture) => {
              if (
                fixture.slotType === "BREAK"
              ) {
                return (
                  <div
                    className="fixtures-admin-break"
                    key={fixture.id}
                  >
                    <strong>
                      LUNCH BREAK
                    </strong>
                    <span>
                      {fixture.startTime} –{" "}
                      {fixture.endTime}
                    </span>
                  </div>
                );
              }

              return (
                <button
                  type="button"
                  className={[
                    "fixtures-admin-row",
                    fixture.status.toLowerCase(),
                    selectedId === fixture.id
                      ? "selected"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={fixture.id}
                  onClick={() =>
                    setSelectedId(
                      fixture.id
                    )
                  }
                >
                  <div className="fixtures-admin-match-no">
                    #{fixture.matchNumber}
                  </div>

                  <div className="fixtures-admin-time">
                    {fixture.startTime}
                    <small>
                      {fixture.endTime}
                    </small>
                  </div>

                  <div className="fixtures-admin-teams">
                    <strong>
                      {fixture.team1}
                    </strong>
                    <span>vs</span>
                    <strong>
                      {fixture.team2}
                    </strong>
                  </div>

                  <div className="fixtures-admin-score-mini">
                    {formatScore(
                      fixture.team1Runs,
                      fixture.team1Wickets,
                      fixture.team1Overs
                    )}
                    <span>•</span>
                    {formatScore(
                      fixture.team2Runs,
                      fixture.team2Wickets,
                      fixture.team2Overs
                    )}
                  </div>

                  <div
                    className={`fixture-status-pill ${fixture.status.toLowerCase()}`}
                  >
                    {fixture.status}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="fixtures-admin-card fixture-editor">
          <div className="fixtures-card-heading">
            <div>
              <p className="fixtures-kicker">
                MATCH CONTROL
              </p>

              <h2>
                {selectedFixture
                  ? `Match ${selectedFixture.matchNumber}`
                  : "Select a match"}
              </h2>
            </div>
          </div>

          {selectedFixture ? (
            <>
              <div className="fixture-editor-teams">
                <div>
                  <span>TEAM 1</span>
                  <strong>
                    {selectedFixture.team1}
                  </strong>
                </div>

                <b>VS</b>

                <div>
                  <span>TEAM 2</span>
                  <strong>
                    {selectedFixture.team2}
                  </strong>
                </div>
              </div>

              <div className="fixture-editor-grid">
                <div>
                  <label>
                    {selectedFixture.team1} RUNS
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={edit.team1Runs}
                    onChange={(event) =>
                      setEdit((current) => ({
                        ...current,
                        team1Runs:
                          event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label>WICKETS</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={edit.team1Wickets}
                    onChange={(event) =>
                      setEdit((current) => ({
                        ...current,
                        team1Wickets:
                          event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label>OVERS</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 8.4"
                    value={edit.team1Overs}
                    onChange={(event) =>
                      setEdit((current) => ({
                        ...current,
                        team1Overs:
                          event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label>
                    {selectedFixture.team2} RUNS
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={edit.team2Runs}
                    onChange={(event) =>
                      setEdit((current) => ({
                        ...current,
                        team2Runs:
                          event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label>WICKETS</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={edit.team2Wickets}
                    onChange={(event) =>
                      setEdit((current) => ({
                        ...current,
                        team2Wickets:
                          event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label>OVERS</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 9.2"
                    value={edit.team2Overs}
                    onChange={(event) =>
                      setEdit((current) => ({
                        ...current,
                        team2Overs:
                          event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="fixture-editor-field">
                <label>RESULT</label>

                <select
                  value={edit.resultType}
                  onChange={(event) =>
                    setEdit((current) => ({
                      ...current,
                      resultType:
                        event.target
                          .value as EditState["resultType"],
                    }))
                  }
                >
                  <option value="">
                    Select result
                  </option>
                  <option value="TEAM1">
                    {selectedFixture.team1} won
                  </option>
                  <option value="TEAM2">
                    {selectedFixture.team2} won
                  </option>
                  <option value="TIE">
                    Tie
                  </option>
                  <option value="NO_RESULT">
                    No Result
                  </option>
                </select>
              </div>

              <div className="fixture-editor-field">
                <label>RESULT / MATCH NOTE</label>

                <input
                  value={edit.resultText}
                  onChange={(event) =>
                    setEdit((current) => ({
                      ...current,
                      resultText:
                        event.target.value,
                    }))
                  }
                  placeholder="e.g. MI won by 5 wickets"
                />
              </div>

              <div className="fixture-editor-actions">
                <button
                  type="button"
                  disabled={saving}
                  className="primary"
                  onClick={() =>
                    void runAction(
                      () =>
                        setCurrentFixture(
                          selectedFixture.id
                        ),
                      `Match ${selectedFixture.matchNumber} is now live.`
                    )
                  }
                >
                  SET AS CURRENT
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void saveScore()
                  }
                >
                  SAVE SCORE
                </button>

                <button
                  type="button"
                  disabled={saving}
                  className="success"
                  onClick={() =>
                    void saveComplete()
                  }
                >
                  COMPLETE MATCH
                </button>

                <button
                  type="button"
                  disabled={saving}
                  className="danger"
                  onClick={() =>
                    void runAction(
                      () =>
                        resetFixture(
                          selectedFixture.id
                        ),
                      `Match ${selectedFixture.matchNumber} reset.`
                    )
                  }
                >
                  RESET
                </button>
              </div>
            </>
          ) : (
            <p className="fixtures-muted">
              Select a match from the schedule.
            </p>
          )}
        </aside>
      </main>

      <section className="fixtures-admin-card fixtures-admin-points">
        <div className="fixtures-card-heading">
          <div>
            <p className="fixtures-kicker">
              LIVE STANDINGS
            </p>
            <h2>Points Table</h2>
          </div>

          <span>
            Win 2 • Tie/NR 1 • Loss 0
          </span>
        </div>

        <div className="fixtures-points-table-wrap">
          <table className="fixtures-points-table">
            <thead>
              <tr>
                <th>POS</th>
                <th>TEAM</th>
                <th>P</th>
                <th>W</th>
                <th>L</th>
                <th>T/NR</th>
                <th>PTS</th>
                <th>NRR</th>
              </tr>
            </thead>

            <tbody>
              {points.map((row) => (
                <tr key={row.team}>
                  <td>{row.position}</td>
                  <td>{row.team}</td>
                  <td>{row.played}</td>
                  <td>{row.won}</td>
                  <td>{row.lost}</td>
                  <td>
                    {row.tiedOrNoResult}
                  </td>
                  <td>
                    <strong>
                      {row.points}
                    </strong>
                  </td>
                  <td>
                    {row.nrr >= 0
                      ? "+"
                      : ""}
                    {row.nrr.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        id="player-assignment-section"
        className="fixtures-player-assignment-section"
      >
        <div className="fixtures-player-assignment-banner">
          <div>
            <p className="fixtures-kicker">
              PLAYER ASSIGNMENT
            </p>
            <h2>
              Match Line-up & Rotation Control
            </h2>
            <p>
              Mark attendance, assign the 6 starters and Super Sub for every match,
              and track the mandatory 2-match participation rule.
            </p>
          </div>
        </div>

        <PlayerParticipationTracker />
      </section>
    </div>
  );
}

export default FixturesAdmin;


