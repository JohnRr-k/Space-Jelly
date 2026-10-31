import { lazy, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ConfirmProvider, ToastProvider } from './components/ui';
import { SettingsProvider, useSettings } from './app/settings';
import { ReminderProvider } from './app/reminders';
import { Shell } from './app/Shell';
import { Intro } from './scene/Intro';
import { Onboarding } from './modules/settings/Onboarding';

const Room = lazy(() => import('./modules/room/Room'));
const Journal = lazy(() => import('./modules/journal/Journal'));
const Legacy = lazy(() => import('./modules/legacy/Legacy'));
const Oracle = lazy(() => import('./modules/oracle/Oracle'));
const Future = lazy(() => import('./modules/future/Future'));
const CalendarPage = lazy(() => import('./modules/calendar/Calendar'));
const Notes = lazy(() => import('./modules/notes/Notes'));
const Settings = lazy(() => import('./modules/settings/Settings'));
const SearchPage = lazy(() => import('./modules/Search'));

function Gate() {
  const { settings } = useSettings();
  const [introDone, setIntroDone] = useState(false);
  return (
    <>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Room />} />
          <Route path="journal" element={<Journal />} />
          <Route path="journal/:id" element={<Journal />} />
          <Route path="legacy" element={<Legacy />} />
          <Route path="legacy/:section" element={<Legacy />} />
          <Route path="oracle/*" element={<Oracle />} />
          <Route path="future" element={<Future />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="notes" element={<Notes />} />
          <Route path="settings" element={<Settings />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      {!introDone && <Intro name={settings.displayName} line={settings.greetingLine} onDone={() => setIntroDone(true)} />}
      <Onboarding open={introDone && !settings.onboarded} />
    </>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <ConfirmProvider>
          <ReminderProvider>
            <HashRouter><Gate /></HashRouter>
          </ReminderProvider>
        </ConfirmProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
