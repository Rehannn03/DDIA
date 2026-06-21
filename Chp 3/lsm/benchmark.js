import fs from 'fs'
import DB from './db.js'

const WRITES = parseInt(process.argv.find((a) => a.startsWith('--writes='))?.split('=')[1] ?? '200', 10)
const FRESH = process.argv.includes('--fresh')

function listSegments() {
    if (!fs.existsSync('segments')) {
        return []
    }
    return fs.readdirSync('segments').sort()
}

function segmentSnapshot() {
    return listSegments().map((file) => {
        const path = `segments/${file}`
        const content = fs.readFileSync(path, 'utf-8')
        const lines = content.split('\n').filter(Boolean)
        return {
            file,
            bytes: fs.statSync(path).size,
            records: lines.length
        }
    })
}

function resetData() {
    if (fs.existsSync('segments')) {
        fs.rmSync('segments', { recursive: true })
    }
    if (fs.existsSync('index.json')) {
        fs.unlinkSync('index.json')
    }
}

function attachObservers(log) {
    const events = []
    let maxSegmentsSeen = listSegments().length

    const trackSegments = (label, extra = {}) => {
        const segments = listSegments()
        maxSegmentsSeen = Math.max(maxSegmentsSeen, segments.length)
        events.push({ label, segments: [...segments], ...extra })
    }

    const origCompact = log.compactClosedSegments.bind(log)
    log.compactClosedSegments = function () {
        const closedBefore = log.getClosedSegmentIds()
        const result = origCompact()
        if (result) {
            trackSegments('compaction', {
                closedMerged: closedBefore,
                keysMerged: result.length
            })
        }
        return result
    }

    const origRotate = log.rotate.bind(log)
    log.rotate = function () {
        trackSegments('pre-rotate')
        const result = origRotate()
        trackSegments('post-rotate', { compacted: result.indexUpdates !== null })
        return result
    }

    return {
        events,
        get maxSegmentsSeen() {
            return maxSegmentsSeen
        }
    }
}

function printHeader(title) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(title)
    console.log('='.repeat(60))
}

if (FRESH) {
    resetData()
    console.log('Cleaned segments/ and index.json\n')
}

const db = new DB()
const observer = attachObservers(db.log)

printHeader('LSM Benchmark — writing load test')
console.log(`Writes: ${WRITES}`)
console.log(`MAX_SEGMENT_SIZE: ${db.log.MAX_SEGMENT_SIZE} bytes`)
console.log(`Compaction threshold: ${db.log.MAX_CLOSED_SEGMENTS_BEFORE_COMPACT} closed segments`)

const start = performance.now()

for (let i = 0; i < WRITES; i++) {
    const key = `key-${i % 50}`
    const value = `value-${i}-`.padEnd(20, 'x')
    db.set(key, value)

    if ((i + 1) % 50 === 0) {
        const snap = segmentSnapshot()
        console.log(
            `\nAfter ${i + 1} writes → segments: [${snap.map((s) => `${s.file}(${s.bytes}B, ${s.records} records)`).join(', ')}]`
        )
    }
}

const elapsed = performance.now() - start

printHeader('Event log (rotations & compactions)')
const rotations = observer.events.filter((e) => e.label === 'pre-rotate')
const compactions = observer.events.filter((e) => e.label === 'compaction')

console.log(`Rotations observed:   ${rotations.length}`)
console.log(`Compactions observed: ${compactions.length}`)
console.log(`Max segments on disk during run: ${observer.maxSegmentsSeen}`)

if (compactions.length > 0) {
    console.log('\nCompaction details (first 3):')
    compactions.slice(0, 3).forEach((event, i) => {
        console.log(
            `  ${i + 1}. merged closed [${event.closedMerged.join(', ')}] → ${event.keysMerged} keys`
        )
    })
    if (compactions.length > 3) {
        const last = compactions[compactions.length - 1]
        console.log(`  ... ${compactions.length - 3} more compactions`)
        console.log(
            `  ${compactions.length}. merged closed [${last.closedMerged.join(', ')}] → ${last.keysMerged} keys`
        )
    }
} else {
    console.log('\nNo compaction triggered (need 2+ closed segments on rotate).')
}

printHeader('Final segment state')
const finalSegments = segmentSnapshot()
if (finalSegments.length === 0) {
    console.log('No segment files found.')
} else {
    finalSegments.forEach((seg) => {
        console.log(`  ${seg.file}: ${seg.bytes} bytes, ${seg.records} records`)
    })
}

const index = JSON.parse(fs.readFileSync('index.json', 'utf-8'))
const indexSegmentIds = [...new Set(Object.values(index).map((e) => e.segmentId))].sort()
console.log(`\nIndex keys: ${Object.keys(index).length}`)
console.log(`Index segment IDs: [${indexSegmentIds.join(', ')}]`)
console.log(`Active segment ID: ${db.log.activeSegmentId}`)

printHeader('Read verification (sample)')

function latestWriteIndex(keyNum, totalWrites) {
    let latest = keyNum
    while (latest + 50 < totalWrites) {
        latest += 50
    }
    return latest
}

const sampleKeys = ['key-0', 'key-1', 'key-25', `key-${(WRITES - 1) % 50}`]
let readErrors = 0

for (const key of sampleKeys) {
    const keyNum = parseInt(key.split('-')[1], 10)
    const writeIdx = latestWriteIndex(keyNum, WRITES)
    const expected = `value-${writeIdx}-`.padEnd(20, 'x')
    const actual = db.get(key)
    const ok = actual === expected
    console.log(`  ${key}: ${ok ? 'OK' : 'FAIL'} (expected "${expected.trim()}")`)
    if (!ok) readErrors++
}

printHeader('Summary')
console.log(`Total writes:     ${WRITES}`)
console.log(`Time elapsed:     ${elapsed.toFixed(1)} ms`)
console.log(`Rotations:        ${rotations.length}`)
console.log(`Compactions:      ${compactions.length}`)
console.log(`Final segments:   ${finalSegments.length} file(s)`)
console.log(`Read errors:      ${readErrors}`)

if (compactions.length > 0 && finalSegments.length <= 2) {
    console.log('\nResult: Compaction is working. Multiple segments were created during')
    console.log('writes, merged when 2+ closed segments accumulated, then normalized to 1-2 files.')
} else if (rotations.length > 0 && compactions.length === 0) {
    console.log('\nResult: Rotations happened but compaction did not trigger yet.')
    console.log('Try more writes (--writes=500) to fill more segments.')
} else {
    console.log('\nResult: Not enough data to fill a segment. Try --writes=100 or lower MAX_SEGMENT_SIZE.')
}

console.log('\nUsage: node benchmark.js [--fresh] [--writes=200]')
