"use strict";
/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 *
 * License: MIT License, see LICENSE.txt
 */
Object.defineProperty(exports, "__esModule", { value: true });
const primitives_1 = require("./primitives");
const cmds = require("./commands");
/**
 * This is an internal class to "tokenize" the gerber commands from the stream.
 *
 * It would remove all \n \r and \t from the stream and call a "consumer" for each
 * complete command found in the stream.
 *
 * The input can be partial buffer.
 */
class CommandParser {
    constructor() {
        this.lineNumber = 1;
        this.nextTokenSeparator = '*';
        this.consumer = CommandParser.emptyConsumer;
        this.command = "";
        this.errorHandler = CommandParser.consoleError;
    }
    parseBlock(buffer) {
        let idx;
        for (idx = 0; idx < buffer.length; idx++) {
            let nextChar = buffer[idx];
            if (nextChar == '\n') {
                this.lineNumber++;
                continue;
            }
            else if (nextChar == '\r') {
                continue;
            }
            else if (nextChar == '\t') {
                continue;
            }
            else if (nextChar == this.nextTokenSeparator) {
                //console.log(`cmd: ${this.command}`);
                this.commandPreprocessor();
                this.command = "";
                this.nextTokenSeparator = '*';
                continue;
            }
            else if (nextChar == '%') {
                if (this.command.trim().length != 0) {
                    console.log(`Error, what to do with '${this.command}?'`);
                }
                this.command = "";
                this.nextTokenSeparator = '%';
            }
            else {
                this.append(nextChar);
            }
        }
    }
    append(chr) {
        if (this.command.length == 0) {
            this.commandLineStart = this.lineNumber;
        }
        this.command += chr;
    }
    static consoleError(lineNumber, buffer, idx) {
        console.log(`Error at line ${lineNumber}`);
        console.log(`   ${buffer}`);
        console.log(`---${'-'.repeat(idx + 1)}^`);
    }
    static emptyConsumer(cmd, line) {
    }
    setConsumer(consumer) {
        let oldValue = this.consumer;
        this.consumer = consumer;
        return oldValue;
    }
    setErrorHandler(handler) {
        let old = this.errorHandler;
        this.errorHandler = handler;
        return old;
    }
    commandPreprocessor() {
        let isAdvanced = this.nextTokenSeparator == '%';
        let cmd = this.command;
        if (!isAdvanced) {
            // Look for Gxx.....Dxx command
            // we would split it to Gxx*; ....Dxx*
            let match = CommandParser.gCodeSplit.exec(cmd);
            if (match) {
                let gCodeCmd = match[1];
                // Except G04 comment which ends in Dxx
                if (!CommandParser.g04Match.test(gCodeCmd)) {
                    let dCmd = match[2];
                    this.consumer(gCodeCmd, this.commandLineStart, false);
                    this.consumer(CommandParser.orderDoperation(dCmd), this.commandLineStart, false);
                    return;
                }
            }
        }
        else {
            // Some advanced commands can be combined together as per
            // the old spec. See if we have to split them apart.
            if (!cmd.startsWith("AM") && cmd.indexOf("*") != cmd.lastIndexOf("*")) {
                let parts = cmd.split("*").slice(0, -1);
                for (let part of parts) {
                    this.consumer(part + "*", this.commandLineStart, true);
                }
                return;
            }
        }
        this.consumer(CommandParser.orderDoperation(cmd), this.commandLineStart, isAdvanced);
    }
    static coordinatePosition(coordinate) {
        if (coordinate == undefined) {
            return 99;
        }
        return CommandParser.coordinatesOrder.indexOf(coordinate[0]);
    }
    /**
     * Sometimes we receive D operation where the coordinates are out of order
     * for example Y123X567D03. We convert it to X567Y123D03.
     * @param cmd input command
     */
    static orderDoperation(cmd) {
        let match = CommandParser.dCmdMatch.exec(cmd);
        if (!match) {
            return cmd;
        }
        let coordinateParts = match.slice(1, 5).sort((a, b) => {
            return CommandParser.coordinatePosition(a)
                - CommandParser.coordinatePosition(b);
        });
        let dcode = match[5];
        let result = "";
        for (let c of coordinateParts) {
            if (c != undefined) {
                result += c;
            }
        }
        result += dcode;
        return result;
    }
}
CommandParser.gCodeSplit = /^(G\d+)(.*D\d+)$/;
CommandParser.g04Match = /^G0*4$/;
CommandParser.dCmdMatch = /^([XYIJ][\+\-]?\d+)?([XYIJ][\+\-]?\d+)?([XYIJ][\+\-]?\d+)?([XYIJ][\+\-]?\d+)?(D\d+)$/;
CommandParser.coordinatesOrder = "XYIJ";
exports.CommandParser = CommandParser;
class ParserCommand {
    constructor(cmd, lineNo) {
        this.cmd = cmd;
        this.lineNo = lineNo;
    }
}
/**
 * The main gerber parser class.
 *
 * Usage TBD.
 */
