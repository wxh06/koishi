import { isInteger, getDateNumber } from 'koishi-utils'
import { UserField, GroupField, UserData } from './database'
import { NextFunction } from './context'
import { Command, CommandHint } from './command'
import { Meta } from './meta'
import { messages } from './messages'
import { format } from 'util'
import leven from 'leven'

export function getTargetId (target: string | number) {
  if (typeof target !== 'string' && typeof target !== 'number') return
  let qq = +target
  if (!qq) {
    const capture = /\[CQ:at,qq=(\d+)\]/.exec(target as any)
    if (capture) qq = +capture[1]
  }
  if (!isInteger(qq)) return
  return qq
}

const ONE_DAY = 86400000

export function getUsage (name: string, user: Pick<UserData, 'usage'>, time = Date.now()) {
  const $date = getDateNumber(time)
  if (user.usage.$date !== $date) {
    const oldUsage = user.usage
    const newUsage = { $date } as any
    for (const key in oldUsage) {
      if (key === '$date') continue
      const { last } = oldUsage[key]
      if (time.valueOf() - last < ONE_DAY) {
        newUsage[key] = { last }
      }
    }
    user.usage = newUsage
  }

  return user.usage[name] || (user.usage[name] = {})
}

interface UsageOptions {
  maxUsage?: number
  minInterval?: number
  timestamp?: number
}

export function updateUsage (name: string, user: Pick<UserData, 'usage'>, options: UsageOptions = {}) {
  const now = Date.now()
  const { maxUsage = Infinity, minInterval = 0, timestamp = now } = options
  const usage = getUsage(name, user, now)

  if (now - usage.last < minInterval) {
    return CommandHint.TOO_FREQUENT
  } else if (options.minInterval || options.timestamp) {
    usage.last = timestamp
  }

  if (usage.count >= maxUsage) {
    return CommandHint.USAGE_EXHAUSTED
  } else if (options.maxUsage) {
    usage.count = (usage.count || 0) + 1
  }
}

interface SuggestOptions {
  target: string
  items: string[]
  meta: Meta<'message'>
  next: NextFunction
  prefix: string
  suffix: string
  coefficient?: number
  disable?: (name: string) => boolean
  command: Command | ((suggestion: string) => Command)
  execute: (suggestion: string, meta: Meta<'message'>, next: NextFunction) => any
}

export function showSuggestions (options: SuggestOptions): Promise<void> {
  const { target, items, meta, next, prefix, suffix, execute, disable, coefficient = 0.4 } = options
  const suggestions = items.filter((name) => {
    return name.length > 2
      && leven(name, target) <= name.length * coefficient
      && !disable?.(name)
  })
  if (!suggestions.length) return next()

  return next(() => {
    const message = prefix + format(messages.SUGGESTION_TEXT, suggestions.map(name => `“${name}”`).join('或'))
    if (suggestions.length > 1) return meta.$send(message)

    const command = typeof options.command === 'function' ? options.command(suggestions[0]) : options.command
    const userFields = new Set<UserField>()
    const groupFields = new Set<GroupField>()
    Command.attachUserFields(userFields, { command, meta })
    Command.attachGroupFields(groupFields, { command, meta })
    command.context.onceMiddleware(async (meta, next) => {
      if (meta.message.trim()) return next()
      meta.$user = await command.context.database?.observeUser(meta.userId, Array.from(userFields))
      if (meta.messageType === 'group') {
        meta.$group = await command.context.database?.observeGroup(meta.groupId, Array.from(groupFields))
      }
      return execute(suggestions[0], meta, next)
    }, meta)
    return meta.$send(message + suffix)
  })
}
