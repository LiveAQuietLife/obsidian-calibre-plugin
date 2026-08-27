import { App, Notice, TFile, htmlToMarkdown, normalizePath, requestUrl } from 'obsidian';
import { AdvancedCalibrePluginSettings, DEFAULT_SETTINGS, TagSpaceHandling } from './settings';

/**
 * The subset of calibre's /ajax/book/<id> response we care about. calibre returns
 * a great deal more; everything here is optional because custom columns, series
 * and identifiers are frequently absent.
 */
export interface CalibreBook {
  application_id: number;
  uuid?: string;
  title?: string;
  authors?: string[];
  author_sort?: string;
  publisher?: string;
  pubdate?: string;
  timestamp?: string;
  series?: string;
  series_index?: number;
  tags?: string[];
  languages?: string[];
  comments?: string;
  identifiers?: Record<string, string>;
  formats?: string[];
  format_metadata?: Record<string, { path?: string }>;
  [key: string]: unknown;
}

/** Characters Windows forbids in filenames, plus control characters. */
// eslint-disable-next-line no-control-regex
const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

/** Leaves room for the folder path and the `.md` extension inside Windows' limit. */
const MAX_FILENAME_LENGTH = 120;

/**
 * Strips characters that cannot appear in a filename on Windows, collapses the
 * whitespace this leaves behind, and truncates over-long names. calibre titles
 * routinely contain colons ("The Parables: Jewish Tradition and...").
 */
export function sanitiseFilename(value: string): string {
  const cleaned = value
    .replace(ILLEGAL_FILENAME_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[. ]+|[. ]+$/g, '')
    .trim();

  if (cleaned.length <= MAX_FILENAME_LENGTH) {
    return cleaned;
  }

  return cleaned.slice(0, MAX_FILENAME_LENGTH).trim();
}

/** Year portion of an ISO date, or an empty string when calibre has no date. */
function yearOf(date?: string): string {
  if (!date) {
    return '';
  }

  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? '' : String(parsed.getUTCFullYear());
}

/** Date portion of an ISO timestamp, for frontmatter. */
function dateOf(date?: string): string {
  if (!date) {
    return '';
  }

  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

/**
 * Substitutes `{{placeholder}}` tokens in a template string against a values
 * map. Unknown tokens are replaced with an empty string rather than left in
 * place. Shared by the filename template and every Note Layout template.
 */
export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => values[key] ?? '');
}

/**
 * Substitutes `{{placeholder}}` tokens in the filename template. Unknown tokens
 * are replaced with an empty string rather than left in the filename.
 */
export function applyFilenameTemplate(template: string, book: CalibreBook): string {
  const values: Record<string, string> = {
    title: book.title ?? 'Untitled',
    author: book.author_sort ?? book.authors?.join(', ') ?? 'Unknown',
    authors: book.authors?.join(', ') ?? book.author_sort ?? 'Unknown',
    year: yearOf(book.pubdate),
    publisher: book.publisher ?? '',
    series: book.series ?? '',
    id: String(book.application_id),
  };

  const name = sanitiseFilename(renderTemplate(template, values));

  // A template that resolves to nothing would produce an unnamed file.
  return name || sanitiseFilename(values.title) || `calibre-${book.application_id}`;
}

/**
 * Converts one calibre tag into a valid Obsidian tag. calibre tags are free
 * text and commonly contain spaces (Obsidian tags can't) and punctuation like
 * apostrophes (which survive space-handling alone but still break the tag).
 */
