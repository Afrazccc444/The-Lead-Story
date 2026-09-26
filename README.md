# The Lead Story

A weekly newsletter on global politics, written by student editors for an IB Diploma Programme CAS project.

It is free to run: there are no paid services, no AI, and no database account. Writers sign in to the admin app, write each edition by hand with a live preview, list their sources in a bibliography, and publish with one click.

## What's in each edition

| Section | What you write |
|---|---|
| **The Lead Story** | Kicker, headline, subheadline, deck, byline, the article itself, optional key figures, historical context and "what to watch" |
| **Around the World** | Short news items for the Americas, Europe/Middle East/Africa, Asia-Pacific and the Global South |
| **Data & Trends** *(optional)* | Simple bar charts: type `Label \| value`, one per line |
| **The Editor's Note** *(optional)* | A personal reflection |
| **Bibliography** | Every source (author, title, publication, dates, URL), formatted APA-style |

**Citations:** type `[1]` anywhere in your text to cite bibliography entry 1, or `[1, 3]` to cite several. Readers see small numbered links that jump to the bibliography.

**Formatting the article:** leave a blank line between paragraphs, start a line with `## ` for a subheading, and use `**bold**` or `*italic*` for emphasis.

## Running it on your computer

You need **Node.js 22.13 or newer** (`winget install OpenJS.NodeJS.LTS`, or download it from <https://nodejs.org>). Nothing else needs installing.

```bash
npm install     # first time only
npm run dev     # starts everything
```

| Link | What it is |
|---|---|
| <http://localhost:5173> | The public newsletter |
| <http://localhost:5173/admin> | The admin app (writers) |
| <http://localhost:4000/api/health> | The server (should show `{"ok":true}`) |

**First visit to `/admin`:** you'll be asked to create the admin password. You only do this once, and you then stay signed in on that browser for 30 days. You can change the password later under **Settings**; changing it signs out every other device.

Keep the terminal running while you use the site. Press `Ctrl+C` to stop.

## Writing and publishing an edition

1. Go to `/admin` and click **+ New edition**.
2. Write in the form on the left. The preview on the right shows exactly what readers will see (on small screens, switch between **Write** and **Preview**).
3. Click **Save** (or press `Ctrl+S`) as you go. The editor warns you if you try to leave with unsaved changes.
4. Click **Publish**. The edition becomes the front page, and you get a shareable link like `/edition/issue-3`.
5. Past editions are listed at `/archive`. You can still edit a published edition to fix mistakes, and saving updates it straight away.

## Where your writing is stored

Everything is saved in one file: `server/data/lead-story.db`. **Back up this file regularly**, for example by copying it to Google Drive or OneDrive. To move the site to another computer, copy the file into the same folder there.

## Putting it online

```bash
npm install
npm run build        # builds the website
npm start            # serves the site and admin app on port 4000
```

Choose a host that gives you **persistent storage**, so the database file survives restarts. Set `DATA_DIR` to that storage folder and `NODE_ENV=production`. For example:

- **Render**: add a persistent disk mounted at `/var/data` and set `DATA_DIR=/var/data`. Disks require a paid instance; the free tier deletes files on each restart.
- **Railway**: add a volume and point `DATA_DIR` at it.
- **Your own always-on computer or Raspberry Pi**: run `npm start` and share the site through a free tunnel such as Cloudflare Tunnel.

Optional settings are listed in [server/.env.example](server/.env.example).

## Project structure

```
server/src/
  index.js          Express server (also serves the built website)
  db.js             SQLite database (built into Node — nothing to install)
  editions.js       create / edit / publish / delete editions
  routes/           public, auth (setup/login) and admin API
client/src/
  pages/            public site: latest edition, archive, single edition
  admin/            sign-in / first-time setup, editions list, editor, settings
  components/newsletter/   masthead, lead story, briefing, charts, bibliography
  styles/           editorial design (paper, ink, one accent colour)
```

## Security

- The password is stored only as a bcrypt hash, and login attempts are rate-limited.
- Sessions use an httpOnly `SameSite=Strict` cookie.
- The articles you write never render raw HTML, so pasted code can't run on readers' browsers.
