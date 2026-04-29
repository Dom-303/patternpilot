import { buildSlug } from "../../problem/slug.mjs";

export async function performFirstActionDispatch({
  action,
  rootDir, config, projectKey,
  discoveryProfile = "balanced",
  runIntake, runDiscover, runProblemCreate, runProblemExplore
}) {
  if (!action || action.action === "nothing") {
    return { dispatched: "nothing" };
  }

  if (action.action === "intake") {
    await runIntake(rootDir, config, {
      project: projectKey,
      urls: [action.url]
    });
    return { dispatched: "intake", url: action.url };
  }

  if (action.action === "discover") {
    await runDiscover(rootDir, config, {
      project: projectKey,
      discoveryProfile
    });
    return { dispatched: "discover", profile: discoveryProfile };
  }

  if (action.action === "problem") {
    const slug = buildSlug(action.question);
    await runProblemCreate(rootDir, config, {
      project: projectKey,
      title: action.question,
      slug
    });
    await runProblemExplore(rootDir, config, {
      project: projectKey,
      slug
    });
    return { dispatched: "problem", question: action.question, slug };
  }

  return { dispatched: "unknown" };
}
