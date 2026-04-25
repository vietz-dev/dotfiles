set -g fish_greeting
set -gx EDITOR nvim
set -gx VISUAL nvim
set -gx PAGER less
set -gx MANPAGER 'sh -c "col -bx | bat -l man -p"'

if test -d $HOME/.local/bin
    fish_add_path --move --path $HOME/.local/bin
end

if test -d /opt/homebrew/bin
    fish_add_path --move --path /opt/homebrew/bin /opt/homebrew/sbin
end

if test -d /home/linuxbrew/.linuxbrew/bin
    fish_add_path --move --path /home/linuxbrew/.linuxbrew/bin /home/linuxbrew/.linuxbrew/sbin
end

if type -q mise
    mise activate fish | source
end

if type -q starship
    starship init fish | source
end

if type -q zoxide
    zoxide init fish | source
end

alias vim='nvim'
alias vi='nvim'
alias ls='eza --group-directories-first'
alias ll='eza -lah --group-directories-first'
alias la='eza -a --group-directories-first'
alias cat='bat'
alias lg='lazygit'
alias zj='zellij'

function mkcd
    mkdir -p $argv[1]
    and cd $argv[1]
end
