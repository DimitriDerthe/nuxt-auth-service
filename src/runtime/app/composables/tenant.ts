import { ref, computed, type Ref } from 'vue'
import type { Organization, MultiTenantComposable } from '#auth-utils'

const organization: Ref<Organization | null> = ref(null)
const isMultiTenant = ref(false)

export function useMultiTenant(): MultiTenantComposable {
  const tenantId = computed(() => organization.value?.id || null)

  const switchOrganization = async (organizationId: string): Promise<void> => {
    try {
      const response = await $fetch('/api/_auth/tenant/switch', {
        method: 'POST',
        body: { organizationId },
      })

      if (response.organization) {
        organization.value = response.organization
      }

      // Refresh the page to apply tenant context
      await navigateTo(window.location.pathname)
    }
    catch (error) {
      console.error('Failed to switch organization:', error)
      throw error
    }
  }

  const refresh = async (): Promise<void> => {
    try {
      const response = await $fetch('/api/_auth/tenant')
      organization.value = response.organization || null
      isMultiTenant.value = response.isMultiTenant || false
    }
    catch (error) {
      console.error('Failed to refresh tenant data:', error)
      organization.value = null
      isMultiTenant.value = false
    }
  }

  return {
    organization: computed(() => organization.value),
    isMultiTenant: computed(() => isMultiTenant.value),
    tenantId,
    switchOrganization,
    refresh,
  }
}

// Initialize tenant data
if (import.meta.client) {
  const { refresh } = useMultiTenant()
  refresh().catch(() => {
    // Silently fail on client
  })
}
