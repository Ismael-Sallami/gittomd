// Texts used in the generated Markdown and in the CLI, in Spanish and English.
// Plain wording on purpose: no long dashes, no decorative symbols.

export const MESSAGES = {
  es: {
    generatedBy: "Generado con [gittomd](https://github.com/Ismael-Sallami/gittomd), creado por Ismael Sallami.",
    summary: "Resumen",
    date: "Fecha",
    source: "Origen",
    description: "Descripción",
    ref: "Rama o ref",
    commit: "Commit",
    included: "Ficheros incluidos",
    skipped: "Ficheros omitidos",
    size: "Tamaño del contenido",
    tokens: "Tokens estimados",
    part: "Parte",
    of: "de",
    structure: "Estructura",
    files: "Ficheros",
    skippedTitle: "Ficheros omitidos",
    skippedIntro: "Estos ficheros aparecen en la estructura pero su contenido no se ha incluido.",
    file: "Fichero",
    reason: "Motivo",
    omittedMark: "[omitido]",
    filesInside: "{n} ficheros dentro",
    emptyFile: "(fichero vacío)",
    more: "Y {n} más.",
    reasons: {
      "ignored-dir": "carpeta ignorada por defecto",
      gitignore: "ignorado por .gitignore",
      gittomdignore: "ignorado por .gittomdignore",
      exclude: "excluido con --exclude",
      "not-included": "no coincide con --include",
      "outside-subdir": "fuera de la subcarpeta",
      lockfile: "fichero de bloqueo de dependencias",
      binary: "fichero binario",
      minified: "fichero minificado o mapa de código",
      "too-large": "supera el tamaño máximo por fichero",
      "total-limit": "se alcanzó el límite total",
      symlink: "enlace simbólico",
      "no-contents": "contenido desactivado con --no-contents",
      "fetch-error": "no se pudo descargar",
      "user-excluded": "desmarcado a mano",
    },
  },
  en: {
    generatedBy: "Generated with [gittomd](https://github.com/Ismael-Sallami/gittomd), made by Ismael Sallami.",
    summary: "Summary",
    date: "Date",
    source: "Source",
    description: "Description",
    ref: "Branch or ref",
    commit: "Commit",
    included: "Files included",
    skipped: "Files skipped",
    size: "Content size",
    tokens: "Estimated tokens",
    part: "Part",
    of: "of",
    structure: "Structure",
    files: "Files",
    skippedTitle: "Skipped files",
    skippedIntro: "These files appear in the structure but their content was left out.",
    file: "File",
    reason: "Reason",
    omittedMark: "[skipped]",
    filesInside: "{n} files inside",
    emptyFile: "(empty file)",
    more: "And {n} more.",
    reasons: {
      "ignored-dir": "folder ignored by default",
      gitignore: "ignored by .gitignore",
      gittomdignore: "ignored by .gittomdignore",
      exclude: "excluded with --exclude",
      "not-included": "does not match --include",
      "outside-subdir": "outside the subfolder",
      lockfile: "dependency lock file",
      binary: "binary file",
      minified: "minified file or source map",
      "too-large": "larger than the per-file limit",
      "total-limit": "total limit reached",
      symlink: "symbolic link",
      "no-contents": "contents disabled with --no-contents",
      "fetch-error": "could not be downloaded",
      "user-excluded": "unticked by hand",
    },
  },
};

export function pickLang(value) {
  const v = String(value || "").toLowerCase();
  if (v.startsWith("es")) return "es";
  if (v.startsWith("en")) return "en";
  return null;
}

export function t(lang, key, vars) {
  const table = MESSAGES[lang] || MESSAGES.es;
  let text = key.split(".").reduce((o, k) => (o ? o[k] : undefined), table);
  if (text === undefined) text = key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  }
  return text;
}
