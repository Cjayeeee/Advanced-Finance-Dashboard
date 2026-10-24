import { useMemo } from 'react'
import { useActiveWorkspace } from '@/store/app-store'
import type { Account, Category, Client, Project } from '@/data/types'

/** O(1) id → entity maps for the active workspace. */
export function useLookups() {
  const { data } = useActiveWorkspace()
  return useMemo(() => {
    const cat = new Map<string, Category>(data.categories.map((c) => [c.id, c]))
    const acc = new Map<string, Account>(data.accounts.map((a) => [a.id, a]))
    const client = new Map<string, Client>(data.clients.map((c) => [c.id, c]))
    const project = new Map<string, Project>(data.projects.map((p) => [p.id, p]))
    return { cat, acc, client, project }
  }, [data.categories, data.accounts, data.clients, data.projects])
}
