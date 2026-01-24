import { lookup } from 'node:dns/promises'

export type UrlValidationResult =
  | { valid: true; url: URL }
  | { valid: false; reason: string }

/**
 * Check if an IPv4 address is in a private or reserved range.
 * Private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 * Loopback: 127.0.0.0/8
 * Link-local: 169.254.0.0/16
 * Reserved: 0.0.0.0/8, 224.0.0.0/4 (multicast), 240.0.0.0/4 (reserved)
 */
const isPrivateIPv4 = (ip: string): boolean => {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false
  }

  const [a, b, c, d] = parts

  // 0.0.0.0/8 - Current network (only valid as source address)
  if (a === 0) return true

  // 10.0.0.0/8 - Private
  if (a === 10) return true

  // 127.0.0.0/8 - Loopback
  if (a === 127) return true

  // 169.254.0.0/16 - Link-local
  if (a === 169 && b === 254) return true

  // 172.16.0.0/12 - Private (172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true

  // 192.168.0.0/16 - Private
  if (a === 192 && b === 168) return true

  // 224.0.0.0/4 - Multicast
  if (a >= 224 && a <= 239) return true

  // 240.0.0.0/4 - Reserved for future use (and 255.255.255.255)
  if (a >= 240) return true

  return false
}

/**
 * Check if an IPv6 address is in a private or reserved range.
 * Loopback: ::1
 * Link-local: fe80::/10
 * Site-local (deprecated): fec0::/10
 * Unique local: fc00::/7 (fc00::/8 and fd00::/8)
 * IPv4-mapped: ::ffff:0:0/96
 */
const isPrivateIPv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase()

  // Loopback ::1
  if (normalized === '::1') return true

  // IPv4-mapped IPv6 (::ffff:x.x.x.x) - check the embedded IPv4
  const ipv4MappedMatch = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (ipv4MappedMatch) {
    return isPrivateIPv4(ipv4MappedMatch[1])
  }

  // Expand abbreviated IPv6 for prefix checks
  const expanded = expandIPv6(normalized)
  if (!expanded) return false

  const firstSegment = parseInt(expanded.substring(0, 4), 16)

  // fe80::/10 - Link-local (fe80 - febf)
  if (firstSegment >= 0xfe80 && firstSegment <= 0xfebf) return true

  // fec0::/10 - Site-local deprecated (fec0 - feff)
  if (firstSegment >= 0xfec0 && firstSegment <= 0xfeff) return true

  // fc00::/7 - Unique local addresses (fc00 - fdff)
  if (firstSegment >= 0xfc00 && firstSegment <= 0xfdff) return true

  // :: alone (unspecified address)
  if (expanded === '0000:0000:0000:0000:0000:0000:0000:0000') return true

  return false
}

/**
 * Expand an abbreviated IPv6 address to full form.
 * Returns null if the address is invalid.
 */
const expandIPv6 = (ip: string): string | null => {
  // Handle IPv4-mapped addresses
  if (ip.includes('.')) {
    const ipv4Match = ip.match(
      /^(.*):(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/,
    )
    if (ipv4Match) {
      const ipv4Parts = ipv4Match[2].split('.').map(Number)
      const hex1 = ((ipv4Parts[0] << 8) | ipv4Parts[1])
        .toString(16)
        .padStart(4, '0')
      const hex2 = ((ipv4Parts[2] << 8) | ipv4Parts[3])
        .toString(16)
        .padStart(4, '0')
      ip = `${ipv4Match[1]}:${hex1}:${hex2}`
    }
  }

  const parts = ip.split('::')
  if (parts.length > 2) return null

  if (parts.length === 2) {
    const left = parts[0] ? parts[0].split(':') : []
    const right = parts[1] ? parts[1].split(':') : []
    const missing = 8 - left.length - right.length
    if (missing < 0) return null
    const middle = Array(missing).fill('0000')
    const allParts = [...left, ...middle, ...right]
    return allParts.map((p) => p.padStart(4, '0')).join(':')
  }

  const segments = ip.split(':')
  if (segments.length !== 8) return null
  return segments.map((p) => p.padStart(4, '0')).join(':')
}

/**
 * Check if a hostname is a localhost variant.
 */
const isLocalhostHostname = (hostname: string): boolean => {
  const lower = hostname.toLowerCase()
  return (
    lower === 'localhost' ||
    lower === 'localhost.localdomain' ||
    lower.endsWith('.localhost') ||
    lower === '[::1]' ||
    /^\[?127\.\d+\.\d+\.\d+\]?$/.test(lower)
  )
}

/**
 * Check if a string is a valid IPv4 address.
 */
const isIPv4 = (str: string): boolean => {
  const parts = str.split('.')
  if (parts.length !== 4) return false
  return parts.every((p) => {
    const num = Number(p)
    return !isNaN(num) && num >= 0 && num <= 255 && String(num) === p
  })
}

/**
 * Check if a string is a valid IPv6 address (including bracketed form).
 */
const isIPv6 = (str: string): boolean => {
  const unbracket = str.startsWith('[') && str.endsWith(']')
    ? str.slice(1, -1)
    : str
  // Simple validation: contains colons and valid hex segments
  if (!unbracket.includes(':')) return false
  const parts = unbracket.split('::')
  if (parts.length > 2) return false
  return true
}

/**
 * Validate a URL for safe fetching (SSRF protection).
 * 
 * Checks:
 * - URL must be valid and parseable
 * - Scheme must be http or https
 * - Hostname must not be localhost or variants
 * - IP addresses must not be in private/reserved ranges
 * - DNS resolution must not resolve to private IPs
 */
export const validateUrl = async (urlString: string): Promise<UrlValidationResult> => {
  // Step 1: Parse the URL
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    return { valid: false, reason: 'Invalid URL format.' }
  }

  // Step 2: Validate scheme
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { valid: false, reason: 'URL must use http or https protocol.' }
  }

  // Step 3: Check hostname for localhost variants
  const hostname = url.hostname
  if (isLocalhostHostname(hostname)) {
    return { valid: false, reason: 'URLs pointing to localhost are not allowed.' }
  }

  // Step 4: If hostname is an IP address, check if it's private
  // Remove brackets from IPv6
  const rawHostname = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname

  if (isIPv4(rawHostname)) {
    if (isPrivateIPv4(rawHostname)) {
      return { valid: false, reason: 'URLs pointing to private IP addresses are not allowed.' }
    }
    return { valid: true, url }
  }

  if (isIPv6(hostname)) {
    if (isPrivateIPv6(rawHostname)) {
      return { valid: false, reason: 'URLs pointing to private IP addresses are not allowed.' }
    }
    return { valid: true, url }
  }

  // Step 5: Resolve DNS and check resolved IPs
  try {
    const result = await lookup(hostname, { all: true })
    
    for (const record of result) {
      if (record.family === 4 && isPrivateIPv4(record.address)) {
        return { 
          valid: false, 
          reason: 'URL resolves to a private IP address.' 
        }
      }
      if (record.family === 6 && isPrivateIPv6(record.address)) {
        return { 
          valid: false, 
          reason: 'URL resolves to a private IP address.' 
        }
      }
    }
  } catch (error) {
    // DNS lookup failed - hostname doesn't resolve
    return { 
      valid: false, 
      reason: 'Could not resolve hostname.' 
    }
  }

  return { valid: true, url }
}
