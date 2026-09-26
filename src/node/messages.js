// Terminal messages of the CLI, in Spanish and English.

export const CLI = {
  es: {
    help: `gittomd {version}
Convierte un repositorio de GitHub (o una carpeta local) en un solo fichero
Markdown con el resumen, la estructura y el contenido de cada fichero, listo
para pasárselo a una IA.

Uso:
  gittomd <repo> [opciones]
  gittomd login        inicia sesión en GitHub y guarda el token
  gittomd logout       borra el token guardado

<repo> puede ser:
  owner/repo, owner/repo@rama
  https://github.com/owner/repo
  https://github.com/owner/repo/tree/rama/carpeta
  una carpeta local, por ejemplo .  o  ./mi-proyecto

Salida:
  -o, --output <fichero>   dónde guardar el Markdown (por defecto <repo>.md)
      --stdout             escribir el Markdown en la salida estándar
  -c, --copy               copiar el resultado al portapapeles
      --split <tokens>     partir en varios ficheros, por ejemplo --split 100k
      --lang <es|en>       idioma del documento (por defecto, el del sistema)
      --prompt <texto>     instrucción para la IA al principio del documento
      --no-prompt          no añadir ninguna instrucción
      --no-tree            no incluir el árbol de carpetas
      --no-contents        solo la estructura, sin el contenido de los ficheros

Qué se incluye:
  -r, --ref <ref>          rama, tag o commit (por defecto la rama principal)
  -s, --subdir <carpeta>   convertir solo esa carpeta
  -i, --include <glob>     incluir solo lo que coincida (se puede repetir)
  -e, --exclude <glob>     excluir lo que coincida (se puede repetir)
      --max-file-size <n>  tamaño máximo por fichero (por defecto 512k)
      --max-total <n>      tamaño máximo sumando todos los ficheros
      --include-lockfiles  incluir package-lock.json, yarn.lock y parecidos
      --include-minified   incluir ficheros .min.js, .min.css y .map
      --no-gitignore       no aplicar las reglas de .gitignore

Acceso:
  -t, --token <token>      token de GitHub para repos privados
      --no-input           no hacer preguntas (útil en scripts)
  -q, --quiet              no mostrar el progreso
  -v, --version            mostrar la versión
  -h, --help               mostrar esta ayuda

Variables de entorno: GITHUB_TOKEN, GH_TOKEN o GITTOMD_TOKEN.

Ejemplos:
  gittomd facebook/react -i "packages/react/**" --no-prompt
  gittomd https://github.com/owner/repo/tree/main/docs -o docs.md
  gittomd . --exclude "*.test.js" --copy
`,
    fetching: "Descargando {repo}...",
    reading: "Leyendo {dir}...",
    downloaded: "Descargado: {size}",
    notFound: "No encuentro el repositorio {repo}.",
    askPrivate: "¿Es un repositorio privado? [s/N] ",
    notFoundPublic: "Revisa que el nombre esté bien escrito.",
    notFoundWithToken: "No existe o tu cuenta no tiene acceso a él. Revisa el nombre, o inicia sesión con otra cuenta con `gittomd login`.",
    notFoundNoInput: "Si es privado, usa --token, la variable GITHUB_TOKEN o `gittomd login`.",
    usingGh: "Uso la sesión de GitHub CLI (gh).",
    ghNoAccess: "La sesión de gh no tiene acceso a ese repositorio.",
    chooseAuth: "¿Cómo quieres iniciar sesión?\n  1) En el navegador (recomendado)\n  2) Pegando un token\nElige [1]: ",
    deviceCode: "Abre {url} e introduce este código: {code}",
    deviceOpened: "He abierto el navegador. Esperando a que autorices...",
    deviceWaiting: "Esperando a que autorices...",
    deviceDenied: "Has cancelado el inicio de sesión.",
    deviceExpired: "El código ha caducado. Vuelve a intentarlo.",
    deviceError: "No he podido iniciar sesión: {error}",
    pasteHelp: "Crea un token en https://github.com/settings/personal-access-tokens/new\n(acceso de solo lectura a Contents en el repositorio que quieras) y pégalo aquí.",
    pastePrompt: "Token: ",
    noToken: "No se ha introducido ningún token.",
    saveAsk: "¿Guardar el token para la próxima vez? [S/n] ",
    saved: "Token guardado en {file}",
    loggedIn: "Sesión iniciada como {user}.",
    loggedOut: "Token borrado.",
    loggedOutNothing: "No había ningún token guardado.",
    envStillSet: "Aviso: la variable {name} sigue definida y se seguirá usando.",
    rateLimit: "Se ha agotado el límite de la API de GitHub (60 peticiones por hora sin sesión).",
    rateLimitReset: "Se reinicia a las {time}.",
    rateLimitHint: "Inicia sesión con `gittomd login` o define GITHUB_TOKEN para tener 5000 por hora.",
    authError: "GitHub ha rechazado el token: {error}. Prueba `gittomd logout` y `gittomd login`.",
    networkError: "No he podido conectar con GitHub: {error}",
    badInput: "No reconozco \"{input}\" como repositorio de GitHub ni como carpeta local.",
    missingInput: "Falta el repositorio. Ejemplo: gittomd owner/repo",
    badOption: "Opción no válida: {option}",
    badValue: "Valor no válido para {option}: {value}",
    wrote: "Listo: {file}",
    wroteParts: "Listo: {n} partes ({first} ... {last})",
    stats: "{files} ficheros incluidos, {skipped} omitidos, unos {tokens} tokens.",
    bigWarning: "Es mucho texto para una IA. Puedes partirlo con --split 100k o limitarlo con --include o --subdir.",
    copied: "Copiado al portapapeles.",
    copyFailed: "No he podido copiar al portapapeles (instala xclip, xsel o wl-clipboard).",
  },
  en: {
    help: `gittomd {version}
Turns a GitHub repository (or a local folder) into a single Markdown file with
a summary, the folder structure and the content of every file, ready to give
to an AI.

Usage:
  gittomd <repo> [options]
  gittomd login        sign in to GitHub and save the token
  gittomd logout       delete the saved token

<repo> can be:
  owner/repo, owner/repo@branch
  https://github.com/owner/repo
  https://github.com/owner/repo/tree/branch/folder
  a local folder, for example .  or  ./my-project

Output:
  -o, --output <file>      where to save the Markdown (default <repo>.md)
      --stdout             write the Markdown to standard output
  -c, --copy               copy the result to the clipboard
      --split <tokens>     split into several files, for example --split 100k
      --lang <es|en>       language of the document (default: the system one)
      --prompt <text>      instruction for the AI at the top of the document
      --no-prompt          do not add any instruction
      --no-tree            leave out the folder tree
      --no-contents        structure only, without file contents

What goes in:
  -r, --ref <ref>          branch, tag or commit (default: the main branch)
  -s, --subdir <folder>    convert only that folder
  -i, --include <glob>     include only what matches (can be repeated)
  -e, --exclude <glob>     exclude what matches (can be repeated)
      --max-file-size <n>  size limit per file (default 512k)
      --max-total <n>      size limit for all files together
      --include-lockfiles  include package-lock.json, yarn.lock and similar
      --include-minified   include .min.js, .min.css and .map files
      --no-gitignore       do not apply .gitignore rules

Access:
  -t, --token <token>      GitHub token for private repos
      --no-input           never ask questions (for scripts)
  -q, --quiet              do not show progress
  -v, --version            show the version
  -h, --help               show this help

Environment variables: GITHUB_TOKEN, GH_TOKEN or GITTOMD_TOKEN.

Examples:
  gittomd facebook/react -i "packages/react/**" --no-prompt
  gittomd https://github.com/owner/repo/tree/main/docs -o docs.md
  gittomd . --exclude "*.test.js" --copy
`,
    fetching: "Downloading {repo}...",
    reading: "Reading {dir}...",
    downloaded: "Downloaded: {size}",
    notFound: "Repository {repo} not found.",
    askPrivate: "Is it a private repository? [y/N] ",
    notFoundPublic: "Check that the name is spelled right.",
    notFoundWithToken: "It does not exist or your account has no access to it. Check the name, or sign in with another account using `gittomd login`.",
    notFoundNoInput: "If it is private, use --token, the GITHUB_TOKEN variable or `gittomd login`.",
    usingGh: "Using the GitHub CLI (gh) session.",
    ghNoAccess: "The gh session has no access to that repository.",
    chooseAuth: "How do you want to sign in?\n  1) In the browser (recommended)\n  2) Pasting a token\nChoose [1]: ",
    deviceCode: "Open {url} and enter this code: {code}",
    deviceOpened: "Browser opened. Waiting for you to authorise...",
    deviceWaiting: "Waiting for you to authorise...",
    deviceDenied: "Sign-in cancelled.",
    deviceExpired: "The code expired. Try again.",
    deviceError: "Could not sign in: {error}",
    pasteHelp: "Create a token at https://github.com/settings/personal-access-tokens/new\n(read-only access to Contents on the repository you want) and paste it here.",
    pastePrompt: "Token: ",
    noToken: "No token entered.",
    saveAsk: "Save the token for next time? [Y/n] ",
    saved: "Token saved in {file}",
    loggedIn: "Signed in as {user}.",
    loggedOut: "Token deleted.",
    loggedOutNothing: "There was no saved token.",
    envStillSet: "Note: the {name} variable is still set and will still be used.",
    rateLimit: "GitHub API rate limit reached (60 requests per hour without signing in).",
    rateLimitReset: "It resets at {time}.",
    rateLimitHint: "Sign in with `gittomd login` or set GITHUB_TOKEN to get 5000 per hour.",
    authError: "GitHub rejected the token: {error}. Try `gittomd logout` and `gittomd login`.",
    networkError: "Could not reach GitHub: {error}",
    badInput: "\"{input}\" is neither a GitHub repository nor a local folder.",
    missingInput: "Missing repository. Example: gittomd owner/repo",
    badOption: "Unknown option: {option}",
    badValue: "Bad value for {option}: {value}",
    wrote: "Done: {file}",
    wroteParts: "Done: {n} parts ({first} ... {last})",
    stats: "{files} files included, {skipped} skipped, about {tokens} tokens.",
    bigWarning: "That is a lot of text for an AI. Split it with --split 100k or narrow it with --include or --subdir.",
    copied: "Copied to the clipboard.",
    copyFailed: "Could not copy to the clipboard (install xclip, xsel or wl-clipboard).",
  },
};
