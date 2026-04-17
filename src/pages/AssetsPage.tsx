import { useEffect, useMemo, useState } from 'react'
import { addAsset, deleteAsset, getAssets, type Asset } from '@/lib/api'

const assetTypes = ['Cash', 'Investment', 'Real Estate', 'Other'] as const

type AssetType = (typeof assetTypes)[number]

export function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetName, setAssetName] = useState('')
  const [assetType, setAssetType] = useState<AssetType>('Cash')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

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
  () => assets.reduce((sum, asset) => sum + Number(asset.value), 0),
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
    <section className="page page--assets">
      <div className="page__header">
        <div>
          <h1>Assets</h1>
          <p>Enter holdings and view your portfolio value in one place.</p>
        </div>
        <div className="asset-summary">
          <strong>Total asset value</strong>
          <span>${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      <form className="asset-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Asset name
            <input
              value={assetName}
              onChange={(event) => setAssetName(event.target.value)}
              required
              placeholder="e.g. Savings account"
            />
          </label>
          <label>
            Asset type
            <select value={assetType} onChange={(event) => setAssetType(event.target.value as AssetType)}>
              {assetTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Value
            <input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              required
              placeholder="0.00"
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Add asset'}
          </button>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
      </form>

      <section className="asset-list">
        <h2>Your assets</h2>
        {assets.length === 0 ? (
          <p>No assets added yet. Add your first asset above.</p>
        ) : (
          <div className="asset-table-wrapper">
            <table className="asset-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.asset_id}>
                    <td>{asset.asset_name}</td>
                    <td>{asset.asset_type}</td>
                    <td>${asset.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>
                      <button type="button" className="button--text" onClick={() => handleDelete(asset.asset_id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}
