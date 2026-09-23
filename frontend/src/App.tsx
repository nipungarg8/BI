import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { Connections } from './pages/Connections'
import { ConnectionNew } from './pages/ConnectionNew'
import { Queries } from './pages/Queries'
import { QueryBuilderPage } from './pages/QueryBuilderPage'
import { QueryDetail } from './pages/QueryDetail'
import { Dashboards } from './pages/Dashboards'
import { DashboardDetail } from './pages/DashboardDetail'
import { AiSearch } from './pages/AiSearch'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/connections" element={<Connections />} />
          <Route path="/connections/new" element={<ConnectionNew />} />
          <Route path="/queries" element={<Queries />} />
          <Route path="/queries/new" element={<QueryBuilderPage />} />
          <Route path="/queries/:id" element={<QueryDetail />} />
          <Route path="/dashboards" element={<Dashboards />} />
          <Route path="/dashboards/:id" element={<DashboardDetail />} />
          <Route path="/ai-search" element={<AiSearch />} />
        </Route>
        <Route path="/" element={<Navigate to="/connections" replace />} />
        <Route path="*" element={<Navigate to="/connections" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
