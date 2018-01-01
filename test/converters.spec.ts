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
import { SVGConverter, Init } from '../converters';

describe("Conveter tests", () => {
    it('Wait to init', () => Init);
    it('parse and convert gerber file', () => {
        let folder = "test/Gerber_File_Format_Examples";
        fs.readdirSync(folder)
            .filter(fileName => fileName.endsWith(".gbr"))
            .filter(filename => !filename.startsWith("test-image-offset-2")
                                && !filename.startsWith("test-layer-mode-1"))
            //.filter(fileName => fileName.startsWith("2-13-1_Two"))
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
    it('Bugs files to SVG', () => {
        let folder = "test/Gerber_File_Format_Examples/bugs";
        fs.readdirSync(folder)
            .filter(fileName => !fileName.match(/\.svg$/))
            .forEach(fileName => {
                let fullFileName = folder + "/" + fileName;
                let content = fs.readFileSync(fullFileName).toString();
                //console.log(`Convert ${fileName}`);
                let result = cv.SVGConverter.GerberToSvg(
                    content, 0x101010, 1000, 0);
                let outputFileName = folder + "/" + fileName + ".svg";
                let stream = fs.createWriteStream(outputFileName);
                stream.write(result);
                stream.end();
                //cv.GerberToPolygons(content);
            });
    }).timeout(10000);
    it('eagle files to SVG', () => {
        let folder = "test/Gerber_File_Format_Examples/eagle";
        fs.readdirSync(folder)
            .filter(fileName => fileName.match(/\.G[TB]L$/))
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
    }).timeout(10000);
    it('eagle files to objects', () => {
        let folder = "test/Gerber_File_Format_Examples/eagle";
        fs.readdirSync(folder)
            .filter(fileName => fileName.match(/\.G[TBM]L$/))
            .forEach(fileName => {
                let fullFileName = folder + "/" + fileName;
                let content = fs.readFileSync(fullFileName).toString();
                //console.log(`Convert ${fileName}`);
                let result = cv.GerberToPolygons(content);
                //console.log(`Solids ${result.solids.length} wires ${result.thins.length}`);
            });
    }).timeout(10000);
    it('eagle files to primitives', () => {
        let folder = "test/Gerber_File_Format_Examples/eagle";
        fs.readdirSync(folder)
            .filter(fileName => fileName.match(/\.G[TBM][LOPS]$/))
            .forEach(fileName => {
                let fullFileName = folder + "/" + fileName;
                let content = fs.readFileSync(fullFileName).toString();
                //console.log(`Convert ${fileName}`);
                let result = cv.PrimitiveConverter.GerberToPrimitives(content);
            });
    });
    it('rambo files to objects', () => {
        let folder = "test/Gerber_File_Format_Examples/rambo";
        fs.readdirSync(folder)
            .filter(fileName => fileName.match(/\.GTL$/))
            .forEach(fileName => {
                let fullFileName = folder + "/" + fileName;
                let content = fs.readFileSync(fullFileName).toString();
                //console.log(`Convert ${fileName}`);
                let result = cv.GerberToPolygons(content);
                //console.log(`Solids ${result.solids.length} wires ${result.thins.length}`);
            });
    }).timeout(60000);
});
