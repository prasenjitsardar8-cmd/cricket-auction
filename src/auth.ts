import {
  supabase,
  supabasePortal,
} from "./supabase";

export type UserRole =
  | "admin"
  | "owner";

export type UserProfile = {
  id: string;

  email: string;

  fullName: string;

  role: UserRole;

  teamId: number | null;
};

/* =====================================================
   SIGN IN
===================================================== */

export async function signIn(
  email: string,
  password: string
) {
  const {
    data,
    error,
  } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {
    throw error;
  }

  return data;
}

/* =====================================================
   SIGN OUT
===================================================== */

export async function signOut() {
  const {
    error,
  } =
    await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

/* =====================================================
   GET CURRENT PROFILE
===================================================== */

export async function getCurrentProfile(): Promise<
  UserProfile | null
> {
  const {
    data: userData,
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError) {
    return null;
  }

  const user =
    userData.user;

  if (!user) {
    return null;
  }

  const {
    data: profileData,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        role,
        team_id
      `)
      .eq(
        "id",
        user.id
      )
      .single();

  if (profileError) {
    throw new Error(
      `Unable to load account profile: ${profileError.message}`
    );
  }

  const role =
    profileData.role as
      UserRole;

  /*
    Optional early portal-role validation.

    This gives a cleaner login error before
    the main route guard renders.
  */

  if (
    supabasePortal ===
      "admin" &&
    role !==
      "admin"
  ) {
    await supabase.auth.signOut();

    throw new Error(
      "This account is not authorized for the Admin portal."
    );
  }

  if (
    supabasePortal ===
      "owner" &&
    role !==
      "owner"
  ) {
    await supabase.auth.signOut();

    throw new Error(
      "This account is not authorized for the Owner portal."
    );
  }

  return {
    id:
      profileData.id,

    email:
      user.email ??
      "",

    fullName:
      profileData.full_name ??
      "",

    role,

    teamId:
      profileData.team_id ===
      null
        ? null
        : Number(
            profileData.team_id
          ),
  };
}
