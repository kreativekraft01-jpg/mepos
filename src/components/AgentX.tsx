import { useId } from 'react'
import './NeuralKnot.css'

export type AgentState = 'idle' | 'thinking' | 'answering' | 'error'

export default function AgentX({ size = 40, state = 'idle' }: { size?: number; state?: AgentState }) {
  const id = useId()
  return (
    <svg className="neural-knot" width={size} height={size} data-state={state}
      data-size={size <= 22 && state === 'idle' ? 'small' : undefined} aria-hidden="true" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id={`${id}-rim1`} x1="20" y1="20" x2="220" y2="220" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#00F5D4"/><stop offset="100%" stopColor="#A855F7"/>
      </linearGradient>
      <linearGradient id={`${id}-rim2`} x1="220" y1="20" x2="20" y2="220" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#A855F7"/><stop offset="100%" stopColor="#00F5D4"/>
      </linearGradient>
      <linearGradient id={`${id}-pa`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#A855F7" stopOpacity="0"/>
        <stop offset="50%" stopColor="#00F5D4" stopOpacity="0.95"/>
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1"/>
      </linearGradient>
      <linearGradient id={`${id}-pb`} x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#38BDF8" stopOpacity="0"/>
        <stop offset="50%" stopColor="#A855F7" stopOpacity="0.95"/>
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1"/>
      </linearGradient>
      <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <path id={`${id}-a1`} d="M 103 45 L 95 37 A 38 38 0 0 0 41 91 L 106 156" />
      <path id={`${id}-a2`} d="M 84 106 L 149 41 A 38 38 0 0 1 203 95 L 195 103" />
      <path id={`${id}-a3`} d="M 134 84 L 199 149 A 38 38 0 0 1 145 203 L 137 195" />
      <path id={`${id}-a4`} d="M 156 134 L 91 199 A 38 38 0 0 1 37 145 L 45 137" />
    </defs>
    <g strokeWidth="27.5" strokeLinecap="butt">
      <use href={`#${id}-a1`} stroke={`url(#${id}-rim1)`}/><use href={`#${id}-a2`} stroke={`url(#${id}-rim2)`}/>
      <use href={`#${id}-a3`} stroke={`url(#${id}-rim1)`}/><use href={`#${id}-a4`} stroke={`url(#${id}-rim2)`}/>
    </g>
    <g strokeWidth="25" strokeLinecap="butt" stroke="#080D18">
      <use href={`#${id}-a1`}/><use href={`#${id}-a2`}/><use href={`#${id}-a3`}/><use href={`#${id}-a4`}/>
    </g>
    <g stroke="#020409" strokeWidth="11" strokeLinecap="butt">
      <use href={`#${id}-a1`}/><use href={`#${id}-a2`}/><use href={`#${id}-a3`}/><use href={`#${id}-a4`}/>
    </g>
    <g filter={`url(#${id}-glow)`}>
      <use href={`#${id}-a1`} className="nk-packet" stroke={`url(#${id}-pa)`}/>
      <use href={`#${id}-a2`} className="nk-packet nk-p2" stroke={`url(#${id}-pb)`}/>
      <use href={`#${id}-a3`} className="nk-packet nk-p3" stroke={`url(#${id}-pa)`}/>
      <use href={`#${id}-a4`} className="nk-packet nk-p4" stroke={`url(#${id}-pb)`}/>
      <use href={`#${id}-a1`} className="nk-hot"/><use href={`#${id}-a2`} className="nk-hot nk-p2"/>
      <use href={`#${id}-a3`} className="nk-hot nk-p3"/><use href={`#${id}-a4`} className="nk-hot nk-p4"/>
    </g>
    <path className="nk-core" d="M 120 106 Q 120 120 134 120 Q 120 120 120 134 Q 120 120 106 120 Q 120 120 120 106 Z" fill="#00F5D4"/>
    <circle cx="120" cy="120" r="2.2" fill="#FFFFFF"/>
  </svg>
  )
}
