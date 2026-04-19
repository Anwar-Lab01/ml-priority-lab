# ML Priority Lab

**Local-first analytical dashboard for comparing machine learning prioritization results for road segments across normative and historical scenarios.**

## Architecture

```
src/
├── app/                         # Application layer
│   ├── components/
│   │   ├── ui/                  # Reusable UI primitives
│   │   │   ├── MetricCard.tsx
│   │   │   ├── ChartCard.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── LoadingState.tsx
│   │   │   ├── ScenarioBadge.tsx
│   │   │   └── ModelBadge.tsx
│   │   ├── layout/             # App shell
│   │   │   ├── AppLayout.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── filters/            # Filter controls
│   │   │   └── FilterBar.tsx
│   │   ├── charts/             # Chart components (to be expanded)
│   │   └── tables/             # Table components (to be expanded)
│   └── pages/                  # Route pages
│       ├── DashboardPage.tsx
│       ├── RankingComparePage.tsx
│       ├── ShapExplorerPage.tsx
│       ├── RoadInspectorPage.tsx
│       ├── MetricsCapturePage.tsx
│       └── DataDictionaryPage.tsx
├── config/
│   └── scenarios.ts            # Centralized labels, colors, nav items
├── hooks/
│   └── useAppData.ts           # Data loading hook
├── lib/
│   ├── loaders.ts              # JSON data fetch layer
│   └── utils.ts                # Utility functions
├── types/
│   └── contracts.ts            # TypeScript interfaces for all JSON files
├── App.tsx                     # Root component with routing
├── main.tsx                    # Entry point
└── index.css                   # Global styles + Tailwind
```

## Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/` | Overview with KPI cards, model performance charts, SHAP summary, and target capture overview |
| Ranking Compare | `/ranking-compare` | Side-by-side ranking comparison across scenarios and models |
| SHAP Explorer | `/shap-explorer` | Global and local SHAP feature importance analysis |
| Road Inspector | `/road-inspector` | Drill into individual road segments |
| Metrics & Capture | `/metrics-capture` | Model metrics and target capture at various K thresholds |
| Data Dictionary | `/data-dictionary` | Documentation of all data fields and sources |

## Data Flow

1. **JSON files** are located in `public/data/` (served statically by Vite)
2. **`loaders.ts`** fetches JSON using typed generic fetchers
3. **`useAppData` hook** loads core data on mount with loading/error states
4. **Pages** consume data from the hook and pass it to chart/table components
5. **FilterBar** manages filter state; pages derive filtered data with `useMemo`

### Data Files

| File | Records | Description |
|------|---------|-------------|
| `scenarios.json` | 7 | Scenario definitions (normatif / historis) |
| `model_metrics.json` | 11 | Model performance metrics per scenario |
| `rankings.json` | ~4,550 | Road rankings per scenario + model |
| `shap_global.json` | 150 | Global SHAP feature importance |
| `shap_local.json` | ~31,500 | Local SHAP values per road × feature |
| `target_capture.json` | 25 | Target capture at various K thresholds |
| `target_rows.json` | 140 | Planned roads with ranking info |
| `road_features.json` | 700 | Normalized road features per scenario |

## Tech Stack

- **React 19** + **TypeScript**
- **Vite 8** (bundler + dev server)
- **Tailwind CSS v4** (styling)
- **Recharts** (standard charts)
- **Plotly** (advanced analytical charts, planned)
- **TanStack Table** (data tables, planned)
- **Lucide React** (icons)
- **React Router** (client-side routing)

## How to Run Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173/
```

### Prerequisites
- Node.js 18+
- npm 8+

### Production Build
```bash
npm run build
npm run preview
```

## Design Principles

- **Local-first**: All data loaded from JSON files, no backend required
- **Desktop-first**: Designed for analytical workflows on large screens
- **Light theme**: Restrained colors prioritizing readability
- **Centralized config**: All labels, colors, and mappings in `src/config/scenarios.ts`
- **Strong typing**: Full TypeScript contracts for all data shapes
