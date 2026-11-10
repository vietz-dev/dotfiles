(( $+commands[mise] )) && eval "$(mise activate zsh)"

(( $+commands[tv] )) && eval "$(tv init zsh)"
# Atuin owns Ctrl-R; Television keeps its Ctrl-T autocomplete binding.
(( $+commands[atuin] )) && eval "$(atuin init zsh --disable-up-arrow)"
(( $+commands[zoxide] )) && eval "$(zoxide init zsh --cmd cd)"
