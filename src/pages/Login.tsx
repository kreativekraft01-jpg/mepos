import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, User, Eye, EyeOff, LogIn } from 'lucide-react'
import { loginRequest } from '../store/authStore'
import { useStore } from '../store/useStore'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const settings = useStore((s) => s.settings)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) return setError('Enter username and password')
    setLoading(true)
    const res = await loginRequest(username.trim(), password)
    setLoading(false)
    if (!res.ok) return setError(res.error || 'Invalid credentials')
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl font-black italic tracking-tighter mb-2">ME<span className="text-primary">PoS</span></div>
          <div className="text-sm text-muted-foreground">{settings.storeName} — {settings.tagline}</div>
        </div>
        <form onSubmit={onSubmit} className="bg-card border border-border p-8 rounded-sm shadow-2xl space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold uppercase tracking-wider">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-1">Protected — enter your username and password</p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-sm text-sm">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                className="w-full h-11 pl-10 pr-4 bg-input border border-border rounded-sm focus:outline-none focus:border-primary text-foreground"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={show ? 'text' : 'password'}
                className="w-full h-11 pl-10 pr-10 bg-input border border-border rounded-sm focus:outline-none focus:border-primary text-foreground"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary hover:brightness-110 disabled:opacity-50 text-primary-foreground font-bold uppercase tracking-wider rounded-sm flex items-center justify-center gap-2"
          >
            {loading ? 'Signing in…' : <><LogIn className="w-5 h-5" /> Sign in</>}
          </button>
        </form>
        <div className="text-center text-xs text-muted-foreground mt-4">All data is stored on the server (Neon Postgres). Offline fallback uses this browser only.</div>
      </div>
    </div>
  )
}
