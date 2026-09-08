import { supabase } from "./supabase";

const BUCKET_NAME = "auction-assets";

/* =====================================================
   HELPERS
===================================================== */

function sanitizeFileName(
  fileName: string
) {
  return fileName
    .toLowerCase()
    .replace(
      /[^a-z0-9._-]+/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    );
}

function getExtension(
  file: File
) {
  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase();

  if (extension) {
    return extension;
  }

  if (
    file.type ===
    "image/png"
  ) {
    return "png";
  }

  if (
    file.type ===
    "image/webp"
  ) {
    return "webp";
  }

  return "jpg";
}

function getPublicUrl(
  path: string
) {
  const {
    data,
  } =
    supabase.storage
      .from(
        BUCKET_NAME
      )
      .getPublicUrl(
        path
      );

  return data.publicUrl;
}

/* =====================================================
   TEAM LOGO
===================================================== */

export async function uploadTeamLogo(
  teamId: number,
  file: File
) {
  const extension =
    getExtension(
      file
    );

  const fileName =
    sanitizeFileName(
      `team-${teamId}.${extension}`
    );

  const path =
    `teams/${fileName}`;

  const {
    error,
  } =
    await supabase.storage
      .from(
        BUCKET_NAME
      )
      .upload(
        path,
        file,
        {
          upsert:
            true,

          cacheControl:
            "3600",

          contentType:
            file.type ||
            undefined,
        }
      );

  if (error) {
    throw error;
  }

  return {
    path,
    publicUrl:
      getPublicUrl(path),
  };
}

/* =====================================================
   PLAYER PHOTO
===================================================== */

export async function uploadPlayerPhoto(
  playerId: number,
  file: File
) {
  const extension =
    getExtension(
      file
    );

  const fileName =
    sanitizeFileName(
      `player-${playerId}.${extension}`
    );

  const path =
    `players/${fileName}`;

  const {
    error,
  } =
    await supabase.storage
      .from(
        BUCKET_NAME
      )
      .upload(
        path,
        file,
        {
          upsert:
            true,

          cacheControl:
            "3600",

          contentType:
            file.type ||
            undefined,
        }
      );

  if (error) {
    throw error;
  }

  return {
    path,
    publicUrl:
      getPublicUrl(path),
  };
}

/* =====================================================
   DELETE FILE
===================================================== */

export async function deleteStorageFile(
  path: string
) {
  const {
    error,
  } =
    await supabase.storage
      .from(
        BUCKET_NAME
      )
      .remove([
        path,
      ]);

  if (error) {
    throw error;
  }
}