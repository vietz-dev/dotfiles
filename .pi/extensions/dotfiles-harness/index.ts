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
    }

    if (event.toolName === "bash" && typeof event.input?.command === "string") {
      const command = event.input.command;

      if (suspiciousHomeMutation(command)) {
        return {
          block: true,
          reason: "Blocked a direct shell mutation under ~/. Update the chezmoi source files in this repo, then use chezmoi diff/apply.",
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
