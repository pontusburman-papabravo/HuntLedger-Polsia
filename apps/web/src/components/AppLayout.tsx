import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { DashboardIcon, SessionsIcon, LocationsIcon, WeaponsIcon, AmmunitionIcon, BadgesIcon, ReportsIcon, AdminIcon, SettingsIcon, FeedbackIcon, FeedbackAdminIcon } from './NavIcons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { LanguageToggle } from './LanguageToggle';

export function AppLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navItem = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');
  const userAny = user as any;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">{t('app.name')}</div>
        <div className="tagline">{t('app.tagline')}</div>

        <NavLink to="/" end className={navItem}>
          <span className="hl-nav-r"><DashboardIcon size={18}/>{t('nav.dashboard')}</span>
        </NavLink>
        <NavLink to="/sessions" className={navItem}>
          <span className="hl-nav-r"><SessionsIcon size={18}/>{t('nav.sessions')}</span>
        </NavLink>
        <NavLink to="/locations" className={navItem}>
          <span className="hl-nav-r"><LocationsIcon size={18}/>{t('nav.locations')}</span>
        </NavLink>
        <NavLink to="/weapons" className={navItem}>
          <span className="hl-nav-r"><WeaponsIcon size={18}/>{t('nav.weapons')}</span>
        </NavLink>
        <NavLink to="/ammunition" className={navItem}>
          <span className="hl-nav-r"><AmmunitionIcon size={18}/>{t('nav.ammunition')}</span>
        </NavLink>
        <NavLink to="/badges" className={navItem}>
          <span className="hl-nav-r"><BadgesIcon size={18}/>{t('nav.badges')}</span>
        </NavLink>
        <NavLink to="/reports" className={navItem}>
          <span className="hl-nav-r"><ReportsIcon size={18}/>{t('nav.reports')}</span>
        </NavLink>
        <NavLink to="/settings" className={navItem}><span className="hl-nav-r"><SettingsIcon size={18}/>{t('nav.settings', 'Settings')}</span></NavLink>
        <NavLink to="/feedback" className={navItem}><span className="hl-nav-r"><FeedbackIcon size={18}/>{t('nav.feedback')}</span></NavLink>
        {userAny?.isAdmin && <NavLink to="/admin" className={navItem}><span className="hl-nav-r"><AdminIcon size={18}/>{t('nav.admin', 'Admin')}</span></NavLink>}
        {userAny?.isAdmin && <NavLink to="/feedback-admin" className={navItem}><span className="hl-nav-r"><FeedbackAdminIcon size={18}/>{t('nav.feedbackAdmin')}</span></NavLink>}

        <div className="spacer" />

        <div className="user-block">
          <div>{user?.name}</div>
          <div className="muted" style={{ fontSize: '0.8rem' }}>
            {user?.email}
          </div>
          <button
            type="button"
            className="ghost"
            style={{ marginTop: 10, color: 'var(--primary-fg)' }}
            onClick={handleLogout}
          >
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <LanguageToggle />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}