import { addIcon, Notice, Plugin, SplitDirection } from 'obsidian';
import { BookSuggestModal } from './BookSuggestModal';
import { AdvancedCalibreImporter } from './AdvancedCalibreImporter';
import { AdvancedCalibreView, ADVANCED_CALIBRE_VIEW_TYPE } from './AdvancedCalibreView';
import {
	AdvancedCalibrePluginSettings,
	AdvancedCalibreSettingTab,
	DEFAULT_SETTINGS,
} from './settings';
import {
	ADVANCED_CALIBRE_ICON_ID,
	ADVANCED_CALIBRE_ICON_SVG
} from './tools';

export default class AdvancedCalibrePlugin extends Plugin {
	settings: AdvancedCalibrePluginSettings;

	async onload() {
		try {
			await this.loadSettings();
			this.addSettingTab(new AdvancedCalibreSettingTab(this.app, this));
			addIcon(ADVANCED_CALIBRE_ICON_ID, ADVANCED_CALIBRE_ICON_SVG);

			this.registerView(ADVANCED_CALIBRE_VIEW_TYPE, (leaf) => new AdvancedCalibreView(leaf, this.settings));

			if (!this.settings.hideRibbonIcon) {
				this.addRibbonIcon(this.settings.ribbonIcon, 'Advanced Calibre', async () => {
					this.activateView();
				});
			}

			this.addCommand({
				id: 'open',
				name: 'Open',
				callback: () => this.activateView()
			});

			this.addCommand({
				id: 'open-horizontally',
				name: 'Open horizontally',
				callback: () => this.activateView('horizontal')
			});

			this.addCommand({
				id: 'open-vertically',
				name: 'Open vertically',
				callback: () => this.activateView('vertical')
			});

			this.addCommand({
				id: 'import-metadata',
				name: 'Import book metadata',
				callback: () => this.importMetadata()
			});
		} catch (error) {
			console.log(`Load error. ${error}`);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		// A settings file carried over from the old plugin (or an old Advanced
		// Calibre install predating the icon rename) may still reference the
		// icon under its former id. That id is no longer registered, so
		// addRibbonIcon silently draws nothing. Migrate it once, quietly.
		if (this.settings.ribbonIcon === 'calibre') {
			this.settings.ribbonIcon = ADVANCED_CALIBRE_ICON_ID;
			await this.saveData(this.settings);
		}
	}

	async activateView(direction?: SplitDirection) {
		// An explicit direction comes from the split commands. Otherwise honour the
		// setting, which may be 'tab' for a full tab rather than a split.
		const mode = direction ?? this.settings.splitDirection;
		const leaf = mode === 'tab'
			? this.app.workspace.getLeaf('tab')
			: this.app.workspace.getLeaf('split', mode);
		await leaf.setViewState({
			type: ADVANCED_CALIBRE_VIEW_TYPE,
			active: true,
		});

		this.app.workspace.revealLeaf(leaf);
	}

	/**
	 * Loads the library, lets the user pick a book, and writes a note for it.
	 * Fetching happens up front so the picker can search titles and authors.
	 */
	async importMetadata() {
		const importer = new AdvancedCalibreImporter(this.app, this.settings);
		const notice = new Notice('Loading your calibre library...', 0);

		try {
			const books = await importer.fetchLibrary();
			notice.hide();

			if (books.length === 0) {
				new Notice('No books found in that calibre library.');
				return;
			}

			new BookSuggestModal(this.app, books, async (book) => {
				try {
					const file = await importer.importBook(book);
					if (file && this.settings.autoOpenAfterImport) {
						await this.app.workspace.getLeaf(false).openFile(file);
					}
				} catch (e) {
					console.error(e);
					new Notice(`Could not import that book: ${e.message}`);
				}
			}).open();
		} catch (e) {
			notice.hide();
			console.error(e);
			new Notice(`Could not reach calibre: ${e.message}`, 8000);
		}
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(ADVANCED_CALIBRE_VIEW_TYPE);
	}
}
