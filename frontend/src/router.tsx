import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PlayPage } from '@/pages/PlayPage';
import { FriendsPage } from '@/pages/FriendsPage';
import { RankingPage } from '@/pages/RankingPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { HistoryPage } from '@/pages/HistoryPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/**
 * Rutas de la plataforma. Preparado para agregar rutas de
 * partida (/mesa/:id), autenticación y protección más adelante.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <PlayPage /> },
      { path: 'amigos', element: <FriendsPage /> },
      { path: 'ranking', element: <RankingPage /> },
      { path: 'perfil', element: <ProfilePage /> },
      { path: 'historial', element: <HistoryPage /> },
      { path: 'configuracion', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
