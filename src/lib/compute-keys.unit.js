import { computeKeys } from './compute-keys'
import { Schema } from 'duckfficer'
import test from 'ava'

// todo: include full text search
test('computes index keys', async t => {
  const someSchema = new Schema({
    name: {
      type: String,
      index: true
    },
    email: {
      type: String,
      unique: true
    },
    address: {
      street: String,
      zip: {
        type: Number,
        index: true
      }
    }
  })

  t.snapshot(computeKeys(someSchema))
})
