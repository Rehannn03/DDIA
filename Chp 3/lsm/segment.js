import fs from 'fs'

class Segment {
    constructor(filePath) {
        this.filePath = filePath
        this.fd = null
        this.init()
    }

    init() {
        this.fd = fs.openSync(this.filePath, 'a+')
    }

    close() {
        fs.closeSync(this.fd)
    }

    append(message) {
        const stats = fs.statSync(this.filePath)
        const offset = stats.size
        const data = message + '\n'
        const buffer = Buffer.from(data)
        fs.writeSync(this.fd, buffer, 0, buffer.length, offset)

        return {
            offset,
            length: buffer.length
        }
    }

    read(offset, length) {
        const buffer = Buffer.alloc(1024)
        fs.readSync(this.fd, buffer, 0, length, offset)
        return buffer.toString('utf-8')
    }
}

export default Segment
