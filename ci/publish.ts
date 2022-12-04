import {walk} from "https://deno.land/std@0.165.0/fs/walk.ts";
import {globToRegExp} from "https://deno.land/std@0.158.0/path/glob.ts";
import * as path from "https://deno.land/x/std@0.158.0/path/mod.ts";
import { Sha1 } from "https://deno.land/std@0.160.0/hash/sha1.ts"
import { basename } from "https://deno.land/std@0.166.0/path/posix.ts";
import {exec} from "https://deno.land/x/exec/mod.ts";

class BackBlazeClient {
    constructor(private accessKey: string, private secretKey: string, private bucketId: string) {
    }

    private async getToken(){
        const raw = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account',{headers:{
                'Authorization': 'Basic ' + btoa(`${this.accessKey}:${this.secretKey}`)
            }})
        return raw.json()
    }

    private async getUploadUrl(){
        const {authorizationToken, apiUrl} = await this.getToken()
        const raw = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
            method: 'POST',
            headers: {'Authorization': authorizationToken},
            body: JSON.stringify({bucketId: this.bucketId})
        })
        return raw.json()
    }

    public async uploadString(filename: string,content: string){
        const {authorizationToken, uploadUrl} = await this.getUploadUrl()
        const sha1 = new Sha1().update(content).toString()

        const raw = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization':authorizationToken,
                'X-Bz-File-Name':filename,
                'Content-Type':'text/plain',
                'X-Bz-Content-Sha1':sha1,
                'X-Bz-Server-Side-Encryption':'AES256'
            },
            body: content
        })
        return raw.json()
    }
}

let backblazeConfig = {accessKey: '',secretKey: '',bucketId: ''}
try{
    backblazeConfig = JSON.parse(await Deno.readTextFile('env.json'))
}catch{
    if(Deno.env.get("B2_ACCESS_KEY")){
        backblazeConfig.accessKey = Deno.env.get("B2_ACCESS_KEY")
    }
    if(Deno.env.get("B2_SECRET_KEY")){
        backblazeConfig.secretKey = Deno.env.get("B2_SECRET_KEY")
    }
    if(Deno.env.get("B2_BUCKET_ID")){
        backblazeConfig.bucketId = Deno.env.get("B2_BUCKET_ID")
    }
}
const {accessKey, secretKey, bucketId} = backblazeConfig

const client = new BackBlazeClient(accessKey, secretKey, bucketId)


const globs = [
    'build/*.bundle.ts'
]
const cwd = '.'
const baseDir= '@bumpup'
for await (const entry of walk(cwd,{match: globs.map(globToRegExp)})) {
    const posixPath = entry.path.replaceAll('\\','/')
    const fileName = `${baseDir}/${basename(posixPath)}`
    const file = await Deno.readTextFile(path.join('.',entry.path))
    await client.uploadString(fileName,file)
    console.log(`Uploaded ${fileName}`)
}
const archs = [
    {name: 'x86_64-unknown-linux-gnu', prefix:'bumpup_linux_x68'},
    {name: 'x86_64-pc-windows-msvc', prefix:'bumpup.exe'},
    {name: 'x86_64-apple-darwin', prefix:'bumpup_darwin_x86'},
    {name: 'aarch64-apple-darwin', prefix:'bumpup_darwin_aarch64'},
]
await Promise.allSettled(archs.map(({name, prefix})=>{
    return  Deno.readFile(path.join(Deno.cwd(),`build/${prefix}`))
        .then(file=>client.uploadString(`binaries/${prefix}`, file))
        .then(()=>console.log(`Uploaded ${prefix}`))
}))