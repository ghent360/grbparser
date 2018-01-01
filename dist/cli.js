"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const JSZip = require("jszip");
const ut = require("./GerberUtils");
const converters_1 = require("./converters");
function usage() {
    console.log('Usage: parge_gerber {zip file}');
}
function parseGerber(fileName, content) {
    converters_1.Init.then(() => {
        try {
            console.log(`Parsing '${fileName}'`);
            converters_1.GerberToPolygons(content);
        }
        catch (e) {
            console.log(`Parsing '${fileName}' - error ${e}`);
        }
    });
}
function main(args) {
    console.log(`args: ${args}`);
    if (args.length < 3) {
        usage();
        return;
    }
    fs.readFile(args[2], (err, data) => {
        if (err) {
            console.log(`Error reading input file ${err}`);
            return;
        }
        new JSZip()
            .loadAsync(data)
            .then(zip => {
            for (let fileName in zip.files) {
                let file = zip.files[fileName];
                if (file.dir) {
                    //console.log(`Folder ${fileName}`);
                }
                else {
                    if (fileName.endsWith('.DS_Store')) {
                        continue;
                    }
                    let info = ut.GerberUtils.determineSideAndLayer(fileName);
                    //console.log(`File: ${fileName} ${ut.BoardSide[info.side]} ${ut.BoardLayer[info.layer]}`);
                    if (info.layer != ut.BoardLayer.Unknown && info.side != ut.BoardSide.Unknown) {
                        file.async("text").then(content => {
                            parseGerber(fileName, content);
                        });
                    }
                    else {
                        console.log(`Unknown file ${fileName}`);
                    }
                }
            }
        });
    });
}
main(process.argv);
//# sourceMappingURL=cli.js.map