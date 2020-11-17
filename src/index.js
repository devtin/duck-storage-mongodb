import pkgUp from 'pkg-up'
import kebabCase from 'lodash/kebabCase'
import castArray from 'lodash/castArray'
import Promise from 'bluebird'
import { getClient } from './lib/driver.js'
import { computeKeys } from './lib/compute-keys'

const defaultDbName = kebabCase(require(pkgUp.sync()).name)
let client

export default function ({
  credentials = 'mongodb://localhost:27017',
  dbName = defaultDbName,
  debug = false
} = {}) {
  return async function ({ duckRack }) {
    if (!client) {
      client = await getClient(credentials)
    }

    const collection = client.db(dbName).collection(duckRack.name)
    const keysToCreate = computeKeys(duckRack.duckModel.schema)

    await Promise.each(keysToCreate, keys => {
      keys = castArray(keys)

      if (Object.keys(keys[0]).length === 0) {
        return
      }

      return collection.ensureIndex(...keys)
    })
    // collection.createIndexes()

    duckRack.collection = collection

    duckRack.hook('before', 'create', ({ entry }) => {
      return collection.insertOne(entry)
    })

    duckRack.hook('before', 'update', async ({ oldEntry, newEntry, entry, result }) => {
      const query = {
        _id: oldEntry._id
      }
      if (oldEntry._v) {
        query._v = oldEntry._v
      }

      const updated = await collection.updateOne(query, {
        $set: entry
      })

      if (updated.modifiedCount > 0) {
        result.push(entry)
      }
    })

    duckRack.hook('before', 'find', async ({ query, result }) => {
      const docs = await collection.find(query).toArray()
      docs.length > 0 && result.push(...docs)
    })

    duckRack.hook('before', 'deleteById', async ({ _id, result }) => {
      const deleted = await collection.deleteOne({ _id })
      result.push(deleted.deletedCount > 0)
    })

    duckRack.hook('before', 'findOneById', async ({ queryInput, result }) => {
      const found = await collection.findOne(queryInput)
      found && result.push(found)
    })

    duckRack.mongoClient = client
  }
}
