"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

type User = {
  id: string
  first_name: string
  last_name: string
  email: string
}

type AuthContextType = {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<boolean>
  signup: (firstName: string, lastName: string, email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if user is logged in on mount
    try {
      const storedToken = localStorage.getItem("token")
      const storedUser = localStorage.getItem("user")

      if (storedToken && storedUser) {
        setToken(storedToken)
        // Make sure storedUser is valid JSON before parsing
        try {
          setUser(JSON.parse(storedUser))
        } catch (e) {
          console.error("Failed to parse stored user:", e)
          localStorage.removeItem("user") // Remove invalid data
        }
      }
    } catch (e) {
      console.error("Error accessing localStorage:", e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Refresh token periodically
  useEffect(() => {
    if (!token) return

    const refreshToken = async () => {
      try {
        const response = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        })

        if (response.ok) {
          const data = await response.json()
          setToken(data.token)
          localStorage.setItem("token", data.token)
        } else {
          // If refresh fails, log out
          logout()
        }
      } catch (error) {
        console.error("Failed to refresh token:", error)
        logout()
      }
    }

    // Refresh token every 25 minutes
    const intervalId = setInterval(refreshToken, 25 * 60 * 1000)

    return () => clearInterval(intervalId)
  }, [token])

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json()
      setToken(data.token)
      setUser(data.user)

      try {
        localStorage.setItem("token", data.token)
        localStorage.setItem("user", JSON.stringify(data.user))
      } catch (e) {
        console.error("Error saving to localStorage:", e)
      }

      return true
    } catch (error) {
      console.error("Login error:", error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (firstName: string, lastName: string, email: string, password: string) => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          first_name: firstName,
          last_name: lastName,
          password,
        }),
      })

      if (!response.ok) {
        return false
      }

      // Just return true on successful signup, don't auto-login
      return true
    } catch (error) {
      console.error("Signup error:", error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    try {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
    } catch (e) {
      console.error("Error removing from localStorage:", e)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}