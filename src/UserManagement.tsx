import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import "./UserManagement.css";

import {
  supabase,
} from "./supabase";

import type {
  Team,
} from "./types";

type UserRole =
  | "admin"
  | "owner";

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: UserRole;
  team_id: number | null;
};

type EditableProfile = {
  id: string;
  fullName: string;
  role: UserRole;
  teamId: number | null;
};

type UserManagementProps = {
  teams: Team[];
  onBack: () => void;
};

function UserManagement({
  teams,
  onBack,
}: UserManagementProps) {
  const [
    profiles,
    setProfiles,
  ] =
    useState<EditableProfile[]>(
      []
    );

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    savingId,
    setSavingId,
  ] =
    useState<string | null>(
      null
    );

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

  const [
    searchText,
    setSearchText,
  ] =
    useState("");

  /* =====================================================
     LOAD USERS
  ===================================================== */

  const loadProfiles =
    useCallback(
      async () => {
        try {
          setLoading(
            true
          );

          setErrorMessage(
            ""
          );

          const {
            data: userData,
          } =
            await supabase.auth.getUser();

          setCurrentUserId(
            userData.user?.id ??
              ""
          );

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
              `)
              .order(
                "full_name",
                {
                  ascending:
                    true,
                }
              );

          if (error) {
            throw error;
          }

          const rows =
            (data ??
              []) as ProfileRow[];

          setProfiles(
            rows.map(
              (
                row
              ) => ({
                id:
                  row.id,

                fullName:
                  row.full_name ??
                  "",

                role:
                  row.role,

                teamId:
                  row.team_id ===
                  null
                    ? null
                    : Number(
                        row.team_id
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
              : "Unable to load users."
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
    void loadProfiles();
  }, [loadProfiles]);

  /* =====================================================
     REALTIME PROFILE REFRESH
  ===================================================== */

  useEffect(() => {
    const channel =
      supabase
        .channel(
          "admin-user-management"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "profiles",
          },
          () => {
            void loadProfiles();
          }
        )
        .subscribe();

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [loadProfiles]);

  /* =====================================================
     HELPERS
  ===================================================== */

  const updateDraft =
    (
      id: string,
      patch:
        Partial<EditableProfile>
    ) => {
      setProfiles(
        (
          current
        ) =>
          current.map(
            (
              profile
            ) =>
              profile.id ===
              id
                ? {
                    ...profile,
                    ...patch,
                  }
                : profile
          )
      );

      setMessage(
        ""
      );

      setErrorMessage(
        ""
      );
    };

  const getTeamName =
    (
      teamId:
        number | null
    ) =>
      teams.find(
        (
          team
        ) =>
          team.id ===
          teamId
      )?.name ??
      "Unassigned";

  const getDuplicateOwner =
    (
      profileId: string,
      teamId:
        number | null
    ) => {
      if (
        teamId ===
        null
      ) {
        return null;
      }

      return (
        profiles.find(
          (
            profile
          ) =>
            profile.id !==
              profileId &&
            profile.role ===
              "owner" &&
            profile.teamId ===
              teamId
        ) ??
        null
      );
    };

  const saveProfile =
    async (
      profile:
        EditableProfile
    ) => {
      try {
        setMessage(
          ""
        );

        setErrorMessage(
          ""
        );

        if (
          !profile.fullName
            .trim()
        ) {
          setErrorMessage(
            "Full name is required."
          );

          return;
        }

        if (
          profile.role ===
            "owner" &&
          profile.teamId ===
            null
        ) {
          setErrorMessage(
            `${profile.fullName} must be assigned to a team before saving as an Owner.`
          );

          return;
        }

        if (
          profile.id ===
            currentUserId &&
          profile.role !==
            "admin"
        ) {
          setErrorMessage(
            "You cannot remove your own Admin role while signed in."
          );

          return;
        }

        if (
          profile.role ===
          "owner"
        ) {
          const duplicateOwner =
            getDuplicateOwner(
              profile.id,
              profile.teamId
            );

          if (
            duplicateOwner
          ) {
            setErrorMessage(
              `${getTeamName(
                profile.teamId
              )} is already assigned to ${duplicateOwner.fullName}.`
            );

            return;
          }
        }

        setSavingId(
          profile.id
        );

        const {
          error,
        } =
          await supabase
            .from(
              "profiles"
            )
            .update({
              full_name:
                profile.fullName
                  .trim(),

              team_id:
                profile.role ===
                "owner"
                  ? profile.teamId
                  : null,
            })
            .eq(
              "id",
              profile.id
            );

        if (error) {
          throw error;
        }

        setMessage(
          `${profile.fullName} updated successfully.`
        );

        await loadProfiles();
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
              : "Unable to update user."
        );
      } finally {
        setSavingId(
          null
        );
      }
    };

  /* =====================================================
     FILTERED USERS
  ===================================================== */

  const filteredProfiles =
    useMemo(
      () => {
        const query =
          searchText
            .trim()
            .toLowerCase();

        if (!query) {
          return profiles;
        }

        return profiles.filter(
          (
            profile
          ) =>
            profile.fullName
              .toLowerCase()
              .includes(
                query
              ) ||
            profile.role
              .toLowerCase()
              .includes(
                query
              ) ||
            getTeamName(
              profile.teamId
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            profile.id
              .toLowerCase()
              .includes(
                query
              )
        );
      },
      [
        profiles,
        searchText,
        teams,
      ]
    );

  const adminCount =
    profiles.filter(
      (
        profile
      ) =>
        profile.role ===
        "admin"
    ).length;

  const ownerCount =
    profiles.filter(
      (
        profile
      ) =>
        profile.role ===
        "owner"
    ).length;

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div className="user-management-page">
        <div className="user-management-loading">
          <div>
            👥
          </div>

          <h2>
            Loading Users
          </h2>
        </div>
      </div>
    );
  }

  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <div className="user-management-page">
      <div className="user-management-topbar">
        <button
          className="user-management-back"
          onClick={
            onBack
          }
        >
          ← Back to Auction Board
        </button>

        <div className="user-management-admin-badge">
          ADMIN ONLY
        </div>
      </div>

      <main className="user-management-content">
        <section className="user-management-hero">
          <div>
            <p>
              ACCESS CONTROL
            </p>

            <h1>
              USER MANAGEMENT
            </h1>

            <span>
              Assign roles and franchise access to existing auction accounts.
            </span>
          </div>

          <div className="user-management-summary">
            <div>
              <span>
                TOTAL USERS
              </span>

              <strong>
                {
                  profiles.length
                }
              </strong>
            </div>

            <div>
              <span>
                ADMINS
              </span>

              <strong>
                {
                  adminCount
                }
              </strong>
            </div>

            <div>
              <span>
                OWNERS
              </span>

              <strong>
                {
                  ownerCount
                }
              </strong>
            </div>
          </div>
        </section>

        <section className="user-management-card">
          <div className="user-management-toolbar">
            <div>
              <p>
                ACCOUNT ACCESS
              </p>

              <h2>
                Existing Users
              </h2>
            </div>

            <input
              type="search"
              value={
                searchText
              }
              onChange={(
                event
              ) =>
                setSearchText(
                  event.target
                    .value
                )
              }
              placeholder="Search user, role, team..."
            />
          </div>

          {errorMessage && (
            <div className="user-management-message error">
              {
                errorMessage
              }
            </div>
          )}

          {message && (
            <div className="user-management-message success">
              {
                message
              }
            </div>
          )}

          <div className="user-management-note">
            <strong>
              Existing accounts only.
            </strong>{" "}
            Roles are intentionally locked on this screen. Owner accounts cannot be promoted to Admin from the web application. Team assignment can still be changed for Owner accounts.
          </div>

          <div className="user-management-list">
            {filteredProfiles.map(
              (
                profile
              ) => {
                const isCurrentUser =
                  profile.id ===
                  currentUserId;

                const duplicateOwner =
                  profile.role ===
                  "owner"
                    ? getDuplicateOwner(
                        profile.id,
                        profile.teamId
                      )
                    : null;

                return (
                  <article
                    className="user-management-row"
                    key={
                      profile.id
                    }
                  >
                    <div className="user-management-user">
                      <div className="user-management-avatar">
                        {profile.fullName
                          .split(" ")
                          .filter(
                            Boolean
                          )
                          .map(
                            (
                              word
                            ) =>
                              word[0]
                          )
                          .join("")
                          .slice(
                            0,
                            2
                          )
                          .toUpperCase() ||
                          "U"}
                      </div>

                      <div>
                        <strong>
                          {profile.fullName ||
                            "Unnamed User"}
                        </strong>

                        <span>
                          {profile.id.slice(
                            0,
                            8
                          )}
                          …
                          {isCurrentUser &&
                            " • YOU"}
                        </span>
                      </div>
                    </div>

                    <div className="user-management-fields">
                      <div>
                        <label>
                          FULL NAME
                        </label>

                        <input
                          value={
                            profile.fullName
                          }
                          onChange={(
                            event
                          ) =>
                            updateDraft(
                              profile.id,
                              {
                                fullName:
                                  event.target
                                    .value,
                              }
                            )
                          }
                        />
                      </div>

                      <div>
                        <label>
                          ROLE
                        </label>

                        <div
                          className={`user-management-role-lock ${
                            profile.role
                          }`}
                        >
                          {profile.role ===
                          "admin"
                            ? "ADMIN"
                            : "OWNER"}
                        </div>
                      </div>

                      <div>
                        <label>
                          TEAM
                        </label>

                        <select
                          value={
                            profile.teamId ??
                            ""
                          }
                          disabled={
                            profile.role ===
                            "admin"
                          }
                          onChange={(
                            event
                          ) =>
                            updateDraft(
                              profile.id,
                              {
                                teamId:
                                  event.target
                                    .value
                                    ? Number(
                                        event
                                          .target
                                          .value
                                      )
                                    : null,
                              }
                            )
                          }
                        >
                          <option value="">
                            SELECT TEAM
                          </option>

                          {teams.map(
                            (
                              team
                            ) => {
                              const assignedOwner =
                                getDuplicateOwner(
                                  profile.id,
                                  team.id
                                );

                              return (
                                <option
                                  key={
                                    team.id
                                  }
                                  value={
                                    team.id
                                  }
                                  disabled={
                                    Boolean(
                                      assignedOwner
                                    )
                                  }
                                >
                                  {team.name}
                                  {assignedOwner
                                    ? ` • ${assignedOwner.fullName}`
                                    : ""}
                                </option>
                              );
                            }
                          )}
                        </select>
                      </div>

                      <button
                        className="user-management-save"
                        disabled={
                          savingId ===
                          profile.id
                        }
                        onClick={() =>
                          void saveProfile(
                            profile
                          )
                        }
                      >
                        {savingId ===
                        profile.id
                          ? "SAVING..."
                          : "SAVE"}
                      </button>
                    </div>

                    <div className="user-management-current-access">
                      <span>
                        ACCESS
                      </span>

                      <strong>
                        {profile.role ===
                        "admin"
                          ? "FULL ADMIN"
                          : getTeamName(
                              profile.teamId
                            )}
                      </strong>

                      {duplicateOwner && (
                        <small>
                          Duplicate team assignment detected
                        </small>
                      )}
                    </div>
                  </article>
                );
              }
            )}
          </div>

          {filteredProfiles.length ===
            0 && (
            <div className="user-management-empty">
              No matching users found.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default UserManagement;
