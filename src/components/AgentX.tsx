import { useEffect, useMemo } from 'react'
import { motion, useAnimation } from 'motion/react'

export type AgentState = 'idle' | 'thinking' | 'answering' | 'error'

interface AgentXProps {
  size?: number
  state?: AgentState
}

/**
 * Agent X — cyberpunk anime AI avatar with state-driven animations.
 * Based on the reference SVG: armored agent with one cybernetic eye,
 * flowing white hair with cyan streaks, glowing X emblem, and neon accents.
 */
export default function AgentX({ size = 40, state = 'idle' }: AgentXProps) {
  const controls = useAnimation()

  useEffect(() => {
    if (state === 'thinking') {
      controls.start('thinking')
    } else if (state === 'answering') {
      controls.start('answering').then(() => controls.start('idle'))
    } else if (state === 'error') {
      controls.start('error').then(() => controls.start('idle'))
    } else {
      controls.start('idle')
    }
  }, [state, controls])

  const bodyVariants = useMemo(
    () => ({
      idle: {
        y: [0, -2, 0],
        transition: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' as const },
      },
      thinking: {
        y: [0, -5, 0],
        scale: [1, 1.01, 1],
        transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' as const },
      },
      answering: {
        scale: [1, 1.06, 1],
        transition: { duration: 0.5, ease: 'easeOut' as const },
      },
      error: {
        x: [0, -4, 4, -4, 4, 0],
        transition: { duration: 0.5 },
      },
    }),
    []
  )

  const headVariants = useMemo(
    () => ({
      idle: {
        rotate: [0, 0.8, 0],
        x: [0, 1, 0],
        transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' as const },
      },
      thinking: {
        rotate: [0, -2, 2, 0],
        x: [0, -2, 2, 0],
        transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' as const },
      },
      answering: {
        rotate: [0, -3, 0],
        transition: { duration: 0.4, ease: 'easeOut' as const },
      },
      error: {
        rotate: [0, -5, 5, -5, 0],
        transition: { duration: 0.4 },
      },
    }),
    []
  )

  const isThinking = state === 'thinking'
  const isAnswering = state === 'answering'
  const isError = state === 'error'
  const isActive = isThinking || isAnswering

  return (
    <svg
      viewBox="0 0 600 600"
      width={size}
      height={size}
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Material Gradients */}
        <linearGradient id="ax-armor-base" x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#2c3345" />
          <stop offset="60%" stopColor="#1e2436" />
          <stop offset="100%" stopColor="#12151e" />
        </linearGradient>
        <linearGradient id="ax-armor-dark" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0a0d14" />
          <stop offset="100%" stopColor="#1c2130" />
        </linearGradient>
        <linearGradient id="ax-skin" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#8a6458" />
          <stop offset="40%" stopColor="#6d4c41" />
          <stop offset="100%" stopColor="#3e2723" />
        </linearGradient>
        <radialGradient id="ax-iris" cx="50%" cy="50%" r="50%">
          <stop offset="40%" stopColor="#37474f" />
          <stop offset="90%" stopColor="#78909c" />
          <stop offset="100%" stopColor="#1c2327" />
        </radialGradient>

        {/* Glow Filters */}
        <filter id="ax-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="ax-shadow" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="2" dy="5" stdDeviation="4" floodColor="#000000" floodOpacity="0.5" />
        </filter>
        <filter id="ax-x-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={isThinking ? 8 : 4} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="ax-cyber-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={isThinking ? 6 : 3} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="ax-particle-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* === AMBIENT PARTICLES === */}
      <g>
        {[
          { cx: 150, cy: 500, r: 3, color: '#00e5ff', delay: 0, dur: 6 },
          { cx: 450, cy: 450, r: 2, color: '#b900ff', delay: 1.2, dur: 5.5 },
          { cx: 100, cy: 300, r: 4, color: '#00e5ff', delay: 2.8, dur: 7 },
          { cx: 500, cy: 350, r: 2.5, color: '#b900ff', delay: 4.5, dur: 4.8 },
          { cx: 220, cy: 550, r: 1.5, color: '#00e5ff', delay: 1.2, dur: 5.5 },
        ].map((p, i) => (
          <motion.circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            fill={p.color}
            filter="url(#ax-particle-glow)"
            initial={{ opacity: 0, y: 0, x: 0 }}
            animate={
              isActive
                ? {
                    opacity: [0, 0.9, 0.9, 0],
                    y: [0, -40, -80, -140],
                    x: [0, 10, 20, 35],
                  }
                : {
                    opacity: [0, 0.6, 0.6, 0],
                    y: [0, -30, -70, -120],
                    x: [0, 5, 15, 30],
                  }
            }
            transition={{
              duration: isActive ? p.dur * 0.6 : p.dur,
              repeat: Infinity,
              delay: p.delay,
              ease: 'easeOut',
            }}
          />
        ))}
      </g>

      {/* === CHEST RIG (Body + Breathing) === */}
      <motion.g animate={bodyVariants} variants={bodyVariants} style={{ transformOrigin: '300px 600px' }}>
        {/* Deep back armor */}
        <path d="M 100 600 C 100 480, 200 420, 300 420 C 400 420, 500 480, 500 600 Z" fill="#000" />
        {/* Armor base with gradient */}
        <path d="M 102 600 C 102 482, 202 422, 300 422 C 398 422, 498 482, 498 600 Z" fill="url(#ax-armor-base)" stroke="#475569" strokeWidth="1" />

        {/* Inset panels */}
        <path d="M 230 450 L 370 450 L 400 520 L 300 580 L 200 520 Z" fill="#000" opacity="0.6" filter="url(#ax-glow)" />
        <path d="M 230 450 L 370 450 L 400 520 L 300 580 L 200 520 Z" fill="url(#ax-armor-dark)" stroke="#1e293b" strokeWidth="1" />

        {/* Side chest panels */}
        <path d="M 120 540 C 180 520, 200 520, 220 500 L 180 600 Z" fill="url(#ax-armor-dark)" />
        <path d="M 120 540 C 180 520, 200 520, 220 500" fill="none" stroke="#64748b" strokeWidth="2" opacity="0.7" />
        <path d="M 480 540 C 420 520, 400 520, 380 500 L 420 600 Z" fill="url(#ax-armor-dark)" />
        <path d="M 480 540 C 420 520, 400 520, 380 500" fill="none" stroke="#64748b" strokeWidth="2" opacity="0.7" />

        {/* Panel bolts */}
        <g fill="#94a3b8">
          <circle cx="238" cy="460" r="2" /><circle cx="237" cy="459" r="1" fill="#fff" opacity="0.5" />
          <circle cx="362" cy="460" r="2" /><circle cx="361" cy="459" r="1" fill="#fff" opacity="0.5" />
          <circle cx="215" cy="515" r="2" /><circle cx="214" cy="514" r="1" fill="#fff" opacity="0.5" />
          <circle cx="385" cy="515" r="2" /><circle cx="384" cy="514" r="1" fill="#fff" opacity="0.5" />
        </g>

        {/* Neon lines — glow + core */}
        <g>
          <path d="M 230 450 L 250 500" stroke="#ff00ea" strokeWidth="6" opacity="0.6" filter="url(#ax-glow)" />
          <path d="M 370 450 L 350 500" stroke="#ff00ea" strokeWidth="6" opacity="0.6" filter="url(#ax-glow)" />
          <path d="M 180 550 L 220 580" stroke="#00e5ff" strokeWidth="6" opacity="0.6" filter="url(#ax-glow)" />
          <path d="M 420 550 L 380 580" stroke="#00e5ff" strokeWidth="6" opacity="0.6" filter="url(#ax-glow)" />
          <path d="M 230 450 L 250 500 M 370 450 L 350 500 M 180 550 L 220 580 M 420 550 L 380 580" stroke="#fff" strokeWidth="1.5" />
        </g>

        {/* Animated neon pulse on lines */}
        <motion.g
          animate={
            isActive
              ? { opacity: [0.4, 1, 0.4] }
              : { opacity: [0.3, 0.6, 0.3] }
          }
          transition={{ duration: isActive ? 1 : 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path d="M 230 450 L 250 500" stroke="#ff00ea" strokeWidth="2" filter="url(#ax-glow)" />
          <path d="M 370 450 L 350 500" stroke="#ff00ea" strokeWidth="2" filter="url(#ax-glow)" />
          <path d="M 180 550 L 220 580" stroke="#00e5ff" strokeWidth="2" filter="url(#ax-glow)" />
          <path d="M 420 550 L 380 580" stroke="#00e5ff" strokeWidth="2" filter="url(#ax-glow)" />
        </motion.g>

        {/* X Emblem on chest */}
        <motion.g
          filter="url(#ax-x-glow)"
          animate={
            isThinking
              ? { opacity: [0.6, 1, 0.6], scale: [1, 1.08, 1] }
              : { opacity: [0.4, 0.7, 0.4], scale: [1, 1.02, 1] }
          }
          transition={{
            duration: isThinking ? 0.8 : 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ transformOrigin: '300px 525px' }}
        >
          <polygon points="260,500 340,500 320,550 280,550" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <path d="M 260 500 L 340 500" stroke="#94a3b8" strokeWidth="2" opacity="0.6" />
          <path d="M 285 510 L 315 540 M 315 510 L 285 540" stroke="#00e5ff" strokeWidth="8" opacity="0.5" filter="url(#ax-x-glow)" />
          <path d="M 285 510 L 315 540 M 315 510 L 285 540" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </motion.g>

        {/* Cyber neck/collar */}
        <g>
          <path d="M 250 380 L 350 380 L 340 440 L 260 440 Z" fill="#090d14" />
          <path d="M 250 380 L 350 380" stroke="#1e293b" strokeWidth="4" />
          <path d="M 270 385 C 270 410, 265 425, 260 435" fill="none" stroke="#334155" strokeWidth="2" />
          <path d="M 280 385 C 280 410, 275 425, 270 435" fill="none" stroke="#1e293b" strokeWidth="2" />
          <path d="M 330 385 C 330 410, 335 425, 340 435" fill="none" stroke="#334155" strokeWidth="2" />
          <motion.line
            x1="290" y1="410" x2="310" y2="410"
            stroke="#ff00ea" strokeWidth="1.5"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.line
            x1="285" y1="420" x2="315" y2="420"
            stroke="#00e5ff" strokeWidth="1.5"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.3 }}
          />
        </g>
      </motion.g>

      {/* === HEAD RIG (Face + Hair) === */}
      <motion.g animate={headVariants} variants={headVariants} style={{ transformOrigin: '300px 350px' }}>
        {/* Back hair & braids */}
        <path d="M 220 150 C 350 120, 420 200, 420 350 C 400 380, 380 380, 350 350 C 380 250, 350 180, 300 150 Z" fill="#94a3b8" />

        {/* Right braid */}
        <path d="M 372 182 C 402 202, 412 252, 402 302" fill="none" stroke="#000" strokeWidth="15" strokeLinecap="round" strokeDasharray="10 15" opacity="0.3" />
        <path d="M 370 180 C 400 200, 410 250, 400 300" fill="none" stroke="#e2e8f0" strokeWidth="15" strokeLinecap="round" strokeDasharray="10 15" />
        <path d="M 385 190 C 415 210, 425 260, 415 310" fill="none" stroke="#94a3b8" strokeWidth="10" strokeLinecap="round" strokeDasharray="10 15" />

        {/* Face */}
        <g filter="url(#ax-shadow)">
          <path d="M 230 250 C 230 350, 250 400, 300 410 C 350 400, 370 350, 370 250 C 370 180, 230 180, 230 250 Z" fill="url(#ax-skin)" />
        </g>
        <path d="M 240 250 C 240 330, 255 380, 290 395 C 290 395, 275 350, 275 250 Z" fill="#fff" opacity="0.08" />

        {/* Cyber fracture lines on face */}
        <motion.g
          animate={
            isActive
              ? { opacity: [0.5, 1, 0.5] }
              : { opacity: [0.3, 0.6, 0.3] }
          }
          transition={{ duration: isActive ? 0.8 : 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path d="M 345 270 L 355 280 L 350 295 L 365 310" stroke="#b900ff" strokeWidth="3" fill="none" filter="url(#ax-cyber-glow)" />
          <path d="M 345 270 L 355 280 L 350 295 L 365 310" stroke="#e0b3ff" strokeWidth="1" fill="none" />
          <path d="M 355 280 L 370 275" stroke="#b900ff" strokeWidth="3" fill="none" filter="url(#ax-cyber-glow)" />
          <path d="M 355 280 L 370 275" stroke="#e0b3ff" strokeWidth="1" fill="none" />
        </motion.g>

        {/* Lips */}
        <path d="M 285 365 Q 300 358, 315 365 Q 300 370, 285 365 Z" fill="#522a27" />
        <path d="M 285 365 Q 300 373, 315 365 Q 300 378, 285 365 Z" fill="#8c4740" />
        <path d="M 295 370 Q 300 374, 305 370" fill="none" stroke="#ffbca3" strokeWidth="1" opacity="0.5" />

        {/* Nose */}
        <path d="M 300 290 L 306 342 L 294 342 Z" fill="#3e2723" opacity="0.4" />
        <path d="M 300 290 L 296 340 L 300 342 Z" fill="#fff" opacity="0.15" />

        {/* === EYES with blink === */}
        <motion.g
          animate={
            isError
              ? { scaleY: [1, 0.3, 1, 0.3, 1] }
              : isThinking
                ? { scaleY: [1, 0.6, 1] }
                : { scaleY: [1, 1, 1, 0.05, 1] }
          }
          transition={{
            duration: isError ? 0.5 : isThinking ? 1.5 : 5.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ transformOrigin: '300px 270px' }}
        >
          {/* Left eye — organic */}
          <path d="M 245 275 Q 260 263, 275 275 Q 260 282, 245 275 Z" fill="#f8fafc" />
          <path d="M 245 275 Q 260 263, 275 275 Q 260 270, 245 275 Z" fill="#94a3b8" opacity="0.5" />
          <circle cx="260" cy="273" r="5.5" fill="url(#ax-iris)" />
          <circle cx="260" cy="273" r="2.5" fill="#000" />
          <path d="M 257 270 A 3 3 0 0 1 262 270" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="263" cy="275" r="0.8" fill="#fff" opacity="0.7" />
          <path d="M 238 275 Q 260 258, 282 275" fill="none" stroke="#0f172a" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M 240 276 Q 260 283, 280 276" fill="none" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

          {/* Right eye — cybernetic */}
          <path d="M 325 275 Q 340 263, 355 275 Q 340 282, 325 275 Z" fill="#150d1e" />
          <path d="M 325 275 Q 340 263, 355 275 Q 340 270, 325 275 Z" fill="#000" opacity="0.8" />
          {/* Cyber iris — animated glow */}
          <motion.circle
            cx="340" cy="273" r="6.5"
            fill="#b900ff"
            animate={
              isActive
                ? { opacity: [0.3, 0.9, 0.3], r: [6.5, 8, 6.5] }
                : { opacity: [0.2, 0.5, 0.2], r: [6.5, 7, 6.5] }
            }
            transition={{ duration: isActive ? 0.8 : 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          <circle cx="340" cy="273" r="4.5" fill="none" stroke="#00e5ff" strokeWidth="1" opacity="0.8" />
          <circle cx="340" cy="273" r="2" fill="#fff" filter="url(#ax-cyber-glow)" />
          <circle cx="340" cy="273" r="1" fill="#fff" />
          <path d="M 323 275 Q 340 258, 357 275" fill="none" stroke="#0f172a" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M 325 276 Q 340 283, 355 276" fill="none" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        </motion.g>

        {/* Eyebrows */}
        <motion.path
          d="M 238 255 Q 255 242, 282 255 Q 265 248, 238 255 Z"
          fill="#1e293b"
          animate={isThinking ? { d: 'M 238 252 Q 255 238, 282 252 Q 265 244, 238 252 Z' } : {}}
          transition={{ duration: 0.3 }}
        />
        <motion.path
          d="M 320 255 Q 345 240, 368 252 Q 345 246, 320 255 Z"
          fill="#1e293b"
          animate={isThinking ? { d: 'M 320 252 Q 345 236, 368 249 Q 345 243, 320 252 Z' } : {}}
          transition={{ duration: 0.3 }}
        />

        {/* Hair shadow on face */}
        <path d="M 200 250 C 230 180, 270 200, 330 150 C 280 230, 230 280, 210 380 Z" fill="#000" opacity="0.25" filter="url(#ax-glow)" />

        {/* === HAIR — multi-layered with cyan streak === */}
        <motion.g
          animate={
            isActive
              ? { rotate: [0, 3, -1, 3, 0], skewX: [0, -1.5, 0.5, -1.5, 0] }
              : { rotate: [0, 2.5, 0], skewX: [0, -1, 0] }
          }
          transition={{
            duration: isActive ? 2 : 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ transformOrigin: '250px 100px' }}
        >
          {/* Deep base */}
          <path d="M 350 120 C 250 100, 150 200, 180 380 C 210 250, 250 180, 350 120 Z" fill="#94a3b8" />
          {/* Mid layer */}
          <path d="M 340 130 C 240 120, 170 200, 190 400 C 205 320, 230 240, 340 130 Z" fill="#e2e8f0" />
          {/* White front */}
          <path d="M 330 130 C 250 130, 190 200, 210 405 C 230 330, 260 220, 330 130 Z" fill="#fff" />
          {/* Secondary strand */}
          <motion.path
            d="M 240 230 C 200 280, 175 360, 170 410 C 185 360, 205 300, 240 230 Z"
            fill="#fff"
            animate={isActive ? { rotate: [0, 4, 0] } : {}}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '280px 120px' }}
          />
          {/* Cyan streak — darker core */}
          <path d="M 310 140 C 230 150, 180 230, 205 390 C 225 290, 240 220, 310 140 Z" fill="#009eb3" />
          {/* Cyan streak — bright */}
          <motion.path
            d="M 300 140 C 240 160, 195 240, 215 395 C 230 310, 250 220, 300 140 Z"
            fill="#00e5ff"
            animate={
              isActive
                ? { opacity: [0.7, 1, 0.7] }
                : { opacity: [0.5, 0.8, 0.5] }
            }
            transition={{ duration: isActive ? 1.5 : 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.g>

        {/* Foreground secondary strands */}
        <motion.g
          animate={
            isActive
              ? { rotate: [0, 4, -2, 4, 0] }
              : { rotate: [0, 3, 0] }
          }
          transition={{
            duration: isActive ? 2.5 : 4.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ transformOrigin: '280px 120px' }}
        >
          <path d="M 350 120 C 300 150, 280 180, 270 240 C 280 190, 310 160, 350 120 Z" fill="#000" opacity="0.15" transform="translate(-2, 4)" />
          <path d="M 350 120 C 300 150, 280 180, 270 240 C 280 190, 310 160, 350 120 Z" fill="#fff" />
          <path d="M 350 130 C 330 160, 320 200, 330 240 C 340 190, 350 170, 350 130 Z" fill="#94a3b8" />
        </motion.g>
      </motion.g>

      {/* === THINKING ENERGY RING === */}
      {isThinking && (
        <g>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.circle
              key={i}
              cx="300"
              cy="300"
              r={200 + i * 8}
              fill="none"
              stroke="#00e5ff"
              strokeWidth="1"
              strokeDasharray="15 50"
              strokeDashoffset={i * 20}
              opacity="0.25"
              filter="url(#ax-particle-glow)"
              initial={{ rotate: 0 }}
              animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                ease: 'linear',
              }}
              style={{ transformOrigin: '300px 300px' }}
            />
          ))}
        </g>
      )}

      {/* === ANSWERING BURST === */}
      {isAnswering && (
        <g>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const angle = (i / 8) * Math.PI * 2
            return (
              <motion.circle
                key={i}
                cx={300 + Math.cos(angle) * 30}
                cy={300 + Math.sin(angle) * 30}
                r="5"
                fill={i % 2 === 0 ? '#00e5ff' : '#b900ff'}
                filter="url(#ax-particle-glow)"
                initial={{ opacity: 1, scale: 1 }}
                animate={{
                  cx: 300 + Math.cos(angle) * 250,
                  cy: 300 + Math.sin(angle) * 250,
                  opacity: 0,
                  scale: 0.2,
                }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            )
          })}
        </g>
      )}

      {/* === ERROR SWEAT DROP === */}
      {isError && (
        <motion.path
          d="M 365 240 Q 368 250 365 258 Q 362 250 365 240 Z"
          fill="#60A5FA"
          opacity="0.8"
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 0.8 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        />
      )}
    </svg>
  )
}
