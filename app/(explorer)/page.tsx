import HomePage from '../_pages/home-page';
import { getMessages } from '../../lib/i18n';
import { homeJsonLd, serializeJsonLd } from '../../lib/seo';

export default function ExplorerPage() {
  return (
    <>
      <HomePage initialLocale="en" initialMessages={getMessages('en')} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(homeJsonLd()) }}
      />
    </>
  );
}
