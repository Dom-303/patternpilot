---
problem: runtime-component-introspection-across-react-fiber-and-vue-vnode
run_id: 2026-04-25T21-22-50-655Z
project: pinflow
generated_at: 2026-04-25T21:22:50.669Z
llm_augmentation: false
---

## Problem (1 Satz)
PinFlow's pixel-to-code workflow needs a unified runtime adapter that introspects component trees from a running web application. Today the system supports React (via Fiber tree walking) and Vue 3 ...

## Landscape auf einen Blick
- 4 Ansatz-Cluster aus 14 bewerteten Repos
- Anti-Tunnel-Verteilung: 0 near_current_approach, 0 adjacent, 4 divergent
- Landscape-Signal: ok

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
| react-fiber-introspection+fiber+react | needs_manual_read | query:react-fiber-introspection, fiber, threejs | https://github.com/mohi331/Three-VFX, https://github.com/throap/EchoVale-Monsters-of-the-Lost-Isles, https://github.com/jefripunza/react-go | divergent |
| vue-vnode-walker+react+vue | needs_manual_read | query:vue-vnode-walker, vue, simple | https://github.com/martinszeltins/vue-vnode-context, https://github.com/logotip4ik/r2vnode, https://github.com/gitforziio/react-vnode | divergent |
| devtools_protocol+devtools+mcp | needs_manual_read | devtools, mcp, align | https://github.com/hcbylmz/rn-devtools-mcp, https://github.com/patchorbit/domscribe | divergent |
| scraper+anti-detection+chrome-extension | needs_manual_read | anti-detection, chrome-extension, crawler | https://github.com/wilkerHop/orbital-orion, https://github.com/ferdiunal/larapanda | divergent |

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: react-fiber-introspection+fiber+react
- constraint_clean_cluster: react-fiber-introspection+fiber+react
- anti_tunnel_alternative: react-fiber-introspection+fiber+react

## Nächster konkreter Schritt
→ `npm run intake -- --project pinflow --problem runtime-component-introspection-across-react-fiber-and-vue-vnode https://github.com/mohi331/Three-VFX`
