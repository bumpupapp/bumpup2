import * as esbuild from 'https://deno.land/x/esbuild@v0.15.16/mod.js'
import httpFetch from 'https://deno.land/x/esbuild_plugin_http_fetch@v1.0.2/index.js'
const AsyncFunction = async function () {}.constructor

export const build = async (options: Record<string, unknown>) => {
    try{
        await esbuild.initialize({})
        const output = await esbuild.build({
            bundle: true,
            write: false,
            plugins: [httpFetch],
            minify: true,
            logLevel: 'silent',
            loader: {
                '.ts':'ts'
            },
            format: 'esm',
            ...options
        })
        esbuild.stop()
        return output.outputFiles?.[0].text
    }catch(e){
        esbuild.stop()
        console.log(e)
        throw new ModuleBuildError(e)
    }
}

export const parseBuildOutput = (module: string): string => {
    return module
        .replace(/\{(\w+) as (\w+)}/, `{'$2':$1}`)
        .replace('export','return')
}

export const importModule = async (module: string) => {
    const text = await build({
        entryPoints: [module]
    })
    return AsyncFunction(parseBuildOutput(text))()
}
// export const importString = async (module: string) => {
//     const text = await build({
//         stdin:{
//
//         },
//         resolveDir: '',
//     })
//     return AsyncFunction(parseBuildOutput(text))()
// }

export class ModuleBuildError extends Error {
    constructor(public error: Error){
        super(error.message);
        this.error = error;
    }
}