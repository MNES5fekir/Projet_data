import { lazy, Suspense } from 'react'
import './App.css'
import AnalyzerApp from './pages/AnalyzerApp'

const AnalyticsAdmin = lazy(() => import('./pages/AnalyticsAdmin'))

function App() {
  if (window.location.pathname.replace(/\/$/, '') === '/admin/analytics') {
    return <Suspense fallback={null}><AnalyticsAdmin /></Suspense>
  }
  return <AnalyzerApp />
}

export default App
