# ClearAndReload

A Chromium extension that wipes everything the current site has stored in your browser and reloads it, in one click or keypress. Made for developers and testers who need a clean first visit without opening DevTools or clearing the whole browser.

---

## Features

- One click on the toolbar icon, or **Shift+Alt+F**, clears the site and reloads it
- Clears the whole site, not just the current origin: every subdomain and port of the registrable domain (`app.example.com:3000` and `example.com` together)
- Never touches other sites, including third-party iframes embedded in the page (YouTube, login providers)
- Reloads every open tab on the site, bypassing the cache, so no other tab writes its old state straight back
- Works from the page itself or with focus in DevTools
- A green ✓ on the icon when done, a red ! when something went wrong

---

## Requirements

- A **Chromium-based browser** with Manifest V3 support (Chrome, Edge, Brave, Opera, Vivaldi)

---

## Installation

1. Download `ClearAndReload-vX.Y.Z.zip` from the [latest release](https://github.com/IJuanTM/ClearAndReload/releases/latest) and extract the `ClearAndReload` folder somewhere permanent. The browser loads the extension from that folder, so don't delete it afterwards.
2. Open `chrome://extensions` (`edge://extensions` in Edge) and turn on **Developer mode**.
3. Drag the `ClearAndReload` folder onto the page, or click **Load unpacked** and pick it.
4. Optionally pin the icon to the toolbar.

To update, extract the new `ClearAndReload` folder over the old one and click the reload button on the extension's card in `chrome://extensions`.

---

## Usage

Open the site you want to reset, then click the toolbar icon or press **Shift+Alt+F**. To change the shortcut, go to `chrome://extensions/shortcuts`.

Only `http://` and `https://` pages can be cleared. On anything else (`chrome://` pages, `file://`, the new tab page) nothing happens.

---

## What gets cleared

| Data                        | Scope                                       |
|-----------------------------|---------------------------------------------|
| Cookies                     | The whole registrable domain                |
| Local storage               | Every origin on the site that was found     |
| Session storage             | Open tabs and frames on the site            |
| IndexedDB                   | Every origin on the site that was found     |
| Cache Storage               | Every origin on the site that was found     |
| Service workers             | Every origin on the site that was found     |
| File systems                | Every origin on the site that was found     |
| HTTP cache                  | Every origin on the site that was found     |

Browsing history, passwords, autofill and site permissions are left alone.

---

## How it works

### Finding the site

The site is the registrable domain of the active tab, e.g. `example.co.uk` for `shop.example.co.uk`. Chromium has no public-suffix API for extensions, so the extension tries to set a throwaway cookie on each parent domain, shortest first. Chromium refuses cookies on public suffixes like `co.uk`, so the first domain that accepts one is the site. The probe cookie is removed with the rest of the cookies.

### Finding the origins

Cookies are cleared domain-wide, but Chromium only clears the other storage types per exact origin (scheme, host and port). So the extension collects every origin on the site it can find: from open tabs, from frames inside those tabs, and from your browsing history. An origin on the site that is in none of those keeps its storage.

### Clearing and reloading

Before the wipe, every open tab on the site is silenced: unload handlers are blocked, session storage is cleared, and writes to local storage and `document.cookie` are dropped. Without that, a page could write its state back between the wipe and the reload.

Cookies and storage are cleared first, then all tabs on the site reload with the cache bypassed. The HTTP cache is cleared last and in the background, since Chromium scans the entire disk cache for it, and waiting on that would delay the reload by several seconds.

---

## Permissions

| Permission                   | Used for                                                       |
|------------------------------|----------------------------------------------------------------|
| `browsingData`               | Clearing cookies, storage and cache for the site's origins     |
| `cookies`                    | Probing for the registrable domain                             |
| `history`                    | Finding the site's other subdomains and ports (read only)      |
| `scripting`                  | Silencing open tabs on the site before the wipe                |
| `tabs`                       | Finding the active tab and the other tabs on the site          |
| Host access to all sites     | Running the silencing script on whichever site you clear       |

Nothing is sent anywhere; the extension has no network code.

---

## Notes

- Tabs that the browser has discarded to save memory aren't reloaded, they load fresh when you open them.
- Third-party data stays, by design: a site that keeps its login in an embedded provider's iframe may still recognise you after a reload.
