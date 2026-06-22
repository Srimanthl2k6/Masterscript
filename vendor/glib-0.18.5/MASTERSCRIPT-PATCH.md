# MasterScript glib 0.18.5 backport

Tauri 2.11.3's Linux GTK3 stack currently requires glib 0.18.5. This vendored
copy applies the two-line fix from
[gtk-rs-core pull request 1343](https://github.com/gtk-rs/gtk-rs-core/pull/1343)
for [RUSTSEC-2024-0429 / GHSA-wrw7-89jp-8q8g](https://rustsec.org/advisories/RUSTSEC-2024-0429.html).

The patch passes the variadic GLib out-parameter as `&mut p` instead of writing
through an immutable reference. Remove this override once the supported Tauri
Linux dependency graph uses glib 0.20 or newer.

The upstream copyright and MIT license are retained in this directory.
