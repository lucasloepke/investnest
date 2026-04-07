import { Outlet } from 'react-router-dom'
import { AppNav } from '@/components/layout/AppNav'

export function MainLayout() {
  return (
    <div className="app-shell">
      <AppNav />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
