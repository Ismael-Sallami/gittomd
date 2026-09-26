// The gittomd command.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseRepoInput, GitHubError } from "../core/github.js";
import { pickLang } from "../core/i18n.js";
import { parseSize, parseCount, formatBytes, formatTokens } from "../core/tokens.js";
import { CLI } from "./messages.js";
import { fetchGitHub, readLocal } from "./fetch-repo.js";
import { convertEntries } from "./convert.js";
import { canAsk, ask, askHidden, confirm } from "./prompt.js";
import {
  initialToken, ghToken, clientId, deviceFlow, openBrowser, saveToken, deleteSavedToken, envToken,
} from "./auth.js";

const VERSION = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version;

// name: [short, type, default]. Booleans that default to true accept --no-<name>.
const OPTIONS = {
  output: ["o", "string"],
  stdout: [null, "boolean", false],
  copy: ["c", "boolean", false],
  split: [null, "string"],
  lang: [null, "string"],
  prompt: [null, "string"],
  tree: [null, "boolean", true],
  contents: [null, "boolean", true],
  ref: ["r", "string"],
  subdir: ["s", "string"],
  include: ["i", "list"],
  exclude: ["e", "list"],
  "max-file-size": [null, "string"],
  "max-total": [null, "string"],
  "include-lockfiles": [null, "boolean", false],
  "include-minified": [null, "boolean", false],
  gitignore: [null, "boolean", true],
  token: ["t", "string"],
  input: [null, "boolean", true],
  quiet: ["q", "boolean", false],
  version: ["v", "boolean", false],
  help: ["h", "boolean", false],
};

class UsageError extends Error {}

export function parseArgs(argv) {
  const values = {};
  const positionals = [];
  const shorts = Object.fromEntries(Object.entries(OPTIONS).filter(([, o]) => o[0]).map(([k, o]) => [o[0], k]));
  for (const [k, o] of Object.entries(OPTIONS)) {
    if (o[1] === "boolean") values[k] = o[2];
    if (o[1] === "list") values[k] = [];
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") { positionals.push(...argv.slice(i + 1)); break; }
    if (!arg.startsWith("-") || arg === "-") { positionals.push(arg); continue; }

    let name;
    let inline;
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
      inline = eq === -1 ? undefined : arg.slice(eq + 1);
      if (!OPTIONS[name] && name.startsWith("no-")) {
        const base = name.slice(3);
        if (base === "prompt") { values.prompt = false; continue; }
        if (OPTIONS[base] && OPTIONS[base][1] === "boolean") { values[base] = false; continue; }
      }
    } else {
      name = shorts[arg.slice(1, 2)];
      if (arg.length > 2) inline = arg.slice(2);
    }
    const spec = OPTIONS[name];
    if (!spec) throw new UsageError(arg);
    if (spec[1] === "boolean") {
      values[name] = true;
      continue;
    }
    const value = inline !== undefined ? inline : argv[++i];
    if (value === undefined) throw new UsageError(arg);
    if (spec[1] === "list") values[name].push(...value.split(",").map((s) => s.trim()).filter(Boolean));
    else values[name] = value;
  }
  return { values, positionals };
}

