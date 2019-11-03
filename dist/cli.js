"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra-promise");
const JSZip = require("jszip");
const ut = require("./gerberutils");
const converters_1 = require("./converters");
const excellonparser_1 = require("./excellonparser");
const { performance } = require('perf_hooks');
let results = [];
function parseGerber(zipFileName, fileName, content) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield converters_1.Init;
            //console.log(`Parsing '${fileName}'`);
            let start = performance.now();
            converters_1.GerberToPolygons(content);
            let duration = performance.now() - start;
            results.push({
                zipFileName: zipFileName,
                file: fileName,
                status: "success",
                duration: duration,
                type: "Gerber",
            });
        }
        catch (e) {
            //console.log(`Parsing '${fileName}' - error ${e}`);
            results.push({
                zipFileName: zipFileName,
                file: fileName,
                status: "parse error",
                err: e,
                type: "Gerber",
            });
        }
    });
}
function parseExcellon(zipFileName, fileName, content) {
    try {
        //console.log(`Parsing '${fileName}'`);
        let parser = new excellonparser_1.ExcellonParser();
        let start = performance.now();
        parser.parseBlock(content);
        parser.flush();
        let duration = performance.now() - start;
        results.push({
            zipFileName: zipFileName,
            file: fileName,
            status: "success",
            duration: duration,
            type: "Excellon",
        });
    }
    catch (e) {
        //console.log(`Parsing '${fileName}' - error ${e}`);
        results.push({
            zipFileName: zipFileName,
            file: fileName,
            status: "parse error",
            err: e,
            type: "Excellon",
        });
    }
}
function processZipFile(zipFileName) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Processing ${zipFileName}`);
        let data;
        try {
            data = yield fs.readFileAsync(zipFileName);
        }
        catch (err) {
            results.push({ zipFileName: zipFileName, status: "io error", err: err });
            return;
        }
        let zip;
        try {
            zip = yield new JSZip().loadAsync(data);
        }
        catch (err) {
            results.push({ zipFileName: zipFileName, status: "unzip error", err: err });
            return;
        }
        for (let fileName in zip.files) {
            let file = zip.files[fileName];
            if (file.dir) {
                //console.log(`Folder ${fileName}`);
            }
            else {
                if (fileName.endsWith('.DS_Store')) {
                    continue;
                }
                if (fileName.indexOf('__MACOSX') >= 0) {
                    continue;
                }
                let fileExt = ut.GerberUtils.getFileExt(fileName.toLowerCase());
                if (ut.GerberUtils.bannedExtensions.indexOf(fileExt) >= 0) {
                    continue;
                }
                let info = ut.GerberUtils.determineSideAndLayer(fileName);
                //console.log(`File: ${fileName} ${ut.BoardSide[info.side]} ${ut.BoardLayer[info.layer]}`);
                if (info.layer != ut.BoardLayer.Unknown && info.side != ut.BoardSide.Unknown) {
                    let content;
                    try {
                        content = yield file.async("text");
                    }
                    catch (err) {
                        results.push({ zipFileName: zipFileName, file: fileName, status: "unzip error", err: err });
                        return;
                    }
                    let fileType = ut.GerberUtils.boardFileType(content);
                    let result = ((info.layer == ut.BoardLayer.Drill && fileType == ut.BoardFileType.Unsupported) || fileType == ut.BoardFileType.Drill ?
                        parseExcellon(zipFileName, fileName, content)
                        : yield parseGerber(zipFileName, fileName, content));
                }
                else {
                    results.push({ zipFileName: zipFileName, file: fileName, status: "skip" });
                }
            }
        }
    });
}
function processGerbers(inputFiles) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`${inputFiles.length} input files`);
        for (let w of inputFiles) {
            yield processZipFile(w);
        }
        let stream = fs.createWriteStream('test-results.json');
        stream.write(JSON.stringify(results, null, 2));
        stream.end();
    });
}
;
function percent(n) {
    return (n * 100).toFixed(2) + "%";
}
function fixed(n, pos) {
    let result = n.toFixed(0);
    while (result.length < pos) {
        result = '0' + result;
    }
    return result;
}
function formatTime(millis) {
    return fixed(millis / 1000 / 60, 2) + ':'
        + fixed((millis / 1000) % 60, 2) + '.'
        + fixed(millis % 1000, 3);
}
function analyze(result) {
    let totalCount = result.length;
    let successResults = result.filter(r => r.status == "success");
    let successCount = successResults.length;
    let successGerber = successResults.filter(r => r.type == "Gerber");
    let successExcellon = successResults.filter(r => r.type == "Excellon");
    let successCountGerber = successGerber.length;
    let successCountExcellon = successExcellon.length;
    let totalDuration = successResults.map(r => r.duration).reduce((a, r) => a += r);
    let totalDurationGerber = successGerber.map(r => r.duration).reduce((a, r) => a += r);
    let totalDurationExcellon = successExcellon.map(r => r.duration).reduce((a, r) => a += r);
    let slowestGerber = successGerber.sort((a, b) => b.duration - a.duration)[0];
    let slowestExcellon = successExcellon.sort((a, b) => b.duration - a.duration)[0];
    let perseError = result.filter(r => r.status == "parse error");
    let parseErrorCount = perseError.length;
    let parseErrorCountGerber = perseError.filter(r => r.type == "Gerber").length;
    let parseErrorCountExcellon = perseError.filter(r => r.type == "Excellon").length;
    let ioErrorCount = result.filter(r => r.status == "io error").length;
    let unzipErrorCount = result.filter(r => r.status == "unzip error").length;
    let skipCount = result.filter(r => r.status == "skip").length;
    let filesTried = totalCount - skipCount - unzipErrorCount - ioErrorCount;
    console.log(`Total results ${totalCount}`);
    console.log(`Skipped       ${skipCount}\t${percent(skipCount / totalCount)}`);
    console.log(`Success       ${successCount}\t${percent(successCount / filesTried)}`);
    console.log(`    Gerber    ${successCountGerber}`);
    console.log(`    Excellon  ${successCountExcellon}`);
    console.log(`Parse Error   ${parseErrorCount}\t${percent(parseErrorCount / filesTried)}`);
    console.log(`    Gerber    ${parseErrorCountGerber}`);
    console.log(`    Excellon  ${parseErrorCountExcellon}`);
    console.log(`Total time    ${formatTime(totalDuration)}`);
    console.log(`    Gerber    ${formatTime(totalDurationGerber)}`);
    console.log(`    Excellon  ${formatTime(totalDurationExcellon)}`);
    console.log('Slow pokes');
    console.log(`    Gerber    ${formatTime(slowestGerber.duration)}\t${slowestGerber.zipFileName}\t${slowestGerber.file}`);
    console.log(`    Excellon  ${formatTime(slowestExcellon.duration)}\t${slowestExcellon.zipFileName}\t${slowestExcellon.file}`);
    console.log(`I/O Error     ${ioErrorCount}`);
    console.log(`Unzip Error   ${unzipErrorCount}`);
    return {
        totalCount: totalCount,
        successCount: successCount,
        successCountGerber: successCountGerber,
        successCountExcellon: successCountExcellon,
        parseErrorCount: parseErrorCount,
        parseErrorCountGerber: parseErrorCountGerber,
        parseErrorCountExcellon: parseErrorCountExcellon,
        totalDuration: totalDuration,
        totalDurationGerber: totalDurationGerber,
        totalDurationExcellon: totalDurationExcellon,
        slowestGerber: slowestGerber,
        slowestExcellon: slowestExcellon,
        ioErrorCount: ioErrorCount,
        unzipErrorCount: unzipErrorCount,
        skipCount: skipCount,
        filesTried: filesTried
    };
}
function compare(oldResult, newResult) {
    console.log('-------------------------------------------------');
    console.log('New and old comparison:');
    console.log(`Total results ${oldResult.totalCount}\t\t\t${newResult.totalCount}`);
    console.log(`Skipped       ${oldResult.skipCount}\t${percent(oldResult.skipCount / oldResult.totalCount)}\t\t${newResult.skipCount}\t${percent(newResult.skipCount / newResult.totalCount)}`);
    console.log(`Success       ${oldResult.successCount}\t${percent(oldResult.successCount / oldResult.filesTried)}\t\t${newResult.successCount}\t${percent(newResult.successCount / newResult.filesTried)}`);
    console.log(`  Gerber      ${oldResult.successCountGerber}\t \t\t${newResult.successCountGerber}`);
    console.log(`  Excellon    ${oldResult.successCountExcellon}\t \t\t${newResult.successCountExcellon}`);
    console.log(`Parse Error   ${oldResult.parseErrorCount}\t${percent(oldResult.parseErrorCount / oldResult.filesTried)}\t\t${newResult.parseErrorCount}\t${percent(newResult.parseErrorCount / newResult.filesTried)}`);
    console.log(`  Gerber      ${oldResult.parseErrorCountGerber}\t \t\t${newResult.parseErrorCountGerber}`);
    console.log(`  Excellon    ${oldResult.parseErrorCountExcellon}\t \t\t${newResult.parseErrorCountExcellon}`);
    console.log(`Total time    ${formatTime(oldResult.totalDuration)}\t \t\t${formatTime(newResult.totalDuration)}`);
    console.log(`  Gerber      ${formatTime(oldResult.totalDurationGerber)}\t \t\t${formatTime(newResult.totalDurationGerber)}`);
    console.log(`  Excellon    ${formatTime(oldResult.totalDurationExcellon)}\t \t\t${formatTime(newResult.totalDurationExcellon)}`);
    console.log(`I/O Error     ${oldResult.ioErrorCount}\t\t\t\t${newResult.ioErrorCount}`);
    console.log(`Unzip Error   ${oldResult.unzipErrorCount}\t\t\t\t${newResult.unzipErrorCount}`);
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        let oldStats = {};
        if (fs.existsSync('test-results.json')) {
            let prevResults = yield fs.readFileAsync('test-results.json')
                .then(jsonText => JSON.parse(jsonText.toString()));
            oldStats = analyze(prevResults);
        }
        let folder = "../pcbs/gerbers";
        let inputFiles = fs.readdirSync(folder)
            .filter(fileName => fileName.endsWith('.zip'))
            .map(fileName => folder + "/" + fileName);
        yield processGerbers(inputFiles);
        let newStats = analyze(results);
        compare(oldStats, newStats);
    });
}
main()
    .then(() => console.log('done'))
    .catch(error => console.error(error));
//# sourceMappingURL=cli.js.map