# vscode-nufmt

> [!warning]
>
> This extension was developed mainly with AI assistance, including its code and documentation. Review the source before depending on it.

> [!caution]
> Force push expected.

Formats Nushell documents with your local [`nufmt`](https://github.com/nushell/nufmt). Requires the `nushell` language from [vscode-nushell-lang](https://marketplace.visualstudio.com/items?itemName=TheNuProjectContributors.vscode-nushell-lang).

This is a stopgap for [the missing formatter in vscode-nushell-lang](https://github.com/nushell/vscode-nushell-lang/issues/131), meant to be retired once upstream provides one.

## Configuration

- `nufmt.path` (default `nufmt`): `nufmt` executable, an absolute path or a bare name resolved through `PATH`.
- `nufmt` runs at the project root; a `nufmt.nuon` there applies, and subdirectory configurations are ignored.

## Limitations

Whole-document formatting only; `.nuon` files are not handled.
