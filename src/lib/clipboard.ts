/**
 * Copies text to the clipboard.
 *
 * Uses navigator.clipboard.writeText (requires HTTPS or localhost).
 * Falls back to document.execCommand('copy') for insecure contexts
 * such as LAN IP dev access (http://192.168.x.x:3000).
 *
 * Returns true on success, false on failure.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // navigator.clipboard is undefined in insecure contexts (LAN IP http://)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to execCommand fallback
    }
  }
  return execCommandFallback(text)
}

function execCommandFallback(text: string): boolean {
  const el = document.createElement('textarea')
  el.value = text
  el.setAttribute('readonly', '')
  el.style.cssText = 'position:fixed;top:-9999px;left:-9999px'
  document.body.appendChild(el)
  el.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  } finally {
    document.body.removeChild(el)
  }
  return ok
}
