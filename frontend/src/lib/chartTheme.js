export const chartColors = ['#236c59', '#d27a4b', '#5c7eae', '#b49942', '#8a6e9e', '#488277', '#b86162', '#708f4a']

export const gridProps = { stroke: '#e9ece7', strokeDasharray: '3 5' }

export function axisProps(fontSize = 10) {
  return { axisLine: false, tickLine: false, tick: { fill: '#7a857d', fontSize } }
}

export const tooltipStyle = { border: '1px solid #e2e7e1', borderRadius: 3, fontSize: 12 }

export const barMargin = { top: 12, right: 8, left: -18, bottom: 0 }
