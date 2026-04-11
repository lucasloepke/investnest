import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logo from '@/assets/investnest-logo.png'
import { useAuth } from '@/contexts/AuthContext'
import { ROUTES } from '@/lib/routes'

interface FormErrors {
  email?: string
  password?: string
}

function validate(email: string, password: string): FormErrors {
  const errors: FormErrors = {}
  if (!email.trim()) {
    errors.email = 'Email is required.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.'
  }
  if (!password) {
    errors.password = 'Password is required.'
  }
  return errors
}

export function LoginPage() {
  const { login, isLoading } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError('')

    const validationErrors = validate(email, password)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})

    try {
      await login({ email, password })
      navigate(ROUTES.dashboard, { replace: true })
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Login failed.')
    }
  }

  return (
    <section className="page page--auth">
      <img src={logo} alt="InvestNest" className="auth-logo" />
      <h1 style={{ textAlign: 'center' }}>Log in</h1>
      <p className="auth-subtitle">Welcome back to InvestNest.</p>

      {serverError && <p className="form-error form-error--banner">{serverError}</p>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="email" className="form-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            className={`form-input${errors.email ? ' form-input--invalid' : ''}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          {errors.email && <span className="form-error">{errors.email}</span>}
        </div>

        <div className="form-field">
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <input
            id="password"
            type="password"
            className={`form-input${errors.password ? ' form-input--invalid' : ''}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {errors.password && <span className="form-error">{errors.password}</span>}
        </div>

        <button type="submit" className="btn btn--primary" disabled={isLoading}>
          {isLoading ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="auth-switch">
        Don't have an account?{' '}
        <Link to={ROUTES.register}>Create one</Link>
      </p>
    </section>
  )
}
