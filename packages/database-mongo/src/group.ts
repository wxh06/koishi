import { getSelfIds, injectMethods, GroupData, createGroup, Group } from 'koishi-core'
import { observe } from 'koishi-utils'
import {} from './database'

injectMethods('mongo', 'group', {
  async getGroup (groupId, selfId): Promise<GroupData> {
    selfId = typeof selfId === 'number' ? selfId : 0
    const data = await this.collections.group.findOne({ id: groupId })
    if (data) return data
    const fallback = createGroup(groupId, selfId)
    if (selfId && groupId) {
      await this.collections.group.insertOne(fallback)
    }
    return fallback
  },

  async getAllGroups (...args) {
    const assignees = args.length > 1 ? args[1]
      : args.length && typeof args[0][0] === 'number' ? args[0] as never
        : await getSelfIds()
    if (!assignees.length) return []
    return this.collections.group.find({ assignee: { $in: assignees } }).toArray()
  },

  async setGroup (groupId, data) {
    return this.collections.group.updateOne({ id: groupId }, data)
  },

  async observeGroup (group, selfId) {
    if (typeof group === 'number') {
      const data = await this.getGroup(group, selfId)
      return data && observe(data, diff => this.setGroup(group, diff), `group ${group}`)
    }

    const data = await this.getGroup(group.id, selfId)
    if ('_diff' in group) return (group as Group)._merge(data)
    return observe(Object.assign(group, data), diff => this.setGroup(group.id, diff), `group ${group.id}`)
  },

  getGroupCount () {
    return this.collections.group.count()
  },
})
