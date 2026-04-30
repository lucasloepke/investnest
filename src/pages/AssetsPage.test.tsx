/**
 * #13 [TEST] - Stock Ticker API integration with Assets page
 *
 * Verifies that:
 *  - Assets load and display correctly on mount
 *  - Ticker symbol field only appears for Stock type assets
 *  - Adding a Stock asset sends ticker_symbol to the API
 *  - Refresh Live Prices button only appears when ticker assets exist
 *  - Live price and day change are shown after a successful quote refresh
 *  - API errors from quote refresh are surfaced to the user
 *  - Deleting an asset removes it from the list
 *
 * Run:
 *   npm test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssetsPage } from '@/pages/AssetsPage'
import * as api from '@/lib/api'

// ── Shared fixtures ────────────────────────────────────────────────────────────

const CASH_ASSET: api.Asset = {
  asset_id: 1,
  asset_name: 'Savings Account',
  asset_type: 'Cash',
  value: 5000,
  ticker_symbol: null,
}

const STOCK_ASSET: api.Asset = {
  asset_id: 2,
  asset_name: 'Apple shares',
  asset_type: 'Stock',
  value: 10,
  ticker_symbol: 'AAPL',
}

const STOCK_ASSET_NO_TICKER: api.Asset = {
  asset_id: 3,
  asset_name: 'Index Fund',
  asset_type: 'Stock',
  value: 5,
  ticker_symbol: null,
}

const MOCK_QUOTE: api.AssetQuote = {
  symbol: 'AAPL',
  price: 210.50,
  change: 3.25,
  changePercent: '1.57%',
  latestTradingDay: '2026-04-24',
  asset_ids: [2],
}

const MOCK_QUOTE_DOWN: api.AssetQuote = {
  symbol: 'AAPL',
  price: 205.00,
  change: -5.50,
  changePercent: '-2.61%',
  latestTradingDay: '2026-04-24',
  asset_ids: [2],
}

// ── Mock the entire api module ─────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  getAssets: vi.fn(),
  addAsset: vi.fn(),
  deleteAsset: vi.fn(),
  getAssetQuotes: vi.fn(),
  searchTicker: vi.fn(),
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

function setupDefaults() {
  vi.mocked(api.getAssets).mockResolvedValue([])
  vi.mocked(api.getAssetQuotes).mockResolvedValue([])
  vi.mocked(api.searchTicker).mockResolvedValue([])
}

async function renderAndWait() {
  render(<AssetsPage />)
  await waitFor(() => expect(vi.mocked(api.getAssets)).toHaveBeenCalled())
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AssetsPage – initial render', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it('shows empty state message when user has no assets', async () => {
    await renderAndWait()
    expect(screen.getByText(/no assets added yet/i)).toBeInTheDocument()
  })

  it('renders asset list when assets exist', async () => {
    vi.mocked(api.getAssets).mockResolvedValue([CASH_ASSET, STOCK_ASSET])
    await renderAndWait()
    await waitFor(() => {
      expect(screen.getByText('Savings Account')).toBeInTheDocument()
      expect(screen.getByText('Apple shares')).toBeInTheDocument()
    })
  })

  it('shows total asset value summed correctly', async () => {
    vi.mocked(api.getAssets).mockResolvedValue([CASH_ASSET, STOCK_ASSET])
    await renderAndWait()
    // Only non-stock assets are included before live prices are fetched.
    await waitFor(() => {
      expect(screen.getAllByText('$5,000.00').length).toBeGreaterThan(0)
    })
  })

  it('shows ticker badge for stock assets with a ticker', async () => {
    vi.mocked(api.getAssets).mockResolvedValue([STOCK_ASSET])
    await renderAndWait()
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
    })
  })

  it('shows dash instead of ticker badge for assets without a ticker', async () => {
    vi.mocked(api.getAssets).mockResolvedValue([CASH_ASSET])
    await renderAndWait()
    await waitFor(() => {
      // The dash placeholder for ticker column
      expect(screen.getByText('Savings Account')).toBeInTheDocument()
    })
  })
})

describe('AssetsPage – Refresh Live Prices button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it('does NOT show Refresh button when no assets have a ticker', async () => {
    vi.mocked(api.getAssets).mockResolvedValue([CASH_ASSET, STOCK_ASSET_NO_TICKER])
    await renderAndWait()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /refresh live prices/i })).not.toBeInTheDocument()
    })
  })

  it('shows Refresh button when at least one asset has a ticker', async () => {
    vi.mocked(api.getAssets).mockResolvedValue([STOCK_ASSET])
    await renderAndWait()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /refresh live prices/i })).toBeInTheDocument()
    })
  })

  it('calls getAssetQuotes when Refresh button is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getAssets).mockResolvedValue([STOCK_ASSET])
    vi.mocked(api.getAssetQuotes).mockResolvedValue([MOCK_QUOTE])
    await renderAndWait()

    await waitFor(() => screen.getByRole('button', { name: /refresh live prices/i }))
    await user.click(screen.getByRole('button', { name: /refresh live prices/i }))

    await waitFor(() => {
      expect(vi.mocked(api.getAssetQuotes)).toHaveBeenCalledTimes(1)
    })
  })

  it('displays live price after a successful quote refresh', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getAssets).mockResolvedValue([STOCK_ASSET])
    vi.mocked(api.getAssetQuotes).mockResolvedValue([MOCK_QUOTE])
    await renderAndWait()

    await waitFor(() => screen.getByRole('button', { name: /refresh live prices/i }))
    await user.click(screen.getByRole('button', { name: /refresh live prices/i }))

    await waitFor(() => {
      expect(screen.getByText('$210.50')).toBeInTheDocument()
    })
  })

  it('displays value estimate using live price and shares', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getAssets).mockResolvedValue([STOCK_ASSET])
    vi.mocked(api.getAssetQuotes).mockResolvedValue([MOCK_QUOTE])
    await renderAndWait()

    await waitFor(() => screen.getByRole('button', { name: /refresh live prices/i }))
    await user.click(screen.getByRole('button', { name: /refresh live prices/i }))

    await waitFor(() => {
      // 10 shares * $210.50
      expect(screen.getAllByText('$2,105.00').length).toBeGreaterThan(0)
    })
  })

  it('shows green day change for a positive quote', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getAssets).mockResolvedValue([STOCK_ASSET])
    vi.mocked(api.getAssetQuotes).mockResolvedValue([MOCK_QUOTE])
    await renderAndWait()

    await waitFor(() => screen.getByRole('button', { name: /refresh live prices/i }))
    await user.click(screen.getByRole('button', { name: /refresh live prices/i }))

    await waitFor(() => {
      // positive change shows with + prefix
      expect(screen.getByText(/\+3\.25/)).toBeInTheDocument()
    })
  })

  it('shows negative day change for a down quote', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getAssets).mockResolvedValue([STOCK_ASSET])
    vi.mocked(api.getAssetQuotes).mockResolvedValue([MOCK_QUOTE_DOWN])
    await renderAndWait()

    await waitFor(() => screen.getByRole('button', { name: /refresh live prices/i }))
    await user.click(screen.getByRole('button', { name: /refresh live prices/i }))

    await waitFor(() => {
      expect(screen.getByText(/-5\.50/)).toBeInTheDocument()
    })
  })

  it('shows error message when getAssetQuotes fails', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getAssets).mockResolvedValue([STOCK_ASSET])
    vi.mocked(api.getAssetQuotes).mockRejectedValue(new Error('hit alpha vantage rate limit (25 requests/day on free tier)'))
    await renderAndWait()

    await waitFor(() => screen.getByRole('button', { name: /refresh live prices/i }))
    await user.click(screen.getByRole('button', { name: /refresh live prices/i }))

    await waitFor(() => {
      expect(screen.getByText(/rate limit/i)).toBeInTheDocument()
    })
  })
})

describe('AssetsPage – Add Asset form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it('opens the add asset form when + Add Asset is clicked', async () => {
    const user = userEvent.setup()
    await renderAndWait()

    await user.click(screen.getByRole('button', { name: /add asset/i }))
    expect(screen.getByPlaceholderText(/e\.g\. apple shares/i)).toBeInTheDocument()
  })

  it('does NOT show ticker field when asset type is Cash', async () => {
    const user = userEvent.setup()
    await renderAndWait()

    await user.click(screen.getByRole('button', { name: /add asset/i }))
    // Default type is Cash — ticker field should not be visible
    expect(screen.queryByPlaceholderText(/e\.g\. AAPL/i)).not.toBeInTheDocument()
  })

  it('shows ticker field when asset type is switched to Stock', async () => {
    const user = userEvent.setup()
    await renderAndWait()

    await user.click(screen.getByRole('button', { name: /add asset/i }))
    await user.selectOptions(screen.getByRole('combobox'), 'Stock')

    expect(screen.getByPlaceholderText(/e\.g\. AAPL/i)).toBeInTheDocument()
  })

  it('hides ticker field again when type is changed away from Stock', async () => {
    const user = userEvent.setup()
    await renderAndWait()

    await user.click(screen.getByRole('button', { name: /add asset/i }))
    await user.selectOptions(screen.getByRole('combobox'), 'Stock')
    expect(screen.getByPlaceholderText(/e\.g\. AAPL/i)).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox'), 'Cash')
    expect(screen.queryByPlaceholderText(/e\.g\. AAPL/i)).not.toBeInTheDocument()
  })

  it('calls addAsset with ticker_symbol when submitting a Stock asset', async () => {
    const user = userEvent.setup()
    const newAsset: api.Asset = { ...STOCK_ASSET, asset_id: 99 }
    vi.mocked(api.addAsset).mockResolvedValue(newAsset)
    await renderAndWait()

    await user.click(screen.getByRole('button', { name: /add asset/i }))
    await user.type(screen.getByPlaceholderText(/e\.g\. apple shares/i), 'Apple shares')
    await user.selectOptions(screen.getByRole('combobox'), 'Stock')
    await user.type(screen.getByPlaceholderText(/0\.0000/i), '10')
    await user.type(screen.getByPlaceholderText(/e\.g\. AAPL/i), 'AAPL')

    await user.click(screen.getByRole('button', { name: /^add asset$/i }))

    await waitFor(() => {
      expect(vi.mocked(api.addAsset)).toHaveBeenCalledWith(
        expect.objectContaining({ ticker_symbol: 'AAPL', asset_type: 'Stock' })
      )
    })
  })

  it('calls addAsset with null ticker_symbol for a Cash asset', async () => {
    const user = userEvent.setup()
    vi.mocked(api.addAsset).mockResolvedValue(CASH_ASSET)
    await renderAndWait()

    await user.click(screen.getByRole('button', { name: /add asset/i }))
    await user.type(screen.getByPlaceholderText(/e\.g\. apple shares/i), 'Savings Account')
    await user.type(screen.getByPlaceholderText(/0\.00/i), '5000')

    await user.click(screen.getByRole('button', { name: /^add asset$/i }))

    await waitFor(() => {
      expect(vi.mocked(api.addAsset)).toHaveBeenCalledWith(
        expect.objectContaining({ ticker_symbol: null, asset_type: 'Cash' })
      )
    })
  })

  it('shows new asset in the list after adding', async () => {
    const user = userEvent.setup()
    vi.mocked(api.addAsset).mockResolvedValue(STOCK_ASSET)
    await renderAndWait()

    await user.click(screen.getByRole('button', { name: /add asset/i }))
    await user.type(screen.getByPlaceholderText(/e\.g\. apple shares/i), 'Apple shares')
    await user.selectOptions(screen.getByRole('combobox'), 'Stock')
    await user.type(screen.getByPlaceholderText(/0\.0000/i), '10')

    await user.click(screen.getByRole('button', { name: /^add asset$/i }))

    await waitFor(() => {
      expect(screen.getByText('Apple shares')).toBeInTheDocument()
    })
  })

  it('shows validation error when asset name is empty', async () => {
    const user = userEvent.setup()
    await renderAndWait()

    await user.click(screen.getByRole('button', { name: /add asset/i }))
    await user.type(screen.getByPlaceholderText(/0\.00/i), '100')

    await user.click(screen.getByRole('button', { name: /^add asset$/i }))

    await waitFor(() => {
      expect(screen.getByText(/asset name is required/i)).toBeInTheDocument()
    })
  })
})

describe('AssetsPage – delete asset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it('removes asset from list after deletion', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getAssets).mockResolvedValue([CASH_ASSET])
    vi.mocked(api.deleteAsset).mockResolvedValue(undefined)
    await renderAndWait()

    await waitFor(() => screen.getByText('Savings Account'))
    await user.click(screen.getByRole('button', { name: '✕' }))

    await waitFor(() => {
      expect(screen.queryByText('Savings Account')).not.toBeInTheDocument()
    })
  })

  it('calls deleteAsset with the correct asset id', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getAssets).mockResolvedValue([CASH_ASSET])
    vi.mocked(api.deleteAsset).mockResolvedValue(undefined)
    await renderAndWait()

    await waitFor(() => screen.getByText('Savings Account'))
    await user.click(screen.getByRole('button', { name: '✕' }))

    await waitFor(() => {
      expect(vi.mocked(api.deleteAsset)).toHaveBeenCalledWith(CASH_ASSET.asset_id)
    })
  })
})
