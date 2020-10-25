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
const ut = require("./gerberutils");
function percent(n) {
    return (n * 100).toFixed(2) + "%";
}
function analyze(result) {
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
    return;
}
function focus(result) {
    let parseErrors = result.filter(r => r.status == "parse error");
    let byErrorText = {};
    parseErrors.forEach(e => {
        let msg = e.err.message;
        if (!msg) {
            console.log(JSON.stringify(e));
        }
        let counter = byErrorText[msg];
        if (!counter) {
            byErrorText[msg] = 0;
        }
        byErrorText[msg]++;
    });
    let topErrors = [];
    for (let key in byErrorText) {
        let count = byErrorText[key];
        topErrors.push({ count: count, message: key });
    }
    topErrors.sort((a, b) => b.count - a.count);
    console.log('-----------------------------------');
    console.log('Top Errors');
    for (let idx = 0; idx < topErrors.length && idx < 10; idx++) {
        console.log(`${topErrors[idx].count}\t\t${topErrors[idx].message}`);
    }
    console.log('-----------------------------------');
    console.log('Error examples');
    for (let idx = 0; idx < topErrors.length && idx < 10; idx++) {
        console.log(`${topErrors[idx].message}`);
        let samples = result.filter(r => r.err && r.err.message == topErrors[idx].message);
        samples.slice(0, 5).forEach(r => console.log(`  ${r.zipFileName}:${r.gerber}`));
        console.log('');
    }
}
function focusSkip(result) {
    let parseErrors = result.filter(r => r.status == "skip");
    let byErrorText = {};
    parseErrors.forEach(e => {
        let fileName = e.gerber;
        if (!fileName) {
            console.log(JSON.stringify(e));
        }
        fileName = ut.GerberUtils.getFileName(fileName.toLowerCase());
        let fileExt = ut.GerberUtils.getFileExt(fileName);
        if (fileExt.length == 0) {
            //console.log(`Can not get file extension of ${e.gerber}`);
            return;
        }
        if (ut.GerberUtils.bannedExtensions.indexOf(fileExt) >= 0) {
            return;
        }
        let counter = byErrorText[fileName];
        if (!counter) {
            byErrorText[fileName] = 0;
        }
        byErrorText[fileName]++;
    });
    let topErrors = [];
    for (let key in byErrorText) {
        let count = byErrorText[key];
        topErrors.push({ count: count, message: key });
    }
    topErrors.sort((a, b) => b.count - a.count);
    console.log('-----------------------------------');
    console.log('Top Skipped names');
    for (let idx = 0; idx < topErrors.length && idx < 10; idx++) {
        console.log(`${topErrors[idx].count}\t\t${topErrors[idx].message}`);
    }
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        if (fs.existsSync('test-results.json')) {
            let results = yield fs.readFileAsync('test-results.json')
                .then(jsonText => JSON.parse(jsonText.toString()));
            analyze(results);
            //focus(results);
            focusSkip(results);
        }
    });
}
main()
    .then(() => console.log('done'))
    .catch(error => console.error(error));
//# sourceMappingURL=focus.js.map