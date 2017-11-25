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

describe("Conveter tests", () => {
    it('parse and convert gerber file', () => {
        let folder = "test/Gerber_File_Format_Examples";
        fs.readdirSync(folder)
            .filter(fileName => fileName.endsWith(".gbr"))
            .filter(filename => !filename.startsWith("4-11-6_Block_with_different_orientations")
                                && !filename.startsWith("test-image-offset-2")
                                && !filename.startsWith("test-layer-mode-1"))
            //.filter(fileName => fileName.endsWith("test-polygon-fill-1.gbr"))
            .forEach(fileName => {
                let fullFileName = folder + "/" + fileName;
                let content = fs.readFileSync(fullFileName).toString();
                let parser = new gp.GerberParser();
                parser.parseBlock(content);
                let ctx = new pr.GerberState();
                console.log(`Convert ${fileName}`);
                parser.execute(ctx);
                let primitives = (ctx.graphicsOperations as pr.BaseGraphicsOperationsConsumer).primitives;
                let cvt = new cv.SVGConverter();
                let result = cvt.convert(primitives);
                let outputFileName = folder + "/" + fileName.replace(".gbr", ".svg");
                let stream = fs.createWriteStream(outputFileName);
                result.forEach(l => {
                    if (l.length > 0) {
                        stream.write(l);
                        stream.write("\n");
                    }
                });
                stream.end();
                console.log(`Conversion result for ${fileName}`);
            });
    });
});
