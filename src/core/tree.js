// Folder tree in plain ASCII, like `tree --charset=ascii`.

import { comparePaths } from "./filters.js";

// files: list of paths. marks: Map(path -> suffix text) for files and for
// collapsed folders. collapsed: Set of folder paths shown without children.
export function renderTree(rootName, files, { marks = new Map(), collapsed = new Set() } = {}) {
  const root = { name: rootName, dirs: new Map(), files: [] };

  for (const path of [...files].sort(comparePaths)) {
    const parts = path.split("/");
    let node = root;
    let prefix = "";
    let hidden = false;
    for (let i = 0; i < parts.length - 1; i++) {
      prefix = prefix ? prefix + "/" + parts[i] : parts[i];
      if (!node.dirs.has(parts[i])) node.dirs.set(parts[i], { name: parts[i], path: prefix, dirs: new Map(), files: [] });
      node = node.dirs.get(parts[i]);
      if (collapsed.has(prefix)) { hidden = true; break; }
    }
    if (!hidden) node.files.push({ name: parts[parts.length - 1], path });
  }

  const lines = [rootName + "/"];
  walk(root, "", lines, marks, collapsed);
  return lines.join("\n");
}

function walk(node, indent, lines, marks, collapsed) {
  const children = [
    ...[...node.dirs.values()].map((d) => ({ dir: true, ...d })),
    ...node.files.map((f) => ({ dir: false, ...f })),
  ];
  children.forEach((child, i) => {
    const last = i === children.length - 1;
    const mark = marks.get(child.path);
    const label = child.name + (child.dir ? "/" : "") + (mark ? "  " + mark : "");
    lines.push(indent + (last ? "`-- " : "|-- ") + label);
    if (child.dir && !collapsed.has(child.path)) {
      walk(child, indent + (last ? "    " : "|   "), lines, marks, collapsed);
    }
  });
}
