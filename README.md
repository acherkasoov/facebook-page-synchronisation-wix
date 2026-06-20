# FB Page Sync — for Wix (Velo)

Mirror posts from your **Facebook Page** onto your **Wix site**. This is the Wix
counterpart of the WordPress plugin in [`../fb-page-sync`](../fb-page-sync).

> ⚠️ **Wix is not WordPress.** There is no installable “plugin.” This is a
> **[Velo](https://www.wix.com/velo) (Wix's built-in JavaScript platform)**
> solution that you add to *your own* Wix site through the Editor's **Dev Mode**.
> You paste these files into Velo's file tree — you don't upload a ZIP.

---

## How it differs from the WordPress version

| | WordPress plugin | Wix (Velo) |
|---|---|---|
| Install | Upload ZIP / drop in `wp-content/plugins` | Turn on Dev Mode, paste files into Velo |
| Stores posts as | WordPress **posts** | Items in a **CMS Collection** (`FacebookPosts`), shown via a Repeater |
| Schedule | WP-Cron, every ≥5 min | Velo scheduled job, **every 1 hour (Wix minimum)** |
| Runs | On cron/visit | **Only on the *published* site** (not in Preview) |
| Settings UI | Admin settings page | Values stored in **Secrets Manager** |
| Token & FB setup | Same Facebook App + Page token | **Same** — see below |

Creating native Wix **Blog** posts via code isn't reliably supported, so this
uses a **CMS collection + Repeater**, which is the robust, fully-supported path.

---

## What's in this folder

```
fb-page-sync-wix/
├─ README.md
├─ backend/
│  ├─ facebookSync.js     ← core sync logic (→ Velo Backend)
│  ├─ sync.jsw            ← manual "Sync now" trigger (→ Velo Backend)
│  └─ jobs.config         ← hourly scheduled job (→ Velo Backend)
└─ page-code/
   └─ facebookFeed.page.js ← example Repeater code (→ a page's code panel)
```

---

## Prerequisites

- A Wix site on a **Premium plan** (external `fetch` + scheduled jobs run on the
  live site, which requires publishing with a connected domain/premium).
- **Dev Mode (Velo)** enabled: in the Editor, top bar → **Dev Mode → Turn on Velo**.

---

## 1. Get your Facebook credentials

This is **identical** to the WordPress version. Follow section 2 of the main guide:
[`../fb-page-sync` → “Get your Facebook credentials”](../README.md#2-get-your-facebook-credentials-the-important-part).

In short, you need:
- your **Page ID**, and
- a **long-lived Page Access Token** with `pages_read_engagement`,
both taken from `me/accounts → data[]` in the Graph API Explorer.

---

## 2. Store the credentials in Secrets Manager

In the Wix dashboard: **Settings → Secrets Manager → Add Secret**. Add two:

| Secret name | Value |
|---|---|
| `fbPageId` | your Facebook Page ID |
| `fbPageToken` | your long-lived Page access token |

(The code reads these with `getSecret(...)`, so the token is never in your page code.)

---

## 3. Create the CMS collection

In the Editor: **CMS (Content Manager) → Create Collection**, name it
**`FacebookPosts`**. Add these fields (the **Field Key** must match exactly):

| Field Key | Type | Purpose |
|---|---|---|
| `title` | Text | Post title (derived from first line) |
| `content` | Text (long) | Post body text |
| `fbPostId` | Text | Facebook post ID (de-dupe key) |
| `permalink` | Text / URL | Link to the original Facebook post |
| `image` | Image | Imported image (Wix media) |
| `imageUrl` | Text | External image URL (fallback) |
| `publishedDate` | Date and Time | Original Facebook post time |

Set the collection's permissions so it can be read by your site visitors
(**Content Manager → … → Permissions & Privacy →** read = *Anyone*). The backend
code writes with `suppressAuth`, so write access can stay admin-only.

---

## 4. Add the backend files

In the Velo sidebar, open the **Backend** section (the `backend/` folder) and add:

1. **`facebookSync.js`** — paste from [`backend/facebookSync.js`](backend/facebookSync.js).
2. **`sync.jsw`** — paste from [`backend/sync.jsw`](backend/sync.jsw).
3. **`jobs.config`** — paste from [`backend/jobs.config`](backend/jobs.config).
   (If `jobs.config` already exists, merge the `jobs` array.)

The job is set to `"0 * * * *"` — the top of every hour. **One hour is the
shortest interval Wix allows.**

---

## 5. Display the posts on a page

1. Add a **Repeater** to a page and design one item with:
   - an **Image** → ID `postImage`
   - a **Text** for the title → ID `titleText`
   - a **Text** for the body → ID `contentText`
   - a **Button/Text** link → ID `originalLink`
   - name the Repeater → ID `postsRepeater`
2. Open the page's **code panel** and paste
   [`page-code/facebookFeed.page.js`](page-code/facebookFeed.page.js).
3. (Optional) Add a **Button** with ID `syncNowButton` to trigger a manual sync
   while testing. Keep it on a members-only/hidden page in production.

> Alternatively you can skip the code and connect the Repeater to a **Dataset**
> in the Editor, mapping fields visually. The code approach is shown because it
> also handles the external-image fallback.

---

## 6. Publish and test

- **Publish the site.** Scheduled jobs do **not** run in Preview — only on the
  published site.
- For an immediate test, click your **Sync now** button (step 5.3), or wait for
  the next hour boundary.
- Check the **`FacebookPosts`** collection in the CMS — new items should appear.
- Watch **Velo → Site Monitoring / Logs** for the `FB Page Sync: fetched …,
  imported …` messages (and any Facebook error like `#190`, `#210`, `#283`).

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Nothing imports on schedule | Did you **publish**? Jobs don't run in Preview. Check Velo logs. |
| `Missing secrets` in logs | Add `fbPageId` / `fbPageToken` in Secrets Manager (exact names). |
| Facebook errors `#100 / #210 / #283 / #190` | Same meanings as the WordPress guide — see the [main troubleshooting table](../README.md#troubleshooting). |
| Images don't show | Image import can fail for some URLs; the code falls back to `imageUrl`. Ensure the Image element ID is `postImage`. |
| Want faster than hourly | Not possible on Wix — 1 hour is the platform minimum. Use the manual **Sync now** button for on-demand updates. |
| Collection write errors | Confirm the collection is named `FacebookPosts` and field keys match step 3. |

---

## Notes & limitations

- **Hourly minimum** for scheduled jobs, and jobs run **only on the published site** — both are Wix platform limits, not something the code can change.
- Posts are stored as **CMS items**, not native Wix Blog posts.
- De-dupe is by `fbPostId`, so re-running a sync never creates duplicates.
- The token lives in **Secrets Manager**, not in page code.
- Graph API version is pinned to `v19.0` in `backend/facebookSync.js`.
