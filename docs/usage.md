# Using gittomd

## What you can pass

| Input | Meaning |
|---|---|
| `owner/repo` | the main branch of a GitHub repository |
| `owner/repo@ref` | a branch, tag or commit |
| `https://github.com/owner/repo` | the same, as a URL (`.git` at the end is fine) |
| `https://github.com/owner/repo/tree/<ref>/<folder>` | only that folder, at that ref |
| `git@github.com:owner/repo.git` | SSH style URL |
| `.` or `./path` or `/abs/path` | a local folder |

Branch names with a slash (`feature/login`) work in URLs too: the command tries
the shortest ref first and moves folder parts into it until one exists.

## Options

### Output

| Option | Default | What it does |
|---|---|---|
| `-o, --output <file>` | `<repo>.md` | where to write the document |
| `--stdout` | off | write to standard output instead of a file |
| `-c, --copy` | off | also copy the result to the clipboard (pbcopy, clip, wl-copy, xclip or xsel) |
| `--split <tokens>` | off | split into several files of about that many tokens: `--split 100k` |
| `--lang <es\|en>` | system | language of the headings and the default instruction |
| `--prompt <text>` | a default text | instruction for the AI at the top |
| `--no-prompt` | | no instruction at all |
| `--no-tree` | | leave out the folder tree |
| `--no-contents` | | only the summary and the tree |

### What goes in

| Option | Default | What it does |
|---|---|---|
| `-r, --ref <ref>` | main branch | branch, tag or commit |
| `-s, --subdir <folder>` | whole repo | only that folder |
| `-i, --include <glob>` | everything | only files that match; repeat it or separate with commas |
| `-e, --exclude <glob>` | nothing | leave out files that match |
| `--max-file-size <n>` | `512k` | skip files larger than this (`100k`, `2M`) |
| `--max-total <n>` | no limit | stop adding files once the total reaches this |
| `--include-lockfiles` | off | keep `package-lock.json`, `yarn.lock`, `Cargo.lock` and similar |
| `--include-minified` | off | keep `*.min.js`, `*.min.css` and `*.map` |
| `--no-gitignore` | | ignore the `.gitignore` rules |

Globs follow `.gitignore` rules: `*.js` matches at any depth, `src/*.js` only
directly inside `src`, `docs/` a whole folder and `**` any number of folders.

### Access

| Option | What it does |
|---|---|
| `-t, --token <token>` | token for this run |
| `--no-input` | never ask anything; fail with a hint instead |
| `-q, --quiet` | no progress messages |

Environment variables: `GITHUB_TOKEN`, `GH_TOKEN` or `GITTOMD_TOKEN` for the
token, `GITTOMD_LANG` for the language, `NO_COLOR` to turn colours off.

## Private repositories

When a repository is not found and no token was given, the command asks:

```
No encuentro el repositorio owner/secret.
¿Es un repositorio privado? [s/N] s
```

Answer yes and it tries, in this order:

1. **The GitHub CLI.** If `gh` is installed and signed in, its token is used.
2. **Browser sign-in.** It shows a code, opens github.com/login/device and
   waits while you approve it. The token is saved for next time.
3. **A pasted token.** Create a fine-grained token with read-only access to
   *Contents* on the repository and paste it (it is not shown while you type).

`gittomd login` does the same sign-in without converting anything, and
`gittomd logout` deletes the saved token. It lives in
`~/.config/gittomd/token` with permissions 600.

## Ignore files

Create `.gittomdignore` in the repository with the same syntax as `.gitignore`
to leave paths out every time, without touching what git ignores:

```
docs/archive/
*.snap
fixtures/**/*.json
```

## The document

```
# owner/repo
Generated with gittomd on 2026-09-26.
## Instructions for the AI      the prompt, unless --no-prompt
## Summary                      source, description, ref, commit, counts, tokens
## Structure                    ASCII tree, skipped files marked
## Files                        root README first, then the tree order
### `path/to/file`              one code block per file
## Skipped files                table with the reason for each one
```

## The web version

[elblogdeismael.github.io/gittomd](https://elblogdeismael.github.io/gittomd/)
does the same in the browser. Load the repository, untick the files you do not
want and generate. For private repositories it asks for a token, because
GitHub's sign-in pages cannot be called from a web page. The token stays in the
tab and is only sent to `api.github.com`. `?repo=owner/repo` in the address
loads a repository straight away.
