require('dotenv').config()
const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const db = require('./db')
const av = require('./alphaVantage')
const bcrypt = require('bcrypt')

const app = express()

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())


// checks the jwt on protected routes, attaches user to req
function auth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'not logged in' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(403).json({ error: 'token invalid or expired' })
  }
}

app.get('/ping', (_req, res) => res.json({ ok: true }))


//TODO james: add register/login stuff here
//jwt payload needs to have user_id in it or nothing below works

// register
app.post('/api/register', async (req, res) => {
  const { email, password, name } = req.body
  if (!email || !password || !name)
    return res.status(400).json({ error: 'missing required fields' })

  const parts = name.trim().split(' ')
  const first_name = parts[0]
  const last_name = parts.slice(1).join(' ') || ''

  try {
    const hashed = await bcrypt.hash(password, 10)
    const result = await db.query(
      'INSERT INTO users (email, user_password, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING user_id, email, first_name, last_name',
      [email, hashed, first_name, last_name]
    )
    const user = result.rows[0]
    const token = jwt.sign({ user_id: user.user_id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.status(201).json({ token, user: { user_id: user.user_id, email: user.email, name: `${user.first_name} ${user.last_name}`.trim() } })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'email already in use' })
    res.status(500).json({ error: 'registration failed' })
  }
})

// login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ error: 'missing email or password' })

  try {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )
    const user = result.rows[0]
    if (!user) return res.status(401).json({ error: 'invalid credentials' })

    const match = await bcrypt.compare(password, user.user_password)
    if (!match) return res.status(401).json({ error: 'invalid credentials' })

    const token = jwt.sign({ user_id: user.user_id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { user_id: user.user_id, email: user.email, name: `${user.first_name} ${user.last_name}`.trim() } })
  } catch (err) {
    res.status(500).json({ error: 'login failed' })
  }
})


//budgets
app.get('/api/budgets', auth, async (req, res) => {
  const uid = req.user.user_id
  try {
    const result = await db.query(
      `SELECT b.*, COALESCE(SUM(e.amount), 0) as total_spent,
        b.total_amount - COALESCE(SUM(e.amount), 0) as remaining
       FROM budgets b
       LEFT JOIN budget_categories bc ON bc.budget_id = b.budget_id
       LEFT JOIN expenses e ON e.category_id = bc.category_id
       WHERE b.user_id = $1
       GROUP BY b.budget_id ORDER BY b.start_date DESC`,
      [uid]
    )
    res.json(result.rows)
  } catch(err) {
    console.log(err)
    res.status(500).json({ error: 'something went wrong fetching budgets' })
  }
})

app.get('/api/budgets/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM budgets WHERE budget_id = $1 AND user_id = $2',
      [req.params.id, req.user.user_id]
    )
    if (!result.rows.length) return res.status(404).json({ error: 'budget not found' })
    res.json(result.rows[0])
  } catch {
    res.status(500).json({ error: 'something went wrong' })
  }
})

app.post('/api/budgets', auth, async (req, res) => {
  const { name, total_amount, start_date, end_date } = req.body
  if (!name || !total_amount || !start_date || !end_date)
    return res.status(400).json({ error: 'missing required fields' })

  try {
    const result = await db.query(
      'INSERT INTO budgets (user_id, name, total_amount, start_date, end_date) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.user.user_id, name, total_amount, start_date, end_date]
    )
    res.status(201).json(result.rows[0])
  } catch {
    res.status(500).json({ error: 'failed to create budget' })
  }
})

app.put('/api/budgets/:id', auth, async (req, res) => {
  const { name, total_amount, start_date, end_date } = req.body
  try {
    const result = await db.query(
      `UPDATE budgets SET
        name = COALESCE($1, name),
        total_amount = COALESCE($2, total_amount),
        start_date = COALESCE($3, start_date),
        end_date = COALESCE($4, end_date)
       WHERE budget_id = $5 AND user_id = $6 RETURNING *`,
      [name, total_amount, start_date, end_date, req.params.id, req.user.user_id]
    )
    if (!result.rows.length) return res.status(404).json({ error: 'budget not found' })
    res.json(result.rows[0])
  } catch {
    res.status(500).json({ error: 'failed to update budget' })
  }
})

app.delete('/api/budgets/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM budgets WHERE budget_id = $1 AND user_id = $2',
      [req.params.id, req.user.user_id]
    )
    if (!result.rowCount) return res.status(404).json({ error: 'budget not found' })
    res.json({ message: 'deleted' })
  } catch {
    res.status(500).json({ error: 'failed to delete budget' })
  }
})


