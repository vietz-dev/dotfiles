# dotfiles

This repository is intended to be the source of truth for environment configuration, managed with [chezmoi](https://www.chezmoi.io/).

## pi harness

A project-local pi extension lives at:

- `.pi/extensions/dotfiles-harness/index.ts`

Because it is inside `.pi/extensions/`, pi auto-discovers it whenever pi is started from this repository.

### What it does

- injects dotfiles-specific workflow guidance into pi
- keeps the repo as the source of truth
- blocks direct `write`/`edit` mutations to files under `$HOME` outside this repo
- blocks suspicious shell mutations like redirecting into `~/.zshrc`
- asks for confirmation before `chezmoi apply`
- adds a custom `chezmoi` tool for safe repo-aware inspection and apply flows
- adds helper commands:
  - `/dotfiles-help`
  - `/chezmoi-doctor`

## Bootstrap included

This repo now bootstraps:

- Ghostty
- fish
- zellij
- starship
- Homebrew via `~/Brewfile`
- mise via `~/.config/mise/config.toml`
- Neovim via `~/.config/nvim`
- git identity/config via a prompted private template

Key files:

- `dot_Brewfile.tmpl`
- `run_once_00_bootstrap.sh.tmpl`
- `run_once_01_set-default-shell.sh.tmpl`
- `dot_config/fish/config.fish`
- `dot_config/ghostty/config`
- `dot_config/zellij/config.kdl.tmpl`
- `dot_config/starship.toml`
- `dot_config/mise/config.toml`
- `dot_config/nvim/`
- `private_dot_config/git/config.tmpl`

### Workflow

1. Make changes in this repo.
2. Prefer `chezmoi status` / `chezmoi diff` before `chezmoi apply`.
3. Target macOS first.
4. Keep Linux compatibility when it is easy and sensible.
5. Prefer idempotent bootstrap and configuration flows.

### Apply

Typical first-time flow:

```bash
chezmoi init --apply <repo>
```

Or from an existing chezmoi source directory:

```bash
chezmoi apply
```

The bootstrap script will:

1. install Homebrew if needed
2. run `brew bundle --file "$HOME/Brewfile"`
3. run `mise install`
4. print fish login-shell guidance if needed
