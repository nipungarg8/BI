import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-title">BI Tool</span>
        <nav>
          <NavLink to="/connections">Connections</NavLink>
          <NavLink to="/queries">Queries</NavLink>
          <NavLink to="/dashboards">Dashboards</NavLink>
          <NavLink to="/ai-search">AI Search</NavLink>
        </nav>
        <div className="app-user">
          {user && <span>{user.email}</span>}
          <button onClick={() => signOut()}>Log out</button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
