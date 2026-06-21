import fs from 'fs'

class Index{
    constructor(indexData){
        this.index=new Map()
        if(indexData){
            Object.entries(indexData).forEach(([key,value])=>{
                this.index.set(key,value)
            })
        }
    }

    set(key,value){
        this.index.set(key,value)
        this.saveIndex()
    }

    setMany(entries){
        entries.forEach(([key, ptr]) => {
            this.index.set(key, ptr)
        })
        this.saveIndex()
    }

    remapSegmentIds(idMap){
        this.index.forEach((ptr) => {
            const newId = idMap.get(ptr.segmentId)
            if (newId !== undefined) {
                ptr.segmentId = newId
            }
        })
        this.saveIndex()
    }

    get(key){
        return this.index.get(key)
    }

    has(key){
        return this.index.has(key)
    }

    saveIndex(filePath='index.json'){
        const data={}
        this.index.forEach((value,key)=>{
            data[key]=value
        })
        fs.writeFileSync(filePath,JSON.stringify(data,null,2))
    }
}


export default Index