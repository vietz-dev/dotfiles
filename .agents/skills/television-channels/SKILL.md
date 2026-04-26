---
name: "television-channels"
description: "Create, modify, and troubleshoot Television channel TOML files. Use when the user wants a new tv channel, wants to customize preview/output/keybindings/actions, or needs help debugging a Television channel. Focus on the 80/20 of channel authoring: metadata, source, preview, UI, keybindings, actions, and practical template usage."
---

# Television Channels

Use this skill when the user wants to create or update a [Television](https://alexpasmantier.github.io/television/) **channel**.

A Television channel is usually a single TOML file that defines:
- what command produces entries
- how entries are displayed
- what gets returned on selection
- how previews work
- optional UI, keybindings, and actions

This skill is intentionally optimized for the **80/20** of channel work. If the requested behavior goes beyond this skill, consult:
- Channels guide: https://alexpasmantier.github.io/television/user-guide/channels/
- Template system: https://alexpasmantier.github.io/television/advanced/template-system
- Tips and tricks: https://alexpasmantier.github.io/television/advanced/tips-and-tricks/
- Troubleshooting: https://alexpasmantier.github.io/television/advanced/troubleshooting

## Outcomes

When using this skill, aim to produce one of these:
1. A new channel TOML file
2. An update to an existing channel TOML file
3. A debugging/fix pass for a broken channel
4. A compact explanation of how the channel works and how to test it

## Guardrails

Always follow these rules:

1. **Check for an existing community channel before creating a new one.** First consult the Unix community channels page: https://alexpasmantier.github.io/television/community/channels-unix. If an existing channel already solves the request or is a strong starting point, prefer adapting it over inventing a new one from scratch.
2. **Prefer simple channels first.** Start with `metadata`, `source`, and optionally `preview`.
3. **Do not invent unsupported fields.** Stick to documented sections: `metadata`, `source`, `preview`, `ui`, `keybindings`, `actions`.
4. **Make commands testable outside tv.** Every `source.command` and `preview.command` should be runnable directly in a shell.
5. **Keep requirements explicit.** If a channel depends on `fd`, `rg`, `bat`, `git`, `docker`, `kubectl`, etc., include them in `metadata.requirements`.
6. **Prefer stable delimiters.** If output has multiple fields, use a clear delimiter like `:` or `\t`, then parse it with templates.
7. **Use ANSI only when needed.** If `source.command` outputs colors, set `source.ansi = true` and usually use `strip_ansi` in `output` or template processing.
8. **Do not over-template.** If `{}` works, use `{}`. Only add `split`, `map`, `filter`, regexes, etc. when needed.
9. **Preview commands must be robust.** Quote interpolated values where practical.
10. **Default to channel-local behavior.** Avoid global config edits unless the user asked for them.
11. **When debugging, test the raw shell commands first** before changing templates or keybindings.

## Channel Authoring Workflow

### 1. Check for an existing community channel
Before creating a new channel, review the Unix community channels page:
- https://alexpasmantier.github.io/television/community/channels-unix

Workflow:
- if an existing channel already matches the request, prefer reusing or lightly adapting it
- if an existing channel is close, use it as the structural template
- only create a brand new channel when no community channel is a good fit

When relevant, mention the closest existing community channel you considered.

### 2. Clarify the intent
If the user request is ambiguous, infer the minimum needed shape from context. A good channel design usually answers:
- What list should tv search through?
- What should be shown in the results list?
- What should be returned when the user presses Enter?
- Is a preview needed?
- Are custom actions needed?

### 3. Pick the simplest source format
Prefer one of these source shapes:

- **Single-field entries**
  - Example: file paths
  - Best when `{}` is enough for output and preview

- **Delimited entries**
  - Example: `file:line:text` or `id\tname\tstatus`
  - Best when display/output/preview each need different pieces

### 4. Start from this minimal skeleton

```toml
[metadata]
name = "my-channel"
description = "What this channel selects"
requirements = ["some-binary"]

[source]
command = "echo 'replace me'"
```

Then add only the sections that solve the user request.

## Default Patterns

### Pattern: simple file picker

```toml
[metadata]
name = "files"
description = "Select files"
requirements = ["fd", "bat"]

[source]
command = "fd -t f"

[preview]
command = "bat -n --color=always '{}'"
env = { BAT_THEME = "ansi" }
```

Use this pattern when entries are already valid paths.

### Pattern: structured grep/search results

```toml
[metadata]
name = "search"
description = "Search text results"
requirements = ["rg", "bat"]

[source]
command = "rg --line-number --no-heading --color=always ."
output = "{strip_ansi|split:\\::..2}"
ansi = true

[preview]
command = "bat -H '{split:\\::1}' --color=always '{split:\\::0}'"
offset = "{split:\\::1}"
```

Use this when results look like `file:line:match`.

### Pattern: tab-delimited records

```toml
[source]
command = "docker ps --format '{{.ID}}\\t{{.Names}}\\t{{.Status}}'"
display = "{split:\\t:1} ({split:\\t:2})"
output = "{split:\\t:0}"
```

Use tabs when fields may contain spaces.

### Pattern: multiple source commands

```toml
[source]
command = ["fd -t f", "fd -t f -H", "fd -t f -H -I"]
```

Use source cycling only when it clearly improves the channel. Mention that `Ctrl+S` cycles sources.

### Pattern: multiple preview commands

```toml
[preview]
command = ["bat -n --color=always '{}'", "cat '{}'", "head -50 '{}'"]
```

Use preview cycling when the user wants alternate preview modes. Mention that `Ctrl+F` cycles previews.

## 80/20 Field Reference

### `[metadata]`
Use for identity and dependencies.

```toml
[metadata]
name = "git-branches"
description = "Select a git branch"
requirements = ["git"]
```

Rules:
- `name` should match the intended channel name
- `description` should be short and practical
- `requirements` should list external binaries the channel needs

### `[source]`
Defines the list being searched.

Common fields:
- `command`
- `display`
- `output`
- `ansi`
- `watch`
- `no_sort`
- `frecency`

Use these defaults:
- leave `display` unset unless the raw entry is too noisy
- set `output` when the selected value should differ from the displayed row
- set `ansi = true` only for colored command output
- use `watch` for live/refreshing sources like `docker ps`
- use `no_sort = true` when source order matters, like history or logs
- use `frecency = false` when source order is meaningful and should not be re-ranked

### `[preview]`
Add this when the selected entry benefits from extra detail.

Common fields:
- `command`
- `env`
- `offset`

Preview guidance:
- quote file-like arguments
- use `offset` for line-oriented previews
- keep preview commands fast
- if preview is expensive or unnecessary, omit it

### `[ui]`
Only customize UI when the request asks for it.

Useful fields:
- `ui_scale`
- `layout`
- `input_bar_position`
- `input_header`

Useful panel sections:
- `[ui.preview_panel]`
- `[ui.status_bar]`
- `[ui.help_panel]`
- `[ui.remote_control]`

Avoid unnecessary UI customization by default.

### `[keybindings]`
Add only the bindings the user asked for.

Examples:

```toml
[keybindings]
shortcut = "f1"
confirm_selection = "enter"
ctrl-e = "actions:edit"
ctrl-r = ["reload_source", "copy_entry_to_clipboard"]
```

Rules:
- use lowercase key syntax like `ctrl-a`
- keep overrides minimal
- remember channel keybindings can override global ones

### `[actions]`
Use actions when the user wants extra operations on entries.

```toml
[keybindings]
ctrl-e = "actions:edit"

[actions.edit]
description = "Open selected files in editor"
command = "nvim {}"
mode = "execute"
```

Execution modes:
- `fork`: run a subprocess and return to tv
- `execute`: replace the process

Use `separator` only when multi-select processing needs a custom join character.

## Templates: Practical Rules

Television templates are most useful in these places:
- `source.display`
- `source.output`
- `preview.command`
- `preview.header` / `preview.footer`
- `actions.*.command`

### Start simple
- whole entry: `{}`
- space-delimited field: `{0}`, `{1}`
- explicit delimiter: `{split:\t:0}` or `{split:\::1}`

### Most useful operations
- `split`
- `strip_ansi`
- `trim`
- `prepend` / `append`
- `regex_extract`
- `join`
- `map`
- `filter`
- `sort`

### High-value examples

Strip ANSI and extract `file:line` from ripgrep output:

```toml
output = "{strip_ansi|split:\\::..2}"
```

Use file and line in preview:

```toml
command = "bat -H '{split:\\::1}' --color=always '{split:\\::0}'"
```

Show a friendly label but return an ID:

```toml
display = "{split:\\t:1} ({split:\\t:2})"
output = "{split:\\t:0}"
```

### Template debugging heuristics
If templates seem broken:
1. print or run the raw source command first
2. inspect the actual delimiter in the raw output
3. reduce to `{}`
4. add one operation at a time
5. use `strip_ansi` when colored output is involved
6. prefer `\t` over spaces for machine-parsed multi-field output

## Performance Defaults

Prefer these choices unless the user needs more:
- keep `source.command` fast
- avoid huge result sets when possible
- use `--exact` or recommend exact matching for very large datasets
- use `watch` only for truly live data
- skip previews when not needed
- if memory or speed becomes an issue, limit source output upstream

Examples:
- `fd --max-results 10000`
- `head -n 100`
- `tv my-channel --no-preview`

## Troubleshooting Playbook

When a channel does not work, use this order:

### 1. Verify the channel exists
- `tv list-channels`
- ensure the TOML file is in the cable directory or the configured cable dir

### 2. Run the source command directly
- execute `source.command` in the shell
- confirm it returns rows
- confirm required binaries exist
- confirm the working directory is correct

### 3. Validate the preview command directly
- substitute a real sample value
- confirm quoted paths and arguments work
- confirm required preview tools exist

### 4. Simplify templates
- replace `display`, `output`, or preview template usage with `{}`
- add one split or transform at a time

### 5. Check keybindings and UI assumptions
- use lowercase key names
- remember some terminals intercept keys
- remember preview can be hidden or disabled

### 6. Inspect logs and debug mode when needed
- Linux: `~/.local/share/television/television.log`
- macOS: `~/Library/Application Support/television/television.log`
- Windows: `%LocalAppData%\television\data\television.log`
- `RUST_LOG=debug tv <channel>`

## Output Style When Fulfilling a User Request

When creating a new channel for the user:
1. write the TOML file
2. keep it minimal unless the user requested more
3. explain the source/display/output/preview choices in a few bullets
4. include a test command such as:

```sh
tv my-channel
```

5. if relevant, include a direct shell test for the source command

## Good Defaults for Common Requests

### Files
- source: `fd -t f`
- preview: `bat -n --color=always '{}'`

### Directories
- source: `fd -t d`
- output: usually `{}`

### Ripgrep search
- source: `rg --line-number --no-heading --color=always .`
- `ansi = true`
- preview with `bat -H`

### Git branches
- source should emit a stable branch identifier
- preview can show recent commits for the branch

### Docker / Kubernetes / processes
- prefer tab-delimited source output
- use `watch` when the user wants live updates
- return IDs, display human-friendly names/status

## When This Skill Is Not Enough

Consult the upstream docs when the user asks for:
- advanced template edge cases
- unusual escaping or regex behavior
- obscure UI panel configuration
- shell integration trigger tuning
- advanced action picker or expect-key flows
- special CLI runtime flags beyond normal channel authoring

Use these pages directly:
- Channels: https://alexpasmantier.github.io/television/user-guide/channels/
- Template system: https://alexpasmantier.github.io/television/advanced/template-system
- Tips and tricks: https://alexpasmantier.github.io/television/advanced/tips-and-tricks/
- Troubleshooting: https://alexpasmantier.github.io/television/advanced/troubleshooting
