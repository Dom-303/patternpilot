export {
  buildClassificationText,
  guessClassification,
  buildProjectRelevanceNote,
  deriveActivityStatus,
  buildLandkarteCandidate
} from "./classification/core.mjs";
export { buildProjectAlignment } from "./classification/alignment.mjs";
export {
  EVALUATION_VERSION,
  classifyLicense,
  bandFromScore,
  computeRulesFingerprint,
  normalizeGapAreaCanonical,
  buildRunGapSignals,
  buildCandidateEvaluation,
  deriveDisposition,
  buildRunConfidence
} from "./classification/evaluation.mjs";
