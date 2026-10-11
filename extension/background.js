// Opens the side panel from the toolbar icon and creates the anonymous install ID.

async function setup() {
  await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true});
  const {installId} = await chrome.storage.local.get('installId');
  if (!installId) await chrome.storage.local.set({installId: crypto.randomUUID()});
}

chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);
