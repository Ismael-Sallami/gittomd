import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fenceFor, inlineCode, buildMarkdown, planEntries, decodeText, parseRepoInput,
  renderTree, languageFor, parseIgnore, createMatcher, estimateTokens, parseSize, parseCount, comparePaths,
} from "../src/core/index.js";

test("fence is longer than any backtick run in the file", () => {
  assert.equal(fenceFor("no ticks"), "```");
  assert.equal(fenceFor("a ``` b"), "````");
  assert.equal(fenceFor("`````"), "``````");
  assert.equal(inlineCode("a`b"), "`` a`b ``");
});

test("a file with its own code fences stays inside its block", () => {
  const content = "# Title\n\n```js\nconsole.log(1)\n```\n";
  const { parts } = buildMarkdown({ title: "o/r", lang: "en" }, [{ path: "README.md", content, size: content.length }], []);
  const md = parts[0];
  assert.match(md, /````markdown\n# Title/);
  assert.ok(md.includes("```\n````\n"));
});

test("blank lines inside files are kept as they are", () => {
  const content = "a\n\n\n\nb";
  const { parts } = buildMarkdown({ title: "o/r" }, [{ path: "x.txt", content, size: 8 }], []);
  assert.ok(parts[0].includes("a\n\n\n\nb"));
});

test("root README goes first", () => {
  const files = [
    { path: "src/a.js", content: "1", size: 1 },
    { path: "README.md", content: "hi", size: 2 },
  ];
  const md = buildMarkdown({ title: "o/r" }, files, []).parts[0];
  assert.ok(md.indexOf("### `README.md`") < md.indexOf("### `src/a.js`"));
});

test("split produces several parts and every file appears once", () => {
  const files = Array.from({ length: 10 }, (_, i) => ({ path: `f${i}.txt`, content: "x".repeat(4000), size: 4000 }));
  const { parts } = buildMarkdown({ title: "o/r", split: 2500 }, files, []);
  assert.ok(parts.length > 1);
  const all = parts.join("\n");
  for (const f of files) assert.equal(all.split("### `" + f.path + "`").length, 2);
});

test("no prompt, custom prompt and default prompt", () => {
  const none = buildMarkdown({ title: "o/r", prompt: false }, [], []).parts[0];
  assert.ok(!none.includes("## Instrucciones"));
  const custom = buildMarkdown({ title: "o/r", prompt: "Hazme un resumen" }, [], []).parts[0];
  assert.ok(custom.includes("Hazme un resumen"));
  const def = buildMarkdown({ title: "o/r", prompt: true, lang: "en" }, [], []).parts[0];
  assert.ok(def.includes("## Instructions for the AI"));
});

test("output has no long dashes or middle dots", () => {
  const md = buildMarkdown({ title: "o/r", prompt: true, meta: { source: "x", ref: "main" } },
    [{ path: "a.txt", content: "a", size: 1 }], [{ path: "b.png", size: 1, reason: "binary" }]).parts[0];
  assert.ok(!/[\u2014\u2013\u00b7]/.test(md));
});

test("planEntries skips the usual suspects with a reason", () => {
  const entries = [
    "src/index.js", "package-lock.json", "logo.png", "dist/app.min.js", "node_modules/x/index.js",
    "big.txt", "docs/readme.md", "link",
  ].map((path) => ({ path, size: path === "big.txt" ? 10 * 1024 * 1024 : 100, type: path === "link" ? "symlink" : "file" }));
  const { selected, skipped } = planEntries(entries);
  assert.deepEqual(selected.map((e) => e.path), ["docs/readme.md", "src/index.js"]);
  const reason = Object.fromEntries(skipped.map((s) => [s.path, s.reason]));
  assert.equal(reason["package-lock.json"], "lockfile");
  assert.equal(reason["logo.png"], "binary");
  assert.equal(reason["dist/app.min.js"], "minified");
  assert.equal(reason["node_modules/x/index.js"], "ignored-dir");
  assert.equal(reason["big.txt"], "too-large");
  assert.equal(reason["link"], "symlink");
});

test("include, exclude, subdir and total limit", () => {
  const entries = ["a.js", "b.py", "src/c.js", "src/d.test.js", "docs/e.md"].map((path) => ({ path, size: 10 }));
  assert.deepEqual(planEntries(entries, { include: ["*.js"] }).selected.map((e) => e.path), ["src/c.js", "src/d.test.js", "a.js"]);
  assert.deepEqual(planEntries(entries, { exclude: ["*.test.js", "docs/"] }).selected.map((e) => e.path), ["src/c.js", "a.js", "b.py"]);
  assert.deepEqual(planEntries(entries, { subdir: "src" }).selected.map((e) => e.path), ["src/c.js", "src/d.test.js"]);
  assert.equal(planEntries(entries, { maxTotalSize: 25 }).selected.length, 2);
});

test(".gitignore and .gittomdignore rules, nested and negated", () => {
  const entries = ["app.log", "keep.log", "src/gen/x.js", "src/main.js", "secret.env", "notes/todo.md"].map((path) => ({ path, size: 1 }));
  const ignore = { ".gitignore": "*.log\n!keep.log\n", "src/.gitignore": "gen/\n", ".gittomdignore": "*.env\nnotes/\n" };
  const { selected, skipped } = planEntries(entries, {}, ignore);
  assert.deepEqual(selected.map((e) => e.path), ["src/main.js", "keep.log"]);
  const reason = Object.fromEntries(skipped.map((s) => [s.path, s.reason]));
  assert.equal(reason["app.log"], "gitignore");
  assert.equal(reason["src/gen/x.js"], "gitignore");
  assert.equal(reason["secret.env"], "gittomdignore");
  assert.equal(reason["notes/todo.md"], "gittomdignore");
  assert.equal(planEntries(entries, { useGitignore: false }, ignore).selected.length, 4);
});

test("gitignore patterns", () => {
  const m = createMatcher(parseIgnore("/build\n**/tmp/**\ndocs/*.pdf\n*.py[co]\n{a,b}.txt\n"));
  assert.ok(m("build/x.js"));
  assert.ok(!m("src/build/x.js"));
  assert.ok(m("a/tmp/b/c"));
  assert.ok(m("docs/x.pdf"));
  assert.ok(!m("docs/sub/x.pdf"));
  assert.ok(m("x/y.pyc"));
  assert.ok(m("a.txt") && m("dir/b.txt") && !m("c.txt"));
});

test("binary detection", () => {
  assert.equal(decodeText(new Uint8Array([104, 105])), "hi");
  assert.equal(decodeText(new Uint8Array([104, 0, 105])), null);
  assert.equal(decodeText(new Uint8Array([0xff, 0xfe, 0x41])), null);
  assert.equal(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x41])), "A");
  assert.equal(decodeText(new TextEncoder().encode("ñandú")), "ñandú");
});

