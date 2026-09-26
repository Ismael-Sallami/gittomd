// From a list of entries to the Markdown parts. Shared by the CLI and tests.

import { planEntries, ignoreFilePaths, decodeText } from "../core/filters.js";
import { buildMarkdown } from "../core/markdown.js";

function bytesOf(entry) {
  if (entry.data) return entry.data;
  if (entry.load) return entry.load();
  return null;
}

export function convertEntries(entries, meta, options) {
  const byPath = new Map(entries.map((e) => [e.path, e]));
  const ignoreFiles = {};
  for (const p of ignoreFilePaths(entries)) {
    const bytes = bytesOf(byPath.get(p));
    const text = bytes ? decodeText(bytes) : null;
    if (text !== null) ignoreFiles[p] = text;
  }

  const { selected, skipped } = planEntries(entries, options, ignoreFiles);
  const files = [];
  for (const entry of selected) {
    let bytes;
    try {
      bytes = bytesOf(entry);
    } catch {
      skipped.push({ path: entry.path, size: entry.size, reason: "fetch-error" });
      continue;
    }
    const text = bytes ? decodeText(bytes) : null;
    if (text === null) {
      skipped.push({ path: entry.path, size: entry.size, reason: "binary" });
      continue;
    }
    files.push({ path: entry.path, content: text, size: entry.size });
  }

  return buildMarkdown(
    {
      title: meta.title,
      rootName: meta.rootName,
      meta,
      lang: options.lang,
      prompt: options.prompt,
      tree: options.tree,
      split: options.split,
    },
    files,
    skipped,
  );
}
