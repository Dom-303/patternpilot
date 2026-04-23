// lib/landscape/enrichment.mjs
//
// Leitet aus einem Problem + Landscape-Cluster-Set die sekundaeren
// Sichten ab, die der HTML-Renderer braucht:
//
//   - queryPlans   : die Problem-Linsen (Query-Phrasen) mit menschlichen
//                    Gruenden, warum jede Linse gewaehlt wurde
//   - agentView    : maschinenlesbare Uebergabe fuer KI-Coding-Agenten,
//                    abgeleitet aus problem + Cluster-Top-Repos + Tech-Tags
//   - techStatus   : Queries ausgefuehrt / Kandidaten-Luecken / Suchfehler
//
// Ohne diese Helper rendert der Landscape-Renderer seine neuen Sections
// als Empty-States — mit ihnen bekommt jeder Problem-Explore-Lauf den
// vollen Cockpit-Night-Look.
//
// Keine Netz- oder Dateisystem-Nebenwirkungen. Reine Transformer, damit
// problem-explore.mjs sie synchron am Ende des Laufs aufruft und in das
// landscape.json-Objekt hineinfaltet.

const RELATION_LABELS = {
  divergent: "divergente",
  adjacent: "benachbarte",
  near_current_approach: "nahe"
};

/**
 * Erzeugt Problem-Linsen fuer die "Bericht filtern"-/"Problem-Linsen"-Section.
 * Jede Query bekommt eine menschliche Begruendung, abhaengig davon ob sie
 * einen Tech-Tag, einen Approach-Signature-Begriff oder eine Constraint
 * treffen.
 */
export function buildLandscapeQueryPlans(queries, problem) {
  if (!Array.isArray(queries) || queries.length === 0) return [];
  const techTags = new Set((problem?.derived?.tech_tags ?? []).map((t) => String(t).toLowerCase()));
  const approach = new Set((problem?.derived?.approach_signature ?? []).map((t) => String(t).toLowerCase()));
  const constraints = problem?.derived?.constraint_tags ?? [];

  return queries.map((query, index) => {
    const q = String(query);
    const lower = q.toLowerCase();
    const reasons = [];

    const hitTech = [...techTags].find((tag) => lower.includes(tag));
    if (hitTech) reasons.push(`Nimmt Tech-Tag "${hitTech}" mit`);

    const hitApproach = [...approach].find((ax) => lower.includes(ax.replace(/-/g, " ")) || lower.includes(ax));
    if (hitApproach) reasons.push(`Trifft Approach-Signature "${hitApproach}"`);

    if (constraints.includes("opensource")) reasons.push("OpenSource-Filter wird in der Rangierung beruecksichtigt");

    if (q.split(/\s+/).length <= 2) reasons.push("Kurze Query — breite Abdeckung, ggf. zu generisch");
    if (q.split(/\s+/).length >= 3) reasons.push("Mehrwort-Query — praezisere Treffer, geringere Trefferquote");

    if (reasons.length === 0) reasons.push("Aus Problem-Slug abgeleitet");

    return {
      label: `Query ${index + 1}`,
      query: q,
      reasons
    };
  });
}

/**
 * Erzeugt den agentView-Block aus Problem + Clustern. Wenn keine Cluster
 * vorhanden sind, gibt null zurueck damit der Renderer den Empty-State
 * zeigt (kein halbgarer Agent-Hand-Off).
 */
