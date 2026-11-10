# Register Homebrew completions before initializing completion. Tool init below
# may call compdef, so compinit must finish first.
for _zsh_completions in /opt/homebrew/share/zsh/site-functions /usr/local/share/zsh/site-functions /home/linuxbrew/.linuxbrew/share/zsh/site-functions; do
    [[ -d $_zsh_completions ]] && fpath=("$_zsh_completions" $fpath)
done
unset _zsh_completions
typeset -gU fpath
autoload -Uz compinit
compinit
