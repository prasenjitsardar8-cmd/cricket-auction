import {
  createClient,
} from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL;

const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Missing VITE_SUPABASE_URL in .env.local"
  );
}

if (!supabasePublishableKey) {
  throw new Error(
    "Missing VITE_SUPABASE_PUBLISHABLE_KEY in .env.local"
  );
}

/* =====================================================
   PORTAL-SPECIFIC AUTH STORAGE

   This is what allows:
   ?mode=admin
   ?mode=owner

   to stay logged in as different users
   inside the same browser profile.

   The projector does not need a persisted
   authenticated session.
===================================================== */

const params =
  new URLSearchParams(
    window.location.search
  );

const requestedMode =
  params.get("mode");

type SupabasePortal =
  | "admin"
  | "owner"
  | "display"
  | "default";

const portal:
  SupabasePortal =
    requestedMode ===
      "admin"
      ? "admin"
      : requestedMode ===
        "owner"
      ? "owner"
      : requestedMode ===
        "display"
      ? "display"
      : "default";

const storageKey =
  `cricket-auction-auth-${portal}`;

export const supabase =
  createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {
        storageKey,

        persistSession:
          portal !==
          "display",

        autoRefreshToken:
          portal !==
          "display",

        detectSessionInUrl:
          portal !==
          "display",
      },
    }
  );

export const supabasePortal =
  portal;
