import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ROUTES } from '@/lib/routes'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'app-nav__link app-nav__link--active' : 'app-nav__link'

export function AppNav() {
  const { isAuthenticated, logout } = useAuth()

  return (
    <header className="app-nav">
      <strong className="app-nav__brand">InvestNest</strong>
      <nav className="app-nav__links" aria-label="Primary">
        <NavLink to={ROUTES.dashboard} className={linkClass}>
          Dashboard
        </NavLink>
        <NavLink to={ROUTES.budget} className={linkClass}>
          Budget
        </NavLink>
        <NavLink to={ROUTES.expenses} className={linkClass}>
          Expenses
        </NavLink>
        <NavLink to={ROUTES.assets} className={linkClass}>
          Assets
        </NavLink>
        {isAuthenticated ? (
          <button
            onClick={logout}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.8)',
              cursor: 'pointer',
              fontSize: 'inherit',
              fontWeight: 500,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
          >
            Logout
          </button>
        ) : (
          <NavLink to={ROUTES.login} className={linkClass}>
            Login
          </NavLink>
        )}
      </nav>
    </header>
  )
}
