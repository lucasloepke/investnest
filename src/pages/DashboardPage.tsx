import { useEffect, useState } from 'react'
import { getNetWorth, type NetWorthResponse } from '@/lib/api'

export function DashboardPage() {
  const [netWorth, setNetWorth] = useState<NetWorthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function loadNetWorth() {
      try {
        const summary = await getNetWorth()
        if (mounted) setNetWorth(summary)
      } catch (err) {
        if (mounted) setError((err as Error).message)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    loadNetWorth()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <section className="page page--dashboard">
      <header className="page__header">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of your current net worth, asset allocation, and financial summaries.</p>
        </div>
      </header>

      <section className="dashboard-grid">
        <article className="dashboard-card dashboard-card--summary">
          <h2>Net worth</h2>
          {isLoading ? (
            <p>Loading net worth...</p>
          ) : error ? (
            <p className="form-error">{error}</p>
          ) : netWorth ? (
            <p className="dashboard-value">
              ${netWorth.net_worth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          ) : (
            <p>No net worth data available yet.</p>
          )}
        </article>

        <article className="dashboard-card dashboard-card--allocation">
          <h2>Asset allocation</h2>
          {isLoading ? (
            <p>Loading asset allocation...</p>
          ) : error ? (
            <p className="form-error">{error}</p>
          ) : netWorth && netWorth.assets_by_type.length > 0 ? (
            <ul className="asset-breakdown-list">
              {netWorth.assets_by_type.map((entry) => (
                <li key={entry.asset_type}>
                  <strong>{entry.asset_type}</strong>
                  <span>{entry.count} item{entry.count === 1 ? '' : 's'}</span>
                  <span>${entry.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Add assets to see your allocation breakdown.</p>
          )}
        </article>
      </section>
    </section>
  )
}
