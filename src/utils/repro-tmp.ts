import { catalogAnswer } from './ai'
import { seedProducts, seedCategories } from '../store/seed'
const c=catalogAnswer('movies D ?', seedProducts, seedCategories)
console.log('movies D ?:', JSON.stringify(c?.message?.slice(0,140)), 'conf', c?.confidence)
const c2=catalogAnswer('movies graded D', seedProducts, seedCategories)
console.log('movies graded D:', JSON.stringify(c2?.message?.slice(0,140)), 'conf', c2?.confidence)
const c3=catalogAnswer('show me movies D', seedProducts, seedCategories)
console.log('show me movies D:', JSON.stringify(c3?.message?.slice(0,140)), 'conf', c3?.confidence)
