/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2018
 * 
 * License: MIT License, see LICENSE.txt
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as xp from '../excellonparser';
import { CoordinateSkipZeros } from '../primitives';
import { ToolDefinitionCommand } from '../excelloncommands';

describe("ExcellonParser tests", () => {
    it('Command tokenizer', () => {
        let commands:string[] = [];
        let cmdParser = new xp.CommandParser();
        cmdParser.setConsumer((cmd) => commands.push(cmd));
        cmdParser.parseBlock("G01");
        assert.equal(commands.length, 0);
        cmdParser.parseBlock("\n\r");
        assert.equal(commands.length, 1);
        cmdParser.parseBlock("X1234Y5678D02");
        assert.equal(commands.length, 1);
        cmdParser.flush();
        assert.equal(commands.length, 2);
        assert.equal(commands[0], "G01");
        assert.equal(commands[1], "X1234Y5678D02");
    });
    it('Mods parser', () => {
        let fmt = new xp.CoordinateFormatSpec(2, 4, CoordinateSkipZeros.LEADING);
        let cmd = new ToolDefinitionCommand("T1C.1355H", fmt, 1);
        assert.equal(cmd.formatOutput(fmt), "T1C.1355H");
    });
    it('parse and reconstruct excellon files', () => {
        let folder = "test/excellon";
        fs.readdirSync(folder)
            .filter(fileName => fileName.endsWith(".exc"))
            .forEach(fileName => {
                let fullFileName = folder + "/" + fileName;
                let content = fs.readFileSync(fullFileName).toString();
                let parser = new xp.ExcellonParser();
                //console.log(`Parsing ${fullFileName}`);
                parser.parseBlock(content);
            });
    });
});
