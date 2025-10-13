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
    typeof window !== 'undefined' ? window.innerWidth >= BREAKPOINTS[target] : false,
  )

  useEffect(() => {
    const handler = () => {
      setMatches(window.innerWidth >= BREAKPOINTS[target])
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
    const handler = () => {
      const width = window.innerWidth
      const found = (Object.keys(BREAKPOINTS) as BreakpointKey[])
        .sort((a, b) => BREAKPOINTS[a] - BREAKPOINTS[b])
        .reduce<BreakpointKey>((acc, key) => {
          if (width >= BREAKPOINTS[key]) {
            return key
          }
          return acc
        }, 'xs')

      setCurrent(found)
    }

    handler()
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return current
}
