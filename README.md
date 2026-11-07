# Books & Movies

One thoughtful book or movie recommendation at a time. English interface, Chinese introductions, and personal recommendations based on **your own** Douban history.

[Download the latest installer](https://github.com/macans/books-and-movies/releases/latest) · [Privacy](PRIVACY.md)

## Install

No Node.js, Python, API key or local server is needed to use the extension.

1. Download the **setup ZIP** from Releases and extract the entire archive.
2. Start the helper for your system:
   - **macOS:** double-click `install-macos.command`.
   - **Windows:** double-click `install-windows.cmd`.
   - **Linux:** run `sh install.sh`.
3. The helper copies the extension to a permanent folder and opens a guide and Chrome’s extensions page. In Chrome, enable **Developer mode**, click **Load unpacked**, and choose the prepared `extension` folder. The guide shows its exact path.
4. Pin **Books & Movies** using Chrome’s extensions menu, then open it.

**Installation boundary:** this is a GitHub developer-mode build, not a Chrome Web Store listing. The helper starts with one action, but Chrome requires the final manual loading steps. A GitHub download cannot provide a true “Add to Chrome” button on ordinary macOS or Windows installations. See [Chrome’s distribution documentation](https://developer.chrome.com/docs/extensions/how-to/distribute) and [Load unpacked instructions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

You can also download the source ZIP or clone this repository, then load `extension/` directly. If your system prevents running a downloaded script, use this manual route; no security settings need to be disabled.

Default helper destinations:

| System | Folder |
| --- | --- |
| macOS | `~/Applications/BooksAndMovies/extension` |
| Windows | `%LOCALAPPDATA%\BooksAndMovies\extension` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/books-and-movies/extension` |

Keep that folder. No server stays running. To update, download the next release, run its helper and click **Reload** on the existing extension in `chrome://extensions`. The helper backs up the previous files; Chrome-local history is not stored in those files. GitHub installations do not auto-update.

## Connect your own history

1. Click **Connect Douban**. Sign in on Douban in the tab the extension opens. Passwords and verification codes are entered only on Douban.
2. Return to Books & Movies. If necessary, click **I’m signed in** after opening **My Books** on Douban.
3. Select the local-history consent checkbox and click **Use my history**. Books and movies are read serially, including completed, wanted and in-progress lists. Keep the history tabs open.
4. Click **Start discovering**. You can reconnect, refresh or clear this extension’s data in **Settings**.

The extension starts with no account and no personal sample. It recognizes the signed-in account from the Douban page opened for connection. It will not merge a different account into existing personal history. If Douban requests sign-in, verification, or rate-limits requests, reading stops and keeps the records already read. Complete verification on Douban and retry; the extension does not bypass it.

You can choose **Explore without history**. These picks are exploratory, not claims about your preferences. A partial read is labelled as partial, without a product dashboard of import counts.

## What it does

- **Discover:** one book or movie at a time. The current pick persists across reopening. **Interested** saves it and advances; **Skip** advances without treating that as dislike of an entire genre.
- **Works, with context:** cover or poster, available original title and creator names, edition details, Douban source link, and a structured Chinese introduction of about 200–300 characters.
- **My List:** saved titles, search, type filters and full details.
- **Deep Dive:** search a title or paste a Douban subject URL, choose the edition, and read a Chinese guide targeting about 1,500 characters. Source limitations are explicit; the app does not claim to have read every book in full.
- **Current-page reading:** if fetching a title fails, open its Douban page, open the extension side panel, and select **Use current Douban page**.
- **Optional model:** configure a compatible HTTPS Chat Completions service. Only an explicit **Generate model guide** action sends that title’s information and up to four relevant history entries to your provider. The API key is kept only in the browser session.

Personal ratings, comments, editorial topic labels, public ratings and algorithmic inferences stay distinct. Unrated titles remain unrated. Completed and in-progress titles are excluded from new picks; a wish-list entry is only a weak interest signal. Available sources and history determine the quality and coverage of recommendations. Different readers will get different matches, subject to that coverage.

## Privacy

History, saved and skipped titles, connection state and settings live in this Chrome profile, not in the repository. There is no analytics service or application account. The extension has no `cookies` permission and does not read browser cookie databases. Chrome itself uses the existing Douban login for requests.

Default network traffic is limited to Douban and its artwork CDN. The optional model is disabled until configured and explicitly requested. See [PRIVACY.md](PRIVACY.md) for data use and removal.

## Development

Node.js 22+ is needed only for development; Python 3 is needed only to build release ZIPs.

```sh
npm ci
npm test
npm run check
npm run privacy
npm run package
```

There is no front-end build step. `extension/` is a Manifest V3 extension using native JavaScript modules. Tests use synthetic records. CI checks Linux, macOS and Windows, including installation helpers in prepare-only mode. Release packaging uses `scripts/release-files.json` as a reviewed allowlist and produces separate extension and guided-setup ZIPs plus SHA-256 checksums.

Do not commit private exports, browser profiles, credentials, local history or an extension bootstrap. The privacy check rejects a default account, personal catalog fields, detected credentials and unexpected extension files. It supplements review and is not a guarantee against every possible sensitive string.

Code is under the MIT license. Third-party artwork, source excerpts and work metadata are excluded from that license; see [NOTICE](NOTICE).
