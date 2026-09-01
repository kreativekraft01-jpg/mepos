import type { ReactNode } from 'react'

const COLORS: Record<string, string> = {
  indigo: 'indigo',
  green: 'green',
  amber: 'amber',
  red: 'red',
  cyan: 'cyan'
}

export default function StatCard({
  icon,
  color = 'indigo',
  label,
  value,
  hint
}: {
  icon: ReactNode
  color?: string
  label: string
  value: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${COLORS[color] ?? 'indigo'}`}>{icon}</div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  )
}
