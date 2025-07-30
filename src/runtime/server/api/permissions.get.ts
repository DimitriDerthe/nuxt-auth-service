import { getUserSessionWithRBAC } from '../utils/rbac'

export default defineEventHandler(async (event) => {
  const sessionWithRBAC = await getUserSessionWithRBAC(event)

  return {
    roles: sessionWithRBAC.roles,
    permissions: sessionWithRBAC.permissions,
    user: sessionWithRBAC.user,
  }
})
