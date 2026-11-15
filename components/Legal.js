import Link from 'next/link';

// Shared layout for the legal pages. `sections` is a list of { id?, title, body: [paragraph or [list items]] }.
export default function Legal({ title, updated, intro, sections }) {
  return (
    <div className="wrap page-pad" style={{ maxWidth: 800 }}>
      <Link className="logo" href="/" style={{ marginBottom: 24, display: 'inline-flex' }}>DEALORA</Link>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>{title}</h1>
      <p className="hint" style={{ marginBottom: 16 }}>Last updated: {updated}</p>
      {intro && <p>{intro}</p>}
      <nav aria-label="Contents" style={{ margin: '16px 0 8px' }}>
        <ol style={{ paddingLeft: 20, columns: 2, columnGap: 32, fontSize: 14 }}>
          {sections.map((s, i) => <li key={i}><a href={'#s' + (i + 1)}>{s.title}</a></li>)}
        </ol>
      </nav>
      {sections.map((s, i) => (
        <section key={i} id={s.id || 's' + (i + 1)} style={{ marginTop: 22 }}>
          <h3>{i + 1}. {s.title}</h3>
          {s.body.map((b, k) => (Array.isArray(b)
            ? <ul key={k} style={{ margin: '8px 0 8px 20px' }}>{b.map((li, m) => <li key={m} style={{ margin: '4px 0' }}>{li}</li>)}</ul>
            : <p key={k} style={{ marginTop: 8 }}>{b}</p>))}
        </section>
      ))}
      <p className="hint" style={{ marginTop: 28 }}>
        <Link href="/terms">Terms of Use</Link> · <Link href="/privacy">Privacy Policy</Link> · <Link href="/rules">Community Rules</Link> · <Link href="/terms#links">Link Submission Terms</Link> · <Link href="/contact">Contact</Link>
      </p>
    </div>
  );
}
