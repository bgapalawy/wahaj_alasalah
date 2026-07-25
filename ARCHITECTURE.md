# Shams_Elgroub — Restructure Plan

## Why restructure

The current app is one `index.html` loading ~13 global `<script>` files (jQuery,
AWS SDK, Leaflet, vis-network, Chart.js) with no bundler and no module system.
Every function lives in the global scope, load order is load-bearing, and the
AWS SDK + DynamoDB credentials run **directly in the browser** — anyone can open
devtools and read them out of the network tab or the bundled JS.

This plan moves Shams_Elgroub to:

- **`backend/`** — a small Node/Express API that owns all AWS/DynamoDB access.
  The browser never sees AWS credentials again; it only talks to your API.
- **`frontend/`** — a React + Vite single-page app that replaces the jQuery/
  global-function code with components, hooks, and a typed API client.

## Monorepo layout

```
shams_elgroub-app/
├── backend/
│   ├── src/
│   │   ├── server.js                 # Express app entrypoint
│   │   ├── config/
│   │   │   └── aws.js                # DynamoDB client (server-side only)
│   │   ├── services/
│   │   │   ├── villaService.js       # villa CRUD + geojson assembly
│   │   │   ├── constructionItemsService.js
│   │   │   └── uploadService.js      # S3 presigned URLs
│   │   ├── routes/
│   │   │   ├── villas.routes.js
│   │   │   ├── constructionItems.routes.js
│   │   │   └── upload.routes.js
│   │   └── middleware/
│   │       └── errorHandler.js
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── api/
    │   │   ├── client.js              # fetch wrapper, no AWS creds here
    │   │   └── villas.js
    │   ├── hooks/
    │   │   └── useVillas.js
    │   ├── components/
    │   │   ├── map/
    │   │   │   ├── MapView.jsx        # replaces shams_elgroub_map_and_every_layer.js
    │   │   │   └── VillaLayer.jsx
    │   │   ├── panels/
    │   │   │   └── VillaDetailsPanel.jsx  # replaces left_click.js
    │   │   ├── graph/
    │   │   │   └── DependencyGraph.jsx    # replaces rightclick.js
    │   │   └── dashboard/
    │   │       ├── AllProjectsDashboard.jsx   # replaces dashboardallproject.js
    │   │       ├── ConstructionItemDashboard.jsx # replaces dashboardconstructionitem.js
    │   │       └── VillaDashboard.jsx         # replaces dashboardvilla.js
    │   ├── config/
    │   │   └── mapConfig.js
    │   └── styles/
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## Old → new file mapping

| Old file | New home | Notes |
|---|---|---|
| `index.html` (root) | `frontend/index.html` + `App.jsx` | markup becomes JSX components |
| `js/functions/awsConfig.js` | `backend/src/config/aws.js` | moved server-side, credentials via `.env`, never shipped to browser |
| `js/functions/awsFunctions.js` | `backend/src/services/*.js` | DynamoDB calls now live behind API routes |
| `js/functions/sendandgetdata.js` | `frontend/src/api/*.js` | becomes typed `fetch` calls to your own API |
| `js/functions/shams_elgroub_map_and_every_layer.js` | `frontend/src/components/map/MapView.jsx`, `VillaLayer.jsx` | Leaflet init + layer logic, filtering bypass removed once schema is fixed |
| `js/functions/left_click.js` | `frontend/src/components/panels/VillaDetailsPanel.jsx` | popup HTML strings become JSX |
| `js/functions/rightclick.js` | `frontend/src/components/graph/DependencyGraph.jsx` | vis-network wrapped in a component |
| `js/functions/dashboardallproject.js` | `frontend/src/components/dashboard/AllProjectsDashboard.jsx` | Chart.js wrapped in a component |
| `js/functions/dashboardconstructionitem.js` | `frontend/src/components/dashboard/ConstructionItemDashboard.jsx` | |
| `js/functions/dashboardvilla.js` | `frontend/src/components/dashboard/VillaDashboard.jsx` | |
| `js/functions/uniqueprojectdata.js` | `backend/src/services/constructionItemsService.js` (static data) or a DynamoDB seed table | currently hardcoded JS objects — good candidate to move into the database itself later |
| `js/functions/uploadingtodatabasefromexcel.js` | `backend/src/routes/upload.routes.js` + a small admin page | Excel import stays server-side |
| `js/functions/changecolors.js`, `initiating.js`, `other_packages.js`, `constructionItemsContainer.js` | absorbed into relevant components/hooks | one-off global helpers become local component logic |
| `css/*.css` | `frontend/src/styles/*.css` | kept as plain CSS, scoped per component where practical |

## Migration order (each phase ships something runnable)

1. **Phase 1 — Foundation (this delivery):** backend API skeleton + DynamoDB
   service layer, frontend Vite/React skeleton, and the map rendering villas
   from your API instead of a static GeoJSON file.
2. **Phase 2:** villa details panel (left-click) + file upload wired to S3
   via backend presigned URLs.
3. **Phase 3:** dependency graph (right-click) with vis-network.
4. **Phase 4:** the three dashboards (all-projects, construction item, villa).
5. **Phase 5:** Excel import/export tooling, cleanup of the old `TEMP`
   filtering bypass once `villaID`/`blocknum`/`villanum`/`TxtMemo` are
   populated from the ArcGIS pipeline.

## What you need to fill in

- `backend/.env` — your AWS region, access keys (server-side only now), and
  actual DynamoDB table names (I used placeholder names matching what's in
  your memory: `plannedCostsTable`, `ActualCostsTable`, etc. — swap in the
  real ones).
- `frontend/.env` — `VITE_API_BASE_URL` pointing at your backend.
