import fs from "node:fs";

export function loadReplay(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

  function get(stepPath) {
    const parts = stepPath.split(".");
    let cur = data;
    for (const p of parts) {
      if (cur === undefined || cur === null || !(p in cur)) {
        const err = new Error(`Replay unvollständig: kein Wert für Step ${stepPath}`);
        err.code = "REPLAY_INCOMPLETE";
        err.exitCode = 3;
        throw err;
      }
      cur = cur[p];
    }
    return cur;
  }

  return { get, raw: data };
}
