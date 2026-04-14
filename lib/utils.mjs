import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { spawn } from "node:child_process";

export function safeExecGit(rootDir, args) {
  try {
    return execFileSync("git", ["-C", rootDir, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

export async function safeReadDirEntries(dirPath) {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

export function parseEnvContent(content) {
  const entries = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries.push([key, value]);
  }
  return entries;
}

export async function safeReadFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

export async function safeStat(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

export async function safeReadText(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

export async function safeReadDir(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

export function slugifyProjectKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

export function asRelativeFromRoot(rootDir, targetPath) {
  const relative = toPosixPath(path.relative(rootDir, targetPath));
  return relative || ".";
}

export async function pathExists(targetPath) {
  return Boolean(await safeStat(targetPath));
}

export function csvEscape(value) {
  const safe = String(value ?? "");
  if (!safe.includes(";") && !safe.includes('"') && !safe.includes("\n")) {
    return safe;
  }
  return `"${safe.replace(/"/g, '""')}"`;
}

export function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ";" && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

export async function ensureDirectory(dirPath, dryRun) {
  if (dryRun) {
    return;
  }
  await fs.mkdir(dirPath, { recursive: true });
}

export function resolveProjectPath(projectRoot, relativePath) {
  return path.resolve(projectRoot, relativePath);
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runShellCommand(command, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: options.stdio ?? "inherit",
      shell: true
    });

    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve({
        code: code ?? 1,
        signal: signal ?? null
      });
    });
  });
}

export function isoDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

export function calculateDaysSince(dateValue) {
  if (!dateValue) {
    return null;
  }
  const delta = Date.now() - new Date(dateValue).getTime();
  return Math.floor(delta / (1000 * 60 * 60 * 24));
}

export function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function hasSignal(text, signal) {
  return text.toLowerCase().includes(signal.toLowerCase());
}

export function decodeBase64Markdown(content) {
  if (!content) {
    return "";
  }
  return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
}

export function stripMarkdown(markdown, maxChars) {
  const cleaned = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length <= maxChars) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxChars).trim()}...`;
}
