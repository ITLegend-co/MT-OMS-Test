import {
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

export const SYSTEM_ADMIN_UID = "Zy63U0hXZSddx7g8x2hahFtO1d63";
export const SYSTEM_ADMIN_USERNAME = "mtadmin";
const INTERNAL_AUTH_DOMAIN = "mt-oms.local";

export function normalizeUsername(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function isValidUsername(username) {
  return /^[a-z0-9][a-z0-9._-]{2,39}$/.test(username);
}

export function usernameToInternalEmail(username) {
  const normalized = normalizeUsername(username);
  if (!isValidUsername(normalized)) {
    throw new Error("INVALID_USERNAME");
  }
  return `${normalized}@${INTERNAL_AUTH_DOMAIN}`;
}

function defaultSystemAdminProfile() {
  return {
    username: SYSTEM_ADMIN_USERNAME,
    displayName: "System Administrator",
    role: "system_admin",
    roleLabel: "System Administrator",
    department: "System Administration",
    primarySite: "ALL",
    siteAccess: ["KK", "KP", "PH"],
    active: true,
    permissions: {
      users: ["view", "create", "edit", "disable", "reset_password"],
      inventory: ["view", "create", "edit", "verify", "replenish"],
      requests: ["view", "create", "approve", "manage"],
      transit: ["view", "create", "edit", "verify", "manage"],
      porter: ["view", "create", "edit", "verify", "manage"],
      billing: ["view", "verify", "manage"],
      reports: ["view_all", "export"],
      system: ["full_access"]
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

export async function ensureUserProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }

  if (user.uid !== SYSTEM_ADMIN_UID) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  const profile = defaultSystemAdminProfile();
  await setDoc(ref, profile);
  const saved = await getDoc(ref);
  return { id: saved.id, ...saved.data() };
}

export async function loginWithUsername(rawUsername, password) {
  const username = normalizeUsername(rawUsername);

  if (!isValidUsername(username)) {
    throw new Error("INVALID_USERNAME");
  }

  const internalEmail = usernameToInternalEmail(username);
  const credential = await signInWithEmailAndPassword(auth, internalEmail, password);
  const user = credential.user;

  if (username === SYSTEM_ADMIN_USERNAME && user.uid !== SYSTEM_ADMIN_UID) {
    await signOut(auth);
    throw new Error("ADMIN_UID_MISMATCH");
  }

  const profile = await ensureUserProfile(user);

  if (profile.active !== true) {
    await signOut(auth);
    throw new Error("ACCOUNT_DISABLED");
  }

  if (normalizeUsername(profile.username) !== username) {
    await signOut(auth);
    throw new Error("USERNAME_MISMATCH");
  }

  return { user, profile };
}

export async function logout() {
  await signOut(auth);
}

export function friendlyAuthError(error) {
  const code = error?.code || error?.message || "";

  const messages = {
    INVALID_USERNAME: "Enter a valid username using letters, numbers, dot, dash or underscore.",
    PROFILE_NOT_FOUND: "Your account profile has not been configured yet. Please contact the System Administrator.",
    ADMIN_UID_MISMATCH: "Administrator identity mismatch. Login was blocked.",
    ACCOUNT_DISABLED: "This account is disabled. Please contact the System Administrator.",
    USERNAME_MISMATCH: "The username does not match the assigned account profile.",
    "auth/invalid-credential": "Incorrect username or password.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/too-many-requests": "Too many login attempts. Please try again later.",
    "auth/network-request-failed": "Unable to reach Firebase. Check the internet connection."
  };

  return messages[code] || "Unable to sign in. Please check the username and password.";
}
