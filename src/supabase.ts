import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing VITE_SUPABASE_URL in .env.local");
}

if (!supabasePublishableKey) {
  throw new Error(
    "Missing VITE_SUPABASE_PUBLISHABLE_KEY in .env.local"
  );
}

const params = new URLSearchParams(window.location.search);
const requestedMode = params.get("mode");

const path = window.location.pathname
  .replace(/\/+$/, "")
  .toLowerCase();

export type SupabasePortal =
  | "admin"
  | "owner"
  | "display"
  | "default";

/*
  /fixtures/admin reuses the Admin auth session.
  /fixtures/display is public, like /display.
*/
const pathPortal: SupabasePortal =
  path === "/admin" ||
  path === "/fixtures/admin" ||
  path === "/admin/direct-assignment"
    ? "admin"
    : path === "/owner"
    ? "owner"
    : path === "/display" ||
      path === "/fixtures/display"
    ? "display"
    : "default";

export const supabasePortal: SupabasePortal =
  pathPortal !== "default"
    ? pathPortal
    : requestedMode === "admin"
    ? "admin"
    : requestedMode === "owner"
    ? "owner"
    : requestedMode === "display" ||
      requestedMode === "fixtures-display"
    ? "display"
    : requestedMode === "fixtures-admin"
    ? "admin"
    : "default";

/*
  Owner sessions remain isolated, so owner1-owner6
  can all stay logged in simultaneously even in the
  same browser profile.
*/
const rawSessionSlot =
  params.get("session") ??
  params.get("slot") ??
  "default";

const sessionSlot =
  rawSessionSlot
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40) ||
  "default";

export const supabaseSessionSlot =
  supabasePortal === "owner"
    ? sessionSlot
    : "default";

const storageKey =
  supabasePortal === "owner"
    ? `cricket-auction-auth-owner-${supabaseSessionSlot}`
    : `cricket-auction-auth-${supabasePortal}`;

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      storageKey,
      persistSession:
        supabasePortal !== "display",
      autoRefreshToken:
        supabasePortal !== "display",
      detectSessionInUrl:
        supabasePortal !== "display",
    },
  }
);
