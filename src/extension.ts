import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { formatWithNufmt, NufmtError, NufmtResult } from "./nufmt";
import { DEFAULT_EXECUTABLE, SETTING_PATH } from "./settings";

const LANGUAGE_ID = "nushell";
const OUTPUT_CHANNEL = "Nushell Formatter";

export function activate(context: vscode.ExtensionContext): void {
  const channel = vscode.window.createOutputChannel(OUTPUT_CHANNEL);
  const provider = new NushellFormattingProvider(channel);
  context.subscriptions.push(
    channel,
    vscode.languages.registerDocumentFormattingEditProvider(
      LANGUAGE_ID,
      provider,
    ),
  );
}

class NushellFormattingProvider
  implements vscode.DocumentFormattingEditProvider
{
  constructor(private readonly channel: vscode.OutputChannel) {}

  async provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    _options: vscode.FormattingOptions,
    token: vscode.CancellationToken,
  ): Promise<vscode.TextEdit[]> {
    const original = document.getText();
    if (original.trim().length === 0 || token.isCancellationRequested) {
      return [];
    }

    const controller = new AbortController();
    const cancellation = token.onCancellationRequested(() =>
      controller.abort(),
    );

    let result: NufmtResult;
    try {
      result = await formatWithNufmt({
        executable: executableFor(document),
        cwd: workingDirectoryFor(document),
        input: original,
        signal: controller.signal,
      });
    } catch (error) {
      this.report(error);
      return [];
    } finally {
      cancellation.dispose();
    }

    if (result.kind === "cancelled") {
      return [];
    }

    const formatted = withDocumentLineEnding(result.text, document.eol);
    if (formatted === original) {
      return [];
    }
    const range = new vscode.Range(
      document.positionAt(0),
      document.positionAt(original.length),
    );
    return [vscode.TextEdit.replace(range, formatted)];
  }

  // The editor does not surface provider rejections; failures need their own notification.
  private report(error: unknown): void {
    if (error instanceof NufmtError) {
      this.channel.appendLine(error.details);
      void vscode.window.showErrorMessage(error.message);
      return;
    }
    const message = describe(error);
    this.channel.appendLine(message);
    void vscode.window.showErrorMessage(`Formatting failed: ${message}`);
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function executableFor(document: vscode.TextDocument): string {
  const configured = vscode.workspace
    .getConfiguration(undefined, document.uri)
    .get<string>(SETTING_PATH, DEFAULT_EXECUTABLE)
    .trim();
  return configured.length > 0 ? configured : DEFAULT_EXECUTABLE;
}

function workingDirectoryFor(
  document: vscode.TextDocument,
): string | undefined {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (folder !== undefined) {
    return existingDirectory(folder.uri.fsPath);
  }
  return document.isUntitled
    ? undefined
    : existingDirectory(path.dirname(document.uri.fsPath));
}

function existingDirectory(candidate: string | undefined): string | undefined {
  return candidate !== undefined && fs.existsSync(candidate)
    ? candidate
    : undefined;
}

function withDocumentLineEnding(text: string, eol: vscode.EndOfLine): string {
  const normalized = text.replace(/\r\n/g, "\n");
  return eol === vscode.EndOfLine.CRLF
    ? normalized.replace(/\n/g, "\r\n")
    : normalized;
}
