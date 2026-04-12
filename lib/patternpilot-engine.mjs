import fs from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CATEGORY_RULES = [
  { match: /(wordpress|\bwp\b|wp-|plugin)/i, value: "plugin" },
  { match: /(aggregator|calendar|compiled|portal|hub)/i, value: "aggregator" },
  { match: /(place|maps|geo(code)?|venue|location)/i, value: "enricher" },
  { match: /(framework|sdk|infra|standardize|family|families)/i, value: "framework" },
  { match: /(\bui\b|frontend|discovery|website|web app|webui|widget|embed)/i, value: "product_surface" },
  { match: /(scraper|crawler|connector|adapter)/i, value: "connector" }
];

const PATTERN_RULES = [
  { match: /(wordpress|\bwp\b|wp-|plugin)/i, value: "cms_distribution_plugin" },
  { match: /(place|maps|geo(code)?|venue|location)/i, value: "place_data_infrastructure" },
  { match: /(aggregator|compiled|calendar|events-hub|portal)/i, value: "local_multi_source_aggregator" },
  { match: /(framework|city-|infra|sdk|standardize|family|families)/i, value: "local_source_infra_framework" },
  { match: /(frontend|discovery|website|web app|webui|widget|embed)/i, value: "event_discovery_frontend" },
  { match: /(scraper|connector|adapter|crawler)/i, value: "single_source_connector" }
];

const MAIN_LAYER_RULES = [
  { match: /(plugin|wordpress)/i, value: "distribution_plugin" },
  { match: /(framework|infra|intake|source system|source systems|family|families|standardize)/i, value: "source_intake" },
  { match: /(place|maps|geo(code)?|venue|location)/i, value: "location_place_enrichment" },
  { match: /(scraper|fetch|crawler)/i, value: "access_fetch" },
  { match: /(parse|extract|json-ld|schema\.org)/i, value: "parsing_extraction" },
  { match: /(aggregator|calendar|feed|\bapi\b|\bical\b|\bics\b|json feed)/i, value: "export_feed_api" },
  { match: /(frontend|discovery|website|web app|webui|widget|embed)/i, value: "ui_discovery_surface" }
];

const GAP_RULES = [
  { match: /(wordpress|\bwp\b|wp-|plugin)/i, value: "wordpress_plugin_distribution" },
  { match: /(framework|infra|source system|source systems|family|families|standardize)/i, value: "source_systems_and_families" },
  { match: /(scraper|connector|adapter|crawler)/i, value: "connector_families" },
  { match: /(place|maps|geo(code)?|venue|location|gastro)/i, value: "location_and_gastro_intelligence" },
  { match: /(aggregator|calendar|feed|\bapi\b|\bical\b|\bics\b|widget|embed)/i, value: "distribution_surfaces" },
  { match: /(frontend|discovery|website|web app|webui)/i, value: "frontend_and_surface_design" }
];

const BUILD_RULES = [
  { match: /(wordpress|\bwp\b|wp-|plugin)/i, value: "adapt_pattern" },
  { match: /(place|maps|geo(code)?|location)/i, value: "borrow_optional" },
  { match: /(framework|infra|aggregator|calendar|feed|\bapi\b|family|families|source system)/i, value: "adapt_pattern" },
  { match: /(scraper|connector|adapter|crawler)/i, value: "adapt_pattern" }
];

const PRIORITY_RULES = [
  { match: /(aggregator|framework|infra|plugin|\bapi\b|feed|source system|family|families)/i, value: "now" },
  { match: /(place|maps|location|frontend|discovery|website|webui)/i, value: "soon" },
  { match: /(scraper|connector|crawler)/i, value: "soon" }
];

export async function loadPatternpilotRoot(scriptUrl) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

export async function loadConfig(rootDir) {
  const raw = await fs.readFile(path.join(rootDir, "patternpilot.config.json"), "utf8");
  return JSON.parse(raw);
}

export async function loadProjectBinding(rootDir, config, projectKey) {
  const project = config.projects[projectKey];
  if (!project) {
    throw new Error(`Unknown project '${projectKey}'.`);
  }

  const bindingPath = path.join(rootDir, project.projectBindingFile);
  const raw = await fs.readFile(bindingPath, "utf8");
  return {
    project,
    binding: JSON.parse(raw),
    bindingPath
  };
}

export async function loadProjectAlignmentRules(rootDir, project, binding) {
  const rulesFile = binding.alignmentRulesFile ?? project.alignmentRulesFile;
  if (!rulesFile) {
    return null;
  }
  const raw = await fs.readFile(path.join(rootDir, rulesFile), "utf8");
  return JSON.parse(raw);
}

export function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();
  const options = {
    project: null,
    file: null,
    notes: "",
    dryRun: false,
    force: false,
    skipEnrich: false,
    apply: false,
    fromStatus: null,
    limit: null,
    urls: []
  };

  while (args.length > 0) {
    const token = args.shift();
    if (token === "--project") {
      options.project = args.shift() ?? null;
      continue;
    }
    if (token === "--file") {
      options.file = args.shift() ?? null;
      continue;
    }
    if (token === "--notes") {
      options.notes = args.shift() ?? "";
      continue;
    }
    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (token === "--force") {
      options.force = true;
      continue;
    }
    if (token === "--skip-enrich") {
      options.skipEnrich = true;
      continue;
    }
    if (token === "--apply") {
      options.apply = true;
      continue;
    }
    if (token === "--from-status") {
      options.fromStatus = args.shift() ?? null;
      continue;
    }
    if (token === "--limit") {
      const rawValue = args.shift();
      options.limit = rawValue ? Number.parseInt(rawValue, 10) : null;
      continue;
    }
    options.urls.push(token);
  }

  return { command, options };
}

export async function collectUrls(rootDir, options) {
  const urls = [...options.urls];
  if (options.file) {
    const fileContent = await fs.readFile(path.resolve(rootDir, options.file), "utf8");
    for (const line of fileContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      urls.push(trimmed);
    }
  }
  return [...new Set(urls)];
}

export function normalizeGithubUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (url.hostname !== "github.com") {
    throw new Error(`Only github.com repository URLs are supported right now: ${rawUrl}`);
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`GitHub URL must point to a repository: ${rawUrl}`);
  }

  const owner = parts[0];
  const name = parts[1].replace(/\.git$/i, "");
  const normalizedRepoUrl = `https://github.com/${owner}/${name}`;

  return {
    rawUrl,
    normalizedRepoUrl,
    owner,
    name,
    slug: `${owner}__${name}`.toLowerCase(),
    host: "github.com"
  };
}

