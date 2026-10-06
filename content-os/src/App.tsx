import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { Dashboard } from './pages/Dashboard';

const Today = lazy(() => import('./pages/Today'));
const Episodes = lazy(() => import('./pages/Episodes'));
const EpisodeWorkspace = lazy(() => import('./pages/EpisodeWorkspace'));
const Board = lazy(() => import('./pages/Board'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const SeriesList = lazy(() => import('./pages/SeriesList'));
const SeriesDetail = lazy(() => import('./pages/SeriesDetail'));
const Ideas = lazy(() => import('./pages/Ideas'));
const Sources = lazy(() => import('./pages/Sources'));
const SourceDetail = lazy(() => import('./pages/SourceDetail'));
const Resurface = lazy(() => import('./pages/Resurface'));
const ActivityPage = lazy(() => import('./pages/ActivityPage'));
const ArchivePage = lazy(() => import('./pages/ArchivePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function Loading() {
  return (
    <div className="grid place-items-center py-24">
      <Spinner className="size-5" />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        {(
          [
            ['today', Today],
            ['episodes', Episodes],
            ['episodes/:id', EpisodeWorkspace],
            ['board', Board],
            ['projects', Projects],
            ['projects/:id', ProjectDetail],
            ['series', SeriesList],
            ['series/:id', SeriesDetail],
            ['ideas', Ideas],
            ['sources', Sources],
            ['sources/:id', SourceDetail],
            ['resurface', Resurface],
            ['activity', ActivityPage],
            ['archive', ArchivePage],
            ['settings', SettingsPage],
          ] as const
        ).map(([path, C]) => (
          <Route
            key={path}
            path={path}
            element={
              <Suspense fallback={<Loading />}>
                <C />
              </Suspense>
            }
          />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="text-title font-semibold">Page not found</p>
      <p className="mt-1 text-ui text-ink-3">The link may be outdated. Use Ctrl K to find what you were looking for.</p>
    </div>
  );
}
