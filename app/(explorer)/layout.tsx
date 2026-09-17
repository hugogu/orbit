import type { Metadata } from 'next';
import '../globals.css';
import GoogleAdSense from '../../components/google-adsense';
import RootProviders from '../root-providers';
import { metadata as siteMetadata } from '../site-metadata';

export const metadata: Metadata = siteMetadata;
export { viewport } from '../site-metadata';

export default function ExplorerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        <GoogleAdSense />
      </head>
      <body>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
