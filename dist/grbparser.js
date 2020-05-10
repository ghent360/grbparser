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
const cmds = require("./gerbercommands");
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
        this.commandLineStart = 0;
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
            if (match && match[2]) {
                let gCodeCmd = match[1];
                // Except G04 comment which ends in Dxx
                if (!CommandParser.g04Match.test(gCodeCmd)) {
                    let dCmd = match[2];
                    this.consumer(gCodeCmd, this.commandLineStart, false);
                    this.consumer(CommandParser.orderDOperation(dCmd), this.commandLineStart, false);
                    return;
                }
            }
            do {
                match = CommandParser.gdmnCodeSplit.exec(cmd);
                if (!match) {
                    break;
                }
                let firstCmd = match[1];
                if (!CommandParser.g04Match.test(firstCmd)) {
                    cmd = match[2];
                    this.consumer(firstCmd, this.commandLineStart, false);
                }
            } while (cmd && cmd.length > 0);
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
        this.consumer(CommandParser.orderDOperation(cmd), this.commandLineStart, isAdvanced);
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
    static orderDOperation(cmd) {
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
exports.CommandParser = CommandParser;
CommandParser.gCodeSplit = /^(G\d+)((?:[XYIJ][\+\-]?\d+)*(?:D\d+)?)$/;
CommandParser.gdmnCodeSplit = /^([GDMN]\d+)((?:[GDMN]\d+)+)$/;
CommandParser.g04Match = /^G0*4$/;
CommandParser.dCmdMatch = /^([XYIJ][\+\-]?\d+)?([XYIJ][\+\-]?\d+)?([XYIJ][\+\-]?\d+)?([XYIJ][\+\-]?\d+)?(D\d+)$/;
CommandParser.coordinatesOrder = "XYIJ";
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
        this.lastDcmd = -1;
        // Order in this array is important, because some regex are more broad
        // and would detect previous commands.
        this.commandDispatcher = [
            [/^FS/, (cmd, lineNo) => new cmds.FSCommand(cmd, lineNo)],
            [/^MO/, (cmd, lineNo) => new cmds.MOCommand(cmd, lineNo)],
            [/^ADD/, (cmd, lineNo) => new cmds.ADCommand(cmd, lineNo)],
            [/^AM/, (cmd, lineNo) => new cmds.AMCommand(cmd, lineNo)],
            [/^AB/, (cmd, lineNo) => new cmds.ABCommand(cmd, lineNo)],
            [/^G[0]*4[^\d]/, (cmd, lineNo) => new cmds.G04Command(cmd, lineNo)],
            [/^G[0]*4$/, (cmd, lineNo) => new cmds.G04Command(cmd, lineNo)],
            [/D[0]*1$/, (cmd, lineNo) => {
                    this.lastDcmd = 1;
                    if (!this.fmt) {
                        console.log("Format is not defined");
                        return undefined;
                    }
                    return new cmds.D01Command(cmd, this.fmt, lineNo);
                }],
            [/^(?:[XYIJ][\+\-]?\d+){1,4}$/, (cmd, lineNo) => {
                    if (!this.fmt) {
                        console.log("Format is not defined");
                        return undefined;
                    }
                    if (this.lastDcmd == 1) {
                        return new cmds.D01Command(cmd, this.fmt, lineNo);
                    }
                    else if (this.lastDcmd == 2) {
                        return new cmds.D02Command(cmd, this.fmt, lineNo);
                    }
                    else if (this.lastDcmd == 3) {
                        return new cmds.D03Command(cmd, this.fmt, lineNo);
                    }
                    return undefined;
                }],
            [/D[0]*2$/, (cmd, lineNo) => {
                    if (!this.fmt) {
                        console.log("Format is not defined");
                        return undefined;
                    }
                    this.lastDcmd = 2;
                    return new cmds.D02Command(cmd, this.fmt, lineNo);
                }],
            [/D[0]*3$/, (cmd, lineNo) => {
                    if (!this.fmt) {
                        console.log("Format is not defined");
                        return undefined;
                    }
                    this.lastDcmd = 3;
                    return new cmds.D03Command(cmd, this.fmt, lineNo);
                }],
            [/^D(\d+)$/, (cmd, lineNo) => new cmds.DCommand(cmd, lineNo)],
            [/^G[0]*1$/, (cmd, lineNo) => new cmds.G01Command(cmd, lineNo)],
            [/^G[0]*2$/, (cmd, lineNo) => new cmds.G02Command(cmd, lineNo)],
            [/^G[0]*3$/, (cmd, lineNo) => new cmds.G03Command(cmd, lineNo)],
            [/^G[0]*10$/, (cmd, lineNo) => new cmds.G10Command(cmd, lineNo)],
            [/^G[0]*11$/, (cmd, lineNo) => new cmds.G11Command(cmd, lineNo)],
            [/^G[0]*12$/, (cmd, lineNo) => new cmds.G12Command(cmd, lineNo)],
            [/^G[0]*36$/, (cmd, lineNo) => new cmds.G36Command(cmd, lineNo)],
            [/^G[0]*37$/, (cmd, lineNo) => new cmds.G37Command(cmd, lineNo)],
            [/^G[0]*70$/, (cmd, lineNo) => new cmds.G70Command(cmd, lineNo)],
            [/^G[0]*71$/, (cmd, lineNo) => new cmds.G71Command(cmd, lineNo)],
            [/^G[0]*74$/, (cmd, lineNo) => new cmds.G74Command(cmd, lineNo)],
            [/^G[0]*75$/, (cmd, lineNo) => new cmds.G75Command(cmd, lineNo)],
            [/^G[0]*90$/, (cmd, lineNo) => new cmds.G90Command(cmd, lineNo)],
            [/^G[0]*91$/, (cmd, lineNo) => new cmds.G91Command(cmd, lineNo)],
            [/^LP/, (cmd, lineNo) => new cmds.LPCommand(cmd, lineNo)],
            [/^LM/, (cmd, lineNo) => new cmds.LMCommand(cmd, lineNo)],
            [/^LR/, (cmd, lineNo) => new cmds.LRCommand(cmd, lineNo)],
            [/^LS/, (cmd, lineNo) => new cmds.LSCommand(cmd, lineNo)],
            [/^SR/, (cmd, lineNo) => new cmds.SRCommand(cmd, lineNo)],
            [/^M0*[02]/, (cmd, lineNo) => new cmds.M02Command(cmd, lineNo)],
            [/^M0*1/, undefined],
            [/^T(A|F|O)/, (cmd, lineNo) => new cmds.TCommand(cmd, lineNo)],
            [/^TD/, (cmd, lineNo) => new cmds.TDCommand(cmd, lineNo)],
            [/^IP(?:POS|NEG)\*$/, undefined],
            [/^LN(?:.+)/, undefined],
            [/^IN.*\*$/, undefined],
            [/^ICAS\*$/, undefined],
            [/^IJ(?:.+)/, undefined],
            [/^IO(?:.+)/, undefined],
            [/^IR(?:.+)/, undefined],
            [/^AS(?:.+)/, undefined],
            [/^KO(?:.+)/, undefined],
            [/^MI(?:.+)/, undefined],
            [/^OF(?:.+)/, undefined],
            [/^RO(?:.+)/, undefined],
            [/^SF(?:.+)/, undefined],
            [/^G[0]*0$/, undefined],
            [/^G[0]*54$/, undefined],
            [/^G[0]*55$/, undefined] // Prepare to flash
        ];
        this.commands = [];
        this.commandParser.setConsumer((cmd, lineNo) => this.parseCommand(cmd, lineNo));
    }
    parseBlock(block) {
        this.commandParser.parseBlock(block);
    }
    parseCommand(cmd, lineNo) {
        if (cmd.length == 0) {
            return;
        }
        try {
            let dispatcher = this.commandDispatcher.find(d => d[0].test(cmd));
            if (dispatcher == undefined) {
                throw new primitives_1.GerberParseException(`Invalid command ${cmd.substr(0, 100)}`);
            }
            if (dispatcher[1] == undefined) {
                //console.log(`WARNING: ignoring ${cmd}`);
                return;
            }
            let command = dispatcher[1](cmd, lineNo);
            if (command) {
                this.commands.push(new ParserCommand(command, lineNo));
                if (command.name === "FS") {
                    let fsCmd = command;
                    if (this.fmt != undefined) {
                        //throw new GerberParseException("Format is already defined");
                        console.log("Format is already defined");
                    }
                    this.fmt = fsCmd.coordinateFormat;
                }
            }
        }
        catch (e) {
            console.log(`Error parsing gerber file at line ${lineNo}.`);
            console.log(`Offending command: ${cmd.substr(0, 100)}`);
            console.log(`Message: ${e}`);
            throw e;
        }
    }
    output() {
        let result = "";
        if (!this.fmt) {
            console.log("Format is not defined");
            return "";
        }
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