import DB from './db.js'

const db=new DB()
const first=db.set('name', 'John')
const second=db.set('age', 30)


console.log(db.get('name'))