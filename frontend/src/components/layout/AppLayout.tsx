import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NAV_ITEMS, MOBILE_PRIMARY } from '@/config/navigation';
import { Icon } from '@/components/ui';
import { Avatar } from '@/components/ui/Avatar';
import { BrandLogo } from './BrandLogo';
import { useAuth } from '@/features/auth/AuthContext';
import styles from './AppLayout.module.css';

/**
 * Shell responsive de la aplicación.
 *  - Desktop/laptop: navegación lateral fija.
 *  - Tablet/celular: topbar con menú hamburguesa + drawer + barra
 *    inferior táctil con los accesos primarios.
 */
export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, profile, logout } = useAuth();
  const authName = profile?.displayName || profile?.username || 'Jugador';

  const handleLogout = async () => {
    await logout();
    navigate('/cuenta');
  };

  // Cerrar el drawer al navegar.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Bloquear scroll del body con el drawer abierto.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  return (
    <div className={styles.shell}>
      {/* -------- Sidebar (desktop) -------- */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <BrandLogo />
        </div>
        <nav className={styles.nav} aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ')
              }
            >
              <Icon name={item.icon} size={22} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        {isAuthenticated ? (
          <div className={[styles.userCard, styles.userCardAuth].join(' ')}>
            <NavLink to="/perfil" className={styles.userCardLink} aria-label="Ir al perfil">
              <Avatar name={authName} size={40} online />
              <span className={styles.userMeta}>
                <span className={styles.userName}>{authName}</span>
                <span className={styles.userRank}>@{profile?.username}</span>
              </span>
            </NavLink>
            <button className={styles.logoutBtn} onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
        ) : (
          <NavLink to="/cuenta" className={styles.userCard}>
            <Avatar name="Invitado" size={40} />
            <span className={styles.userMeta}>
              <span className={styles.userName}>Iniciar sesión</span>
              <span className={styles.userRank}>Cuenta</span>
            </span>
          </NavLink>
        )}
      </aside>

      {/* -------- Topbar (mobile/tablet) -------- */}
      <header className={styles.topbar}>
        <button
          className={styles.iconBtn}
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menú"
        >
          <Icon name="menu" size={24} />
        </button>
        <BrandLogo />
        <NavLink
          to={isAuthenticated ? '/perfil' : '/cuenta'}
          className={styles.topAvatar}
          aria-label={isAuthenticated ? 'Perfil' : 'Cuenta'}
        >
          <Avatar name={isAuthenticated ? authName : 'Invitado'} size={36} online={isAuthenticated} />
        </NavLink>
      </header>

      {/* -------- Drawer (mobile) -------- */}
      <div
        className={[styles.scrim, drawerOpen ? styles.scrimOpen : ''].join(' ')}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={[styles.drawer, drawerOpen ? styles.drawerOpen : ''].join(' ')}
        aria-hidden={!drawerOpen}
      >
        <div className={styles.drawerHead}>
          <BrandLogo />
          <button
            className={styles.iconBtn}
            onClick={() => setDrawerOpen(false)}
            aria-label="Cerrar menú"
          >
            <Icon name="close" size={24} />
          </button>
        </div>
        <nav className={styles.nav} aria-label="Navegación">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ')
              }
            >
              <Icon name={item.icon} size={22} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        {isAuthenticated ? (
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Cerrar sesión ({authName})
          </button>
        ) : (
          <NavLink to="/cuenta" className={styles.navLink}>
            <Icon name="menu" size={22} />
            <span>Iniciar sesión</span>
          </NavLink>
        )}
      </aside>

      {/* -------- Contenido -------- */}
      <main className={styles.main}>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>

      {/* -------- Bottom nav (mobile) -------- */}
      <nav className={styles.bottomNav} aria-label="Navegación rápida">
        {MOBILE_PRIMARY.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              [styles.bottomItem, isActive ? styles.bottomItemActive : ''].join(' ')
            }
          >
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
