import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

class AppErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('Unhandled UI error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-error" role="alert">
          <div className="fatal-error-panel">
            <span className="loading-mark">SE</span>
            <p className="section-label">TEMPORARY UI ERROR</p>
            <h1>畫面剛剛遇到問題。</h1>
            <p>資料沒有被刪除。重新載入後可以繼續使用工作台。</p>
            <button className="button primary" type="button" onClick={() => window.location.reload()}>
              重新載入工作台
            </button>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
