import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";
import { Text } from "@mariozechner/pi-tui";
import { homedir } from "node:os";
import { relative, resolve } from "node:path";

type ChezmoiAction =
  | "status"
  | "managed-files"
  | "source-path"
  | "diff"
  | "doctor"
  | "apply";

const HOME = homedir();
const MAX_OUTPUT_BYTES = 50 * 1024;
const MAX_OUTPUT_LINES = 2000;

const SENSITIVE_PATH_PATTERNS = [
  /(^|\/)\.ssh(\/|$)/i,
  /(^|\/)\.gnupg(\/|$)/i,
  /(^|\/)\.aws(\/|$)/i,
  /(^|\/)\.kube(\/|$)/i,
  /(^|\/)\.docker(\/|$)/i,
  /(^|\/)\.config\/gh(\/|$)/i,
  /(^|\/)\.config\/op(\/|$)/i,
  /(^|\/)\.config\/1password(\/|$)/i,
  /(^|\/)\.config\/gcloud(\/|$)/i,
  /(^|\/)\.netrc$/i,
  /(^|\/)\.npmrc$/i,
  /(^|\/)\.pypirc$/i,
  /(^|\/)\.env(\.|$)/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /(^|\/)(authorized_keys|known_hosts)$/i,
  /(^|\/)(credentials|config)\.json$/i,
];

