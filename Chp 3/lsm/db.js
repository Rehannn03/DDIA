import Index from './index.js'
import Log from './log.js'
import fs from 'fs'
class DB{
    constructor(){

        this.index=null
        this.log=new Log()
        this.init()
    }

    init(){
        const indexData=fs.readFileSync('index.json','utf-8')
        this.index=new Index(JSON.parse(indexData))
    }

    set(key, value){
        const { segmentId, offset, length } = this.log.append(value)
        this.index.set(key, { segmentId, offset, length })
    }


    get(key){
        if(this.index.has(key)){
            const { segmentId, offset, length } = this.index.get(key)
            return this.log.read(segmentId ?? 1, offset, length)
        }
        return null
    }
}

export default DB