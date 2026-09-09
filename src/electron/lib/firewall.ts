import { app } from "electron";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";

const execFileAsync = promisify(execFile);

export const FIREWALL_RULE_NAME = "Printer Maintenance 8181";
export const FIREWALL_PORT = 8181;

const MAC_FW = "/usr/libexec/ApplicationFirewall/socketfilterfw";

export type FirewallStatus = "allowed" | "missing" | "unknown";

// ─── Path helpers ─────────────────────────────────────────────────────────────

/** The .app bundle path on macOS (falls back to the raw executable). */
function macAppPath(): string {
  const exe = app.getPath("exe");
  const match = exe.match(/^(.*\.app)(\/|$)/);
  return match ? match[1] : exe;
}

// ─── Status ───────────────────────────────────────────────────────────────────

async function getWindowsStatus(): Promise<FirewallStatus> {
  try {
    const { stdout } = await execFileAsync(
      "netsh",
      ["advfirewall", "firewall", "show", "rule", `name=${FIREWALL_RULE_NAME}`],
      { windowsHide: true, timeout: 8_000 },
    );
    // netsh prints "No rules match the specified criteria." when absent.
    return /Rule Name:/i.test(stdout) ? "allowed" : "missing";
  } catch {
    // netsh exits non-zero when no rule matches.
    return "missing";
  }
}

async function getMacStatus(): Promise<FirewallStatus> {
  try {
    const { stdout: global } = await execFileAsync(
      MAC_FW,
      ["--getglobalstate"],
      { timeout: 8_000 },
    );
    // Firewall off → the OS is not filtering incoming connections at all.
    if (/disabled|State = 0/i.test(global)) return "allowed";

    const appPath = macAppPath();
    const { stdout: appState } = await execFileAsync(
      MAC_FW,
      ["--getappblocked", appPath],
      { timeout: 8_000 },
    ).catch(() => ({ stdout: "" }) as { stdout: string });

    if (/allow(ed)? .*incoming/i.test(appState)) return "allowed";
    if (/block(ed)? .*incoming/i.test(appState)) return "missing";

    const { stdout: blockAll } = await execFileAsync(
      MAC_FW,
      ["--getblockall"],
      { timeout: 8_000 },
    ).catch(() => ({ stdout: "" }) as { stdout: string });
    if (/block all .*enabled|blockall is enabled/i.test(blockAll)) {
      return "missing";
    }

    // App not in the list and no block-all: signed apps are auto-allowed and
    // unsigned apps get a one-time OS prompt — nothing to fix from here.
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Check whether incoming connections to the print server are allowed by the OS
 * firewall. Reading the firewall state does not require elevation.
 */
export async function getFirewallStatus(): Promise<FirewallStatus> {
  if (process.platform === "win32") return getWindowsStatus();
  if (process.platform === "darwin") return getMacStatus();
  return "unknown";
}

// ─── Add rule (elevated) ──────────────────────────────────────────────────────

async function addWindowsRule(): Promise<{ ok: boolean; message: string }> {
  const inner = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    `netsh advfirewall firewall delete rule name="${FIREWALL_RULE_NAME}" | Out-Null`,
    `netsh advfirewall firewall add rule name="${FIREWALL_RULE_NAME}" dir=in action=allow protocol=TCP localport=${FIREWALL_PORT} profile=private,domain`,
    "exit $LASTEXITCODE",
  ].join("\r\n");

  const scriptPath = path.join(os.tmpdir(), `pm-firewall-${Date.now()}.ps1`);

  try {
    fs.writeFileSync(scriptPath, inner, "utf8");

    await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `$p = Start-Process powershell.exe -Verb RunAs -Wait -PassThru -WindowStyle Hidden ` +
          `-ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${scriptPath}'; ` +
          `exit $p.ExitCode`,
      ],
      { windowsHide: true, timeout: 120_000 },
    );

    return {
      ok: true,
      message: `Inbound rule added for TCP port ${FIREWALL_PORT}.`,
    };
  } catch (err) {
    const e = err as Error & { stderr?: string; code?: unknown };
    const detail = (e.stderr || e.message || "").toString();
    if (
      String(e.code) === "1223" ||
      /cancel+ed|The operation was canceled by the user/i.test(detail)
    ) {
      return {
        ok: false,
        message: "Permission was declined. The firewall rule was not added.",
      };
    }
    return {
      ok: false,
      message: detail.trim() || "Could not add the firewall rule.",
    };
  } finally {
    fs.unlink(scriptPath, () => {});
  }
}

async function addMacRule(): Promise<{ ok: boolean; message: string }> {
  const appPath = macAppPath();
  // Add the app to the firewall list, allow its incoming connections, and make
  // sure the firewall itself is on.
  const shell =
    `'${MAC_FW}' --setglobalstate on ; ` +
    `'${MAC_FW}' --add '${appPath}' ; ` +
    `'${MAC_FW}' --unblockapp '${appPath}'`;
  const osa = `do shell script "${shell.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}" with administrator privileges`;

  try {
    await execFileAsync("osascript", ["-e", osa], { timeout: 120_000 });
    return {
      ok: true,
      message: "Allowed incoming connections for this app in the macOS firewall.",
    };
  } catch (err) {
    const e = err as Error & { stderr?: string };
    const detail = (e.stderr || e.message || "").toString();
    if (/User canceled|-128/i.test(detail)) {
      return {
        ok: false,
        message: "Permission was declined. The firewall was not changed.",
      };
    }
    return {
      ok: false,
      message: detail.trim() || "Could not update the macOS firewall.",
    };
  }
}

/**
 * Allow incoming connections to the print server through the OS firewall. This
 * needs administrator rights, so the OS shows a prompt (UAC on Windows, an
 * authentication dialog on macOS) that the user must accept.
 */
export async function addFirewallRule(): Promise<{
  ok: boolean;
  message: string;
}> {
  if (process.platform === "win32") return addWindowsRule();
  if (process.platform === "darwin") return addMacRule();
  return {
    ok: false,
    message: "Automatic firewall setup is only available on Windows and macOS.",
  };
}

// ─── Quiet attempt on startup ─────────────────────────────────────────────────

/**
 * Best-effort, non-elevated attempt made when the server starts. On Windows it
 * succeeds silently when the app already runs as administrator; otherwise it is
 * a no-op and the user can allow access from the UI. Not attempted on macOS
 * because socketfilterfw always needs root.
 */
export function tryAddFirewallRuleQuietly() {
  if (process.platform !== "win32") return;
  execFile(
    "netsh",
    [
      "advfirewall",
      "firewall",
      "add",
      "rule",
      `name=${FIREWALL_RULE_NAME}`,
      "dir=in",
      "action=allow",
      "protocol=TCP",
      `localport=${FIREWALL_PORT}`,
      "profile=private,domain",
    ],
    { windowsHide: true },
    (err) => {
      if (err) {
        console.warn(
          "Quiet firewall rule add failed (needs admin):",
          err.message,
        );
      } else {
        console.log(`Firewall inbound rule for port ${FIREWALL_PORT} ensured`);
      }
    },
  );
}
