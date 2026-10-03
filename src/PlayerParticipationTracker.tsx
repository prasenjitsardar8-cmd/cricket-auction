import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import "./PlayerParticipationTracker.css";

import { supabase } from "./supabase";

import {
  countPlayerAppearances,
  getTeamRemainingMatches,
  loadMatchDayData,
  saveMatchLineup,
  setRosterPresence,
  setWholeTeamPresence,
  type MatchDayRosterPlayer,
  type MatchParticipation,
} from "./participationDatabase";

import type {
  FixtureMatch,
} from "./fixturesDatabase";

type TrackerTab =
  | "ATTENDANCE"
  | "LINEUP"
  | "COMPLIANCE";

type TeamDraft = {
  starters: number[];
  superSubId: number | null;
  superSubUsed: boolean;
};

const MIN_APPEARANCES = 2;
const STARTERS_REQUIRED = 6;

function PlayerParticipationTracker() {
  const [fixtures, setFixtures] =
    useState<FixtureMatch[]>([]);
  const [roster, setRoster] =
    useState<MatchDayRosterPlayer[]>([]);
  const [participation, setParticipation] =
    useState<MatchParticipation[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");

  const [tab, setTab] =
    useState<TrackerTab>("ATTENDANCE");
  const [attendanceTeam, setAttendanceTeam] =
    useState("");
  const [selectedFixtureId, setSelectedFixtureId] =
    useState<number | null>(null);
  const [drafts, setDrafts] =
    useState<Record<string, TeamDraft>>({});

  const refresh = useCallback(
    async (showLoader = false) => {
      try {
        if (showLoader) setLoading(true);

        const data = await loadMatchDayData();
        setFixtures(data.fixtures);
        setRoster(data.roster);
        setParticipation(data.participation);

        setAttendanceTeam((current) =>
          current || data.roster[0]?.teamName || ""
        );

        setSelectedFixtureId((current) => {
          if (
            current &&
            data.fixtures.some(
              (fixture) => fixture.id === current
            )
          ) {
            return current;
          }

          return (
            data.fixtures.find(
              (fixture) =>
                fixture.slotType === "MATCH" &&
                fixture.status === "CURRENT"
            )?.id ??
            data.fixtures.find(
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
            : "Unable to load player participation tracker."
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
      .channel("match-participation-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_day_roster",
        },
        () => void refresh(false)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_participation",
        },
        () => void refresh(false)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const teamNames = useMemo(
    () =>
      Array.from(
        new Set(roster.map((player) => player.teamName))
      ),
    [roster]
  );

  const selectedFixture = useMemo(
    () =>
      fixtures.find(
        (fixture) => fixture.id === selectedFixtureId
      ) ?? null,
    [fixtures, selectedFixtureId]
  );

  const selectedFixtureTeams = useMemo(
    () =>
      selectedFixture
        ? [
            selectedFixture.team1,
            selectedFixture.team2,
          ].filter(
            (team): team is string => Boolean(team)
          )
        : [],
    [selectedFixture]
  );

  useEffect(() => {
    if (!selectedFixture) {
      setDrafts({});
      return;
    }

    const nextDrafts: Record<string, TeamDraft> = {};

    for (const teamName of selectedFixtureTeams) {
      const rows = participation.filter(
        (entry) =>
          entry.fixtureId === selectedFixture.id &&
          entry.teamName === teamName
      );

      const superSub = rows.find(
        (row) => row.role === "SUPER_SUB"
      );

      nextDrafts[teamName] = {
        starters: rows
          .filter((row) => row.role === "STARTER")
          .map((row) => row.playerId),
        superSubId: superSub?.playerId ?? null,
        superSubUsed: superSub?.participated ?? false,
      };
    }

    setDrafts(nextDrafts);
  }, [selectedFixture, selectedFixtureTeams, participation]);

  const attendancePlayers = roster.filter(
    (player) => player.teamName === attendanceTeam
  );

  const presentCount = attendancePlayers.filter(
    (player) => player.present
  ).length;

  const togglePresence = async (
    player: MatchDayRosterPlayer
  ) => {
    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");

      await setRosterPresence(
        player.id,
        !player.present
      );

      await refresh(false);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update attendance."
      );
    } finally {
      setSaving(false);
    }
  };

  const setAllPresence = async (present: boolean) => {
    if (!attendanceTeam) return;

    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");

      await setWholeTeamPresence(
        attendanceTeam,
        present
      );

      await refresh(false);

      setMessage(
        present
          ? `${attendanceTeam}: all rostered players marked present.`
          : `${attendanceTeam}: all rostered players marked absent.`
      );
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update team attendance."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleStarter = (
    teamName: string,
    playerId: number
  ) => {
    setDrafts((current) => {
      const draft = current[teamName] ?? {
        starters: [],
        superSubId: null,
        superSubUsed: false,
      };

      const already = draft.starters.includes(playerId);

      if (
        !already &&
        draft.starters.length >= STARTERS_REQUIRED
      ) {
        return current;
      }

      return {
        ...current,
        [teamName]: {
          ...draft,
          starters: already
            ? draft.starters.filter(
                (id) => id !== playerId
              )
            : [...draft.starters, playerId],
          superSubId:
            draft.superSubId === playerId
              ? null
              : draft.superSubId,
          superSubUsed:
            draft.superSubId === playerId
              ? false
              : draft.superSubUsed,
        },
      };
    });
  };

  const chooseSuperSub = (
    teamName: string,
    playerId: number
  ) => {
    setDrafts((current) => {
      const draft = current[teamName] ?? {
        starters: [],
        superSubId: null,
        superSubUsed: false,
      };

      if (draft.starters.includes(playerId)) {
        return current;
      }

      const same = draft.superSubId === playerId;

      return {
        ...current,
        [teamName]: {
          ...draft,
          superSubId: same ? null : playerId,
          superSubUsed: same
            ? false
            : draft.superSubUsed,
        },
      };
    });
  };

  const setSubUsed = (
    teamName: string,
    used: boolean
  ) => {
    setDrafts((current) => ({
      ...current,
      [teamName]: {
        ...(current[teamName] ?? {
          starters: [],
          superSubId: null,
          superSubUsed: false,
        }),
        superSubUsed: used,
      },
    }));
  };

  const saveTeam = async (teamName: string) => {
    if (!selectedFixture) return;

    const draft = drafts[teamName] ?? {
      starters: [],
      superSubId: null,
      superSubUsed: false,
    };

    if (draft.starters.length !== STARTERS_REQUIRED) {
      setErrorMessage(
        `${teamName}: select exactly ${STARTERS_REQUIRED} starting players.`
      );
      return;
    }

    const presentIds = new Set(
      roster
        .filter(
          (player) =>
            player.teamName === teamName &&
            player.present
        )
        .map((player) => player.id)
    );

    if (
      draft.starters.some(
        (id) => !presentIds.has(id)
      )
    ) {
      setErrorMessage(
        `${teamName}: an absent player is selected as a starter.`
      );
      return;
    }

    if (
      draft.superSubId &&
      !presentIds.has(draft.superSubId)
    ) {
      setErrorMessage(
        `${teamName}: the Super Sub is marked absent.`
      );
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");

      await saveMatchLineup({
        fixtureId: selectedFixture.id,
        teamName,
        starterIds: draft.starters,
        superSubId: draft.superSubId,
        superSubUsed: draft.superSubUsed,
      });

      await refresh(false);

      setMessage(
        `${teamName} line-up saved for Match ${selectedFixture.matchNumber}.`
      );
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save match line-up."
      );
    } finally {
      setSaving(false);
    }
  };

  const complianceRows = roster.map((player) => {
    const appearances = countPlayerAppearances(
      player.id,
      participation
    );

    const remainingMatches = getTeamRemainingMatches(
      player.teamName,
      fixtures
    );

    const needed = player.present
      ? Math.max(
          0,
          MIN_APPEARANCES - appearances
        )
      : 0;

    return {
      ...player,
      appearances,
      remainingMatches,
      needed,
      impossible:
        player.present &&
        needed > remainingMatches,
    };
  });

  const presentPlayers = complianceRows.filter(
    (row) => row.present
  );

  const compliantPlayers = presentPlayers.filter(
    (row) =>
      row.appearances >= MIN_APPEARANCES
  );

  const pendingPlayers = presentPlayers.filter(
    (row) =>
      row.appearances < MIN_APPEARANCES
  );

  const urgentPlayers = pendingPlayers.filter(
    (row) =>
      row.impossible ||
      (row.needed === row.remainingMatches &&
        row.remainingMatches > 0)
  );

  if (loading) {
    return (
      <section className="participation-tracker loading">
        Loading player rotation tracker...
      </section>
    );
  }

  return (
    <section className="participation-tracker">
      <header className="participation-header">
        <div>
          <p className="fixtures-kicker">
            PLAYER ROTATION
          </p>

          <h2>Player Assignment & Participation Tracker</h2>

          <p>
            Six starters + one Super Sub. Every
            player who is present at the venue must
            record at least two match appearances.
          </p>
        </div>

        <div className="participation-rule">
          <span>MINIMUM</span>
          <strong>2 MATCHES</strong>
          <small>per present player</small>
        </div>
      </header>

      {(message || errorMessage) && (
        <div
          className={
            errorMessage
              ? "participation-message error"
              : "participation-message"
          }
        >
          {errorMessage || message}
        </div>
      )}

      <div className="participation-summary-grid">
        <div>
          <span>PRESENT PLAYERS</span>
          <strong>{presentPlayers.length}</strong>
        </div>

        <div>
          <span>COMPLETED 2+</span>
          <strong>{compliantPlayers.length}</strong>
        </div>

        <div
          className={
            pendingPlayers.length
              ? "warning"
              : "good"
          }
        >
          <span>STILL NEED MATCHES</span>
          <strong>{pendingPlayers.length}</strong>
        </div>

        <div
          className={
            urgentPlayers.length
              ? "danger"
              : "good"
          }
        >
          <span>ROTATION ALERTS</span>
          <strong>{urgentPlayers.length}</strong>
        </div>
      </div>

      <nav className="participation-tabs">
        <button
          type="button"
          className={
            tab === "ATTENDANCE"
              ? "active"
              : ""
          }
          onClick={() => setTab("ATTENDANCE")}
        >
          1. ATTENDANCE
        </button>

        <button
          type="button"
          className={
            tab === "LINEUP"
              ? "active"
              : ""
          }
          onClick={() => setTab("LINEUP")}
        >
          2. MATCH LINE-UP
        </button>

        <button
          type="button"
          className={
            tab === "COMPLIANCE"
              ? "active"
              : ""
          }
          onClick={() => setTab("COMPLIANCE")}
        >
          3. 2-MATCH CHECK
        </button>
      </nav>

      {tab === "ATTENDANCE" && (
        <div className="participation-panel">
          <div className="participation-team-tabs">
            {teamNames.map((team) => (
              <button
                type="button"
                key={team}
                className={
                  attendanceTeam === team
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setAttendanceTeam(team)
                }
              >
                {team}
              </button>
            ))}
          </div>

          <div className="attendance-heading">
            <div>
              <h3>{attendanceTeam}</h3>
              <p>
                Present today:{" "}
                <strong>{presentCount}</strong> /{" "}
                {attendancePlayers.length} rostered
              </p>
            </div>

            <div>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void setAllPresence(true)
                }
              >
                ALL PRESENT
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void setAllPresence(false)
                }
              >
                CLEAR
              </button>
            </div>
          </div>

          <div className="attendance-list">
            {attendancePlayers.map((player) => {
              const appearances =
                countPlayerAppearances(
                  player.id,
                  participation
                );

              return (
                <button
                  type="button"
                  disabled={saving}
                  className={
                    player.present
                      ? "present"
                      : "absent"
                  }
                  key={player.id}
                  onClick={() =>
                    void togglePresence(player)
                  }
                >
                  <span className="attendance-check">
                    {player.present ? "✓" : "×"}
                  </span>

                  <span className="attendance-player-name">
                    {player.playerName}
                  </span>

                  <span className="attendance-state">
                    {player.present
                      ? "PRESENT"
                      : "ABSENT"}
                  </span>

                  <strong
                    className={
                      appearances >=
                      MIN_APPEARANCES
                        ? "complete"
                        : ""
                    }
                  >
                    {appearances}/2
                  </strong>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === "LINEUP" && (
        <div className="participation-panel">
          <div className="lineup-fixture-select">
            <label>MATCH</label>

            <select
              value={selectedFixtureId ?? ""}
              onChange={(event) =>
                setSelectedFixtureId(
                  Number(event.target.value)
                )
              }
            >
              {fixtures
                .filter(
                  (fixture) =>
                    fixture.slotType === "MATCH"
                )
                .map((fixture) => (
                  <option
                    key={fixture.id}
                    value={fixture.id}
                  >
                    Match {fixture.matchNumber} •{" "}
                    {fixture.startTime} •{" "}
                    {fixture.team1} vs {fixture.team2}
                  </option>
                ))}
            </select>
          </div>

          {selectedFixture && (
            <div className="match-lineup-grid">
              {selectedFixtureTeams.map(
                (teamName) => {
                  const teamPlayers = roster.filter(
                    (player) =>
                      player.teamName === teamName
                  );

                  const draft =
                    drafts[teamName] ?? {
                      starters: [],
                      superSubId: null,
                      superSubUsed: false,
                    };

                  return (
                    <article
                      className="team-lineup-card"
                      key={teamName}
                    >
                      <div className="team-lineup-heading">
                        <div>
                          <span>
                            MATCH{" "}
                            {selectedFixture.matchNumber}
                          </span>
                          <h3>{teamName}</h3>
                        </div>

                        <div
                          className={
                            draft.starters.length ===
                            STARTERS_REQUIRED
                              ? "lineup-count good"
                              : "lineup-count"
                          }
                        >
                          {draft.starters.length}/6 STARTERS
                        </div>
                      </div>

                      <div className="lineup-player-list">
                        {teamPlayers.map((player) => {
                          const isStarter =
                            draft.starters.includes(
                              player.id
                            );

                          const isSub =
                            draft.superSubId ===
                            player.id;

                          const appearances =
                            countPlayerAppearances(
                              player.id,
                              participation
                            );

                          return (
                            <div
                              className={[
                                "lineup-player-row",
                                !player.present
                                  ? "absent"
                                  : "",
                                isStarter
                                  ? "starter"
                                  : "",
                                isSub
                                  ? "super-sub"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              key={player.id}
                            >
                              <div>
                                <strong>
                                  {player.playerName}
                                </strong>

                                <small>
                                  {player.present
                                    ? `${appearances}/2 appearances`
                                    : "ABSENT TODAY"}
                                </small>
                              </div>

                              <div className="lineup-player-actions">
                                <button
                                  type="button"
                                  disabled={
                                    !player.present
                                  }
                                  className={
                                    isStarter
                                      ? "selected"
                                      : ""
                                  }
                                  onClick={() =>
                                    toggleStarter(
                                      teamName,
                                      player.id
                                    )
                                  }
                                >
                                  STARTER
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    !player.present ||
                                    isStarter
                                  }
                                  className={
                                    isSub
                                      ? "selected sub"
                                      : ""
                                  }
                                  onClick={() =>
                                    chooseSuperSub(
                                      teamName,
                                      player.id
                                    )
                                  }
                                >
                                  SUPER SUB
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="super-sub-used">
                        <label>
                          <input
                            type="checkbox"
                            disabled={!draft.superSubId}
                            checked={
                              draft.superSubUsed
                            }
                            onChange={(event) =>
                              setSubUsed(
                                teamName,
                                event.target.checked
                              )
                            }
                          />

                          <span>
                            SUPER SUB ACTUALLY USED IN
                            THIS MATCH
                          </span>
                        </label>

                        <small>
                          The Super Sub counts toward the
                          2-match rule only when this is
                          checked.
                        </small>
                      </div>

                      <button
                        type="button"
                        className="save-lineup-button"
                        disabled={
                          saving ||
                          draft.starters.length !==
                            STARTERS_REQUIRED
                        }
                        onClick={() =>
                          void saveTeam(teamName)
                        }
                      >
                        SAVE{" "}
                        {teamName.toUpperCase()} LINE-UP
                      </button>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </div>
      )}

      {tab === "COMPLIANCE" && (
        <div className="participation-panel">
          <div className="compliance-note">
            <strong>Rotation rule:</strong>{" "}
            Absent players are exempt. Every player
            marked present must finish the league
            schedule with at least 2 counted
            appearances.
          </div>

          <div className="compliance-team-grid">
            {teamNames.map((teamName) => {
              const rows = complianceRows.filter(
                (row) =>
                  row.teamName === teamName
              );

              const present = rows.filter(
                (row) => row.present
              );

              const done = present.filter(
                (row) =>
                  row.appearances >=
                  MIN_APPEARANCES
              ).length;

              return (
                <article
                  className="compliance-team-card"
                  key={teamName}
                >
                  <header>
                    <div>
                      <h3>{teamName}</h3>
                      <span>
                        {done}/{present.length} present
                        players compliant
                      </span>
                    </div>

                    <strong>
                      {getTeamRemainingMatches(
                        teamName,
                        fixtures
                      )}{" "}
                      MATCHES LEFT
                    </strong>
                  </header>

                  <div className="compliance-list">
                    {rows.map((row) => {
                      const status = !row.present
                        ? "EXEMPT"
                        : row.appearances >=
                          MIN_APPEARANCES
                        ? "COMPLETE"
                        : row.impossible
                        ? "MISSED"
                        : row.needed ===
                            row.remainingMatches &&
                          row.remainingMatches > 0
                        ? "URGENT"
                        : `NEEDS ${row.needed}`;

                      return (
                        <div
                          className={[
                            "compliance-row",
                            !row.present
                              ? "exempt"
                              : row.appearances >=
                                MIN_APPEARANCES
                              ? "complete"
                              : row.impossible
                              ? "danger"
                              : status === "URGENT"
                              ? "urgent"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          key={row.id}
                        >
                          <span>{row.playerName}</span>
                          <strong>
                            {row.appearances}/2
                          </strong>
                          <b>{status}</b>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export default PlayerParticipationTracker;