// ---- categories (belong to a budget) ----

app.get('/api/budgets/:budgetId/categories', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT bc.*, COALESCE(SUM(e.amount), 0) as spent,
        bc.allocated_amount - COALESCE(SUM(e.amount), 0) as remaining
       FROM budget_categories bc
       LEFT JOIN expenses e ON e.category_id = bc.category_id
       JOIN budgets b ON b.budget_id = bc.budget_id
       WHERE bc.budget_id = $1 AND b.user_id = $2
       GROUP BY bc.category_id`,
      [req.params.budgetId, req.user.user_id]
    )
    res.json(result.rows)
  } catch {
    res.status(500).json({ error: 'something went wrong' })
  }
})

app.post('/api/budgets/:budgetId/categories', auth, async (req, res) => {
  const { category_name, allocated_amount } = req.body
  if (!category_name || !allocated_amount)
    return res.status(400).json({ error: 'need category_name and allocated_amount' })

  try {
    // make sure this budget actually belongs to the user before adding to it
    const budgetCheck = await db.query(
      'SELECT budget_id FROM budgets WHERE budget_id = $1 AND user_id = $2',
      [req.params.budgetId, req.user.user_id]
    )
    if (!budgetCheck.rows.length) return res.status(404).json({ error: 'budget not found' })

    const result = await db.query(
      'INSERT INTO budget_categories (budget_id, category_name, allocated_amount) VALUES ($1,$2,$3) RETURNING *',
      [req.params.budgetId, category_name, allocated_amount]
    )
    res.status(201).json(result.rows[0])
  } catch {
    res.status(500).json({ error: 'failed to create category' })
  }
})

app.put('/api/budgets/:budgetId/categories/:id', auth, async (req, res) => {
  const { category_name, allocated_amount } = req.body
  try {
    const result = await db.query(
      `UPDATE budget_categories SET
        category_name = COALESCE($1, category_name),
        allocated_amount = COALESCE($2, allocated_amount)
       WHERE category_id = $3 AND budget_id = $4 RETURNING *`,
      [category_name, allocated_amount, req.params.id, req.params.budgetId]
    )
    if (!result.rows.length) return res.status(404).json({ error: 'category not found' })
    res.json(result.rows[0])
  } catch {
    res.status(500).json({ error: 'failed to update' })
  }
})

app.delete('/api/budgets/:budgetId/categories/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM budget_categories WHERE category_id = $1 AND budget_id = $2',
      [req.params.id, req.params.budgetId]
    )
    if (!result.rowCount) return res.status(404).json({ error: 'category not found' })
    res.json({ message: 'deleted' })
  } catch {
    res.status(500).json({ error: 'failed to delete' })
  }
})


// ---- expenses ----

app.get('/api/expenses', auth, async (req, res) => {
  const { category_id, budget_id, from, to, limit = 100 } = req.query

  let sql = `SELECT e.*, bc.category_name, b.budget_id, b.name as budget_name
             FROM expenses e
             JOIN budget_categories bc ON bc.category_id = e.category_id
             JOIN budgets b ON b.budget_id = bc.budget_id
             WHERE e.user_id = $1`
  const params = [req.user.user_id]
  let i = 2

  if (category_id) { sql += ` AND e.category_id = $${i++}`; params.push(category_id) }
  if (budget_id)   { sql += ` AND b.budget_id = $${i++}`;   params.push(budget_id) }
  if (from)        { sql += ` AND e.expense_date >= $${i++}`; params.push(from) }
  if (to)          { sql += ` AND e.expense_date <= $${i++}`; params.push(to) }

  sql += ` ORDER BY e.expense_date DESC LIMIT $${i}`
  params.push(parseInt(limit))

  try {
    const result = await db.query(sql, params)
    res.json(result.rows)
  } catch {
    res.status(500).json({ error: 'failed to get expenses' })
  }
})

//how much has been spent per category in a budget, used for the progress bars
app.get('/api/expenses/summary', auth, async (req, res) => {
  const { budget_id } = req.query
  if (!budget_id) return res.status(400).json({ error: 'budget_id is required' })

  try {
    const result = await db.query(
      `SELECT bc.category_id, bc.category_name, bc.allocated_amount,
        COALESCE(SUM(e.amount), 0) as spent,
        bc.allocated_amount - COALESCE(SUM(e.amount), 0) as remaining
       FROM budget_categories bc
       LEFT JOIN expenses e ON e.category_id = bc.category_id
       JOIN budgets b ON b.budget_id = bc.budget_id
       WHERE bc.budget_id = $1 AND b.user_id = $2
       GROUP BY bc.category_id`,
      [budget_id, req.user.user_id]
    )
    res.json(result.rows)
  } catch {
    res.status(500).json({ error: 'something went wrong' })
  }
})

app.post('/api/expenses', auth, async (req, res) => {
  const { category_id, amount, description, expense_date } = req.body
  if (!category_id || !amount || !description || !expense_date)
    return res.status(400).json({ error: 'missing required fields' })

  try {
    const result = await db.query(
      'INSERT INTO expenses (category_id, user_id, description, amount, expense_date) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [category_id, req.user.user_id, description, amount, expense_date]
    )
    res.status(201).json(result.rows[0])
  } catch {
    res.status(500).json({ error: 'failed to add expense' })
  }
})

app.put('/api/expenses/:id', auth, async (req, res) => {
  const { category_id, amount, description, expense_date } = req.body
  try {
    const result = await db.query(
      `UPDATE expenses SET
        category_id = COALESCE($1, category_id),
        amount = COALESCE($2, amount),
        description = COALESCE($3, description),
        expense_date = COALESCE($4, expense_date)
       WHERE expense_id = $5 AND user_id = $6 RETURNING *`,
      [category_id, amount, description, expense_date, req.params.id, req.user.user_id]
    )
    if (!result.rows.length) return res.status(404).json({ error: 'expense not found' })
    res.json(result.rows[0])
  } catch {
    res.status(500).json({ error: 'failed to update expense' })
  }
})

app.delete('/api/expenses/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM expenses WHERE expense_id = $1 AND user_id = $2',
      [req.params.id, req.user.user_id]
    )
    if (!result.rowCount) return res.status(404).json({ error: 'expense not found' })
    res.json({ message: 'deleted' })
  } catch {
    res.status(500).json({ error: 'failed to delete expense' })
  }
})


//assets

app.get('/api/assets', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM assets WHERE user_id = $1 ORDER BY value DESC',
      [req.user.user_id]
    )
    res.json(result.rows)
  } catch {
    res.status(500).json({ error: 'failed to get assets' })
  }
})

// Feature #13: live stock quotes for investment assets that have a ticker_symbol
app.get('/api/assets/quotes', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT asset_id, ticker_symbol FROM assets
       WHERE user_id = $1 AND ticker_symbol IS NOT NULL AND ticker_symbol <> ''`,
      [req.user.user_id]
    )
    if (!result.rows.length) return res.json([])

    const symbolToIds = {}
    for (const row of result.rows) {
      const sym = row.ticker_symbol.toUpperCase()
      if (!symbolToIds[sym]) symbolToIds[sym] = []
      symbolToIds[sym].push(row.asset_id)
    }

    const uniqueSymbols = Object.keys(symbolToIds)
    const quotes = await av.getBatchQuotes(uniqueSymbols)

    // Attach asset_ids so the frontend can match quotes back to assets
    const response = uniqueSymbols.map(sym => ({
      ...quotes[sym],
      asset_ids: symbolToIds[sym],
    }))

    res.json(response)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Feature #13: search for a ticker symbol (used by the add-asset form autocomplete)
