import {
  useMemo,
  useState,
} from "react";

import "./Login.css";

import {
  signIn,
} from "./auth";

import {
  supabasePortal,
} from "./supabase";

type LoginProps = {
  onLoggedIn: () => Promise<void>;
};

function Login({
  onLoggedIn,
}: LoginProps) {
  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const portalLabel =
    useMemo(() => {
      if (supabasePortal === "admin") {
        return "ADMIN PORTAL";
      }

      if (supabasePortal === "owner") {
        return "TEAM OWNER PORTAL";
      }

      return "AUCTION PORTAL";
    }, []);

  const description =
    supabasePortal === "admin"
      ? "Sign in with an authorized administrator account."
      : supabasePortal === "owner"
      ? "Sign in with the account assigned to your franchise."
      : "Sign in to continue to the Auction Administration or Team Owner portal.";

  const handleLogin =
    async () => {
      const cleanEmail =
        email.trim();

      if (!cleanEmail || !password) {
        setErrorMessage(
          "Please enter your email and password."
        );
        return;
      }

      try {
        setLoading(true);
        setErrorMessage("");

        await signIn(
          cleanEmail,
          password
        );

        await onLoggedIn();
      } catch (error) {
        console.error(error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to sign in."
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-cricket-icon">
            🏏
          </div>

          <div>
            <p className="login-kicker">
              LIVE CRICKET AUCTION
            </p>

            <h1>
              AUCTION ARENA
            </h1>
          </div>
        </div>

        <div
          style={{
            marginBottom: "12px",
            color: "#f7c948",
            fontSize: "11px",
            fontWeight: 900,
            letterSpacing: ".12em",
          }}
        >
          {portalLabel}
        </div>

        <p className="login-description">
          {description}
        </p>

        <div className="login-form">
          <div>
            <label>
              EMAIL ADDRESS
            </label>

            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label>
              PASSWORD
            </label>

            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleLogin();
                }
              }}
              placeholder="Enter password"
            />
          </div>

          {errorMessage && (
            <div className="login-error">
              {errorMessage}
            </div>
          )}

          <button
            className="login-button"
            disabled={loading}
            onClick={() =>
              void handleLogin()
            }
          >
            {loading
              ? "SIGNING IN..."
              : "SIGN IN"}
          </button>
        </div>

        <div className="login-divider">
          <span />
          <p>PUBLIC DISPLAY</p>
          <span />
        </div>

        <a
          className="public-display-link"
          href="/display"
          target="_blank"
          rel="noreferrer"
        >
          OPEN PROJECTOR DISPLAY →
        </a>

        <p className="login-security-note">
          Auction controls are restricted
          to authorized administrator accounts.
        </p>
      </div>
    </div>
  );
}

export default Login;
