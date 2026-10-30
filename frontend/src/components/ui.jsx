export function Metric({ label, value, tone }) {
  return <article className={`metric-card metric-${tone}`}><span>{label}</span><strong>{Number(value).toLocaleString('fr-FR')}</strong></article>
}

export function PanelTitle({ eyebrow, title }) {
  return <div className="panel-title"><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div>
}

export function EmptyPanel({ text }) {
  return <div className="empty-panel"><span aria-hidden="true">—</span><p>{text}</p></div>
}

export function Wordmark({ href, ...props }) {
  return <a className="wordmark" href={href} {...props}><span className="logo-icon">d</span>dataclair<span className="wordmark-period">.</span></a>
}
