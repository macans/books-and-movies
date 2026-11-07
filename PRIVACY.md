# Privacy

Books & Movies runs in Chrome. There is no application backend, analytics endpoint or developer-accessible history database.

## Local data

After you connect Douban and choose **Use my history**, the extension stores the connected profile identifier, book and movie titles, collection status, personal ratings, dates, tags and comments in `chrome.storage.local`. Saved and skipped titles, verified work details, reading progress and optional model settings are stored there as well. This storage is restricted to trusted extension contexts.

Records are used to exclude completed and in-progress works, compare themes and explain recommendations. Wish-list entries are not treated as positive ratings. An incomplete read stays incomplete. Data is not uploaded to GitHub or sent to the project maintainer.

## Login and network requests

You sign in directly on Douban. The extension does not request your password or verification code and has no `cookies` permission. It does not read, export or store browser cookie databases. Chrome automatically uses the existing login when fetching Douban pages.

Default requests go to `book.douban.com`, `movie.douban.com` and the Douban artwork CDN (`*.doubanio.com`). Login pages opened by you may use Douban’s account service. Search terms are sent to Douban when you search. Requests stop on sign-in requirements, verification, rate limits and unrecognized page structures.

## Optional model

Model use is off by default. You may configure an HTTPS Chat Completions endpoint and grant access to that provider’s origin. Only clicking **Generate model guide** sends work details and at most four relevant history entries, including their ratings and comments, to that provider. Its own privacy policy then applies. The API key is stored in `chrome.storage.session`, not in the source repository or persistent extension settings. There are no automatic background model calls.

## Remove data

Open **Settings → Clear local data** and confirm. This clears this extension’s connection, history, saved and skipped titles, cached metadata, model settings and session API key. It does not alter your Douban account, ratings or browser login. Uninstalling the extension also removes its Chrome storage. Clear data before connecting a different account when you already have local history.

The release includes public work metadata and editorial descriptions, not any person’s reading history, profile identifier, comments or ratings. Issues and pull requests are public: use synthetic examples instead of real history or credentials when reporting a problem.
