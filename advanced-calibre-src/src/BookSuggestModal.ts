import { App, FuzzySuggestModal } from 'obsidian';
import { CalibreBook } from './AdvancedCalibreImporter';

/**
 * Searchable list of every book in the library. calibre's own search syntax is
 * not used here — the list is already in memory, so Obsidian's fuzzy matching
 * over title and author is both faster and more familiar.
 */
export class BookSuggestModal extends FuzzySuggestModal<CalibreBook> {
  constructor(app: App, private books: CalibreBook[], private onChoose: (book: CalibreBook) => void) {
    super(app);
    this.setPlaceholder('Search your calibre library...');
  }

  getItems(): CalibreBook[] {
    return this.books;
  }

  getItemText(book: CalibreBook): string {
    const authors = book.authors?.join(', ') ?? book.author_sort ?? '';
    return authors ? `${book.title ?? 'Untitled'} — ${authors}` : (book.title ?? 'Untitled');
  }

  onChooseItem(book: CalibreBook): void {
    this.onChoose(book);
  }
}
