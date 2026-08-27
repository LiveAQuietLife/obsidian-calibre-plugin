# Advanced Calibre

An Obsidian plugin that embeds your calibre library as a live pane inside Obsidian, and imports book metadata into notes you can link, tag, and search alongside the rest of your vault.

Originally forked from [caronchen/obsidian-calibre-plugin](https://github.com/caronchen/obsidian-calibre-plugin), which was abandoned after its 1.0.8 release. Renamed to Advanced Calibre starting at 2.0.0. This is a personal fork — it isn't submitted to Obsidian's Community Plugins list, and isn't affiliated with or endorsed by the original author.

## What it does

- **Live calibre view.** Opens calibre's Content Server in a pane inside Obsidian — full tab, or split alongside your notes — so you can browse and read without leaving the app.
- **Metadata import.** Picks a book from your library (fuzzy search by title/author) and writes a note for it: frontmatter, cover image, and tags.
- **Two ways to shape the note.** A built-in four-section template, or point it at your own Markdown file and it fills in the tokens — including in frontmatter.

## Installing

Obsidian only shows Community Plugins list submissions in its in-app browser, so this has to be installed manually:

1. Download `main.js`, `manifest.json`, and `styles.css` from this repo (either a tagged [Release](../../releases), or by building from source — see below).
2. Copy all three into `VaultFolder/.obsidian/plugins/advanced-calibre/` in your vault (create the folder if it doesn't exist).
3. Reload Obsidian, then enable **Advanced Calibre** under Settings —> Community plugins —> Installed plugins.

This plugin is desktop-only — calibre's Content Server iframe and `AbstractInputSuggest` folder/file pickers aren't available on mobile.

## Settings

| Section | What it controls |
|---|---|
| **Server Address** | Your calibre Content Server URL, e.g. `http://localhost:8080` |
| **Local IP override** | Fixes auto-detection picking the wrong network adapter — common with VPNs, Docker, or WSL |
| **Open In** | Full tab, horizontal split, or vertical split |
| **Library** | Which calibre library to import from (as it appears in calibre's library chooser) |
| **Import Folder / Filename Template** | Where imported notes go, and how they're named |
| **Open Note After Import** | Jumps to the new note automatically after import |
| **Tag Space Handling / Max Tags** | See [Tag handling](#tag-handling) below |
| **Note Generation** | Built-in or Custom Template File — see below |
| **Download Cover Image / Cover Folder / Cover Width** | Whether covers are saved into the vault, and how they're displayed |

## Tag handling

calibre tags are free text, and commonly contain spaces or punctuation that Obsidian tags can't — a tag like `old testament` would otherwise render struck through as invalid. **Tag Space Handling** controls how spaces are resolved:

- **Hyphenate** — `old testament` —> `old-testament`
- **CamelCase** — `old testament` —> `OldTestament`
- **Leave as-is** — no conversion (may not render as a valid tag)

Beyond spaces, anything outside letters, numbers, underscores, hyphens, and slashes is stripped — calibre permits apostrophes and other punctuation that would still break a tag even after space handling. **Max Tags** caps how many tags each imported book carries over, keeping the earliest ones calibre returns (set to 0 for no limit).

## Note Generation: Built-in vs. Custom Template File

### Built-in

The default. Frontmatter is fixed (protecting YAML validity), but four body sections are editable in settings:

- **Heading Template** — default `# {{title}}`
- **Byline Template** — default `{{byline}}`, only rendered when a byline can be built
- **Cover Template** — default `![[{{cover}}|{{coverWidth}}]]`, only rendered when a cover was downloaded
- **Description Template** — default `## Description\n\n{{description}}`, only rendered when the book has one

### Custom Template File

Point this at any `.md` file in your vault, and the importer reads it raw and substitutes tokens through the **entire file, including frontmatter** — useful if you already have your own note template with fields calibre doesn't know about (reading status, personal rating, project links, etc.).

**Plain tokens** — use anywhere in the file:

| Token | Value |
|---|---|
| `{{title}}` | Book title |
| `{{author}}` | Sort-name format ("Last, First") |
| `{{authors}}` | Display-order list ("First Last, First Last") |
| `{{year}}` | Publication year only |
| `{{publisher}}` | Publisher name |
| `{{series}}` | Series name |
| `{{seriesIndex}}` | Position in series |
| `{{byline}}` | Pre-built "Authors · Publisher · Year," missing pieces dropped |
| `{{cover}}` | Vault path to the downloaded cover (empty if none) |
| `{{coverWidth}}` | Your configured Cover Width setting |
| `{{description}}` | calibre's comments, converted from HTML to Markdown |
| `{{pages}}` | Page count, if calibre has that custom column |
| `{{isbn}}` | ISBN, pulled from identifiers |
| `{{added}}` | Date added to your calibre library (YYYY-MM-DD) |
| `{{calibreUuid}}` | calibre's internal UUID |
| `{{calibreId}}` | calibre's numeric book ID |

**`_yaml` variants** — use these instead of the plain token when the value sits in a frontmatter value position (e.g. `title: {{title_yaml}}`). They're pre-quoted whenever the raw value would otherwise break YAML — a colon in a title, for instance:

`{{title_yaml}}` · `{{author_yaml}}` · `{{authors_yaml}}` · `{{publisher_yaml}}` · `{{series_yaml}}`

**Whole-line block tokens** — must sit alone on their own line. They expand to real content, or disappear completely (the token *and* its line) when there's nothing to show, so you never end up with an empty `tags:` line for a book with no tags:

- `{{tags_yaml}}` —> `tags: [a, b, c]`
- `{{languages_yaml}}` —> `languages: [eng]`
- `{{identifiers_yaml}}` —> one line per identifier calibre has (isbn, asin, goodreads, etc.)

**Example template:**

```markdown
---
title: {{title_yaml}}
author: {{author_yaml}}
type: book
status: 
{{tags_yaml}}
{{languages_yaml}}
{{identifiers_yaml}}
---

# {{title}}

{{byline}}

![[{{cover}}|{{coverWidth}}]]

## Description

{{description}}
```

Static lines you write yourself — `type: book`, `status:` — pass through untouched. Only recognized `{{tokens}}` get replaced.

**Known gap:** there's currently no token for the full publication date, only `{{year}}`. If you need the full date, that's a small planned addition, not yet available.

## Known limitations

### Authentication is not supported

If your calibre Content Server requires a username and password, this plugin can't supply it. Neither the live view nor metadata import will work against a password-protected server. Metadata import fails with a clear error rather than a silent one; the live view will show calibre's own login page inside the pane, with no way to submit credentials through it that persist.

This is a deliberate scope decision, not an oversight, and it's been researched rather than assumed. The plugin's live view is just an `<iframe>` pointing at calibre's Content Server, everything inside it is calibre's own page, not this plugin's. An iframe's `src` can't carry a custom `Authorization` header, and embedding `username:password@host` directly in the URL, the obvious workaround, is unreliable in Electron/Chromium, which restrict userinfo-in-URL for security reasons (it's a classic phishing vector).

This isn't a hypothetical: a related fork ([shibco/obsidian-calibre-plugin](https://github.com/shibco/obsidian-calibre-plugin)) tried exactly this approach — username/password settings fields, credentials embedded into the iframe URL and shipped it. It saw zero adoption and stores the password in plaintext in the vault's settings file. The two projects that *did* solve calibre auth in Obsidian ([qvanphong/calibre-opds-obsidian](https://github.com/qvanphong/calibre-opds-obsidian) and [p24l/calibre-bridge](https://github.com/p24l/calibre-bridge)) both did it by abandoning the iframe entirely — building a real OPDS/API client that attaches proper auth headers outside the browser sandbox, and rendering results as native Obsidian elements instead of an embedded page.

That's a legitimate way to fix this, but it's a rewrite of the plugin's reading pane, not a small patch. It hasn't been undertaken here. **If your Content Server has no login enabled, none of this affects you.**

### Most display issues aren't this plugin's problem

Since the live view is just an iframe onto calibre's own Content Server page, almost everything you see inside it — the reader, the library grid, any rendering quirks — belongs to calibre, not this plugin. The practical test: if something reproduces in a plain desktop browser pointed at the same server address, it's calibre's issue to fix, not this plugin's.

## Development

```bash
npm install
npm run dev     # esbuild in watch mode
npm run build   # production build
```

Manual test loop: build, copy `main.js`, `manifest.json`, and `styles.css` into your vault's plugin folder, then reload Obsidian (or disable/re-enable the plugin) to pick up changes.

## Credits

Originally created by [caronchen](https://github.com/caronchen/obsidian-calibre-plugin). Renamed and continued independently as Advanced Calibre starting at 2.0.0.

## License

MIT — see [LICENSE](./LICENSE).
