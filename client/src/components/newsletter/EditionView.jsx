import { Poll } from '../reader/ReaderTools.jsx';
import Bibliography from './Bibliography.jsx';
import { CtaBanner, FeatureSections, HeroBanner, PromoSlot } from './Blocks.jsx';
import DataTrends from './DataTrends.jsx';
import GlobalBriefing from './GlobalBriefing.jsx';
import LeadStory from './LeadStory.jsx';
import Masthead from './Masthead.jsx';
import SocialLinks from './SocialLinks.jsx';

/**
 * The full newsletter layout, used by the public site and by the admin
 * live preview, so what the writer sees is exactly what readers get.
 *
 * Order: masthead → hero banner → lead story (byline frame, contents,
 * sidebar, share) → around the world → promotion slot → feature sections →
 * data & trends → reader poll → call to action → editor's note →
 * bibliography → social links.
 */
export default function EditionView({ edition, preview = false }) {
  const content = edition.content ?? {};
  // Citations like [3] only link if bibliography entry 3 exists.
  const count = content.bibliography?.length ?? 0;

  return (
    <div className={`edition${preview ? ' edition--preview' : ''}`}>
      <Masthead edition={edition} linkHome={!preview} />

      <HeroBanner hero={content.hero} preview={preview} />

      <LeadStory lead={content.lead_story} sidebar={content.sidebar} count={count} edition={edition} still={preview} />

      <GlobalBriefing briefing={content.global_briefing} count={count} />

      <PromoSlot promo={content.promo} preview={preview} />

      <FeatureSections sections={content.features} count={count} />

      <DataTrends panels={content.data_trends} count={count} />

      <div id="have-your-say">
        <Poll edition={edition} preview={preview} />
      </div>

      <CtaBanner cta={content.cta} />

      {edition.editor_note?.trim() && (
        <div className="closing">
          <aside id="editors-note" className="editors-note" aria-labelledby="editors-note-title">
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

      <SocialLinks title="Follow The Lead Story" preview={preview} className="social--edition" />
    </div>
  );
}
