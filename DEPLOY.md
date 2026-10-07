# Putting The Lead Story online 24/7 (free, on Google Cloud)

This guide puts the newsletter on a small free server from Google, so the site stays
online even when your own computer is off. It takes about 30–45 minutes the first time.

**What goes where**

| Thing | Where it lives |
|---|---|
| The code (the site itself) | **GitHub** — like a cloud folder for code |
| The running site | A free **Google Cloud** server (an "e2-micro" machine) |
| The web address | A free **DuckDNS** name, e.g. `theleadstory.duckdns.org` |
| Articles, photos, password | On the server's disk, backed up automatically every night |

You'll need: a Google account, a GitHub account, and a bank card for Google's sign-up
check. Google does not charge the card while you stay inside the free limits below.

---

## Step 1 — Put the code on GitHub

1. Sign in (or sign up) at <https://github.com>.
2. Click **+** (top right) → **New repository**.
   - Name: `the-lead-story`
   - Choose **Public** (the code has no passwords or articles in it — those stay on the server).
   - Do **not** tick "Add a README".
   - Click **Create repository**.
3. Tell Claude the address it shows (like `https://github.com/your-name/the-lead-story`).
   Claude will upload the code; a browser window may pop up asking you to sign in to GitHub — approve it.

## Step 2 — Create the free Google Cloud server

1. Go to <https://console.cloud.google.com> and sign in. Accept the terms and set up billing
   (this is the card check). Google may offer a $300 free trial too — that's fine.
2. In the search bar type **Compute Engine** → open it → click **Enable** if asked (takes a minute).
3. Click **Create instance** and set **exactly** these (anything else may cost money):

   | Setting | Value |
   |---|---|
   | Name | `lead-story` |
   | Region | **us-central1 (Iowa)**, **us-west1 (Oregon)** or **us-east1 (South Carolina)** — only these are free |
   | Machine series / type | **E2** → **e2-micro** |
   | Boot disk → Change | **Ubuntu**, version **Ubuntu 24.04 LTS (x86/64)**, disk type **Standard persistent disk**, size **30 GB** |
   | Firewall | Tick **Allow HTTP traffic** and **Allow HTTPS traffic** |

4. Click **Create**. When it's ready, copy its **External IP** (numbers like `34.123.45.67`).

**Protect yourself from surprise bills:** search **Budgets & alerts** → **Create budget** →
amount **$1** → it emails you if anything ever starts costing money. Check the **Billing**
page once after a few days; Google sometimes bills a few cents for the server's public IP
address or for traffic above 1 GB a month.

## Step 3 — Get a free web address

1. Go to <https://www.duckdns.org> and sign in (e.g. with your GitHub or Google account).
2. Type a name (e.g. `theleadstory`) and click **add domain**.
3. In the **current ip** box next to it, paste the server's **External IP** and click **update ip**.
4. Copy your **token** (the long code at the top of the page).

## Step 4 — Install the newsletter on the server

1. Back in Google Cloud → **Compute Engine → VM instances**, click **SSH** next to `lead-story`.
   A black terminal window opens in your browser — this is the server.
2. Copy and paste these two lines (replace the parts in `< >`), pressing Enter after each:

   ```bash
   git clone https://github.com/<your-github-name>/the-lead-story.git
   bash the-lead-story/deploy/setup-server.sh <your-name>.duckdns.org <your-duckdns-token>
   ```

3. Wait about 5–10 minutes while it installs everything. When it asks, type your
   **admin password** (nothing appears on screen while you type — that's normal) and press Enter.
4. When you see **✔ The Lead Story is online**, open `https://<your-name>.duckdns.org` 🎉
   The Editor's desk is at `https://<your-name>.duckdns.org/admin`.

From now on the site restarts by itself if it crashes and starts automatically if Google
restarts the server. You can close the terminal window.

---

## Later: updating the site

When Claude changes the code, it uploads the new version to GitHub. Then open the server's
**SSH** window and run:

```bash
bash ~/the-lead-story/deploy/update.sh
```

Articles, photos and the password are never touched by updates.

## Backups and restoring

Every night at 03:15 (server time) the server saves a copy of all articles and photos in
`~/lead-story-data/backups/`, one folder per day, kept for 14 days. If something is deleted
by mistake, ask Claude to help you restore that day's copy.

## Changing the admin password

In the server's **SSH** window:

```bash
cd ~/the-lead-story/server && read -rsp 'New password: ' PW && echo && printf '%s' "$PW" | node src/tools/set-password.js; unset PW
```

Type the new password (nothing shows while typing) and press Enter. This also works if you
forget the password.

## If something goes wrong

- **Site doesn't open:** wait a minute (the HTTPS certificate is being issued), check the
  DuckDNS IP matches the server's External IP, and that HTTP/HTTPS were ticked in Step 2.
- **See the server's error log:** `sudo journalctl -u lead-story -n 50`
- **Restart the site:** `sudo systemctl restart lead-story`
