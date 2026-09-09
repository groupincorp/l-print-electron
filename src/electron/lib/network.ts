import os from "os";

export interface LanAddress {
  address: string;
  iface: string;
}

// Interface-name fragments that belong to virtual adapters (VMs, containers,
// hypervisors, tunnels). Devices on the real Wi-Fi/LAN cannot route to these.
const VIRTUAL_IFACE_PATTERNS = [
  "virtualbox",
  "vmware",
  "hyper-v",
  "vethernet",
  "loopback",
  "wsl",
  "docker",
  "npcap",
  "tailscale",
  "zerotier",
  "tap-windows",
  "tun",
  "utun",
  "bridge",
  "ppp",
  "vpn",
];

// Address prefixes used by default by common virtual adapters.
const VIRTUAL_ADDRESS_PREFIXES = [
  "192.168.56.", // VirtualBox host-only
  "172.17.", // Docker default bridge
  "198.18.", // benchmarking / some VPNs
  "25.", // Hamachi
];

function isVirtual(iface: string, address: string): boolean {
  const name = iface.toLowerCase();
  if (VIRTUAL_IFACE_PATTERNS.some((p) => name.includes(p))) return true;
  if (VIRTUAL_ADDRESS_PREFIXES.some((p) => address.startsWith(p))) return true;
  return false;
}

// Higher score = more likely to be the address a phone/tablet should use.
function score(iface: string): number {
  const name = iface.toLowerCase();
  if (name.includes("wi-fi") || name.includes("wireless") || name.includes("wlan"))
    return 3;
  // "Ethernet" but not "vEthernet" (already filtered, but be safe)
  if (name.includes("ethernet") && !name.includes("vethernet")) return 2;
  return 1;
}

/**
 * Return this machine's real LAN IPv4 addresses — the ones a device on the same
 * Wi-Fi would use to reach the print server — best candidate first.
 *
 * Skips loopback, link-local (169.254.x.x), and virtual adapters (VirtualBox,
 * VMware, Hyper-V, WSL, Docker, VPNs). If filtering removes everything, falls
 * back to the unfiltered list so the UI still shows something.
 */
export function getLanAddresses(): LanAddress[] {
  const interfaces = os.networkInterfaces();
  const all: LanAddress[] = [];

  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name] as os.NetworkInterfaceInfo[] | undefined;
    if (!addrs) continue;
    for (const addr of addrs) {
      const family = String(addr.family);
      if (family !== "IPv4" && family !== "4") continue;
      if (addr.internal) continue;
      if (addr.address.startsWith("169.254.")) continue;
      all.push({ address: addr.address, iface: name });
    }
  }

  const real = all.filter((a) => !isVirtual(a.iface, a.address));
  const list = real.length > 0 ? real : all;

  return list.sort((a, b) => score(b.iface) - score(a.iface));
}
