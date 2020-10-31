<p><img width="480" src="https://repository-images.githubusercontent.com/284732527/2b28a880-d57b-11ea-9b43-283e2cdd605c"/></p>

<div><h1>duck-storage-mongodb</h1></div>

<p>
    <a href="https://www.npmjs.com/package/duck-storage-mongodb" target="_blank"><img src="https://img.shields.io/npm/v/duck-storage-mongodb.svg" alt="Version"></a>
<a href="http://opensource.org/licenses" target="_blank"><img src="http://img.shields.io/badge/License-MIT-brightgreen.svg"></a>
</p>

<p>
    mongodb plugin for duck-storage
</p>

## Installation

```sh
$ npm i duck-storage-mongodb --save
# or
$ yarn add duck-storage-mongodb
```

## Features

- [computes index keys](#computes-index-keys)


<a name="computes-index-keys"></a>

## computes index keys


```js
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
```


* * *

### License

[MIT](https://opensource.org/licenses/MIT)

&copy; 2020-present Martin Rafael Gonzalez <tin@devtin.io>
