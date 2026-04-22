const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const UMLAUT_MAP = new Map([
  ["ä", "a"], ["ö", "o"], ["ü", "u"], ["ß", "ss"],
  ["à", "a"], ["á", "a"], ["â", "a"], ["é", "e"], ["è", "e"],
  ["ê", "e"], ["í", "i"], ["ì", "i"], ["î", "i"], ["ó", "o"],
  ["ò", "o"], ["ô", "o"], ["ú", "u"], ["ù", "u"], ["û", "u"]
]);

export function buildSlug(input) {
  if (typeof input !== "string") return "";
  const folded = [...input.toLowerCase()]
    .map((ch) => UMLAUT_MAP.get(ch) ?? ch)
    .join("");
  const replaced = folded.replace(/[^a-z0-9]+/g, "-");
  const collapsed = replaced.replace(/-+/g, "-");
  return collapsed.replace(/^-|-$/g, "");
}

export function validateSlug(slug) {
  return typeof slug === "string" && slug.length > 0 && SLUG_PATTERN.test(slug);
}
