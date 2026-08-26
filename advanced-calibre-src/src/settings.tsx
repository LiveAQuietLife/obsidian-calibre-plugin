import { App, debounce, PluginSettingTab, Setting, SplitDirection } from 'obsidian';
import AdvancedCalibrePlugin from './main';
import { FolderSuggest } from './FolderSuggest';
import { ADVANCED_CALIBRE_ICON_ID } from './tools';

/** How calibre tags with spaces are converted into valid Obsidian tags. */
export type TagSpaceHandling = 'hyphenate' | 'camelCase' | 'none';

export interface AdvancedCalibrePluginSettings {
	address?: string;
	displayText?: string;
	splitDirection: SplitDirection | 'tab';
	ribbonIcon: string;
	hideRibbonIcon: boolean;
	replaceLocalIp: boolean;
	localIpOverride?: string;
	importFolder?: string;
	filenameTemplate?: string;
	importCover: boolean;
	coverFolder?: string;
	coverWidth?: number;
	importLibrary?: string;
	autoOpenAfterImport: boolean;
	headingTemplate: string;
	bylineTemplate: string;
	coverTemplate: string;
	descriptionTemplate: string;
	tagSpaceHandling: TagSpaceHandling;
	maxTags: number;
}

const DEBOUNCE_TIMEOUT = 1000;
export const DEFAULT_SETTINGS: AdvancedCalibrePluginSettings = {
	address: "http://localhost:8080",
	displayText: "Advanced Calibre",
	splitDirection: "tab",
	ribbonIcon: ADVANCED_CALIBRE_ICON_ID,
	hideRibbonIcon: false,
	replaceLocalIp: true,
	localIpOverride: "",
	importFolder: "Sources",
	filenameTemplate: "{{author}} - {{title}}",
	importCover: true,
	coverFolder: "",
	coverWidth: 350,
	importLibrary: "Calibre_Library",
	autoOpenAfterImport: true,
	headingTemplate: "# {{title}}",
	bylineTemplate: "{{byline}}",
	coverTemplate: "![[{{cover}}|{{coverWidth}}]]",
	descriptionTemplate: "## Description\n\n{{description}}",
	tagSpaceHandling: "hyphenate",
	maxTags: 10,
}

export class AdvancedCalibreSettingTab extends PluginSettingTab {

