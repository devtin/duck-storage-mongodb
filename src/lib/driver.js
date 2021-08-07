import { MongoClient } from 'mongodb'
import Promise from 'bluebird'

export const getClient = async (credentials, attempts = 3) => {
  console.log({ credentials })
  try {
    return await MongoClient.connect(credentials, {
      useUnifiedTopology: true
    })
  } catch (err) {
    console.log({ err })
    if (!attempts) {
      throw err
    }

    await Promise.delay(100)
    return getClient(credentials, attempts - 1)
  }
}
