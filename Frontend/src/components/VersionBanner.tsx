import React, { useEffect, useState } from 'react'

export default function VersionBanner() {
  const [outdated, setOutdated] = useState(false)
  const [backendVersion, setBackendVersion] = useState<string | null>(null)
  const frontendVersion = (import.meta.env.VITE_APP_VERSION as string) || '2.0.0'
  const apiBase = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001'

  useEffect(() => {
    let mounted = true
    const check = async () => {
      try {
        const resp = await fetch(`${apiBase}/api/version`, { cache: 'no-store' })
        const data = await resp.json()
        const bv = String(data?.version || '')
        if (mounted) {
          setBackendVersion(bv)
          setOutdated(Boolean(bv) && bv !== frontendVersion)
        }
      } catch {}
    }
    check()
    const id = setInterval(check, 60000)
    return () => { mounted = false; clearInterval(id) }
  }, [apiBase, frontendVersion])

  if (!outdated) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center px-4 py-2 bg-yellow-500 text-black">
      <span className="text-sm">
        New version available (backend {backendVersion}, frontend {frontendVersion}). Refresh to update.
      </span>
      <button className="ml-3 px-2 py-1 bg-black text-yellow-300 text-xs rounded" onClick={() => window.location.reload()}>Refresh</button>
    </div>
  )
}