export function buildLandscapeAgentView({ problem, slug, project, clusters, topRepoByCluster, queryPlans }) {
  if (!Array.isArray(clusters) || clusters.length === 0) return null;

  const fields = problem?.fields ?? {};
  const derived = problem?.derived ?? {};
  const projectLabel = project ?? problem?.project ?? "Zielprojekt";
  const problemTitle = fields.description ? fields.description.split(/\n|\./)[0].trim() : (slug ?? "Problem");

  // Relation-aware clustering — was ist der strategische Hebel
  const divergent = clusters.filter((c) => c.relation === "divergent");
  const adjacent = clusters.filter((c) => c.relation === "adjacent");
  const near = clusters.filter((c) => c.relation === "near_current_approach");

  const mission = [
    `Externe Loesungsraum-Landkarte fuer "${problemTitle}" ins Zielprojekt ${projectLabel} ueberfuehren`,
    divergent.length > 0
      ? `Divergente Cluster (${divergent.length}) pruefen — hoeheres Lernpotenzial, hoeherer Transfer-Aufwand`
      : `Keine divergenten Cluster — Landschaft liegt nahe am aktuellen Ansatz`,
    adjacent.length > 0
      ? `Benachbarte Cluster (${adjacent.length}) als Adaptions-Kandidaten auswerten`
      : `Keine benachbarten Cluster — Adaptions-Pfad unklar, Datenbasis pruefen`
  ];

  const deliverable = [
    "Je Cluster ein Kurz-Exposé mit Key-Takeaway fuer das Zielprojekt",
    "Pro divergentem Cluster eine klare adopt/adapt/observe/ignore-Entscheidung",
    "Decision-Log-Eintrag(e) im Zielprojekt, die auf diese Landscape referenzieren"
  ];

  const priorityRepos = [];
  const orderedClusters = [...divergent, ...adjacent, ...near];
  for (const cluster of orderedClusters.slice(0, 5)) {
    const topUrl = topRepoByCluster?.[cluster.label] ?? null;
    if (!topUrl) continue;
    const relationLabel = RELATION_LABELS[cluster.relation] ?? cluster.relation;
    priorityRepos.push({
      repo: topUrl.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, ""),
      action: `Als ${relationLabel} Referenz fuer "${cluster.label}" pruefen`,
      url: topUrl
    });
  }

  const context = [
    fields.current_approach ? `Aktueller Ansatz: ${fields.current_approach}` : null,
    fields.success_criteria ? `Erfolgskriterium: ${fields.success_criteria}` : null,
    `Approach-Signature: ${(derived.approach_signature ?? []).slice(0, 6).join(", ") || "-"}`,
    `Tech-Tags: ${(derived.tech_tags ?? []).slice(0, 6).join(", ") || "-"}`
  ].filter(Boolean);

  const guardrails = Array.isArray(fields.constraints) && fields.constraints.length > 0
    ? fields.constraints.slice(0, 5)
    : ["Keine spezifischen Constraints im Problem-Record — allgemeine Projekt-Leitplanken des Zielprojekts anwenden"];

  const uncertainties = Array.isArray(fields.non_goals) && fields.non_goals.length > 0
    ? fields.non_goals.slice(0, 4).map((ng) => `Nicht-Ziel: ${ng}`)
    : [`Landscape basiert auf ${clusters.length} Clustern — Repraesentativitaet gegen Projekt-Kontext validieren`];

  const primary = orderedClusters[0] ?? null;
  const primaryTopUrl = primary ? topRepoByCluster?.[primary.label] ?? null : null;
  const primaryRepoSlug = primaryTopUrl
    ? primaryTopUrl.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "")
    : null;

  const codingStarter = primary && primaryRepoSlug
    ? {
        primary: {
          repo: primaryRepoSlug,
          starterLabel: `adapters/${primary.key ?? "cluster"}-bridge.mjs`,
          implementationGoal: `Adaptions-Skizze fuer Cluster "${primary.label}" als Bruecke zum Zielprojekt`,
          firstSlice: `Minimal-Integration: 1 Vertreter aus Cluster "${primary.label}" gegen das Zielprojekt testen`,
          targetAreas: [primary.main_layer ?? "integration_layer"],
          starterMode: primary.relation === "divergent" ? "exploration" : "prototype",
          compareChecklist: [
            `Wie unterscheidet sich dieser ${RELATION_LABELS[primary.relation] ?? primary.relation} Ansatz vom aktuellen Stand?`,
            `Welche Annahmen des aktuellen Ansatzes stellt dieses Cluster in Frage?`,
            `Ist der Transfer-Aufwand in Relation zum erwarteten Gewinn vertretbar?`
          ],
          stopIf: [
            "Performance oder Qualitaet unter dem aktuellen Niveau ohne klare Perspektive",
            "Lizenz oder Distributionsform passt nicht zum Zielprojekt"
          ]
        },
        secondary: orderedClusters.slice(1, 3).map((cluster) => {
          const url = topRepoByCluster?.[cluster.label];
          if (!url) return null;
          const slug = url.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
          return {
            repo: slug,
            starterLabel: `adapters/${cluster.key ?? "cluster"}-bridge.mjs`,
            implementationGoal: `Alternativer Pfad aus Cluster "${cluster.label}"`,
            firstSlice: `Kurzvergleich gegen primaeren Pfad`,
            targetAreas: [cluster.main_layer ?? "integration_layer"],
            starterMode: "exploration",
            compareChecklist: [`Wo unterscheidet sich dieser Pfad vom primaeren?`],
            stopIf: ["Keine klaren Unterschiede zum primaeren Pfad"]
          };
        }).filter(Boolean)
      }
    : null;

  const payload = {
    schemaVersion: "2",
    handoffType: "landscape-to-project",
    problemSlug: slug ?? null,
    project: projectLabel,
    relationCounts: {
      divergent: divergent.length,
      adjacent: adjacent.length,
      near_current_approach: near.length
    }
  };

  return {
    mission,
    deliverable,
    priorityRepos,
    context,
    guardrails,
    uncertainties,
    codingStarter,
    payload,
    downloadFileName: `patternpilot-landscape-handoff-${slug ?? "problem"}.json`,
    references: Array.isArray(queryPlans) && queryPlans.length > 0
      ? queryPlans.slice(0, 4).map((q) => `Query: "${q.query}"`)
      : []
  };
}

/**
 * Erzeugt techStatus mit ausgefuehrten Queries, identifizierten
 * Kandidaten-Luecken (Heuristik: keine / sehr wenige Treffer) und
 * Suchfehlern.
 */
export function buildLandscapeTechStatus({ queries, candidateCount, clusterCount, outlierCount, passError }) {
  const effectiveQueries = Array.isArray(queries) ? queries.map(String) : [];
  const missingCandidates = [];
  const searchErrors = [];

  if (passError) searchErrors.push(`Discovery-Pass-Warnung: ${passError}`);

  if (effectiveQueries.length > 0 && (candidateCount ?? 0) === 0) {
    missingCandidates.push("Keine Kandidaten trotz aktiver Queries — Query-Seeds pruefen oder Discovery-Limit erhoehen");
  }
  if ((candidateCount ?? 0) > 0 && (clusterCount ?? 0) <= 1) {
    missingCandidates.push("Nur 1 Cluster gebildet — Kandidaten-Pool ist zu homogen; Query-Diversitaet erhoehen");
  }
  if ((outlierCount ?? 0) > 0 && (candidateCount ?? 0) > 0 && (outlierCount / candidateCount) > 0.5) {
    missingCandidates.push(`Hohe Outlier-Rate (${outlierCount}/${candidateCount}) — Mehrheit der Repos passt zu keinem Cluster; Signature-Definition ueberdenken`);
  }

  return {
    effectiveQueries,
    missingCandidates,
    searchErrors
  };
}
