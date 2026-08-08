import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PlayPage } from '@/pages/PlayPage';
import { MatchPage } from '@/pages/MatchPage';
import { LanPage } from '@/pages/LanPage';
import { FriendsPage } from '@/pages/FriendsPage';
import { RankingPage } from '@/pages/RankingPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { AuthPage } from '@/pages/AuthPage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { HistoryPage } from '@/pages/HistoryPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { CardsDevPage } from '@/pages/CardsDevPage';
import { DeckLabPage } from '@/pages/DeckLabPage';

/**
 * Rutas de la plataforma. Preparado para agregar rutas de
 * partida (/mesa/:id), autenticación y protección más adelante.
 */
const devRoutes = import.meta.env.DEV
  ? [
      { path: '/dev/cartas', element: <CardsDevPage /> },
      { path: '/dev/mazo', element: <DeckLabPage /> },
    ]
  : [];

export const router = createBrowserRouter([
  // Mesa a pantalla completa (fuera del shell de navegación).
  { path: '/mesa', element: <MatchPage /> },
  { path: '/lan', element: <LanPage /> },
  ...devRoutes,
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <PlayPage /> },
      { path: 'amigos', element: <FriendsPage /> },
      { path: 'ranking', element: <RankingPage /> },
      {
        path: 'perfil',
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      { path: 'cuenta', element: <AuthPage /> },
      { path: 'cartas', element: <CardsDevPage /> },
      { path: 'historial', element: <HistoryPage /> },
      { path: 'configuracion', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
