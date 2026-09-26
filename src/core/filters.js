// Decides, file by file, whether the content goes into the Markdown and, if
// not, why. Works with paths and sizes only, so the web version can filter
// before downloading anything.

import { createMatcher, createGlobList, parseIgnore } from "./gitignore.js";

// Folders that are almost never useful to an AI reading the code.
export const IGNORED_DIRS = [
  ".git", ".hg", ".svn", "node_modules", "bower_components", "__pycache__",
  ".venv", "venv", ".tox", ".mypy_cache", ".pytest_cache", ".ruff_cache",
  ".next", ".nuxt", ".svelte-kit", ".turbo", ".parcel-cache", ".cache",
  ".gradle", ".idea", ".vs", "coverage", ".nyc_output",
];

export const LOCKFILES = [
  "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml",
  "bun.lockb", "bun.lock", "deno.lock", "poetry.lock", "Pipfile.lock", "uv.lock",
  "pdm.lock", "Cargo.lock", "go.sum", "composer.lock", "Gemfile.lock",
  "mix.lock", "pubspec.lock", "Podfile.lock", "packages.lock.json",
  "flake.lock", "gradle.lockfile", "conan.lock",
];

export const JUNK_FILES = [".DS_Store", "Thumbs.db", "desktop.ini"];

export const BINARY_EXTENSIONS = [
  // images
  "png", "jpg", "jpeg", "gif", "bmp", "ico", "icns", "webp", "avif", "tif", "tiff",
  "psd", "xcf", "heic", "raw", "cr2", "nef",
  // fonts
  "woff", "woff2", "ttf", "otf", "eot",
  // archives
  "zip", "tar", "gz", "tgz", "bz2", "xz", "zst", "7z", "rar", "jar", "war", "ear",
  "apk", "aab", "ipa", "deb", "rpm", "dmg", "iso", "whl", "egg", "nupkg", "crx",
  // audio and video
  "mp3", "mp4", "m4a", "m4v", "wav", "ogg", "oga", "flac", "aac", "opus", "mov",
  "avi", "mkv", "webm", "wmv", "flv", "mid", "midi",
  // documents
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "epub",
  "key", "numbers", "pages",
  // compiled and data
  "exe", "dll", "so", "dylib", "o", "obj", "a", "lib", "class", "pyc", "pyo",
  "wasm", "bin", "dat", "db", "sqlite", "sqlite3", "mdb", "pkl", "pickle", "npy",
  "npz", "h5", "hdf5", "onnx", "pt", "pth", "ckpt", "safetensors", "parquet",
  "avro", "orc", "feather", "tfrecord", "blend", "fbx", "glb", "3ds", "dwg",
  "sketch", "fig", "swf", "keystore", "jks", "p12", "pfx", "der",
];

const BINARY_SET = new Set(BINARY_EXTENSIONS);
const LOCK_SET = new Set(LOCKFILES);
const JUNK_SET = new Set(JUNK_FILES);
const DIR_SET = new Set(IGNORED_DIRS);

export const DEFAULTS = {
  maxFileSize: 512 * 1024,
  maxTotalSize: 0, // 0 means no limit
  includeLockfiles: false,
  includeMinified: false,
  useGitignore: true,
  contents: true,
  include: [],
  exclude: [],
  subdir: "",
};

