import { useState } from 'react'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import Login from './features/auth/Login'
import Dashboard from './features/dashboard/Dashboard'
import UserSelection from './features/users/UserSelection'
import './App.css'

const ADMIN_EMAILS = ['ncip.wfh@dtr.admin']

const isAdminUser = (user, userData) => {
  const normalizedRole = String(userData?.role || '').trim().toLowerCase()
  const normalizedUserEmail = String(user?.email || '').trim().toLowerCase()
  const normalizedProfileEmail = String(userData?.email || '').trim().toLowerCase()

  return (
    normalizedRole === 'admin' ||
    userData?.isAdmin === true ||
    ADMIN_EMAILS.includes(normalizedUserEmail) ||
    ADMIN_EMAILS.includes(normalizedProfileEmail)
  )
}

function AppContent() {
  const { user, userData, loading, logout } = useAuth()
  const [selectedUser, setSelectedUser] = useState(null)

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  const handleLogout = async () => {
    setSelectedUser(null)
    await logout()
  }

  // Always show login first
  if (!user) {
    return <Login onLoginSuccess={() => {}} />
  }

  const isAdmin = isAdminUser(user, userData)

  // Admin login shows all users' DTR immediately
  if (isAdmin) {
    return (
      <Dashboard
        initialSelectedUser={{
          id: 'admin',
          name: userData?.name || user?.email || 'Admin',
          isAdmin: true
        }}
        onLogout={handleLogout}
      />
    )
  }

  // Regular user must select their name
  if (selectedUser) {
    return <Dashboard initialSelectedUser={selectedUser} onLogout={handleLogout} />
  }

  return <UserSelection onSelectUser={setSelectedUser} />
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
