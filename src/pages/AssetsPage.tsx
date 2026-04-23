import { useEffect, useMemo, useState } from 'react'
import { addAsset, deleteAsset, getAssets, type Asset } from '@/lib/api'

const assetTypes = ['Cash', 'Investment', 'Real Estate', 'Other'] as const

type AssetType = (typeof assetTypes)[number]

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetName, setAssetName] = useState('')
  const [assetType, setAssetType] = useState<AssetType>('Cash')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    let mounted = true
    async function loadAssets() {
      try {
        const data = await getAssets()
        if (mounted) setAssets(data)
      } catch (err) {
        if (mounted) setError((err as Error).message)
      }
    }
    loadAssets()
    return () => {
      mounted = false
    }
  }, [])

  const totalValue = useMemo(
    () => assets.reduce((sum, asset) => sum + asset.value, 0),
    [assets],
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!assetName.trim()) {
      setError('Asset name is required.')
      return
    }

    const parsedValue = parseFloat(value)
    if (Number.isNaN(parsedValue) || parsedValue < 0) {
      setError('Enter a valid positive value for the asset.')
      return
    }

    setIsLoading(true)
    try {
      const created = await addAsset({
        asset_name: assetName.trim(),
        asset_type: assetType,
        value: parsedValue,
      })
      setAssets((current) => [created, ...current])
      setAssetName('')
      setValue('')
      setAssetType('Cash')
      setShowForm(false)
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
      setAssets((current) => current.filter((asset) => asset.asset_id !== assetId))
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
                <input
                  className="form-input"
                  value={assetName}
                  onChange={(event) => setAssetName(event.target.value)}
                  placeholder="e.g. Savings account"
                  required
                />
              </div>
              <div className="form-field">
                <label className="form-label">Asset Type</label>
                <select
                  className="form-input"
                  value={assetType}
                  onChange={(event) => setAssetType(event.target.value as AssetType)}
                >
                  {assetTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Value ($)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
            {error && <p className="form-error--banner">{error}</p>}
            <button className="btn btn--primary" type="submit" disabled={isLoading} style={{ width: 'auto', marginTop: '0.75rem' }}>
              {isLoading ? 'Saving...' : 'Add Asset'}
            </button>
          </form>
        )}
      </div>

      {/* Asset list */}
      <div className="page">
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Your Assets</h2>
        {assets.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', margin: 0 }}>No assets added yet. Add your first asset above.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-muted)' }}>
                <th style={{ padding: '0.4rem 0.5rem' }}>Name</th>
                <th style={{ padding: '0.4rem 0.5rem' }}>Type</th>
                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Value</th>
                <th style={{ padding: '0.4rem 0.5rem' }} />
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.asset_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.5rem' }}>{asset.asset_name}</td>
                  <td style={{ padding: '0.5rem', color: 'var(--color-muted)' }}>{asset.asset_type}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 500 }}>{fmt(asset.value)}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleDelete(asset.asset_id)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}
