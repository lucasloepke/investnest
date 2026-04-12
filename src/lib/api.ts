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

interface AuthResponse {
  token: string
  user: {
    userId: number
    firstName: string
    lastName: string
    email: string
  }
}

export function login(payload: LoginPayload): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function register(payload: RegisterPayload): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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

export interface NetWorthResponse {
  net_worth: number
  assets_by_type: Array<{ asset_type: string; count: number; total_value: number }>
}

export function getAssets(): Promise<Asset[]> {
  return request<Asset[]>('/assets')
}

export function addAsset(payload: AssetPayload): Promise<Asset> {
  return request<Asset>('/assets', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteAsset(assetId: number): Promise<void> {
  return request<void>(`/assets/${assetId}`, {
    method: 'DELETE',
  })
}

export function getNetWorth(): Promise<NetWorthResponse> {
  return request<NetWorthResponse>('/networth')
}