test("repository input forms", () => {
  const p = (s) => parseRepoInput(s);
  assert.deepEqual(p("owner/repo"), { owner: "owner", repo: "repo", ref: "", subdir: "" });
  assert.deepEqual(p("owner/repo@v1.2"), { owner: "owner", repo: "repo", ref: "v1.2", subdir: "" });
  assert.deepEqual(p("https://github.com/o/r.git"), { owner: "o", repo: "r", ref: "", subdir: "" });
  assert.deepEqual(p("https://github.com/o/r/tree/main/src/lib"), { owner: "o", repo: "r", ref: "main", subdir: "src/lib" });
  assert.deepEqual(p("https://github.com/o/r/blob/dev/src/a.js"), { owner: "o", repo: "r", ref: "dev", subdir: "src" });
  assert.deepEqual(p("github.com/o/r?tab=readme"), { owner: "o", repo: "r", ref: "", subdir: "" });
  assert.deepEqual(p("git@github.com:o/r.git"), { owner: "o", repo: "r", ref: "", subdir: "" });
  assert.equal(p("./folder"), null);
  assert.equal(p("/abs/path"), null);
  assert.equal(p("just-a-word"), null);
  assert.equal(p("https://gitlab.com/o/r"), null);
});

test("tree in plain ASCII with collapsed folders", () => {
  const tree = renderTree("r", ["b.txt", "a/x.js", "a/y.js", "nm/deep/z.js"], {
    collapsed: new Set(["nm"]), marks: new Map([["nm", "[skipped]"]]),
  });
  assert.equal(tree, "r/\n|-- a/\n|   |-- x.js\n|   `-- y.js\n|-- nm/  [skipped]\n`-- b.txt");
});

test("languages", () => {
  assert.equal(languageFor("src/app.tsx"), "tsx");
  assert.equal(languageFor("Dockerfile"), "dockerfile");
  assert.equal(languageFor("docker/Dockerfile.prod"), "dockerfile");
  assert.equal(languageFor("Makefile"), "makefile");
  assert.equal(languageFor("x.unknown"), "");
});

test("numbers", () => {
  assert.equal(estimateTokens("abcd".repeat(10)), 10);
  assert.equal(parseSize("512k"), 524288);
  assert.equal(parseSize("2MB"), 2097152);
  assert.ok(Number.isNaN(parseSize("lots")));
  assert.equal(parseCount("100k"), 100000);
  assert.ok(comparePaths("a/b", "a.txt") < 0);
});
