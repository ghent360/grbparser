"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const primitives_1 = require("./primitives");
const excellonparser_1 = require("./excellonparser");
const utils_1 = require("./utils");
/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2018
 *
 * License: MIT License, see LICENSE.txt
 */
/**
* This file contains classes that implement functionality for
* the individual excellon commands.
*
* Each command class would parse the command from the input text and construct one or more
* primitives which hold the command data in consumable form.
*
* Each command class would be able to construct a well formatted text representation of
* the command suitable for output in a gerber file.
*
* Note that in the input text the command separators are stipped by the command tokenizer.
*/
/*
;FORMAT={-:-/ absolute / inch / decimal}
;FORMAT={2:4/ absolute / inch / suppress leading zeros}
;FORMAT={2:4/ absolute / inch / suppress trailing zeros}
;FORMAT={2:4/ absolute / inch / keep zeros}
;FORMAT={-:-/ absolute / metric / decimal}
;FORMAT={3:3/ absolute / metric / suppress leading zeros}

 */
class CommentCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.name = "Comment";
        if (cmd[0] != ';') {
            throw new excellonparser_1.ExcellonParseException(`Invalid comment command ${cmd}`);
        }
        this.comment = cmd.substr(1);
    }
    formatOutput() {
        return ';' + this.comment;
    }
    execute(ctx) {
        if (this.comment.startsWith("FORMAT={")) {
            let format = this.comment
                .substring(8, this.comment.length - 1)
                .split('/')
                .map(s => s.trim());
            this.parseFormat(format, ctx);
        }
        else if (this.comment.startsWith("FILE_FORMAT=")) {
            let format = this.comment
                .substring(12)
                .trim();
            this.parseFormat2(format, ctx);
        }
    }
    parseFormat(format, ctx) {
        let numberFormat = format[0].split(':');
        let numIntPos = numberFormat[0] != '-' ? Number.parseInt(numberFormat[0]) : -1;
        let numDecPos = numberFormat[1] != '-' ? Number.parseInt(numberFormat[1]) : -1;
        let position = format[1] == 'absolute' ? excellonparser_1.CoordinateMode.ABSOLUTE : excellonparser_1.CoordinateMode.RELATIVE;
        let units = format[2] == 'inch' ? excellonparser_1.Units.INCHES : excellonparser_1.Units.MILIMETERS;
        let zeroFormat = primitives_1.CoordinateZeroFormat.NONE;
        switch (format[3]) {
            case 'decimal':
                zeroFormat = primitives_1.CoordinateZeroFormat.DIRECT;
                break;
            case 'suppress leading zeros':
                zeroFormat = primitives_1.CoordinateZeroFormat.TRAILING;
                break;
            case 'suppress trailing zeros':
            case 'keep zeroes':
                zeroFormat = primitives_1.CoordinateZeroFormat.LEADING;
                break;
        }
        if (numIntPos < 0) {
            numIntPos = units == excellonparser_1.Units.INCHES ? 2 : 3;
        }
        if (numDecPos < 0) {
            numDecPos = units == excellonparser_1.Units.INCHES ? 4 : 3;
        }
        ctx.fmt = new excellonparser_1.CoordinateFormatSpec(numIntPos, numDecPos, zeroFormat);
        ctx.fmtSet = true;
        ctx.units = units;
        ctx.coordinateMode = position;
    }
    parseFormat2(format, ctx) {
        let numberFormat = format.split(':');
        let numIntPos = numberFormat[0] != '-' ? Number.parseInt(numberFormat[0]) : -1;
        let numDecPos = numberFormat[1] != '-' ? Number.parseInt(numberFormat[1]) : -1;
        if (numIntPos >= 0 && numDecPos >= 0) {
            ctx.fmt = new excellonparser_1.CoordinateFormatSpec(numIntPos, numDecPos, primitives_1.CoordinateZeroFormat.LEADING);
            ctx.fmtSet = true;
        }
    }
}
exports.CommentCommand = CommentCommand;
CommentCommand.matchExp = /^;.*$/;
class GCodeCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        let match = GCodeCommand.matchExp.exec(cmd);
        if (!match) {
            throw new excellonparser_1.ExcellonParseException(`Invalid G command format ${cmd}`);
        }
        this.codeId = Number.parseInt(match[1]);
        this.name = 'G' + this.codeId;
    }
    formatOutput() {
        let result = "G";
        if (this.codeId < 10) {
            result += "0";
        }
        result += this.codeId;
        return result;
    }
    execute(ctx) {
        switch (this.codeId) {
            case 90:
                ctx.coordinateMode = excellonparser_1.CoordinateMode.ABSOLUTE;
                break;
            case 91:
                ctx.coordinateMode = excellonparser_1.CoordinateMode.RELATIVE;
                break;
            case 5:
                ctx.isDrilling = true;
                break;
            case 0:
                ctx.isDrilling = false;
                break;
        }
    }
}
exports.GCodeCommand = GCodeCommand;
GCodeCommand.matchExp = /^G(\d+)/;
class MCodeCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        let match = MCodeCommand.matchExp.exec(cmd);
        if (!match) {
            throw new excellonparser_1.ExcellonParseException(`Invalid M command format ${cmd}`);
        }
        this.codeId = Number.parseInt(match[1]);
        this.name = 'M' + this.codeId;
    }
    formatOutput() {
        let result = "M";
        if (this.codeId < 10) {
            result += "0";
        }
        result += this.codeId;
        return result;
    }
    execute(ctx) {
        switch (this.codeId) {
            case 95:
                ctx.header = false;
                break;
        }
    }
}
exports.MCodeCommand = MCodeCommand;
MCodeCommand.matchExp = /^M(\d+)/;
class CommaCommandBase {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        let parts = cmd.split(',');
        this.name = parts[0];
        parts.splice(0, 1);
        this.values = parts;
    }
    formatOutput() {
        let result = this.name;
        this.values.forEach(v => result = result + "," + v);
        return result;
    }
    execute(ctx) {
        switch (this.name) {
            case 'M71':
                ctx.units = excellonparser_1.Units.MILIMETERS;
                if (ctx.header && !ctx.fmtSet) {
                    ctx.fmt = new excellonparser_1.CoordinateFormatSpec(3, 3, primitives_1.CoordinateZeroFormat.LEADING);
                    ctx.fmtSet = true;
                }
                break;
            case 'M72':
                ctx.units = excellonparser_1.Units.INCHES;
                if (ctx.header && !ctx.fmtSet) {
                    ctx.fmt = new excellonparser_1.CoordinateFormatSpec(2, 4, primitives_1.CoordinateZeroFormat.LEADING);
                    ctx.fmtSet = true;
                }
                break;
        }
    }
}
exports.CommaCommandBase = CommaCommandBase;
class ResetCommand extends CommaCommandBase {
    constructor(cmd, lineNo) {
        super(cmd, lineNo);
        this.lineNo = lineNo;
        if (this.name != 'R') {
            throw new excellonparser_1.ExcellonParseException(`Invalid R command ${cmd}`);
        }
    }
    execute() { }
}
exports.ResetCommand = ResetCommand;
class AxisVersionCommand extends CommaCommandBase {
    constructor(cmd, lineNo) {
        super(cmd, lineNo);
        this.lineNo = lineNo;
        if (this.name != 'VER') {
            throw new excellonparser_1.ExcellonParseException(`Invalid VER command ${cmd}`);
        }
    }
    execute() { }
}
exports.AxisVersionCommand = AxisVersionCommand;
class FileFormatCommand extends CommaCommandBase {
    constructor(cmd, lineNo) {
        super(cmd, lineNo);
        this.lineNo = lineNo;
        if (this.name != 'FMAT') {
            throw new excellonparser_1.ExcellonParseException(`Invalid FMAT command ${cmd}`);
        }
    }
    execute() { }
}
exports.FileFormatCommand = FileFormatCommand;
class UnitsCommand extends CommaCommandBase {
    constructor(cmd, lineNo) {
        super(cmd, lineNo);
        this.lineNo = lineNo;
        if (this.name != 'INCH' && this.name != 'METRIC') {
            throw new excellonparser_1.ExcellonParseException(`Invalid units command ${cmd}`);
        }
    }
    execute(ctx) {
        let zeroFormat = primitives_1.CoordinateZeroFormat.NONE;
        let units = this.name == 'INCH' ? excellonparser_1.Units.INCHES : excellonparser_1.Units.MILIMETERS;
        if (this.values.length > 0) {
            switch (this.values[0]) {
                case 'LZ':
                    zeroFormat = primitives_1.CoordinateZeroFormat.TRAILING;
                    break;
                case 'TZ':
                    zeroFormat = primitives_1.CoordinateZeroFormat.LEADING;
                    break;
            }
            let numIntPos;
            let numDecPos;
            if (ctx.fmtSet) {
                numIntPos = ctx.fmt.numIntPos;
                numDecPos = ctx.fmt.numDecimalPos;
            }
            else {
                numIntPos = units == excellonparser_1.Units.INCHES ? 2 : 3;
                numDecPos = units == excellonparser_1.Units.INCHES ? 4 : 3;
            }
            ctx.fmt = new excellonparser_1.CoordinateFormatSpec(numIntPos, numDecPos, zeroFormat);
            ctx.fmtSet = true;
        }
        ctx.units = units;
    }
}
exports.UnitsCommand = UnitsCommand;
class ToolPost {
    constructor(start, end) {
        this.start = start;
        this.end = end;
    }
    isRange() {
        return this.end && this.end != this.start;
    }
    toString() {
        if (this.isRange()) {
            return this.start + "," + this.end;
        }
        return this.start.toString();
    }
}
exports.ToolPost = ToolPost;
const numChars = '+-.0123456789';
const emptyModsAllowed = 'HXY';
function parseMods(mods, fmt, allowedMods) {
    let result = [];
    while (mods.length > 0) {
        let code = mods[0];
        let idx;
        if (allowedMods && allowedMods.indexOf(code) < 0) {
            throw new excellonparser_1.ExcellonParseException(`Modifier ${code} not allowed: ${mods}`);
        }
        for (idx = 1; idx < mods.length; idx++) {
            if (numChars.indexOf(mods[idx]) < 0) {
                break;
            }
        }
        if (idx == 1) {
            if (emptyModsAllowed.indexOf(code) >= 0) {
                // Mod with no value, for example T1H
                result.push({ code: code });
                mods = mods.substr(1);
                continue;
            }
            throw new excellonparser_1.ExcellonParseException(`Invalid modifier ${mods}`);
        }
        let valueStr = mods.substr(1, idx - 1);
        let value;
        switch (code) {
            case 'X':
            case 'Y':
            case 'Z':
                value = utils_1.parseCoordinate(valueStr, fmt.numIntPos, fmt.numDecimalPos, fmt.zeroSkip);
                break;
            case 'S':
                value = utils_1.parseCoordinate(valueStr, 5, 0, primitives_1.CoordinateZeroFormat.LEADING);
                break;
            case 'B':
                value = utils_1.parseCoordinate(valueStr, 4, 0, primitives_1.CoordinateZeroFormat.LEADING);
                break;
            case 'C':
                value = utils_1.parseCoordinate(valueStr, 0, 3, primitives_1.CoordinateZeroFormat.LEADING);
                break;
            case 'H':
                value = utils_1.parseCoordinate(valueStr, 4, 0, primitives_1.CoordinateZeroFormat.TRAILING);
                break;
            default:
                value = utils_1.parseCoordinate(valueStr, 3, 0, primitives_1.CoordinateZeroFormat.LEADING);
                break;
        }
        result.push({ code: code, value: value });
        mods = mods.substr(idx);
    }
    return result;
}
function findModifier(code, mods) {
    let mod = mods.find(m => m.code == code);
    if (mod) {
        return mod.value;
    }
    return undefined;
}
function fomratModNumber(value, numIntPos, numDecPos, zeroSkip) {
    let intValue = Math.round(value * Math.pow(10, numDecPos));
    let roundValue = intValue * Math.pow(10, -numDecPos);
    if (Math.abs(value - roundValue) > primitives_1.Epsilon) {
        let sign = value < 0 ? '-' : '';
        if (value < 0) {
            value = -value;
        }
        let valueStr = value.toString();
        while (valueStr.startsWith('0')) {
            valueStr = valueStr.substr(1);
        }
        return sign + valueStr;
    }
    return utils_1.formatFixedNumber(value, numDecPos, numIntPos, zeroSkip);
}
function formatMod(mod, fmt) {
    if (mod.value == undefined) {
        return mod.code;
    }
    let value;
    switch (mod.code) {
        case 'X':
        case 'Y':
        case 'Z':
            value = fomratModNumber(mod.value, fmt.numIntPos, fmt.numDecimalPos, fmt.zeroSkip);
            break;
        case 'S':
            value = fomratModNumber(mod.value, 5, 0, primitives_1.CoordinateZeroFormat.LEADING);
            break;
        case 'B':
            value = fomratModNumber(mod.value, 4, 0, primitives_1.CoordinateZeroFormat.LEADING);
            break;
        case 'C':
            value = fomratModNumber(mod.value, 0, 3, primitives_1.CoordinateZeroFormat.LEADING);
            break;
        case 'H':
            value = fomratModNumber(mod.value, 4, 0, primitives_1.CoordinateZeroFormat.TRAILING);
            break;
        case 'G':
        case 'M':
            value = mod.value.toString();
            if (mod.value < 10) {
                value = '0' + value;
            }
            break;
        default:
            value = fomratModNumber(mod.value, 3, 0, primitives_1.CoordinateZeroFormat.LEADING);
            break;
    }
    return mod.code + value;
}
class ToolDefinitionCommand {
    constructor(cmd, fmt, lineNo) {
        this.lineNo = lineNo;
        this.name = 'T';
        let match = ToolDefinitionCommand.match.exec(cmd);
        if (!match) {
            throw new excellonparser_1.ExcellonParseException(`Invalid tool definition command ${cmd}`);
        }
        let tool = ToolDefinitionCommand.toolMatch.exec(match[1]);
        if (!tool) {
            throw new excellonparser_1.ExcellonParseException(`Invalid tool definition command ${cmd}`);
        }
        let toolStart = Number.parseInt(tool[1]);
        let toolEnd = tool.length > 2 ? Number.parseInt(tool[2]) : undefined;
        this.tool = new ToolPost(toolStart, toolEnd);
        if (match.length > 2) {
            this.modifiers = parseMods(match[2], fmt, "CFSHBZ");
        }
    }
    formatOutput(fmt) {
        let result = "T" + this.tool.toString();
        this.modifiers.forEach(m => result += formatMod(m, fmt));
        return result;
    }
    execute(ctx) {
        if (this.tool.isRange()) {
            for (let idx = this.tool.start; idx < this.tool.end; idx++) {
                ctx.tools.set(idx, findModifier("C", this.modifiers));
            }
        }
        else {
            ctx.tools.set(this.tool.start, findModifier("C", this.modifiers));
        }
    }
}
exports.ToolDefinitionCommand = ToolDefinitionCommand;
ToolDefinitionCommand.match = /^T(\d+(?:,\d+)?)((?:[CFSHBZ](?:[+\-])?(?:\d*)(?:\.\d*)?)+)$/;
ToolDefinitionCommand.toolMatch = /^(\d+)(?:,(\d+))?$/;
class ToolChangeCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.name = 'T';
        let match = ToolChangeCommand.match.exec(cmd);
        if (!match) {
            throw new excellonparser_1.ExcellonParseException(`Invalid tool change command ${cmd}`);
        }
        this.toolId = Number.parseInt(match[1]);
    }
    formatOutput(fmt) {
        return "T" + this.toolId;
    }
    execute(ctx) {
        /*
        if (ctx.tools.get(this.toolId) === undefined) {
            throw new ExcellonParseException(`Tool ${this.toolId} is not defined.`);
        }
        */
        ctx.activeTool = this.toolId;
    }
}
exports.ToolChangeCommand = ToolChangeCommand;
ToolChangeCommand.match = /^T(\d+)$/;
class EndOfHeaderCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.name = "%";
        if (cmd != '%') {
            throw new excellonparser_1.ExcellonParseException(`Invalid end of header command ${cmd}`);
        }
    }
    formatOutput() {
        return '%';
    }
    execute(ctx) {
        ctx.header = false;
    }
}
exports.EndOfHeaderCommand = EndOfHeaderCommand;
class GCodeWithMods {
    constructor(cmd, fmt, allowedMods, lineNo) {
        this.lineNo = lineNo;
        let gCodeMatch = cmd.match(GCodeWithMods.gCodeExpr);
        if (!gCodeMatch) {
            throw new excellonparser_1.ExcellonParseException(`Invalid G code command ${cmd}`);
        }
        this.codeId = Number.parseInt(gCodeMatch[1]);
        this.name = 'G' + this.codeId;
        let mods = cmd.replace(GCodeWithMods.gCodeExpr, '');
        this.modifiers = parseMods(mods, fmt, allowedMods);
    }
    formatOutput(fmt) {
        let result = "G";
        if (this.codeId < 10) {
            result += '0';
        }
        result += this.codeId;
        this.modifiers.forEach(m => result += formatMod(m, fmt));
        return result;
    }
    execute(ctx) {
    }
}
exports.GCodeWithMods = GCodeWithMods;
GCodeWithMods.gCodeExpr = /G(\d+)/;
class MCodeWithMods {
    constructor(cmd, fmt, allowedMods, lineNo) {
        this.lineNo = lineNo;
        let gCodeMatch = cmd.match(MCodeWithMods.mCodeExpr);
        if (!gCodeMatch) {
            throw new excellonparser_1.ExcellonParseException(`Invalid G code command ${cmd}`);
        }
        this.codeId = Number.parseInt(gCodeMatch[1]);
        this.name = 'M' + this.codeId;
        let mods = cmd.replace(MCodeWithMods.mCodeExpr, '');
        this.modifiers = parseMods(mods, fmt, allowedMods);
    }
    formatOutput(fmt) {
        let result = "M";
        if (this.codeId < 10) {
            result += '0';
        }
        result += this.codeId;
        this.modifiers.forEach(m => result += formatMod(m, fmt));
        return result;
    }
    execute(ctx) {
    }
}
exports.MCodeWithMods = MCodeWithMods;
MCodeWithMods.mCodeExpr = /M(\d+)/;
class RepeatCommand {
    constructor(cmd, fmt, allowedMods, lineNo) {
        this.lineNo = lineNo;
        this.name = 'R';
        let codeMatch = cmd.match(RepeatCommand.match);
        if (!codeMatch) {
            throw new excellonparser_1.ExcellonParseException(`Invalid R code command ${cmd}`);
        }
        this.repeat = Number.parseInt(codeMatch[1]);
        let mods = cmd.replace(RepeatCommand.match, '');
        this.modifiers = parseMods(mods, fmt, allowedMods);
    }
    formatOutput(fmt) {
        let result = "R" + this.repeat;
        this.modifiers.forEach(m => result += formatMod(m, fmt));
        return result;
    }
    execute(ctx) {
    }
}
exports.RepeatCommand = RepeatCommand;
RepeatCommand.match = /R(\d+)/;
class PatternRepeatCommand {
    constructor(cmd, fmt, allowedMods, lineNo) {
        this.lineNo = lineNo;
        this.name = 'P';
        let codeMatch = cmd.match(PatternRepeatCommand.match);
        if (!codeMatch) {
            throw new excellonparser_1.ExcellonParseException(`Invalid P code command ${cmd}`);
        }
        this.repeat = Number.parseInt(codeMatch[1]);
        let mods = cmd.replace(PatternRepeatCommand.match, '');
        this.modifiers = parseMods(mods, fmt, allowedMods);
    }
    formatOutput(fmt) {
        let result = "P" + this.repeat;
        this.modifiers.forEach(m => result += formatMod(m, fmt));
        return result;
    }
    execute(ctx) {
    }
}
exports.PatternRepeatCommand = PatternRepeatCommand;
PatternRepeatCommand.match = /P(\d+)/;
class CoordinatesCommand {
    constructor(cmd, fmt, allowedMods, lineNo) {
        this.lineNo = lineNo;
        this.name = 'move';
        this.modifiers = parseMods(cmd, fmt, allowedMods);
    }
    formatOutput(fmt) {
        let result = "";
        this.modifiers.forEach(m => result += formatMod(m, fmt));
        return result;
    }
    execute(ctx) {
        let x = findModifier("X", this.modifiers);
        let y = findModifier("Y", this.modifiers);
        let isRelative = ctx.coordinateMode == excellonparser_1.CoordinateMode.RELATIVE;
        if (x === undefined) {
            x = isRelative ? 0 : ctx.xPos;
        }
        if (y === undefined) {
            y = isRelative ? 0 : ctx.yPos;
        }
        if (ctx.coordinateMode == excellonparser_1.CoordinateMode.RELATIVE) {
            x += ctx.xPos;
            y += ctx.yPos;
        }
        let drill = ctx.tools.get(ctx.activeTool);
        if (drill == undefined) {
            console.log(`Undefined drill size for tool ID ${ctx.activeTool}`);
            drill = 0;
        }
        ctx.drillCommand(ctx.toMM(x), ctx.toMM(y), ctx.toMM(drill));
        ctx.xPos = x;
        ctx.yPos = y;
    }
}
exports.CoordinatesCommand = CoordinatesCommand;
//# sourceMappingURL=excelloncommands.js.map