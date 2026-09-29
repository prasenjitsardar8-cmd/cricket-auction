import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import "./Fixtures.css";

import { supabase } from "./supabase";

import {
  calculatePointsTable,
  formatScore,
  getCurrentFixture,
  getNextFixture,
  loadFixtures,
  type FixtureMatch,
} from "./fixturesDatabase";

function FixturesDisplay() {
  const [fixtures, setFixtures] =
    useState<FixtureMatch[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const refresh = useCallback(
    async (showLoader = false) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setFixtures(
          await loadFixtures()
        );

        setErrorMessage("");
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load match-day display."
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
      .channel("fixtures-projector-live")
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

  const current =
    getCurrentFixture(fixtures);

  const next =
    getNextFixture(fixtures);

  const points =
    calculatePointsTable(fixtures);

  const completed =
    fixtures.filter(
      (fixture) =>
        fixture.slotType === "MATCH" &&
        fixture.status === "COMPLETED"
    ).length;

  const total =
    fixtures.filter(
      (fixture) =>
        fixture.slotType === "MATCH"
    ).length;

  const progress =
    total > 0
      ? Math.round(
          (completed / total) * 100
        )
      : 0;

  const currentResult =
    useMemo(() => {
      if (!current?.resultText) {
        return null;
      }

      return current.resultText;
    }, [current]);

  if (loading) {
    return (
      <div className="fixtures-loading projector">
        Loading Match Day Display...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="fixtures-loading projector">
        {errorMessage}
      </div>
    );
  }

  return (
    <div className="fixtures-projector">
      <header className="fixtures-projector-header">
        <div>
          <p className="fixtures-kicker">
            LIVE CRICKET • MATCH DAY
          </p>

          <h1>
            HPE Sports League
          </h1>

          <p>
            Fixtures • Live Match • Standings
          </p>
        </div>

        <div className="fixtures-projector-progress">
          <span>DAY PROGRESS</span>
          <strong>
            {completed}/{total}
          </strong>
          <small>
            {progress}% COMPLETE
          </small>
        </div>
      </header>

      <main className="fixtures-projector-main">
        <section className="fixtures-projector-hero">
          <article className="fixture-current-card">
            <div className="fixture-card-topline">
              <div>
                <p className="fixtures-kicker">
                  CURRENT MATCH
                </p>

                <h2>
                  {current
                    ? `Match ${current.matchNumber}`
                    : "No Match Live"}
                </h2>
              </div>

              {current && (
                <div className="fixture-live-pill">
                  <span />
                  LIVE
                </div>
              )}
            </div>

            {current ? (
              <>
                <div className="fixture-current-time">
                  {current.startTime}
                  <span>–</span>
                  {current.endTime}
                </div>

                <div className="fixture-current-versus">
                  <div className="fixture-current-team">
                    <span>TEAM 1</span>
                    <strong>
                      {current.team1}
                    </strong>

                    <div className="fixture-big-score">
                      {formatScore(
                        current.team1Runs,
                        current.team1Wickets,
                        current.team1Overs
                      )}
                    </div>
                  </div>

                  <div className="fixture-vs">
                    VS
                  </div>

                  <div className="fixture-current-team">
                    <span>TEAM 2</span>
                    <strong>
                      {current.team2}
                    </strong>

                    <div className="fixture-big-score">
                      {formatScore(
                        current.team2Runs,
                        current.team2Wickets,
                        current.team2Overs
                      )}
                    </div>
                  </div>
                </div>

                {currentResult && (
                  <div className="fixture-result-banner">
                    {currentResult}
                  </div>
                )}
              </>
            ) : (
              <div className="fixture-waiting">
                Waiting for the administrator
                to start the next match.
              </div>
            )}
          </article>

          <article className="fixture-next-card">
            <p className="fixtures-kicker">
              UP NEXT
            </p>

            {next ? (
              <>
                <div className="fixture-next-number">
                  MATCH {next.matchNumber}
                </div>

                <div className="fixture-next-time">
                  {next.startTime}
                  <span>
                    to {next.endTime}
                  </span>
                </div>

                <div className="fixture-next-team">
                  {next.team1}
                </div>

                <div className="fixture-next-vs">
                  VS
                </div>

                <div className="fixture-next-team">
                  {next.team2}
                </div>
              </>
            ) : (
              <div className="fixture-waiting">
                No remaining matches.
              </div>
            )}
          </article>
        </section>

        <section className="fixtures-projector-points">
          <div className="fixtures-projector-section-heading">
            <div>
              <p className="fixtures-kicker">
                LIVE STANDINGS
              </p>

              <h2>
                Points Table
              </h2>
            </div>

            <span>
              2 pts win • 1 pt tie/NR
            </span>
          </div>

          <div className="fixtures-points-table-wrap projector">
            <table className="fixtures-points-table projector">
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
                    <td>
                      {row.position}
                    </td>
                    <td>
                      {row.team}
                    </td>
                    <td>
                      {row.played}
                    </td>
                    <td>
                      {row.won}
                    </td>
                    <td>
                      {row.lost}
                    </td>
                    <td>
                      {row.tiedOrNoResult}
                    </td>
                    <td className="pts">
                      {row.points}
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

        <section className="fixtures-projector-schedule">
          <div className="fixtures-projector-section-heading">
            <div>
              <p className="fixtures-kicker">
                FULL DAY
              </p>

              <h2>
                Match Fixtures
              </h2>
            </div>

            <span>
              Current match highlighted
            </span>
          </div>

          <div className="fixture-schedule-grid">
            {fixtures.map((fixture) => {
              if (
                fixture.slotType === "BREAK"
              ) {
                return (
                  <div
                    className="fixture-schedule-card break"
                    key={fixture.id}
                  >
                    <div className="fixture-schedule-no">
                      BREAK
                    </div>

                    <div>
                      <strong>
                        LUNCH BREAK
                      </strong>
                      <span>
                        {fixture.startTime} –{" "}
                        {fixture.endTime}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  className={[
                    "fixture-schedule-card",
                    fixture.status.toLowerCase(),
                  ].join(" ")}
                  key={fixture.id}
                >
                  <div className="fixture-schedule-no">
                    {fixture.matchNumber}
                  </div>

                  <div className="fixture-schedule-content">
                    <span>
                      {fixture.startTime} –{" "}
                      {fixture.endTime}
                    </span>

                    <strong>
                      {fixture.team1}
                      <b> vs </b>
                      {fixture.team2}
                    </strong>
                  </div>

                  <div className={`fixture-status-pill ${fixture.status.toLowerCase()}`}>
                    {fixture.status === "CURRENT"
                      ? "LIVE"
                      : fixture.status}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

export default FixturesDisplay;
