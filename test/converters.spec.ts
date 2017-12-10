/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as gp from '../grbparser';
import * as pr from '../primitives';
import * as cv from '../converters';
import { SVGConverter } from '../converters';

describe("Conveter tests", () => {
    it('Wait to init', (done) => SVGConverter.WaitInit(() => done()));
    it('parse and convert gerber file', () => {
        let folder = "test/Gerber_File_Format_Examples";
        fs.readdirSync(folder)
            .filter(fileName => fileName.endsWith(".gbr"))
            .filter(filename => !filename.startsWith("test-image-offset-2")
                                && !filename.startsWith("test-layer-mode-1"))
            //.filter(fileName => fileName.endsWith("sample_macro.gbr"))
            .forEach(fileName => {
                let fullFileName = folder + "/" + fileName;
                let content = fs.readFileSync(fullFileName).toString();
                //console.log(`Convert ${fileName}`);
                let result = cv.SVGConverter.GerberToSvg(content);
                let outputFileName = folder + "/" + fileName.replace(".gbr", ".svg");
                let stream = fs.createWriteStream(outputFileName);
                stream.write(result);
                stream.end();
                //console.log(`Conversion result for ${fileName}`);
            });
    });
    it('parse and convert eagle files', () => {
        let folder = "test/Gerber_File_Format_Examples/eagle";
        fs.readdirSync(folder)
            .filter(fileName => fileName.match(/\.GT[LOPS]$/))
            .forEach(fileName => {
                let fullFileName = folder + "/" + fileName;
                let content = fs.readFileSync(fullFileName).toString();
                //console.log(`Convert ${fileName}`);
                let result = cv.SVGConverter.GerberToSvg(content);
                let outputFileName = folder + "/" + fileName + ".svg";
                let stream = fs.createWriteStream(outputFileName);
                stream.write(result);
                stream.end();
            });
    });
});
