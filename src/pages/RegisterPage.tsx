import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logo from '@/assets/investnest-logo.png'
import { useAuth } from '@/contexts/AuthContext'
import { ROUTES } from '@/lib/routes'

interface FormErrors {
  firstName?: string
  lastName?: string
  email?: string
  password?: string
  confirmPassword?: string
}

function validate(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  confirmPassword: string,
): FormErrors {
  const errors: FormErrors = {}
  if (!firstName.trim()) errors.firstName = 'First name is required.'
  if (!lastName.trim()) errors.lastName = 'Last name is required.'
  if (!email.trim()) {
    errors.email = 'Email is required.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.'
  }
  if (!password) {
    errors.password = 'Password is required.'
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters.'
  }
  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.'
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.'
  }
  return errors
}

export function RegisterPage() {
  const { register, isLoading } = useAuth()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError('')

    const validationErrors = validate(firstName, lastName, email, password, confirmPassword)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})

    try {
      await register({ firstName, lastName, email, password })
      navigate(ROUTES.dashboard, { replace: true })
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Registration failed.')
    }
  }

  return (
    <section className="page page--auth">
      <img src={logo} alt="InvestNest" className="auth-logo" />
      <h1 style={{ textAlign: 'center' }}>Create account</h1>
      <p className="auth-subtitle">Start managing your finances with InvestNest.</p>

      {serverError && <p className="form-error form-error--banner">{serverError}</p>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="form-field">
            <label htmlFor="firstName" className="form-label">
              First name
            </label>
            <input
              id="firstName"
              type="text"
              className={`form-input${errors.firstName ? ' form-input--invalid' : ''}`}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              required
            />
            {errors.firstName && <span className="form-error">{errors.firstName}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="lastName" className="form-label">
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              className={`form-input${errors.lastName ? ' form-input--invalid' : ''}`}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              required
            />
            {errors.lastName && <span className="form-error">{errors.lastName}</span>}
          </div>
        </div>

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
            autoComplete="new-password"
            required
          />
          {errors.password && <span className="form-error">{errors.password}</span>}
        </div>

        <div className="form-field">
          <label htmlFor="confirmPassword" className="form-label">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            className={`form-input${errors.confirmPassword ? ' form-input--invalid' : ''}`}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          {errors.confirmPassword && (
            <span className="form-error">{errors.confirmPassword}</span>
          )}
        </div>

        <button type="submit" className="btn btn--primary" disabled={isLoading}>
          {isLoading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account?{' '}
        <Link to={ROUTES.login}>Log in</Link>
      </p>
    </section>
  )
}
