// lib/landscape/html-report.mjs
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[c]));
}

export function renderLandscapeHtml({ problem, landscape, runId }) {
  const rows = landscape.clusters.map((c) => `
    <tr>
      <td>${escapeHtml(c.label)}</td>
      <td>${escapeHtml(c.pattern_family ?? "-")}</td>
      <td><span class="rel rel-${escapeHtml(c.relation)}">${escapeHtml(c.relation)}</span></td>
      <td>${escapeHtml((c.signature_contrast ?? []).join(", "))}</td>
      <td>${escapeHtml((c.member_ids ?? []).join(", "))}</td>
    </tr>
  `).join("\n");

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Landscape — ${escapeHtml(problem.slug)} — ${escapeHtml(runId)}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #111; }
  h1, h2 { font-weight: 600; }
  table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
  th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; vertical-align: top; }
  th { background: #f4f4f4; }
  .rel { padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.85em; }
  .rel-near_current_approach { background: #fde68a; }
  .rel-adjacent { background: #bae6fd; }
  .rel-divergent { background: #bbf7d0; }
</style>
</head>
<body>
  <h1>Solution Landscape</h1>
  <p><strong>Problem:</strong> ${escapeHtml(problem.title)}</p>
  <p><strong>Run:</strong> ${escapeHtml(runId)} · <strong>Signal:</strong> ${escapeHtml(landscape.landscape_signal)}</p>

  <h2>Cluster</h2>
  <table>
    <thead><tr><th>Label</th><th>Pattern Family</th><th>Relation</th><th>Signatur-Kontrast</th><th>Mitglieder</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}
