import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getNetWorth } from '@/lib/api'
import type { NetWorthData } from '@/lib/api'
import { ROUTES } from '@/lib/routes'

export function DashboardPage() {
  const [data, setData] = useState<NetWorthData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    getNetWorth()
      .then(d => { if (mounted) setData(d) })
      .catch(e => { if (mounted) setError(e.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  if (loading) return <p className="page">Loading...</p>
  if (error) return <p className="page form-error--banner">{error}</p>
  if (!data) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <StatCard label="Net Worth" value={fmt(data.net_worth)} accent />
        <StatCard label="Spent This Month" value={fmt(data.expenses.this_month)} />
        <StatCard label="Spent This Year" value={fmt(data.expenses.this_year)} />
      </div>

      {/* Assets by type */}
      {data.assets_by_type.length > 0 && (
        <div className="page">
          <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Assets by Type</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
            {data.assets_by_type.map(a => (
              <div key={a.asset_type} style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '0.75rem 1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', textTransform: 'capitalize' }}>{a.asset_type}</div>
                <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{fmt(Number(a.total_value))}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{a.count} item{Number(a.count) !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget overview */}
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Budgets</h2>
          <Link to={ROUTES.budget} style={{ fontSize: '0.875rem' }}>Manage →</Link>
        </div>
        {data.budgets.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', margin: 0 }}>No budgets yet. <Link to={ROUTES.budget}>Create one →</Link></p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.budgets.map(b => {
              const pct = Math.min(100, (Number(b.total_spent) / Number(b.total_amount)) * 100)
              const over = pct >= 100
              return (
                <div key={b.budget_id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 500 }}>{b.name}</span>
                    <span style={{ color: over ? 'var(--color-error)' : 'var(--color-muted)' }}>
                      {fmt(Number(b.total_spent))} / {fmt(Number(b.total_amount))}
                    </span>
                  </div>
                  <ProgressBar pct={pct} over={over} />
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="page" style={{ background: accent ? 'var(--color-navy)' : undefined, color: accent ? '#fff' : undefined }}>
      <div style={{ fontSize: '0.8rem', opacity: accent ? 0.7 : 1, color: accent ? undefined : 'var(--color-muted)' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>{value}</div>
    </div>
  )
}

function ProgressBar({ pct, over }: { pct: number; over: boolean }) {
  return (
    <div style={{ height: 8, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: over ? 'var(--color-error)' : 'var(--color-teal)',
        borderRadius: 4,
        transition: 'width 0.3s'
      }} />
    </div>
  )
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}