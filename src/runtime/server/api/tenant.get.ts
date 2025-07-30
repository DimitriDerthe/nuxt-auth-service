import { getCurrentOrganization, isMultiTenant } from '../utils/tenant'

export default defineEventHandler(async (event) => {
  const organization = getCurrentOrganization(event)
  const multiTenant = isMultiTenant(event)

  return {
    organization,
    isMultiTenant: multiTenant,
  }
})
