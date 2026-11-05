type NavigationStore = {
  fetch: typeof fetch;
  match: (pathname: string) => Promise<Response | undefined>;
  save: (pathname: string, response: Response) => Promise<void>;
  fallback: () => Promise<Response | undefined>;
  waitUntil: (work: Promise<unknown>) => void;
};

/** Fresh HTML on navigation, without replacing the worker of a running scene. */
export async function explorerDocument(
  request: Request,
  store: NavigationStore,
) {
  // Query strings describe a view, not a different exported document. Keep the
  // locale's own pathname, so an offline visit retains its document language.
  const pathname = new URL(request.url).pathname;
  try {
    const response = await store.fetch(request, { cache: 'no-cache' });
    if (
      response.status >= 500 ||
      (response.ok &&
        !response.headers.get('Content-Type')?.includes('text/html'))
    )
      throw new Error('Explorer document unavailable');
    if (response.status === 200)
      // A quota/storage failure must not discard a successful online response.
      store.waitUntil(store.save(pathname, response.clone()).catch(() => {}));
    return response;
  } catch {
    return (
      (await store.match(pathname)) ??
      (await store.fallback()) ??
      Response.error()
    );
  }
}
