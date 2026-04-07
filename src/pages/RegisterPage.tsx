import { Link } from 'react-router-dom'
import { ROUTES } from '@/lib/routes'

export function RegisterPage() {
  return (
    <section className="page page--auth">
      <h1>Register</h1>
      <p>Registration form will be implemented in task 6 (US1).</p>
      <p>
        <Link to={ROUTES.login}>Already have an account?</Link>
      </p>
    </section>
  )
}
