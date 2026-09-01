import { useEffect } from 'react'
import { useStore } from '../store/useStore'

const ICONS: Record<string, string> = {
  success: '✓',
  error: '✕',
  info: 'i'
}

export default function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <Toast key={t.id} id={t.id} type={t.type} message={t.message} onDone={dismiss} />
      ))}
    </div>
  )
}

function Toast({
  id,
  type,
  message,
  onDone
}: {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
  onDone: (id: string) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDone(id), 3200)
    return () => clearTimeout(timer)
  }, [id, onDone])

  return (
    <div className={`toast ${type}`} onClick={() => onDone(id)}>
      <span className="toast-icon">{ICONS[type]}</span>
      <span>{message}</span>
    </div>
  )
}
