import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  'zh-CN': {
    translation: {
      nav: {
        home: '首页',
        fundList: '基金列表',
        industry: '行业分析',
        qdii: 'QDII基金',
        cmbProducts: '招行理财',
        events: '事件日历',
        aiAssistant: 'AI助手',
        portfolio: '我的持仓',
        stockPicker: '选股助手',
        fundCompare: '基金对比',
        fundDiagnosis: '基金诊断',
        valuationCenter: '估值中心',
        subscription: '订阅',
        profile: '个人中心',
        adminUsers: '用户管理',
        adminMonitor: '系统监控',
        about: '关于',
        logout: '退出登录',
        changePassword: '修改密码',
      },
      login: {
        title: '个人基金数据看板',
        subtitle: '登录您的账户',
        loginTab: '登录',
        registerTab: '注册',
        username: '用户名',
        password: '密码',
        confirmPassword: '确认密码',
        loginButton: '登录',
        registerButton: '注册',
        alipayLogin: '支付宝登录',
        loginSuccess: '登录成功',
        registerSuccess: '注册成功',
        loginFailed: '登录失败',
        registerFailed: '注册失败',
        usernameRequired: '请输入用户名',
        passwordRequired: '请输入密码',
        passwordMinLength: '密码至少8位',
        passwordMismatch: '两次密码不一致',
        welcomeBack: '欢迎回来',
      },
      footer: {
        disclaimer: '本站为个人技术学习与非商业演示项目，仅展示个人基金净值等数据以便本人查看，不构成任何投资建议，亦不提供基金推荐或买卖指导。投资有风险，决策需谨慎。',
        about: '关于个人基金数据看板',
        copyright: '微博@Mcmirror',
      },
      common: {
        loading: '加载中...',
        error: '出错了',
        retry: '重试',
        cancel: '取消',
        confirm: '确认',
        save: '保存',
        delete: '删除',
        edit: '编辑',
        search: '搜索',
        noData: '暂无数据',
      },
    },
  },
  'en-US': {
    translation: {
      nav: {
        home: 'Home',
        fundList: 'Funds',
        industry: 'Industry',
        qdii: 'QDII Funds',
        cmbProducts: 'CMB Wealth',
        events: 'Events',
        aiAssistant: 'AI Assistant',
        portfolio: 'Portfolio',
        stockPicker: 'Stock Picker',
        fundCompare: 'Fund Compare',
        fundDiagnosis: 'Fund Diagnosis',
        valuationCenter: 'Valuation',
        subscription: 'Subscription',
        profile: 'Profile',
        adminUsers: 'User Management',
        adminMonitor: 'System Monitor',
        about: 'About',
        logout: 'Logout',
        changePassword: 'Change Password',
      },
      login: {
        title: 'Personal Fund Dashboard',
        subtitle: 'Sign in to your account',
        loginTab: 'Sign In',
        registerTab: 'Sign Up',
        username: 'Username',
        password: 'Password',
        confirmPassword: 'Confirm Password',
        loginButton: 'Sign In',
        registerButton: 'Sign Up',
        alipayLogin: 'Alipay Login',
        loginSuccess: 'Login successful',
        registerSuccess: 'Registration successful',
        loginFailed: 'Login failed',
        registerFailed: 'Registration failed',
        usernameRequired: 'Please enter username',
        passwordRequired: 'Please enter password',
        passwordMinLength: 'Password must be at least 8 characters',
        passwordMismatch: 'Passwords do not match',
        welcomeBack: 'Welcome back',
      },
      footer: {
        disclaimer: 'This is a personal technical learning and non-commercial demo project. It displays personal fund NAV data for the owner\'s reference only and does not constitute investment advice or fund recommendations. Investing involves risk.',
        about: 'About Personal Fund Dashboard',
        copyright: 'Weibo @Mcmirror',
      },
      common: {
        loading: 'Loading...',
        error: 'Error',
        retry: 'Retry',
        cancel: 'Cancel',
        confirm: 'Confirm',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        search: 'Search',
        noData: 'No data',
      },
    },
  },
};

// 防御式读取：隐私模式/被策略禁用的存储、以及某些运行时（如未开 --localstorage-file 的 Node 22+）
// 会让 localStorage 不可用甚至为 undefined，这里不能让它把整个应用带崩。
function readSavedLang(): string {
  try {
    return globalThis.localStorage?.getItem('i18n-lang') || 'zh-CN';
  } catch {
    return 'zh-CN';
  }
}

const savedLang = readSavedLang();

i18n.use(initReactI18next).init({
  resources,
  lng: savedLang,
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
});

export default i18n;