const SENSITIVE_CONTENT_PATTERNS = [
  /-----BEGIN (?:RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY-----/,
  /(?:^|\n)\s*password\s*=\s*[^\s]+/i,
  /(?:^|\n)\s*passwd\s*=\s*[^\s]+/i,
  /(?:^|\n)\s*secret\s*=\s*[^\s]+/i,
  /(?:^|\n)\s*token\s*=\s*[^\s]+/i,
  /(?:^|\n)\s*api[_-]?key\s*=\s*[^\s]+/i,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /sk-[A-Za-z0-9]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
  /AIza[0-9A-Za-z\-_]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /ASIA[0-9A-Z]{16}/,
];

const PUBLIC_REPO_SAFETY_GUIDANCE = [
  "Public repo safety rules:",
  "- Treat this repository as public. Do not add private information, credentials, tokens, or secret material.",
  "- Never sync private SSH keys, GPG keys, cloud credentials, auth tokens, or other secrets into this repo.",
  "- If a user asks to store sensitive files here, refuse and suggest a safe alternative such as 1Password, Keychain, age/sops, or chezmoi templates that read secrets from a secure source at apply time.",
  "- Prefer committing redacted examples, templates, or documented setup steps instead of real secret values.",
].join("\n");

function stripAtPrefix(path: string): string {
  return path.startsWith("@") ? path.slice(1) : path;
}

function isWithin(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`));
}

function resolvePathFromCwd(ctx: ExtensionContext, path: string): string {
  return resolve(ctx.cwd, stripAtPrefix(path));
}

function shouldBlockManagedHomePath(ctx: ExtensionContext, path: string): boolean {
  const absolute = resolvePathFromCwd(ctx, path);
  return isWithin(HOME, absolute) && !isWithin(ctx.cwd, absolute);
}

function truncateOutput(output: string): { text: string; truncated: boolean } {
  const lines = output.split("\n");
  const limitedLines = lines.slice(-MAX_OUTPUT_LINES);
  let text = limitedLines.join("\n");
  let truncated = lines.length > MAX_OUTPUT_LINES;

  if (Buffer.byteLength(text, "utf8") > MAX_OUTPUT_BYTES) {
    const buffer = Buffer.from(text, "utf8");
    text = buffer.subarray(buffer.length - MAX_OUTPUT_BYTES).toString("utf8");
    truncated = true;
  }

  if (truncated) {
    text = `[output truncated to last ${MAX_OUTPUT_LINES} lines / ${Math.floor(MAX_OUTPUT_BYTES / 1024)}KB]\n${text}`;
  }

  return { text, truncated };
}

function commandOutput(stdout: string, stderr: string): string {
  const parts = [];
  if (stdout.trim()) parts.push(stdout.trimEnd());
  if (stderr.trim()) parts.push(stderr.trimEnd());
  return parts.join(parts.length === 2 ? "\n\n--- stderr ---\n" : "");
}

function suspiciousHomeMutation(command: string): boolean {
  const patterns = [
    /(^|\s)(>|>>).*~\//,
    /tee\s+.*~\//,
    /\brm\s+.*~\//,
    /\bmv\s+.*~\//,
    /\bcp\s+.*~\//,
    /\bsed\s+-i(?:\s|=).*~\//,
    /\bperl\s+-i(?:\s|=).*~\//,
    /\bln\s+-s.*~\//,
  ];

  return patterns.some((pattern) => pattern.test(command));
}

function workflowGuidance(cwd: string): string {
  return [
    "Dotfiles workflow for this repository:",
    `- Repository root: ${cwd}`,
    "- This repo is the source of truth for environment configuration.",
    "- Use chezmoi-first workflows: edit source files in the repo, not live files in $HOME.",
    "- Prefer macOS-compatible defaults, but keep Linux compatibility when practical.",
    "- When adding a managed file, favor chezmoi naming conventions such as dot_*, private_*, exact_*, and .tmpl where appropriate.",
    "- Prefer dry-run and diff checks before apply operations.",
    "- For package managers and tooling, keep bootstrap steps automatable and idempotent.",
    "",
    PUBLIC_REPO_SAFETY_GUIDANCE,
  ].join("\n");
}

async function ensureChezmoi(pi: ExtensionAPI, signal?: AbortSignal) {
  const result = await pi.exec("bash", ["-lc", "command -v chezmoi >/dev/null 2>&1"], { signal, timeout: 5_000 });
  if (result.code !== 0) {
    throw new Error("chezmoi is not installed or not available on PATH");
  }
}

function chezmoiCommand(ctx: ExtensionContext, args: string): string {
  return `chezmoi -S ${JSON.stringify(ctx.cwd)} ${args}`;
}

function isSensitivePath(path: string): boolean {
  return SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

function containsSensitiveContent(content: string): boolean {
  return SENSITIVE_CONTENT_PATTERNS.some((pattern) => pattern.test(content));
}

function extractProposedContent(event: { toolName: string; input?: Record<string, unknown> }): string {
  if (event.toolName === "write" && typeof event.input?.content === "string") {
    return event.input.content;
  }

  if (event.toolName === "edit" && Array.isArray(event.input?.edits)) {
    return event.input.edits
      .map((edit) => (edit && typeof edit === "object" && typeof (edit as { newText?: unknown }).newText === "string" ? (edit as { newText: string }).newText : ""))
      .join("\n");
  }

  return "";
}

function suspiciousSensitiveSyncCommand(command: string): boolean {
  const normalized = command.replace(/\\\n/g, " ");
  const mentionsSensitiveSource = [
    /~\/\.ssh\b/,
    /~\/\.gnupg\b/,
    /~\/\.aws\b/,
    /~\/\.kube\b/,
    /~\/\.docker\b/,
    /~\/\.netrc\b/,
    /~\/\.npmrc\b/,
    /~\/\.pypirc\b/,
    /~\/\.env(?:\.|\b)/,
    /id_(rsa|dsa|ecdsa|ed25519)(\.pub)?\b/i,
  ].some((pattern) => pattern.test(normalized));

  const copiesOrPrints = /\b(cp|mv|rsync|install|cat|tee|base64|tar|zip|scp)\b/.test(normalized);
  return mentionsSensitiveSource && copiesOrPrints;
}

export default function dotfilesHarness(pi: ExtensionAPI) {
  pi.registerMessageRenderer("dotfiles-harness", (message, options, theme) => {
    let text = theme.fg("accent", "[dotfiles-harness]\n");
    text += String(message.content ?? "");
    if (options.expanded && message.details) {
      text += `\n\n${theme.fg("dim", JSON.stringify(message.details, null, 2))}`;
    }
    return new Text(text, 0, 0);
  });

  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      ctx.ui.setStatus("dotfiles-harness", "dotfiles · chezmoi-first · macOS primary · Linux-friendly");
      ctx.ui.setWidget("dotfiles-harness", [
        "Dotfiles harness active:",
        "• edit source files in this repo",
        "• use chezmoi status/diff before apply",
        "• target macOS first, keep Linux in mind",
        "• never commit secrets or private identity material",
      ]);
    }
  });

  pi.on("before_agent_start", async (event, _ctx) => {
    return {
      systemPrompt: `${event.systemPrompt}\n\n${workflowGuidance(event.systemPromptOptions.cwd)}`,
    };
  });

  pi.on("tool_call", async (event, ctx) => {
    if ((event.toolName === "write" || event.toolName === "edit") && typeof event.input?.path === "string") {
      if (shouldBlockManagedHomePath(ctx, event.input.path)) {
        return {
          block: true,
          reason: `Blocked direct mutation of ${event.input.path}. Edit the chezmoi source file in ${ctx.cwd} instead of mutating files under ${HOME}.`,
        };
      }

      if (isSensitivePath(event.input.path)) {
        return {
          block: true,
          reason: "Blocked writing sensitive material into this public dotfiles repo. Do not commit SSH keys, GPG keys, cloud credentials, tokens, or similar files. Use a safe alternative such as 1Password, Keychain, age/sops, or a chezmoi template that reads secrets from a secure source at apply time.",
        };
      }

      const proposedContent = extractProposedContent(event as { toolName: string; input?: Record<string, unknown> });
      if (proposedContent && containsSensitiveContent(proposedContent)) {
        return {
          block: true,
          reason: "Blocked content that looks like a secret or private key. This repository is public, so commit a redacted template or setup instructions instead of real credentials.",
        };
      }
    }

    if (event.toolName === "bash" && typeof event.input?.command === "string") {
      const command = event.input.command;

      if (suspiciousHomeMutation(command)) {
        return {
          block: true,
          reason: "Blocked a direct shell mutation under ~/. Update the chezmoi source files in this repo, then use chezmoi diff/apply.",
        };
      }

      if (suspiciousSensitiveSyncCommand(command)) {
        return {
          block: true,
          reason: "Blocked a command that appears to copy or print sensitive user material such as SSH keys or credentials. This repo is public. Use a secure secret manager or encrypted secret workflow instead, and commit only templates or redacted examples.",
        };
      }

      if (/\bchezmoi\s+apply\b/.test(command) && !/\b(--dry-run|-n)\b/.test(command)) {
        if (!ctx.hasUI) {
          return {
            block: true,
            reason: "Blocked non-interactive 'chezmoi apply' without --dry-run. Use a dry run first or the custom chezmoi tool with confirmApply.",
          };
        }

        const ok = await ctx.ui.confirm(
          "Apply chezmoi changes?",
          "This will update live files in your home directory. Continue?",
        );
        if (!ok) {
          return { block: true, reason: "chezmoi apply cancelled by user" };
        }
      }
    }
  });

  pi.registerCommand("dotfiles-help", {
    description: "Show the dotfiles workflow used in this repository",
    handler: async (_args, ctx) => {
      const text = workflowGuidance(ctx.cwd);
      if (ctx.hasUI) {
        ctx.ui.setEditorText(text);
        ctx.ui.notify("Loaded dotfiles workflow guidance into the editor", "info");
      }
    },
  });

  pi.registerCommand("chezmoi-doctor", {
    description: "Run chezmoi doctor in this repository",
    handler: async (_args, ctx) => {
      await ensureChezmoi(pi);
      const result = await pi.exec("bash", ["-lc", chezmoiCommand(ctx, "doctor")], { timeout: 30_000 });
      const rendered = truncateOutput(commandOutput(result.stdout, result.stderr) || "chezmoi doctor completed with no output");
      if (ctx.hasUI) ctx.ui.notify(result.code === 0 ? "chezmoi doctor completed" : "chezmoi doctor reported issues", result.code === 0 ? "info" : "warning");
      pi.sendMessage({
        customType: "dotfiles-harness",
        content: rendered.text,
        display: true,
        details: { command: "chezmoi doctor", exitCode: result.code },
      });
    },
  });

  pi.registerTool({
    name: "chezmoi",
    label: "Chezmoi",
    description: "Inspect and safely apply this dotfiles repository with chezmoi. Supports status, managed-files, source-path, diff, doctor, and apply.",
    promptSnippet: "Inspect the dotfiles repo with chezmoi and prefer status/diff before apply.",
    promptGuidelines: [
      "Use chezmoi for repo-aware dotfiles inspection and apply flows instead of mutating live files under ~/. directly.",
      "Use chezmoi with action status or diff before chezmoi action apply unless the user explicitly asks to apply changes.",
      "Treat this repo as public: do not add secrets, private keys, tokens, or personal credentials.",
      "If asked to store sensitive files such as SSH keys, refuse and suggest a secure alternative like 1Password, Keychain, age/sops, or secret-backed chezmoi templates.",
    ],
    parameters: Type.Object({
      action: StringEnum(["status", "managed-files", "source-path", "diff", "doctor", "apply"] as const),
      path: Type.Optional(Type.String({
        description: "Optional path for source-path lookups, relative to the current working directory",
      })),
      confirmApply: Type.Optional(Type.Boolean({
        description: "Required and must be true before action=apply is allowed",
        default: false,
      })),
    }),
    async execute(_toolCallId, params: { action: ChezmoiAction; path?: string; confirmApply?: boolean }, signal, _onUpdate, ctx) {
      await ensureChezmoi(pi, signal);

      let command = "";
      switch (params.action) {
        case "status":
          command = chezmoiCommand(ctx, "status");
          break;
        case "managed-files":
          command = chezmoiCommand(ctx, "managed");
          break;
        case "source-path": {
          const inputPath = params.path?.trim();
          if (!inputPath) throw new Error("path is required for action=source-path");
          command = chezmoiCommand(ctx, `source-path ${JSON.stringify(inputPath)}`);
          break;
        }
        case "diff":
          command = chezmoiCommand(ctx, "diff");
          break;
        case "doctor":
          command = chezmoiCommand(ctx, "doctor");
          break;
        case "apply":
          if (!params.confirmApply) {
            throw new Error("Refusing to run chezmoi apply without confirmApply=true");
          }
          if (ctx.hasUI) {
            const ok = await ctx.ui.confirm(
              "Apply chezmoi changes?",
              "This will write the current source state to your live environment. Continue?",
            );
            if (!ok) {
              return {
                content: [{ type: "text", text: "chezmoi apply cancelled by user" }],
                details: { command: "chezmoi apply", cancelled: true },
              };
            }
          }
          command = chezmoiCommand(ctx, "apply");
          break;
      }

      const result = await pi.exec("bash", ["-lc", command], { signal, timeout: params.action === "apply" ? 120_000 : 30_000 });
      const raw = commandOutput(result.stdout, result.stderr) || `${params.action} completed with no output`;
      const rendered = truncateOutput(raw);

      return {
        content: [{ type: "text", text: rendered.text }],
        details: {
          action: params.action,
          command,
          exitCode: result.code,
          truncated: rendered.truncated,
        },
      };
    },
  });
}