app.get('/api/assets/search-ticker', auth, async (req, res) => {
  if (!req.query.q) return res.status(400).json({ error: 'q param required' })
  try {
    const results = await av.searchSymbol(req.query.q)
    res.json(results)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/assets', auth, async (req, res) => {
  const { asset_name, asset_type, value, ticker_symbol } = req.body
  if (!asset_name || !asset_type || value == null)
    return res.status(400).json({ error: 'missing required fields' })

  // Only Investment assets can have a ticker symbol
  const ticker = asset_type === 'Investment' && ticker_symbol
    ? ticker_symbol.toUpperCase().trim()
    : null

  try {
    const result = await db.query(
      `INSERT INTO assets (user_id, asset_name, asset_type, value, ticker_symbol)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.user_id, asset_name, asset_type, value, ticker]
    )
    res.status(201).json(result.rows[0])
  } catch {
    res.status(500).json({ error: 'failed to add asset' })
  }
})

app.put('/api/assets/:id', auth, async (req, res) => {
  const { asset_name, asset_type, value, ticker_symbol } = req.body
  try {
    const result = await db.query(
      `UPDATE assets SET
        asset_name = COALESCE($1, asset_name),
        asset_type = COALESCE($2, asset_type),
        value = COALESCE($3, value),
        ticker_symbol = COALESCE($4, ticker_symbol)
       WHERE asset_id = $5 AND user_id = $6 RETURNING *`,
      [asset_name, asset_type, value, ticker_symbol ?? null, req.params.id, req.user.user_id]
    )
    if (!result.rows.length) return res.status(404).json({ error: 'asset not found' })
    res.json(result.rows[0])
  } catch {
    res.status(500).json({ error: 'failed to update asset' })
  }
})

app.delete('/api/assets/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM assets WHERE asset_id = $1 AND user_id = $2',
      [req.params.id, req.user.user_id]
    )
    if (!result.rowCount) return res.status(404).json({ error: 'asset not found' })
    res.json({ message: 'deleted' })
  } catch {
    res.status(500).json({ error: 'failed to delete asset' })
  }
})


//watchlist

app.get('/api/watchlist', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM watchlist_items WHERE user_id = $1 ORDER BY added_at DESC',
      [req.user.user_id]
    )
    res.json(result.rows)
  } catch {
    res.status(500).json({ error: 'something went wrong' })
  }
})

//gets live prices for watchlist using alpha vantage
app.get('/api/watchlist/quotes', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT symbol FROM watchlist_items WHERE user_id = $1',
      [req.user.user_id]
    )
    if (!result.rows.length) return res.json([])

    const symbols = result.rows.map(r => r.symbol)
    const quotes = await av.getBatchQuotes(symbols)
    res.json(Object.values(quotes))
  } catch(err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/watchlist/search', auth, async (req, res) => {
  if (!req.query.q) return res.status(400).json({ error: 'q param required' })
  try {
    const results = await av.searchSymbol(req.query.q)
    res.json(results)
  } catch(err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/watchlist', auth, async (req, res) => {
  const symbol = req.body.symbol?.toUpperCase().trim()
  if (!symbol) return res.status(400).json({ error: 'symbol required' })

  try {
    const result = await db.query(
      'INSERT INTO watchlist_items (user_id, symbol) VALUES ($1,$2) ON CONFLICT (user_id, symbol) DO NOTHING RETURNING *',
      [req.user.user_id, symbol]
    )
    if (!result.rows.length) return res.status(409).json({ error: `${symbol} is already in your watchlist` })
    res.status(201).json(result.rows[0])
  } catch {
    res.status(500).json({ error: 'failed to add to watchlist' })
  }
})

app.delete('/api/watchlist/:symbol', auth, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM watchlist_items WHERE user_id = $1 AND symbol = $2',
      [req.user.user_id, req.params.symbol.toUpperCase()]
    )
    if (!result.rowCount) return res.status(404).json({ error: 'symbol not in watchlist' })
    res.json({ message: 'removed' })
  } catch {
    res.status(500).json({ error: 'failed to remove from watchlist' })
  }
})


//dashboard and net worth stuff

app.get('/api/networth', auth, async (req, res) => {
  const uid = req.user.user_id
  try {
    const [assets, budgets, thisMonth, thisYear] = await Promise.all([
      db.query(
        'SELECT asset_type, COUNT(*) as count, SUM(value) as total_value FROM assets WHERE user_id = $1 GROUP BY asset_type',
        [uid]
      ),
      db.query(
        `SELECT b.budget_id, b.name, b.total_amount, b.start_date, b.end_date,
          COALESCE(SUM(e.amount), 0) as total_spent,
          b.total_amount - COALESCE(SUM(e.amount), 0) as remaining
         FROM budgets b
         LEFT JOIN budget_categories bc ON bc.budget_id = b.budget_id
         LEFT JOIN expenses e ON e.category_id = bc.category_id
         WHERE b.user_id = $1 GROUP BY b.budget_id ORDER BY b.end_date DESC`,
        [uid]
      ),
      db.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
         WHERE user_id = $1 AND DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)`,
        [uid]
      ),
      db.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
         WHERE user_id = $1 AND DATE_PART('year', expense_date) = DATE_PART('year', CURRENT_DATE)`,
        [uid]
      )
    ])

    const netWorth = assets.rows.reduce((sum, r) => sum + parseFloat(r.total_value || 0), 0)

    res.json({
      net_worth: netWorth,
      assets_by_type: assets.rows,
      budgets: budgets.rows,
      expenses: {
        this_month: parseFloat(thisMonth.rows[0].total),
        this_year: parseFloat(thisYear.rows[0].total)
      }
    })
  } catch(err) {
    console.log(err)
    res.status(500).json({ error: 'something went wrong' })
  }
})


const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`server running on ${PORT}`))
