/*!
 * duck-storage-mongodb v0.0.4
 * (c) 2020-2021 Martin Rafael Gonzalez <tin@devtin.io>
 * MIT
 */
'use strict';

var pkgUp = require('pkg-up');
var kebabCase = require('lodash/kebabCase');
var castArray = require('lodash/castArray');
var Promise = require('bluebird');
var mongodb = require('mongodb');
var flatten = require('lodash/flatten');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var pkgUp__default = /*#__PURE__*/_interopDefaultLegacy(pkgUp);
var kebabCase__default = /*#__PURE__*/_interopDefaultLegacy(kebabCase);
var castArray__default = /*#__PURE__*/_interopDefaultLegacy(castArray);
var Promise__default = /*#__PURE__*/_interopDefaultLegacy(Promise);
var flatten__default = /*#__PURE__*/_interopDefaultLegacy(flatten);

const getClient = async (credentials, attempts = 3) => {
  try {
    return await mongodb.MongoClient.connect(credentials, {
      useUnifiedTopology: true
    })
  } catch (err) {
    if (!attempts) {
      throw err
    }

    await Promise__default['default'].delay(100);
    return getClient(credentials, attempts - 1)
  }
};

const computeKeys = (schema) => {
  const indexes = schema.paths.filter(path => {
    return schema.schemaAtPath(path).settings.index
  }).map((path) => schema.schemaAtPath(path));

  const uniqueKeys = schema.paths.filter(path => {
    return schema.schemaAtPath(path).settings.unique
  }).map((path) => schema.schemaAtPath(path));

  const getKeyValue = (child, prop = 'index') => {
    return typeof child.settings[prop] === 'boolean' ? prop : child.settings[prop]
  };

  const getChildSettings = (childName) => {
    return schema.children.filter(({ fullName }) => {
      return fullName === childName
    })[0].settings
  };

  const indexesToCreate = [];
  const uniqueKeysToCreate = [];
  const groupIndexes = {};
  const groupUniqueKeys = {};

  const addIndex = (val, indexName, payload = {}) => {
    if (val === true) {
      indexesToCreate.push(Object.assign({}, payload, {
        [indexName]: 1
      }));
      indexesToCreate.push(Object.assign({}, payload, {
        [indexName]: -1
      }));
      return
    }
    indexesToCreate.push({}, payload, {
      [indexName]: val
    });
  };

  indexes.forEach(child => {
    const key = getKeyValue(child);
    const value = child.settings.index;

    if (key === 'index') {
      addIndex(value, child.fullPath);
      return
    }

    // initialize
    if (!groupIndexes[key]) {
      groupIndexes[key] = {};
    }

    // todo: compute all possibilities (permutation)
    Object.assign(groupIndexes[key], {
      [child.fullPath]: true
    });
  });

  uniqueKeys.forEach(child => {
    const key = getKeyValue(child, 'unique');

    if (key === 'unique') {
      const opts = {};

      if (child.fullPath !== '_id') {
        Object.assign(opts, {
          unique: true,
          sparse: child.settings.sparse || false
        });
      }

      uniqueKeysToCreate.push([{
        [child.fullPath]: 1
      }, opts]);
      return
    }

    // initialize
    if (!groupUniqueKeys[key]) {
      groupUniqueKeys[key] = {};
    }

    Object.assign(groupUniqueKeys[key], {
      [child.fullPath]: 1,
      sparse: getChildSettings(child.fullPath).sparse
    });
  });

  // compute / permute
  Object.keys(groupIndexes).forEach(groupName => {
    const group = groupIndexes[groupName];
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
      const payloads = [payload];
      const objProps = Object.keys(payload);

      for (let i = 0; i < objProps.length; i++) {
        const prop = objProps[i];
        if (typeof payload[prop] === 'boolean') {
          return flatten__default['default']([computePayloads(Object.assign({}, payload, {
            [prop]: 1
          })), computePayloads(Object.assign({}, payload, {
            [prop]: -1
          }))])
        }
      }

      return payloads
    };

    indexesToCreate.push(...computePayloads(group));
  });

  Object.keys(groupUniqueKeys).forEach(groupName => {
    const opts = { unique: true };
    const group = groupUniqueKeys[groupName];

    uniqueKeysToCreate.push([group, opts]);
  });

  const schemaIndexes = schema.settings.indexes || [];

  const schemaKeys = schemaIndexes.map(index => {
    return castArray__default['default'](index)
  });

  return indexesToCreate.concat(uniqueKeysToCreate).concat(schemaKeys).filter(payload => {
    return Object.keys(payload).length > 0
  })
};

const defaultDbName = kebabCase__default['default'](require(pkgUp__default['default'].sync()).name);
let client;

function index ({
  credentials = 'mongodb://localhost:27017',
  dbName = defaultDbName,
  debug = false
} = {}) {
  return async function ({ duckRack }) {
    if (!client) {
      client = await getClient(credentials);
    }

    const collection = client.db(dbName).collection(duckRack.name);
    try {
      await collection.dropIndexes();
    } catch (err) {
      // shh...
    }
    const keysToCreate = computeKeys(duckRack.duckModel.schema);

    await Promise__default['default'].each(keysToCreate, keys => {
      keys = castArray__default['default'](keys);

      if (Object.keys(keys[0]).length === 0) {
        return
      }

      return collection.createIndexes(...keys)
    });
    // collection.createIndexes()

    duckRack.collection = collection;

    duckRack.hook('before', 'create', ({ entry }) => {
      return collection.insertOne(entry)
    });

    duckRack.hook('before', 'update', async ({ oldEntry, newEntry, entry, result }) => {
      const query = {
        _id: oldEntry._id
      };
      if (oldEntry._v) {
        query._v = oldEntry._v;
      }

      const updated = await collection.updateOne(query, {
        $set: entry
      });

      if (updated.modifiedCount > 0) {
        result.push(entry);
      }
    });

    duckRack.hook('before', 'find', async ({ query, result }) => {
      const docs = await collection.find(query).toArray();
      docs.length > 0 && result.push(...docs);
    });

    duckRack.hook('before', 'deleteById', async ({ _id, result }) => {
      const deleted = await collection.deleteOne({ _id });
      result.push(deleted.deletedCount > 0);
    });

    duckRack.hook('before', 'findOneById', async ({ queryInput, result }) => {
      const found = await collection.findOne(queryInput);
      found && result.push(found);
    });

    duckRack.mongoClient = client;
  }
}

module.exports = index;
