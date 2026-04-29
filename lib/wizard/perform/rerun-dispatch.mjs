import { writeConfig } from "../../config.mjs";

export async function performRerunDispatch({ intent, rootDir, config }) {
  if (intent.intent === "cancel") {
    return { handled: true, action: "cancel" };
  }

  if (intent.intent === "set-default") {
    config.defaultProject = intent.project;
    await writeConfig(rootDir, config, { preferLocal: true });
    return { handled: true, action: "set-default", project: intent.project };
  }

  if (intent.intent === "add-project") {
    return { handled: false, continueAs: "fresh-setup" };
  }

  if (intent.intent === "reauth") {
    return { handled: false, continueAs: "github-only" };
  }

  if (intent.intent === "edit-project") {
    return { handled: false, continueAs: "edit-project", project: intent.project };
  }

  return { handled: true, action: "unknown" };
}