export async function main(argv) {
  let lang = pickLang(process.env.GITTOMD_LANG) || pickLang(process.env.LC_ALL) || pickLang(process.env.LANG) || "en";
  let say = makeSay(lang, false);

  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (err instanceof UsageError) {
      say.error("badOption", { option: err.message });
      return 2;
    }
    throw err;
  }
  const { values, positionals } = parsed;
  if (values.lang) lang = pickLang(values.lang) || lang;
  say = makeSay(lang, values.quiet);

  if (values.version) {
    process.stdout.write(VERSION + "\n");
    return 0;
  }
  if (values.help) {
    process.stdout.write(CLI[lang].help.replace("{version}", VERSION));
    return 0;
  }

  const interactive = values.input && canAsk();
  const command = positionals[0];

  if (command === "login") return login({ say, lang, interactive, flagToken: values.token });
  if (command === "logout") {
    say.info(deleteSavedToken() ? "loggedOut" : "loggedOutNothing");
    for (const name of ["GITHUB_TOKEN", "GH_TOKEN", "GITTOMD_TOKEN"]) if (process.env[name]) say.info("envStillSet", { name });
    return 0;
  }
  if (!command) {
    process.stderr.write(CLI[lang].help.replace("{version}", VERSION));
    return 2;
  }

  // Options that need parsing.
  const options = {
    lang,
    prompt: values.prompt === undefined ? true : values.prompt,
    tree: values.tree,
    contents: values.contents,
    include: values.include,
    exclude: values.exclude,
    includeLockfiles: values["include-lockfiles"],
    includeMinified: values["include-minified"],
    useGitignore: values.gitignore,
    maxFileSize: 512 * 1024,
    maxTotalSize: 0,
    split: 0,
  };
  for (const [flag, key, parser] of [
    ["max-file-size", "maxFileSize", parseSize],
    ["max-total", "maxTotalSize", parseSize],
    ["split", "split", parseCount],
  ]) {
    if (values[flag] === undefined) continue;
    const n = parser(values[flag]);
    if (!Number.isFinite(n)) {
      say.error("badValue", { option: "--" + flag, value: values[flag] });
      return 2;
    }
    options[key] = n;
  }

  // Local folder or GitHub?
  let source;
  const localPath = path.resolve(command);
  const looksLocal = /^[.~/\\]/.test(command) || /^[A-Za-z]:[\\/]/.test(command);
  const target = looksLocal ? null : parseRepoInput(command);
  if (!target && fs.existsSync(localPath) && fs.statSync(localPath).isDirectory()) {
    say.progress("reading", { dir: localPath });
    source = readLocal(localPath);
    options.subdir = values.subdir || "";
  } else if (target && isPlaceholder(target)) {
    say.error("placeholder", { input: command });
    return 2;
  } else if (target) {
    if (values.ref) target.ref = values.ref;
    if (values.subdir) target.subdir = values.subdir;
    source = await fetchRepoWithAuth(target, { say, interactive, flagToken: values.token });
    if (typeof source === "number") return source;
    options.subdir = source.subdir;
  } else {
    say.error("badInput", { input: command });
    return 2;
  }

  source.meta.date = new Date().toISOString().slice(0, 10);
  if (options.subdir) {
    source.meta.title += "/" + options.subdir;
    source.meta.rootName = options.subdir.split("/").pop();
  }
  const result = convertEntries(source.entries, source.meta, options);

  // Write the result.
  if (values.stdout) {
    process.stdout.write(result.parts.join("\n"));
  } else {
    const base = values.output || defaultName(source.meta);
    const files = writeParts(base, result.parts);
    if (files.length === 1) say.done("wrote", { file: files[0] });
    else say.done("wroteParts", { n: files.length, first: files[0], last: files[files.length - 1] });
  }
  say.done("stats", { files: result.fileCount, skipped: result.skippedCount, tokens: formatTokens(result.tokens) });
  if (result.tokens > 200000 && !options.split) say.info("bigWarning");
  if (values.copy) say.info(copyToClipboard(result.parts.join("\n")) ? "copied" : "copyFailed");
  return 0;
}

// "owner/repo" copied straight from the help text.
function isPlaceholder(target) {
  return /^(owner|user|usuario)$/i.test(target.owner) && /^(repo|repository|repositorio)$/i.test(target.repo);
}

function defaultName(meta) {
  return (meta.rootName || "repo").replace(/[^A-Za-z0-9._-]/g, "_") + ".md";
}

function writeParts(base, parts) {
  if (parts.length === 1) {
    fs.writeFileSync(base, parts[0]);
    return [base];
  }
  const ext = path.extname(base) || ".md";
  const stem = base.slice(0, base.length - path.extname(base).length);
  return parts.map((text, i) => {
    const file = `${stem}-${i + 1}${ext}`;
    fs.writeFileSync(file, text);
    return file;
  });
}

