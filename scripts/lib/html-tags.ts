export type HtmlTagName = 'html' | 'link' | 'meta';

export function htmlTagAttributes(source: string, tagName: HtmlTagName) {
  const tags = source.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) ?? [];
  return tags.map((tag) => {
    const attributes = new Map<string, string>();
    for (const match of tag.matchAll(
      /\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g,
    )) {
      attributes.set(
        match[1].toLowerCase(),
        match[2] ?? match[3] ?? match[4] ?? '',
      );
    }
    return attributes;
  });
}
