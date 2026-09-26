// Questions in the terminal. Everything goes to stderr so that --stdout stays
// clean.

import readline from "node:readline";

export function canAsk() {
  return Boolean(process.stdin.isTTY && process.stderr.isTTY);
}

export function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Reads a secret without echoing it.
export function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    let muted = false;
    const write = rl._writeToOutput;
    rl._writeToOutput = function (text) {
      if (!muted) write.call(rl, text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stderr.write("\n");
      resolve(answer.trim());
    });
    muted = true;
  });
}

// Yes/no question. `yes` is the list of accepted answers for yes.
export async function confirm(question, { defaultYes = false } = {}) {
  const answer = (await ask(question)).toLowerCase();
  if (!answer) return defaultYes;
  return ["s", "si", "sí", "y", "yes"].includes(answer);
}
