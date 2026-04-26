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
- git identity/config via a private config file template

Theme direction:

- Catppuccin Frappe across Ghostty, fish, starship, zellij, Neovim, and bat

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
- `dot_config/git/private_config`

### Workflow

1. Make changes in this repo.
2. Prefer `chezmoi status` / `chezmoi diff` before `chezmoi apply`.
3. Target macOS first.
4. Keep Linux compatibility when it is easy and sensible.
5. Prefer idempotent bootstrap and configuration flows.

### Apply

Recommended workflow for this repository:

```bash
chezmoi -S . diff
chezmoi -S . apply
```

To make this repository the default chezmoi source on this machine:

```bash
mkdir -p ~/.config/chezmoi
cat > ~/.config/chezmoi/chezmoi.toml <<'EOF'
sourceDir = "/Users/justinv/Workspace/dotfiles"
EOF
```

After that, plain `chezmoi diff` / `chezmoi apply` will work from anywhere.

The bootstrap script will:

1. install Homebrew if needed
2. run `brew bundle --file "$HOME/Brewfile"`
3. run `mise install`
4. print fish login-shell guidance if needed

### Notes

- `~/.config/git/config` is initialized with placeholder values. Update `dot_config/git/private_config` with your real name and email, then run `chezmoi -S . apply` again.
- `.chezmoiignore` excludes repo-only files like `README.md`, `.git`, and `.pi` from being managed into `$HOME`.
