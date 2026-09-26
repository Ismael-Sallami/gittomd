// File extension or name to the language tag of a Markdown code block.

const BY_EXT = {
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "jsx",
  ts: "typescript", mts: "typescript", cts: "typescript", tsx: "tsx",
  py: "python", pyi: "python", pyw: "python", ipynb: "json",
  rb: "ruby", php: "php", java: "java", kt: "kotlin", kts: "kotlin",
  scala: "scala", groovy: "groovy", gradle: "groovy", go: "go", rs: "rust",
  c: "c", h: "c", cc: "cpp", cpp: "cpp", cxx: "cpp", hpp: "cpp", hh: "cpp", hxx: "cpp",
  cs: "csharp", fs: "fsharp", vb: "vbnet", swift: "swift", m: "objectivec", mm: "objectivec",
  dart: "dart", lua: "lua", r: "r", jl: "julia", pl: "perl", pm: "perl",
  ex: "elixir", exs: "elixir", erl: "erlang", hrl: "erlang", hs: "haskell",
  clj: "clojure", cljs: "clojure", ml: "ocaml", mli: "ocaml", elm: "elm",
  nim: "nim", zig: "zig", v: "v", sol: "solidity", asm: "asm", s: "asm",
  sh: "bash", bash: "bash", zsh: "bash", fish: "fish", ps1: "powershell", psm1: "powershell",
  bat: "bat", cmd: "bat",
  html: "html", htm: "html", xhtml: "html", vue: "vue", svelte: "svelte", astro: "astro",
  css: "css", scss: "scss", sass: "sass", less: "less", styl: "stylus",
  json: "json", jsonc: "jsonc", json5: "json5", yaml: "yaml", yml: "yaml",
  toml: "toml", ini: "ini", cfg: "ini", conf: "conf", env: "bash", properties: "properties",
  xml: "xml", svg: "xml", xsd: "xml", xsl: "xml", plist: "xml", csproj: "xml",
  md: "markdown", mdx: "mdx", markdown: "markdown", rst: "rst", adoc: "asciidoc",
  tex: "latex", sty: "latex", cls: "latex", bib: "bibtex",
  sql: "sql", graphql: "graphql", gql: "graphql", proto: "protobuf", prisma: "prisma",
  tf: "hcl", tfvars: "hcl", hcl: "hcl", nix: "nix", dockerfile: "dockerfile",
  mk: "makefile", cmake: "cmake", csv: "csv", tsv: "tsv", txt: "text", log: "text",
  diff: "diff", patch: "diff", vim: "vim", el: "elisp", lisp: "lisp", scm: "scheme",
  pas: "pascal", f90: "fortran", f: "fortran", cob: "cobol", ada: "ada", d: "d",
  cr: "crystal", hx: "haxe", tcl: "tcl", awk: "awk", sed: "sed", pug: "pug",
  hbs: "handlebars", ejs: "ejs", erb: "erb", j2: "jinja", jinja: "jinja", twig: "twig",
  liquid: "liquid", glsl: "glsl", hlsl: "hlsl", wgsl: "wgsl", cu: "cuda",
};

const BY_NAME = {
  dockerfile: "dockerfile", containerfile: "dockerfile", makefile: "makefile",
  gnumakefile: "makefile", cmakelists: "cmake", "cmakelists.txt": "cmake",
  rakefile: "ruby", gemfile: "ruby", podfile: "ruby", vagrantfile: "ruby",
  jenkinsfile: "groovy", procfile: "yaml", justfile: "makefile",
  ".gitignore": "gitignore", ".dockerignore": "gitignore", ".gittomdignore": "gitignore",
  ".npmignore": "gitignore", ".gitattributes": "gitattributes", ".editorconfig": "ini",
  ".bashrc": "bash", ".zshrc": "bash", ".profile": "bash", ".env": "bash",
  "license": "text", "copying": "text", "authors": "text",
};

export function languageFor(path) {
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  if (BY_NAME[name]) return BY_NAME[name];
  if (name.startsWith("dockerfile")) return "dockerfile";
  if (name.startsWith(".env")) return "bash";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "";
  return BY_EXT[name.slice(dot + 1)] || "";
}
