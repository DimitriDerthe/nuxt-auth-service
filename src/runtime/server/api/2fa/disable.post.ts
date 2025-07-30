import { readBody } from 'h3'
import { requireUserSession } from '../../utils/session'
import { disable2FA } from '../../utils/totp'
import { verifyPassword } from '../../utils/password'
import { logAuthEvent } from '../../utils/audit'
import { useDatabase } from '../../utils/database'
import { schema, eq } from '../../database/connection'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { password } = await readBody(event)

  if (!password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password is required to disable 2FA',
    })
  }

  try {
    // Verify password first
    const db = useDatabase()
    const user = await db.select()
      .from(schema.users)
      .where(eq(schema.users.id, session.user.id!))
      .limit(1)

    if (user.length === 0 || !user[0].password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'User not found or password not set',
      })
    }

    const isValidPassword = await verifyPassword(user[0].password, password)
    if (!isValidPassword) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid password',
      })
    }

    // Disable 2FA
    const success = await disable2FA(session.user.id!)

    if (!success) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to disable 2FA',
      })
    }

    await logAuthEvent(event, '2fa_disabled', {
      userId: session.user.id,
    })

    return {
      success: true,
      message: '2FA disabled successfully',
    }
  }
  catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('2FA disable error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to disable 2FA',
    })
  }
})
