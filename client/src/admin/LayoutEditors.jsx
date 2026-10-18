import { useState } from 'react';
import { ImageUpload, ListEditor, MarkdownField, TextArea, TextField, VideoUpload } from './fields.jsx';
import { clipTargets } from '../lib/clipTargets.js';
import { emptySection } from '../lib/sections.js';

const LINK_HINT = 'Full address starting with https:// (or mailto: for email).';

function Select({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Wide banner image at the top of the edition. */
export function HeroEditor({ value, onChange }) {
  const hero = { image: '', alt: '', caption: '', link: '', ...value };
  const set = (patch) => onChange({ ...hero, ...patch });
  return (
    <fieldset className="editor-section">
      <legend>Hero banner (optional)</legend>
      <p className="field__hint">A wide image across the very top of the edition — a banner, graphic or photo. Wide images (about 3:1) look best.</p>
      <ImageUpload label="Banner image" value={hero.image} onChange={(image) => set({ image })} />
      {hero.image && (
        <>
          <TextField label="Description for screen readers" value={hero.alt} onChange={(alt) => set({ alt })} placeholder="What the image shows" />
          <div className="grid-2">
            <TextField label="Caption (optional)" value={hero.caption} onChange={(caption) => set({ caption })} />
            <TextField label="Link when clicked (optional)" value={hero.link} onChange={(link) => set({ link })} placeholder="https://…" />
          </div>
        </>
      )}
    </fieldset>
  );
}

/** Side panel next to the lead story: links, sponsors, note. */
export function SidebarEditor({ value, onChange }) {
  const sidebar = { title: '', links: [], sponsors: [], note: '', ...value };
  const set = (patch) => onChange({ ...sidebar, ...patch });
  return (
    <fieldset className="editor-section">
      <legend>Sidebar (optional)</legend>
      <p className="field__hint">A narrow panel beside the lead story for further reading, sponsors or a short note.</p>
      <TextField label="Sidebar heading" value={sidebar.title} onChange={(title) => set({ title })} placeholder="Further reading" />
      <h4 className="mini-title">Links</h4>
      <ListEditor
        items={sidebar.links}
        onChange={(links) => set({ links })}
        itemLabel="Link"
        addLabel="Add link"
        max={20}
        makeItem={() => ({ label: '', url: '' })}
        renderItem={(l, setItem) => (
          <div className="grid-2">
            <TextField label="Text" value={l.label} onChange={(label) => setItem({ ...l, label })} />
            <TextField label="Address" value={l.url} onChange={(url) => setItem({ ...l, url })} placeholder="https://…" />
          </div>
        )}
      />
      <TextArea label="Short note (optional)" rows={3} value={sidebar.note} onChange={(note) => set({ note })} />
      <h4 className="mini-title">Sponsors</h4>
      <ListEditor
        items={sidebar.sponsors}
        onChange={(sponsors) => set({ sponsors })}
        itemLabel="Sponsor"
        addLabel="Add sponsor"
        max={10}
        makeItem={() => ({ name: '', url: '', logo: '' })}
        renderItem={(s, setItem) => (
          <>
            <div className="grid-2">
              <TextField label="Name" value={s.name} onChange={(name) => setItem({ ...s, name })} />
              <TextField label="Website" value={s.url} onChange={(url) => setItem({ ...s, url })} placeholder="https://…" hint={LINK_HINT} />
            </div>
            <ImageUpload label="Logo (optional)" value={s.logo} onChange={(logo) => setItem({ ...s, logo })} />
          </>
        )}
      />
    </fieldset>
  );
}

/** Modular grids of content blocks. */
export function FeaturesEditor({ value, onChange }) {
  return (
    <fieldset className="editor-section">
      <legend>Feature sections (optional)</legend>
      <p className="field__hint">
        Extra sections made of blocks in 1, 2 or 3 columns — for opinion pieces, explainers, interviews, club news and so
        on. Each section can have its own divider and background.
      </p>
      <ListEditor
        items={value ?? []}
        onChange={onChange}
        itemLabel="Section"
        addLabel="Add feature section"
        max={8}
        makeItem={() => ({ title: '', layout: '2', background: 'plain', divider: 'line', blocks: [] })}
        renderItem={(section, setSection) => (
          <>
            <TextField label="Section title" value={section.title} onChange={(title) => setSection({ ...section, title })} placeholder="e.g. Perspectives" />
            <div className="grid-3 grid-3--even">
              <Select
                label="Columns"
                value={section.layout}
                onChange={(layout) => setSection({ ...section, layout })}
                options={[
                  ['1', '1 column'],
                  ['2', '2 columns'],
                  ['3', '3 columns'],
                ]}
              />
              <Select
                label="Background"
                value={section.background}
                onChange={(background) => setSection({ ...section, background })}
                options={[
                  ['plain', 'Plain paper'],
                  ['tint', 'Tinted'],
                  ['dark', 'Dark'],
                ]}
              />
              <Select
                label="Divider above"
                value={section.divider}
                onChange={(divider) => setSection({ ...section, divider })}
                options={[
                  ['line', 'Thick line'],
                  ['double', 'Double line'],
                  ['space', 'Whitespace only'],
                ]}
              />
            </div>
            <ListEditor
              items={section.blocks}
              onChange={(blocks) => setSection({ ...section, blocks })}
              itemLabel="Block"
              addLabel="Add block"
              max={12}
              makeItem={() => ({ title: '', body_markdown: '', image: '', cta_label: '', cta_url: '' })}
              renderItem={(block, setBlock) => (
                <>
                  <TextField label="Block title" value={block.title} onChange={(title) => setBlock({ ...block, title })} />
                  <ImageUpload label="Image (optional)" value={block.image} onChange={(image) => setBlock({ ...block, image })} />
                  <MarkdownField label="Text" rows={6} value={block.body_markdown} onChange={(body_markdown) => setBlock({ ...block, body_markdown })} />
                  <div className="grid-2">
                    <TextField label="Button text (optional)" value={block.cta_label} onChange={(cta_label) => setBlock({ ...block, cta_label })} placeholder="Read more" />
                    <TextField label="Button link" value={block.cta_url} onChange={(cta_url) => setBlock({ ...block, cta_url })} placeholder="https://…" />
                  </div>
                </>
              )}
            />
          </>
        )}
      />
    </fieldset>
  );
}

/** Full-width call-to-action banner. */
export function CtaEditor({ value, onChange }) {
  const cta = { heading: '', text: '', button_label: '', button_url: '', style: 'solid', ...value };
  const set = (patch) => onChange({ ...cta, ...patch });
  return (
    <fieldset className="editor-section">
      <legend>Call to action (optional)</legend>
      <p className="field__hint">A bold banner with a button — e.g. “Subscribe”, “Join the club”, “Send us your views”.</p>
      <TextField label="Heading" value={cta.heading} onChange={(heading) => set({ heading })} placeholder="Enjoyed this edition?" />
      <TextArea label="Text" rows={2} value={cta.text} onChange={(text) => set({ text })} />
      <div className="grid-3 grid-3--even">
        <TextField label="Button text" value={cta.button_label} onChange={(button_label) => set({ button_label })} placeholder="Subscribe" />
        <TextField label="Button link" value={cta.button_url} onChange={(button_url) => set({ button_url })} placeholder="https://… or mailto:…" />
        <Select
          label="Button shape"
          value={cta.style}
          onChange={(style) => set({ style })}
          options={[
            ['solid', 'Rectangle'],
            ['pill', 'Pill (rounded)'],
          ]}
        />
      </div>
    </fieldset>
  );
}

/** Topic tags shown as colour-coded badges (e.g. "Diplomacy, Conflict, Economy"). */
export function TagsField({ value, onChange }) {
  const [text, setText] = useState(() => (value ?? []).join(', '));
  return (
    <TextField
      label="Topic tags (comma separated, up to 6)"
      value={text}
      placeholder="Diplomacy, Conflict, Economy"
      onChange={(v) => {
        setText(v);
        onChange(
          [...new Set(v.split(',').map((t) => t.trim()).filter(Boolean))]
            .slice(0, 6)
            .map((t) => t.slice(0, 30)),
        );
      }}
      hint="Shown as coloured badges by the byline and on the All page. Colours are fixed per topic."
    />
  );
}

/** Pre-sized promotion box (728 × 90) between sections. */
export function PromoEditor({ value, onChange }) {
  const promo = { image: '', link: '', label: '', ...value };
  const set = (patch) => onChange({ ...promo, ...patch });
  return (
    <fieldset className="editor-section">
      <legend>Promotion slot (optional)</legend>
      <p className="field__hint">A wide banner (best at 728 × 90) between “Around the World” and the features — e.g. a school event, club or sponsor.</p>
      <ImageUpload label="Banner image" value={promo.image} onChange={(image) => set({ image })} />
      <div className="grid-2">
        <TextField label="Small label" value={promo.label} onChange={(label) => set({ label })} placeholder="Promotion · School event" />
        <TextField label="Link (optional)" value={promo.link} onChange={(link) => set({ link })} placeholder="https://…" />
      </div>
    </fieldset>
  );
}

/** A reader pulse-check: one question, 2–6 answers. */
export function PollEditor({ value, onChange }) {
  const poll = { question: '', options: [], ...value };
  const set = (patch) => onChange({ ...poll, ...patch });
  return (
    <fieldset className="editor-section">
      <legend>Reader poll (optional)</legend>
      <p className="field__hint">Readers pick one answer and then see the results. One vote per browser.</p>
      <TextField label="Question" value={poll.question} onChange={(question) => set({ question })} placeholder="Will the energy ceasefire hold through winter?" />
      <ListEditor
        items={poll.options}
        onChange={(options) => set({ options })}
        itemLabel="Answer"
        addLabel="Add answer"
        max={6}
        makeItem={() => ''}
        renderItem={(option, setOption) => <TextField label="Answer text" value={option} onChange={setOption} />}
      />
    </fieldset>
  );
}

/** "Who is…?", "Timeline", "Key terms" boxes shown in the article's right margin. */
export function ExplainersEditor({ value, onChange }) {
  return (
    <fieldset className="editor-section">
      <legend>Explainer boxes (optional)</legend>
      <p className="field__hint">
        Short background boxes — e.g. “Who is Mark Rutte?” or “Timeline of the ceasefire talks”. On computers they sit in the
        right margin beside the lead story; on phones they follow the article.
      </p>
      <ListEditor
        items={value ?? []}
        onChange={onChange}
        itemLabel="Explainer"
        addLabel="Add explainer box"
        max={6}
        makeItem={() => ({ title: '', body_markdown: '' })}
        renderItem={(box, set) => (
          <>
            <TextField label="Title" value={box.title} onChange={(title) => set({ ...box, title })} placeholder="Who is Mark Rutte?" />
            <MarkdownField label="Text" rows={4} value={box.body_markdown} onChange={(body_markdown) => set({ ...box, body_markdown })} />
          </>
        )}
      />
    </fieldset>
  );
}

/**
 * Clips that play only in the video report, at the story you choose:
 * full-screen (with sound) before the robot reads it, or silently on the
 * studio's video wall while it reads.
 */
export function VideoClipsEditor({ value, onChange, content }) {
  const targets = clipTargets(content);
  return (
    <fieldset className="editor-section">
      <legend>Video clips (video report only)</legend>
      <p className="field__hint">
        Add your own footage to the video report. Pick the headline it belongs to — when the robot anchor reaches that story,
        your clip plays. Clips never appear in the written newsletter or the PDF. MP4 works best. Videos can be any size; large files simply take longer to upload.
      </p>
      {!targets.length && <p className="field__hint"><strong>Write a headline first</strong> — clips are attached to stories.</p>}
      <ListEditor
        items={value ?? []}
        onChange={onChange}
        itemLabel="Clip"
        addLabel="Add video clip"
        max={12}
        makeItem={() => ({ target: targets[0]?.value ?? 'lead', url: '', caption: '', play: 'before' })}
        renderItem={(clip, set) => {
          const known = targets.some((t) => t.value === clip.target);
          return (
            <>
              <label className="field">
                <span className="field__label">Plays at this story</span>
                <select className="select" value={clip.target} onChange={(e) => set({ ...clip, target: e.target.value })}>
                  {!known && <option value={clip.target}>(story no longer in this edition — choose another)</option>}
                  {targets.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <VideoUpload value={clip.url} onChange={(url) => set({ ...clip, url })} />
              <div className="grid-2">
                <TextField label="Caption (shown on screen)" value={clip.caption} onChange={(caption) => set({ ...clip, caption })} placeholder="Footage: UN General Assembly" />
                <label className="field">
                  <span className="field__label">How it plays</span>
                  <select className="select" value={clip.play} onChange={(e) => set({ ...clip, play: e.target.value })}>
                    <option value="before">Full screen with sound, before the story is read</option>
                    <option value="wall">On the studio video wall (silent) while the story is read</option>
                  </select>
                </label>
              </div>
            </>
          );
        }}
      />
    </fieldset>
  );
}

/**
 * The lead article as headline sections: each section has a headline, the
 * written response underneath it, and its own photos and videos.
 * Add as many headlines as you need; they read top to bottom.
 */
export function SectionsEditor({ value, onChange }) {
  const sections = value?.length ? value : [];
  return (
    <div className="sections-editor">
      <div className="sections-editor__head">
        <h4 className="mini-title">The article — headline by headline</h4>
        <p className="field__hint">
          Give each development its own headline, write your report underneath, and attach photos or videos to it. In the
          video report, the anchor reads each headline in turn and plays its videos at that moment.
        </p>
      </div>
      <ListEditor
        items={sections}
        onChange={onChange}
        labelFor={(i) => `Headline ${i + 1}`}
        addLabel="Add another headline"
        max={30}
        makeItem={emptySection}
        renderItem={(section, set) => (
          <div className="section-card">
            <TextField
              label="Headline"
              value={section.headline}
              onChange={(headline) => set({ ...section, headline })}
              placeholder="e.g. Europe on Edge"
            />
            <MarkdownField
              label="Response / report"
              rows={7}
              value={section.body_markdown}
              onChange={(body_markdown) => set({ ...section, body_markdown })}
              hint="Your writing for this headline. Blank line = new paragraph; cite sources with [1], [2]."
            />
            <div className="section-media">
              {(section.media ?? []).map((m, j) => {
                const update = (patch) => set({ ...section, media: section.media.map((x, k) => (k === j ? { ...x, ...patch } : x)) });
                const remove = () => set({ ...section, media: section.media.filter((_, k) => k !== j) });
                return (
                  <div key={j} className="section-media__item">
                    {m.type === 'video' ? (
                      <VideoUpload label={`Video ${j + 1}`} value={m.url} onChange={(url) => (url ? update({ url }) : remove())} />
                    ) : (
                      <ImageUpload label={`Photo ${j + 1}`} value={m.url} onChange={(url) => (url ? update({ url }) : remove())} />
                    )}
                    <TextField label="Caption" value={m.caption} onChange={(caption) => update({ caption })} placeholder={m.type === 'video' ? 'Footage: …' : 'What the photo shows'} />
                    <button type="button" className="btn btn--ghost btn--small btn--danger" onClick={remove}>
                      Remove {m.type === 'video' ? 'video' : 'photo'}
                    </button>
                  </div>
                );
              })}
              {(section.media ?? []).length < 8 && (
                <div className="section-media__add">
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => set({ ...section, media: [...(section.media ?? []), { type: 'image', url: '', caption: '' }] })}>
                    + Add photo
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => set({ ...section, media: [...(section.media ?? []), { type: 'video', url: '', caption: '' }] })}>
                    + Add video
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      />
    </div>
  );
}
