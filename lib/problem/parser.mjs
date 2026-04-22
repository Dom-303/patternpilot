const TEXT_FIELDS = new Set(["description", "current_approach"]);
const LIST_FIELDS = new Set(["success_criteria", "constraints", "non_goals", "suspected_approach_axes"]);
const KEY_VALUE_FIELDS = new Set(["hints"]);

function parseFrontmatter(block) {
  const out = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

function splitSections(body) {
  const sections = {};
  const lines = body.split("\n");
  let currentName = null;
  let buffer = [];
  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+?)\s*$/);
    if (headerMatch) {
      if (currentName && !(currentName in sections)) sections[currentName] = buffer.join("\n").trim();
      currentName = headerMatch[1].trim();
      buffer = [];
    } else if (currentName) {
      buffer.push(line);
    }
  }
  if (currentName && !(currentName in sections)) sections[currentName] = buffer.join("\n").trim();
  return sections;
}

function parseListSection(text) {
  if (!text) return [];
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-"))
    .map((l) => l.slice(1).trim())
    .filter(Boolean);
}

function parseKeyValueSection(text) {
  const out = {};
  for (const entry of parseListSection(text)) {
    const m = entry.match(/^([a-z_]+):\s*(.+)$/i);
    if (!m) continue;
    const key = m[1].trim();
    const values = m[2].split(",").map((v) => v.trim()).filter(Boolean);
    out[key] = values;
  }
  return out;
}

export function parseProblemMarkdown(source) {
  const fmMatch = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    throw new Error("problem.md is missing frontmatter (--- ... --- block)");
  }
  const frontmatter = parseFrontmatter(fmMatch[1]);
  const sections = splitSections(fmMatch[2]);

  const fields = {
    description: "",
    current_approach: "",
    success_criteria: [],
    constraints: [],
    non_goals: [],
    suspected_approach_axes: [],
    hints: {}
  };

  for (const [name, text] of Object.entries(sections)) {
    if (TEXT_FIELDS.has(name)) fields[name] = text;
    else if (LIST_FIELDS.has(name)) fields[name] = parseListSection(text);
    else if (KEY_VALUE_FIELDS.has(name)) fields[name] = parseKeyValueSection(text);
  }

  return { frontmatter, fields };
}
