import { useEffect, useState } from 'react'

const BREAKPOINTS: Record<string, number> = {
  xs: 475,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
}

export type BreakpointKey = keyof typeof BREAKPOINTS

export function useBreakpoint(target: BreakpointKey) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= (BREAKPOINTS[target] ?? 0) : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = () => {
      setMatches(window.innerWidth >= (BREAKPOINTS[target] ?? 0))
    }

    handler()
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [target])

  return matches
}

export function useIsMobile() {
  return useBreakpoint('md') === false
}

export function useCurrentBreakpoint(): BreakpointKey {
  const [current, setCurrent] = useState<BreakpointKey>('xs')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = () => {
      const width = window.innerWidth
      const found = (Object.keys(BREAKPOINTS) as BreakpointKey[])
        .sort((a, b) => (BREAKPOINTS[a] ?? 0) - (BREAKPOINTS[b] ?? 0))
        .reduce<BreakpointKey>((acc, key) => {
          if (width >= (BREAKPOINTS[key] ?? 0)) {
            return key
          }
          return acc
        }, 'xs' as BreakpointKey)

      setCurrent(found)
    }

    handler()
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return current
}
