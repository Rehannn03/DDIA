import DB from './db.js'

const db=new DB()
const first=db.set('name', 'John')
const second=db.set('age', 30)
const third=db.set('city', 'New York')
const fourth=db.set('country', 'USA')
const fifth=db.set('email', 'john@example.com')
const sixth=db.set('phone', '1234567890')
const seventh=db.set('address', '123 Main St, Anytown, USA')
const eighth=db.set('zip', '12345')
const ninth=db.set('state', 'CA')
const tenth=db.set('country', 'USA')

// console.log(db.get('name'))
// console.log(db.get('age'))
// console.log(db.get('city'))
// console.log(db.get('country'))