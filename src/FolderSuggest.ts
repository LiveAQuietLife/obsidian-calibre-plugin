import { AbstractInputSuggest, App, TFolder } from 'obsidian';

/**
 * Type-ahead folder suggestions for a settings text field. Requires Obsidian
 * 1.4.11 or later, which is why the plugin's minAppVersion sits there.
 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(app: App, private textInputEl: HTMLInputElement) {
    super(app, textInputEl);
  }

  getSuggestions(query: string): TFolder[] {
    const search = query.toLowerCase();

    return this.app.vault
      .getAllLoadedFiles()
      .filter((file): file is TFolder => file instanceof TFolder)
      .filter((folder) => folder.path.toLowerCase().contains(search));
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    // The vault root reports an empty path, which would render as a blank row.
    el.setText(folder.path || '/');
  }

  selectSuggestion(folder: TFolder): void {
    this.textInputEl.value = folder.path;

    // Obsidian's TextComponent listens for 'input', so this is what causes the
    // setting's own onChange handler to fire and persist the value.
    this.textInputEl.trigger('input');
    this.close();
  }
}
