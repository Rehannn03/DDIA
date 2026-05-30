import Index from './index.js'
import Log from './log.js'

class DB{
    constructor(){
        this.index=new Index()
        this.log=new Log()
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