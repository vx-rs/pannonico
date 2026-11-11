// Imports
// -----------------------------------------------------------------------------
// External
import 'vite/modulepreload-polyfill'

// Internal
import './app.scss'

// Entrypoint
// -----------------------------------------------------------------------------
const STATUS = document.querySelector<HTMLElement>('#vite-status')

if (STATUS) {
  STATUS.textContent = 'Pannonico demo TypeScript is active.'
  STATUS.dataset.vite = 'ready'
}
