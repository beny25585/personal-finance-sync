import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import {
  ConnectionRequestError,
  createConnection,
  getInstitutions,
  getProviderFields,
  type ConnectionType,
  type Institution,
  type ProviderFields,
} from '../api/connections'

type FormIssue = 'catalogError' | 'fieldsError' | 'aliasTaken' | 'saveError' | 'saveUnknown'

export function useConnectionForm(onSaved: () => void, onUncertain: () => void) {
  const institutions = shallowRef<Institution[]>([])
  const type = shallowRef<ConnectionType | ''>('')
  const companyId = shallowRef('')
  const fields = shallowRef<ProviderFields | null>(null)
  const issue = shallowRef<FormIssue | null>(null)
  const loadingCatalog = shallowRef(false)
  const loadingFields = shallowRef(false)
  const saving = shallowRef(false)
  const matchingInstitutions = computed(() => institutions.value.filter((item) => item.type === type.value))
  let catalogRequest: AbortController | null = null
  let fieldsRequest: AbortController | null = null
  let saveRequest: AbortController | null = null

  async function loadInstitutions(): Promise<void> {
    if (catalogRequest) return
    const controller = new AbortController()
    catalogRequest = controller
    issue.value = null
    loadingCatalog.value = true
    try {
      const data = await getInstitutions(controller.signal)
      if (!controller.signal.aborted) institutions.value = data
    } catch {
      if (!controller.signal.aborted) issue.value = 'catalogError'
    } finally {
      catalogRequest = null
      loadingCatalog.value = false
    }
  }

  function setType(value: ConnectionType | ''): void {
    type.value = value
    companyId.value = ''
  }

  async function loadFields(): Promise<void> {
    fieldsRequest?.abort()
    fieldsRequest = null
    fields.value = null
    issue.value = null
    loadingFields.value = false

    const id = companyId.value
    if (!id) return
    const controller = new AbortController()
    fieldsRequest = controller
    loadingFields.value = true
    try {
      const data = await getProviderFields(id, controller.signal)
      if (!controller.signal.aborted) fields.value = data
    } catch {
      if (!controller.signal.aborted) issue.value = 'fieldsError'
    } finally {
      if (fieldsRequest === controller) {
        fieldsRequest = null
        loadingFields.value = false
      }
    }
  }

  watch(companyId, () => { void loadFields() }, { flush: 'sync' })

  async function save(form: HTMLFormElement): Promise<void> {
    if (saving.value || issue.value === 'saveUnknown' || !fields.value || fields.value.companyId !== companyId.value) return

    const values = new FormData(form)
    const alias = String(values.get('alias') ?? '').trim()
    const credentials: Record<string, string> = {}
    for (const field of fields.value.loginFields) {
      const value = values.get(field)
      if (typeof value === 'string' && value !== '') credentials[field] = value
      values.delete(field)
      const input = form.elements.namedItem(field)
      if (input instanceof HTMLInputElement) input.value = ''
    }

    const controller = new AbortController()
    saveRequest = controller
    saving.value = true
    issue.value = null
    try {
      // Fetch serializes the payload before the first await. Credentials live only in
      // the form and in the single request, never in reactive or persistent state.
      const request = createConnection({ companyId: companyId.value, alias: alias || undefined, credentials }, controller.signal)
      for (const field of Object.keys(credentials)) credentials[field] = ''
      await request
      if (!controller.signal.aborted) onSaved()
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof ConnectionRequestError && error.code === 'conflict') {
        issue.value = 'aliasTaken'
      } else if (error instanceof ConnectionRequestError && error.code === 'unauthorized') {
        issue.value = 'saveError'
      } else {
        // A lost response can leave an already saved connection. Ask the user to
        // inspect the refreshed list before entering credentials again.
        issue.value = 'saveUnknown'
        onUncertain()
      }
    } finally {
      saveRequest = null
      saving.value = false
    }
  }

  onScopeDispose(() => {
    catalogRequest?.abort()
    fieldsRequest?.abort()
    saveRequest?.abort()
  })

  return { type, companyId, fields, issue, loadingCatalog, loadingFields, saving,
    matchingInstitutions, setType, loadInstitutions, loadFields, save }
}
