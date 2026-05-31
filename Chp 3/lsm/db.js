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
        const {offset,length}=this.log.append(value)
        this.index.set(key, {offset,length})
        
    }


    get(key){
        if(this.index.has(key)){
            const {offset,length}=this.index.get(key)
            console.log("Offset and length:",offset,length)
            return this.log.read(offset,length)
        }
        return null
    }
}

export default DB