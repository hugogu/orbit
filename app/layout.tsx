import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'ORBIT · 太阳系漫游',
  description:
    '从太阳到奥尔特云，探索运行中的三维太阳系。调节时间，走近行星，理解我们的宇宙家园。',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body>{children}</body>
    </html>
  );
}
