// Minimal tar reader: enough for the tarballs GitHub serves (ustar with pax
// headers). Reads everything in memory.

import { gunzipSync } from "node:zlib";

const BLOCK = 512;

function readString(buf, start, length) {
  const slice = buf.subarray(start, start + length);
  const end = slice.indexOf(0);
  return new TextDecoder().decode(end === -1 ? slice : slice.subarray(0, end));
}

function readOctal(buf, start, length) {
  // Base-256 encoding for very large sizes: the first byte has the high bit set.
  if (buf[start] & 0x80) {
    let value = 0;
    for (let i = start + 1; i < start + length; i++) value = value * 256 + buf[i];
    return value;
  }
  const text = readString(buf, start, length).trim();
  return text ? parseInt(text, 8) : 0;
}

function parsePax(data) {
  const out = {};
  const text = new TextDecoder().decode(data);
  let i = 0;
  while (i < text.length) {
    const space = text.indexOf(" ", i);
    if (space === -1) break;
    const len = parseInt(text.slice(i, space), 10);
    if (!len) break;
    const record = text.slice(space + 1, i + len - 1);
    const eq = record.indexOf("=");
    if (eq !== -1) out[record.slice(0, eq)] = record.slice(eq + 1);
    i += len;
  }
  return out;
}

// Returns { entries: [{ path, type, size, data }], comment } where type is
// "file", "dir" or "symlink" and comment is the global pax comment (GitHub
// puts the commit SHA there).
export function readTar(input, { gzip = true } = {}) {
  const buf = gzip ? gunzipSync(input) : input;
  const entries = [];
  let comment = "";
  let offset = 0;
  let nextPath = null;
  let nextSize = null;

  while (offset + BLOCK <= buf.length) {
    const header = buf.subarray(offset, offset + BLOCK);
    if (header.every((b) => b === 0)) break;

    let name = readString(header, 0, 100);
    let size = readOctal(header, 124, 12);
    const flag = String.fromCharCode(header[156] || 48);
    const magic = readString(header, 257, 6);
    const prefix = magic.startsWith("ustar") ? readString(header, 345, 155) : "";
    if (prefix) name = prefix + "/" + name;

    const dataStart = offset + BLOCK;
    const data = buf.subarray(dataStart, dataStart + size);
    offset = dataStart + Math.ceil(size / BLOCK) * BLOCK;

    if (flag === "g") {
      const pax = parsePax(data);
      if (pax.comment) comment = pax.comment;
      continue;
    }
    if (flag === "x") {
      const pax = parsePax(data);
      if (pax.path) nextPath = pax.path;
      if (pax.size) nextSize = Number(pax.size);
      continue;
    }
    if (flag === "L") {
      nextPath = readString(data, 0, data.length);
      continue;
    }

    if (nextPath !== null) { name = nextPath; nextPath = null; }
    if (nextSize !== null) { size = nextSize; nextSize = null; }

    let type = null;
    if (flag === "0" || flag === "\0" || flag === "7") type = "file";
    else if (flag === "5") type = "dir";
    else if (flag === "2" || flag === "1") type = "symlink";
    if (!type) continue;

    entries.push({ path: name.replace(/\/+$/, ""), type, size: type === "file" ? size : 0, data: type === "file" ? data : null });
  }
  return { entries, comment };
}
