import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import EditionView from '../components/newsletter/EditionView.jsx';
import PdfButton from '../components/PdfButton.jsx';
import { api } from '../lib/api.js';
import { formatDateTime, REGION_LABELS } from '../lib/format.js';
import { useDocumentTitle } from '../lib/useApi.js';
import { deleteWarning, EditionStatus, Notice } from './components.jsx';
import { CtaEditor, ExplainersEditor, FeaturesEditor, HeroEditor, PollEditor, PromoEditor, SectionsEditor, SidebarEditor, TagsField, VideoClipsEditor } from './LayoutEditors.jsx';
import { composeSections, splitIntoSections } from '../lib/sections.js';
import { DataPointsField, ImageUpload, LinesField, ListEditor, MarkdownField, TextArea, TextField } from './fields.jsx';

const REGION_KEYS = ['americas', 'emea', 'apac', 'global_south'];

/** Memoised so the preview only re-renders when the (deferred) edition actually changes. */
const PreviewPane = memo(function PreviewPane({ edition }) {
  return edition ? <EditionView edition={edition} preview /> : null;
});

/** "bbc.co.uk/news" → "https://bbc.co.uk/news", "me@x.com" → "mailto:me@x.com". */
function fixLink(value) {
  const v = (value ?? '').trim();
  if (!v || /^(https?:\/\/|mailto:)/i.test(v)) return v;
  return /^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(v) ? `mailto:${v}` : `https://${v.replace(/^\/+/, '')}`;
}

/** Tidy every clickable link in the edition before saving. */
function normalizeLinks(content) {
  const lead = content.lead_story ?? {};
  return {
    ...content,
    // Photo/video slots that were added but never uploaded are left out.
    lead_story: lead.sections ? { ...lead, sections: lead.sections.map((s) => ({ ...s, media: (s.media ?? []).filter((m) => m.url) })) } : lead,
    bibliography: (content.bibliography ?? []).map((b) => ({ ...b, url: fixLink(b.url) })),
    hero: content.hero && { ...content.hero, link: fixLink(content.hero.link) },
    sidebar: content.sidebar && {
      ...content.sidebar,
      links: (content.sidebar.links ?? []).map((l) => ({ ...l, url: fixLink(l.url) })),
      sponsors: (content.sidebar.sponsors ?? []).map((s) => ({ ...s, url: fixLink(s.url) })),
    },
    features: (content.features ?? []).map((f) => ({
      ...f,
      blocks: (f.blocks ?? []).map((b) => ({ ...b, cta_url: fixLink(b.cta_url) })),
    })),
    cta: content.cta && { ...content.cta, button_url: fixLink(content.cta.button_url) },
  };
}

function draftFrom(edition) {
  return {
    content: structuredClone(edition.content),
    editor_note: edition.editor_note ?? '',
    issue_number: edition.issue_number,
    publication_date: edition.publication_date ?? null,
  };
}

