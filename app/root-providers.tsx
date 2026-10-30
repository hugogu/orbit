import GoogleAnalytics from '../components/google-analytics';
import PwaRegistration from '../components/pwa-registration';
import { Analytics } from '@vercel/analytics/next';

export default function RootProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PwaRegistration />
      <GoogleAnalytics />
      <Analytics />
      {children}
    </>
  );
}
