import fs from 'fs'

export function serializeRecord(key, value) {
    return JSON.stringify({ key, value })
}

export function parseRecord(line) {
    return JSON.parse(line.trim())
}

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

    append(key, value) {
        const stats = fs.statSync(this.filePath)
        const offset = stats.size
        const data = serializeRecord(key, value) + '\n'
        const buffer = Buffer.from(data)
        fs.writeSync(this.fd, buffer, 0, buffer.length, offset)

        return {
            offset,
            length: buffer.length
        }
    }

    read(offset, length) {
        const buffer = Buffer.alloc(length)
        fs.readSync(this.fd, buffer, 0, length, offset)
        return buffer.toString('utf-8').trimEnd()
    }

    scan() {
        const content = fs.readFileSync(this.filePath, 'utf-8')
        const records = []
        let offset = 0

        for (const line of content.split('\n')) {
            if (!line) {
                offset += 1
                continue
            }

            const length = Buffer.byteLength(line + '\n')
            const { key, value } = parseRecord(line)
            records.push({ key, value, offset, length })
            offset += length
        }

        return records
    }
}

export default Segment
