import { injectMethods, createUser, User } from 'koishi-core'
import { observe } from 'koishi-utils'
import {} from './database'

injectMethods('mongo', 'user', {
  async getUser (userId, authority) {
    authority = typeof authority === 'number' ? authority : 0
    const data = await this.collections.user.findOne({ id: userId })
    if (data) return data
    if (authority < 0) return null
    const fallback = createUser(userId, authority)
    if (authority) {
      await this.collections.user.insertOne(fallback)
    }
    return fallback
  },

  async getUsers (...args) {
    if (args.length > 1 || args.length && typeof args[0][0] !== 'string') {
      if (!args[0].length) return []
      return this.collections.user.find({ id: { $in: args[0] } }).toArray()
    }

    return this.collections.user.find().toArray()
  },

  async setUser (userId, data) {
    return this.collections.user.updateOne({ id: userId }, data)
  },

  async observeUser (user, authority) {
    if (typeof user === 'number') {
      const data = await this.getUser(user, authority)
      return data && observe(data, diff => this.setUser(user, diff), `user ${user}`)
    }

    const data = await this.getUser(user.id, authority)
    if ('_diff' in user) return (user as User)._merge(data)
    return observe(Object.assign(user, data), diff => this.setUser(user.id, diff), `user ${user.id}`)
  },

  getUserCount () {
    return this.collections.user.count()
  },
})
