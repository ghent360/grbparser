import * as cvt from "./converters";
import * as fs from "fs-extra-promise";
import * as JSZip from "jszip";
import * as ut from "./gerberutils";

function percent(n:number):string {
    return (n * 100).toFixed(2) + "%";
}

function analyze(result:Array<any>) {
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

function focus(result:Array<any>) {
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
        topErrors.push({count:count, message:key});
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

async function main () {
    if (fs.existsSync('test-results.json')) {
        let results = await fs.readFileAsync('test-results.json')
            .then(jsonText => JSON.parse(jsonText.toString()));
        analyze(results);
        focus(results);
    }
}

main()
    .then(() => console.log('done'))
    .catch(error => console.error(error));
