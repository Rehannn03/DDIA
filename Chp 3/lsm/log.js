import fs from 'fs'
import Segment from './segment.js'

class Log {
    constructor() {
        this.activeSegmentId = 1
        this.nextSegmentId = 2
        this.activeSegment = null
        this.MAX_SEGMENT_SIZE = 64
        this.MAX_CLOSED_SEGMENTS_BEFORE_COMPACT = 2
        this.init()
    }

    init() {
        if (!fs.existsSync('segments')) {
            fs.mkdirSync('segments')
        }

        const existingIds = this.listAllSegmentIds()
        if (existingIds.length > 0) {
            this.activeSegmentId = Math.max(...existingIds)
            this.nextSegmentId = this.activeSegmentId + 1
        }

        this.activeSegment = new Segment(`segments/segment-${this.activeSegmentId}.log`)
    }

    listAllSegmentIds() {
        if (!fs.existsSync('segments')) {
            return []
        }

        return fs.readdirSync('segments')
            .map((file) => parseInt(file.match(/segment-(\d+)\.log/)?.[1], 10))
            .filter((id) => !isNaN(id))
    }

    rotate() {
        this.activeSegment.close()
        this.activeSegment = null
        const indexUpdates = this.compactClosedSegments()
        this.activeSegmentId = this.nextSegmentId++
        this.activeSegment = new Segment(`segments/segment-${this.activeSegmentId}.log`)
        const segmentRemap = this.normalizeSegmentIds()
        return { indexUpdates, segmentRemap }
    }

    append(key, value) {
        const currentSegmentId = this.activeSegmentId
        const result = this.activeSegment.append(key, value)
        let indexUpdates = null
        let segmentRemap = null

        if (fs.statSync(this.activeSegment.filePath).size >= this.MAX_SEGMENT_SIZE) {
            ({ indexUpdates, segmentRemap } = this.rotate())
        }

        return {
            segmentId: currentSegmentId,
            offset: result.offset,
            length: result.length,
            indexUpdates,
            segmentRemap
        }
    }

    read(segmentId, offset, length) {
        if (segmentId === this.activeSegmentId) {
            return this.activeSegment.read(offset, length)
        }

        const segment = new Segment(`segments/segment-${segmentId}.log`)
        const record = segment.read(offset, length)
        segment.close()
        return record
    }

    getClosedSegmentIds() {
        const allIds = this.listAllSegmentIds()

        if (!this.activeSegment) {
            return allIds.sort((a, b) => a - b)
        }

        return allIds
            .filter((id) => id !== this.activeSegmentId)
            .sort((a, b) => a - b)
    }

    deleteSegment(id) {
        const filePath = `segments/segment-${id}.log`
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
        }
    }

    compactClosedSegments() {
        const closedIds = this.getClosedSegmentIds()
        if (closedIds.length < this.MAX_CLOSED_SEGMENTS_BEFORE_COMPACT) {
            return null
        }

        const merged = new Map()

        for (const segmentId of closedIds) {
            const segment = new Segment(`segments/segment-${segmentId}.log`)
            for (const record of segment.scan()) {
                merged.set(record.key, {
                    value: record.value,
                    segmentId,
                    offset: record.offset,
                    length: record.length
                })
            }
            segment.close()
        }

        const newSegmentId = this.nextSegmentId++
        const compactedSegment = new Segment(`segments/segment-${newSegmentId}.log`)

        const indexUpdates = []
        for (const [key, { value }] of merged) {
            const { offset, length } = compactedSegment.append(key, value)
            indexUpdates.push([key, { segmentId: newSegmentId, offset, length }])
        }
        compactedSegment.close()

        for (const id of closedIds) {
            this.deleteSegment(id)
        }

        return indexUpdates
    }

    normalizeSegmentIds(referencedIds = null) {
        const activeId = this.activeSegmentId

        for (const id of this.listAllSegmentIds()) {
            const isActive = id === activeId
            const isReferenced = referencedIds ? referencedIds.has(id) : false
            if (!isActive && referencedIds && !isReferenced) {
                this.deleteSegment(id)
            }
        }

        const closedIds = this.getClosedSegmentIds()
        const idMap = new Map()

        for (const id of this.listAllSegmentIds()) {
            if (id !== activeId && !closedIds.includes(id)) {
                this.deleteSegment(id)
            }
        }

        let targetActive
        if (closedIds.length > 0) {
            let target = 1
            for (const id of closedIds) {
                if (id !== target) {
                    idMap.set(id, target)
                }
                target++
            }
            targetActive = target
        } else {
            targetActive = 1
        }

        if (activeId !== targetActive) {
            idMap.set(activeId, targetActive)
        }

        const needsRename = [...idMap.entries()].some(([oldId, newId]) => oldId !== newId)
        if (!needsRename) {
            const ids = this.listAllSegmentIds()
            this.nextSegmentId = (ids.length > 0 ? Math.max(...ids) : 0) + 1
            return idMap
        }

        if (this.activeSegment) {
            this.activeSegment.close()
            this.activeSegment = null
        }

        this.applyRenames(idMap)

        this.activeSegmentId = targetActive
        this.nextSegmentId = targetActive + 1
        this.activeSegment = new Segment(`segments/segment-${this.activeSegmentId}.log`)

        return idMap
    }

    applyRenames(idMap) {
        for (const [oldId, newId] of idMap) {
            if (oldId === newId) {
                continue
            }
            const from = `segments/segment-${oldId}.log`
            if (fs.existsSync(from)) {
                fs.renameSync(from, `segments/segment-temp-${oldId}.log`)
            }
        }

        for (const [oldId, newId] of idMap) {
            if (oldId === newId) {
                continue
            }
            const temp = `segments/segment-temp-${oldId}.log`
            if (fs.existsSync(temp)) {
                fs.renameSync(temp, `segments/segment-${newId}.log`)
            }
        }
    }
}

export default Log