class GerberParser {
    constructor() {
        this.commandParser = new CommandParser();
        // Order in this array is important, because some regex are more broad
        // and would detect previous commands.
        this.commandDispatcher = [
            [/^FS/, (cmd) => new cmds.FSCommand(cmd)],
            [/^MO/, (cmd) => new cmds.MOCommand(cmd)],
            [/^ADD/, (cmd) => new cmds.ADCommand(cmd)],
            [/^AM/, (cmd) => new cmds.AMCommand(cmd)],
            [/^AB/, (cmd) => new cmds.ABCommand(cmd)],
            [/^G[0]*4[^\d]/, (cmd) => new cmds.G04Command(cmd)],
            [/D[0]*1$/, (cmd) => new cmds.D01Command(cmd, this.fmt)],
            [/D[0]*2$/, (cmd) => new cmds.D02Command(cmd, this.fmt)],
            [/D[0]*3$/, (cmd) => new cmds.D03Command(cmd, this.fmt)],
            [/^D(\d+)$/, (cmd) => new cmds.DCommand(cmd)],
            [/^G[0]*1$/, (cmd) => new cmds.G01Command(cmd)],
            [/^G[0]*2$/, (cmd) => new cmds.G02Command(cmd)],
            [/^G[0]*3$/, (cmd) => new cmds.G03Command(cmd)],
            [/^G[0]*36$/, (cmd) => new cmds.G36Command(cmd)],
            [/^G[0]*37$/, (cmd) => new cmds.G37Command(cmd)],
            [/^G[0]*74$/, (cmd) => new cmds.G74Command(cmd)],
            [/^G[0]*75$/, (cmd) => new cmds.G75Command(cmd)],
            [/^LP/, (cmd) => new cmds.LPCommand(cmd)],
            [/^LM/, (cmd) => new cmds.LMCommand(cmd)],
            [/^LR/, (cmd) => new cmds.LRCommand(cmd)],
            [/^LS/, (cmd) => new cmds.LSCommand(cmd)],
            [/^SR/, (cmd) => new cmds.SRCommand(cmd)],
            [/^M02/, (cmd) => new cmds.M02Command(cmd)],
            [/^T(A|F|O)/, (cmd) => new cmds.TCommand(cmd)],
            [/^TD/, (cmd) => new cmds.TDCommand(cmd)],
            [/^IP(?:POS|NEG)\*$/, null],
            [/^LN(?:.+)/, null],
            [/^IJ(?:.+)/, null],
            [/^IO(?:.+)/, null],
            [/^IR(?:.+)/, null],
            [/^AS(?:.+)/, null],
            [/^KO(?:.+)/, null],
            [/^MI(?:.+)/, null],
            [/^OF(?:.+)/, null],
            [/^RO(?:.+)/, null],
            [/^SF(?:.+)/, null],
            [/^G54$/, null],
            [/^G70$/, null],
            [/^G71$/, null],
            [/^G90$/, null],
            [/^G91$/, null]
        ];
        this.commands = [];
        this.commandParser.setConsumer((cmd, lineNo) => this.parseCommand(cmd, lineNo));
    }
    parseBlock(block) {
        this.commandParser.parseBlock(block);
    }
    parseCommand(cmd, lineNo) {
        try {
            let dispatcher = this.commandDispatcher.find(d => d[0].test(cmd));
            if (dispatcher == undefined) {
                throw new primitives_1.GerberParseException(`Invalid command ${cmd}`);
            }
            if (dispatcher[1] == null) {
                //console.log(`WARNING: ignoring ${cmd}`);
                return;
            }
            let command = dispatcher[1](cmd);
            this.commands.push(new ParserCommand(command, lineNo));
            if (command.name === "FS") {
                let fsCmd = command;
                if (this.fmt != undefined) {
                    throw new primitives_1.GerberParseException("Format is already defined");
                }
                this.fmt = fsCmd.coordinateFormat;
            }
        }
        catch (e) {
            console.log(`Error parsing gerber file at line ${lineNo}.`);
            console.log(`Offending command: ${cmd}`);
            console.log(`Message: ${e}`);
            throw e;
        }
    }
    output() {
        let result = "";
        for (let parseCommand of this.commands) {
            let cmd = parseCommand.cmd;
            let cmdString = cmd.formatOutput(this.fmt);
            if (cmd.isAdvanced) {
                result += "%" + cmdString + "%";
            }
            else {
                result += cmdString + "*";
            }
            result += "\n";
        }
        return result;
    }
    execute(ctx) {
        for (let parseCommand of this.commands) {
            parseCommand.cmd.execute(ctx);
        }
    }
}
exports.GerberParser = GerberParser;
//# sourceMappingURL=grbparser.js.map