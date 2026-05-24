import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kiddoplay.app',
  appName: 'KiddoPlay',
  webDir: 'dist',
  server: {
    allowNavigation: ['*']
  }
};

export default config;
