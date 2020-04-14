/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2020
 * 
 * License: MIT License, see LICENSE.txt
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as kp from '../kicadcentroidparser';

describe("KiCAD centroid Parser tests", () => {
    it('parse and reconstruct kicad files', () => {
        let folder = "test/kicad";
        fs.readdirSync(folder)
            .filter(fileName => fileName.endsWith("-pos.csv"))
            .forEach(fileName => {
                let fullFileName = folder + "/" + fileName;
                let content = fs.readFileSync(fullFileName).toString();
                let parser = new kp.KicadCentroidParser();
                //console.log(`Parsing ${fullFileName}`);
                parser.parseBlock(content);
                parser.flush();
                parser.result();
            });
    });
});
