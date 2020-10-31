import { name, version, author, license } from './package.json'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'

const initialYear = 2020
const yearsActive = new Date().getFullYear() !== initialYear ? `${initialYear}-${new Date().getFullYear()}` : initialYear

const banner = `/*!
 * ${name} v${version}
 * (c) ${yearsActive} ${author}
 * ${license}
 */`

export default [
  {
    input: 'src/index.js',
    output: [
      {
        file: 'dist/duck-storage-mongodb.js',
        format: 'cjs',
        banner
      }
    ]
  }
]