export function extname(path) {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function basename(path) {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

export function isMinified(path) {
  const name = basename(path).toLowerCase();
  return /\.min\.(js|mjs|cjs|css)$/.test(name) || name.endsWith(".map");
}

// Returns the first ignored-by-default folder in the path, or null.
function ignoredDirOf(path) {
  const parts = path.split("/");
  for (let i = 0; i < parts.length - 1; i++) {
    if (DIR_SET.has(parts[i])) return parts.slice(0, i + 1).join("/");
  }
  return null;
}

// entries: [{ path, size, type? }] where type can be "file" or "symlink".
// ignoreFiles: { ".gitignore": text, "src/.gitignore": text, ".gittomdignore": text }
// Returns { selected: [entry], skipped: [{ path, size, reason, dir? }] }.
export function planEntries(entries, options = {}, ignoreFiles = {}) {
  const opts = { ...DEFAULTS, ...options };
  const subdir = normaliseSubdir(opts.subdir);

  const gitRules = [];
  const ownRules = [];
  const ignorePaths = Object.keys(ignoreFiles).sort((a, b) => a.split("/").length - b.split("/").length);
  for (const file of ignorePaths) {
    const slash = file.lastIndexOf("/");
    const base = slash === -1 ? "" : file.slice(0, slash);
    const name = basename(file);
    if (name === ".gitignore" && opts.useGitignore) gitRules.push(...parseIgnore(ignoreFiles[file], base));
    if (name === ".gittomdignore") ownRules.push(...parseIgnore(ignoreFiles[file], base));
  }
  const gitIgnored = createMatcher(gitRules);
  const ownIgnored = createMatcher(ownRules);
  const included = createGlobList(opts.include);
  const excluded = createGlobList(opts.exclude);

  const selected = [];
  const skipped = [];
  let total = 0;

  const sorted = [...entries].sort((a, b) => comparePaths(a.path, b.path));
  for (const entry of sorted) {
    const { path } = entry;
    const size = entry.size || 0;
    const skip = (reason, dir) => skipped.push({ path, size, reason, ...(dir ? { dir } : {}) });

    if (subdir && !path.startsWith(subdir + "/")) continue;

    const dir = ignoredDirOf(path);
    if (dir) { skip("ignored-dir", dir); continue; }
    if (JUNK_SET.has(basename(path))) continue;
    if (entry.type === "symlink") { skip("symlink"); continue; }
    if (ownIgnored(path)) { skip("gittomdignore"); continue; }
    if (gitIgnored(path)) { skip("gitignore"); continue; }
    if (excluded && excluded(path)) { skip("exclude"); continue; }
    if (included && !included(path)) { skip("not-included"); continue; }
    if (!opts.includeLockfiles && LOCK_SET.has(basename(path))) { skip("lockfile"); continue; }
    if (BINARY_SET.has(extname(path))) { skip("binary"); continue; }
    if (!opts.includeMinified && isMinified(path)) { skip("minified"); continue; }
    if (opts.maxFileSize && size > opts.maxFileSize) { skip("too-large"); continue; }
    if (!opts.contents) { skip("no-contents"); continue; }
    if (opts.maxTotalSize && total + size > opts.maxTotalSize) { skip("total-limit"); continue; }
    total += size;
    selected.push(entry);
  }
  return { selected, skipped };
}

// Paths of every ignore file among the entries, so callers can load them first.
export function ignoreFilePaths(entries) {
  return entries
    .map((e) => e.path)
    .filter((p) => {
      const name = basename(p);
      return (name === ".gitignore" || name === ".gittomdignore") && !ignoredDirOf(p);
    });
}

export function normaliseSubdir(value) {
  return String(value || "").replace(/^\/+|\/+$/g, "");
}

// Folders first, then files, case-insensitive. Same order as the tree.
export function comparePaths(a, b) {
  const pa = a.split("/");
  const pb = b.split("/");
  const n = Math.min(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    if (pa[i] === pb[i]) continue;
    const aIsDir = i < pa.length - 1;
    const bIsDir = i < pb.length - 1;
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    const x = pa[i].toLowerCase();
    const y = pb[i].toLowerCase();
    if (x !== y) return x < y ? -1 : 1;
    return pa[i] < pb[i] ? -1 : 1;
  }
  return pa.length - pb.length;
}

// Decodes file bytes as text. Returns null when the file looks binary:
// a NUL byte in the first 8000 bytes, or bytes that are not valid UTF-8.
export function decodeText(bytes) {
  const head = bytes.subarray(0, 8000);
  for (let i = 0; i < head.length; i++) if (head[i] === 0) return null;
  try {
    let text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return text;
  } catch {
    return null;
  }
}
