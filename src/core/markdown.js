// Builds the Markdown document from the selected files and the skipped list.

import { t } from "./i18n.js";
import { languageFor } from "./languages.js";
import { renderTree } from "./tree.js";
import { estimateTokens, formatTokens, formatBytes } from "./tokens.js";
import { comparePaths } from "./filters.js";

// A fence one backtick longer than the longest run inside the text, so a file
// that contains ``` itself cannot close the block early.
export function fenceFor(text) {
  let longest = 0;
  const runs = String(text).match(/`+/g);
  if (runs) for (const r of runs) longest = Math.max(longest, r.length);
  return "`".repeat(Math.max(3, longest + 1));
}

export function inlineCode(text) {
  const s = String(text);
  if (!s.includes("`")) return "`" + s + "`";
  const fence = "`".repeat(Math.max(...s.match(/`+/g).map((r) => r.length)) + 1);
  return fence + " " + s + " " + fence;
}

function cell(text) {
  return String(text).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

// Root README first, then the tree order: the README is what a person would
// read first too.
function orderFiles(files) {
  const sorted = [...files].sort((a, b) => comparePaths(a.path, b.path));
  const isReadme = (f) => !f.path.includes("/") && /^readme(\.|$)/i.test(f.path);
  return [...sorted.filter(isReadme), ...sorted.filter((f) => !isReadme(f))];
}

function fileBlock(file, lang) {
  const content = file.content.replace(/\s+$/, "");
  const fence = fenceFor(content);
  const heading = "### " + inlineCode(file.path);
  if (!content) return heading + "\n\n" + t(lang, "emptyFile") + "\n";
  return heading + "\n\n" + fence + languageFor(file.path) + "\n" + content + "\n" + fence + "\n";
}

const MAX_SKIPPED_ROWS = 500;

function skippedSection(skipped, lang) {
  if (!skipped.length) return "";
  const rows = [];
  const dirs = new Map();
  for (const s of skipped) {
    if (s.dir) dirs.set(s.dir, (dirs.get(s.dir) || 0) + 1);
    else rows.push([s.path, t(lang, "reasons." + s.reason)]);
  }
  for (const [dir, n] of dirs) {
    rows.push([dir + "/", t(lang, "reasons.ignored-dir") + " (" + t(lang, "filesInside", { n }) + ")"]);
  }
  rows.sort((a, b) => comparePaths(a[0], b[0]));
  const shown = rows.slice(0, MAX_SKIPPED_ROWS);
  let out = "## " + t(lang, "skippedTitle") + "\n\n" + t(lang, "skippedIntro") + "\n\n";
  out += "| " + t(lang, "file") + " | " + t(lang, "reason") + " |\n|---|---|\n";
  for (const [p, r] of shown) out += "| " + cell(inlineCode(p)) + " | " + cell(r) + " |\n";
  if (rows.length > shown.length) out += "\n" + t(lang, "more", { n: rows.length - shown.length }) + "\n";
  return out;
}

function treeSection(opts, files, skipped, lang) {
  const marks = new Map();
  const collapsed = new Set();
  const paths = files.map((f) => f.path);
  for (const s of skipped) {
    if (s.dir) {
      collapsed.add(s.dir);
      paths.push(s.path);
      marks.set(s.dir, t(lang, "omittedMark"));
    } else {
      paths.push(s.path);
      marks.set(s.path, t(lang, "omittedMark"));
    }
  }
  const tree = renderTree(opts.rootName || "repo", paths, { marks, collapsed });
  const fence = fenceFor(tree);
  return "## " + t(lang, "structure") + "\n\n" + fence + "text\n" + tree + "\n" + fence + "\n";
}

/**
 * opts:
 *   title        heading of the document, for example "owner/repo"
 *   rootName     name of the root folder in the tree
 *   meta         { source, description, ref, commit, date }
 *   lang         "es" or "en"
 *   prompt       true for the default text, a string for a custom one, false for none
 *   tree         include the tree (default true)
 *   split        max tokens per part, 0 for a single document
 * files: [{ path, content, size }]
 * skipped: [{ path, size, reason, dir? }]
 * Returns { parts: [string], tokens, bytes, fileCount, skippedCount }.
 */
export function buildMarkdown(opts, files, skipped) {
  const lang = opts.lang || "es";
  const meta = opts.meta || {};
  const title = opts.title || opts.rootName || "repo";
  const ordered = orderFiles(files);
  const blocks = ordered.map((f) => fileBlock(f, lang));
  const bytes = files.reduce((n, f) => n + (f.size || 0), 0);

  const treeText = opts.tree === false ? "" : treeSection(opts, files, skipped, lang);
  const skippedText = skippedSection(skipped, lang);
  const promptText =
    opts.prompt === false || opts.prompt === undefined
      ? ""
      : typeof opts.prompt === "string" && opts.prompt.trim()
        ? opts.prompt.trim()
        : t(lang, "defaultPrompt", { repo: title });

  const bodyTokens = estimateTokens(treeText + skippedText + blocks.join("\n"));

  // Split the file blocks into parts when asked.
  const chunks = [];
  if (opts.split && opts.split > 0) {
    let current = [];
    let size = estimateTokens(treeText) + 400;
    for (const b of blocks) {
      const bt = estimateTokens(b);
      if (current.length && size + bt > opts.split) {
        chunks.push(current);
        current = [];
        size = 100;
      }
      current.push(b);
      size += bt;
    }
    chunks.push(current);
  } else {
    chunks.push(blocks);
  }
  const total = chunks.length;

  function header(tokens) {
    let out = "# " + title + "\n\n" + t(lang, "generatedBy", { date: meta.date || new Date().toISOString().slice(0, 10) }) + "\n\n";
    if (promptText) out += "## " + t(lang, "promptTitle") + "\n\n" + promptText + "\n\n";
    out += "## " + t(lang, "summary") + "\n\n| | |\n|---|---|\n";
    const row = (k, v) => { if (v !== undefined && v !== null && v !== "") out += "| " + t(lang, k) + " | " + cell(v) + " |\n"; };
    row("source", meta.source);
    row("description", meta.description);
    row("ref", meta.ref);
    row("commit", meta.commit);
    row("included", files.length);
    row("skipped", skipped.length);
    row("size", formatBytes(bytes));
    row("tokens", "~" + formatTokens(tokens));
    if (total > 1) row("part", "1 " + t(lang, "of") + " " + total);
    return out;
  }

  const headTokens = estimateTokens(header(bodyTokens));
  const tokens = bodyTokens + headTokens;

  const parts = chunks.map((chunk, i) => {
    let out = "";
    if (i === 0) {
      out += header(tokens) + "\n";
      if (treeText) out += treeText + "\n";
    } else {
      out += "# " + title + " (" + t(lang, "part").toLowerCase() + " " + (i + 1) + " " + t(lang, "of") + " " + total + ")\n\n";
    }
    if (chunk.length) out += "## " + t(lang, "files") + "\n\n" + chunk.join("\n") + "\n";
    if (i === total - 1 && skippedText) out += skippedText;
    return out.replace(/\s*$/, "\n");
  });

  return { parts, tokens, bytes, fileCount: files.length, skippedCount: skipped.length };
}
