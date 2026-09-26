import Bibliography from './Bibliography.jsx';
import DataTrends from './DataTrends.jsx';
import GlobalBriefing from './GlobalBriefing.jsx';
import LeadStory from './LeadStory.jsx';
import Masthead from './Masthead.jsx';

/**
 * The full newsletter layout, used by the public site and by the admin
 * live preview, so what the writer sees is exactly what readers get.
 */
export default function EditionView({ edition, preview = false }) {
  const content = edition.content ?? {};
  // Citations like [3] only link if bibliography entry 3 exists.
  const count = content.bibliography?.length ?? 0;

  return (
    <div className={`edition${preview ? ' edition--preview' : ''}`}>
      <Masthead edition={edition} linkHome={!preview} />

      <LeadStory lead={content.lead_story} count={count} />

      <GlobalBriefing briefing={content.global_briefing} count={count} />

      <DataTrends panels={content.data_trends} count={count} />

      {edition.editor_note?.trim() && (
        <div className="closing">
          <aside className="editors-note" aria-labelledby="editors-note-title">
            <h2 id="editors-note-title" className="editors-note__title">
              The Editor’s Note
            </h2>
            {edition.editor_note.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
            <p className="editors-note__sign">— The Editor</p>
          </aside>
        </div>
      )}

      <Bibliography entries={content.bibliography} />
    </div>
  );
}
