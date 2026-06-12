// CANARY FILE — deliberate SAST violations to validate Datadog Code Security.
// This PR is never merged; the file exists only to confirm scanning + PR comments work.
// Expected findings: typescript-browser-security (XSS sink), typescript-common-security (insecure HTTP).

export function renderUserContent(element: HTMLElement): void {
  const params = new URLSearchParams(window.location.search)
  const userInput = params.get('content') ?? ''
  // Violation 1: user-controlled data flowing into an XSS sink
  element.innerHTML = userInput
}

export async function fetchInsecure(): Promise<string> {
  // Violation 2: insecure HTTP request
  const res = await fetch('http://example.com/api/data')
  return res.text()
}
