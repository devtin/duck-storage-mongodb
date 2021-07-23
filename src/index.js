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
    try {
      await collection.dropIndexes()
    } catch (err) {
      // shh...
    }
    const keysToCreate = computeKeys(duckRack.duckModel.schema)
    await Promise.each(keysToCreate, keys => {
      keys = castArray(keys)

      if (Object.keys(keys[0]).length === 0) {
        return
      }

      return collection.createIndexes(...keys)
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

    // todo: implement sort and limit
    duckRack.hook('before', 'list', async ({ query, sort, skip, limit, result }) => {
      const getQueryComposer = ({ query, sort, skip, limit }, composer = collection) => {
        if (query) {
          return getQueryComposer({ sort, skip, limit }, composer.find(query))
        }

        if (sort) {
          return getQueryComposer({ skip, limit }, composer.sort(sort))
        }

        if (skip !== undefined) {
          return getQueryComposer({ limit }, composer.skip(skip))
        }

        if (limit !== undefined) {
          return composer.limit(limit)
        }

        return composer
      }

      const docs = await getQueryComposer({ query, skip, sort, limit }).toArray()

      docs.length > 0 && result.push(...docs)
    })

    duckRack.hook('before', 'deleteById', async ({ _id, result }) => {
      const doc = await collection.findOne({ _id })
      const deleted = await collection.deleteOne({ _id })
      if (deleted.deletedCount > 0) result.push(doc)
    })

    duckRack.hook('before', 'findOneById', async ({ _id, result }) => {
      const queryInput = {
        _id
      }

      const found = await collection.findOne(queryInput)
      found && result.push(found)
    })

    duckRack.mongoClient = client
  }
}
