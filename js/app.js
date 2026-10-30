import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { auth } from "./firebase-config.js";
import {
  ensureUserProfile,
  friendlyAuthError,
  loginWithUsername,
  logout
} from "./auth.js";

const loginView = document.querySelector("#loginView");
const appView = document.querySelector("#appView");
const loginForm = document.querySelector("#loginForm");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const loginButton = document.querySelector("#loginButton");
const loginMessage = document.querySelector("#loginMessage");
const togglePassword = document.querySelector("#togglePassword");
const logoutButton = document.querySelector("#logoutButton");
const displayName = document.querySelector("#displayName");
const displayRole = document.querySelector("#displayRole");
const accessSummary = document.querySelector("#accessSummary");

function setBusy(isBusy) {
  loginButton.disabled = isBusy;
  loginButton.textContent = isBusy ? "Signing in..." : "Login";
}

function showLogin() {
  loginView.classList.remove("hidden");
  appView.classList.add("hidden");
}

function showApp(profile) {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");

  displayName.textContent = profile.displayName || profile.username || "User";
  displayRole.textContent = profile.roleLabel || profile.role || "User";

  const sites = Array.isArray(profile.siteAccess) ? profile.siteAccess.join(", ") : profile.primarySite || "Assigned site";
  accessSummary.textContent = `${profile.department || "Department"} • Site access: ${sites}`;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  setBusy(true);

  try {
    const { profile } = await loginWithUsername(usernameInput.value, passwordInput.value);
    passwordInput.value = "";
    showApp(profile);
  } catch (error) {
    loginMessage.textContent = friendlyAuthError(error);
  } finally {
    setBusy(false);
  }
});

togglePassword.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  togglePassword.textContent = show ? "Hide" : "Show";
});

logoutButton.addEventListener("click", async () => {
  await logout();
  usernameInput.value = "";
  passwordInput.value = "";
  loginMessage.textContent = "";
  showLogin();
  usernameInput.focus();
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLogin();
    return;
  }

  try {
    const profile = await ensureUserProfile(user);

    if (profile.active !== true) {
      await logout();
      showLogin();
      return;
    }

    showApp(profile);
  } catch (error) {
    console.error(error);
    await logout();
    loginMessage.textContent = friendlyAuthError(error);
    showLogin();
  }
});
