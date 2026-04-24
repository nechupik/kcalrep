const PROFILE_KEY = "kbju.profile";

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl?: string;
}

export function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { name: "Гость", email: "" };
}

export function saveProfile(p: UserProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}
