import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import "./PreAuctionHealth.css";

import {
  loadAuctionHistory,
  loadAuctionPlayers,
  loadAuctionState,
  loadTeams,
  loadTournamentSettings,
  type AuctionDivision,
} from "./database";

import {
  supabase,
} from "./supabase";

type CheckStatus =
  | "PASS"
  | "WARN"
  | "FAIL"
  | "RUNNING";

type HealthCheck = {
  id: string;
  title: string;
  detail: string;
  status: CheckStatus;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  team_id: number | null;
};

type PreAuctionHealthProps = {
  onBack: () => void;
  division: AuctionDivision;
};

function PreAuctionHealth({
  onBack,
  division,
}: PreAuctionHealthProps) {
  const [
    checks,
    setChecks,
  ] =
    useState<HealthCheck[]>(
      []
    );

  const [
    running,
    setRunning,
  ] =
    useState(false);

  const [
    lastChecked,
    setLastChecked,
  ] =
    useState<Date | null>(
      null
    );

  const runChecks =
    useCallback(
      async () => {
        setRunning(
          true
        );

        setChecks([
          {
            id:
              "startup",
            title:
              "Running pre-auction validation",
            detail:
              "Checking Supabase, teams, owners, players, settings and projector route...",
            status:
              "RUNNING",
          },
        ]);

        const results:
          HealthCheck[] =
            [];

        const push =
          (
            id: string,
            title: string,
            detail: string,
            status:
              CheckStatus
          ) => {
            results.push({
              id,
              title,
              detail,
              status,
            });
          };

        try {
          let teams:
            Awaited<
              ReturnType<
                typeof loadTeams
              >
            > = [];

          let players:
            Awaited<
              ReturnType<
                typeof loadAuctionPlayers
              >
            > = [];

          let history:
            Awaited<
              ReturnType<
                typeof loadAuctionHistory
              >
            > = [];

          let settings:
            Awaited<
              ReturnType<
                typeof loadTournamentSettings
              >
            > | null =
              null;

          let state:
            Awaited<
              ReturnType<
                typeof loadAuctionState
              >
            > | null =
              null;

          let coreLoaded =
            false;

          try {
            [
              teams,
              players,
              history,
              settings,
              state,
            ] =
              await Promise.all([
                loadTeams(division),
                loadAuctionPlayers(division),
                loadAuctionHistory(division),
                loadTournamentSettings(division),
                loadAuctionState(division),
              ]);

            coreLoaded =
              true;

            push(
              "supabase",
              "Supabase connection",
              "Database connection is healthy and auction data can be loaded.",
              "PASS"
            );
          } catch (
            error
          ) {
            console.error(
              error
            );

            push(
              "supabase",
              "Supabase connection",
              error instanceof
                Error
                ? error.message
                : "Unable to load live auction data from Supabase.",
              "FAIL"
            );
          }

          if (
            coreLoaded &&
            settings
          ) {
            const settingsIssues:
              string[] =
                [];

            if (
              !settings.tournamentName
                ?.trim()
            ) {
              settingsIssues.push(
                "Tournament name is missing"
              );
            }

            if (
              !settings.seasonName
                ?.trim()
            ) {
              settingsIssues.push(
                "Season name is missing"
              );
            }

            if (
              !Number.isFinite(
                settings.squadLimit
              ) ||
              settings.squadLimit <=
                0
            ) {
              settingsIssues.push(
                "Squad limit must be greater than zero"
              );
            }

            push(
              "settings",
              "Tournament settings",
              settingsIssues.length ===
                0
                ? `${settings.tournamentName} • ${settings.seasonName} • Squad limit ${settings.squadLimit}`
                : settingsIssues.join(
                    " • "
                  ),
              settingsIssues.length ===
                0
                ? "PASS"
                : "FAIL"
            );
          }

          if (
            coreLoaded
          ) {
            if (
              teams.length >=
              2
            ) {
              push(
                "teams",
                "Teams configured",
                `${teams.length} teams are available for the auction.`,
                "PASS"
              );
            } else {
              push(
                "teams",
                "Teams configured",
                `Only ${teams.length} team(s) found. At least two teams are recommended.`,
                "FAIL"
              );
            }

            const badPurseTeams =
              teams.filter(
                (team) =>
                  !Number.isFinite(
                    team.startingPurse
                  ) ||
                  team.startingPurse <=
                    0
              );

            push(
              "purse",
              "Team purses",
              badPurseTeams.length ===
                0
                ? "Every team has a valid starting purse."
                : `Invalid starting purse: ${badPurseTeams
                    .map(
                      (team) =>
                        team.name
                    )
                    .join(", ")}`,
              badPurseTeams.length ===
                0
                ? "PASS"
                : "FAIL"
            );

            const badTeamNames =
              teams.filter(
                (team) =>
                  !team.name
                    ?.trim() ||
                  !team.shortName
                    ?.trim()
              );

            push(
              "team-identities",
              "Team names & short names",
              badTeamNames.length ===
                0
                ? "All teams have names and short names."
                : `Incomplete team identity: ${badTeamNames
                    .map(
                      (team) =>
                        team.name ||
                        `Team ${team.id}`
                    )
                    .join(", ")}`,
              badTeamNames.length ===
                0
                ? "PASS"
                : "FAIL"
            );

            const teamsWithoutLogo =
              teams.filter(
                (team) =>
                  !team.logo
              );

            push(
              "team-logos",
              "Team logos",
              teamsWithoutLogo.length ===
                0
                ? "All team logos are configured."
                : `${teamsWithoutLogo.length} team(s) have no logo. This does not block the auction.`,
              teamsWithoutLogo.length ===
                0
                ? "PASS"
                : "WARN"
            );

            if (
              players.length >
              0
            ) {
              push(
                "players",
                "Player pool",
                `${players.length} auction players are loaded.`,
                "PASS"
              );
            } else {
              push(
                "players",
                "Player pool",
                "No auction players are loaded.",
                "FAIL"
              );
            }

            const invalidPlayers =
              players.filter(
                (player) =>
                  !player.name
                    ?.trim() ||
                  !Number.isFinite(
                    player.basePrice
                  ) ||
                  player.basePrice <=
                    0
              );

            push(
              "player-data",
              "Player names & base prices",
              invalidPlayers.length ===
                0
                ? "All players have valid names and base prices."
                : `${invalidPlayers.length} player(s) have missing names or invalid base prices.`,
              invalidPlayers.length ===
                0
                ? "PASS"
                : "FAIL"
            );

            const playersWithoutPhoto =
              players.filter(
                (player) =>
                  !player.photo
              );

            push(
              "player-photos",
              "Player photos",
              playersWithoutPhoto.length ===
                0
                ? "All player photos are configured."
                : `${playersWithoutPhoto.length} player(s) have no photo. Initials will be shown instead.`,
              playersWithoutPhoto.length ===
                0
                ? "PASS"
                : "WARN"
            );

            const soldCount =
              teams.reduce(
                (
                  total,
                  team
                ) =>
                  total +
                  team.players.length,
                0
              );

            if (
              soldCount ===
                0 &&
              history.length ===
                0
            ) {
              push(
                "clean-start",
                "Clean auction start",
                "No previous purchases or auction history detected.",
                "PASS"
              );
            } else {
              push(
                "clean-start",
                "Existing auction progress",
                `${soldCount} purchased player(s) and ${history.length} history record(s) already exist. Continue only if this is intentional.`,
                "WARN"
              );
            }

            if (
              state
            ) {
              const validIndex =
                state.currentPlayerIndex >=
                  0 &&
                (
                  players.length ===
                    0 ||
                  state.currentPlayerIndex <=
                    players.length
                );

              push(
                "auction-state",
                "Auction state",
                validIndex
                  ? `State available • Player index ${state.currentPlayerIndex} • Timer ${state.timerStatus}`
                  : `Current player index ${state.currentPlayerIndex} is outside the loaded player pool.`,
                validIndex
                  ? "PASS"
                  : "FAIL"
              );
            }
          }

          try {
            const {
              data,
              error,
            } =
              await supabase
                .from(
                  "profiles"
                )
                .select(`
                  id,
                  full_name,
                  role,
                  team_id
                `);

            if (error) {
              throw error;
            }

            const profiles =
              (
                data ??
                []
              ) as ProfileRow[];

            const owners =
              profiles.filter(
                (profile) =>
                  profile.role ===
                  "owner"
              );

            const ownersWithoutTeam =
              owners.filter(
                (profile) =>
                  profile.team_id ===
                  null
              );

            push(
              "owner-mapping",
              "Owner team assignments",
              ownersWithoutTeam.length ===
                0
                ? `${owners.length} owner account(s) are mapped to teams.`
                : `${ownersWithoutTeam.length} owner account(s) have no team assignment.`,
              ownersWithoutTeam.length ===
                0
                ? "PASS"
                : "FAIL"
            );

            const teamOwnerCount =
              new Map<
                number,
                number
              >();

            owners.forEach(
              (owner) => {
                if (
                  owner.team_id !==
                  null
                ) {
                  teamOwnerCount.set(
                    owner.team_id,
                    (
                      teamOwnerCount.get(
                        owner.team_id
                      ) ??
                      0
                    ) +
                      1
                  );
                }
              }
            );

            const duplicateTeamIds =
              Array.from(
                teamOwnerCount.entries()
              )
                .filter(
                  (
                    [
                      ,
                      count,
                    ]
                  ) =>
                    count >
                    1
                )
                .map(
                  (
                    [
                      teamId,
                    ]
                  ) =>
                    teamId
                );

            push(
              "duplicate-owners",
              "Duplicate owner assignments",
              duplicateTeamIds.length ===
                0
                ? "No team is assigned to more than one Owner account."
                : `Duplicate Owner assignment detected for team ID(s): ${duplicateTeamIds.join(
                    ", "
                  )}`,
              duplicateTeamIds.length ===
                0
                ? "PASS"
                : "FAIL"
            );

            const adminCount =
              profiles.filter(
                (profile) =>
                  profile.role ===
                  "admin"
              ).length;

            push(
              "admins",
              "Admin account",
              adminCount >
                0
                ? `${adminCount} administrator account(s) available.`
                : "No administrator profile found.",
              adminCount >
                0
                ? "PASS"
                : "FAIL"
            );
          } catch (
            error
          ) {
            console.error(
              error
            );

            push(
              "profiles",
              "User profile validation",
              error instanceof
                Error
                ? error.message
                : "Unable to validate Admin/Owner profile assignments.",
              "FAIL"
            );
          }

          try {
            const {
              count,
              error,
            } =
              await supabase
                .from(
                  "auction_backups"
                )
                .select(
                  "id",
                  {
                    count:
                      "exact",
                    head:
                      true,
                  }
                );

            if (error) {
              throw error;
            }

            push(
              "backup",
              "Recovery checkpoint",
              (
                count ??
                0
              ) >
                0
                ? `${count} backup/recovery checkpoint(s) available.`
                : "No recovery checkpoint exists yet. Create one before the live auction.",
              (
                count ??
                0
              ) >
                0
                ? "PASS"
                : "WARN"
            );
          } catch (
            error
          ) {
            console.error(
              error
            );

            push(
              "backup",
              "Recovery checkpoint",
              "Unable to verify backup availability.",
              "WARN"
            );
          }

          try {
            const response =
              await fetch(
                "/display",
                {
                  method:
                    "GET",
                  cache:
                    "no-store",
                }
              );

            push(
              "projector",
              "Projector route",
              response.ok
                ? "The /display projector route is reachable."
                : `Projector route returned HTTP ${response.status}.`,
              response.ok
                ? "PASS"
                : "FAIL"
            );
          } catch (
            error
          ) {
            console.error(
              error
            );

            push(
              "projector",
              "Projector route",
              "Unable to reach the /display projector route.",
              "FAIL"
            );
          }

          push(
            "browser-network",
            "Browser network status",
            navigator.onLine
              ? "Browser reports an active network connection."
              : "Browser is currently offline.",
            navigator.onLine
              ? "PASS"
              : "FAIL"
          );
        } finally {
          setChecks(
            results
          );

          setLastChecked(
            new Date()
          );

          setRunning(
            false
          );
        }
      },
      [division]
    );

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  const counts =
    useMemo(
      () => ({
        pass:
          checks.filter(
            (check) =>
              check.status ===
              "PASS"
          ).length,

        warn:
          checks.filter(
            (check) =>
              check.status ===
              "WARN"
          ).length,

        fail:
          checks.filter(
            (check) =>
              check.status ===
              "FAIL"
          ).length,
      }),
      [checks]
    );

  const ready =
    !running &&
    checks.length >
      0 &&
    counts.fail ===
      0;

  return (
    <div className="preflight-page">
      <div className="preflight-topbar">
        <button
          onClick={
            onBack
          }
        >
          ← Back to Auction Board
        </button>

        <div>
          ADMIN • PRE-AUCTION
        </div>
      </div>

      <main className="preflight-content">
        <section
          className={`preflight-hero ${
            ready
              ? "ready"
              : counts.fail >
                0
              ? "blocked"
              : ""
          }`}
        >
          <div>
            <p>
              PRE-AUCTION VALIDATION
            </p>

            <h1>
              Health Check
            </h1>

            <span>
              Validate the complete auction environment before going live.
            </span>
          </div>

          <div className="preflight-verdict">
            <span>
              STATUS
            </span>

            <strong>
              {running
                ? "CHECKING"
                : ready
                ? counts.warn >
                  0
                  ? "READY WITH WARNINGS"
                  : "READY"
                : "ISSUES FOUND"}
            </strong>

            {lastChecked && (
              <small>
                Last checked{" "}
                {
                  lastChecked.toLocaleTimeString()
                }
              </small>
            )}
          </div>
        </section>

        <section className="preflight-summary">
          <div className="pass">
            <span>
              PASSED
            </span>

            <strong>
              {
                counts.pass
              }
            </strong>
          </div>

          <div className="warn">
            <span>
              WARNINGS
            </span>

            <strong>
              {
                counts.warn
              }
            </strong>
          </div>

          <div className="fail">
            <span>
              FAILURES
            </span>

            <strong>
              {
                counts.fail
              }
            </strong>
          </div>

          <button
            disabled={
              running
            }
            onClick={() =>
              void runChecks()
            }
          >
            {running
              ? "CHECKING..."
              : "RUN CHECKS AGAIN"}
          </button>
        </section>

        <section className="preflight-card">
          <div className="preflight-heading">
            <div>
              <p>
                SYSTEM VALIDATION
              </p>

              <h2>
                Readiness Checklist
              </h2>
            </div>

            <strong>
              {
                checks.length
              }{" "}
              CHECKS
            </strong>
          </div>

          <div className="preflight-list">
            {checks.map(
              (check) => (
                <article
                  className={`preflight-row ${check.status.toLowerCase()}`}
                  key={
                    check.id
                  }
                >
                  <div className="preflight-status">
                    {check.status ===
                    "PASS"
                      ? "✓"
                      : check.status ===
                        "WARN"
                      ? "!"
                      : check.status ===
                        "FAIL"
                      ? "×"
                      : "…"}
                  </div>

                  <div>
                    <strong>
                      {
                        check.title
                      }
                    </strong>

                    <span>
                      {
                        check.detail
                      }
                    </span>
                  </div>

                  <div className="preflight-label">
                    {
                      check.status
                    }
                  </div>
                </article>
              )
            )}
          </div>
        </section>

        <section className="preflight-note">
          <strong>
            Readiness rule:
          </strong>{" "}
          FAIL items must be corrected before the live auction. WARN items are advisory and do not block the auction.
        </section>
      </main>
    </div>
  );
}

export default PreAuctionHealth;
