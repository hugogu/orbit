const ADSENSE_CLIENT_ID = 'ca-pub-8644095085401499';

export default function GoogleAdSense() {
  return (
    <script
      async
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
    />
  );
}
