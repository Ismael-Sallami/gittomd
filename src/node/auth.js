// Where the GitHub token comes from, in this order:
//   1. --token
//   2. GITHUB_TOKEN, GH_TOKEN or GITTOMD_TOKEN
//   3. a token saved by `gittomd login`
// And, only when a repo is not found and the user says it is private:
//   4. the GitHub CLI session (`gh auth token`)
//   5. browser login with the OAuth device flow
//   6. a token pasted by hand

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Client ID of the "gittomd" OAuth App (device flow enabled). It is public by
// design: the device flow does not use a client secret.
// GITTOMD_CLIENT_ID overrides it, which is handy for forks.
export const BUILTIN_CLIENT_ID = "";

export function clientId() {
  return process.env.GITTOMD_CLIENT_ID || BUILTIN_CLIENT_ID;
}

export function configDir() {
  if (process.platform === "win32" && process.env.APPDATA) return path.join(process.env.APPDATA, "gittomd");
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "gittomd");
}

export function tokenFile() {
  return path.join(configDir(), "token");
}

export function envToken() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITTOMD_TOKEN || "";
}

export function readSavedToken() {
  try {
    return fs.readFileSync(tokenFile(), "utf8").trim();
  } catch {
    return "";
  }
}

export function saveToken(token) {
  fs.mkdirSync(configDir(), { recursive: true, mode: 0o700 });
  fs.writeFileSync(tokenFile(), token + "\n", { mode: 0o600 });
  try {
    fs.chmodSync(tokenFile(), 0o600);
  } catch {
    /* not supported on some file systems */
  }
  return tokenFile();
}

export function deleteSavedToken() {
  try {
    fs.unlinkSync(tokenFile());
    return true;
  } catch {
    return false;
  }
}

// Token from the flag, the environment or the saved file, with its origin.
export function initialToken(flagToken) {
  if (flagToken) return { token: flagToken, from: "flag" };
  const env = envToken();
  if (env) return { token: env, from: "env" };
  const saved = readSavedToken();
  if (saved) return { token: saved, from: "saved" };
  return { token: "", from: "" };
}

export function ghToken() {
  try {
    const out = execFileSync("gh", ["auth", "token"], { stdio: ["ignore", "pipe", "ignore"], timeout: 10000 });
    return out.toString().trim();
  } catch {
    return "";
  }
}

export function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postForm(url, fields, fetchImpl) {
  const f = fetchImpl || globalThis.fetch;
  const res = await f(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.error) throw new Error("HTTP " + res.status);
  return data;
}

// OAuth device flow. `onCode({ user_code, verification_uri, expires_in })` is
// called once so the caller can show the code. Resolves with the token.
export async function deviceFlow(id, { scope = "repo", onCode, fetchImpl, wait = sleep } = {}) {
  const code = await postForm("https://github.com/login/device/code", { client_id: id, scope }, fetchImpl);
  if (code.error) throw new Error(code.error_description || code.error);
  if (onCode) onCode(code);

  let interval = (code.interval || 5) * 1000;
  const deadline = Date.now() + (code.expires_in || 900) * 1000;
  while (Date.now() < deadline) {
    await wait(interval);
    const data = await postForm(
      "https://github.com/login/oauth/access_token",
      { client_id: id, device_code: code.device_code, grant_type: "urn:ietf:params:oauth:grant-type:device_code" },
      fetchImpl,
    );
    if (data.access_token) return data.access_token;
    if (data.error === "authorization_pending") continue;
    if (data.error === "slow_down") {
      interval = ((data.interval || 0) * 1000) || interval + 5000;
      continue;
    }
    const err = new Error(data.error_description || data.error || "unknown error");
    err.code = data.error;
    throw err;
  }
  const err = new Error("the code expired");
  err.code = "expired_token";
  throw err;
}
