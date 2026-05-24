import Log from './log.js'

const log=new Log()


const offset=log.append('Hello, world!')
console.log(offset)

const offset2=log.append('Data appended')
console.log(offset2)

const data=log.read(offset)
console.log(data)


const data2=log.read(offset2)
console.log(data2)

log.close()