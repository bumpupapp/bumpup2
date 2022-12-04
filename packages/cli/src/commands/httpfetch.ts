let name = 'http-fetch'

let setup = ({onResolve, onLoad}) => {
    onResolve({filter: /^https:\/\//}, resolveFile)
    onResolve({filter: /.*/, namespace: 'http-fetch'}, resolveUrl)
    onLoad({filter: /.*/, namespace: 'http-fetch'}, loadSource)
}

let resolveFile = ({path}) => ({
    path: path,
    namespace: 'http-fetch'
})

let resolveUrl = ({path, importer}) => ({
    path: new URL(path, importer).href,
    namespace: 'http-fetch'
})

let loadSource = async ({path}) => {
    let source = await fetch(path)

    if (!source.ok) {
        let message = `GET ${path} failed: status ${source.status}`
        throw new Error(message)
    }

    let contents = await source.text()
    let pattern = /\/\/# sourceMappingURL=(\S+)/
    let match = contents.match(pattern)
    if (match) {
        let url = new URL(match[1], source.url)
        let dataurl = await loadMap(url)
        let comment = `//# sourceMappingURL=${dataurl}`
        contents = contents.replace(pattern, comment)
    }

    let {pathname} = new URL(source.url)
    let loader = pathname.match(/[^.]+$/)[0]
    if(!['cjs','mjs','js','jsx','ts','tsx','json','css','text','binary','base64','dataurl','file1'].includes(loader)){
        loader = 'ts'
    }
    if(['mjs','cjs'].includes(loader)){
        loader = 'js'
    }
    return {contents, loader}
}

let loadMap = async url => {
    let map = await fetch(url)
    let type = map.headers.get('content-type').replace(/\s/g, '')
    let buffer = await map.arrayBuffer()
    let blob = new Blob([buffer], {type})
    let reader = new FileReader()
    return new Promise(cb => {
        reader.onload = e => cb(e.target.result)
        reader.readAsDataURL(blob)
    })
}

export default {name, setup}
