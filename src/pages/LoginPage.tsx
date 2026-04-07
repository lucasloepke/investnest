import { Link } from 'react-router-dom'
import { ROUTES } from '@/lib/routes'

export function LoginPage() {
  return (
    <section className="page page--auth">
      <h1>Log in</h1>
      <p>Login form will be implemented in task 6 (US2).</p>
      <p>
        <Link to={ROUTES.register}>Create an account</Link>
      </p>
    </section>
  )
}