export function createRunId(now = new Date()) {
  return now.toISOString().replace(/[:.]/g, "-");
}

function matchValue(rules, text, fallback) {
  for (const rule of rules) {
    if (rule.match.test(text)) {
      return rule.value;
    }
  }
  return fallback;
}

function buildClassificationText(repo, enrichment) {
  const repoData = enrichment?.repo ?? {};
  const topics = Array.isArray(repoData.topics) ? repoData.topics.join(" ") : "";
  const readmeText = enrichment?.readme?.excerpt ?? "";
  const description = repoData.description ?? "";
  const languageText = Array.isArray(enrichment?.languages) ? enrichment.languages.join(" ") : "";
  return [
    repo.owner,
    repo.name,
    repo.normalizedRepoUrl,
    description,
    topics,
    readmeText,
    languageText
  ]
    .filter(Boolean)
    .join(" ");
}

export function guessClassification(repo, enrichment = null) {
  const text = buildClassificationText(repo, enrichment);
  const category = matchValue(CATEGORY_RULES, text, "research_signal");
  const patternFamily = matchValue(PATTERN_RULES, text, "research_signal");
  const mainLayer = matchValue(MAIN_LAYER_RULES, text, "research_signal");
  const gapArea = matchValue(GAP_RULES, text, "risk_and_dependency_awareness");
  const buildVsBorrow = matchValue(BUILD_RULES, text, "observe_only");
  const priority = matchValue(PRIORITY_RULES, text, "soon");

  return {
    category,
    patternFamily,
    mainLayer,
    gapArea,
    buildVsBorrow,
    priority
  };
}

export function buildProjectRelevanceNote(projectBinding, guess) {
  const projectLabel = projectBinding.projectLabel ?? projectBinding.projectKey;
  return [
    `Likely relevant for ${projectLabel} because it may inform '${guess.gapArea}'`,
    `and the worker/project layer '${guess.mainLayer}'.`
  ].join(" ");
}

function csvEscape(value) {
  const safe = String(value ?? "");
  if (!safe.includes(";") && !safe.includes('"') && !safe.includes("\n")) {
    return safe;
  }
  return `"${safe.replace(/"/g, '""')}"`;
}

function parseCsvLine(line) {
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

async function readQueue(queuePath) {
  const raw = await fs.readFile(queuePath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(";");
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""]));
  });
  return { header, rows };
}

async function writeQueue(queuePath, header, rows) {
  const lines = [header.join(";")];
  for (const row of rows) {
    lines.push(header.map((key) => csvEscape(row[key] ?? "")).join(";"));
  }
  await fs.writeFile(queuePath, `${lines.join("\n")}\n`, "utf8");
}

export async function upsertQueueEntry(rootDir, config, entry) {
  const queuePath = path.join(rootDir, config.queueFile);
  const { header, rows } = await readQueue(queuePath);
  for (const key of Object.keys(entry)) {
    if (!header.includes(key)) {
      header.push(key);
    }
  }
  const index = rows.findIndex(
    (row) =>
      row.project_key === entry.project_key &&
      row.normalized_repo_url === entry.normalized_repo_url
  );

  if (index >= 0) {
    const previous = rows[index];
    rows[index] = {
      ...previous,
      ...entry,
      created_at: previous.created_at || entry.created_at
    };
  } else {
    rows.push(entry);
  }

  await writeQueue(queuePath, header, rows);
}

export async function loadQueueEntries(rootDir, config) {
  const queuePath = path.join(rootDir, config.queueFile);
  const { rows } = await readQueue(queuePath);
  return rows;
}

export async function ensureDirectory(dirPath, dryRun) {
  if (dryRun) {
    return;
  }
  await fs.mkdir(dirPath, { recursive: true });
}

export function buildIntakeDocPath(rootDir, project, repo) {
  return path.join(rootDir, project.intakeRoot, `${repo.slug}.md`);
}

async function safeReadText(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function safeReadDir(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

function resolveProjectPath(projectRoot, relativePath) {
  return path.resolve(projectRoot, relativePath);
}

export async function loadProjectProfile(rootDir, project, binding, alignmentRules = null) {
  const projectRoot = path.resolve(rootDir, project.projectRoot);
  const referenceFiles = [];
  const referenceDirectories = [];
  const corpusParts = [];

  for (const relativePath of binding.readBeforeAnalysis ?? []) {
    const absolutePath = resolveProjectPath(projectRoot, relativePath);
    const content = await safeReadText(absolutePath);
    referenceFiles.push({
      path: relativePath,
      exists: Boolean(content),
      excerpt: content ? stripMarkdown(content, 700) : ""
    });
    if (content) {
      corpusParts.push(content);
    }
  }

  for (const relativePath of binding.referenceDirectories ?? []) {
    const absolutePath = resolveProjectPath(projectRoot, relativePath);
    const entries = await safeReadDir(absolutePath);
    referenceDirectories.push({
      path: relativePath,
      entries: entries.slice(0, 40)
    });
    if (entries.length > 0) {
      corpusParts.push(entries.join(" "));
    }
  }

  const corpus = corpusParts.join("\n");
  const capabilitiesPresent = (alignmentRules?.capabilities ?? [])
    .filter((capability) => capability.signals?.some((signal) => corpus.toLowerCase().includes(signal.toLowerCase())))
    .map((capability) => capability.id);

  return {
    projectKey: binding.projectKey,
    projectRoot,
    referenceFiles,
    referenceDirectories,
    corpus,
    capabilitiesPresent
  };
}

function resolveGithubToken(githubConfig) {
  for (const envName of githubConfig.authEnvVars ?? []) {
    const value = process.env[envName];
    if (value) {
      return {
        token: value,
        envName,
        authMode: "token"
      };
    }
  }

  return {
    token: null,
    envName: null,
    authMode: "anonymous"
  };
}

function createHeaders(githubConfig, auth) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": githubConfig.userAgent ?? "patternpilot"
  };
  if (auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }
  return headers;
}

async function fetchJson(url, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      new URL(url),
      {
        method: "GET",
        headers,
        timeout: timeoutMs
      },
      (response) => {
        let payload = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          payload += chunk;
        });
        response.on("end", () => {
          try {
            const data = payload ? JSON.parse(payload) : {};
            if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300) {
              const message = data?.message || response.statusMessage || "request failed";
              reject(new Error(`GitHub API ${response.statusCode}: ${message}`));
              return;
            }
            resolve(data);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on("error", (error) => {
      reject(error);
    });
    request.on("timeout", () => {
      request.destroy(new Error("request aborted"));
    });
    request.end();
  });
}

