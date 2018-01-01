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
            if (fileName.endsWith('.DS_Store')) {
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

const start = async (inputFiles:Array<string>) => {
    console.log(`${inputFiles.length} input files`);
    for (let idx = 0; idx < inputFiles.length; idx += 2) {
        let w1 = inputFiles[idx];
        let w2 = inputFiles[idx + 1];
        await Promise.all([processZipFile(w1), processZipFile(w2)]);
    }
    let stream = fs.createWriteStream('test-results.json');
    stream.write(JSON.stringify(results, null, 2));
    stream.end();
};

let folder = "../pcbs/gerbers";
let inputFiles = fs.readdirSync(folder)
    .filter(fileName => fileName.endsWith('.zip'))
    .map(fileName => folder + "/" + fileName);

start(inputFiles)
    .then(() => console.log('done'))
    .catch(err => console.error(err));
