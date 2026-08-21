import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { registerEchartsDarkTheme } from './utils/echarts-theme'
import { ANTD_THEME_TOKEN, getDarkAwareTokens } from './constants/theme'
import './i18n'
import App from './App'
import './index.css'

registerEchartsDarkTheme()

function ThemedApp() {
  const { isDark } = useTheme()
  const lang = localStorage.getItem('i18n-lang') || 'zh-CN'
  return (
    <ConfigProvider
      locale={lang === 'en-US' ? enUS : zhCN}
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
