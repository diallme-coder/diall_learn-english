// src/components/core/MouthDiagram.tsx: renders a src/lib/pronunciation MouthDiagram
// (sagittal line-art) with role="img", a <title> and a visible long-text alternative — the
// diagram is never the only carrier of the tip (design 05 §3).
import type { MouthDiagram as MouthDiagramData } from '../../lib/pronunciation/diagrams.ts';
import type { UiLangMode } from '../../lib/ui/strings.ts';

interface MouthDiagramProps {
  diagram: MouthDiagramData;
  mode?: UiLangMode;
}

export default function MouthDiagram({ diagram, mode = 'fr' }: MouthDiagramProps) {
  const alt = mode === 'en' ? diagram.altEn : diagram.altFr;
  return (
    <figure>
      <svg
        viewBox={diagram.viewBox}
        role="img"
        aria-labelledby="mouth-diagram-title"
        style={{ width: '100%', maxWidth: '16rem', color: 'var(--color-primary)' }}
      >
        <title id="mouth-diagram-title">{alt}</title>
        {diagram.paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ))}
      </svg>
      <figcaption className="status-line">{alt}</figcaption>
    </figure>
  );
}
