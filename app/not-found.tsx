const NOT_FOUND_COPY = {
  title: 'Page introuvable',
  body: 'Cette page n’existe pas ou plus. Retourne à l’accueil pour continuer ta pratique.',
  linkLabel: "Retour à l'accueil",
};

export default function NotFound() {
  return (
    <main role="main" aria-labelledby="not-found-title">
      <h1 id="not-found-title">{NOT_FOUND_COPY.title}</h1>
      <p>{NOT_FOUND_COPY.body}</p>
      <a href="/">{NOT_FOUND_COPY.linkLabel}</a>
    </main>
  );
}
