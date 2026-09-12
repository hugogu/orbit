import type { Metadata } from 'next';
import '../globals.css';
import RootProviders from '../root-providers';
import { metadata as siteMetadata } from '../site-metadata';

export const metadata: Metadata = siteMetadata;

export default function ExplorerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
