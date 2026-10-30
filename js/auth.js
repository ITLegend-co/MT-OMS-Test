import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  initializeAuth,
  signInWithEmailAndPassword,
  signOut,
  updatePassword
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {
  deleteApp,
  getApp,
  getApps,
  initializeApp
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  get,
  ref,
  serverTimestamp,
  set
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";
import { auth, db, firebaseConfig } from "./firebase-config.js";

export const SYSTEM_ADMIN_UID = "Zy63U0hXZSddx7g8x2hahFtO1d63";
export const SYSTEM_ADMIN_USERNAME = "mtadmin";
const INTERNAL_AUTH_DOMAIN = "mt-oms.local";

export function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

export function isValidUsername(username) {
  return /^[a-z0-9][a-z0-9._-]{2,39}$/.test(username);
}

export function usernameToInternalEmail(username) {
  const normalized = normalizeUsername(username);
  if (!isValidUsername(normalized)) throw new Error("INVALID_USERNAME");
  return `${normalized}@${INTERNAL_AUTH_DOMAIN}`;
}

export function buildSystemAdminProfile() {
  return {
    username: SYSTEM_ADMIN_USERNAME,
    displayName: "System Administrator",
    role: "system_admin",
    roleLabel: "System Administrator",
    department: "System Administration",
    primarySite: "ALL",
    siteAccess: { KK: true, KP: true, PH: true },
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

export async function ensureUserProfile(user) {
  const userRef = ref(db, `users/${user.uid}`);
  const snap = await get(userRef);

  if (snap.exists()) return { uid: user.uid, ...snap.val() };

  if (user.uid !== SYSTEM_ADMIN_UID) throw new Error("PROFILE_NOT_FOUND");

  const profile = buildSystemAdminProfile();
  await set(userRef, profile);
  const saved = await get(userRef);
  return { uid: user.uid, ...saved.val() };
}

export async function loginWithUsername(rawUsername, password) {
  const username = normalizeUsername(rawUsername);
  if (!isValidUsername(username)) throw new Error("INVALID_USERNAME");

  const credential = await signInWithEmailAndPassword(
    auth,
    usernameToInternalEmail(username),
    password
  );

  if (username === SYSTEM_ADMIN_USERNAME && credential.user.uid !== SYSTEM_ADMIN_UID) {
    await signOut(auth);
    throw new Error("ADMIN_UID_MISMATCH");
  }

  const profile = await ensureUserProfile(credential.user);

  if (profile.active !== true) {
    await signOut(auth);
    throw new Error("ACCOUNT_DISABLED");
  }

  if (normalizeUsername(profile.username) !== username) {
    await signOut(auth);
    throw new Error("USERNAME_MISMATCH");
  }

  return { user: credential.user, profile };
}

export async function createStaffAuthUser(username, password) {
  const normalized = normalizeUsername(username);
  if (!isValidUsername(normalized)) throw new Error("INVALID_USERNAME");

  const secondaryName = "mtoms-user-creator";
  const old = getApps().find((a) => a.name === secondaryName);
  if (old) await deleteApp(old);

  const secondaryApp = initializeApp(firebaseConfig, secondaryName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      usernameToInternalEmail(normalized),
      password
    );
    const uid = credential.user.uid;
    await signOut(secondaryAuth);
    return uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}

export async function changeCurrentPassword(newPassword) {
  if (!auth.currentUser) throw new Error("NOT_AUTHENTICATED");
  await updatePassword(auth.currentUser, newPassword);
}

export async function logout() {
  await signOut(auth);
}

export function friendlyAuthError(error) {
  const code = error?.code || error?.message || "";
  const messages = {
    INVALID_USERNAME: "Enter a valid username using letters, numbers, dot, dash or underscore.",
    PROFILE_NOT_FOUND: "This login exists but its MT-OMS profile has not been configured.",
    ADMIN_UID_MISMATCH: "Administrator identity mismatch. Login was blocked.",
    ACCOUNT_DISABLED: "This account is disabled. Please contact the System Administrator.",
    USERNAME_MISMATCH: "The username does not match the assigned account profile.",
    NOT_AUTHENTICATED: "Please sign in again.",
    "auth/invalid-credential": "Incorrect username or password.",
    "auth/email-already-in-use": "That username is already in use.",
    "auth/weak-password": "Use a stronger password with at least 6 characters.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/requires-recent-login": "Please log out and sign in again before changing the password.",
    "auth/network-request-failed": "Unable to reach Firebase. Check the internet connection."
  };
  return messages[code] || error?.message || "Unable to complete the request.";
}