export function sanitiseTag(tag: string, style: TagSpaceHandling): string {
  const trimmed = tag.trim();

  if (style === 'none') {
    return trimmed;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  let joined: string;

  if (words.length <= 1) {
    joined = trimmed;
  } else if (style === 'camelCase') {
    joined = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  } else {
    joined = words.join('-');
  }

  // Strip anything outside letters/numbers/underscore/hyphen/forward-slash —
  // calibre permits apostrophes and other punctuation in tags that would
  // otherwise still break Obsidian tags even after space-handling.
  return joined
    .replace(/[^\p{L}\p{N}_\-/]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Applies tag space-handling and the Max Tags cap to a book's tag list. */
export function processTags(tags: string[] | undefined, settings: AdvancedCalibrePluginSettings): string[] {
  if (!tags || tags.length === 0) {
    return [];
  }

  const style = settings.tagSpaceHandling ?? 'hyphenate';
  const cap = settings.maxTags ?? 10;
  const limited = cap > 0 ? tags.slice(0, cap) : tags;

  return limited.map((tag) => sanitiseTag(tag, style));
}

/** Quotes a YAML scalar when it contains anything that would break parsing. */
function yamlScalar(value: string): string {
  return /^[\w][\w .,'&()-]*$/.test(value) ? value : JSON.stringify(value);
}

/** Renders a YAML list, or omits the key entirely when the list is empty. */
function yamlList(key: string, values?: string[]): string {
  if (!values || values.length === 0) {
    return '';
  }

  return `${key}: [${values.map(yamlScalar).join(', ')}]\n`;
}

/** Renders a scalar key, or omits it when there is no value. */
function yamlKey(key: string, value?: string): string {
  return value ? `${key}: ${yamlScalar(value)}\n` : '';
}

/**
 * Matches a `{{tags_yaml}}`, `{{languages_yaml}}`, or `{{identifiers_yaml}}`
 * token sitting alone on its own line (whitespace either side is fine). These
 * are whole-line block tokens: they expand to zero, one, or several lines
 * depending on the book's data, and disappear entirely — including the line
 * itself and its line break — when there's nothing to show, rather than
 * leaving a blank line behind.
 */
const BLOCK_TOKEN_PATTERN = /^[ \t]*\{\{\s*(tags_yaml|languages_yaml|identifiers_yaml)\s*\}\}[ \t]*\r?\n?/gm;

/**
 * Computes the expansion for each whole-line block token. Each value already
 * ends with its own trailing newline per line (or is an empty string), so it
 * can replace the token's line directly without extra joining logic.
 */
function buildBlockValues(book: CalibreBook, settings: AdvancedCalibrePluginSettings): Record<string, string> {
  let identifiers = '';
  for (const [scheme, value] of Object.entries(book.identifiers ?? {})) {
    if (value) {
      identifiers += `${scheme}: ${JSON.stringify(String(value))}\n`;
    }
  }

  return {
    tags_yaml: yamlList('tags', processTags(book.tags, settings)),
    languages_yaml: yamlList('languages', book.languages),
    identifiers_yaml: identifiers,
  };
}

/**
 * Builds the full token set available to a Custom Template File: plain values
 * for use anywhere in the body, plus `_yaml`-suffixed variants that are
 * pre-quoted where needed so they're safe to drop directly into a frontmatter
 * value position (e.g. `title: {{title_yaml}}`).
 */
function buildCustomValues(
  book: CalibreBook,
  coverPath: string | null,
  settings: AdvancedCalibrePluginSettings
): Record<string, string> {
  const title = book.title ?? 'Untitled';
  const displayAuthors = book.authors?.join(', ') ?? book.author_sort ?? '';
  const year = yearOf(book.pubdate);
  const byline = [displayAuthors, book.publisher, year].filter(Boolean).join(' · ');
  const description = book.comments ? htmlToMarkdown(book.comments).trim() : '';
  const pages = book['pages'];
  const isbn = book.identifiers?.['isbn'] ?? book.identifiers?.['ISBN'] ?? '';

  return {
    title,
    author: book.author_sort ?? displayAuthors,
    authors: displayAuthors,
    year,
    publisher: book.publisher ?? '',
    series: book.series ?? '',
    seriesIndex: typeof book.series_index === 'number' ? String(book.series_index) : '',
    byline,
    cover: coverPath ?? '',
    coverWidth: String(settings.coverWidth ?? 350),
    description,
    pages: typeof pages === 'number' ? String(pages) : '',
    isbn,
    added: dateOf(book.timestamp),
    calibreUuid: book.uuid ?? '',
    calibreId: String(book.application_id),
    // _yaml variants: pre-quoted where the value could otherwise break YAML
    // parsing (colons, quotes, leading zeros). Missing optional fields render
    // as an empty string rather than `""`, so an unused frontmatter line like
    // `series: {{series_yaml}}` comes out as a harmless empty (null) value
    // instead of a visible pair of quotes.
    title_yaml: yamlScalar(title),
    author_yaml: yamlScalar(book.author_sort ?? displayAuthors),
    authors_yaml: yamlScalar(displayAuthors),
    publisher_yaml: book.publisher ? yamlScalar(book.publisher) : '',
    series_yaml: book.series ? yamlScalar(book.series) : '',
  };
}

/**
 * Renders a Custom Template File's raw content: whole-line block tokens are
 * expanded first (since they operate on entire lines), then every remaining
 * `{{token}}` — plain or `_yaml` — is substituted the same way the built-in
 * templates work.
 */
export function renderCustomTemplate(
  template: string,
  values: Record<string, string>,
  blockValues: Record<string, string>
): string {
  const withBlocksExpanded = template.replace(BLOCK_TOKEN_PATTERN, (_match, key: string) => blockValues[key] ?? '');
  return renderTemplate(withBlocksExpanded, values);
}

export class AdvancedCalibreImporter {
  constructor(private app: App, private settings: AdvancedCalibrePluginSettings) {}

  /** The Content server address, with any trailing slash removed. */
  private get host(): string {
    return (this.settings.address ?? '').trim().replace(/\/+$/, '');
  }

  private get library(): string {
    return (this.settings.importLibrary ?? '').trim() || 'Calibre_Library';
  }

  /**
   * Fetches every book in the library in a single request. calibre returns full
   * metadata for all of them, so this is one round trip rather than one per book.
   */
  async fetchLibrary(): Promise<CalibreBook[]> {
    const response = await requestUrl({
      url: `${this.host}/ajax/books?library_id=${encodeURIComponent(this.library)}`,
      method: 'GET',
      throw: false,
    });

    if (response.status === 401) {
      throw new Error('The Content server requires a username and password, which metadata import cannot supply yet.');
    }

    if (response.status !== 200) {
      throw new Error(`The Content server returned ${response.status}.`);
    }

    const raw = response.json as Record<string, CalibreBook | null>;
    return Object.values(raw).filter((book): book is CalibreBook => book !== null);
  }

  /**
   * Builds the note body for a book. Frontmatter is always hardcoded to
   * protect YAML validity; the body sections (heading, byline, cover,
   * description) are driven by the user-editable Note Layout templates.
   */
  buildNote(book: CalibreBook, coverPath: string | null): string {
    const title = book.title ?? 'Untitled';
    const displayAuthors = book.authors?.join(', ') ?? book.author_sort ?? '';
    const year = yearOf(book.pubdate);

    let frontmatter = '---\n';
    frontmatter += yamlKey('title', title);
    frontmatter += yamlKey('author', book.author_sort ?? displayAuthors);
    frontmatter += yamlKey('publisher', book.publisher);
    frontmatter += yamlKey('published', dateOf(book.pubdate));
    frontmatter += yamlList('tags', processTags(book.tags, this.settings));
    frontmatter += yamlList('languages', book.languages);

    // calibre exposes custom columns at the top level using their label.
    const pages = book['pages'];
    if (typeof pages === 'number') {
      frontmatter += `pages: ${pages}\n`;
    }

    // Always quoted: an unquoted ISBN parses as a number, which loses leading
    // zeros and can exceed safe integer precision.
    for (const [scheme, value] of Object.entries(book.identifiers ?? {})) {
      if (value) {
        frontmatter += `${scheme}: ${JSON.stringify(String(value))}\n`;
      }
    }

    if (book.series) {
      frontmatter += yamlKey('series', book.series);
      if (typeof book.series_index === 'number') {
        frontmatter += `series-index: ${book.series_index}\n`;
      }
    }

    frontmatter += yamlKey('added', dateOf(book.timestamp));
    frontmatter += yamlKey('calibre-uuid', book.uuid);
    frontmatter += `calibre-id: ${book.application_id}\n`;
    frontmatter += '---\n\n';

    const byline = [displayAuthors, book.publisher, year].filter(Boolean).join(' · ');
    const description = book.comments ? htmlToMarkdown(book.comments).trim() : '';

    const bodyValues: Record<string, string> = {
      title,
      author: book.author_sort ?? displayAuthors,
      authors: displayAuthors,
      year,
      publisher: book.publisher ?? '',
      series: book.series ?? '',
      id: String(book.application_id),
      byline,
      cover: coverPath ?? '',
      coverWidth: String(this.settings.coverWidth ?? 350),
      description,
    };

    const sections: string[] = [
      renderTemplate(this.settings.headingTemplate ?? DEFAULT_SETTINGS.headingTemplate, bodyValues),
    ];

    if (byline) {
      sections.push(renderTemplate(this.settings.bylineTemplate ?? DEFAULT_SETTINGS.bylineTemplate, bodyValues));
    }

    if (coverPath) {
      sections.push(renderTemplate(this.settings.coverTemplate ?? DEFAULT_SETTINGS.coverTemplate, bodyValues));
    }

    if (description) {
      sections.push(renderTemplate(this.settings.descriptionTemplate ?? DEFAULT_SETTINGS.descriptionTemplate, bodyValues));
    }

    const body = sections.join('\n\n') + '\n';

    return frontmatter + body;
  }

  /**
   * Builds a note from the user's own Custom Template File instead of the
   * built-in layout. Throws rather than falling back or writing a partial
   * note if no template is configured or it can't be found — a clear failure
   * beats a silently wrong note.
   */
  private async buildCustomNote(book: CalibreBook, coverPath: string | null): Promise<string> {
    const templatePath = (this.settings.customTemplateFile ?? '').trim();
    if (!templatePath) {
      throw new Error('No Custom Template File is set in Advanced Calibre settings.');
    }

    const file = this.app.vault.getAbstractFileByPath(normalizePath(templatePath));
    if (!(file instanceof TFile)) {
      throw new Error(`Custom Template File not found: ${templatePath}`);
    }

    const template = await this.app.vault.read(file);
    const values = buildCustomValues(book, coverPath, this.settings);
    const blockValues = buildBlockValues(book, this.settings);

    return renderCustomTemplate(template, values, blockValues);
  }

  /**
   * Downloads the cover into the vault alongside the note. Returns the vault path
   * on success, or null if there is no cover or the download fails — a missing
   * cover should not abort the import.
   */
  private async saveCover(book: CalibreBook, noteFolder: string): Promise<string | null> {
    const response = await requestUrl({
      url: `${this.host}/get/cover/${book.application_id}/${encodeURIComponent(this.library)}`,
      method: 'GET',
      throw: false,
    });

    if (response.status !== 200) {
      throw new Error(`the server returned ${response.status} for the cover`);
    }

    if (!response.arrayBuffer?.byteLength) {
      throw new Error('the server returned an empty cover');
    }

    // Covers get their own folder when one is configured, otherwise they sit
    // beside the note.
    const folder = normalizePath((this.settings.coverFolder ?? '').trim() || noteFolder);
    await this.ensureFolder(folder);

    const name = sanitiseFilename(book.title ?? `calibre-${book.application_id}`);
    const path = normalizePath(`${folder}/${name}.jpg`);

    if (!this.app.vault.getAbstractFileByPath(path)) {
      await this.app.vault.createBinary(path, response.arrayBuffer);
    }

    return path;
  }

  /** Creates the destination folder if it does not already exist. */
  private async ensureFolder(folder: string) {
    if (!folder || this.app.vault.getAbstractFileByPath(folder)) {
      return;
    }

    await this.app.vault.createFolder(folder);
  }

  /**
   * Writes a note for the book. Existing notes are left alone rather than
   * overwritten — the note may contain the user's own writing below the imported
   * content.
   */
  async importBook(book: CalibreBook): Promise<TFile | null> {
    const folder = normalizePath((this.settings.importFolder ?? '').trim() || 'Sources');
    await this.ensureFolder(folder);

    const basename = applyFilenameTemplate(this.settings.filenameTemplate ?? '{{author}} - {{title}}', book);
    const path = normalizePath(`${folder}/${basename}.md`);

    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      new Notice(`Already imported: ${basename}`);
      return existing;
    }

    let coverPath: string | null = null;
    if (this.settings.importCover) {
      try {
        coverPath = await this.saveCover(book, folder);
      } catch (e) {
        // A missing cover should not abort an otherwise good import, but it
        // should not fail silently either.
        console.error('calibre: could not save cover', e);
        new Notice(`Imported without a cover \u2014 ${e.message}`, 8000);
      }
    }
    const content = this.settings.noteGeneration === 'custom'
      ? await this.buildCustomNote(book, coverPath)
      : this.buildNote(book, coverPath);

    const file = await this.app.vault.create(path, content);
    new Notice(`Imported ${basename}`);
    return file;
  }
}
