mkcd() {
    if (( $# != 1 )); then
        print -u2 'Usage: mkcd <directory>'
        return 1
    fi
    mkdir -p -- "$1" && cd -- "$1"
}
