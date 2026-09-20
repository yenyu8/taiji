import './globals.css';

export const metadata = { title: '太极 · 学习工作台', description: '规划路线、学习教程、编程实践与 AI 辅导' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
