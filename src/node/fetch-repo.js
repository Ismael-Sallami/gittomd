// Gets the files of a repository: a GitHub tarball or a local folder.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { getRepo, resolveRef, tarballUrl, requestHeaders, checkResponse, GitHubError } from "../core/github.js";
import { IGNORED_DIRS } from "../core/filters.js";
import { readTar } from "./tar.js";

// Returns { meta, entries, isPrivate } where entries are
// [{ path, size, type, data }] with paths relative to the repo root.
export async function fetchGitHub(target, { token, onProgress } = {}) {
  const { owner, repo } = target;
  const info = await getRepo(owner, repo, { token });
  const wanted = target.ref || info.default_branch;
  const { sha, ref, subdir } = await resolveRef(owner, repo, wanted, target.subdir || "", { token });

  let res;
  try {
    res = await fetch(tarballUrl(owner, repo, sha), { headers: requestHeaders(token), redirect: "follow" });
  } catch (err) {
    throw new GitHubError("network error: " + err.message, { kind: "network" });
  }
  await checkResponse(res, "tarball");
  const buffer = await readBody(res, onProgress);

  const { entries: raw } = readTar(buffer);
  const entries = [];
  for (const e of raw) {
    if (e.type === "dir") continue;
    // Every path starts with "owner-repo-shortsha/".
    const slash = e.path.indexOf("/");
    if (slash === -1) continue;
    entries.push({ path: e.path.slice(slash + 1), size: e.size, type: e.type, data: e.data });
  }

  return {
    isPrivate: Boolean(info.private),
    entries,
    subdir,
    meta: {
      title: `${info.owner?.login || owner}/${info.name || repo}`,
      rootName: info.name || repo,
      source: info.html_url || `https://github.com/${owner}/${repo}`,
      description: info.description || "",
      ref,
      commit: sha,
    },
  };
}

async function readBody(res, onProgress) {
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !onProgress) return Buffer.from(await res.arrayBuffer());
  const chunks = [];
  let received = 0;
  for await (const chunk of res.body) {
    chunks.push(chunk);
    received += chunk.length;
    onProgress(received, total);
  }
  return Buffer.concat(chunks);
}

// Walks a local folder. Folders ignored by default are not even entered, which
// matters a lot for node_modules. File contents are read later, only for the
// files that pass the filters.
export function readLocal(dir) {
  const root = path.resolve(dir);
  const stat = fs.statSync(root);
  if (!stat.isDirectory()) throw new Error(root + " is not a folder");
  const skipDirs = new Set(IGNORED_DIRS);
  const entries = [];

  (function walk(abs, rel) {
    let list;
    try {
      list = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of list) {
      const relPath = rel ? rel + "/" + d.name : d.name;
      const absPath = path.join(abs, d.name);
      if (d.isDirectory()) {
        if (!skipDirs.has(d.name)) walk(absPath, relPath);
      } else if (d.isSymbolicLink()) {
        entries.push({ path: relPath, size: 0, type: "symlink" });
      } else if (d.isFile()) {
        let size = 0;
        try {
          size = fs.statSync(absPath).size;
        } catch {
          continue;
        }
        entries.push({ path: relPath, size, type: "file", load: () => fs.readFileSync(absPath) });
      }
    }
  })(root, "");

  const meta = { title: path.basename(root), rootName: path.basename(root), source: root };
  const git = (args) => execFileSync("git", ["-C", root, ...args], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  try {
    meta.commit = git(["rev-parse", "HEAD"]);
    meta.ref = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  } catch {
    /* not a git repo, or git is not installed */
  }
  return { entries, meta, isPrivate: true, subdir: "" };
}
