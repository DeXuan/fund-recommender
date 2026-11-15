import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { ANTD_THEME_TOKEN, getDarkAwareTokens } from './constants/theme'
import './i18n'
import App from './App'
import './index.css'

// 注意：不要在这里静态引入 echarts / echarts-theme。
// 入口一旦引用，echarts 全量（约 1.1MB）会被打入首屏预加载链路。
// 暗色主题改由图表组件首次渲染时通过 utils/echarts-theme 的 getEchartsTheme() 惰性注册。

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
