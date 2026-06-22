import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.guanfundrecommender.app',
  appName: '基金推荐助手',
  webDir: 'dist',
  version: {
    android: {
      versionCode: 1,
      versionName: '1.0.0',
    },
  },
  server: {
    androidScheme: 'http',
    cleartext: true,
    allowNavigation: ['111.229.32.106'],
  },
  plugins: {
    StatusBar: {
      backgroundColor: '#1677ff',
      style: 'DARK',
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#1677ff',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
  android: {
    buildOptions: {
      signingType: 'apksigner',
    },
  },
};

export default config;
