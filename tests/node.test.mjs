import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readTar } from "../src/node/tar.js";
import { parseArgs } from "../src/node/cli.js";
import { deviceFlow } from "../src/node/auth.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(root, "bin/gittomd.js");

function header(name, size, flag = "0") {
  const h = Buffer.alloc(512);
  h.write(name, 0, 100);
  h.write("0000644\0", 100);
  h.write(size.toString(8).padStart(11, "0") + "\0", 124);
  h.write(flag, 156);
  h.write("ustar\0", 257);
  h.write("00", 263);
  h.fill(" ", 148, 156);
  let sum = 0;
  for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
  return h;
}
const pad = (buf) => Buffer.concat([buf, Buffer.alloc((512 - (buf.length % 512)) % 512)]);
function pax(fields) {
  let text = "";
  for (const [k, v] of Object.entries(fields)) {
    const rec = ` ${k}=${v}\n`;
    let len = rec.length + 1;
    while (String(len).length + rec.length !== len) len = String(len).length + rec.length;
    text += len + rec;
  }
  return Buffer.from(text);
}

test("tar reader handles ustar, pax paths and the global comment", () => {
  const longName = "repo-abc/" + "deep/".repeat(30) + "file.txt";
  const g = pax({ comment: "abc123" });
  const x = pax({ path: longName });
  const tar = Buffer.concat([
    header("pax_global_header", g.length, "g"), pad(g),
    header("repo-abc/", 0, "5"),
    header("repo-abc/hello.txt", 5), pad(Buffer.from("hello")),
    header("PaxHeader", x.length, "x"), pad(x),
    header("ignored-short-name", 3), pad(Buffer.from("abc")),
    header("repo-abc/link", 0, "2"),
    Buffer.alloc(1024),
  ]);
  const { entries, comment } = readTar(gzipSync(tar));
  assert.equal(comment, "abc123");
  assert.deepEqual(entries.map((e) => [e.path, e.type]), [
    ["repo-abc", "dir"], ["repo-abc/hello.txt", "file"], [longName, "file"], ["repo-abc/link", "symlink"],
  ]);
  assert.equal(Buffer.from(entries[1].data).toString(), "hello");
  assert.equal(Buffer.from(entries[2].data).toString(), "abc");
});

test("argument parsing", () => {
  const { values, positionals } = parseArgs(["o/r", "-o", "x.md", "-i", "*.js,*.ts", "--include=*.md", "--no-prompt", "--no-tree", "-q"]);
  assert.deepEqual(positionals, ["o/r"]);
  assert.equal(values.output, "x.md");
  assert.deepEqual(values.include, ["*.js", "*.ts", "*.md"]);
  assert.equal(values.prompt, false);
  assert.equal(values.tree, false);
  assert.equal(values.quiet, true);
  assert.throws(() => parseArgs(["--nope"]));
});

test("device flow polls, slows down and returns the token", async () => {
  const answers = [
    { device_code: "d", user_code: "ABCD-1234", verification_uri: "https://github.com/login/device", interval: 5, expires_in: 900 },
    { error: "authorization_pending" },
    { error: "slow_down", interval: 10 },
    { access_token: "gho_x" },
  ];
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push([url, init.body]);
    return { ok: true, status: 200, json: async () => answers.shift() };
  };
  const waits = [];
  let shown;
  const token = await deviceFlow("cid", { fetchImpl, wait: async (ms) => waits.push(ms), onCode: (c) => (shown = c.user_code) });
  assert.equal(token, "gho_x");
  assert.equal(shown, "ABCD-1234");
  assert.deepEqual(waits, [5000, 5000, 10000]);
  assert.match(calls[0][1], /client_id=cid&scope=repo/);
});

test("the CLI converts a local folder end to end", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gittomd-"));
  fs.mkdirSync(path.join(dir, "src"));
  fs.mkdirSync(path.join(dir, "node_modules/pkg"), { recursive: true });
  fs.writeFileSync(path.join(dir, "README.md"), "# Demo\n");
  fs.writeFileSync(path.join(dir, "src/app.js"), "console.log('hi')\n");
  fs.writeFileSync(path.join(dir, "src/debug.log"), "noise\n");
  fs.writeFileSync(path.join(dir, ".gitignore"), "*.log\n");
  fs.writeFileSync(path.join(dir, "image.bin"), Buffer.from([0, 1, 2]));
  fs.writeFileSync(path.join(dir, "data.xyz"), Buffer.from([1, 0, 2]));
  fs.writeFileSync(path.join(dir, "node_modules/pkg/index.js"), "x");

  const res = spawnSync(process.execPath, [bin, dir, "--stdout", "--lang", "en", "--no-prompt"], { encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr);
  const md = res.stdout;
  assert.ok(md.includes("### `README.md`"));
  assert.ok(md.includes("```javascript\nconsole.log('hi')\n```"));
  assert.ok(!md.includes("node_modules"));
  assert.ok(md.includes("| `src/debug.log` | ignored by .gitignore |"));
  assert.ok(md.includes("| `data.xyz` | binary file |"));
  assert.ok(!md.includes("## Instructions for the AI"));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the CLI explains a bad input and exits with 2", () => {
  const res = spawnSync(process.execPath, [bin, "not a repo", "--lang", "en"], { encoding: "utf8" });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /neither a GitHub repository nor a local folder/);
});

test("the CLI does not try the owner/repo example", () => {
  const res = spawnSync(process.execPath, [bin, "owner/repo", "--lang", "en"], { encoding: "utf8" });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /just the example/);
});

test("--version matches package.json", () => {
  const out = execFileSync(process.execPath, [bin, "--version"]).toString().trim();
  assert.equal(out, JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version);
});
