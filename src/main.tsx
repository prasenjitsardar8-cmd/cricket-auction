import {
  StrictMode,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  createRoot,
} from "react-dom/client";

import "./index.css";

import App from "./App.tsx";
import PublicDisplay from "./PublicDisplay.tsx";
import Login from "./Login.tsx";
import OwnerDashboard from "./OwnerDashboard.tsx";
import FixturesAdmin from "./FixturesAdmin.tsx";
import FixturesDisplay from "./FixturesDisplay.tsx";
import DirectAssignmentAdmin from "./DirectAssignmentAdmin.tsx";
import AuctionActivationControl from "./AuctionActivationControl.tsx";

import {
  supabase,
  supabasePortal,
} from "./supabase";

import {
  getCurrentProfile,
  signOut,
  type UserProfile,
} from "./auth";

function RootApp() {
  const mode =
    supabasePortal;

  const path =
    window.location.pathname
      .replace(/\/+$/, "")
      .toLowerCase();

  const queryMode =
    new URLSearchParams(
      window.location.search
    ).get("mode");

  const isFixturesAdmin =
    path === "/fixtures/admin" ||
    queryMode === "fixtures-admin";

  const isDirectAssignmentAdmin =
    path === "/admin/direct-assignment";

  const isFixturesDisplay =
    path === "/fixtures/display" ||
    queryMode === "fixtures-display";

  const isAuctionDisplay =
    path === "/display" ||
    (
      (path === "" || path === "/") &&
      queryMode === "display"
    );

  const isPublicDisplay =
    isAuctionDisplay ||
    isFixturesDisplay;

  const [profile, setProfile] =
    useState<UserProfile | null>(
      null
    );

  const [authLoading, setAuthLoading] =
    useState(
      !isPublicDisplay
    );

  const [authError, setAuthError] =
    useState("");

  const loadProfile =
    useCallback(
      async () => {
        try {
          setAuthLoading(true);
          setAuthError("");

          const currentProfile =
            await getCurrentProfile();

          setProfile(
            currentProfile
          );
        } catch (error) {
          console.error(error);

          setProfile(null);

          setAuthError(
            error instanceof Error
              ? error.message
              : "Unable to load account."
          );
        } finally {
          setAuthLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    if (isPublicDisplay) {
      return;
    }

    void loadProfile();

    const { data } =
      supabase.auth.onAuthStateChange(
        (event, session) => {
          if (
            event === "SIGNED_OUT"
          ) {
            setProfile(null);
            setAuthLoading(false);
            return;
          }

          if (
            session &&
            (
              event === "SIGNED_IN" ||
              event === "INITIAL_SESSION" ||
              event === "USER_UPDATED" ||
              event === "TOKEN_REFRESHED"
            )
          ) {
            window.setTimeout(
              () => {
                void loadProfile();
              },
              0
            );
          }
        }
      );

    return () => {
      data.subscription.unsubscribe();
    };
  }, [
    isPublicDisplay,
    loadProfile,
  ]);

  /* =====================================================
     PUBLIC SCREENS
  ===================================================== */

  if (isFixturesDisplay) {
    return (
      <FixturesDisplay />
    );
  }

  if (isAuctionDisplay) {
    return (
      <PublicDisplay />
    );
  }

  /* =====================================================
     AUTH
  ===================================================== */

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background:
            "radial-gradient(circle at top, #172554, #03050a)",
          color: "white",
          fontFamily:
            "Inter, Arial, sans-serif",
          textAlign: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "50px",
            }}
          >
            🏏
          </div>

          <h2>
            Loading Cricket Portal
          </h2>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <>
        {authError && (
          <div
            style={{
              position: "fixed",
              top: "12px",
              left: "50%",
              transform:
                "translateX(-50%)",
              zIndex: 999,
              padding: "9px 14px",
              border:
                "1px solid rgba(239,68,68,.35)",
              borderRadius: "8px",
              background: "#291016",
              color: "#ff8d8d",
              fontSize: "11px",
            }}
          >
            {authError}
          </div>
        )}

        <Login
          onLoggedIn={
            loadProfile
          }
        />
      </>
    );
  }

  /* =====================================================
     ROLE GUARDS
  ===================================================== */

  if (
    (mode === "admin" ||
      isFixturesAdmin) &&
    profile.role !== "admin"
  ) {
    return (
      <AccessDenied
        requestedPortal="ADMIN"
        actualRole={
          profile.role
        }
      />
    );
  }

  if (
    mode === "owner" &&
    profile.role !== "owner"
  ) {
    return (
      <AccessDenied
        requestedPortal="OWNER"
        actualRole={
          profile.role
        }
      />
    );
  }

  /* =====================================================
     OWNER
  ===================================================== */

  if (
    profile.role === "owner"
  ) {
    return (
      <OwnerDashboard
        profile={profile}
      />
    );
  }

  /* =====================================================
     DIRECT PLAYER ASSIGNMENT
  ===================================================== */

  if (
    profile.role === "admin" &&
    isDirectAssignmentAdmin
  ) {
    return (
      <div>
        <PortalToolbar
          profileName={profile.fullName}
          projectorHref="/display"
          adminHref="/admin"
          adminLabel="AUCTION ADMIN"
        />

        <DirectAssignmentAdmin />
      </div>
    );
  }

  /* =====================================================
     FIXTURES ADMIN
  ===================================================== */

  if (
    profile.role === "admin" &&
    isFixturesAdmin
  ) {
    return (
      <div>
        <PortalToolbar
          profileName={
            profile.fullName
          }
          projectorHref="/fixtures/display"
          adminHref="/admin"
          adminLabel="AUCTION ADMIN"
        />

        <FixturesAdmin />
      </div>
    );
  }

  /* =====================================================
     AUCTION ADMIN
  ===================================================== */

  if (
    profile.role === "admin"
  ) {
    return (
      <div>
        <PortalToolbar
          profileName={
            profile.fullName
          }
          projectorHref="/display"
          adminHref="/fixtures/admin"
          adminLabel="MATCH DAY"
          showAuctionToggle
          showDirectAssignment
        />

        <App />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#03050a",
        color: "white",
      }}
    >
      Invalid account role.
    </div>
  );
}

