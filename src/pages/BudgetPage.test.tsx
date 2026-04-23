/**
 * #9 [TEST] - budget fields refresh and updating validation
 *
 * Verifies that a budget's "total" and "spent" fields correctly update
 * upon adding or updating a new expense or category.
 *
 * Setup (one-time):
 *   npm install -D vitest @vitest/coverage-v8 @testing-library/react \
 *     @testing-library/user-event @testing-library/jest-dom jsdom
 *
 * Add to vite.config.ts:
 *   import { defineConfig } from 'vite'
 *   export default defineConfig({
 *     test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.ts' },
 *     ...
 *   })
 *
 * Create src/test/setup.ts:
 *   import '@testing-library/jest-dom'
 *
 * Add to package.json scripts:
 *   "test": "vitest"
 *
 * Run:
 *   npm test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BudgetPage } from '@/pages/BudgetPage'
import * as api from '@/lib/api'

// When the expense form is open there are two buttons matching /log expense/i:
// the toggle ("+ Log Expense") and the submit ("Log Expense") inside the form.
// This helper grabs the submit button — it's always the last match.
function getLogExpenseSubmitBtn() {
  const all = screen.getAllByRole('button', { name: /log expense/i })
  return all[all.length - 1]
}

// Same pattern for "Add Category" submit button
function getAddCategorySubmitBtn() {
  const all = screen.getAllByRole('button', { name: /add category/i })
  return all[all.length - 1]
}

// ── Shared fixtures ────────────────────────────────────────────────────────────

const BUDGET_INITIAL: api.Budget = {
  budget_id: 1,
  user_id: 42,
  name: 'April 2026',
  total_amount: 3000,
  start_date: '2026-04-01',
  end_date: '2026-04-30',
  total_spent: 0,
  remaining: 3000,
}

const BUDGET_AFTER_EXPENSE: api.Budget = {
  ...BUDGET_INITIAL,
  total_spent: 200,
  remaining: 2800,
}

const BUDGET_AFTER_CATEGORY: api.Budget = {
  ...BUDGET_INITIAL,
  total_amount: 3500, // new category added 500
  remaining: 3500,
}

const CATEGORY_EMPTY: api.Category = {
  category_id: 10,
  budget_id: 1,
  category_name: 'Groceries',
  allocated_amount: 500,
  spent: 0,
  remaining: 500,
}

const CATEGORY_AFTER_EXPENSE: api.Category = {
  ...CATEGORY_EMPTY,
  spent: 200,
  remaining: 300,
}

const NEW_EXPENSE: api.Expense = {
  expense_id: 99,
  category_id: 10,
  user_id: 42,
  description: 'Weekly shop',
  amount: 200,
  expense_date: '2026-04-10',
  category_name: 'Groceries',
}

// ── Mock the entire api module ─────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  getBudgets: vi.fn(),
  createBudget: vi.fn(),
  deleteBudget: vi.fn(),
  getCategories: vi.fn(),
  createCategory: vi.fn(),
  getExpenses: vi.fn(),
  createExpense: vi.fn(),
  deleteExpense: vi.fn(),
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

function setupDefaults() {
  vi.mocked(api.getBudgets).mockResolvedValue([BUDGET_INITIAL])
  vi.mocked(api.getCategories).mockResolvedValue([CATEGORY_EMPTY])
  vi.mocked(api.getExpenses).mockResolvedValue([])
}

async function renderAndWait() {
  render(<BudgetPage />)
  // Wait for the initial data load to settle
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
}

// ── Unit tests ─────────────────────────────────────────────────────────────────

describe('BudgetPage – budget summary fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  // ── Initial render ─────────────────────────────────────────────────────────

  it('renders initial Total, Spent, and Remaining correctly', async () => {
    await renderAndWait()

    // $3,000 appears twice — once for Total, once for Remaining
    expect(screen.getAllByText('$3,000')).toHaveLength(2)
    expect(screen.getByText('$0')).toBeInTheDocument() // Spent
  })

  // ── Expense added ──────────────────────────────────────────────────────────

  it('updates Spent and Remaining after logging an expense', async () => {
    const user = userEvent.setup()

    // After the expense is created, subsequent getBudgets calls return updated totals
    vi.mocked(api.createExpense).mockResolvedValue(NEW_EXPENSE)
    vi.mocked(api.getBudgets)
      .mockResolvedValueOnce([BUDGET_INITIAL])   // initial load
      .mockResolvedValue([BUDGET_AFTER_EXPENSE]) // after expense

    vi.mocked(api.getCategories)
      .mockResolvedValueOnce([CATEGORY_EMPTY])        // initial load
      .mockResolvedValue([CATEGORY_AFTER_EXPENSE])    // after expense refresh

    await renderAndWait()

    // Open the expense form
    await user.click(screen.getByRole('button', { name: /log expense/i }))

    // Fill in the form
    await user.selectOptions(screen.getByRole('combobox'), '10')
    await user.clear(screen.getByPlaceholderText('49.99'))
    await user.type(screen.getByPlaceholderText('49.99'), '200')
    await user.clear(screen.getByPlaceholderText(/weekly groceries/i))
    await user.type(screen.getByPlaceholderText(/weekly groceries/i), 'Weekly shop')

    await user.click(getLogExpenseSubmitBtn())

    // Budget summary should now show updated values
    await waitFor(() => {
      expect(screen.getByText('$200')).toBeInTheDocument()  // Spent
      expect(screen.getByText('$2,800')).toBeInTheDocument() // Remaining
    })
  })

  it('calls getBudgets again after logging an expense (refresh triggered)', async () => {
    const user = userEvent.setup()

    vi.mocked(api.createExpense).mockResolvedValue(NEW_EXPENSE)
    vi.mocked(api.getBudgets)
      .mockResolvedValueOnce([BUDGET_INITIAL])
      .mockResolvedValue([BUDGET_AFTER_EXPENSE])
    vi.mocked(api.getCategories).mockResolvedValue([CATEGORY_AFTER_EXPENSE])

    await renderAndWait()

    await user.click(screen.getByRole('button', { name: /log expense/i }))
    await user.selectOptions(screen.getByRole('combobox'), '10')
    await user.type(screen.getByPlaceholderText('49.99'), '200')
    await user.type(screen.getByPlaceholderText(/weekly groceries/i), 'Weekly shop')
    await user.click(getLogExpenseSubmitBtn())

    await waitFor(() => {
      // Called once on mount, once after the expense was created
      expect(vi.mocked(api.getBudgets)).toHaveBeenCalledTimes(2)
    })
  })

  // ── Expense deleted ────────────────────────────────────────────────────────

  it('updates Spent and Remaining after deleting an expense', async () => {
    vi.mocked(api.getExpenses).mockResolvedValue([NEW_EXPENSE])
    vi.mocked(api.getCategories)
      .mockResolvedValueOnce([CATEGORY_AFTER_EXPENSE])
      .mockResolvedValue([CATEGORY_EMPTY])
    vi.mocked(api.getBudgets)
      .mockResolvedValueOnce([BUDGET_AFTER_EXPENSE])
      .mockResolvedValue([BUDGET_INITIAL])
    vi.mocked(api.deleteExpense).mockResolvedValue(undefined)

    await renderAndWait()

    // Confirm we start with the post-expense totals in the summary
    // ($200 also appears in the expense table row, so scope to the Spent stat label)
    expect(screen.getByText('Spent').nextElementSibling?.textContent).toBe('$200')

    const deleteBtn = screen.getByRole('button', { name: '✕' })
    await userEvent.setup().click(deleteBtn)

    // After deletion, the Spent stat should revert to $0
    await waitFor(() => {
      expect(screen.getByText('Spent').nextElementSibling?.textContent).toBe('$0')
      expect(screen.getAllByText('$3,000').length).toBeGreaterThan(0)
    })
  })

  it('calls getBudgets again after deleting an expense', async () => {
    vi.mocked(api.getExpenses).mockResolvedValue([NEW_EXPENSE])
    vi.mocked(api.getCategories).mockResolvedValue([CATEGORY_AFTER_EXPENSE])
    vi.mocked(api.getBudgets)
      .mockResolvedValueOnce([BUDGET_AFTER_EXPENSE])
      .mockResolvedValue([BUDGET_INITIAL])
    vi.mocked(api.deleteExpense).mockResolvedValue(undefined)

    await renderAndWait()

    await userEvent.setup().click(screen.getByRole('button', { name: '✕' }))

    await waitFor(() => {
      expect(vi.mocked(api.getBudgets)).toHaveBeenCalledTimes(2)
    })
  })

  // ── Category added ─────────────────────────────────────────────────────────

  it('calls getBudgets again after adding a category', async () => {
    const user = userEvent.setup()
    const NEW_CATEGORY: api.Category = {
      category_id: 20,
      budget_id: 1,
      category_name: 'Transport',
      allocated_amount: 300,
      spent: 0,
      remaining: 300,
    }

    vi.mocked(api.createCategory).mockResolvedValue(NEW_CATEGORY)
    vi.mocked(api.getBudgets)
      .mockResolvedValueOnce([BUDGET_INITIAL])
      .mockResolvedValue([BUDGET_AFTER_CATEGORY])
    vi.mocked(api.getCategories).mockResolvedValue([CATEGORY_EMPTY, NEW_CATEGORY])

    await renderAndWait()

    await user.click(screen.getByRole('button', { name: /add category/i }))
    await user.type(screen.getByPlaceholderText(/groceries/i), 'Transport')
    await user.type(screen.getByPlaceholderText('500'), '300')
    await user.click(getAddCategorySubmitBtn())

    await waitFor(() => {
      expect(vi.mocked(api.getBudgets)).toHaveBeenCalledTimes(2)
    })
  })

  // ── selectedBudget stays in sync ───────────────────────────────────────────

  it('keeps the correct budget selected after refresh', async () => {
    const user = userEvent.setup()

    vi.mocked(api.createExpense).mockResolvedValue(NEW_EXPENSE)
    vi.mocked(api.getBudgets)
      .mockResolvedValueOnce([BUDGET_INITIAL])
      .mockResolvedValue([BUDGET_AFTER_EXPENSE])
    vi.mocked(api.getCategories).mockResolvedValue([CATEGORY_AFTER_EXPENSE])

    await renderAndWait()

    await user.click(screen.getByRole('button', { name: /log expense/i }))
    await user.selectOptions(screen.getByRole('combobox'), '10')
    await user.type(screen.getByPlaceholderText('49.99'), '200')
    await user.type(screen.getByPlaceholderText(/weekly groceries/i), 'Weekly shop')
    await user.click(getLogExpenseSubmitBtn())

    await waitFor(() => {
      // The budget name heading should still be visible (not undefined/null)
      expect(screen.getByRole('heading', { name: /april 2026/i })).toBeInTheDocument()
    })
  })
})

// ── Integration-style tests (API contract) ─────────────────────────────────────

describe('BudgetPage – API call sequence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it('fetches budgets, categories, and expenses on mount in the correct order', async () => {
    const callOrder: string[] = []
    vi.mocked(api.getBudgets).mockImplementation(async () => { callOrder.push('getBudgets'); return [BUDGET_INITIAL] })
    vi.mocked(api.getCategories).mockImplementation(async () => { callOrder.push('getCategories'); return [CATEGORY_EMPTY] })
    vi.mocked(api.getExpenses).mockImplementation(async () => { callOrder.push('getExpenses'); return [] })

    await renderAndWait()

    expect(callOrder[0]).toBe('getBudgets')
    expect(callOrder).toContain('getCategories')
    expect(callOrder).toContain('getExpenses')
  })

  it('does not call getCategories or getExpenses when no budgets exist', async () => {
    vi.mocked(api.getBudgets).mockResolvedValue([])

    await renderAndWait()

    expect(vi.mocked(api.getCategories)).not.toHaveBeenCalled()
    expect(vi.mocked(api.getExpenses)).not.toHaveBeenCalled()
  })

  it('passes the correct budgetId when re-fetching after an expense', async () => {
    const user = userEvent.setup()

    vi.mocked(api.createExpense).mockResolvedValue(NEW_EXPENSE)
    vi.mocked(api.getBudgets)
      .mockResolvedValueOnce([BUDGET_INITIAL])
      .mockResolvedValue([BUDGET_AFTER_EXPENSE])
    vi.mocked(api.getCategories).mockResolvedValue([CATEGORY_AFTER_EXPENSE])

    await renderAndWait()

    await user.click(screen.getByRole('button', { name: /log expense/i }))
    await user.selectOptions(screen.getByRole('combobox'), '10')
    await user.type(screen.getByPlaceholderText('49.99'), '200')
    await user.type(screen.getByPlaceholderText(/weekly groceries/i), 'Weekly shop')
    await user.click(getLogExpenseSubmitBtn())

    await waitFor(() => {
      const categoryRefreshCalls = vi.mocked(api.getCategories).mock.calls
      // All getCategories calls should use budget_id = 1
      categoryRefreshCalls.forEach(([id]) => expect(id).toBe(1))
    })
  })
})