/** After creating an edition from the question template: what was filled in, and what to do next. */
function ImportReport({ report, onClose }) {
  return (
    <Notice tone={report.missing?.length ? 'warn' : 'good'} onClose={onClose} sticky>
      <strong>Laid out from your template:</strong> {report.headlines} headline{report.headlines === 1 ? '' : 's'} and{' '}
      {report.sources} source{report.sources === 1 ? '' : 's'}. Check the text below, then add photos and videos to each
      headline before publishing.
      {report.missing?.length > 0 && <> Still empty: {report.missing.join(', ')}.</>}
      {report.unknown?.length > 0 && <> Codes not recognised (ignored): {report.unknown.join(', ')}.</>}
    </Notice>
  );
}

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [edition, setEdition] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [draft, setDraft] = useState(null);
  const [baseline, setBaseline] = useState('');
  const [view, setView] = useState('edit'); // small-screen toggle
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);

  const adopt = useCallback((ed) => {
    const fresh = draftFrom(ed);
    setEdition(ed);
    setDraft(fresh);
    setBaseline(JSON.stringify(fresh));
  }, []);

  useEffect(() => {
    api
      .get(`/admin/editions/${id}`)
      .then(({ edition: ed }) => adopt(ed))
      .catch((err) => setLoadError(err));
  }, [id, adopt]);

  const dirty = useMemo(() => draft !== null && JSON.stringify(draft) !== baseline, [draft, baseline]);
  useDocumentTitle(edition ? `Issue ${edition.issue_number}` : 'Edition');

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const save = useCallback(async () => {
    if (!draft) return null;
    setBusy('save');
    setMessage(null);
    try {
      const { edition: saved } = await api.patch(`/admin/editions/${id}`, { ...draft, content: normalizeLinks(draft.content) });
      adopt(saved);
      setMessage({ tone: 'good', text: saved.status === 'published' ? 'Saved — the live edition is updated.' : 'Draft saved.' });
      return saved;
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
      return null;
    } finally {
      setBusy(null);
    }
  }, [draft, id, adopt]);

  // Ctrl+S / Cmd+S saves.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const previewEdition = useMemo(() => {
    if (!edition || !draft) return null;
    const lead = draft.content.lead_story;
    // With headline sections, the preview shows the article exactly as the server will build it.
    const content = lead.sections?.length
      ? { ...draft.content, lead_story: { ...lead, body_markdown: composeSections(lead.sections) } }
      : draft.content;
    return { ...edition, ...draft, content };
  }, [edition, draft]);
  // The preview renders "just behind" your typing, so keystrokes never wait for it.
  const deferredPreview = useDeferredValue(previewEdition);

  if (loadError) return <Notice tone="error">Could not load this edition: {loadError.message}</Notice>;
  const imported = location.state?.imported;
  if (!draft) return <p className="state-message">Loading…</p>;

  const content = draft.content;
  const isPublished = edition.status === 'published';
  const shareUrl = `${window.location.origin}/edition/${edition.slug}`;
  const setContent = (fn) => setDraft((d) => ({ ...d, content: fn(d.content) }));
  const setLead = (field, value) => setContent((c) => ({ ...c, lead_story: { ...c.lead_story, [field]: value } }));
  // Editions written before photos were added have no image object yet.
  const leadImage = { url: '', caption: '', credit: '', ...content.lead_story.image };

  async function publish() {
    if (dirty && !(await save())) return;
    if (!window.confirm('Publish this edition to the public website now?')) return;
    setBusy('publish');
    try {
      const { edition: ed } = await api.post(`/admin/editions/${id}/publish`);
      adopt(ed);
      setMessage({ tone: 'good', text: 'Published! It is now the front page of the site.', link: true });
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  }

  async function unpublish() {
    if (!window.confirm('Take this edition off the public website? It becomes a draft again.')) return;
    setBusy('unpublish');
    try {
      const { edition: ed } = await api.post(`/admin/editions/${id}/unpublish`);
      adopt(ed);
      setMessage({ tone: 'warn', text: 'Unpublished — it is now a draft.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm(deleteWarning(edition))) return;
    try {
      await api.del(`/admin/editions/${id}`);
      setBaseline(JSON.stringify(draft)); // nothing left to save
      navigate('/admin', { replace: true });
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    }
  }

  return (
    <div className="review">
      <div className="review__toolbar">
        <Link to="/admin" className="btn btn--ghost btn--small">
          ← Editions
        </Link>
        <strong className="review__title">Issue {edition.issue_number}</strong>
        <EditionStatus status={edition.status} />
        <div className="review__toggle" role="tablist" aria-label="Workspace view">
          <button type="button" role="tab" aria-selected={view === 'edit'} className={view === 'edit' ? 'is-active' : ''} onClick={() => setView('edit')}>
            Write
          </button>
          <button type="button" role="tab" aria-selected={view === 'preview'} className={view === 'preview' ? 'is-active' : ''} onClick={() => setView('preview')}>
            Preview
          </button>
        </div>
        <span className={`save-state${dirty ? ' save-state--dirty' : ''}`}>
          {dirty ? '● Unsaved changes' : `Saved ${formatDateTime(edition.updated_at)}`}
        </span>
        <span className="spacer" />
        <button type="button" className="btn" onClick={save} disabled={!dirty || Boolean(busy)} title="Ctrl+S">
          {busy === 'save' ? 'Saving…' : 'Save'}
        </button>
        <PdfButton
          pdfUrl={`/api/admin/editions/${id}/pdf`}
          fileName={`The-Lead-Story-Issue-${edition.issue_number}${isPublished ? '' : '-DRAFT'}.pdf`}
          label="PDF"
          className="btn btn--ghost"
          // Unsaved edits are saved first so the PDF matches what you see.
          before={async () => (dirty ? Boolean(await save()) : true)}
        />
        {isPublished ? (
          <>
            <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="btn btn--ghost">
              View live ↗
            </a>
            <button type="button" className="btn btn--ghost" onClick={unpublish} disabled={Boolean(busy)}>
              Unpublish
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--accent" onClick={publish} disabled={Boolean(busy)}>
            {busy === 'publish' ? 'Publishing…' : 'Publish'}
          </button>
        )}
      </div>

      {imported && <ImportReport report={imported} onClose={() => navigate('.', { replace: true, state: null })} />}

      {message && (
        <Notice key={message.text} tone={message.tone} onClose={() => setMessage(null)} sticky={Boolean(message.link)}>
          {message.text}
          {message.link && isPublished && (
            <>
              {' '}
              Share link:{' '}
              <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                {shareUrl}
              </a>{' '}
              <button type="button" className="btn btn--ghost btn--small" onClick={() => navigator.clipboard?.writeText(shareUrl)}>
                Copy
              </button>
            </>
          )}
        </Notice>
      )}

      <div className={`review__split review__split--${view}`}>
        <div className="review__editor" aria-label="Editor">
          <fieldset className="editor-section">
            <legend>Edition details</legend>
            <div className="grid-2">
              <TextField
                label="Issue number"
                type="number"
                min="1"
                value={String(draft.issue_number)}
                disabled={isPublished}
                onChange={(v) => setDraft((d) => ({ ...d, issue_number: Math.max(1, Number.parseInt(v, 10) || 1) }))}
              />
              <TextField
                label="Publication date"
                type="date"
                value={draft.publication_date ? draft.publication_date.slice(0, 10) : ''}
                onChange={(v) => setDraft((d) => ({ ...d, publication_date: v ? `${v}T12:00:00.000Z` : null }))}
                hint="Leave empty to use the day you publish."
              />
            </div>
            <TagsField value={content.tags} onChange={(tags) => setContent((c) => ({ ...c, tags }))} />
          </fieldset>

          <HeroEditor value={content.hero} onChange={(hero) => setContent((c) => ({ ...c, hero }))} />

          <fieldset className="editor-section">
            <legend>The Lead Story</legend>
            <TextField label="Kicker (small label above the headline)" value={content.lead_story.kicker} onChange={(v) => setLead('kicker', v)} placeholder="e.g. Diplomacy · Indo-Pacific" />
            <TextField label="Headline" value={content.lead_story.headline} onChange={(v) => setLead('headline', v)} />
            <TextArea label="Subheadline" rows={2} value={content.lead_story.subheadline} onChange={(v) => setLead('subheadline', v)} />
            <TextArea label="Deck (one-sentence summary)" rows={2} value={content.lead_story.deck} onChange={(v) => setLead('deck', v)} />
            <TextField label="Byline (writer’s name)" value={content.lead_story.byline} onChange={(v) => setLead('byline', v)} />
            <div className="editor-image">
              <ImageUpload
                label="Main photo (optional)"
                value={leadImage.url}
                onChange={(url) => setLead('image', { ...leadImage, url })}
                hint="Shown large under the headline. Big photos are resized automatically."
              />
              {leadImage.url && (
                <div className="grid-2">
                  <TextField label="Photo caption" value={leadImage.caption} onChange={(v) => setLead('image', { ...leadImage, caption: v })} />
                  <TextField label="Photo credit" value={leadImage.credit} onChange={(v) => setLead('image', { ...leadImage, credit: v })} placeholder="e.g. Reuters / Jane Doe" />
                </div>
              )}
            </div>
            {/* The article: headline sections (headline + response + photos/videos),
                or the classic single box for older editions until converted. */}
            {content.lead_story.sections?.length || !content.lead_story.body_markdown?.trim() ? (
              <SectionsEditor value={content.lead_story.sections ?? []} onChange={(v) => setLead('sections', v)} />
            ) : (
              <>
                <MarkdownField
                  label="Article"
                  rows={22}
                  value={content.lead_story.body_markdown}
                  onChange={(v) => setLead('body_markdown', v)}
                  hint="Leave a blank line between paragraphs. Start a line with ## for a subheading. Cite your bibliography with [1], [2] … and use **bold** or *italic* for emphasis. To add a photo, click Insert image or paste/drag one into the text, then edit its caption."
                />
                <div className="convert-box">
                  <p>
                    <strong>New:</strong> write this article as separate headlines, each with its own response, photos and videos.
                  </p>
                  <button
                    type="button"
                    className="btn btn--small"
                    onClick={() => setLead('sections', splitIntoSections(content.lead_story.body_markdown))}
                  >
                    Split into headline sections
                  </button>
                </div>
              </>
            )}
            <h4 className="mini-title">Key figures (optional)</h4>
            <ListEditor
              items={content.lead_story.key_metrics}
              onChange={(v) => setLead('key_metrics', v)}
              itemLabel="Figure"
              addLabel="Add figure"
              max={8}
              makeItem={() => ({ label: '', value: '', context: '' })}
              renderItem={(m, set) => (
                <div className="grid-3">
                  <TextField label="Label" value={m.label} onChange={(v) => set({ ...m, label: v })} placeholder="Voter turnout" />
                  <TextField label="Value" value={m.value} onChange={(v) => set({ ...m, value: v })} placeholder="62%" />
                  <TextField label="Context" value={m.context} onChange={(v) => set({ ...m, context: v })} placeholder="Highest since 1998 [2]" />
                </div>
              )}
            />
            <MarkdownField
              label="Historical context (optional)"
              rows={7}
              value={content.lead_story.historical_context_markdown}
              onChange={(v) => setLead('historical_context_markdown', v)}
            />
            <LinesField label="What to watch (optional)" value={content.lead_story.what_to_watch} onChange={(v) => setLead('what_to_watch', v)} />
            <h4 className="mini-title">Pull quotes (optional)</h4>
            <p className="field__hint">
              Striking lines from your article. On computers they appear large in the right margin, spaced evenly down the story; on
              phones they sit between paragraphs.
            </p>
            <ListEditor
              items={content.lead_story.pull_quotes ?? []}
              onChange={(v) => setLead('pull_quotes', v)}
              itemLabel="Quote"
              addLabel="Add pull quote"
              max={4}
              makeItem={() => ''}
              renderItem={(q, set) => <TextArea label="Quote text (no quotation marks needed)" rows={2} value={q} onChange={set} />}
            />
          </fieldset>

          <ExplainersEditor value={content.explainers} onChange={(explainers) => setContent((c) => ({ ...c, explainers }))} />

          <SidebarEditor value={content.sidebar} onChange={(sidebar) => setContent((c) => ({ ...c, sidebar }))} />

          <fieldset className="editor-section">
            <legend>Around the World</legend>
            <p className="field__hint">Short news items for each region. Regions left empty are hidden.</p>
            {REGION_KEYS.map((key) => (
              <div key={key} className="editor-subsection">
                <h4 className="mini-title">{REGION_LABELS[key]}</h4>
                <ListEditor
                  items={content.global_briefing[key]}
                  onChange={(items) => setContent((c) => ({ ...c, global_briefing: { ...c.global_briefing, [key]: items } }))}
                  itemLabel="Story"
                  addLabel="Add story"
                  max={15}
                  makeItem={() => ({ headline: '', summary: '' })}
                  renderItem={(item, set) => (
                    <>
                      <TextField label="Headline" value={item.headline} onChange={(v) => set({ ...item, headline: v })} />
                      <TextArea label="Summary" rows={3} value={item.summary} onChange={(v) => set({ ...item, summary: v })} />
                      <ImageUpload label="Photo (optional)" value={item.image ?? ''} onChange={(url) => set({ ...item, image: url })} />
                    </>
                  )}
                />
              </div>
            ))}
          </fieldset>

          <PromoEditor value={content.promo} onChange={(promo) => setContent((c) => ({ ...c, promo }))} />

          <FeaturesEditor value={content.features} onChange={(features) => setContent((c) => ({ ...c, features }))} />

          <fieldset className="editor-section">
            <legend>Data &amp; Trends (optional)</legend>
            <ListEditor
              items={content.data_trends}
              onChange={(panels) => setContent((c) => ({ ...c, data_trends: panels }))}
              itemLabel="Chart"
              addLabel="Add chart"
              max={6}
              makeItem={() => ({ title: '', caption: '', unit: '', chart_type: 'bar', data_points: [] })}
              renderItem={(panel, set) => (
                <>
                  <TextField label="Title" value={panel.title} onChange={(v) => set({ ...panel, title: v })} />
                  <div className="grid-2">
                    <label className="field">
                      <span className="field__label">Display</span>
                      <select className="select" value={panel.chart_type} onChange={(e) => set({ ...panel, chart_type: e.target.value })}>
                        <option value="bar">Bar chart</option>
                        <option value="none">Text only</option>
                      </select>
                    </label>
                    <TextField label="Unit" value={panel.unit} onChange={(v) => set({ ...panel, unit: v })} placeholder="% · seats · US$bn" />
                  </div>
                  <DataPointsField points={panel.data_points} onChange={(pts) => set({ ...panel, data_points: pts })} />
                  <TextArea label="Caption" rows={2} value={panel.caption} onChange={(v) => set({ ...panel, caption: v })} />
                </>
              )}
            />
          </fieldset>

          <VideoClipsEditor value={content.video_clips} content={content} onChange={(video_clips) => setContent((c) => ({ ...c, video_clips }))} />

          <PollEditor value={content.poll} onChange={(poll) => setContent((c) => ({ ...c, poll }))} />

          <CtaEditor value={content.cta} onChange={(cta) => setContent((c) => ({ ...c, cta }))} />

          <fieldset className="editor-section">
            <legend>The Editor’s Note (optional)</legend>
            <TextArea
              label="Editor’s note"
              rows={7}
              value={draft.editor_note}
              onChange={(v) => setDraft((d) => ({ ...d, editor_note: v }))}
              hint="A personal reflection on this week’s edition. Blank lines separate paragraphs."
            />
          </fieldset>

          <fieldset className="editor-section">
            <legend>Bibliography</legend>
            <p className="field__hint">
              List every source you used. Entry 1 is cited as [1] in your text, entry 2 as [2], and so on.
            </p>
            <ListEditor
              items={content.bibliography}
              onChange={(entries) => setContent((c) => ({ ...c, bibliography: entries }))}
              labelFor={(i) => `Source ${i + 1} — cite as [${i + 1}]`}
              addLabel="Add source"
              max={100}
              makeItem={() => ({ author: '', title: '', publication: '', date: '', url: '', accessed: new Date().toISOString().slice(0, 10) })}
              renderItem={(entry, set) => (
                <>
                  <div className="grid-2">
                    <TextField label="Author(s)" value={entry.author} onChange={(v) => set({ ...entry, author: v })} placeholder="Smith, J." />
                    <TextField label="Publication / website" value={entry.publication} onChange={(v) => set({ ...entry, publication: v })} placeholder="BBC News" />
                  </div>
                  <TextField label="Title" value={entry.title} onChange={(v) => set({ ...entry, title: v })} />
                  <TextField label="URL" type="url" value={entry.url} onChange={(v) => set({ ...entry, url: v })} placeholder="https://…" />
                  <div className="grid-2">
                    <TextField label="Date published" type="date" value={entry.date} onChange={(v) => set({ ...entry, date: v })} />
                    <TextField label="Date accessed" type="date" value={entry.accessed} onChange={(v) => set({ ...entry, accessed: v })} />
                  </div>
                </>
              )}
            />
          </fieldset>

          <div className="danger-zone">
            <button type="button" className="btn btn--ghost btn--small" onClick={remove} disabled={Boolean(busy)}>
              {isPublished ? 'Delete this edition' : 'Delete this draft'}
            </button>
          </div>
        </div>

        <div className="review__preview" aria-label="Live preview">
          <div className="review__preview-label">Live preview — exactly what readers will see</div>
          <PreviewPane edition={deferredPreview} />
        </div>
      </div>
    </div>
  );
}
