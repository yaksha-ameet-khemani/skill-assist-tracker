import { useEffect, useState, type FormEvent } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { checkTeamKey, getTeamKey, setTeamKey } from './lib/db'
import { ContentDetail } from './pages/ContentDetail'
import { ContentImport } from './pages/ContentImport'
import { Contents } from './pages/Contents'
import { TocUpload } from './pages/TocUpload'
import { Topics } from './pages/Topics'
import { Tools } from './pages/Tools'
import { Tracker } from './pages/Tracker'

// Cloudflare version (2026-10-05): anyone with the link can view; saving needs the team passcode (🔒, top right).
export default function App() {
  return (
    <BrowserRouter>
      <nav className="topbar">
        <Link to="/" className="brand">
          Skill Assist Tracker
        </Link>
        <span className="spacer" />
        <Link to="/tools" className="small muted">
          More tools
        </Link>
        <Passcode />
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Tracker />} />
          {/* Parked tools, reachable from "More tools" */}
          <Route path="/tools" element={<Tools />} />
          <Route path="/content" element={<Contents />} />
          <Route path="/content/import" element={<ContentImport />} />
          <Route path="/content/:id" element={<ContentDetail />} />
          <Route path="/topics" element={<Topics />} />
          <Route path="/toc/upload" element={<TocUpload />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

/** Team passcode for saving: entered once per browser, checked with the server before it is kept. */
function Passcode() {
  const [key, setKey] = useState(getTeamKey())
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const sync = () => setKey(getTeamKey())
    window.addEventListener('team-key', sync)
    return () => window.removeEventListener('team-key', sync)
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const ok = await checkTeamKey(value.trim()).catch(() => false)
    setBusy(false)
    if (!ok) return setError('Wrong passcode')
    setTeamKey(value.trim())
    setValue('')
    setOpen(false)
  }

  if (key)
    return (
      <button className="small" title="Saving is on in this browser. Click to lock it again." onClick={() => setTeamKey('')}>
        🔓 Editing on
      </button>
    )
  return (
    <span className="passcode">
      <button className="small" title="Enter the team passcode to save changes" onClick={() => setOpen(!open)}>
        🔒 Passcode
      </button>
      {open && (
        <form className="passcode-pop card stack" onSubmit={submit}>
          <label>
            Team passcode (needed to save changes)
            <input type="password" autoFocus autoComplete="current-password" value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <button className="primary small" disabled={busy || !value.trim()}>
            {busy ? 'Checking…' : 'Unlock editing'}
          </button>
          {error && <span className="error-text small">{error}</span>}
        </form>
      )}
    </span>
  )
}
