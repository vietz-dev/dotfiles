# Shared by login and interactive shells; no prompt, hooks, or keybindings here.
export EDITOR=nvim
export VISUAL=nvim
export PAGER=less
export BAT_THEME='Catppuccin Frappe'
export FZF_DEFAULT_OPTS='--color=bg+:#414559,bg:#303446,spinner:#f2d5cf,hl:#e78284 --color=fg:#c6d0f5,header:#e78284,info:#ca9ee6,pointer:#f2d5cf --color=marker:#f2d5cf,fg+:#c6d0f5,prompt:#ca9ee6,hl+:#e78284'
export MANPAGER='sh -c "col -bx | bat -l man -p"'

if [[ $OSTYPE == darwin* ]]; then
    export PNPM_HOME="$HOME/Library/pnpm"
else
    export PNPM_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/pnpm"
fi

# Also support non-login panes; keep PATH unique when both startup files run.
typeset -gU path
for _zsh_bin in /opt/homebrew/bin /opt/homebrew/sbin /home/linuxbrew/.linuxbrew/bin /home/linuxbrew/.linuxbrew/sbin; do
    [[ -d $_zsh_bin ]] && path=("$_zsh_bin" $path)
done
[[ -d $HOME/.local/bin ]] && path=("$HOME/.local/bin" $path)
path+=("$HOME/.docker/bin" "$PNPM_HOME/bin" "$PNPM_HOME")
[[ $OSTYPE == darwin* ]] && path+=(/Applications/love.app/Contents/MacOS)
unset _zsh_bin
export PATH
