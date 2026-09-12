import HomePage from '../_pages/home-page';
import { homeJsonLd, serializeJsonLd } from '../../lib/seo';

export default function ExplorerPage() {
  return (
    <>
      <HomePage />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(homeJsonLd()) }}
      />
    </>
  );
}
