/**
 * Open Graph card for a marketing page. Cards live in
 * `public/images/og/<slug>.png` at 1200×630 (the size social platforms
 * expect for a large summary card).
 */
export function ogImage(slug: string, alt: string) {
  return [
    {
      url: `/images/og/${slug}.png`,
      width: 1200,
      height: 630,
      alt,
    },
  ];
}
