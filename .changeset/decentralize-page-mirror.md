---
"playground-cli": patch
---

`decentralize` now works on deep page URLs (e.g. a Wikipedia article) instead
of failing with "none was index.html". Page URLs are fetched with their
requisites but without link recursion, so they no longer risk crawling an
entire site, and a root `index.html` is materialised from the page itself (with
a `<base>` so its asset links resolve) so the viewer renders the real page
directly. A mirror is also no longer aborted just because a single requisite
asset returned an HTTP error.

Known limitation: sites that load their CSS through query-string URLs (e.g.
Wikipedia's `load.php?modules=…`) render unstyled, because a file whose name
contains `?`/`|` cannot be served faithfully over a static path.
