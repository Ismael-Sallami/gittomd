# gittomd

[![tests](https://github.com/Ismael-Sallami/gittomd/actions/workflows/ci.yml/badge.svg)](https://github.com/Ismael-Sallami/gittomd/actions/workflows/ci.yml)

Turn a GitHub repository, public or private, or a local folder into a single
Markdown file: a summary, the folder tree and the content of every file. Give
that file to an AI and it has the whole project in front of it.

```bash
curl -fsSL https://raw.githubusercontent.com/Ismael-Sallami/gittomd/main/install.sh | bash
gittomd owner/repo
```

There is also a web version that runs in the browser:
[elblogdeismael.github.io/gittomd](https://elblogdeismael.github.io/gittomd/).

## Context

Built for [El Blog de Ismael](https://elblogdeismael.github.io), next to three
other small tools. I kept pasting files one by one into a chat to ask questions
about a project, and the AI kept missing the file that mattered. Tools like
gitingest and repomix already solve this; I wanted one with no dependencies,
that asks before giving up on a private repo, and that shares its code with a
page on the blog. Solo work.

## The problem

Putting a repository into one text file sounds like `cat`, but a few details
decide whether the result is useful:

- **What to leave out.** Lock files, images, minified bundles and
  `node_modules` can be most of a repo by size and tell an AI nothing.
- **Code blocks inside files.** A README with its own fenced code closes the
  Markdown block early and the rest of the document is broken.
- **Private repos.** GitHub answers 404 both for a repo that does not exist
  and for a private one when you are not signed in, so a tool cannot tell
  them apart on its own.
- **The browser.** GitHub's sign-in endpoints and its archive downloads do not
  allow calls from a web page, so the web version cannot work the same way as
  the command line.

## The solution

The core is plain JavaScript with no Node APIs, so the command line and the
web page run the same code. It decides file by file what goes in, using only
paths and sizes, so the web page can filter before downloading anything:

- folders like `node_modules`, `.git` or `__pycache__`, lock files, binary
  extensions, minified files and files over 512 KB are skipped;
- `.gitignore` files (nested ones too) and a `.gittomdignore` of your own are
  applied, with the usual glob rules and `!` to re-include;
- a file that turns out to be binary once downloaded (a NUL byte, or bytes that
  are not UTF-8) is skipped as well.

Skipped files still appear in the tree and in a table with the reason, so the
AI knows they exist. Each file goes in a code block whose fence is **one
backtick longer than the longest run inside the file**, so nothing in the file
can close it.

On a 404 the command asks whether the repo is private. If you say yes it uses,
in order: your GitHub CLI session (`gh auth token`), a browser sign-in with
GitHub's device flow, or a token you paste. A token given with `--token`,
`GITHUB_TOKEN` or `gittomd login` is used from the start. The command line
downloads one tarball per repo, so it needs three API calls in total.

The web page asks for a read-only token instead, keeps it in the tab's session
storage and sends it only to `api.github.com`. Public files come from
`raw.githubusercontent.com`, which does not count against the API limit.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/Ismael-Sallami/gittomd/main/install.sh | bash
```

It needs Node.js 18 or newer. It puts the code in `~/.local/share/gittomd` and
the command in `~/.local/bin`, without sudo. `bash install.sh --uninstall`
removes it.

Without the script:

```bash
npm install -g github:Ismael-Sallami/gittomd   # install
npx github:Ismael-Sallami/gittomd owner/repo   # run once without installing
```

## Usage

```bash
gittomd owner/repo                             # writes repo.md
gittomd https://github.com/owner/repo/tree/dev/docs
gittomd owner/repo@v2.0 -o context.md
gittomd . --exclude "tests/,*.snap" --copy     # a local folder, to the clipboard
gittomd owner/repo --include "src/**,*.md" --no-prompt
gittomd owner/repo --split 100k                # repo-1.md, repo-2.md...
gittomd owner/repo --stdout | wc -c
gittomd login                                  # save a token for private repos
```

By default the document starts with a short instruction asking the AI to
explain the project. Change it with `--prompt "..."` or drop it with
`--no-prompt`. The document language follows the system (`--lang es` or
`--lang en` to choose). Every option is described in
[`docs/usage.md`](docs/usage.md) and in `gittomd --help`.

## Layout

```
bin/gittomd.js        the command
src/core/             shared by the command and the web page, no Node APIs
  filters.js          what goes in and why the rest does not
  gitignore.js        glob and .gitignore matching
  markdown.js         the document: summary, tree, files, skipped table
  tree.js             the ASCII folder tree
  github.js           URL parsing and the GitHub REST calls
  languages.js        file extension to code block language
  tokens.js           token estimate and size parsing
  i18n.js             Spanish and English texts
src/node/             the command only: tarball reader, sign-in, prompts
web/                  the web page, with the core bundled as one script
scripts/build-web.mjs bundles src/core into web/js/gittomd-core.js
install.sh            the one-line installer
tests/                node:test suites
```

## Requirements

Node.js 18 or newer. **No dependencies**: no `npm install`, no bundler, no
build step for the command. The web page is static HTML and two scripts.

## Build and run

```bash
git clone https://github.com/Ismael-Sallami/gittomd.git
cd gittomd

node bin/gittomd.js owner/repo       # run without installing
npm test                             # the test suites
npm run build:web                    # rebuild web/js/gittomd-core.js after changing src/core
python3 -m http.server -d web 8000   # the web page at http://localhost:8000
```

## Results

```
node --test: 23 tests, 0 failures (Node 18, 20 and 22 in CI)
```

The tests cover the fences with backticks inside files, blank lines kept as
they are, `.gitignore` rules (nested, negated, folder only), binary detection,
the tar reader with long pax paths, the device flow polling, argument parsing
and a full run of the command on a temporary folder. CI also checks that the
web bundle matches `src/core`, lints the installer with shellcheck and installs
it into an empty home.

## What I learned

- **Filtering on paths first pays twice.** The web page can show the file list
  and skip binaries before downloading a single byte, and the command line
  never reads the files it will drop.
- **A 404 is an answer about access, not about existence.** Asking the user is
  the only honest way to go on, and it is cheap.
- **The limitation**: token counts are an estimate (about four characters per
  token), not a real tokenizer. And a very large repository can still be too
  big for any model; `--include`, `--subdir` and `--split` are the way out.

## Author and licence

Ismael Sallami Moreno. Released under the MIT licence (see `LICENSE`).

The web version is deployed at
[elblogdeismael.github.io/gittomd](https://elblogdeismael.github.io/gittomd/).
That site keeps its own copy of `web/`: **if the core changes, run
`npm run build:web` and copy `web/js/gittomd-core.js` there too.**
