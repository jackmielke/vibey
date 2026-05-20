type ProfileCandidate = {
  auth_user_id?: string | null;
  email?: string | null;
  telegram_user_id?: number | null;
  telegram_username?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  telegram_photo_url?: string | null;
  profile_picture_url?: string | null;
  headline?: string | null;
  bio?: string | null;
  created_at?: string | null;
};

function profileScore(row: ProfileCandidate) {
  return (
    (row.auth_user_id ? 64 : 0) +
    (row.telegram_user_id != null ? 32 : 0) +
    (row.telegram_username || row.username ? 16 : 0) +
    (row.avatar_url || row.telegram_photo_url || row.profile_picture_url ? 8 : 0) +
    (row.email && !row.email.endsWith("@vibey.telegram") ? 4 : 0) +
    (row.headline ? 2 : 0) +
    (row.bio ? 1 : 0)
  );
}

export function pickBestProfile<T extends ProfileCandidate>(rows: T[] | null | undefined): T | null {
  if (!rows?.length) return null;
  return [...rows].sort((a, b) => {
    const byScore = profileScore(b) - profileScore(a);
    if (byScore !== 0) return byScore;
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  })[0];
}
