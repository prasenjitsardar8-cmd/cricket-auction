import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import "./PlayerParticipationTracker.css";

import { supabase } from "./supabase";

import {
  loadFixtures,
  type FixtureMatch,
} from "./fixturesDatabase";

type TrackerTab =
  | "ATTENDANCE"
  | "LINEUP"
  | "COMPLIANCE";

type TeamDraft = {
  starters: string[];
  superSubId: string | null;
  superSubUsed: boolean;
};

type LocalTrackerState = {
  presence: Record<string, boolean>;
  lineups: Record<
    string,
    Record<string, TeamDraft>
  >;
};

type RosterPlayer = {
  id: string;
  teamName: string;
  playerName: string;
};

const STORAGE_KEY =
  "hpe-match-day-rotation-v2";

const MIN_APPEARANCES = 2;
const STARTERS_REQUIRED = 6;

const TEAM_ROSTERS: Record<string, string[]> = {
  Royals: [
    "Chandra Sekhar Deepala",
    "Shivam Tiwari",
    "Vaibhav Rajaram Shelke",
    "Dhruva Chougule",
    "Hemade Jayanth",
    "Rahul Basodiya",
    "Rohit Pawar",
    "Mannu Arora",
    "Dheer Johari",
    "Deepesh",
    "Nivesh",
  ],

  "Super Kings": [
    "Mohit Kumar Gurung",
    "Christopher Fernandes",
    "Prasenjit Sardar",
    "Anant Avinash Dhage",
    "Niranjan K",
    "Karthik manda",
    "Radhey Prakash Patil",
    "David Sarkar",
    "Mihir Pal",
    "Ruthvik Reddy",
    "Rohit Sharma",
  ],

  MI: [
    "Aadith Lasar",
    "Pranav Vijay Chauhan",
    "Abhishek Suryawanshi",
    "Atharva Wakodikar",
    "Hitesh Vihire",
    "Rushikesh Shinde",
    "Yogesh Kothavade",
    "Ankur Anil Sonavane",
    "Mohammad Aamir Rayyan",
    "Umed Mujawar",
    "Nilesh Rane",
  ],

  "Royal Challengers": [
    "Akshay Nashipudi",
    "Abhilash Kadam",
    "Abhinav Shivaji Gavade",
    "Anubhav Mayank",
    "Ayush Garg",
    "Hrushikesh Yeolekar",
    "Shadab Siddique",
    "Vivekananda Reddy",
    "Dashrath Suthar",
    "Avinash Patel",
    "Bala",
  ],

  Capitals: [
    "Vansh Santdasani",
    "Ambuj",
    "Henery Paul",
    "Sourab Tiwari",
    "Ijaj Hussain",
    "Rutvij Mundhe",
    "Emad Rizwan Patel",
    "Karanveer Singh",
    "Mark Barren",
    "Monty",
  ],

  "Knight Riders": [
    "Hussain Karimkhan",
    "Manikandan P",
    "Prajwal Badri",
    "Vinit Kumar",
    "Praneet Hegde",
    "Prashant Sonawane",
    "Atharva Ingle",
    "Shrikant Lad",
    "Chaitanya Deshmukh",
    "Arkam",
    "Devashish",
  ],
};

function playerId(
  teamName: string,
  playerName: string
) {
  return `${teamName}::${playerName}`;
}

const ROSTER: RosterPlayer[] =
  Object.entries(TEAM_ROSTERS).flatMap(
    ([teamName, names]) =>
      names.map((playerName) => ({
        id: playerId(teamName, playerName),
        teamName,
        playerName,
      }))
  );

function createDefaultState(): LocalTrackerState {
  const presence: Record<string, boolean> = {};

  for (const player of ROSTER) {
    presence[player.id] = true;
  }

  return {
    presence,
    lineups: {},
  };
}

function readState(): LocalTrackerState {
  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      return createDefaultState();
    }

    const parsed =
      JSON.parse(raw) as
        Partial<LocalTrackerState>;

    const defaults =
      createDefaultState();

    return {
      presence: {
        ...defaults.presence,
        ...(parsed.presence ?? {}),
      },
      lineups:
        parsed.lineups ?? {},
    };
  } catch {
    return createDefaultState();
  }
}

