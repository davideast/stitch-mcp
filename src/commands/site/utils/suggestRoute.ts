const HOME_SLUGS = new Set(['home', 'landing', 'landing-page', 'index']);

export function suggestRoute(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return HOME_SLUGS.has(slug) ? '/' : `/${slug}`;
}
