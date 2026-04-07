import { Link } from 'react-router-dom'
import { ROUTES } from '@/lib/routes'

export function NotFoundPage() {
  return (
    <section className="page page--center">
      <h1>Page not found</h1>
      <p>
        <Link to={ROUTES.dashboard}>Back to dashboard</Link>
      </p>
    </section>
  )
}