function writeState(
  state: LocalTrackerState
) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(state)
  );
}

function PlayerParticipationTracker() {
  const [
    fixtures,
    setFixtures,
  ] =
    useState<FixtureMatch[]>([]);

  const [
    state,
    setState,
  ] =
    useState<LocalTrackerState>(
      () => readState()
    );

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
    message,
    setMessage,
  ] =
    useState("");

  const [
    tab,
    setTab,
  ] =
    useState<TrackerTab>(
      "ATTENDANCE"
    );

  const [
    attendanceTeam,
    setAttendanceTeam,
  ] =
    useState(
      Object.keys(
        TEAM_ROSTERS
      )[0] ?? ""
    );

  const [
    selectedFixtureId,
    setSelectedFixtureId,
  ] =
    useState<number | null>(
      null
    );

  const refreshFixtures =
    useCallback(
      async () => {
        try {
          const loaded =
            await loadFixtures();

          setFixtures(
            loaded
          );

          setSelectedFixtureId(
            (
              current
            ) => {
              if (
                current &&
                loaded.some(
                  (
                    fixture
                  ) =>
                    fixture.id ===
                    current
                )
              ) {
                return current;
              }

              return (
                loaded.find(
                  (
                    fixture
                  ) =>
                    fixture.slotType ===
                      "MATCH" &&
                    fixture.status ===
                      "CURRENT"
                )?.id ??
                loaded.find(
                  (
                    fixture
                  ) =>
                    fixture.slotType ===
                      "MATCH" &&
                    fixture.status ===
                      "UPCOMING"
                )?.id ??
                loaded.find(
                  (
                    fixture
                  ) =>
                    fixture.slotType ===
                    "MATCH"
                )?.id ??
                null
              );
            }
          );

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
              : "Unable to load fixtures."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    void refreshFixtures();

    const channel =
      supabase
        .channel(
          "local-rotation-fixture-sync"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "fixtures_matches",
          },
          () => {
            void refreshFixtures();
          }
        )
        .subscribe();

    const onReset =
      () => {
        setState(
          (
            current
          ) => {
            const next = {
              ...current,
              lineups: {},
            };

            writeState(
              next
            );

            return next;
          }
        );

        setMessage(
          "Player appearance records reset. Attendance was kept."
        );
      };

    window.addEventListener(
      "match-day-full-reset",
      onReset
    );

    return () => {
      void supabase.removeChannel(
        channel
      );

      window.removeEventListener(
        "match-day-full-reset",
        onReset
      );
    };
  }, [
    refreshFixtures,
  ]);

  const saveState =
    (
      next:
        LocalTrackerState
    ) => {
      writeState(
        next
      );
      setState(
        next
      );
    };

  const teamNames =
    Object.keys(
      TEAM_ROSTERS
    );

  const selectedFixture =
    useMemo(
      () =>
        fixtures.find(
          (
            fixture
          ) =>
            fixture.id ===
            selectedFixtureId
        ) ??
        null,
      [
        fixtures,
        selectedFixtureId,
      ]
    );

  const selectedFixtureTeams =
    selectedFixture
      ? [
          selectedFixture.team1,
          selectedFixture.team2,
        ].filter(
          (
            team
          ): team is string =>
            Boolean(
              team
            )
        )
      : [];

  const getDraft =
    (
      fixtureId: number,
      teamName: string
    ): TeamDraft =>
      state.lineups[
        String(
          fixtureId
        )
      ]?.[
        teamName
      ] ?? {
        starters: [],
        superSubId: null,
        superSubUsed: false,
      };

  const setDraft =
    (
      fixtureId: number,
      teamName: string,
      draft: TeamDraft
    ) => {
      const fixtureKey =
        String(
          fixtureId
        );

      const next: LocalTrackerState =
        {
          ...state,
          lineups: {
            ...state.lineups,
            [
              fixtureKey
            ]: {
              ...(
                state.lineups[
                  fixtureKey
                ] ?? {}
              ),
              [
                teamName
              ]:
                draft,
            },
          },
        };

      saveState(
        next
      );
    };

  const countAppearances =
    (
      id: string
    ) => {
      let count = 0;

      for (
        const fixtureLineups of
          Object.values(
            state.lineups
          )
      ) {
        for (
          const draft of
            Object.values(
              fixtureLineups
            )
        ) {
          if (
            draft.starters.includes(
              id
            )
          ) {
            count += 1;
          } else if (
            draft.superSubId ===
              id &&
            draft.superSubUsed
          ) {
            count += 1;
          }
        }
      }

      return count;
    };

  const getTeamRemainingMatches =
    (
      teamName: string
    ) =>
      fixtures.filter(
        (
          fixture
        ) =>
          fixture.slotType ===
            "MATCH" &&
          fixture.status !==
            "COMPLETED" &&
          (
            fixture.team1 ===
              teamName ||
            fixture.team2 ===
              teamName
          )
      ).length;

  const attendancePlayers =
    ROSTER.filter(
      (
        player
      ) =>
        player.teamName ===
        attendanceTeam
    );

  const presentCount =
    attendancePlayers.filter(
      (
        player
      ) =>
        state.presence[
          player.id
        ] !== false
    ).length;

  const togglePresence =
    (
      player:
        RosterPlayer
    ) => {
      const current =
        state.presence[
          player.id
        ] !== false;

      const next: LocalTrackerState =
        {
          ...state,
          presence: {
            ...state.presence,
            [
              player.id
            ]:
              !current,
          },
        };

      saveState(
        next
      );
    };

  const setAllPresence =
    (
      present:
        boolean
    ) => {
      const presence = {
        ...state.presence,
      };

      for (
        const player of
          attendancePlayers
      ) {
        presence[
          player.id
        ] =
          present;
      }

      saveState({
        ...state,
        presence,
      });
    };

  const toggleStarter =
    (
      teamName: string,
      id: string
    ) => {
      if (
        !selectedFixture
      ) {
        return;
      }

      const draft =
        getDraft(
          selectedFixture.id,
          teamName
        );

      const exists =
        draft.starters.includes(
          id
        );

      if (
        !exists &&
        draft.starters
          .length >=
          STARTERS_REQUIRED
      ) {
        return;
      }

      setDraft(
        selectedFixture.id,
        teamName,
        {
          ...draft,
          starters:
            exists
              ? draft.starters.filter(
                  (
                    item
                  ) =>
                    item !==
                    id
                )
              : [
                  ...draft.starters,
                  id,
                ],
          superSubId:
            draft.superSubId ===
            id
              ? null
              : draft.superSubId,
          superSubUsed:
            draft.superSubId ===
            id
              ? false
              : draft.superSubUsed,
        }
      );
    };

  const chooseSuperSub =
    (
      teamName: string,
      id: string
    ) => {
      if (
        !selectedFixture
      ) {
        return;
      }

      const draft =
        getDraft(
          selectedFixture.id,
          teamName
        );

      if (
        draft.starters.includes(
          id
        )
      ) {
        return;
      }

      const same =
        draft.superSubId ===
        id;

      setDraft(
        selectedFixture.id,
        teamName,
        {
          ...draft,
          superSubId:
            same
              ? null
              : id,
          superSubUsed:
            same
              ? false
              : draft.superSubUsed,
        }
      );
    };

  const setSubUsed =
    (
      teamName: string,
      used: boolean
    ) => {
      if (
        !selectedFixture
      ) {
        return;
      }

      const draft =
        getDraft(
          selectedFixture.id,
          teamName
        );

      setDraft(
        selectedFixture.id,
        teamName,
        {
          ...draft,
          superSubUsed:
            used,
        }
      );
    };

  const saveTeam =
    (
      teamName: string
    ) => {
      if (
        !selectedFixture
      ) {
        return;
      }

      const draft =
        getDraft(
          selectedFixture.id,
          teamName
        );

      if (
        draft.starters
          .length !==
        STARTERS_REQUIRED
      ) {
        setErrorMessage(
          `${teamName}: select exactly 6 starters.`
        );
        return;
      }

      const absentStarter =
        draft.starters.find(
          (
            id
          ) =>
            state.presence[
              id
            ] ===
            false
        );

      if (
        absentStarter
      ) {
        setErrorMessage(
          `${teamName}: an absent player is selected.`
        );
        return;
      }

      if (
        draft.superSubId &&
        state.presence[
          draft.superSubId
        ] === false
      ) {
        setErrorMessage(
          `${teamName}: the Super Sub is marked absent.`
        );
        return;
      }

      writeState(
        state
      );

      setErrorMessage(
        ""
      );

      setMessage(
        `${teamName} line-up saved for Match ${selectedFixture.matchNumber}.`
      );
    };

  const complianceRows =
    ROSTER.map(
      (
        player
      ) => {
        const appearances =
          countAppearances(
            player.id
          );

        const remainingMatches =
          getTeamRemainingMatches(
            player.teamName
          );

        const present =
          state.presence[
            player.id
          ] !== false;

        const needed =
          present
            ? Math.max(
                0,
                MIN_APPEARANCES -
                  appearances
              )
            : 0;

        return {
          ...player,
          present,
          appearances,
          remainingMatches,
          needed,
          impossible:
            present &&
            needed >
              remainingMatches,
        };
      }
    );

  const presentPlayers =
    complianceRows.filter(
      (
        row
      ) =>
        row.present
    );

  const compliantPlayers =
    presentPlayers.filter(
      (
        row
      ) =>
        row.appearances >=
        MIN_APPEARANCES
    );

  const pendingPlayers =
    presentPlayers.filter(
      (
        row
      ) =>
        row.appearances <
        MIN_APPEARANCES
    );

  const urgentPlayers =
    pendingPlayers.filter(
      (
        row
      ) =>
        row.impossible ||
        (
          row.needed ===
            row.remainingMatches &&
          row.remainingMatches >
            0
        )
    );

  if (
    loading
  ) {
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

          <h2>
            Player Assignment & Participation Tracker
          </h2>

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

      {(message ||
        errorMessage) && (
        <div
          className={
            errorMessage
              ? "participation-message error"
              : "participation-message"
          }
        >
          {errorMessage ||
            message}
        </div>
      )}

      <div className="participation-summary-grid">
        <div>
          <span>PRESENT PLAYERS</span>
          <strong>
            {
              presentPlayers.length
            }
          </strong>
        </div>

        <div>
          <span>COMPLETED 2+</span>
          <strong>
            {
              compliantPlayers.length
            }
          </strong>
        </div>

        <div
          className={
            pendingPlayers.length
              ? "warning"
              : "good"
          }
        >
          <span>STILL NEED MATCHES</span>
          <strong>
            {
              pendingPlayers.length
            }
          </strong>
        </div>

        <div
          className={
            urgentPlayers.length
              ? "danger"
              : "good"
          }
        >
          <span>ROTATION ALERTS</span>
          <strong>
            {
              urgentPlayers.length
            }
          </strong>
        </div>
      </div>

      <nav className="participation-tabs">
        <button
          type="button"
          className={
            tab ===
            "ATTENDANCE"
              ? "active"
              : ""
          }
          onClick={() =>
            setTab(
              "ATTENDANCE"
            )
          }
        >
          1. ATTENDANCE
        </button>

        <button
          type="button"
          className={
            tab ===
            "LINEUP"
              ? "active"
              : ""
          }
          onClick={() =>
            setTab(
              "LINEUP"
            )
          }
        >
          2. MATCH LINE-UP
        </button>

        <button
          type="button"
          className={
            tab ===
            "COMPLIANCE"
              ? "active"
              : ""
          }
          onClick={() =>
            setTab(
              "COMPLIANCE"
            )
          }
        >
          3. 2-MATCH CHECK
        </button>
      </nav>

      {tab ===
        "ATTENDANCE" && (
        <div className="participation-panel">
          <div className="participation-team-tabs">
            {teamNames.map(
              (
                team
              ) => (
                <button
                  type="button"
                  key={
                    team
                  }
                  className={
                    attendanceTeam ===
                    team
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setAttendanceTeam(
                      team
                    )
                  }
                >
                  {
                    team
                  }
                </button>
              )
            )}
          </div>

          <div className="attendance-heading">
            <div>
              <h3>
                {
                  attendanceTeam
                }
              </h3>

              <p>
                Present today:{" "}
                <strong>
                  {
                    presentCount
                  }
                </strong>{" "}
                /{" "}
                {
                  attendancePlayers.length
                }{" "}
                rostered
              </p>
            </div>

            <div>
              <button
                type="button"
                onClick={() =>
                  setAllPresence(
                    true
                  )
                }
              >
                ALL PRESENT
              </button>

              <button
                type="button"
                onClick={() =>
                  setAllPresence(
                    false
                  )
                }
              >
                CLEAR
              </button>
            </div>
          </div>

          <div className="attendance-list">
            {attendancePlayers.map(
              (
                player
              ) => {
                const present =
                  state.presence[
                    player.id
                  ] !== false;

                const appearances =
                  countAppearances(
                    player.id
                  );

                return (
                  <button
                    type="button"
                    className={
                      present
                        ? "present"
                        : "absent"
                    }
                    key={
                      player.id
                    }
                    onClick={() =>
                      togglePresence(
                        player
                      )
                    }
                  >
                    <span className="attendance-check">
                      {present
                        ? "✓"
                        : "×"}
                    </span>

                    <span className="attendance-player-name">
                      {
                        player.playerName
                      }
                    </span>

                    <span className="attendance-state">
                      {present
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
                      {
                        appearances
                      }
                      /2
                    </strong>
                  </button>
                );
              }
            )}
          </div>
        </div>
      )}

      {tab ===
        "LINEUP" && (
        <div className="participation-panel">
          <div className="lineup-fixture-select">
            <label>
              MATCH
            </label>

            <select
              value={
                selectedFixtureId ??
                ""
              }
              onChange={(
                event
              ) =>
                setSelectedFixtureId(
                  Number(
                    event.target
                      .value
                  )
                )
              }
            >
              {fixtures
                .filter(
                  (
                    fixture
                  ) =>
                    fixture.slotType ===
                    "MATCH"
                )
                .map(
                  (
                    fixture
                  ) => (
                    <option
                      key={
                        fixture.id
                      }
                      value={
                        fixture.id
                      }
                    >
                      Match {fixture.matchNumber} • {fixture.startTime} • {fixture.team1} vs {fixture.team2}
                    </option>
                  )
                )}
            </select>
          </div>

          {selectedFixture && (
            <div className="match-lineup-grid">
              {selectedFixtureTeams.map(
                (
                  teamName
                ) => {
                  const teamPlayers =
                    ROSTER.filter(
                      (
                        player
                      ) =>
                        player.teamName ===
                        teamName
                    );

                  const draft =
                    getDraft(
                      selectedFixture.id,
                      teamName
                    );

                  return (
                    <article
                      className="team-lineup-card"
                      key={
                        teamName
                      }
                    >
                      <div className="team-lineup-heading">
                        <div>
                          <span>
                            MATCH {selectedFixture.matchNumber}
                          </span>

                          <h3>
                            {
                              teamName
                            }
                          </h3>
                        </div>

                        <div
                          className={
                            draft.starters.length ===
                            STARTERS_REQUIRED
                              ? "lineup-count good"
                              : "lineup-count"
                          }
                        >
                          {
                            draft.starters.length
                          }
                          /6 STARTERS
                        </div>
                      </div>

                      <div className="lineup-player-list">
                        {teamPlayers.map(
                          (
                            player
                          ) => {
                            const present =
                              state.presence[
                                player.id
                              ] !== false;

                            const isStarter =
                              draft.starters.includes(
                                player.id
                              );

                            const isSub =
                              draft.superSubId ===
                              player.id;

                            const appearances =
                              countAppearances(
                                player.id
                              );

                            return (
                              <div
                                className={[
                                  "lineup-player-row",
                                  !present
                                    ? "absent"
                                    : "",
                                  isStarter
                                    ? "starter"
                                    : "",
                                  isSub
                                    ? "super-sub"
                                    : "",
                                ]
                                  .filter(
                                    Boolean
                                  )
                                  .join(
                                    " "
                                  )}
                                key={
                                  player.id
                                }
                              >
                                <div>
                                  <strong>
                                    {
                                      player.playerName
                                    }
                                  </strong>

                                  <small>
                                    {present
                                      ? `${appearances}/2 appearances`
                                      : "ABSENT TODAY"}
                                  </small>
                                </div>

                                <div className="lineup-player-actions">
                                  <button
                                    type="button"
                                    disabled={
                                      !present
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
                                      !present ||
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
                          }
                        )}
                      </div>

                      <div className="super-sub-used">
                        <label>
                          <input
                            type="checkbox"
                            disabled={
                              !draft.superSubId
                            }
                            checked={
                              draft.superSubUsed
                            }
                            onChange={(
                              event
                            ) =>
                              setSubUsed(
                                teamName,
                                event.target
                                  .checked
                              )
                            }
                          />

                          <span>
                            SUPER SUB ACTUALLY USED IN THIS MATCH
                          </span>
                        </label>

                        <small>
                          The Super Sub counts toward the 2-match rule only when this is checked.
                        </small>
                      </div>

                      <button
                        type="button"
                        className="save-lineup-button"
                        disabled={
                          draft.starters
                            .length !==
                          STARTERS_REQUIRED
                        }
                        onClick={() =>
                          saveTeam(
                            teamName
                          )
                        }
                      >
                        SAVE {teamName.toUpperCase()} LINE-UP
                      </button>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </div>
      )}

      {tab ===
        "COMPLIANCE" && (
        <div className="participation-panel">
          <div className="compliance-note">
            <strong>
              Rotation rule:
            </strong>{" "}
            Absent players are exempt. Every player marked present must finish the league schedule with at least 2 counted appearances.
          </div>

          <div className="compliance-team-grid">
            {teamNames.map(
              (
                teamName
              ) => {
                const rows =
                  complianceRows.filter(
                    (
                      row
                    ) =>
                      row.teamName ===
                      teamName
                  );

                const present =
                  rows.filter(
                    (
                      row
                    ) =>
                      row.present
                  );

                const done =
                  present.filter(
                    (
                      row
                    ) =>
                      row.appearances >=
                      MIN_APPEARANCES
                  ).length;

                return (
                  <article
                    className="compliance-team-card"
                    key={
                      teamName
                    }
                  >
                    <header>
                      <div>
                        <h3>
                          {
                            teamName
                          }
                        </h3>

                        <span>
                          {done}/{present.length} present players compliant
                        </span>
                      </div>

                      <strong>
                        {
                          getTeamRemainingMatches(
                            teamName
                          )
                        }{" "}
                        MATCHES LEFT
                      </strong>
                    </header>

                    <div className="compliance-list">
                      {rows.map(
                        (
                          row
                        ) => {
                          const status =
                            !row.present
                              ? "EXEMPT"
                              : row.appearances >=
                                MIN_APPEARANCES
                              ? "COMPLETE"
                              : row.impossible
                              ? "MISSED"
                              : row.needed ===
                                  row.remainingMatches &&
                                row.remainingMatches >
                                  0
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
                                  : status ===
                                    "URGENT"
                                  ? "urgent"
                                  : "",
                              ]
                                .filter(
                                  Boolean
                                )
                                .join(
                                  " "
                                )}
                              key={
                                row.id
                              }
                            >
                              <span>
                                {
                                  row.playerName
                                }
                              </span>

                              <strong>
                                {
                                  row.appearances
                                }
                                /2
                              </strong>

                              <b>
                                {
                                  status
                                }
                              </b>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </article>
                );
              }
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default PlayerParticipationTracker;
