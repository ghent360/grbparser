import * as cvt from "./converters";
import * as fs from "fs-extra-promise";
import * as JSZip from "jszip";
import * as ut from "./GerberUtils";

import {GerberToPolygons, Init} from "./converters";

let results = [];

async function parseGerber(zipFileName:string, fileName:string, content:string) {
    await Init;
    try {
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
    let data = await fs.readFileAsync(zipFileName);
    let zip = await new JSZip().loadAsync(data);
    for (let fileName in zip.files) {
        let file = zip.files[fileName];
        if (file.dir) {
            //console.log(`Folder ${fileName}`);
        } else {
            if (fileName.endsWith('.DS_Store')) {
                continue;
            }
            let info = ut.GerberUtils.determineSideAndLayer(fileName);
            //console.log(`File: ${fileName} ${ut.BoardSide[info.side]} ${ut.BoardLayer[info.layer]}`);
            if (info.layer != ut.BoardLayer.Unknown && info.side != ut.BoardSide.Unknown) {
                let content = await file.async("text");
                let result = await parseGerber(zipFileName, fileName, content);
            } else {
                results.push({zipFileName: zipFileName, gerber:fileName, status:"skip"});
            }
        }
    }
}

async function asyncForEach<T>(array:Array<T>, callback: (input:T) => Promise<void>) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index])
    }
}

const start = async (folder:string) => {
    let inputFiles = fs.readdirSync(folder).filter(fileName => fileName.endsWith('.zip'));
    console.log(`${inputFiles.length} input files`);
    await asyncForEach(
        inputFiles,
        async (fileName) => {
            let zipFileName = folder + "/" + fileName;
            await processZipFile(zipFileName);
        });
    console.log('done');
    let stream = fs.createWriteStream('test-results.json');
    stream.write(JSON.stringify(results, null, 2));
    stream.end();
};

start("../pcbs/gerbers");
