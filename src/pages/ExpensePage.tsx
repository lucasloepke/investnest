import { useEffect, useMemo, useState } from 'react'

type TransactionType = 'income' | 'expense'
type Recurrence = 'None' | 'Weekly' | 'Monthly' | 'Yearly'

interface Transaction {
  id: string
  type: TransactionType
  category: string
  amount: number
  date: string
  notes: string
  recurrence: Recurrence
}

const STORAGE_KEY = 'investnest_expense_tracker'
const defaultCategories = [
  'Housing',
  'Groceries',
  'Transport',
  'Utilities',
  'Subscriptions',
  'Income',
  'Entertainment',
  'Other',
]

function loadStoredTransactions(): Transaction[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Transaction[]
  } catch {
    return []
  }
}

function saveStoredTransactions(transactions: Transaction[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions))
}

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getNextOccurrence(date: string, recurrence: Recurrence) {
  if (recurrence === 'None') return null
  const now = new Date()
  let next = new Date(date)

  while (next <= now) {
    if (recurrence === 'Weekly') {
      next.setDate(next.getDate() + 7)
    } else if (recurrence === 'Monthly') {
      next.setMonth(next.getMonth() + 1)
    } else if (recurrence === 'Yearly') {
      next.setFullYear(next.getFullYear() + 1)
    }
  }

  return next.toISOString().slice(0, 10)
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function ExpensePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionType, setTransactionType] = useState<TransactionType>('expense')
  const [category, setCategory] = useState('Housing')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [recurrence, setRecurrence] = useState<Recurrence>('None')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTransactions(loadStoredTransactions())
  }, [])

  useEffect(() => {
    saveStoredTransactions(transactions)
  }, [transactions])

  const totals = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((sum, tx) => sum + tx.amount, 0)
    const expense = transactions.filter(t => t.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0)
    const net = income - expense
    const recurring = transactions.filter(t => t.recurrence !== 'None')
    return { income, expense, net, recurring }
  }, [transactions])

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => (b.date.localeCompare(a.date) || b.id.localeCompare(a.id))),
    [transactions],
  )

  const recurringTransactions = useMemo(
    () => sortedTransactions.filter(t => t.recurrence !== 'None'),
    [sortedTransactions],
  )

  function resetForm() {
    setTransactionType('expense')
    setCategory('Housing')
    setAmount('')
    setDate(new Date().toISOString().slice(0, 10))
    setNotes('')
    setRecurrence('None')
    setEditingId(null)
    setError(null)
  }

  function startEdit(transaction: Transaction) {
    setEditingId(transaction.id)
    setTransactionType(transaction.type)
    setCategory(transaction.category)
    setAmount(transaction.amount.toString())
    setDate(transaction.date)
    setNotes(transaction.notes)
    setRecurrence(transaction.recurrence)
    setError(null)
  }

  async function handleSave() {
    if (!category.trim() || !amount || !date) {
      setError('Category, amount, and date are required.')
      return
    }

    const parsedAmount = Number(amount)
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be a positive number.')
      return
    }

    setSaving(true)
    try {
      const nextTransaction: Transaction = {
        id: editingId ?? makeId(),
        type: transactionType,
        category: category.trim(),
        amount: parsedAmount,
        date,
        notes: notes.trim(),
        recurrence,
      }

      setTransactions(prev => {
        if (editingId) {
          return prev.map(tx => (tx.id === editingId ? nextTransaction : tx))
        }
        return [nextTransaction, ...prev]
      })
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  function handleDelete(id: string) {
    setTransactions(prev => prev.filter(tx => tx.id !== id))
    if (editingId === id) {
      resetForm()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0 }}>Expense Tracker</h1>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--color-muted)' }}>
              Track income, expenses, and recurring payments in one place.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))', gap: '0.75rem', width: '100%', maxWidth: 520 }}>
            <SummaryCard label="Income" value={formatCurrency(totals.income)} accent />
            <SummaryCard label="Expenses" value={formatCurrency(totals.expense)} />
            <SummaryCard label="Net Balance" value={formatCurrency(totals.net)} highlight={totals.net < 0} />
          </div>
        </div>
      </div>

      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{editingId ? 'Edit Transaction' : 'Add Transaction'}</h2>
          <button className="btn" style={{ width: 'auto', background: 'var(--color-border)', color: 'var(--color-text)' }} onClick={resetForm}>
            Clear
          </button>
        </div>

        {error && <p className="form-error--banner">{error}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
          <div className="form-field">
            <label className="form-label">Type</label>
            <select className="form-input" value={transactionType} onChange={e => setTransactionType(e.target.value as TransactionType)}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">Category</label>
            <input
              list="category-options"
              className="form-input"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="Add or choose a category"
            />
            <datalist id="category-options">
              {defaultCategories.map(option => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>

          <div className="form-field">
            <label className="form-label">Amount</label>
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="form-field">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notes (optional)</label>
            <textarea
              className="form-input"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="E.g. Monthly rent, paycheck, streaming subscription"
            />
          </div>

          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Recurring</label>
            <select className="form-input" value={recurrence} onChange={e => setRecurrence(e.target.value as Recurrence)}>
              <option value="None">None</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Yearly">Yearly</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button className="btn btn--primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Transaction'}
          </button>
          {editingId && (
            <button className="btn" type="button" style={{ background: 'var(--color-border)', color: 'var(--color-text)' }} onClick={resetForm}>
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Transactions</h2>
          <div style={{ color: 'var(--color-muted)', fontSize: '0.95rem' }}>
            {transactions.length} total · {recurringTransactions.length} recurring
          </div>
        </div>

        {transactions.length === 0 ? (
          <p style={{ color: 'var(--color-muted)' }}>No transactions yet. Add income or expenses above to track your balance.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Type</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Category</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Notes</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Recurring</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map(tx => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--color-border)', verticalAlign: 'top' }}>
                    <td style={{ padding: '0.75rem' }}>{formatDate(tx.date)}</td>
                    <td style={{ padding: '0.75rem', textTransform: 'capitalize', color: tx.type === 'income' ? 'var(--color-teal)' : 'var(--color-error)' }}>
                      {tx.type}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{tx.category}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--color-muted)' }}>{tx.notes || '—'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {tx.recurrence === 'None' ? 'No' : tx.recurrence}
                      {tx.recurrence !== 'None' && (
                        <div style={{ color: 'var(--color-muted)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                          Next: {formatDate(getNextOccurrence(tx.date, tx.recurrence) ?? tx.date)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                      {tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <button
                        className="btn"
                        type="button"
                        style={{
                          width: 'auto',
                          background: 'transparent',
                          color: 'var(--color-navy)',
                          border: '1px solid var(--color-border)',
                          padding: '0.35rem 0.75rem',
                        }}
                        onClick={() => startEdit(tx)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn"
                        type="button"
                        style={{
                          width: 'auto',
                          marginLeft: 8,
                          background: 'transparent',
                          color: 'var(--color-error)',
                          border: '1px solid rgba(192, 57, 43, 0.2)',
                          padding: '0.35rem 0.75rem',
                        }}
                        onClick={() => handleDelete(tx.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {recurringTransactions.length > 0 && (
        <div className="page">
          <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Recurring Transactions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {recurringTransactions.map(tx => (
              <div key={tx.id} style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.4rem' }}>
                  {tx.category}
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.25rem' }}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>{tx.recurrence}</div>
                <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                  Next due: {formatDate(getNextOccurrence(tx.date, tx.recurrence) ?? tx.date)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, accent, highlight }: { label: string; value: string; accent?: boolean; highlight?: boolean }) {
  return (
    <div style={{ background: accent ? 'var(--color-navy)' : 'var(--color-surface)', color: accent ? '#fff' : undefined, borderRadius: 14, padding: '1rem', minWidth: 160 }}>
      <div style={{ fontSize: '0.85rem', opacity: accent ? 0.8 : 1, color: accent ? '#fff' : 'var(--color-muted)' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 6, color: highlight ? 'var(--color-error)' : undefined }}>{value}</div>
    </div>
  )
}
