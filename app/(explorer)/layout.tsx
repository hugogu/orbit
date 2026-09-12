import type { Metadata } from 'next';
import LayoutShell from '../layout-shell';
import { metadata as siteMetadata } from '../site-metadata';

export const metadata: Metadata = siteMetadata;

export default function ExplorerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LayoutShell>{children}</LayoutShell>;
}
