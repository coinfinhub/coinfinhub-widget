# Security

These widgets run on other people's pages, so we take reports seriously.

## Reporting a problem

Please report security problems privately through the contact page on CoinFinHub: https://www.coinfinhub.com/contact. Don't open a public issue for them.

Tell us what you found, how to reproduce it, and which version (tag) it affects. We'll confirm we've received it, keep you informed, and credit you in the release notes if you'd like.

In scope: this repository's code, and the built file served from `cdn.coinfinhub.com/widgets/…` and mirrored by jsDelivr from its tags (for example, a way to run script, inject HTML, send the link anywhere but a page on `https://www.coinfinhub.com`, or load an image from anywhere but `/coin-logos/…` on a `coinfinhub.com` host). The CoinFinHub website and its endpoint have their own report channel: the same contact page.

## Supported versions

The latest 1.x release gets fixes.

## How fixes are announced

Fixes ship as a new tag (for example `v1.0.1`), announced as a [GitHub release](https://github.com/coinfinhub/coinfinhub-widget/releases) and in [CHANGELOG.md](CHANGELOG.md). A security fix is marked as such in both.

A tag never changes once published, and snippets pin a version with an `integrity` hash. Pinned pages therefore don't update by themselves: to take a fix, change the version and the hash in your snippet to the new release's. If a problem can't wait for every site to update, CoinFinHub can also act on the server side, for example by changing what the endpoint sends.

## How releases are protected

- Tags `v*` can't be moved or deleted, and the default branch can't be force-pushed.
- `dist/` is checked against a fresh build by CI on every push, so a release carries exactly the code in its tag.
- GitHub Actions are pinned by commit, with the least permissions they need.
- The widgets have no runtime dependencies.
