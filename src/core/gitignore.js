// Glob and .gitignore matching without dependencies.
//
// Supported: *, **, ?, [abc], [!abc], {a,b}, negation with !, trailing / for
// folders only, leading / to anchor, and escaped characters with \.

export function globToRegExp(glob) {
  let re = "";
  let i = 0;
  let inBraces = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "\\" && i + 1 < glob.length) {
      re += escapeRe(glob[i + 1]);
      i += 2;
      continue;
    }
    if (c === "*") {
      if (glob[i + 1] === "*") {
        const before = i === 0 || glob[i - 1] === "/";
        const after = i + 2 === glob.length || glob[i + 2] === "/";
        if (before && after) {
          if (i + 2 === glob.length) {
            re += ".*";
            i += 2;
          } else {
            // "**/" matches zero or more folders
            re += "(?:.*/)?";
            i += 3;
          }
          continue;
        }
        re += "[^/]*";
        i += 2;
        continue;
      }
      re += "[^/]*";
      i += 1;
      continue;
    }
    if (c === "?") {
      re += "[^/]";
      i += 1;
      continue;
    }
    if (c === "[") {
      const end = glob.indexOf("]", i + 2);
      if (end === -1) {
        re += "\\[";
        i += 1;
        continue;
      }
      let body = glob.slice(i + 1, end);
      if (body[0] === "!" || body[0] === "^") body = "^" + body.slice(1);
      re += "[" + body.replace(/\\/g, "\\\\") + "]";
      i = end + 1;
      continue;
    }
    if (c === "{") {
      inBraces += 1;
      re += "(?:";
      i += 1;
      continue;
    }
    if (c === "}" && inBraces > 0) {
      inBraces -= 1;
      re += ")";
      i += 1;
      continue;
    }
    if (c === "," && inBraces > 0) {
      re += "|";
      i += 1;
      continue;
    }
    re += escapeRe(c);
    i += 1;
  }
  while (inBraces-- > 0) re += ")";
  return re;
}

function escapeRe(c) {
  return /[.*+?^${}()|[\]\\/]/.test(c) ? "\\" + c : c;
}

// Parses the text of an ignore file into rules. `base` is the folder that holds
// the file, relative to the repo root ("" for the root).
export function parseIgnore(text, base = "") {
  const rules = [];
  for (let raw of String(text).split(/\r?\n/)) {
    let line = raw.replace(/(?<!\\)\s+$/, "");
    if (!line || line.startsWith("#")) continue;
    let negate = false;
    if (line.startsWith("!")) {
      negate = true;
      line = line.slice(1);
    } else if (line.startsWith("\\!") || line.startsWith("\\#")) {
      line = line.slice(1);
    }
    let dirOnly = false;
    if (line.endsWith("/")) {
      dirOnly = true;
      line = line.replace(/\/+$/, "");
    }
    if (!line) continue;
    // A slash at the start or in the middle anchors the pattern to `base`.
    const anchored = line.includes("/");
    if (line.startsWith("/")) line = line.slice(1);
    const body = globToRegExp(line);
    const prefix = base ? escapeGlobBase(base) + "/" : "";
    const source = anchored ? `^${prefix}${body}$` : `^${prefix}(?:.*/)?${body}$`;
    rules.push({ re: new RegExp(source), negate, dirOnly, base });
  }
  return rules;
}

function escapeGlobBase(base) {
  return base.split("").map(escapeRe).join("");
}

// Builds a matcher from a list of rules (in order: later rules win).
// Returns a function (path) => boolean, where true means ignored.
// Git never looks inside an ignored folder, so a file is ignored when any of
// its parent folders is.
export function createMatcher(rules) {
  if (!rules.length) return () => false;
  const dirCache = new Map();

  function test(path, isDir) {
    let result = false;
    for (const rule of rules) {
      if (rule.dirOnly && !isDir) continue;
      if (rule.base && !path.startsWith(rule.base + "/")) continue;
      if (rule.re.test(path)) result = !rule.negate;
    }
    return result;
  }

  function dirIgnored(dir) {
    if (dirCache.has(dir)) return dirCache.get(dir);
    const slash = dir.lastIndexOf("/");
    const parent = slash === -1 ? "" : dir.slice(0, slash);
    const value = (parent && dirIgnored(parent)) || test(dir, true);
    dirCache.set(dir, value);
    return value;
  }

  return function ignored(path) {
    const slash = path.lastIndexOf("/");
    if (slash !== -1 && dirIgnored(path.slice(0, slash))) return true;
    return test(path, false);
  };
}

// Simple glob matcher for --include / --exclude. A pattern without a slash
// matches the file name at any depth; a pattern ending in / matches a folder.
export function createGlobList(patterns) {
  const list = (patterns || []).filter(Boolean);
  if (!list.length) return null;
  return createMatcher(parseIgnore(list.join("\n")));
}
