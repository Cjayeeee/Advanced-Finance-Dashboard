import { useActiveWorkspace } from '@/store/app-store'

/** Workspace-type specific vocabulary. */
export function useTerms() {
  const { ws } = useActiveWorkspace()
  const startup = ws.type === 'startup'
  return {
    startup,
    client: startup ? 'Customer' : 'Client',
    clients: startup ? 'Customers' : 'Clients',
    income: startup ? 'Revenue' : 'Income',
    incomeLower: startup ? 'revenue' : 'income',
  }
}
