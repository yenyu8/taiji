import './globals.css';

export const metadata = { title: 'Taiji Core Demo', description: '模块化 AI-native 学习底座演示' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
