// Reading repository input and talking to the GitHub REST API with fetch.
// Runs the same in Node 18+ and in the browser.

export const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(message, { status = 0, kind = "other", reset = null } = {}) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
    this.kind = kind; // "not-found" | "rate-limit" | "auth" | "network" | "other"
    this.reset = reset; // Date when the rate limit resets, if known
  }
}

const NAME = /^[A-Za-z0-9_.-]+$/;

// Accepts:
//   https://github.com/owner/repo
//   https://github.com/owner/repo.git
//   https://github.com/owner/repo/tree/<ref>/<subdir>
//   github.com/owner/repo, git@github.com:owner/repo.git
//   owner/repo, owner/repo@ref
// Returns { owner, repo, ref, subdir } or null when it is not a GitHub repo.
export function parseRepoInput(input) {
  let s = String(input || "").trim();
  if (!s) return null;
  let ref = "";
  let subdir = "";

  const ssh = s.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?\/?$/i);
  if (ssh) return valid(ssh[1], ssh[2], "", "");

  const url = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/(.*)$/i);
  if (url) {
    const rest = url[1].split(/[?#]/)[0].replace(/\/+$/, "");
    const parts = rest.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, rawRepo, kind, ...more] = parts;
    const repo = rawRepo.replace(/\.git$/i, "");
    if ((kind === "tree" || kind === "blob" || kind === "commit") && more.length) {
      ref = decodeURIComponent(more[0]);
      subdir = more.slice(1).map(decodeURIComponent).join("/");
      if (kind === "blob") subdir = subdir.split("/").slice(0, -1).join("/");
    }
    return valid(owner, repo, ref, subdir);
  }

  // owner/repo or owner/repo@ref, and nothing that looks like a local path
  if (/^[.~/\\]/.test(s) || /^[A-Za-z]:[\\/]/.test(s)) return null;
  const at = s.lastIndexOf("@");
  if (at > 0) {
    ref = s.slice(at + 1);
    s = s.slice(0, at);
  }
  const parts = s.split("/");
  if (parts.length !== 2) return null;
  return valid(parts[0], parts[1].replace(/\.git$/i, ""), ref, "");
}

function valid(owner, repo, ref, subdir) {
  if (!NAME.test(owner) || !NAME.test(repo)) return null;
  return { owner, repo, ref, subdir };
}

function headers(token, accept) {
  const h = { Accept: accept || "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (token) h.Authorization = "Bearer " + token;
  return h;
}

// Throws a GitHubError with a useful kind for the common failures.
export async function checkResponse(res, what) {
  if (res.ok) return res;
  const remaining = res.headers.get("x-ratelimit-remaining");
  const resetHeader = res.headers.get("x-ratelimit-reset");
  const reset = resetHeader ? new Date(Number(resetHeader) * 1000) : null;
  let message = "";
  try {
    const body = await res.json();
    message = body && body.message ? body.message : "";
  } catch {
    /* the body is not JSON */
  }
  if (res.status === 404) throw new GitHubError(what + ": not found", { status: 404, kind: "not-found" });
  if ((res.status === 403 || res.status === 429) && (remaining === "0" || /rate limit/i.test(message))) {
    throw new GitHubError("GitHub API rate limit reached", { status: res.status, kind: "rate-limit", reset });
  }
  if (res.status === 401) throw new GitHubError("the token is not valid or has expired", { status: 401, kind: "auth" });
  if (res.status === 403) throw new GitHubError(message || "access denied", { status: 403, kind: "auth" });
  throw new GitHubError(what + ": HTTP " + res.status + (message ? " (" + message + ")" : ""), { status: res.status });
}

async function request(url, { token, accept, fetchImpl } = {}) {
  const f = fetchImpl || globalThis.fetch;
  let res;
  try {
    res = await f(url, { headers: headers(token, accept) });
  } catch (err) {
    throw new GitHubError("network error: " + (err && err.message ? err.message : err), { kind: "network" });
  }
  return res;
}

export async function getRepo(owner, repo, opts = {}) {
  const res = await request(`${API}/repos/${owner}/${repo}`, opts);
  await checkResponse(res, owner + "/" + repo);
  return res.json();
}

// Full commit SHA for a branch, tag or SHA.
export async function getCommitSha(owner, repo, ref, opts = {}) {
  const res = await request(`${API}/repos/${owner}/${repo}/commits/${encodePath(ref)}`, {
    ...opts,
    accept: "application/vnd.github.sha",
  });
  await checkResponse(res, "ref " + ref);
  return (await res.text()).trim();
}

// Every path in the commit. Returns { entries: [{ path, size, type }], truncated }.
export async function getTree(owner, repo, sha, opts = {}) {
  const res = await request(`${API}/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`, opts);
  await checkResponse(res, "tree " + sha);
  const data = await res.json();
  const entries = [];
  for (const item of data.tree || []) {
    if (item.type !== "blob") continue; // folders and submodules
    const type = item.mode === "120000" ? "symlink" : "file";
    entries.push({ path: item.path, size: item.size || 0, type });
  }
  return { entries, truncated: Boolean(data.truncated) };
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

// URL to download one file. Public repos use raw.githubusercontent.com, which
// does not count against the API limit; private ones need the API.
export function fileUrl(owner, repo, sha, path, isPrivate) {
  if (!isPrivate) return `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${encodePath(path)}`;
  return `${API}/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${sha}`;
}

export async function getFileBytes(owner, repo, sha, path, { token, isPrivate, fetchImpl } = {}) {
  const url = fileUrl(owner, repo, sha, path, isPrivate);
  const f = fetchImpl || globalThis.fetch;
  const init = isPrivate ? { headers: headers(token, "application/vnd.github.raw") } : {};
  let res;
  try {
    res = await f(url, init);
  } catch (err) {
    throw new GitHubError("network error: " + (err && err.message ? err.message : err), { kind: "network" });
  }
  await checkResponse(res, path);
  return new Uint8Array(await res.arrayBuffer());
}

// A URL like /tree/feature/login/src is ambiguous: the branch may be "feature"
// or "feature/login". Tries the shortest ref first and moves folder parts into
// the ref until one exists. Returns { sha, ref, subdir }.
export async function resolveRef(owner, repo, ref, subdir, opts = {}) {
  const parts = subdir ? subdir.split("/") : [];
  let candidate = ref;
  for (let i = 0; ; i++) {
    try {
      const sha = await getCommitSha(owner, repo, candidate, opts);
      return { sha, ref: candidate, subdir: parts.slice(i).join("/") };
    } catch (err) {
      if (err.kind !== "not-found" && err.status !== 422) throw err;
      if (i >= parts.length) throw err;
      candidate += "/" + parts[i];
    }
  }
}

export function tarballUrl(owner, repo, ref) {
  return `${API}/repos/${owner}/${repo}/tarball/${encodePath(ref)}`;
}

export function requestHeaders(token, accept) {
  return headers(token, accept);
}
