/** Copies each table column's heading onto its cells (data-label) so the phone card layout in index.css can show it. */
function label(root: ParentNode) {
  for (const table of root.querySelectorAll<HTMLTableElement>('table.cards-sm')) {
    const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim() ?? '')
    for (const tr of table.querySelectorAll('tbody tr'))
      [...tr.children].forEach((td, i) => { if (td.getAttribute('data-label') !== heads[i]) td.setAttribute('data-label', heads[i] ?? '') })
  }
}
let queued = false
export function startTableCards() {
  label(document)
  new MutationObserver(() => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => { queued = false; label(document) })
  }).observe(document.body, { childList: true, subtree: true, characterData: true })
}
