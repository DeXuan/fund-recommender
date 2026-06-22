import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { registerEchartsDarkTheme } from './utils/echarts-theme'
import { ANTD_THEME_TOKEN, getDarkAwareTokens } from './constants/theme'
import App from './App'
import './index.css'

registerEchartsDarkTheme()

function ThemedApp() {
  const { isDark } = useTheme()
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : undefined,
        token: {
          ...ANTD_THEME_TOKEN.token,
          ...getDarkAwareTokens(isDark),
        },
      }}
    >
      <App />
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  </React.StrictMode>,
)
