import { createContext, useState } from 'react'

// =============================================================================
// AuthContext.jsx
// Stores the currently logged-in user in sessionStorage (for the current tab)
// so opening a new tab via Ctrl+Click always starts fresh at the Login page.
// =============================================================================
export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      // If redirected to HTTPS port 5174 for mobile Live In-App Camera, restore session automatically
      const params = new URLSearchParams(window.location.search)
      const authParam = params.get('auth')
      if (authParam) {
        const parsed = JSON.parse(atob(decodeURIComponent(authParam)))
        if (parsed?.user) {
          sessionStorage.setItem('user', JSON.stringify(parsed.user))
          if (parsed.token) sessionStorage.setItem('token', parsed.token)
          return parsed.user
        }
      }
      // Clear any leftover permanent localStorage session from older builds
      localStorage.removeItem('user')
      return JSON.parse(sessionStorage.getItem('user'))
    } catch {
      return null
    }
  })

  const login = (userData) => {
    sessionStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    sessionStorage.removeItem('user')
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
