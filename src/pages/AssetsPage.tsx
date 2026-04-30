import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addAsset,
  deleteAsset,
  getAssets,
  getAssetQuotes,
  searchTicker,
  type Asset,
  type AssetQuote,
  type TickerSearchResult,
} from '@/lib/api'

const assetTypes = ['Cash', 'Stock', 'Real Estate', 'Other'] as const
type AssetType = (typeof assetTypes)[number]

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtChange(change: number, pct: string) {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)} (${pct})`
}

// ── Ticker search autocomplete ────────────────────────────────────────────────

function TickerSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<TickerSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setQuery(value) }, [value])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value.toUpperCase()
    setQuery(q)
    onChange(q)
    setResults([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 1) return
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const hits = await searchTicker(q)
        setResults(hits.slice(0, 5))
      } catch { /* silently ignore */ }
      finally { setSearching(false) }
    }, 500)
  }

  function pick(sym: string) { setQuery(sym); onChange(sym); setResults([]) }

  return (
    <div style={{ position: 'relative' }}>
      <input className="form-input" value={query} onChange={handleInput} placeholder="e.g. AAPL" autoComplete="off" />
      {searching && <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>Searching…</div>}
      {results.length > 0 && (
        <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.375rem', listStyle: 'none', margin: '0.25rem 0 0', padding: 0, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
          {results.map(r => (
            <li key={r.symbol} onClick={() => pick(r.symbol)}
              style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <span style={{ fontWeight: 600 }}>{r.symbol}</span>
              <span style={{ color: 'var(--color-muted)', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetName, setAssetName] = useState('')
  const [assetType, setAssetType] = useState<AssetType>('Cash')
  const [value, setValue] = useState('')
  const [tickerSymbol, setTickerSymbol] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [quotes, setQuotes] = useState<Record<number, AssetQuote>>({})
  const [quotesLoading, setQuotesLoading] = useState(false)
  const [quotesError, setQuotesError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  useEffect(() => {
    let mounted = true
    getAssets().then(data => { if (mounted) setAssets(data) }).catch(err => { if (mounted) setError((err as Error).message) })
    return () => { mounted = false }
  }, [])

  const totalValue = useMemo(
    () =>
      assets.reduce((sum, asset) => {
        if (asset.asset_type !== 'Stock') return sum + Number(asset.value)
        const quote = quotes[asset.asset_id]
        if (quote && !quote.error) return sum + quote.price * Number(asset.value)
        return sum
      }, 0),
    [assets, quotes],
  )
  const hasTickerAssets = assets.some(a => a.ticker_symbol)

  async function handleRefreshQuotes() {
    setQuotesLoading(true)
    setQuotesError(null)
    try {
      const quoteList = await getAssetQuotes()
      const map: Record<number, AssetQuote> = {}
      for (const q of quoteList) for (const id of q.asset_ids) map[id] = q
      setQuotes(map)
      setLastRefreshed(new Date())
    } catch (err) {
      setQuotesError((err as Error).message)
    } finally {
      setQuotesLoading(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!assetName.trim()) { setError('Asset name is required.'); return }
    const parsedValue = parseFloat(value)
    if (Number.isNaN(parsedValue) || parsedValue < 0) { setError('Enter a valid positive value for the asset.'); return }
    setIsLoading(true)
    try {
      const created = await addAsset({
        asset_name: assetName.trim(),
        asset_type: assetType,
        value: parsedValue,
        ticker_symbol: assetType === 'Stock' && tickerSymbol.trim() ? tickerSymbol.trim() : null,
      })
      setAssets(current => [created, ...current])
      setAssetName(''); setValue(''); setAssetType('Cash'); setTickerSymbol(''); setShowForm(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (assetId: number) => {
    setError(null)
    try {
      await deleteAsset(assetId)
      setAssets(current => current.filter(a => a.asset_id !== assetId))
      setQuotes(current => { const next = { ...current }; delete next[assetId]; return next })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header + add form */}
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: '0 0 0.25rem' }}>Assets</h1>
            <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.875rem' }}>
              Track your holdings and view your portfolio value in one place.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Total Asset Value</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{fmt(totalValue)}</div>
            </div>
            <button className="btn btn--primary" style={{ width: 'auto' }} onClick={() => { setShowForm(v => !v); setError(null) }}>
              {showForm ? 'Cancel' : '+ Add Asset'}
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div className="form-field">
                <label className="form-label">Asset Name</label>
                <input className="form-input" value={assetName} onChange={e => setAssetName(e.target.value)} placeholder="e.g. Apple shares" />
              </div>
              <div className="form-field">
                <label className="form-label">Asset Type</label>
                <select className="form-input" value={assetType} onChange={e => { setAssetType(e.target.value as AssetType); if (e.target.value !== 'Stock') setTickerSymbol('') }}>
                  {assetTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">{assetType === 'Stock' ? 'Amount of Shares' : 'Value ($)'}</label>
                <input className="form-input" type="number" min="0" step={assetType === 'Stock' ? '0.0001' : '0.01'} value={value} onChange={e => setValue(e.target.value)} placeholder={assetType === 'Stock' ? '0.0000' : '0.00'} required />
              </div>
            </div>

            {assetType === 'Stock' && (
              <div style={{ marginBottom: '0.75rem', maxWidth: '240px' }}>
                <div className="form-field">
                  <label className="form-label">
                    Ticker Symbol{' '}
                    <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>(optional)</span>
                  </label>
                  <TickerSearch value={tickerSymbol} onChange={setTickerSymbol} />
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                    Link this stock or ETF to see live prices and estimated value.
                  </p>
                </div>
              </div>
            )}

            {error && <p className="form-error--banner">{error}</p>}
            <button className="btn btn--primary" type="submit" disabled={isLoading} style={{ width: 'auto', marginTop: '0.75rem' }}>
              {isLoading ? 'Saving…' : 'Add Asset'}
            </button>
          </form>
        )}
      </div>

      {/* Asset list */}
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Your Assets</h2>
          {hasTickerAssets && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {lastRefreshed && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                  Updated {lastRefreshed.toLocaleTimeString()}
                </span>
              )}
              <button type="button" className="btn btn--secondary" style={{ width: 'auto', fontSize: '0.85rem' }} onClick={handleRefreshQuotes} disabled={quotesLoading}>
                {quotesLoading ? 'Fetching…' : '↻ Refresh Live Prices'}
              </button>
            </div>
          )}
        </div>

        {quotesError && (
          <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>⚠ {quotesError}</p>
        )}

        {assets.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', margin: 0 }}>No assets added yet. Add your first asset above.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-muted)' }}>
                <th style={{ padding: '0.4rem 0.5rem' }}>Name</th>
                <th style={{ padding: '0.4rem 0.5rem' }}>Type</th>
                <th style={{ padding: '0.4rem 0.5rem' }}>Ticker</th>
                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Shares</th>
                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Live Price</th>
                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Value Estimate</th>
                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Day Change</th>
                <th style={{ padding: '0.4rem 0.5rem' }} />
              </tr>
            </thead>
            <tbody>
              {assets.map(asset => {
                const quote = quotes[asset.asset_id]
                const isUp = quote && !quote.error && quote.change >= 0
                return (
                  <tr key={asset.asset_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '0.5rem' }}>{asset.asset_name}</td>
                    <td style={{ padding: '0.5rem', color: 'var(--color-muted)' }}>{asset.asset_type}</td>
                    <td style={{ padding: '0.5rem' }}>
                      {asset.ticker_symbol ? (
                        <span style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: '0.25rem', padding: '0.1rem 0.4rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.03em' }}>
                          {asset.ticker_symbol}
                        </span>
                      ) : <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 500 }}>
                      {asset.asset_type === 'Stock' ? Number(asset.value).toLocaleString('en-US', { maximumFractionDigits: 4 }) : fmt(asset.value)}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      {quote && !quote.error ? <span style={{ fontWeight: 500 }}>{fmt(quote.price)}</span>
                        : quote?.error ? <span style={{ color: 'var(--color-error)', fontSize: '0.78rem' }} title={quote.error}>Error</span>
                        : asset.ticker_symbol ? <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>—</span>
                        : null}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 500 }}>
                      {asset.asset_type === 'Stock' ? (
                        quote && !quote.error ? fmt(quote.price * Number(asset.value)) : <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>—</span>
                      ) : (
                        fmt(asset.value)
                      )}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      {quote && !quote.error && (
                        <span style={{ color: isUp ? '#22c55e' : '#ef4444', fontSize: '0.8rem', fontWeight: 500 }}>
                          {fmtChange(quote.change, quote.changePercent)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <button type="button" onClick={() => handleDelete(asset.asset_id)} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {hasTickerAssets && Object.keys(quotes).length === 0 && !quotesLoading && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
            Click <strong>Refresh Live Prices</strong> to fetch current market data for your stock assets.
          </p>
        )}
      </div>

    </div>
  )
}
