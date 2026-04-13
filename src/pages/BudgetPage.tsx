import { useEffect, useState } from 'react'
import {
  getBudgets, createBudget, deleteBudget,
  getCategories, createCategory,
  getExpenses, createExpense, deleteExpense
} from '@/lib/api'
import type { Budget, Category, Expense } from '@/lib/api'

export function BudgetPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // forms
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [showCatForm, setShowCatForm] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)

  useEffect(() => {
    getBudgets()
      .then(b => { setBudgets(b); if (b.length) setSelectedBudget(b[0]) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedBudget) return
    Promise.all([
      getCategories(selectedBudget.budget_id),
      getExpenses(selectedBudget.budget_id)
    ]).then(([cats, exps]) => { setCategories(cats); setExpenses(exps) })
      .catch(e => setError(e.message))
  }, [selectedBudget])

  async function handleDeleteBudget(id: number) {
    await deleteBudget(id)
    const updated = budgets.filter(b => b.budget_id !== id)
    setBudgets(updated)
    setSelectedBudget(updated[0] ?? null)
  }

  async function handleDeleteExpense(id: number) {
    await deleteExpense(id)
    setExpenses(prev => prev.filter(e => e.expense_id !== id))
    if (selectedBudget) {
      const cats = await getCategories(selectedBudget.budget_id)
      setCategories(cats)
    }
  }

  if (loading) return <p className="page">Loading...</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && <p className="form-error--banner">{error}</p>}

      {/* Budget selector */}
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 style={{ margin: 0 }}>Budgets</h1>
          <button className="btn btn--primary" style={{ width: 'auto' }} onClick={() => setShowBudgetForm(v => !v)}>
            + New Budget
          </button>
        </div>

        {showBudgetForm && (
          <NewBudgetForm onCreated={b => {
            setBudgets(prev => [b, ...prev])
            setSelectedBudget(b)
            setShowBudgetForm(false)
          }} />
        )}

        {budgets.length === 0 ? (
          <p style={{ color: 'var(--color-muted)' }}>No budgets yet. Create one above!</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: showBudgetForm ? '1rem' : 0 }}>
            {budgets.map(b => (
              <button key={b.budget_id}
                onClick={() => setSelectedBudget(b)}
                style={{
                  padding: '0.4rem 1rem',
                  borderRadius: 6,
                  border: '1px solid',
                  borderColor: selectedBudget?.budget_id === b.budget_id ? 'var(--color-teal)' : 'var(--color-border)',
                  background: selectedBudget?.budget_id === b.budget_id ? 'var(--color-teal)' : '#fff',
                  color: selectedBudget?.budget_id === b.budget_id ? '#fff' : 'var(--color-text)',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.875rem'
                }}>
                {b.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected budget detail */}
      {selectedBudget && (
        <>
          {/* Budget summary */}
          <div className="page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: '0 0 0.25rem' }}>{selectedBudget.name}</h2>
                <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                  {fmtDate(selectedBudget.start_date)} – {fmtDate(selectedBudget.end_date)}
                </p>
              </div>
              <button onClick={() => handleDeleteBudget(selectedBudget.budget_id)}
                style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontSize: '0.875rem' }}>
                Delete
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
              <MiniStat label="Total" value={fmt(Number(selectedBudget.total_amount))} />
              <MiniStat label="Spent" value={fmt(Number(selectedBudget.total_spent))} />
              <MiniStat label="Remaining" value={fmt(Number(selectedBudget.remaining))} highlight={Number(selectedBudget.remaining) < 0} />
            </div>
          </div>

          {/* Categories & progress bars */}
          <div className="page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Categories</h2>
              <button className="btn btn--primary" style={{ width: 'auto' }} onClick={() => setShowCatForm(v => !v)}>
                + Add Category
              </button>
            </div>

            {showCatForm && (
              <NewCategoryForm budgetId={selectedBudget.budget_id} onCreated={cat => {
                setCategories(prev => [...prev, cat])
                setShowCatForm(false)
              }} />
            )}

            {categories.length === 0 ? (
              <p style={{ color: 'var(--color-muted)' }}>No categories yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: showCatForm ? '1rem' : 0 }}>
                {categories.map(cat => {
                  const pct = Math.min(100, (Number(cat.spent) / Number(cat.allocated_amount)) * 100)
                  const over = Number(cat.spent) > Number(cat.allocated_amount)
                  return (
                    <div key={cat.category_id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 500 }}>{cat.category_name}</span>
                        <span style={{ color: over ? 'var(--color-error)' : 'var(--color-muted)' }}>
                          {fmt(Number(cat.spent))} / {fmt(Number(cat.allocated_amount))}
                        </span>
                      </div>
                      <div style={{ height: 8, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: over ? 'var(--color-error)' : 'var(--color-teal)',
                          borderRadius: 4, transition: 'width 0.3s'
                        }} />
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
                        {fmt(Number(cat.remaining))} remaining
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Expense log */}
          <div className="page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Expenses</h2>
              <button className="btn btn--primary" style={{ width: 'auto' }} onClick={() => setShowExpenseForm(v => !v)}>
                + Log Expense
              </button>
            </div>

            {showExpenseForm && (
              <NewExpenseForm categories={categories} onCreated={async exp => {
                setExpenses(prev => [exp, ...prev])
                setShowExpenseForm(false)
                const cats = await getCategories(selectedBudget.budget_id)
                setCategories(cats)
              }} />
            )}

            {expenses.length === 0 ? (
              <p style={{ color: 'var(--color-muted)' }}>No expenses logged yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-muted)' }}>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Date</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Description</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Category</th>
                    <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(e => (
                    <tr key={e.expense_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.5rem' }}>{fmtDate(e.expense_date)}</td>
                      <td style={{ padding: '0.5rem' }}>{e.description}</td>
                      <td style={{ padding: '0.5rem', color: 'var(--color-muted)' }}>{e.category_name}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 500 }}>{fmt(Number(e.amount))}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <button onClick={() => handleDeleteExpense(e.expense_id)}
                          style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontSize: '0.8rem' }}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-forms ─────────────────────────────────────────────────────────────────

function NewBudgetForm({ onCreated }: { onCreated: (b: Budget) => void }) {
  const [name, setName] = useState('')
  const [total, setTotal] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!name || !total || !start || !end) return setErr('All fields required')
    setSaving(true)
    try {
      const b = await createBudget({ name, total_amount: Number(total), start_date: start, end_date: end })
      onCreated(b)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to create budget')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
      {err && <p className="form-error--banner">{err}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div className="form-field">
          <label className="form-label">Name</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. April 2026" />
        </div>
        <div className="form-field">
          <label className="form-label">Total Amount</label>
          <input className="form-input" type="number" value={total} onChange={e => setTotal(e.target.value)} placeholder="3000" />
        </div>
        <div className="form-field">
          <label className="form-label">Start Date</label>
          <input className="form-input" type="date" value={start} onChange={e => setStart(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label">End Date</label>
          <input className="form-input" type="date" value={end} onChange={e => setEnd(e.target.value)} />
        </div>
      </div>
      <button className="btn btn--primary" style={{ width: 'auto' }} onClick={submit} disabled={saving}>
        {saving ? 'Creating...' : 'Create Budget'}
      </button>
    </div>
  )
}

function NewCategoryForm({ budgetId, onCreated }: { budgetId: number; onCreated: (c: Category) => void }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!name || !amount) return setErr('All fields required')
    setSaving(true)
    try {
      const c = await createCategory(budgetId, { category_name: name, allocated_amount: Number(amount) })
      onCreated(c)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
      {err && <p className="form-error--banner">{err}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div className="form-field">
          <label className="form-label">Category Name</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Groceries" />
        </div>
        <div className="form-field">
          <label className="form-label">Allocated Amount</label>
          <input className="form-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="500" />
        </div>
      </div>
      <button className="btn btn--primary" style={{ width: 'auto' }} onClick={submit} disabled={saving}>
        {saving ? 'Adding...' : 'Add Category'}
      </button>
    </div>
  )
}

function NewExpenseForm({ categories, onCreated }: { categories: Category[]; onCreated: (e: Expense) => void }) {
  const [categoryId, setCategoryId] = useState(categories[0]?.category_id?.toString() ?? '')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!categoryId || !description || !amount || !date) return setErr('All fields required')
    setSaving(true)
    try {
      const e = await createExpense({
        category_id: Number(categoryId),
        description,
        amount: Number(amount),
        expense_date: date
      })
      onCreated(e)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
      {err && <p className="form-error--banner">{err}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div className="form-field">
          <label className="form-label">Category</label>
          <select className="form-input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Amount</label>
          <input className="form-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="49.99" />
        </div>
        <div className="form-field">
          <label className="form-label">Description</label>
          <input className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Weekly groceries" />
        </div>
        <div className="form-field">
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <button className="btn btn--primary" style={{ width: 'auto' }} onClick={submit} disabled={saving}>
        {saving ? 'Saving...' : 'Log Expense'}
      </button>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '0.75rem 1rem' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: '1.1rem', color: highlight ? 'var(--color-error)' : undefined }}>{value}</div>
    </div>
  )
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