	constructor(app: App, private plugin: AdvancedCalibrePlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Advanced Calibre Settings' });

		new Setting(containerEl)
			.setName("Server Address")
			.setDesc("The address of calibre Content server.")
			.addText(text => {
				text.inputEl.size = 25;
				text
					.setPlaceholder(DEFAULT_SETTINGS.address)
					.setValue(this.plugin.settings.address)
					.onChange(debounce(async (value) => {
						this.plugin.settings.address = value;
						this.plugin.saveData(this.plugin.settings);
					}, DEBOUNCE_TIMEOUT));
			});

		new Setting(containerEl)
			.setName("Use the local IP address instead of 'localhost'")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.replaceLocalIp)
				.onChange(async value => {
					this.plugin.settings.replaceLocalIp = value;
					this.plugin.saveData(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName("Local IP override")
			.setDesc("Only used if the setting above is on. Leave blank to auto-detect. If auto-detect picks the wrong network adapter (common with VPNs, Docker, or virtual machines installed), enter your computer's real local IP address here instead, e.g. 192.168.1.166.")
			.addText(text => {
				text.inputEl.size = 25;
				text
					.setPlaceholder("Auto-detect (e.g. 192.168.1.166)")
					.setValue(this.plugin.settings.localIpOverride)
					.onChange(debounce(async (value) => {
						this.plugin.settings.localIpOverride = value;
						this.plugin.saveData(this.plugin.settings);
					}, DEBOUNCE_TIMEOUT));
			});

		new Setting(containerEl)
			.setName("View Display Text")
			.setDesc("The title of calibre view.")
			.addText(text => {
				text.inputEl.size = 25;
				text
					.setPlaceholder(DEFAULT_SETTINGS.displayText)
					.setValue(this.plugin.settings.displayText)
					.onChange(debounce(async (value) => {
						this.plugin.settings.displayText = value;
						this.plugin.saveData(this.plugin.settings);
					}, DEBOUNCE_TIMEOUT));
			});

		new Setting(containerEl)
			.setName("Open In")
			.setDesc("Full tab opens calibre as its own tab. The split options open it alongside the current pane.")
			.addDropdown(dropdown => dropdown
				.addOption("tab", "Full tab")
				.addOption("horizontal", "Horizontal split")
				.addOption("vertical", "Vertical split")
				.setValue(this.plugin.settings.splitDirection)
				.onChange(async (value: SplitDirection | 'tab') => {
					this.plugin.settings.splitDirection = value;
					this.plugin.saveData(this.plugin.settings);
				}));

		containerEl.createEl('h3', { text: 'Metadata Import' });

		new Setting(containerEl)
			.setName("Library")
			.setDesc("The calibre library to import from, as it appears in the library chooser.")
			.addText(text => {
				text.inputEl.size = 25;
				text
					.setPlaceholder("Calibre_Library")
					.setValue(this.plugin.settings.importLibrary)
					.onChange(debounce(async (value) => {
						this.plugin.settings.importLibrary = value;
						this.plugin.saveData(this.plugin.settings);
					}, DEBOUNCE_TIMEOUT));
			});

		new Setting(containerEl)
			.setName("Import Folder")
			.setDesc("Where imported book notes are created. Created if it does not exist.")
			.addText(text => {
				text.inputEl.size = 25;
				new FolderSuggest(this.app, text.inputEl);
				text
					.setPlaceholder("Sources")
					.setValue(this.plugin.settings.importFolder)
					.onChange(debounce(async (value) => {
						this.plugin.settings.importFolder = value;
						this.plugin.saveData(this.plugin.settings);
					}, DEBOUNCE_TIMEOUT));
			});

		new Setting(containerEl)
			.setName("Filename Template")
			.setDesc("Available: {{title}}, {{author}} (sort order), {{authors}}, {{year}}, {{publisher}}, {{series}}, {{id}}. Characters illegal in filenames are removed automatically.")
			.addText(text => {
				text.inputEl.size = 25;
				text
					.setPlaceholder("{{author}} - {{title}}")
					.setValue(this.plugin.settings.filenameTemplate)
					.onChange(debounce(async (value) => {
						this.plugin.settings.filenameTemplate = value;
						this.plugin.saveData(this.plugin.settings);
					}, DEBOUNCE_TIMEOUT));
			});

		new Setting(containerEl)
			.setName("Open Note After Import")
			.setDesc("Opens the newly imported note automatically. Turn off to stay on the current pane.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoOpenAfterImport)
				.onChange(async value => {
					this.plugin.settings.autoOpenAfterImport = value;
					this.plugin.saveData(this.plugin.settings);
				}));

		containerEl.createEl('h3', { text: 'Tags' });

		new Setting(containerEl)
			.setName("Tag Space Handling")
			.setDesc("calibre tags are free text and often contain spaces, which Obsidian tags can't — they'd otherwise render struck through as invalid.")
			.addDropdown(dropdown => dropdown
				.addOption("hyphenate", "Hyphenate (old testament \u2192 old-testament)")
				.addOption("camelCase", "CamelCase (old testament \u2192 OldTestament)")
				.addOption("none", "Leave as-is (may not render as a tag)")
				.setValue(this.plugin.settings.tagSpaceHandling)
				.onChange(async (value: TagSpaceHandling) => {
					this.plugin.settings.tagSpaceHandling = value;
					this.plugin.saveData(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName("Max Tags")
			.setDesc("Caps how many tags are imported per book, keeping the earliest ones calibre returns. Some libraries carry a lot of tags per book. Set to 0 for no limit.")
			.addText(text => {
				text.inputEl.type = 'number';
				text.inputEl.size = 8;
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.maxTags))
					.setValue(String(this.plugin.settings.maxTags))
					.onChange(debounce(async (value) => {
						const parsed = Number.parseInt(value, 10);
						this.plugin.settings.maxTags = Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_SETTINGS.maxTags;
						this.plugin.saveData(this.plugin.settings);
					}, DEBOUNCE_TIMEOUT));
			});

		containerEl.createEl('h3', { text: 'Note Layout' });

		new Setting(containerEl)
			.setName("Heading Template")
			.setDesc("Available: {{title}}, {{author}}, {{authors}}, {{year}}, {{publisher}}, {{series}}, {{id}}.")
			.addTextArea(text => {
				text.inputEl.rows = 1;
				text.inputEl.cols = 40;
				text
					.setPlaceholder(DEFAULT_SETTINGS.headingTemplate)
					.setValue(this.plugin.settings.headingTemplate)
					.onChange(debounce(async (value) => {
						this.plugin.settings.headingTemplate = value;
						this.plugin.saveData(this.plugin.settings);
					}, DEBOUNCE_TIMEOUT));
			});

		new Setting(containerEl)
			.setName("Byline Template")
			.setDesc("Available: all heading variables, plus {{byline}} (authors, publisher and year, joined by '·' with any missing pieces dropped). Only used when a byline can be built.")
			.addTextArea(text => {
				text.inputEl.rows = 1;
				text.inputEl.cols = 40;
				text
					.setPlaceholder(DEFAULT_SETTINGS.bylineTemplate)
					.setValue(this.plugin.settings.bylineTemplate)
					.onChange(debounce(async (value) => {
						this.plugin.settings.bylineTemplate = value;
						this.plugin.saveData(this.plugin.settings);
					}, DEBOUNCE_TIMEOUT));
			});

		new Setting(containerEl)
			.setName("Cover Template")
			.setDesc("Available: all heading variables, plus {{cover}} (the cover's vault path) and {{coverWidth}}. Only used when a cover was downloaded.")
			.addTextArea(text => {
				text.inputEl.rows = 1;
				text.inputEl.cols = 40;
				text
					.setPlaceholder(DEFAULT_SETTINGS.coverTemplate)
					.setValue(this.plugin.settings.coverTemplate)
					.onChange(debounce(async (value) => {
						this.plugin.settings.coverTemplate = value;
						this.plugin.saveData(this.plugin.settings);
					}, DEBOUNCE_TIMEOUT));
			});

		new Setting(containerEl)
			.setName("Description Template")
			.setDesc("Available: all heading variables, plus {{description}} (calibre's comments, converted from HTML to Markdown). Only used when the book has a description.")
			.addTextArea(text => {
				text.inputEl.rows = 3;
				text.inputEl.cols = 40;
				text
					.setPlaceholder(DEFAULT_SETTINGS.descriptionTemplate)
					.setValue(this.plugin.settings.descriptionTemplate)
					.onChange(debounce(async (value) => {
						this.plugin.settings.descriptionTemplate = value;
						this.plugin.saveData(this.plugin.settings);
					}, DEBOUNCE_TIMEOUT));
			});

		new Setting(containerEl)
			.setName("Download Cover Image")
			.setDesc("Saves the cover into the import folder alongside the note, so it keeps working if the server address changes.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.importCover)
				.onChange(async value => {
					this.plugin.settings.importCover = value;
					this.plugin.saveData(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName("Cover Folder")
			.setDesc("Where cover images are saved. Leave blank to use the import folder.")
			.addText(text => {
				text.inputEl.size = 25;
				new FolderSuggest(this.app, text.inputEl);
				text
					.setPlaceholder("Same as import folder")
					.setValue(this.plugin.settings.coverFolder)
					.onChange(debounce(async (value) => {
						this.plugin.settings.coverFolder = value;
						this.plugin.saveData(this.plugin.settings);
					}, DEBOUNCE_TIMEOUT));
			});

		new Setting(containerEl)
			.setName("Cover Width")
			.setDesc("Display width of the cover image in pixels.")
			.addText(text => {
				text.inputEl.type = 'number';
				text.inputEl.size = 8;
				text
					.setPlaceholder("350")
					.setValue(String(this.plugin.settings.coverWidth ?? 350))
					.onChange(debounce(async (value) => {
						const parsed = Number.parseInt(value, 10);
						this.plugin.settings.coverWidth = Number.isFinite(parsed) && parsed > 0 ? parsed : 350;
						this.plugin.saveData(this.plugin.settings);
					}, DEBOUNCE_TIMEOUT));
			});

		new Setting(containerEl)
			.setName("Hide Ribbon Icon")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hideRibbonIcon)
				.onChange(async value => {
					this.plugin.settings.hideRibbonIcon = value;
					this.plugin.saveData(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName("Ribbon Icon")
			.setDesc("The icon name to be used.")
			.addText(text => text
				.setValue(this.plugin.settings.ribbonIcon)
				.onChange(async value => {
					this.plugin.settings.ribbonIcon = value;
					this.plugin.saveData(this.plugin.settings);
				}));

	}
}
