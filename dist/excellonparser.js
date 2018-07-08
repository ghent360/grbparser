"use strict";
/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2018
 *
 * License: MIT License, see LICENSE.txt
 */
Object.defineProperty(exports, "__esModule", { value: true });
const primitives_1 = require("./primitives");
const cmds = require("./excelloncommands");
const point_1 = require("./point");
class ExcellonParseException {
    constructor(message, line) {
        this.message = message;
        this.line = line;
    }
    toString() {
        if (this.line != undefined) {
            return `Error parsing excellon file at line ${this.line}: ${this.message}`;
        }
        return `Error parsing excellon file: ${this.message}`;
    }
}
exports.ExcellonParseException = ExcellonParseException;
/**
 * This is an internal class to "tokenize" the excellon commands from the stream.
 *
 * It would remove all \n \r and \t from the stream and call a "consumer" for each
 * complete command found in the stream.
 *
 * The input can be partial buffer.
 */
class CommandParser {
    constructor() {
        this.lineNumber = 1;
        this.consumer = CommandParser.emptyConsumer;
        this.command = "";
        this.errorHandler = CommandParser.consoleError;
    }
    parseBlock(buffer) {
        let idx;
        for (idx = 0; idx < buffer.length; idx++) {
            let nextChar = buffer[idx];
            if (nextChar == '\n') {
                this.commandPreprocessor();
                this.command = "";
                this.lineNumber++;
                continue;
            }
            else if (nextChar == '\r') {
                continue;
            }
            else if (nextChar == '\t') {
                nextChar = ' ';
            }
            else {
                this.append(nextChar);
            }
        }
    }
    flush() {
        if (this.command.length > 0) {
            this.commandPreprocessor();
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
        let cmd = this.command;
        this.consumer(cmd, this.commandLineStart);
    }
}
exports.CommandParser = CommandParser;
class CoordinateFormatSpec {
    constructor(numIntPos, numDecimalPos, zeroSkip) {
        this.numIntPos = numIntPos;
        this.numDecimalPos = numDecimalPos;
        this.zeroSkip = zeroSkip;
    }
}
exports.CoordinateFormatSpec = CoordinateFormatSpec;
class ParserCommand {
    constructor(cmd, lineNo) {
        this.cmd = cmd;
        this.lineNo = lineNo;
    }
}
var Units;
(function (Units) {
    Units[Units["MILIMETERS"] = 0] = "MILIMETERS";
    Units[Units["INCHES"] = 1] = "INCHES";
})(Units = exports.Units || (exports.Units = {}));
var CoordinateMode;
(function (CoordinateMode) {
    CoordinateMode[CoordinateMode["ABSOLUTE"] = 0] = "ABSOLUTE";
    CoordinateMode[CoordinateMode["RELATIVE"] = 1] = "RELATIVE";
})(CoordinateMode = exports.CoordinateMode || (exports.CoordinateMode = {}));
function holeBounds(hole) {
    return new primitives_1.Bounds(new point_1.Point(hole.x - hole.drillSize, hole.y - hole.drillSize), new point_1.Point(hole.x + hole.drillSize, hole.y + hole.drillSize));
}
class ExcellonState {
    constructor() {
        this.tools = new Map();
        this.units = Units.INCHES;
        this.coordinateMode = CoordinateMode.ABSOLUTE;
        this.header = true;
        this.fmt = new CoordinateFormatSpec(2, 4, primitives_1.CoordinateZeroFormat.TRAILING);
        this.fmtSet = false;
        this.isDrilling = false;
        this.xPos = 0;
        this.yPos = 0;
        this.holes = [];
    }
    toMM(v) {
        if (this.units == Units.MILIMETERS) {
            return v;
        }
        return v * 25.4;
    }
    toInch(v) {
        if (this.units == Units.INCHES) {
            return v;
        }
        return v / 25.4;
    }
    fromMM(v) {
        if (this.units == Units.MILIMETERS) {
            return v;
        }
        return v / 25.4;
    }
    fromInch(v) {
        if (this.units == Units.INCHES) {
            return v;
        }
        return v * 25.4;
    }
    drillCommand(x, y, drill) {
        //console.log(`Drill ${x},${y}: ${drill}`);
        this.holes.push({ x: x, y: y, drillSize: drill });
    }
}
exports.ExcellonState = ExcellonState;
/**
 * The main excellon parser class.
 *
 * Usage TBD.
 */
class ExcellonParser {
    constructor() {
        this.commandParser = new CommandParser();
        // Order in this array is important, because some regex are more broad
        // and would detect previous commands.
        this.commandDispatcher = [
            { exp: /^;.*/, cb: (cmd, lineNo) => new cmds.CommentCommand(cmd, lineNo) },
            { exp: /^R,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo) },
            { exp: /^VER,.*/, cb: (cmd, lineNo) => new cmds.AxisVersionCommand(cmd, lineNo) },
            { exp: /^FMAT,.*/, cb: (cmd, lineNo) => new cmds.FileFormatCommand(cmd, lineNo) },
            { exp: /^INCH.*/, cb: (cmd, lineNo) => new cmds.UnitsCommand(cmd, lineNo) },
            { exp: /^METRIC.*/, cb: (cmd, lineNo) => new cmds.UnitsCommand(cmd, lineNo) },
            { exp: /^DETECT,.*/, cb: null },
            { exp: /^BLKD,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo) },
            { exp: /^SBK,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo) },
            { exp: /^SG,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo) },
            { exp: /^TCST,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo) },
            { exp: /^ICI,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo) },
            { exp: /^OSTOP,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo) },
            { exp: /^RSB,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo) },
            { exp: /^ATC,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo) },
            { exp: /^FSB,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo) },
            {
                exp: /^T(\d+(?:,\d+)?)((?:[CFSHBZ](?:[+\-])?(?:\d*)(?:\.\d*)?)+)$/,
                cb: (cmd, lineNo) => new cmds.ToolDefinitionCommand(cmd, this.ctx.fmt, lineNo)
            },
            { exp: /^%$/, cb: (cmd, lineNo) => new cmds.EndOfHeaderCommand(cmd, lineNo) },
            { exp: /^M0*47,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo) },
            { exp: /^M0*97,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo) },
            { exp: /^M0*98,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo) },
            { exp: /^M0*71.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo) },
            { exp: /^M0*72.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo) },
            { exp: /^G0*93.*/, cb: (cmd, lineNo) => new cmds.GCodeWithMods(cmd, this.ctx.fmt, 'XY', lineNo) },
            { exp: /^G0*45.*/, cb: (cmd, lineNo) => new cmds.GCodeWithMods(cmd, this.ctx.fmt, 'XY', lineNo) },
            { exp: /^G0*82.*/, cb: (cmd, lineNo) => new cmds.GCodeWithMods(cmd, this.ctx.fmt, 'XY', lineNo) },
            { exp: /^M0*2.*/, cb: (cmd, lineNo) => new cmds.MCodeWithMods(cmd, this.ctx.fmt, 'XYM', lineNo) },
            { exp: /^R\d+.*/, cb: (cmd, lineNo) => new cmds.RepeatCommand(cmd, this.ctx.fmt, 'XYM', lineNo) },
            { exp: /^P\d+.*/, cb: (cmd, lineNo) => new cmds.PatternRepeatCommand(cmd, this.ctx.fmt, 'XY', lineNo) },
            { exp: /^T(?:\d+)$/, cb: (cmd, lineNo) => new cmds.ToolChangeCommand(cmd, lineNo) },
            { exp: /^G(?:\d+)$/, cb: (cmd, lineNo) => new cmds.GCodeCommand(cmd, lineNo) },
            { exp: /^M(?:\d+)$/, cb: (cmd, lineNo) => new cmds.MCodeCommand(cmd, lineNo) },
            {
                exp: /^[XY](?:\d*(?:\.\d*)?)/,
                cb: (cmd, lineNo) => new cmds.CoordinatesCommand(cmd, this.ctx.fmt, 'XYZG', lineNo)
            },
        ];
        this.commands = [];
        this.ctx = new ExcellonState();
        this.commandParser.setConsumer((cmd, lineNo) => this.parseCommand(cmd, lineNo));
    }
    parseBlock(block) {
        this.commandParser.parseBlock(block);
    }
    flush() {
        this.commandParser.flush();
        this.calcBounds();
    }
    result() {
        return { holes: this.ctx.holes, bounds: this.ctx.bounds };
    }
    calcBounds() {
        if (this.ctx.holes.length < 1) {
            return;
        }
        let bounds = holeBounds(this.ctx.holes[0]);
        this.ctx.holes.forEach(hole => bounds.merge(holeBounds(hole)));
        this.ctx.bounds = bounds.toSimpleBounds();
    }
    parseCommand(cmd, lineNo) {
        if (cmd.length == 0) {
            return;
        }
        try {
            let dispatcher = this.commandDispatcher.find(d => d.exp.test(cmd));
            if (dispatcher == undefined) {
                throw new ExcellonParseException(`Invalid command ${cmd.substr(0, 100)}`);
            }
            if (dispatcher.cb == null) {
                //console.log(`WARNING: ignoring ${cmd}`);
                return;
            }
            let command = dispatcher.cb(cmd, lineNo);
            this.commands.push(new ParserCommand(command, lineNo));
            //console.log(`Cmd: '${cmd}', '${command.formatOutput(this.fmt)}'`);
            command.execute(this.ctx);
        }
        catch (e) {
            console.log(`Error parsing excellon file at line ${lineNo}.`);
            console.log(`Offending command: ${cmd.substr(0, 100)}`);
            console.log(`Message: ${e}`);
            throw e;
        }
    }
    output() {
        let result = "";
        for (let parseCommand of this.commands) {
            let cmd = parseCommand.cmd;
            let cmdString = cmd.formatOutput(this.ctx.fmt);
            result += cmdString;
            result += "\n";
        }
        return result;
    }
}
exports.ExcellonParser = ExcellonParser;
//# sourceMappingURL=excellonparser.js.map