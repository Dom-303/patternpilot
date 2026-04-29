import readline from "node:readline";

export function createPrompter({ input = process.stdin, output = process.stdout } = {}) {
  const rl = readline.createInterface({ input, output, terminal: false });

  const pendingLines = [];
  const pendingResolvers = [];
  let closed = false;

  rl.on("line", (l) => {
    if (pendingResolvers.length > 0) pendingResolvers.shift().resolve(l.trim());
    else pendingLines.push(l.trim());
  });

  rl.on("close", () => {
    closed = true;
    while (pendingResolvers.length > 0) {
      pendingResolvers.shift().reject(new Error("input stream closed (Ctrl+D or EOF)"));
    }
  });

  function write(s) { output.write(s); }

  function nextLine() {
    if (pendingLines.length > 0) return Promise.resolve(pendingLines.shift());
    if (closed) return Promise.reject(new Error("input stream closed (Ctrl+D or EOF)"));
    return new Promise((resolve, reject) => pendingResolvers.push({ resolve, reject }));
  }

  async function ask(question) {
    write(question + " ");
    return nextLine();
  }

  async function askMasked(question) {
    return ask(question);
  }

  async function choose(question, options) {
    const def = options.find((o) => o.default);
    while (true) {
      write(question + "\n");
      for (const o of options) {
        const marker = o.default ? "> " : "  ";
        write(`${marker}[${o.key}] ${o.label}\n`);
      }
      const raw = (await ask(">"));
      if (raw === "" && def) return def.key;
      const hit = options.find((o) => o.key.toUpperCase() === raw.toUpperCase());
      if (hit) return hit.key;
      write("Bitte eine der angebotenen Optionen wählen.\n");
    }
  }

  async function confirm(question, { default: def = true } = {}) {
    const suffix = def ? "[Y/n]" : "[y/N]";
    const raw = (await ask(`${question} ${suffix}`)).toLowerCase();
    if (raw === "") return def;
    return raw === "y" || raw === "j" || raw === "yes" || raw === "ja";
  }

  function close() { rl.close(); }

  return { ask, askMasked, choose, confirm, close, write };
}
