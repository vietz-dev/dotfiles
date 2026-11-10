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
- Zsh (Fish config remains as an optional fallback)
- zellij
- starship
- Homebrew via `~/Brewfile`
- mise via `~/.config/mise/config.toml`
- Neovim via `~/.config/nvim`
- git identity/config via a private config file template

Theme direction:

- Catppuccin Frappe across Ghostty, starship, zellij, Neovim, and bat

Key files:

- `Justfile`
- `Brewfile.tmpl`
- `run_once_00_bootstrap.sh.tmpl`
- `run_once_01_set-default-shell.sh.tmpl`
- `dot_zprofile`, `dot_zshrc`, and `dot_config/zsh/env.zsh`
- `dot_config/fish/` (optional fallback)
- `dot_config/ghostty/config`
- `dot_config/zellij/config.kdl.tmpl`
- `dot_config/starship.toml`
- `dot_config/mise/config.toml`
- `dot_config/nvim/`
- `dot_config/git/private_config`

### Workflow

1. Make changes in this repo.
2. Prefer `just status` / `just diff` before `just apply`.
3. After live edits to global mise config (for example `mise use -g kubie`), run `just sync` to import `~/.config/mise/config.toml` back into the repo.
4. Target macOS first.
5. Keep Linux compatibility when it is easy and sensible.
6. Prefer idempotent bootstrap and configuration flows.

### Apply

Recommended workflow for this repository:

```bash
just diff
just apply
```

When adding or changing global mise tools in the normal way:

```bash
mise use -g kubie
just sync
git diff -- dot_config/mise/config.toml
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
4. print Zsh login-shell guidance without changing your account

### Switching an existing machine to Zsh

After reviewing and applying the shell configuration, run `chsh -s /bin/zsh`
on macOS, then open a new login session. The `run_once` guidance script may
already have run on an existing machine, so applying these files alone does
not change your account login shell. On Linux, use `command -v zsh` to find
the installed path and check that it is in `/etc/shells` before passing it to
`chsh -s`.

Ghostty explicitly launches Zsh, and Zellij and Television use Zsh too.
`~/.zprofile` initializes Homebrew for login shells; shared environment and
paths are loaded by both the profile and `~/.zshrc`, so non-login panes work.
Interactive shells initialize completion before mise, Starship, Television,
Atuin, and zoxide. Television uses Ctrl-T and Atuin owns Ctrl-R; the up arrow
keeps normal history navigation. Azure shortcuts from Fish are Zsh aliases.

Zsh packages live in `dot_config/zsh/`: `env.zsh`, `history.zsh`,
`completion.zsh`, `aliases.zsh`, `functions.zsh`, `theme.zsh`, and
`integrations.zsh`. `dot_zshrc` sources them in an explicit order. Keep
packages flat while they are small; if aliases grow, split them into files
such as `aliases/k8s.zsh` and `aliases/azcli.zsh`, sourced by `aliases.zsh`.
`just check` validates packages recursively.

Fish configuration is retained for manual fallback (`fish` if installed).
Bootstrap no longer installs Fish, and this migration does not uninstall it.

### Notes

- `~/.config/git/config` is initialized with placeholder values. Update `dot_config/git/private_config` with your real name and email, then run `chezmoi -S . apply` again.
- `.chezmoiignore` excludes repo-only files like `README.md`, `.git`, and `.pi` from being managed into `$HOME`.
