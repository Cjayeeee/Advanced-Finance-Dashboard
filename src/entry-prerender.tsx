/**
 * Build-time entry used by scripts/prerender.mjs to render the public landing page to static
 * HTML, so search engines and link previews get real content without running JavaScript.
 */
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { AppProvider } from '@/store/app-store'
import LandingPage, { FAQ } from '@/pages/landing'

export function render(url = '/') {
  return renderToString(
    <AppProvider>
      <StaticRouter location={url}>
        <LandingPage />
      </StaticRouter>
    </AppProvider>,
  )
}

export { FAQ }
