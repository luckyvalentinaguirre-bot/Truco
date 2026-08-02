import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { NAV_ITEMS, MOBILE_PRIMARY } from '@/config/navigation';
import { Icon } from '@/components/ui';
import { Avatar } from '@/components/ui/Avatar';
import { BrandLogo } from './BrandLogo';
import { currentUser } from '@/services/mockData';
import { getRank } from '@/data/ranks';
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
  const rank = getRank(currentUser.rankId);

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
        <NavLink to="/perfil" className={styles.userCard}>
          <Avatar name={currentUser.displayName} size={40} online />
          <span className={styles.userMeta}>
            <span className={styles.userName}>{currentUser.displayName}</span>
            <span className={styles.userRank} style={{ color: rank.color }}>
              {rank.name} · Nv {currentUser.level}
            </span>
          </span>
        </NavLink>
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
        <NavLink to="/perfil" className={styles.topAvatar} aria-label="Perfil">
          <Avatar name={currentUser.displayName} size={36} online />
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
