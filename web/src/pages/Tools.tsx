import { Link } from 'react-router-dom'

const TOOLS = [
  { to: '/toc/upload', name: 'Upload TOC', about: 'Read a TOC Excel and save its rows.' },
  { to: '/content/import', name: 'Import content', about: 'Read a content list Excel and link items to TOC rows.' },
  { to: '/content', name: 'Content (detailed)', about: 'Filters, counts by type, Excel export, add/edit content and links.' },
  { to: '/topics', name: 'TOC topics', about: 'Search all TOC rows and see which content was built on each.' },
]

/** Parked features, kept out of the way of the simple home page. */
export function Tools() {
  return (
    <div className="page stack">
      <header>
        <h1>More tools</h1>
        <p className="muted">Features kept for later use.</p>
      </header>
      <div className="tool-list">
        {TOOLS.map((t) => (
          <Link key={t.to} to={t.to} className="card tool">
            <b>{t.name}</b>
            <span className="muted small">{t.about}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
