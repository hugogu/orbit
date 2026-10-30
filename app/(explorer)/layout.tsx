import type { Metadata } from 'next';
import '../globals.css';
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
    <html lang="en" className="dark">
      <body>
        <RootProviders locale="en">{children}</RootProviders>
      </body>
    </html>
  );
}
