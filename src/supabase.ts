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

const pathPortal: SupabasePortal =
  path === "/admin"
    ? "admin"
    : path === "/owner"
    ? "owner"
    : path === "/display"
    ? "display"
    : "default";

export const supabasePortal: SupabasePortal =
  pathPortal !== "default"
    ? pathPortal
    : requestedMode === "admin"
    ? "admin"
    : requestedMode === "owner"
    ? "owner"
    : requestedMode === "display"
    ? "display"
    : "default";

const storageKey =
  `cricket-auction-auth-${supabasePortal}`;

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      storageKey,
      persistSession: supabasePortal !== "display",
      autoRefreshToken: supabasePortal !== "display",
      detectSessionInUrl: supabasePortal !== "display",
    },
  }
);
