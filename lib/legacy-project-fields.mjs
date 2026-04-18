export function getProjectGapAreaGuess(row, fallback = "") {
  return row.project_gap_area_guess || row.eventbaer_gap_area_guess || fallback;
}

export function getProjectRelevanceGuess(row, fallback = "") {
  return row.project_relevance_guess || row.eventbaer_relevance_guess || fallback;
}

export function getLearningForProject(row, fallback = "") {
  return row.learning_for_project || row.learning_for_eventbaer || fallback;
}

export function getRenderedProjectRelevance(item, fallback = "-") {
  return item.projectRelevance || item.eventbaerRelevance || fallback;
}
