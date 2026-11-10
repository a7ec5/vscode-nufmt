import { spawn } from "node:child_process";
import { SETTING_PATH } from "./settings";

const TIMEOUT_MS = 15_000;

export interface NufmtRequest {
  readonly executable: string;
  readonly cwd: string | undefined;
  readonly input: string;
  readonly signal: AbortSignal;
}

export type NufmtResult =
  | { readonly kind: "formatted"; readonly text: string }
  | { readonly kind: "cancelled" };

/**
 * A formatter failure: `message` is user-facing, `details` goes to the output channel.
 */
export class NufmtError extends Error {
  readonly details: string;

  constructor(message: string, details: string) {
    super(message);
    this.name = "NufmtError";
    this.details = details;
  }
}

export function formatWithNufmt(request: NufmtRequest): Promise<NufmtResult> {
  return new Promise<NufmtResult>((resolve, reject) => {
    const child = spawn(request.executable, ["--stdin"], {
      cwd: request.cwd,
      windowsHide: true,
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let cancelled = false;
    let timedOut = false;

    const details = (outcome: string): string => {
      const recordedStderr = stripAnsi(
        Buffer.concat(stderr).toString("utf8"),
      ).trim();
      const lines = [
        `command: ${request.executable} --stdin`,
        `cwd: ${request.cwd ?? "not set"}`,
        `outcome: ${outcome}`,
      ];
      if (recordedStderr.length > 0) {
        lines.push(`stderr: ${recordedStderr}`);
      }
      return lines.join("\n");
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, TIMEOUT_MS);

    const abort = (): void => {
      cancelled = true;
      child.kill();
    };
    request.signal.addEventListener("abort", abort, { once: true });

    const cleanup = (): void => {
      clearTimeout(timer);
      request.signal.removeEventListener("abort", abort);
    };

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    // A child that exits early breaks stdin; the close handler reports it.
    child.stdin.on("error", () => undefined);
    child.stdin.end(request.input, "utf8");

    child.on("error", (error: Error) => {
      cleanup();
      const code =
        "code" in error && typeof error.code === "string"
          ? error.code
          : undefined;
      if (code === "ENOENT") {
        reject(
          new NufmtError(
            `nufmt not found: "${request.executable}". Set "${SETTING_PATH}" to its location.`,
            details("executable not found"),
          ),
        );
        return;
      }
      reject(
        new NufmtError(
          `Could not run "${request.executable}": ${error.message}`,
          details(`spawn failed: ${error.message}`),
        ),
      );
    });

    child.on("close", (code, signal) => {
      cleanup();
      if (cancelled) {
        resolve({ kind: "cancelled" });
        return;
      }
      const outcome =
        code === null
          ? `terminated by signal ${signal ?? "unknown"}`
          : `exit code ${code}`;
      if (timedOut) {
        reject(
          new NufmtError(
            `nufmt timed out after ${TIMEOUT_MS / 1000} seconds.`,
            details(`timed out after ${TIMEOUT_MS} ms`),
          ),
        );
        return;
      }
      if (code === 0) {
        const text = Buffer.concat(stdout).toString("utf8");
        if (text.trim().length === 0) {
          reject(
            new NufmtError(
              `nufmt returned no output. Check "${SETTING_PATH}".`,
              details("exit code 0 with empty stdout"),
            ),
          );
          return;
        }
        resolve({ kind: "formatted", text });
        return;
      }
      const reported = stripAnsi(Buffer.concat(stderr).toString("utf8")).trim();
      reject(
        new NufmtError(
          reported.length > 0 ? reported : `nufmt exited with ${outcome}.`,
          details(outcome),
        ),
      );
    });
  });
}

function stripAnsi(text: string): string {
  return text.replace(/\u001B\[[0-9;]*[A-Za-z]/g, "");
}
