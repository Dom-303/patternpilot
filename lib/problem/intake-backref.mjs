// lib/problem/intake-backref.mjs
export function addProblemBackref(markdown, slug) {
  const fmMatch = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return markdown;
  const fm = fmMatch[1];
  const body = fmMatch[2];

  const problemsBlockMatch = fm.match(/problems:\n((?:\s*-\s*.+\n?)+)/);
  let newFm;
  if (problemsBlockMatch) {
    const block = problemsBlockMatch[1];
    if (block.includes(`- ${slug}`)) return markdown;
    const appended = `problems:\n${block.trimEnd()}\n  - ${slug}`;
    newFm = fm.replace(problemsBlockMatch[0], appended);
  } else {
    newFm = `${fm.trimEnd()}\nproblems:\n  - ${slug}`;
  }
  return `---\n${newFm}\n---\n${body}`;
}
