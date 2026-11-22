// The offline fallback shell. Served by public/sw.js when a navigation
// fails and nothing matching is in the cache (design 05 §7: offline states
// are text-described, not icon-only).
const OFFLINE_COPY = {
  title: 'Tu es hors ligne',
  body: 'Cette page a besoin d’internet. Réessaie dès que la connexion revient ; le défi du jour et la dernière séquence de shadowing restent disponibles.',
};

export default function OfflinePage() {
  return (
    <main role="main" aria-labelledby="offline-title">
      <h1 id="offline-title">{OFFLINE_COPY.title}</h1>
      <p>{OFFLINE_COPY.body}</p>
    </main>
  );
}
