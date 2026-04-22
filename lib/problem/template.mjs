export function buildProblemTemplate({ slug, title, projectKey, createdAt }) {
  const projectLine = projectKey ? `project: ${projectKey}\n` : "";
  return `---
slug: ${slug}
title: ${title}
status: active
${projectLine}created_at: ${createdAt}
---

## description
<one paragraph describing the problem>

## success_criteria
- <what "solved" looks like>

## constraints
- <must-not, budget, stack, license>

## non_goals
- <what this problem explicitly is not about>

## current_approach
<how you are currently thinking about solving it>

## hints
- search_terms: <comma-separated terms for discovery>
- tech_tags: <comma-separated tech stack tokens>
- constraint_tags: <comma-separated filterable tags>
- approach_keywords: <comma-separated approach tokens>

## suspected_approach_axes
# optional — declare candidate axes for the Solution Landscape
- <axis 1>
- <axis 2>
`;
}