// Downloads the repo. On a 404 without a token, asks whether it is private and,
// if so, signs in and tries again. Returns the source or an exit code.
async function fetchRepoWithAuth(target, { say, interactive, flagToken }) {
  const name = target.owner + "/" + target.repo;
  let { token, from } = initialToken(flagToken);
  const onProgress = say.quiet ? null : progressPrinter(say);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      say.progress("fetching", { repo: name });
      const source = await fetchGitHub(target, { token, onProgress });
      if (onProgress) onProgress.end();
      return source;
    } catch (err) {
      if (onProgress) onProgress.end();
      if (!(err instanceof GitHubError)) throw err;
      if (err.kind === "rate-limit") {
        say.error("rateLimit");
        if (err.reset) say.info("rateLimitReset", { time: err.reset.toLocaleTimeString() });
        if (!token) say.info("rateLimitHint");
        return 1;
      }
      if (err.kind === "auth") {
        say.error("authError", { error: err.message });
        return 1;
      }
      if (err.kind === "network") {
        say.error("networkError", { error: err.message });
        return 1;
      }
      if (err.kind !== "not-found") throw err;

      say.error("notFound", { repo: name });
      if (token && from === "gh" && interactive) {
        // gh is signed in with an account that cannot see the repo.
        say.info("ghNoAccess");
        token = await signIn(say);
        from = "signin";
        if (!token) return 1;
        continue;
      }
      if (token) {
        say.info("notFoundWithToken");
        return 1;
      }
      if (!interactive) {
        say.info("notFoundNoInput");
        return 1;
      }
      if (!(await confirm(say.text("askPrivate")))) {
        say.info("notFoundPublic");
        return 1;
      }
      const gh = ghToken();
      if (gh) {
        say.info("usingGh");
        token = gh;
        from = "gh";
      } else {
        token = await signIn(say);
        from = "signin";
        if (!token) return 1;
      }
    }
  }
  return 1;
}

async function signIn(say) {
  const id = clientId();
  let method = "2";
  if (id) method = (await ask(say.text("chooseAuth"))) || "1";

  if (method !== "2" && id) {
    try {
      const token = await deviceFlow(id, {
        onCode: (code) => {
          say.info("deviceCode", { url: code.verification_uri, code: code.user_code });
          say.info(openBrowser(code.verification_uri) ? "deviceOpened" : "deviceWaiting");
        },
      });
      say.info("saved", { file: saveToken(token) });
      return token;
    } catch (err) {
      if (err.code === "access_denied") say.error("deviceDenied");
      else if (err.code === "expired_token") say.error("deviceExpired");
      else say.error("deviceError", { error: err.message });
      return "";
    }
  }

  say.info("pasteHelp");
  const token = await askHidden(say.text("pastePrompt"));
  if (!token) {
    say.error("noToken");
    return "";
  }
  if (await confirm(say.text("saveAsk"), { defaultYes: true })) say.info("saved", { file: saveToken(token) });
  return token;
}

async function login({ say, interactive, flagToken }) {
  let token = flagToken || "";
  if (!token) {
    if (!interactive) {
      say.error("notFoundNoInput");
      return 1;
    }
    token = await signIn(say);
    if (!token) return 1;
  } else {
    saveToken(token);
  }
  try {
    const res = await fetch("https://api.github.com/user", { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" } });
    if (res.ok) say.done("loggedIn", { user: (await res.json()).login });
    else say.error("authError", { error: "HTTP " + res.status });
  } catch (err) {
    say.error("networkError", { error: err.message });
  }
  if (envToken()) say.info("envStillSet", { name: "GITHUB_TOKEN" });
  return 0;
}

function copyToClipboard(text) {
  const tools =
    process.platform === "darwin" ? [["pbcopy", []]]
    : process.platform === "win32" ? [["clip", []]]
    : [["wl-copy", []], ["xclip", ["-selection", "clipboard"]], ["xsel", ["--clipboard", "--input"]]];
  for (const [cmd, args] of tools) {
    try {
      execFileSync(cmd, args, { input: text, stdio: ["pipe", "ignore", "ignore"], timeout: 5000 });
      return true;
    } catch {
      /* try the next one */
    }
  }
  return false;
}

function progressPrinter(say) {
  let last = 0;
  let shown = false;
  const fn = (received) => {
    if (!process.stderr.isTTY) return;
    const now = Date.now();
    if (now - last < 150) return;
    last = now;
    shown = true;
    process.stderr.write("\r" + say.text("downloaded", { size: formatBytes(received) }) + "   ");
  };
  fn.end = () => {
    if (shown) process.stderr.write("\n");
    shown = false;
  };
  return fn;
}

function makeSay(lang, quiet) {
  const table = CLI[lang] || CLI.en;
  const text = (key, vars) => {
    let s = table[key] || key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
  const color = process.stderr.isTTY && !process.env.NO_COLOR;
  const paint = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
  return {
    quiet,
    text,
    progress: (k, v) => { if (!quiet) process.stderr.write(paint("2", text(k, v)) + "\n"); },
    info: (k, v) => process.stderr.write(text(k, v) + "\n"),
    done: (k, v) => process.stderr.write(paint("32", text(k, v)) + "\n"),
    error: (k, v) => process.stderr.write(paint("31", text(k, v)) + "\n"),
  };
}
