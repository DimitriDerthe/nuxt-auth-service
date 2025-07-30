import { ref, computed, type Ref } from 'vue'
import type { ThemeConfig } from '#auth-utils'

const currentTheme: Ref<ThemeConfig> = ref({})

export function useAuthTheme() {
  const setTheme = (theme: Partial<ThemeConfig>) => {
    currentTheme.value = { ...currentTheme.value, ...theme }
    applyThemeToDocument()
  }

  const getThemeClasses = (component: string, variant?: string) => {
    const theme = currentTheme.value
    const baseClasses = getDefaultClasses(component, variant)

    // Apply theme customizations
    let classes = baseClasses

    if (theme.colors?.primary) {
      classes = classes.replace(/bg-blue-(\d+)/g, (match, shade) => {
        if (typeof theme.colors!.primary === 'string') {
          return `bg-[${theme.colors!.primary}]`
        }
        return `bg-primary-${shade}`
      })

      classes = classes.replace(/text-blue-(\d+)/g, (match, shade) => {
        if (typeof theme.colors!.primary === 'string') {
          return `text-[${theme.colors!.primary}]`
        }
        return `text-primary-${shade}`
      })
    }

    if (theme.borderRadius) {
      classes = classes.replace(/rounded-(\w+)/g, (match, size) => {
        const radiusMap = {
          sm: theme.borderRadius!.sm || 'rounded-sm',
          md: theme.borderRadius!.md || 'rounded-md',
          lg: theme.borderRadius!.lg || 'rounded-lg',
          xl: theme.borderRadius!.xl || 'rounded-xl',
        }
        return radiusMap[size as keyof typeof radiusMap] || match
      })
    }

    return classes
  }

  const applyThemeToDocument = () => {
    if (import.meta.server) return

    const root = document.documentElement

    // Apply CSS custom properties
    if (currentTheme.value.colors?.primary) {
      if (typeof currentTheme.value.colors.primary === 'string') {
        root.style.setProperty('--auth-primary-color', currentTheme.value.colors.primary)
      }
    }

    // Apply other theme properties as needed
  }

  return {
    theme: computed(() => currentTheme.value),
    setTheme,
    getThemeClasses,
  }
}

function getDefaultClasses(component: string, variant?: string): string {
  const classMap: Record<string, Record<string, string>> = {
    button: {
      default: 'inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
      outline: 'inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
      ghost: 'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
      link: 'inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
    },
    input: {
      default: 'block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed',
      error: 'block w-full rounded-md border-red-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed',
    },
    label: {
      default: 'block text-sm font-medium text-gray-700',
      required: 'block text-sm font-medium text-gray-700 after:content-["*"] after:ml-0.5 after:text-red-500',
    },
    card: {
      default: 'rounded-lg bg-white p-6 shadow-sm border border-gray-200',
      elevated: 'rounded-lg bg-white p-6 shadow-lg border border-gray-200',
    },
    modal: {
      default: 'fixed inset-0 z-50 overflow-y-auto',
      backdrop: 'fixed inset-0 bg-black bg-opacity-50 transition-opacity',
      content: 'relative mx-auto my-8 w-full max-w-md rounded-lg bg-white p-6 shadow-xl',
    },
  }

  return classMap[component]?.[variant || 'default'] || ''
}
