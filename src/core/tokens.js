// Rough token count without a tokenizer. Modern tokenizers average about four
// characters per token on English text and code; text with many non-Latin
// characters uses more tokens, so those count more. The number is an estimate
// meant to tell whether the file fits a model's context, not an exact bill.

export function estimateTokens(text) {
  if (!text) return 0;
  let ascii = 0;
  let other = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) < 128) ascii++;
    else other++;
  }
  return Math.ceil(ascii / 4 + other / 1.5);
}

export function formatTokens(n) {
  if (n < 1000) return String(n);
  if (n < 1e6) return (n / 1000).toFixed(n < 10000 ? 1 : 0) + "k";
  return (n / 1e6).toFixed(2) + "M";
}

export function formatBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}

// Accepts "500", "500k", "2M", "512KB", "1.5mb". Returns bytes (or a count
// when used for tokens). Returns NaN on bad input.
export function parseSize(value) {
  const m = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*([kmg]?)b?$/i);
  if (!m) return NaN;
  const mult = { "": 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[m[2].toLowerCase()];
  return Math.round(parseFloat(m[1]) * mult);
}

export function parseCount(value) {
  const m = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*([km]?)$/i);
  if (!m) return NaN;
  const mult = { "": 1, k: 1000, m: 1e6 }[m[2].toLowerCase()];
  return Math.round(parseFloat(m[1]) * mult);
}
