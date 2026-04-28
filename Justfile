set shell := ["bash", "-cu"]
set dotenv-load := false

_default:
    @just --list

# Show available tasks
help:
    @just --list

# Install/update packages from the deployed Brewfile
brew:
    brew bundle --file "$HOME/Brewfile"

# Run the deployed bootstrap steps against managed files in $HOME
bootstrap:
    just brew
    if command -v mise >/dev/null 2>&1; then mise trust "$HOME/.config/mise/config.toml" >/dev/null 2>&1 || true; mise install; fi
    if command -v fish >/dev/null 2>&1; then echo "[bootstrap] Fish installed at $(command -v fish)"; fi
    if command -v nvim >/dev/null 2>&1; then echo "[bootstrap] Neovim installed; plugins bootstrap on first launch"; fi
    echo "[bootstrap] Bootstrap complete"

# Show chezmoi health information
doctor:
    chezmoi doctor

# Show managed files that differ from the destination
status:
    chezmoi -S . status

# Show the source path for a destination path managed by chezmoi
source-path path:
    chezmoi -S . source-path {{path}}

# Preview pending changes

diff:
    chezmoi -S . diff

# Apply changes from this repo to the destination
apply:
    chezmoi -S . apply

# Preview then apply changes
update: diff apply

# Sync known live-managed files back into the repo source.
# Use this after commands like `mise use -g ...` that modify ~/.config directly.
sync:
    chezmoi -S . re-add "$HOME/.config/mise/config.toml"
    git status --short -- dot_config/mise/config.toml

# Show git status for the repo itself
repo-status:
    git status --short

# Format and validate common config files when tools are available
check:
    if command -v fish >/dev/null 2>&1; then fish --no-execute dot_config/fish/config.fish; fi
    if command -v taplo >/dev/null 2>&1; then taplo fmt --check dot_config/television/config.toml dot_config/atuin/config.toml; fi
