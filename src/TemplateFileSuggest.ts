import { AbstractInputSuggest, App, TFile } from 'obsidian';

/**
 * Type-ahead suggestions for vault Markdown files, used by the Custom
 * Template File setting. Mirrors FolderSuggest's pattern but filters to
 * `.md` files instead of folders.
 */
export class TemplateFileSuggest extends AbstractInputSuggest<TFile> {
  constructor(app: App, private textInputEl: HTMLInputElement) {
    super(app, textInputEl);
  }

  getSuggestions(query: string): TFile[] {
    const search = query.toLowerCase();

    return this.app.vault
      .getMarkdownFiles()
      .filter((file) => file.path.toLowerCase().contains(search));
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(file: TFile): void {
    this.textInputEl.value = file.path;

    // Obsidian's TextComponent listens for 'input', so this is what causes the
    // setting's own onChange handler to fire and persist the value.
    this.textInputEl.trigger('input');
    this.close();
  }
}
