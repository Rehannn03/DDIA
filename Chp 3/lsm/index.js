
class Index{
    constructor(){
        this.index=new Map()
    }

    set(key,value){
        this.index.set(key,value)
    }

    get(key){
        return this.index.get(key)
    }

    has(key){
        return this.index.has(key)
    }
}


export default Index