function shouldRetryGithubError(error) {
  const message = error?.message ?? "";
  return (
    message.includes("fetch failed") ||
    message.includes("aborted") ||
    message.includes("EAI_AGAIN") ||
    message.includes("ENOTFOUND") ||
    message.includes("ECONNRESET")
  );
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url, headers, timeoutMs, attempts = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchJson(url, headers, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetryGithubError(error)) {
        throw error;
      }
      await wait(800 * attempt);
    }
  }
  throw lastError;
}

function decodeBase64Markdown(content) {
  if (!content) {
    return "";
  }
  return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
}

function stripMarkdown(markdown, maxChars) {
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

export async function enrichGithubRepo(repo, config, options = {}) {
  const githubConfig = config.github ?? {};
  const auth = resolveGithubToken(githubConfig);

  if (options.skipEnrich) {
    return {
      status: "skipped",
      authMode: auth.authMode,
      authSource: auth.envName
    };
  }

  const headers = createHeaders(githubConfig, auth);
  const baseUrl = githubConfig.apiBaseUrl ?? "https://api.github.com";
  const timeoutMs = githubConfig.requestTimeoutMs ?? 12000;

  try {
    const repoData = await fetchJsonWithRetry(
      `${baseUrl}/repos/${repo.owner}/${repo.name}`,
      headers,
      timeoutMs
    );

    let readme = null;
    try {
      const readmeData = await fetchJsonWithRetry(
        `${baseUrl}/repos/${repo.owner}/${repo.name}/readme`,
        headers,
        timeoutMs
      );
      const rawReadme = decodeBase64Markdown(readmeData.content);
      readme = {
        path: readmeData.path,
        htmlUrl: readmeData.html_url,
        excerpt: stripMarkdown(rawReadme, githubConfig.readmeExcerptMaxChars ?? 1600)
      };
    } catch (error) {
      readme = {
        path: null,
        htmlUrl: null,
        excerpt: "",
        error: error.message
      };
    }

    let languages = [];
    try {
      const languagesData = await fetchJsonWithRetry(
        `${baseUrl}/repos/${repo.owner}/${repo.name}/languages`,
        headers,
        timeoutMs
      );
      languages = Object.keys(languagesData);
    } catch {
      languages = [];
    }

    return {
      status: "success",
      authMode: auth.authMode,
      authSource: auth.envName,
      fetchedAt: new Date().toISOString(),
      repo: {
        fullName: repoData.full_name,
        description: repoData.description ?? "",
        homepage: repoData.homepage ?? "",
        topics: repoData.topics ?? [],
        defaultBranch: repoData.default_branch ?? "",
        visibility: repoData.visibility ?? "public",
        archived: Boolean(repoData.archived),
        fork: Boolean(repoData.fork),
        stars: repoData.stargazers_count ?? 0,
        forks: repoData.forks_count ?? 0,
        openIssues: repoData.open_issues_count ?? 0,
        watchers: repoData.watchers_count ?? 0,
        language: repoData.language ?? "",
        license: repoData.license?.spdx_id || repoData.license?.name || "",
        createdAt: repoData.created_at ?? "",
        updatedAt: repoData.updated_at ?? "",
        pushedAt: repoData.pushed_at ?? ""
      },
      languages,
      readme
    };
  } catch (error) {
    return {
      status: "failed",
      authMode: auth.authMode,
      authSource: auth.envName,
      fetchedAt: new Date().toISOString(),
      error: error.message
    };
  }
}

function hasSignal(text, signal) {
  return text.toLowerCase().includes(signal.toLowerCase());
}

function repoMatchesCapability(repoText, projectProfile, capability) {
  const signals = capability.signals ?? [];
  if (signals.length === 0) {
    return false;
  }

  const repoHit = signals.some((signal) => hasSignal(repoText, signal));
  const projectHit =
    projectProfile.capabilitiesPresent?.includes(capability.id) ||
    signals.some((signal) => hasSignal(projectProfile.corpus ?? "", signal));

  return repoHit && projectHit;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fitBand(score) {
  if (score >= 65) {
    return "high";
  }
  if (score >= 40) {
    return "medium";
  }
  return "low";
}

export function buildProjectAlignment(repo, guess, enrichment, projectProfile, alignmentRules) {
  if (!alignmentRules || !projectProfile) {
    return {
      status: "unavailable",
      fitBand: "unknown",
      fitScore: 0,
      matchedCapabilities: [],
      recommendedWorkerAreas: [],
      reviewDocs: [],
      tensions: [],
      suggestedNextStep: "Add project alignment rules to enable Stage-3 analysis.",
      rationale: []
    };
  }

  const repoText = buildClassificationText(repo, enrichment);
  const layerMapping = alignmentRules.layerMappings?.[guess.mainLayer] ?? {};
  const gapMapping = alignmentRules.gapMappings?.[guess.gapArea] ?? {};
  const matchedCapabilities = (alignmentRules.capabilities ?? [])
    .filter((capability) => repoMatchesCapability(repoText, projectProfile, capability))
    .map((capability) => capability.id);

  const reviewDocs = uniqueStrings([
    ...(layerMapping.review_docs ?? []),
    ...matchedCapabilities.flatMap((capabilityId) => {
      const capability = (alignmentRules.capabilities ?? []).find((item) => item.id === capabilityId);
      return capability?.review_docs ?? [];
    })
  ]);

  const tensions = uniqueStrings([
    alignmentRules.patternTensions?.[guess.patternFamily] ?? "",
    guess.mainLayer === "distribution_plugin" || guess.mainLayer === "ui_discovery_surface"
      ? "This pattern sits closer to distribution than to worker-core truth logic."
      : "",
    enrichment?.status === "success" && enrichment.repo.archived ? "Archived repositories should be treated as pattern signals, not dependencies." : ""
  ]);

  let score = 8;
  score += layerMapping.fit_bias ?? 0;
  score += gapMapping.fit_bias ?? 0;
  score += matchedCapabilities.length * 7;
  if (guess.buildVsBorrow === "adapt_pattern") {
    score += 8;
  }
  if (guess.buildVsBorrow === "borrow_optional") {
    score += 3;
  }
  if (guess.priority === "now") {
    score += 8;
  }
  if (enrichment?.status === "success" && enrichment.repo.stars >= 100) {
    score += 5;
  }
  if (deriveActivityStatus(enrichment) === "stale") {
    score -= 8;
  }
  if (tensions.length > 0) {
    score -= 6;
  }
  score = clamp(score, 0, 100);

  const rationale = uniqueStrings([
    `Primary layer '${guess.mainLayer}' maps into EventBaer worker areas: ${(layerMapping.worker_areas ?? []).join(", ") || "none"}.`,
    `Gap area '${guess.gapArea}' suggests: ${gapMapping.suggested_next_step ?? "no explicit project next step yet"}.`,
    matchedCapabilities.length > 0
      ? `Matched project capabilities: ${matchedCapabilities.join(", ")}.`
      : "No strong capability match was found yet; review manually.",
    tensions.length > 0 ? `Main tension: ${tensions.join(" | ")}` : ""
  ]);

  return {
    status: "ready",
    fitBand: fitBand(score),
    fitScore: score,
    matchedCapabilities,
    recommendedWorkerAreas: uniqueStrings(layerMapping.worker_areas ?? []),
    reviewDocs,
    tensions,
    suggestedNextStep:
      gapMapping.suggested_next_step ??
      layerMapping.next_step ??
      "Review the repo manually against the target project before promoting it.",
    rationale
  };
}

function isoDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

function calculateDaysSince(dateValue) {
  if (!dateValue) {
    return null;
  }
  const delta = Date.now() - new Date(dateValue).getTime();
  return Math.floor(delta / (1000 * 60 * 60 * 24));
}

function deriveActivityStatus(enrichment) {
  if (enrichment?.status !== "success") {
    return "unknown";
  }
  if (enrichment.repo.archived) {
    return "archived";
  }
  const days = calculateDaysSince(enrichment.repo.pushedAt);
  if (days === null) {
    return "unknown";
  }
  if (days <= 90) {
    return "current";
  }
  if (days <= 365) {
    return "moderate";
  }
  return "stale";
}

function deriveMaturity(enrichment) {
  if (enrichment?.status !== "success") {
    return "needs_review";
  }
  if (enrichment.repo.archived) {
    return "archived";
  }
  if (enrichment.repo.stars >= 500 && deriveActivityStatus(enrichment) === "current") {
    return "infra_grade";
  }
  if (enrichment.repo.stars >= 50) {
    return "solid";
  }
  return "narrow_but_useful";
}

function deriveSourceFocus(text) {
  if (/(place|maps|geo|venue|location|business)/i.test(text)) {
    return "places";
  }
  if (/(event|calendar|meetup|festival|show|gig)/i.test(text)) {
    return "events";
  }
  return "mixed_or_unclear";
}

function deriveGeographicModel(text) {
  if (/(city|local|regional|munich|berlin|mcr)/i.test(text)) {
    return "regional";
  }
  if (/(facebook|meetup|resident advisor|google|maps|platform)/i.test(text)) {
    return "platform_bound";
  }
  return "global";
}

function deriveDataModel(text) {
  if (/(place|maps|geo|venue|location|business)/i.test(text)) {
    return "places_only";
  }
  if (/(event|calendar|meetup|festival|show|gig)/i.test(text)) {
    return "events_only";
  }
  return "mixed_entities";
}

function deriveDistributionType(text) {
  if (/(wordpress|wp-|plugin)/i.test(text)) {
    return "wordpress_plugin";
  }
  if (/(feed|ical|ics)/i.test(text)) {
    return "feed_export";
  }
  if (/(api|rest)/i.test(text)) {
    return "api";
  }
  if (/(frontend|site|website|discovery|web)/i.test(text)) {
    return "website";
  }
  return "none_visible";
}

function deriveSecondaryLayers(guess, enrichment) {
  const values = new Set();
  const text = buildClassificationText(
    {
      owner: "",
      name: "",
      normalizedRepoUrl: ""
    },
    enrichment
  );

  if (guess.mainLayer !== "parsing_extraction" && /(parse|extract|scrape|crawler)/i.test(text)) {
    values.add("parsing_extraction");
  }
  if (guess.mainLayer !== "export_feed_api" && /(feed|api|ical|ics|json)/i.test(text)) {
    values.add("export_feed_api");
  }
  if (guess.mainLayer !== "ui_discovery_surface" && /(frontend|site|website|discovery|web)/i.test(text)) {
    values.add("ui_discovery_surface");
  }
  if (guess.mainLayer !== "location_place_enrichment" && /(place|maps|geo|venue|location)/i.test(text)) {
    values.add("location_place_enrichment");
  }

  return [...values].join(",");
}

function deriveEventbaerRelevance(guess, enrichment) {
  if (guess.priority === "now") {
    return "high";
  }
  if (enrichment?.status === "success" && enrichment.repo.stars >= 100) {
    return "high";
  }
  if (guess.priority === "soon") {
    return "medium";
  }
  return "low";
}

function deriveDecision(guess) {
  if (guess.buildVsBorrow === "adapt_pattern") {
    return "adapt";
  }
  if (guess.buildVsBorrow === "borrow_optional") {
    return "observe";
  }
  if (guess.buildVsBorrow === "observe_only") {
    return "observe";
  }
  if (guess.buildVsBorrow === "build_core") {
    return "adopt";
  }
  return "ignore";
}

function buildStrengths(guess, enrichment) {
  if (enrichment?.status !== "success") {
    return "Needs review with remote metadata unavailable";
  }
  const bits = [];
  if (enrichment.repo.description) {
    bits.push(enrichment.repo.description);
  }
  if (enrichment.repo.topics.length > 0) {
    bits.push(`Topics: ${enrichment.repo.topics.slice(0, 5).join(", ")}`);
  }
  if (enrichment.languages.length > 0) {
    bits.push(`Languages: ${enrichment.languages.slice(0, 3).join(", ")}`);
  }
  if (guess.priority === "now") {
    bits.push("Likely decision-relevant for EventBaer soon");
  }
  return bits.join(" | ") || "Visible public repo with enough surface for review";
}

function buildWeaknesses(guess, enrichment) {
  if (enrichment?.status !== "success") {
    return "Remote enrichment failed, so repo context is still shallow";
  }
  const bits = [];
  if (guess.category === "connector") {
    bits.push("Potentially narrow platform scope");
  }
  if (guess.category === "plugin") {
    bits.push("Distribution-heavy but likely not a truth core");
  }
  if (deriveActivityStatus(enrichment) === "stale") {
    bits.push("Repo activity looks stale");
  }
  if (enrichment.repo.archived) {
    bits.push("Repository is archived");
  }
  return bits.join(" | ") || "Needs deeper repo reading to confirm system depth";
}

function buildRisks(guess, enrichment) {
  const bits = [];
  const text = buildClassificationText(
    {
      owner: "",
      name: "",
      normalizedRepoUrl: ""
    },
    enrichment
  );
  if (guess.category === "connector" || /(facebook|meetup|maps|resident advisor)/i.test(text)) {
    bits.push("source_lock_in");
  }
  if (/(scraper|crawler|browser)/i.test(text)) {
    bits.push("brittle_platform_changes");
  }
  if (enrichment?.status === "success" && enrichment.repo.archived) {
    bits.push("archived_repo");
  }
  if (deriveActivityStatus(enrichment) === "stale") {
    bits.push("maintenance_risk");
  }
  return bits.join(",") || "needs_review";
}

function buildLearningForEventbaer(guess) {
  if (guess.gapArea === "distribution_surfaces" || guess.gapArea === "wordpress_plugin_distribution") {
    return "Distribution should be treated as a separate leverage layer on top of the worker core.";
  }
  if (guess.gapArea === "location_and_gastro_intelligence") {
    return "Location and venue intelligence deserve their own deliberate layer next to event truth.";
  }
  if (guess.gapArea === "source_systems_and_families") {
    return "Source infrastructure should be built as reusable families instead of isolated one-off connectors.";
  }
  return "This repo should be read as a pattern signal for EventBaer rather than copied as-is.";
}

function buildPossibleImplication(guess) {
  if (guess.buildVsBorrow === "adapt_pattern") {
    return "Review and adapt the pattern into the EventBaer worker architecture, not as direct dependency.";
  }
  if (guess.buildVsBorrow === "borrow_optional") {
    return "Treat as optional supporting layer, not as system core.";
  }
  if (guess.buildVsBorrow === "build_core") {
    return "Check whether EventBaer should own this capability directly in its core.";
  }
  return "Keep on review watchlist until there is a sharper project need.";
}

export function buildLandkarteCandidate(repo, guess, enrichment) {
  const classificationText = buildClassificationText(repo, enrichment);
  return {
    name: repo.name,
    repo_url: repo.normalizedRepoUrl,
    owner: repo.owner,
    category: guess.category,
    pattern_family: guess.patternFamily,
    main_layer: guess.mainLayer,
    secondary_layers: deriveSecondaryLayers(guess, enrichment),
    source_focus: deriveSourceFocus(classificationText),
    geographic_model: deriveGeographicModel(classificationText),
    data_model: deriveDataModel(classificationText),
    distribution_type: deriveDistributionType(classificationText),
    stars: String(enrichment?.repo?.stars ?? ""),
    activity_status: deriveActivityStatus(enrichment),
    last_checked_at: isoDate(enrichment?.fetchedAt ?? new Date().toISOString()),
    maturity: deriveMaturity(enrichment),
    strengths: buildStrengths(guess, enrichment),
    weaknesses: buildWeaknesses(guess, enrichment),
    risks: buildRisks(guess, enrichment),
    learning_for_eventbaer: buildLearningForEventbaer(guess),
    possible_implication: buildPossibleImplication(guess),
    eventbaer_gap_area: guess.gapArea,
    build_vs_borrow: guess.buildVsBorrow,
    priority_for_review: guess.priority,
    eventbaer_relevance: deriveEventbaerRelevance(guess, enrichment),
    decision: deriveDecision(guess),
    notes: `stage2_candidate:${enrichment?.status ?? "unknown"}`
  };
}

export function buildPromotionDocPath(rootDir, project, repo) {
  return path.join(rootDir, project.promotionRoot, `${repo.slug}.md`);
}

function buildRepoFromQueueEntry(queueEntry) {
  return {
    owner: queueEntry.owner,
    name: queueEntry.name,
    normalizedRepoUrl: queueEntry.normalized_repo_url || queueEntry.repo_url,
    slug: `${queueEntry.owner}__${queueEntry.name}`.toLowerCase(),
    host: queueEntry.host || "github.com"
  };
}

function buildLandkarteRowFromQueueEntry(queueEntry) {
  return {
    name: queueEntry.name,
    repo_url: queueEntry.normalized_repo_url || queueEntry.repo_url,
    owner: queueEntry.owner,
    category: queueEntry.category_guess,
    pattern_family: queueEntry.pattern_family_guess,
    main_layer: queueEntry.main_layer_guess,
    secondary_layers: queueEntry.secondary_layers || "",
    source_focus: queueEntry.source_focus || "",
    geographic_model: queueEntry.geographic_model || "",
    data_model: queueEntry.data_model || "",
    distribution_type: queueEntry.distribution_type || "",
    stars: queueEntry.stars,
    activity_status: queueEntry.activity_status || "",
    last_checked_at: isoDate(queueEntry.last_api_sync_at || queueEntry.updated_at || new Date().toISOString()),
    maturity: queueEntry.maturity || "",
    strengths: queueEntry.strengths || queueEntry.description || "",
    weaknesses: queueEntry.weaknesses || "",
    risks: queueEntry.risks || "",
    learning_for_eventbaer: queueEntry.learning_for_eventbaer || "",
    possible_implication: queueEntry.possible_implication || queueEntry.suggested_next_step || "",
    eventbaer_gap_area: queueEntry.eventbaer_gap_area_guess,
    build_vs_borrow: queueEntry.build_vs_borrow_guess,
    priority_for_review: queueEntry.priority_guess,
    eventbaer_relevance:
      queueEntry.eventbaer_relevance_guess ||
      (queueEntry.project_fit_band === "high" ? "high" : queueEntry.project_fit_band === "medium" ? "medium" : "low"),
    decision:
      queueEntry.decision_guess ||
      (queueEntry.build_vs_borrow_guess === "build_core"
        ? "adopt"
        : queueEntry.build_vs_borrow_guess === "adapt_pattern"
          ? "adapt"
          : queueEntry.build_vs_borrow_guess === "borrow_optional" || queueEntry.build_vs_borrow_guess === "observe_only"
            ? "observe"
            : "ignore"),
    notes: `stage4_promoted:${queueEntry.enrichment_status || "unknown"}`
  };
}

function buildLearningCandidate(queueEntry, binding) {
  const projectLabel = binding.projectLabel ?? binding.projectKey;
  const repoRef = `${queueEntry.owner}/${queueEntry.name}`;
  const matchedCapabilities = queueEntry.matched_capabilities
    ? queueEntry.matched_capabilities.split(",").filter(Boolean)
    : [];
  const workerAreas = queueEntry.recommended_worker_areas
    ? queueEntry.recommended_worker_areas.split(",").filter(Boolean)
    : [];

  return {
    title: `${repoRef} als Signal fuer ${queueEntry.eventbaer_gap_area_guess || "relevante Ausbauachsen"}`,
    observation:
      queueEntry.description ||
      `${repoRef} liefert ein erkennbares Muster in '${queueEntry.pattern_family_guess || "unknown"}'.`,
    repeatingPatterns: [
      queueEntry.pattern_family_guess
        ? `Pattern Family: ${queueEntry.pattern_family_guess}`
        : "",
      queueEntry.main_layer_guess ? `Main Layer: ${queueEntry.main_layer_guess}` : "",
      queueEntry.project_fit_band
        ? `Project Fit: ${queueEntry.project_fit_band} (${queueEntry.project_fit_score || "0"})`
        : "",
      matchedCapabilities.length > 0
        ? `Matched Capabilities: ${matchedCapabilities.join(", ")}`
        : "No strong capability match was auto-detected yet"
    ].filter(Boolean),
    meaningForProject:
      queueEntry.learning_for_eventbaer ||
      `${projectLabel} sollte dieses Repo als verwertbares Mustersignal lesen, nicht als Blaupause.`,
    implication:
      queueEntry.possible_implication ||
      queueEntry.suggested_next_step ||
      `Review fuer ${projectLabel} vertiefen und bei echtem Mehrwert spaeter kuratieren.`,
    workerAreas
  };
}

function buildDecisionCandidate(queueEntry, binding) {
  const projectLabel = binding.projectLabel ?? binding.projectKey;
  const repoRef = `${queueEntry.owner}/${queueEntry.name}`;
  const triggeredBy = [repoRef];
  if (queueEntry.pattern_family_guess) {
    triggeredBy.push(queueEntry.pattern_family_guess);
  }

  return {
    title: `${repoRef} fuer ${projectLabel} als '${queueEntry.build_vs_borrow_guess || "review"}' behandeln`,
    date: isoDate(queueEntry.updated_at || queueEntry.created_at || new Date().toISOString()),
    decision:
      queueEntry.build_vs_borrow_guess === "build_core"
        ? "adopt"
        : queueEntry.build_vs_borrow_guess === "adapt_pattern"
          ? "adapt"
          : queueEntry.build_vs_borrow_guess === "borrow_optional" || queueEntry.build_vs_borrow_guess === "observe_only"
            ? "observe"
            : "ignore",
    triggeredBy,
    rationale: [
      queueEntry.description ? queueEntry.description : "",
      queueEntry.project_fit_band
        ? `Project fit is '${queueEntry.project_fit_band}' with score ${queueEntry.project_fit_score || "0"}.`
        : "",
      queueEntry.matched_capabilities
        ? `Matched project capabilities: ${queueEntry.matched_capabilities}.`
        : "",
      queueEntry.project_relevance_note || ""
    ]
      .filter(Boolean)
      .join(" "),
    impact:
      queueEntry.learning_for_eventbaer ||
      `${projectLabel} sollte das Repo nur als gezielte Architekturhilfe behandeln.`,
    nextStep:
      queueEntry.suggested_next_step ||
      `Manuellen Review im Kontext von ${projectLabel} abschliessen.`,
    status: "proposed"
  };
}

export function buildPromotionCandidate(queueEntry, binding) {
  return {
    repo: buildRepoFromQueueEntry(queueEntry),
    landkarteRow: buildLandkarteRowFromQueueEntry(queueEntry),
    learning: buildLearningCandidate(queueEntry, binding),
    decision: buildDecisionCandidate(queueEntry, binding)
  };
}

export function renderPromotionPacket({ queueEntry, promotion, binding, createdAt, applyMode }) {
  const projectLabel = binding.projectLabel ?? binding.projectKey;
  const learning = promotion.learning;
  const decision = promotion.decision;

  return `# Promotion Packet — ${queueEntry.owner}/${queueEntry.name}

## Snapshot

- created_at: ${createdAt}
- project: ${binding.projectKey}
- source_status: ${queueEntry.status}
- apply_mode: ${applyMode ? "apply" : "prepare_only"}
- intake_doc: ${queueEntry.intake_doc || "-"}
- repo_url: ${queueEntry.normalized_repo_url || queueEntry.repo_url}

## Warum dieser Fund nach vorne gezogen wird

- ${queueEntry.project_relevance_note || `Das Repo wirkt relevant fuer ${projectLabel}.`}
- project_fit_band: ${queueEntry.project_fit_band || "-"}
- project_fit_score: ${queueEntry.project_fit_score || "-"}
- suggested_next_step: ${queueEntry.suggested_next_step || "-"}

## Kandidat fuer repo_landkarte.csv

${renderBulletMap(promotion.landkarteRow)}

## Kandidat fuer repo_learnings.md

### ${learning.title}

**Beobachtung**
- ${learning.observation}

**Wiederkehrende Muster**
${learning.repeatingPatterns.map((item) => `- ${item}`).join("\n")}

**Bedeutung fuer ${projectLabel}**
- ${learning.meaningForProject}

**Moegliche Konsequenz**
- ${learning.implication}

${learning.workerAreas.length > 0 ? `**Betroffene Worker-Areas**\n- ${learning.workerAreas.join("\n- ")}\n` : ""}
## Kandidat fuer repo_decisions.md

### ${decision.title}

**Datum**
- ${decision.date}

**Ausloeser**
${decision.triggeredBy.map((item) => `- ${item}`).join("\n")}

**Entscheidung**
- ${decision.decision}

**Begruendung**
- ${decision.rationale}

**Konkrete Bedeutung fuer ${projectLabel}**
- ${decision.impact}

**Naechster Schritt**
- ${decision.nextStep}

**Status**
- ${decision.status}
`;
}

export async function writePromotionPacket({ promotionDocPath, content, dryRun }) {
  if (dryRun) {
    return { created: true };
  }
  await fs.writeFile(promotionDocPath, content, "utf8");
  return { created: true };
}

async function readTextOrEmpty(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function upsertManagedBlock(document, sectionKey, sectionTitle, blockKey, blockContent) {
  const sectionStart = `<!-- patternpilot:${sectionKey}:start -->`;
  const sectionEnd = `<!-- patternpilot:${sectionKey}:end -->`;
  const blockStart = `<!-- patternpilot:${sectionKey}:${blockKey}:start -->`;
  const blockEnd = `<!-- patternpilot:${sectionKey}:${blockKey}:end -->`;
  const normalizedBlock = `${blockStart}\n${blockContent.trim()}\n${blockEnd}`;
  let working = document;

  if (!working.includes(sectionStart) || !working.includes(sectionEnd)) {
    working = `${working.trim()}\n\n## ${sectionTitle}\n\n${sectionStart}\n${sectionEnd}\n`;
  }

  const blockPattern = new RegExp(
    `${blockStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${blockEnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    "m"
  );
  if (blockPattern.test(working)) {
    return working.replace(blockPattern, normalizedBlock);
  }

  return working.replace(sectionEnd, `${normalizedBlock}\n\n${sectionEnd}`);
}

export async function upsertManagedMarkdownBlock({
  filePath,
  sectionKey,
  sectionTitle,
  blockKey,
  blockContent,
  dryRun
}) {
  const current = await readTextOrEmpty(filePath);
  const next = upsertManagedBlock(current, sectionKey, sectionTitle, blockKey, blockContent);
  if (!dryRun) {
    await fs.writeFile(filePath, next, "utf8");
  }
}

export async function upsertLandkarteEntry(rootDir, landkarteRow, dryRun = false) {
  const landkartePath = path.join(rootDir, "repo_landkarte.csv");
  const { header, rows } = await readQueue(landkartePath);
  for (const key of Object.keys(landkarteRow)) {
    if (!header.includes(key)) {
      header.push(key);
    }
  }
  const index = rows.findIndex((row) => row.repo_url === landkarteRow.repo_url);
  if (index >= 0) {
    rows[index] = { ...rows[index], ...landkarteRow };
  } else {
    rows.push(landkarteRow);
  }
  if (!dryRun) {
    await writeQueue(landkartePath, header, rows);
  }
}

export function renderLearningBlock(promotion, queueEntry) {
  return `### Candidate: ${queueEntry.owner}/${queueEntry.name}

**Quelle**
- ${queueEntry.normalized_repo_url || queueEntry.repo_url}

**Beobachtung**
- ${promotion.learning.observation}

**Wiederkehrende Muster**
${promotion.learning.repeatingPatterns.map((item) => `- ${item}`).join("\n")}

**Bedeutung fuer EventBaer**
- ${promotion.learning.meaningForProject}

**Moegliche Konsequenz**
- ${promotion.learning.implication}`;
}

export function renderDecisionBlock(promotion, queueEntry, binding) {
  const projectLabel = binding.projectLabel ?? binding.projectKey;
  return `### Candidate: ${promotion.decision.title}

**Datum**
- ${promotion.decision.date}

**Ausloeser**
${promotion.decision.triggeredBy.map((item) => `- ${item}`).join("\n")}

**Entscheidung**
- ${promotion.decision.decision}

**Begruendung**
- ${promotion.decision.rationale}

**Konkrete Bedeutung fuer ${projectLabel}**
- ${promotion.decision.impact}

**Naechster Schritt**
- ${promotion.decision.nextStep}

**Status**
- ${promotion.decision.status}`;
}

function renderBulletMap(object) {
  return Object.entries(object)
    .map(([key, value]) => `- ${key}: ${value || "-"}`)
    .join("\n");
}

function renderEnrichmentSection(enrichment) {
  if (!enrichment || enrichment.status === "skipped") {
    return [
      "## GitHub Enrichment",
      "",
      "- enrichment_status: skipped",
      "- note: Remote-Anreicherung wurde bewusst uebersprungen."
    ].join("\n");
  }

  if (enrichment.status !== "success") {
    return [
      "## GitHub Enrichment",
      "",
      `- enrichment_status: ${enrichment.status}`,
      `- auth_mode: ${enrichment.authMode ?? "unknown"}`,
      `- error: ${enrichment.error ?? "unknown"}`,
      "- note: Intake kann weiterverwendet werden, aber Review braucht noch mehr manuelle Sichtung."
    ].join("\n");
  }

  return [
    "## GitHub Enrichment",
    "",
    `- enrichment_status: ${enrichment.status}`,
    `- auth_mode: ${enrichment.authMode}`,
    `- auth_source: ${enrichment.authSource ?? "-"}`,
    `- stars: ${enrichment.repo.stars}`,
    `- forks: ${enrichment.repo.forks}`,
    `- watchers: ${enrichment.repo.watchers}`,
    `- open_issues: ${enrichment.repo.openIssues}`,
    `- primary_language: ${enrichment.repo.language || "-"}`,
    `- languages: ${enrichment.languages.join(", ") || "-"}`,
    `- topics: ${enrichment.repo.topics.join(", ") || "-"}`,
    `- license: ${enrichment.repo.license || "-"}`,
    `- default_branch: ${enrichment.repo.defaultBranch || "-"}`,
    `- visibility: ${enrichment.repo.visibility || "-"}`,
    `- archived: ${enrichment.repo.archived ? "yes" : "no"}`,
    `- updated_at: ${enrichment.repo.updatedAt || "-"}`,
    `- pushed_at: ${enrichment.repo.pushedAt || "-"}`,
    `- homepage: ${enrichment.repo.homepage || "-"}`,
    `- description: ${enrichment.repo.description || "-"}`
  ].join("\n");
}

function renderReadmeSection(enrichment) {
  if (!enrichment || enrichment.status !== "success") {
    return [
      "## README Snapshot",
      "",
      "- README konnte nicht automatisch geladen werden."
    ].join("\n");
  }

  if (!enrichment.readme?.excerpt) {
    return [
      "## README Snapshot",
      "",
      `- README not available: ${enrichment.readme?.error ?? "no content"}`
    ].join("\n");
  }

  return [
    "## README Snapshot",
    "",
    `- readme_path: ${enrichment.readme.path || "-"}`,
    `- readme_url: ${enrichment.readme.htmlUrl || "-"}`,
    "",
    enrichment.readme.excerpt
  ].join("\n");
}

function buildAutoHypotheses(repo, guess, enrichment, projectLabel) {
  const lines = [
    `- Dieses Repo wirkt primaer wie '${guess.patternFamily}' in der Kategorie '${guess.category}'.`,
    `- Fuer ${projectLabel} scheint besonders '${guess.gapArea}' relevant.`,
    `- Die staerkste beleuchtete Schicht wirkt aktuell wie '${guess.mainLayer}'.`,
    `- Vorlaeufige Tendenz fuer Build-vs-Borrow: '${guess.buildVsBorrow}'.`
  ];

  if (enrichment?.status === "success") {
    lines.push(`- Repo-Aktivitaet wirkt derzeit: '${deriveActivityStatus(enrichment)}'.`);
    if (enrichment.repo.description) {
      lines.push(`- Oeffentliche Kurzbeschreibung bestaetigt den Fokus: "${enrichment.repo.description}".`);
    }
  } else {
    lines.push("- Remote-Anreicherung fehlt oder ist gescheitert; diese Hypothesen sind entsprechend unsicherer.");
  }

  return lines.join("\n");
}

export function renderIntakeDoc({
  repo,
  guess,
  enrichment,
  landkarteCandidate,
  projectAlignment,
  projectProfile,
  binding,
  projectLabel,
  repoRoot,
  createdAt,
  notes
}) {
  const readFiles = binding.readBeforeAnalysis.map((item) => `- \`${item}\``).join("\n");
  const refDirs = binding.referenceDirectories.map((item) => `- \`${item}/\``).join("\n");
  const questions = binding.analysisQuestions.map((item) => `- ${item}`).join("\n");
  const capabilities = binding.targetCapabilities.map((item) => `- ${item}`).join("\n");
  const profileFilesLoaded = projectProfile?.referenceFiles?.filter((item) => item.exists).length ?? 0;

  return `# Intake Dossier — ${repo.owner}/${repo.name}

## Snapshot

- created_at: ${createdAt}
- status: pending_review
- project: ${binding.projectKey}
- repo_url: ${repo.normalizedRepoUrl}
- source_host: ${repo.host}
- repo_root_reference: \`${repoRoot}\`

## Warum das fuer ${projectLabel} relevant sein koennte

- ${buildProjectRelevanceNote(binding, guess)}
- Intake wurde automatisch aus einem GitHub-Link erzeugt und ist noch nicht kuratiert.

## Auto-Guesses — noch keine Wahrheit

- category_guess: \`${guess.category}\`
- pattern_family_guess: \`${guess.patternFamily}\`
- main_layer_guess: \`${guess.mainLayer}\`
- eventbaer_gap_area_guess: \`${guess.gapArea}\`
- build_vs_borrow_guess: \`${guess.buildVsBorrow}\`
- priority_guess: \`${guess.priority}\`

${renderEnrichmentSection(enrichment)}

${renderReadmeSection(enrichment)}

## Auto-Hypothesen fuer den Review

${buildAutoHypotheses(repo, guess, enrichment, projectLabel)}

## Project Alignment — ${projectLabel}

- alignment_status: ${projectAlignment?.status ?? "unavailable"}
- project_fit_band: ${projectAlignment?.fitBand ?? "unknown"}
- project_fit_score: ${projectAlignment?.fitScore ?? 0}
- matched_capabilities: ${projectAlignment?.matchedCapabilities?.join(", ") || "-"}
- recommended_worker_areas: ${projectAlignment?.recommendedWorkerAreas?.join(", ") || "-"}
- review_docs: ${projectAlignment?.reviewDocs?.join(", ") || "-"}
- tensions: ${projectAlignment?.tensions?.join(" | ") || "-"}
- suggested_next_step: ${projectAlignment?.suggestedNextStep ?? "-"}
- reference_files_loaded: ${profileFilesLoaded}

## Alignment Rationale

${(projectAlignment?.rationale ?? ["- No alignment rationale available."]).map((item) => `- ${item}`).join("\n")}

## Vor dem Review zuerst im Zielrepo lesen

${readFiles}

## Besonders relevante Verzeichnisse im Zielrepo

${refDirs}

## Zielbild und Staerkungsachsen

${capabilities}

## Review-Fragen

${questions}

## Review-Notizen

- Repo-Zweck:
- Kernfluss:
- Relevante Schichten:
- Staerken:
- Schwaechen:
- Risiken:
- Learning fuer EventBaer:
- Moegliche konkrete Folge:

## Promotion Candidate fuer repo_landkarte.csv

${renderBulletMap(landkarteCandidate)}

## Promotion-Kriterien

- Nur nach Review in \`repo_landkarte.csv\` uebernehmen
- Nur verdichtete Muster nach \`repo_learnings.md\`
- Nur echte Richtungsentscheide nach \`repo_decisions.md\`

## Intake-Notizen

${notes ? `- ${notes}` : "- Keine zusaetzlichen Intake-Notizen uebergeben."}
`;
}

export async function writeIntakeDoc({
  intakeDocPath,
  content,
  dryRun,
  force
}) {
  if (dryRun) {
    return { created: true, overwritten: false };
  }

  try {
    await fs.access(intakeDocPath);
    if (!force) {
      return { created: false, overwritten: false };
    }
  } catch {
    // file does not exist, continue
  }

  await fs.writeFile(intakeDocPath, content, "utf8");
  return { created: true, overwritten: force };
}

export async function writeRunArtifacts({
  rootDir,
  config,
  projectKey,
  runId,
  manifest,
  summary,
  projectProfile,
  dryRun
}) {
  const runDir = path.join(rootDir, config.runtimeRoot, projectKey, runId);
  if (!dryRun) {
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(path.join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    await fs.writeFile(path.join(runDir, "summary.md"), summary, "utf8");
    if (projectProfile) {
      await fs.writeFile(path.join(runDir, "project_profile.json"), JSON.stringify(projectProfile, null, 2), "utf8");
    }
  }
  return runDir;
}

export function renderRunSummary({ runId, projectKey, createdAt, items, dryRun }) {
  const lines = items.map((item) => {
    const enrichment = item.enrichment?.status ?? "unknown";
    const fit = item.projectAlignment?.fitBand ?? "unknown";
    return `- ${item.repo.owner}/${item.repo.name} -> ${item.intakeDocRelativePath} (${item.action}; enrichment=${enrichment}; fit=${fit})`;
  });

  return `# Patternpilot Intake Run

- run_id: ${runId}
- project: ${projectKey}
- created_at: ${createdAt}
- dry_run: ${dryRun ? "yes" : "no"}

## Items

${lines.join("\n")}
`;
}
