import { ItemView, WorkspaceLeaf, requestUrl } from "obsidian";
import { AdvancedCalibrePluginSettings } from "./settings";
import * as ip from "ip";

export const ADVANCED_CALIBRE_VIEW_TYPE = "advanced-calibre-view";

/**
 * Accepts a full URL, a `host:port` pair, or a bare IP/hostname and returns
 * just the host portion. Falls back to the trimmed input if it cannot be parsed.
 */
function extractHost(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return new URL(trimmed).hostname;
  } catch (e) {
    // Not a full URL; fall through and try again with a scheme prepended.
  }

  try {
    return new URL(`http://${trimmed}`).hostname;
  } catch (e) {
    return trimmed;
  }
}

export class AdvancedCalibreView extends ItemView {
  private closed = false;

  constructor(leaf: WorkspaceLeaf, private settings: AdvancedCalibrePluginSettings) {
    super(leaf);
  }

  getViewType() {
    return ADVANCED_CALIBRE_VIEW_TYPE;
  }

  getDisplayText() {
    return this.settings.displayText;
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    try {
      if (!this.settings.address?.trim()) {
        container.createDiv({
          text: 'No Calibre server address is set. Add your Content server address in Settings \u2192 Community plugins \u2192 Advanced Calibre.',
          cls: 'advanced-calibre-message'
        });
        return;
      }

      const iframe = container.createEl('iframe');
      iframe.setAttribute('sandbox', 'allow-forms allow-presentation allow-same-origin allow-scripts allow-modals allow-downloads allow-popups');
      const localIp = extractHost(this.settings.localIpOverride ?? '') || ip.address();
      const address = this.settings.replaceLocalIp
        ? this.settings.address.replace('localhost', localIp)
        : this.settings.address;

      iframe.src = address;

      // The iframe cannot tell us whether the server answered: it is cross-origin,
      // `error` never fires, and `load` fires even for Chromium's own
      // `chrome-error://chromewebdata/` page. So ask the server directly instead.
      // requestUrl runs outside the browser's CORS restrictions.
      this.checkReachable(container, address);
    } catch (e) {
      console.error(e);
      const error = container.createDiv({ text: e.toString() });
      error.style.color = 'var(--text-title-h1)';
    }
  }

  /**
   * Probes the server and shows an overlay if it cannot be reached. Any HTTP
   * response counts as reachable — a 401 means the server answered, which is an
   * authentication problem rather than a connectivity one.
   */
  private async checkReachable(container: Element, address: string) {
    try {
      await requestUrl({ url: address, method: 'GET', throw: false });
      return;
    } catch (e) {
      // Fall through: no response at all.
    }

    // The pane may have been closed while the request was in flight.
    if (this.closed) {
      return;
    }

    const notice = container.createDiv({ cls: 'advanced-calibre-message advanced-calibre-overlay' });
    notice.createEl('p', { text: `Couldn't reach the Calibre server at ${address}` });
    notice.createEl('p', {
      text: "Check that Calibre's Content server is running (Connect/share \u2192 Start Content server) and that the address above is correct."
    });
  }

  async onClose() {
    // An in-flight reachability check may still resolve after this point.
    this.closed = true;
  }
}
