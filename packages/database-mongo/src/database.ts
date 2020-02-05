import { MongoClient, MongoClientOptions, Db, Collection } from 'mongodb'
import { registerDatabase, AbstractDatabase, TableType, TableData, InjectConfig } from 'koishi-core'

declare module 'koishi-core/dist/database' {
  interface Subdatabases {
    mongo: MongoDatabase
  }

  interface DatabaseConfig {
    mongo?: MongoClientOptions
  }
}

interface MongoConfig extends MongoClientOptions {
  database: string
  uri: string
}

export class MongoDatabase implements AbstractDatabase {
  client: MongoClient
  db: Db
  collections: {
    [K in TableType]: Collection<TableData[K]>
  }

  constructor (public config: MongoConfig, public injectConfig: InjectConfig<'mongo'>) {
    this.client = new MongoClient(config.uri, config)
  }

  async start () {
    await this.client.connect()
    this.db = this.client.db(this.config.database)
    this.collections = {} as any
    for (const key in this.injectConfig) {
      this.collections[key] = this.db.collection(key)
    }
  }

  async stop () {
    await this.client.close()
  }
}

registerDatabase('mongo', MongoDatabase)
