import type { OwnerSettings, SettingsOwner } from '../shared/settings.ts'
export interface DraftState { owners: Partial<Record<SettingsOwner, OwnerSettings>>; drafts: Partial<Record<SettingsOwner, Record<string, unknown>>>; resets: Partial<Record<SettingsOwner, string[]>> }
export const emptyDraftState = (): DraftState => ({ owners: {}, drafts: {}, resets: {} })
export function receiveOwners(state: DraftState, owners: OwnerSettings[], saved?: SettingsOwner): DraftState {
  const next: DraftState = { owners: { ...state.owners }, drafts: { ...state.drafts }, resets: { ...state.resets } }
  for (const owner of owners) {
    if (saved && owner.owner !== saved) continue
    if (state.drafts[owner.owner] && !saved) continue
    next.owners[owner.owner] = owner
    next.drafts[owner.owner] = { ...owner.effective }
    next.resets[owner.owner] = []
  }
  return next
}
export function editDraft(state: DraftState, owner: SettingsOwner, field: string, value: unknown, reset = false): DraftState {
  return { ...state, drafts: { ...state.drafts, [owner]: { ...state.drafts[owner], [field]: value } }, resets: { ...state.resets, [owner]: [...(state.resets[owner] ?? []).filter(key => key !== field), ...(reset ? [field] : [])] } }
}
export function draftOperations(state: DraftState, owner: SettingsOwner) {
  const snapshot = state.owners[owner]!, draft = state.drafts[owner] ?? {}
  return snapshot.fields.flatMap(field => (state.resets[owner] ?? []).includes(field.path) ? [{ op: 'unset', path: field.path }] : JSON.stringify(draft[field.path]) !== JSON.stringify(snapshot.effective[field.path]) ? [{ op: 'set', path: field.path, value: draft[field.path] }] : [])
}
