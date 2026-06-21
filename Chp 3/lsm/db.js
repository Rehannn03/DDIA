import Index from './index.js'
import Log from './log.js'
import { parseRecord } from './segment.js'
import fs from 'fs'

class DB {
    constructor() {
        this.log = new Log()

        let indexData = {}
        if (fs.existsSync('index.json')) {
            indexData = JSON.parse(fs.readFileSync('index.json', 'utf-8'))
        }

        this.index = new Index(indexData)

        const referencedIds = new Set(
            Object.values(indexData).map((entry) => entry.segmentId)
        )
        const segmentRemap = this.log.normalizeSegmentIds(referencedIds)
        if (segmentRemap.size > 0) {
            this.index.remapSegmentIds(segmentRemap)
        }
    }

    set(key, value) {
        const { segmentId, offset, length, indexUpdates, segmentRemap } = this.log.append(key, value)
        this.index.set(key, { segmentId, offset, length })

        if (indexUpdates) {
            this.index.setMany(indexUpdates)
        }

        if (segmentRemap?.size > 0) {
            this.index.remapSegmentIds(segmentRemap)
        }
    }

    get(key) {
        if (this.index.has(key)) {
            const { segmentId, offset, length } = this.index.get(key)
            const line = this.log.read(segmentId, offset, length)
            return parseRecord(line).value
        }
        return null
    }
}

export default DB
