import * as cvt from "./converters";
import * as fs from "fs-extra-promise";
import * as JSZip from "jszip";
import * as ut from "./GerberUtils";

import {GerberToPolygons, Init} from "./converters";

let results = [];

async function parseGerber(zipFileName:string, fileName:string, content:string) {
    try {
        await Init;
        //console.log(`Parsing '${fileName}'`);
        GerberToPolygons(content);
        results.push({zipFileName: zipFileName, gerber:fileName, status:"success"});
    } catch (e) {
        //console.log(`Parsing '${fileName}' - error ${e}`);
        results.push({zipFileName: zipFileName, gerber:fileName, status:"parse error", err:e});
    }
}

async function processZipFile(zipFileName:string) {
    console.log(`Processing ${zipFileName}`);
    let data;
    try {
        data = await fs.readFileAsync(zipFileName);
    } catch (err) {
        results.push({zipFileName: zipFileName, status:"io error", err:err});
        return;
    }
    let zip;
    try {
        zip = await new JSZip().loadAsync(data);
    } catch (err) {
        results.push({zipFileName: zipFileName, status:"unzip error", err:err});
        return;
    }
    for (let fileName in zip.files) {
        let file = zip.files[fileName];
        if (file.dir) {
            //console.log(`Folder ${fileName}`);
        } else {
            if (fileName.endsWith('.DS_Store')
                || fileName.toLowerCase().endsWith('.drl')
                || fileName.toLowerCase().endsWith('.drill')) {
                continue;
            }
            if (fileName.indexOf('__MACOSX') >= 0) {
                continue;
            }
            let info = ut.GerberUtils.determineSideAndLayer(fileName);
            //console.log(`File: ${fileName} ${ut.BoardSide[info.side]} ${ut.BoardLayer[info.layer]}`);
            if (info.layer != ut.BoardLayer.Unknown && info.side != ut.BoardSide.Unknown) {
                let content:string;
                try {
                    content = await file.async("text");
                } catch (err) {
                    results.push({zipFileName: zipFileName, gerber:fileName, status:"unzip error", err:err});
                    return;
                }
                let result = await parseGerber(zipFileName, fileName, content);
            } else {
                results.push({zipFileName: zipFileName, gerber:fileName, status:"skip"});
            }
        }
    }
}

async function processGerbers(inputFiles:Array<string>) {
    console.log(`${inputFiles.length} input files`);
    for (let w of inputFiles) {
        await processZipFile(w);
    }
    let stream = fs.createWriteStream('test-results.json');
    stream.write(JSON.stringify(results, null, 2));
    stream.end();
};

function percent(n:number):string {
    return (n * 100).toFixed(2) + "%";
}

function analyze(result:Array<any>):any {
    let totalCount = result.length;
    let successCount = result.filter(r => r.status == "success").length;
    let parseErrorCount = result.filter(r => r.status == "parse error").length;
    let ioErrorCount = result.filter(r => r.status == "io error").length;
    let unzipErrorCount = result.filter(r => r.status == "unzip error").length;
    let skipCount = result.filter(r => r.status == "skip").length;
    let gerbersTried = totalCount - skipCount - unzipErrorCount - ioErrorCount;
    console.log(`Total results ${totalCount}`);
    console.log(`Skipped       ${skipCount}\t${percent(skipCount / totalCount)}`);
    console.log(`Success       ${successCount}\t${percent(successCount / gerbersTried)}`);
    console.log(`Parse Error   ${parseErrorCount}\t${percent(parseErrorCount / gerbersTried)}`);
    console.log(`I/O Error     ${ioErrorCount}`);
    console.log(`Unzip Error   ${unzipErrorCount}`);
    return {
        totalCount:totalCount,
        successCount:successCount,
        parseErrorCount:parseErrorCount,
        ioErrorCount:ioErrorCount,
        unzipErrorCount:unzipErrorCount,
        skipCount:skipCount,
        gerbersTried:gerbersTried
    };
}

function compare(oldResult:any, newResult:any) {
    console.log('-------------------------------------------------');
    console.log('New and old comparison:');
    console.log(`Total results ${oldResult.totalCount}\t\t\t${newResult.totalCount}`);
    console.log(`Skipped       ${oldResult.skipCount}\t${percent(oldResult.skipCount / oldResult.totalCount)}\t\t${newResult.skipCount}\t${percent(newResult.skipCount / newResult.totalCount)}`);
    console.log(`Success       ${oldResult.successCount}\t${percent(oldResult.successCount / oldResult.gerbersTried)}\t\t${newResult.successCount}\t${percent(newResult.successCount / newResult.gerbersTried)}`);
    console.log(`Parse Error   ${oldResult.parseErrorCount}\t${percent(oldResult.parseErrorCount / oldResult.gerbersTried)}\t\t${newResult.parseErrorCount}\t${percent(newResult.parseErrorCount / newResult.gerbersTried)}`);
    console.log(`I/O Error     ${oldResult.ioErrorCount}\t\t\t\t${newResult.ioErrorCount}`);
    console.log(`Unzip Error   ${oldResult.unzipErrorCount}\t\t\t\t${newResult.unzipErrorCount}`);
}

async function main () {
    let oldStats = {};
    if (fs.existsSync('test-results.json')) {
        let prevResults = await fs.readFileAsync('test-results.json')
            .then(jsonText => JSON.parse(jsonText.toString()));
        oldStats = analyze(prevResults);
    }
    let folder = "../pcbs/gerbers";
    let inputFiles = fs.readdirSync(folder)
        .filter(fileName => fileName.endsWith('.zip'))
        .map(fileName => folder + "/" + fileName);
    await processGerbers(inputFiles);
    let newStats = analyze(results);
    compare(oldStats, newStats);
}

main()
    .then(() => console.log('done'))
    .catch(error => console.error(error));
