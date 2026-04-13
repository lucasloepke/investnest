const BASE_URL = import.meta.env.VITE_API_URL as string
const TOKEN_KEY = 'investnest_token'

if (!BASE_URL) {
  console.warn('[api] VITE_API_URL is not set — API calls will fail.')
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...init?.headers,
      },
      ...init,
    })
  } catch {
    throw new Error('Unable to reach the server. Please try again later.')
  }

  if (!res.ok) {
    let message = `Request failed: ${res.status}`
    try {
      const body = (await res.json()) as { message?: string }
      if (body.message) message = body.message
    } catch {
      // ignore parse errors
    }
    throw new Error(message)
  }

  return res.json() as Promise<T>
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  firstName: string
  lastName: string
  email: string
  password: string
}

// Shape the server actually returns
interface ServerAuthResponse {
  token: string
  user: {
    user_id: number
    email: string
    name: string
  }
}

// Normalised shape the rest of the app uses
export interface AuthResponse {
  token: string
  user: {
    userId: number
    name: string
    email: string
  }
}

function normaliseAuth(raw: ServerAuthResponse): AuthResponse {
  return {
    token: raw.token,
    user: {
      userId: raw.user.user_id,
      name: raw.user.name,
      email: raw.user.email,
    },
  }
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const raw = await request<ServerAuthResponse>('/api/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return normaliseAuth(raw)
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const raw = await request<ServerAuthResponse>('/api/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `${payload.firstName} ${payload.lastName}`,
      email: payload.email,
      password: payload.password,
    }),
  })
  return normaliseAuth(raw)
}

// ── Budgets ───────────────────────────────────────────────────────────────────

export interface Budget {
  budget_id: number
  user_id: number
  name: string
  total_amount: number
  start_date: string
  end_date: string
  total_spent: number
  remaining: number
}

export interface Category {
  category_id: number
  budget_id: number
  category_name: string
  allocated_amount: number
  spent: number
  remaining: number
}

export interface Expense {
  expense_id: number
  category_id: number
  user_id: number
  description: string
  amount: number
  expense_date: string
  category_name: string
}

export function getBudgets(): Promise<Budget[]> {
  return request<Budget[]>('/api/budgets')
}

export function createBudget(payload: {
  name: string
  total_amount: number
  start_date: string
  end_date: string
}): Promise<Budget> {
  return request<Budget>('/api/budgets', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteBudget(budgetId: number): Promise<void> {
  return request<void>(`/api/budgets/${budgetId}`, { method: 'DELETE' })
}

export function getCategories(budgetId: number): Promise<Category[]> {
  return request<Category[]>(`/api/budgets/${budgetId}/categories`)
}

export function createCategory(
  budgetId: number,
  payload: { category_name: string; allocated_amount: number },
): Promise<Category> {
  return request<Category>(`/api/budgets/${budgetId}/categories`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getExpenses(budgetId?: number): Promise<Expense[]> {
  const qs = budgetId != null ? `?budget_id=${budgetId}` : ''
  return request<Expense[]>(`/api/expenses${qs}`)
}

export function createExpense(payload: {
  category_id: number
  description: string
  amount: number
  expense_date: string
}): Promise<Expense> {
  return request<Expense>('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteExpense(expenseId: number): Promise<void> {
  return request<void>(`/api/expenses/${expenseId}`, { method: 'DELETE' })
}

// ── Assets ───────────────────────────────────────────────────────────────────

export interface Asset {
  asset_id: number
  asset_name: string
  asset_type: string
  value: number
}

export interface AssetPayload {
  asset_name: string
  asset_type: string
  value: number
}

export interface NetWorthData {
  net_worth: number
  assets_by_type: Array<{ asset_type: string; count: number; total_value: number }>
  expenses: { this_month: number; this_year: number }
  budgets: Array<{ budget_id: number; name: string; total_spent: number; total_amount: number }>
}

export function getAssets(): Promise<Asset[]> {
  return request<Asset[]>('/api/assets')
}

export function addAsset(payload: AssetPayload): Promise<Asset> {
  return request<Asset>('/api/assets', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteAsset(assetId: number): Promise<void> {
  return request<void>(`/api/assets/${assetId}`, { method: 'DELETE' })
}

export function getNetWorth(): Promise<NetWorthData> {
  return request<NetWorthData>('/api/networth')
}
