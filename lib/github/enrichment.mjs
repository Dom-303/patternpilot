import { decodeBase64Markdown, stripMarkdown } from "../utils.mjs";
import { resolveGithubToken } from "./auth.mjs";
import { createHeaders, fetchJsonWithRetry } from "./api-client.mjs";

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
