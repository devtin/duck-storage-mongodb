import castArray from 'lodash/castArray'
import flatten from 'lodash/flatten'

export const computeKeys = (schema) => {
  const indexes = schema.paths.filter(path => {
    return schema.schemaAtPath(path).settings.index
  }).map((path) => schema.schemaAtPath(path))

  const uniqueKeys = schema.paths.filter(path => {
    return schema.schemaAtPath(path).settings.unique
  }).map((path) => schema.schemaAtPath(path))

  const getKeyValue = (child, prop = 'index') => {
    return typeof child.settings[prop] === 'boolean' ? prop : child.settings[prop]
  }

  const getChildSettings = (childName) => {
    return schema.children.filter(({ fullName }) => {
      return fullName === childName
    })[0].settings
  }

  const indexesToCreate = []
  const uniqueKeysToCreate = []
  const groupIndexes = {}
  const groupUniqueKeys = {}

  const addIndex = (val, indexName, payload = {}) => {
    if (val === true) {
      indexesToCreate.push(Object.assign({}, payload, {
        [indexName]: 1
      }))
      indexesToCreate.push(Object.assign({}, payload, {
        [indexName]: -1
      }))
      return
    }
    indexesToCreate.push({}, payload, {
      [indexName]: val
    })
  }

  indexes.forEach(child => {
    const key = getKeyValue(child)
    const value = child.settings.index

    if (key === 'index') {
      addIndex(value, child.fullPath)
      return
    }

    // initialize
    if (!groupIndexes[key]) {
      groupIndexes[key] = {}
    }

    // todo: compute all possibilities (permutation)
    Object.assign(groupIndexes[key], {
      [child.fullPath]: true
    })
  })

  uniqueKeys.forEach(child => {
    const key = getKeyValue(child, 'unique')

    if (key === 'unique') {
      const opts = {}

      if (child.fullPath !== '_id') {
        Object.assign(opts, {
          unique: true,
          sparse: child.settings.sparse || false
        })
      }

      uniqueKeysToCreate.push([{
        [child.fullPath]: 1
      }, opts])
      return
    }

    // initialize
    if (!groupUniqueKeys[key]) {
      groupUniqueKeys[key] = {}
    }

    Object.assign(groupUniqueKeys[key], {
      [child.fullPath]: 1,
      sparse: getChildSettings(child.fullPath).sparse
    })
  })

  // compute / permute
  Object.keys(groupIndexes).forEach(groupName => {
    const group = groupIndexes[groupName]
    /*
    {
      propA: true,
      propB: true
    }

    {
      propA: 1,
      propB: true,
    }

    {
      propA: -1,
      propB: true,
    }
     */
    const computePayloads = (payload) => {
      const payloads = [payload]
      const objProps = Object.keys(payload)

      for (let i = 0; i < objProps.length; i++) {
        const prop = objProps[i]
        if (typeof payload[prop] === 'boolean') {
          return flatten([computePayloads(Object.assign({}, payload, {
            [prop]: 1
          })), computePayloads(Object.assign({}, payload, {
            [prop]: -1
          }))])
        }
      }

      return payloads
    }

    indexesToCreate.push(...computePayloads(group))
  })

  Object.keys(groupUniqueKeys).forEach(groupName => {
    const opts = { unique: true }
    const group = groupUniqueKeys[groupName]

    uniqueKeysToCreate.push([group, opts])
  })

  const schemaIndexes = schema.settings.indexes || []

  const schemaKeys = schemaIndexes.map(index => {
    return castArray(index)
  })

  return indexesToCreate.concat(uniqueKeysToCreate).concat(schemaKeys).filter(payload => {
    return Object.keys(payload).length > 0
  })
}
