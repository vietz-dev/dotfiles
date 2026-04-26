set -g fish_greeting
set -gx EDITOR nvim
set -gx VISUAL nvim
set -gx PAGER less
set -gx BAT_THEME 'Catppuccin Frappe'
set -gx FZF_DEFAULT_OPTS '--color=bg+:#414559,bg:#303446,spinner:#f2d5cf,hl:#e78284 --color=fg:#c6d0f5,header:#e78284,info:#ca9ee6,pointer:#f2d5cf --color=marker:#f2d5cf,fg+:#c6d0f5,prompt:#ca9ee6,hl+:#e78284'
set -gx MANPAGER 'sh -c "col -bx | bat -l man -p"'

set -g fish_color_normal c6d0f5
set -g fish_color_command 8caaee
set -g fish_color_param c6d0f5
set -g fish_color_keyword ca9ee6
set -g fish_color_quote a6d189
set -g fish_color_redirection f2d5cf
set -g fish_color_end e78284
set -g fish_color_error e78284
set -g fish_color_gray 737994
set -g fish_color_selection --background=414559
set -g fish_color_search_match --background=51576d
set -g fish_color_operator 81c8be
set -g fish_color_escape eebebe
set -g fish_color_autosuggestion 737994
set -g fish_color_cancel e78284
set -g fish_color_cwd 8caaee
set -g fish_color_cwd_root ef9f76
set -g fish_color_valid_path a6d189
set -g fish_color_history_current --bold
set -g fish_pager_color_progress 737994
set -g fish_pager_color_prefix ca9ee6
set -g fish_pager_color_completion c6d0f5
set -g fish_pager_color_description 949cbb
set -g fish_pager_color_selected_background --background=414559

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
