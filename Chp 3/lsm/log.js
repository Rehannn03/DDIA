import fs from 'fs'
import Segment from './segment.js'

class Log {
    constructor() {
        this.segmentId = 1
        this.activeSegment = null
        this.MAX_SEGMENT_SIZE = 64
        this.init()
    }

    init() {
        if (!fs.existsSync('segments')) {
            fs.mkdirSync('segments')
        }
        this.activeSegment = new Segment(`segments/segment-${this.segmentId}.log`)
    }

    rotate() {
        this.activeSegment.close()
        this.segmentId++
        this.activeSegment = new Segment(`segments/segment-${this.segmentId}.log`)
    }

    append(message) {
        const currentSegmentId = this.segmentId
        const result = this.activeSegment.append(message)

        if (fs.statSync(this.activeSegment.filePath).size >= this.MAX_SEGMENT_SIZE) {
            this.rotate()
        }

        return {
            segmentId: currentSegmentId,
            offset: result.offset,
            length: result.length
        }
    }

    read(segmentId, offset, length) {
        if (segmentId === this.segmentId) {
            return this.activeSegment.read(offset, length)
        }

        const segment = new Segment(`segments/segment-${segmentId}.log`)
        const value = segment.read(offset, length)
        segment.close()
        return value
    }
}

export default Log
