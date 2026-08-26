# Changelog

All notable changes to Advanced Calibre.

Repository: https://github.com/LiveAQuietLife/obsidian-calibre-plugin
Originally forked from https://github.com/caronchen/obsidian-calibre-plugin, which was abandoned
after its 1.0.8 release. Renamed to Advanced Calibre starting at 2.0.0.

---

## [2.0.1] — 2026-08-25

### Fixed
- **Ribbon icon disappeared after the rename.** The icon's registered id changed from `calibre`
  to `advanced-calibre`, but a settings file carried over from before the rename still pointed at
  the old id, which no longer resolves to anything. Now migrated automatically on load, once.
- **`Object.assign(DEFAULT_SETTINGS, ...)` was mutating the shared defaults object** instead of
  copying it. Long-standing bug, now fixed.

### Added
- **Plain "Open" command**, using whatever the Open In setting is configured to (full tab by
  default). Previously the only way to trigger the default behaviour was clicking the ribbon
  icon — if that icon failed to render, there was no command-palette equivalent.

---

### Changed
- **Renamed to Advanced Calibre.** New plugin id (`advanced-calibre`), new view type, new
  settings-tab heading, new ribbon tooltip, renamed classes and files throughout the source tree.
  This is a clean identity going forward — see the note above for lineage, which is otherwise
  not referenced anywhere in the plugin itself.
- Command ids simplified (e.g. `calibre-open-horizontally` → `open-horizontally`); Obsidian
  already namespaces commands under the plugin id, so the old prefix was redundant.
- Default view display text changed from "CALIBRE" to "Advanced Calibre" (user-configurable
  either way).

### Removed
- **PayPal donation block** in settings, which linked to the original author's donation page.

### Notes
- No `minAppVersion` change — this is a branding/identity release, not an API change.
- Existing local installs need their plugin folder renamed from the old plugin id to
  `advanced-calibre` to match the new manifest id.

---

## [1.0.11] — 2026-08-24

### Added
- **Metadata import.** New command "Import book metadata" fetches your library, opens a
  searchable picker, and writes a note with frontmatter, cover, links, and description. Uses
  calibre's `/ajax/books` and `/ajax/book/<id>` endpoints via `requestUrl`.
- **Folder autocomplete** on the Import Folder and Cover Folder settings.
- New settings: Library, Import Folder (default `Sources`), Filename Template, Download Cover
  Image, Cover Folder, Cover Width (default 350).

### Changed
- **`minAppVersion` raised from 1.0.0 to 1.4.11**, the first version providing
  `AbstractInputSuggest`. Determined by bisecting published typings, not from memory.
- TypeScript 4.4.4 → 5.4.5 and obsidian typings 0.14.8 → 1.4.11.

### Fixed
- **Typechecking was silently disabled.** `@types/node` syntax errors aborted `tsc` before it
  reached `src/`, so no source file had been typechecked. Fixed by the TypeScript bump and
  verified with a deliberate type error.
- Identifiers in frontmatter are now quoted; an unquoted ISBN parsed as a YAML number.
- Cover download failures now show a notice instead of failing silently.

### Notes
- Book links use calibre's own `calibre://view-book/<library>/<id>/<FORMAT>` scheme to open the
  desktop viewer. An earlier `file://` link was removed: Windows hands ebook files to calibre,
  which responds by trying to **add** them to the library, producing duplicate-book prompts.
- **Known issue:** calibre tags containing spaces render as invalid tags in Obsidian. Unresolved.

---

## [1.0.10] — 2026-08-24

### Added
- **Unreachable-server detection.** If the Content server can't be reached, the pane now shows a
  message naming the address it actually tried, instead of sitting blank. Implemented with
  Obsidian's `requestUrl`, which runs outside browser CORS restrictions — any HTTP response
  counts as reachable, including a 401 (that's an auth problem, not a connectivity one).
  Typical latency ~2s, which is the OS TCP connection attempt timing out.
- **"Full tab" option** in the Open In setting (formerly "Split Direction"). Calibre opens as its
  own tab rather than forcing a split. **Now the default** for anyone who hasn't explicitly
  chosen a split direction; existing saved preferences are preserved.

### Changed
- Settings label "Split Direction" → "Open In", with options relabeled to "Full tab",
  "Horizontal split", "Vertical split".
- `onClose()` now sets a `closed` flag so an in-flight reachability probe can't paint a message
  onto an already-closed pane.

### Notes
- No `minAppVersion` change. `requestUrl` is present in the pinned typings at 0.14.8, well below
  the current 1.0.0 floor. `getLeaf('tab')` arrived with Obsidian's tabs release (believed
  0.15.0), also below the floor. No new `versions.json` entry needed.
- The "Open horizontally" / "Open vertically" commands still force a split regardless of the
  setting.

---

## [1.0.9] — 2026-08 (built and tested locally, not released)

### Added
- **Local IP override setting.** Escape hatch for when auto-detection picks the wrong network
  adapter — common with VPNs, Docker, WSL, or Hyper-V. Addresses the likely cause of issues
  #4/#6, though the root cause is only partly confirmed and isn't reproducible on the dev machine.
- **`extractHost()` helper**, accepting full URLs, `host:port`, or bare IPs/hostnames.
- **Blank-address message** replacing the previous silent empty pane, using a `.calibre-message`
  class with `var(--text-muted)` for theme compatibility.
- **Version stamping** in the esbuild banner, read from `package.json`.

### Changed
- `splitActiveLeaf` → `getLeaf('split', direction)`. Future-proofing against a deprecated API;
  the old call was **not** actually broken on Obsidian 1.13.7.
- `minAppVersion` 0.12.0 → 1.0.0.

---

## [1.0.8] and earlier — upstream (caronchen)

Last upstream release. Notable inherited fix:

- **PR #15** (StanczakDominik, Aug 2023) added `allow-downloads` and `allow-popups` to the
  iframe sandbox, fixing issue #14 where books wouldn't open. The issue remains open upstream
  only because it was never closed.
