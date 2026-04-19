import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './app/components/layout/AppLayout';
import { DashboardPage } from './app/pages/DashboardPage';
import { RankingComparePage } from './app/pages/RankingComparePage';
import { ShapExplorerPage } from './app/pages/ShapExplorerPage';
import { RoadInspectorPage } from './app/pages/RoadInspectorPage';
import { MetricsCapturePage } from './app/pages/MetricsCapturePage';
import { DataDictionaryPage } from './app/pages/DataDictionaryPage';
import { MapExplorerPage } from './app/pages/MapExplorerPage';
import { TargetHitComparePage } from './app/pages/TargetHitComparePage';
import { RankingTransitionPage } from './app/pages/RankingTransitionPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="ranking-compare" element={<RankingComparePage />} />
          <Route path="target-hit-compare" element={<TargetHitComparePage />} />
          <Route path="ranking-transition" element={<RankingTransitionPage />} />
          <Route path="map-explorer" element={<MapExplorerPage />} />
          <Route path="shap-explorer" element={<ShapExplorerPage />} />
          <Route path="road-inspector" element={<RoadInspectorPage />} />
          <Route path="metrics-capture" element={<MetricsCapturePage />} />
          <Route path="data-dictionary" element={<DataDictionaryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