type PortalToolbarProps = {
  profileName: string;
  projectorHref: string;
  adminHref: string;
  adminLabel: string;
  showAuctionToggle?: boolean;
  showDirectAssignment?: boolean;
};

function PortalToolbar({
  profileName,
  projectorHref,
  adminHref,
  adminLabel,
  showAuctionToggle = false,
  showDirectAssignment = false,
}: PortalToolbarProps) {
  return (
    <div
      style={{
        position: "fixed",
        top: "12px",
        right: "14px",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        flexWrap: "wrap",
        gap: "8px",
        maxWidth: "calc(100vw - 28px)",
      }}
    >
      {showAuctionToggle && (
        <AuctionActivationControl />
      )}

      <div
        style={{
          padding: "7px 10px",
          border:
            "1px solid #27364f",
          borderRadius: "8px",
          background: "#08101e",
          color: "#8995aa",
          fontSize: "9px",
        }}
      >
        ADMIN • {profileName}
      </div>

      <a
        href={adminHref}
        style={{
          padding: "8px 11px",
          border:
            "1px solid #3b4b66",
          borderRadius: "8px",
          background: "#08101e",
          color: "#a6b4ca",
          textDecoration: "none",
          fontSize: "9px",
          fontWeight: 900,
        }}
      >
        {adminLabel}
      </a>

      {showDirectAssignment && (
        <a
          href="/admin/direct-assignment"
          style={{
            padding: "8px 11px",
            border: "1px solid rgba(244,201,93,.42)",
            borderRadius: "8px",
            background: "#08101e",
            color: "#f7c948",
            textDecoration: "none",
            fontSize: "9px",
            fontWeight: 900,
          }}
        >
          DIRECT ASSIGN
        </a>
      )}

      <a
        href={projectorHref}
        target="_blank"
        rel="noreferrer"
        style={{
          padding: "8px 11px",
          border:
            "1px solid #3b4b66",
          borderRadius: "8px",
          background: "#08101e",
          color: "#a6b4ca",
          textDecoration: "none",
          fontSize: "9px",
          fontWeight: 900,
        }}
      >
        PROJECTOR
      </a>

      <button
        onClick={() =>
          void signOut()
        }
        style={{
          padding: "8px 11px",
          border:
            "1px solid #f7c948",
          borderRadius: "8px",
          background: "#08101e",
          color: "#f7c948",
          cursor: "pointer",
          fontSize: "9px",
          fontWeight: 900,
        }}
      >
        SIGN OUT
      </button>
    </div>
  );
}

type AccessDeniedProps = {
  requestedPortal:
    "ADMIN" | "OWNER";
  actualRole: string;
};

function AccessDenied({
  requestedPortal,
  actualRole,
}: AccessDeniedProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background:
          "radial-gradient(circle at top, #2a1015, #03050a)",
        color: "white",
        fontFamily:
          "Inter, Arial, sans-serif",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width:
            "min(520px, 94vw)",
          padding: "30px",
          border:
            "1px solid rgba(248,113,113,.28)",
          borderRadius: "18px",
          background:
            "rgba(15,23,42,.78)",
        }}
      >
        <div
          style={{
            color: "#fca5a5",
            fontSize: "12px",
            fontWeight: 900,
            letterSpacing: ".14em",
          }}
        >
          ACCESS DENIED
        </div>

        <h1>
          {requestedPortal} PORTAL
        </h1>

        <p
          style={{
            color: "#94a3b8",
          }}
        >
          This account is signed in as{" "}
          <strong
            style={{
              color: "#f8fafc",
            }}
          >
            {actualRole.toUpperCase()}
          </strong>
          .
        </p>

        <button
          onClick={() =>
            void signOut()
          }
          style={{
            marginTop: "12px",
            padding: "10px 16px",
            border:
              "1px solid #f7c948",
            borderRadius: "9px",
            background: "#08101e",
            color: "#f7c948",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          SIGN OUT
        </button>
      </div>
    </div>
  );
}

createRoot(
  document.getElementById(
    "root"
  )!
).render(
  <StrictMode>
    <RootApp />
  </StrictMode>
);

