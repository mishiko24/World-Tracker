// Country flag chip before a country's name (public/flags/<ID>.png, built by scripts/build-flags.mjs).
// Decorative: the name is always next to it, so alt is empty. Lazy, because list view shows all 241 at once.

export function flagUrl(id: string): string {
  return `${import.meta.env.BASE_URL}flags/${id}.png`;
}

export function Flag({ id, size = "small" }: { id: string; size?: "small" | "large" }) {
  return <img className={`flag flag-${size}`} src={flagUrl(id)} alt="" loading="lazy" />;
}
