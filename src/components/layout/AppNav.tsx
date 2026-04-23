import { NavLink } from 'react-router-dom'
import { ROUTES } from '@/lib/routes'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'app-nav__link app-nav__link--active' : 'app-nav__link'

export function AppNav() {
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
        <NavLink to={ROUTES.login} className={linkClass}>
          Login
        </NavLink>
      </nav>
    </header>
  )
}
