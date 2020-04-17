import { CoordinateZeroFormat,  Epsilon } from "./primitives";
import {
    CoordinateFormatSpec,
    ExcellonCommand,
    ExcellonParseException,
    ExcellonState,
    CoordinateMode,
    Units
} from "./excellonparser";
import { parseCoordinate, formatFixedNumber } from "./utils";

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
export class CommentCommand implements ExcellonCommand {
    private static matchExp = /^;.*$/;
    private comment:string;
    readonly name = "Comment";

    constructor(cmd:string, readonly lineNo?:number) {
        if (cmd[0] != ';') {
            throw new ExcellonParseException(`Invalid comment command ${cmd}`);
        }
        this.comment = cmd.substr(1);
    }

    formatOutput():string {
        return ';' + this.comment;
    }

    execute(ctx:ExcellonState) {
        if (this.comment.startsWith("FORMAT={")) {
            let format = this.comment
                .substring(8, this.comment.length - 1)
                .split('/')
                .map(s => s.trim());
            this.parseFormat(format, ctx);
        } else if (this.comment.startsWith("FILE_FORMAT=")) {
            let format = this.comment
                .substring(12)
                .trim();
            this.parseFormat2(format, ctx);
        }
    }

    private parseFormat(format:string[], ctx:ExcellonState) {
        let numberFormat = format[0].split(':');
        let numIntPos = numberFormat[0] != '-' ? Number.parseInt(numberFormat[0]) : -1;
        let numDecPos = numberFormat[1] != '-' ? Number.parseInt(numberFormat[1]) : -1;
        let position:CoordinateMode = format[1] == 'absolute' ? CoordinateMode.ABSOLUTE : CoordinateMode.RELATIVE;
        let units:Units = format[2] == 'inch' ? Units.INCHES : Units.MILIMETERS;
        let zeroFormat:CoordinateZeroFormat = CoordinateZeroFormat.NONE;
        switch (format[3]) {
            case 'decimal':
                zeroFormat = CoordinateZeroFormat.DIRECT;
                break;
            case 'suppress leading zeros':
                zeroFormat = CoordinateZeroFormat.TRAILING;
                break;
            case 'suppress trailing zeros':
            case 'keep zeroes':
                zeroFormat = CoordinateZeroFormat.LEADING;
                break;
        }
        if (numIntPos < 0) {
            numIntPos = units == Units.INCHES ? 2 : 3;
        }
        if (numDecPos < 0) {
            numDecPos = units == Units.INCHES ? 4 : 3;
        }
        ctx.fmt = new CoordinateFormatSpec(numIntPos, numDecPos, zeroFormat);
        ctx.fmtSet = true;
        ctx.units = units;
        ctx.coordinateMode = position;
    }

    private parseFormat2(format:string, ctx:ExcellonState) {
        let numberFormat = format.split(':');
        let numIntPos = numberFormat[0] != '-' ? Number.parseInt(numberFormat[0]) : -1;
        let numDecPos = numberFormat[1] != '-' ? Number.parseInt(numberFormat[1]) : -1;
        if (numIntPos >= 0 && numDecPos >= 0) {
            ctx.fmt = new CoordinateFormatSpec(numIntPos, numDecPos, CoordinateZeroFormat.LEADING);
            ctx.fmtSet = true;
        }
    }
}

export class GCodeCommand implements ExcellonCommand {
    readonly codeId:number;
    readonly name:string;
    private static matchExp = /^G(\d+)/;

    constructor(cmd:string, readonly lineNo?:number) {
        let match = GCodeCommand.matchExp.exec(cmd);
        if (!match) {
            throw new ExcellonParseException(`Invalid G command format ${cmd}`);
        }
        this.codeId = Number.parseInt(match[1]);
        this.name = 'G' + this.codeId;
    }

    formatOutput():string {
        let result = "G";
        if (this.codeId < 10) {
            result += "0";
        }
        result += this.codeId;
        return result;
    }

    execute(ctx:ExcellonState) {
        switch(this.codeId) {
            case 90:
                ctx.coordinateMode = CoordinateMode.ABSOLUTE;
                break;
            case 91:
                ctx.coordinateMode = CoordinateMode.RELATIVE;
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

export class MCodeCommand implements ExcellonCommand {
    readonly codeId:number;
    readonly name:string;
    private static matchExp = /^M(\d+)/;

    constructor(cmd:string, readonly lineNo?:number) {
        let match = MCodeCommand.matchExp.exec(cmd);
        if (!match) {
            throw new ExcellonParseException(`Invalid M command format ${cmd}`);
        }
        this.codeId = Number.parseInt(match[1]);
        this.name = 'M' + this.codeId;
    }

    formatOutput():string {
        let result = "M";
        if (this.codeId < 10) {
            result += "0";
        }
        result += this.codeId;
        return result;
    }

    execute(ctx:ExcellonState) {
        switch(this.codeId) {
            case 95:
                ctx.header = false;
                break;
        }
    }
}

export class CommaCommandBase implements ExcellonCommand {
    values:Array<string>;
    name:string;

    constructor(cmd:string, readonly lineNo?:number) {
        let parts = cmd.split(',');
        this.name = parts[0];
        parts.splice(0, 1);
        this.values = parts;
    }

    formatOutput():string {
        let result = this.name;
        this.values.forEach(v => result = result + "," + v);
        return result;
    }

    execute(ctx:ExcellonState) {
        switch(this.name) {
            case 'M71':
                ctx.units = Units.MILIMETERS;
                if (ctx.header && !ctx.fmtSet) {
                    ctx.fmt = new CoordinateFormatSpec(3, 3, CoordinateZeroFormat.LEADING);
                    ctx.fmtSet = true;
                }
                break;
            case 'M72':
                ctx.units = Units.INCHES;
                if (ctx.header && !ctx.fmtSet) {
                    ctx.fmt = new CoordinateFormatSpec(2, 4, CoordinateZeroFormat.LEADING);
                    ctx.fmtSet = true;
                }
                break;
        }
    }
}

export class ResetCommand extends CommaCommandBase {
    constructor(cmd:string, readonly lineNo?:number) {
        super(cmd, lineNo);
        if (this.name != 'R') {
            throw new ExcellonParseException(`Invalid R command ${cmd}`);
        }
    }
    execute() {}
}

export class AxisVersionCommand extends CommaCommandBase {
    constructor(cmd:string, readonly lineNo?:number) {
        super(cmd, lineNo);
        if (this.name != 'VER') {
            throw new ExcellonParseException(`Invalid VER command ${cmd}`);
        }
    }

    execute() {}
}

export class FileFormatCommand extends CommaCommandBase {
    constructor(cmd:string, readonly lineNo?:number) {
        super(cmd, lineNo);
        if (this.name != 'FMAT') {
            throw new ExcellonParseException(`Invalid FMAT command ${cmd}`);
        }
    }
    execute() {}
}

export class UnitsCommand extends CommaCommandBase {
    constructor(cmd:string, readonly lineNo?:number) {
        super(cmd, lineNo);
        if (this.name != 'INCH' && this.name != 'METRIC') {
            throw new ExcellonParseException(`Invalid units command ${cmd}`);
        }
    }

    execute(ctx:ExcellonState) {
        let zeroFormat:CoordinateZeroFormat = CoordinateZeroFormat.NONE;
        let units = this.name == 'INCH' ? Units.INCHES : Units.MILIMETERS;
        if (this.values.length > 0) {
            switch (this.values[0]) {
                case 'LZ':
                    zeroFormat = CoordinateZeroFormat.TRAILING;
                    break;
                case 'TZ':
                    zeroFormat = CoordinateZeroFormat.LEADING;
                    break;
            }
            let numIntPos:number;
            let numDecPos:number;
            if (ctx.fmtSet) {
                numIntPos = ctx.fmt.numIntPos;
                numDecPos = ctx.fmt.numDecimalPos;
            } else {
                numIntPos = units == Units.INCHES ? 2 : 3;
                numDecPos = units == Units.INCHES ? 4 : 3;
            }
            ctx.fmt = new CoordinateFormatSpec(numIntPos, numDecPos, zeroFormat);
            ctx.fmtSet = true;
        }
        ctx.units = units;
    }
}

export interface Modifier {
    readonly code:string;
    readonly value?:number;
}

export class ToolPost {
    constructor(readonly start:number, readonly end?:number) {
    }

    isRange() {
        return this.end && this.end != this.start;
    }

    toString():string {
        if (this.isRange()) {
            return this.start + "," + this.end;
        }
        return this.start.toString();
    }
}

const numChars = '+-.0123456789';
const emptyModsAllowed = 'HXY';

function parseMods(mods:string, fmt:CoordinateFormatSpec, allowedMods?:string):Array<Modifier> {
    let result = [];
    while (mods.length > 0) {
        let code = mods[0];
        let idx:number;
        if (allowedMods && allowedMods.indexOf(code) < 0) {
            throw new ExcellonParseException(`Modifier ${code} not allowed: ${mods}`);
        }
        for (idx = 1; idx < mods.length; idx++) {
            if (numChars.indexOf(mods[idx]) < 0) {
                break;
            }
        }
        if (idx == 1) {
            if (emptyModsAllowed.indexOf(code) >= 0) {
                // Mod with no value, for example T1H
                result.push({code:code});
                mods = mods.substr(1);
                continue;
            }
            throw new ExcellonParseException(`Invalid modifier ${mods}`);
        }
        let valueStr = mods.substr(1, idx - 1);
        let value:number;
        switch (code) {
            case 'X':
            case 'Y':
            case 'Z':
                value = parseCoordinate(valueStr, fmt.numIntPos, fmt.numDecimalPos, fmt.zeroSkip);
                break;
            case 'S':
                value = parseCoordinate(valueStr, 5, 0, CoordinateZeroFormat.LEADING);
                break;
            case 'B':
                value = parseCoordinate(valueStr, 4, 0, CoordinateZeroFormat.LEADING);
                break;
            case 'C':
                value = parseCoordinate(valueStr, 0, 3, CoordinateZeroFormat.LEADING);
                break;
            case 'H':
                value = parseCoordinate(valueStr, 4, 0, CoordinateZeroFormat.TRAILING);
                break;
            default:
                value = parseCoordinate(valueStr, 3, 0, CoordinateZeroFormat.LEADING);
                break;
        }
        result.push({code:code, value:value});
        mods = mods.substr(idx);
    }
    return result;
}

function findModifier(code:string, mods:Array<Modifier>):number {
    let mod = mods.find(m => m.code == code);
    if (mod) {
        return mod.value;
    }
    return undefined;
}

function fomratModNumber(
    value:number,
    numIntPos:number,
    numDecPos:number,
    zeroSkip:CoordinateZeroFormat):string {
    let intValue = Math.round(value * Math.pow(10, numDecPos));
    let roundValue = intValue * Math.pow(10, -numDecPos);
    if (Math.abs(value - roundValue) > Epsilon) {
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
    return formatFixedNumber(value, numDecPos, numIntPos, zeroSkip);
}

function formatMod(mod:Modifier, fmt:CoordinateFormatSpec):string {
    if (mod.value == undefined) {
        return mod.code;
    }
    let value:string;
    switch (mod.code) {
        case 'X':
        case 'Y':
        case 'Z':
            value = fomratModNumber(mod.value, fmt.numIntPos, fmt.numDecimalPos, fmt.zeroSkip);
            break;
        case 'S':
            value = fomratModNumber(mod.value, 5, 0, CoordinateZeroFormat.LEADING);
            break;
        case 'B':
            value = fomratModNumber(mod.value, 4, 0, CoordinateZeroFormat.LEADING);
            break;
        case 'C':
            value = fomratModNumber(mod.value, 0, 3, CoordinateZeroFormat.LEADING);
            break;
        case 'H':
            value = fomratModNumber(mod.value, 4, 0, CoordinateZeroFormat.TRAILING);
            break;
        case 'G':
        case 'M':
            value = mod.value.toString();
            if (mod.value < 10) {
                value = '0' + value;
            }
            break;
        default:
            value = fomratModNumber(mod.value, 3, 0, CoordinateZeroFormat.LEADING);
            break;
    }
    return mod.code + value;
}

export class ToolDefinitionCommand implements ExcellonCommand {
    readonly name = 'T';
    readonly tool:ToolPost;
    readonly modifiers:Array<Modifier>;

    private static match = /^T(\d+(?:,\d+)?)((?:[CFSHBZ](?:[+\-])?(?:\d*)(?:\.\d*)?)+)$/;
    private static toolMatch = /^(\d+)(?:,(\d+))?$/;

    constructor(cmd:string, fmt:CoordinateFormatSpec, readonly lineNo?:number) {
        let match = ToolDefinitionCommand.match.exec(cmd);
        if (!match) {
            throw new ExcellonParseException(`Invalid tool definition command ${cmd}`);
        }
        let tool = ToolDefinitionCommand.toolMatch.exec(match[1]);
        if (!tool) {
            throw new ExcellonParseException(`Invalid tool definition command ${cmd}`);
        }
        let toolStart = Number.parseInt(tool[1]);
        let toolEnd = tool.length > 2 ? Number.parseInt(tool[2]) : undefined;
        this.tool = new ToolPost(toolStart, toolEnd);
        if (match.length > 2) {
            this.modifiers = parseMods(match[2], fmt, "CFSHBZ");
        }
    }

    formatOutput(fmt:CoordinateFormatSpec):string {
        let result = "T" + this.tool.toString();
        this.modifiers.forEach(m => result += formatMod(m, fmt));
        return result;
    }

    execute(ctx:ExcellonState) {
        if (this.tool.isRange()) {
            for(let idx = this.tool.start; idx < this.tool.end; idx++) {
                ctx.tools.set(idx, findModifier("C", this.modifiers));
            }
        } else {
            ctx.tools.set(this.tool.start, findModifier("C", this.modifiers));
        }
    }
}

export class ToolChangeCommand implements ExcellonCommand {
    readonly name = 'T';
    readonly toolId:number;

    private static match = /^T(\d+)$/;

    constructor(cmd:string, readonly lineNo?:number) {
        let match = ToolChangeCommand.match.exec(cmd);
        if (!match) {
            throw new ExcellonParseException(`Invalid tool change command ${cmd}`);
        }
        this.toolId = Number.parseInt(match[1]);
    }

    formatOutput(fmt:CoordinateFormatSpec):string {
        return "T" + this.toolId;
    }

    execute(ctx:ExcellonState) {
        /*
        if (ctx.tools.get(this.toolId) === undefined) {
            throw new ExcellonParseException(`Tool ${this.toolId} is not defined.`);
        }
        */
        ctx.activeTool = this.toolId;
    }
}

export class EndOfHeaderCommand implements ExcellonCommand {
    readonly name = "%";

    constructor(cmd:string, readonly lineNo?:number) {
        if (cmd != '%') {
            throw new ExcellonParseException(`Invalid end of header command ${cmd}`);
        }
    }

    formatOutput():string {
        return '%';
    }

    execute(ctx:ExcellonState) {
        ctx.header = false;
    }
}

export class GCodeWithMods implements ExcellonCommand {
    readonly codeId:number;
    readonly name:string;
    readonly modifiers:Array<Modifier>;
    private static gCodeExpr = /G(\d+)/;

    constructor(
        cmd:string,
        fmt:CoordinateFormatSpec,
        allowedMods:string,
        readonly lineNo?:number) {
        let gCodeMatch = cmd.match(GCodeWithMods.gCodeExpr);
        if (!gCodeMatch) {
            throw new ExcellonParseException(`Invalid G code command ${cmd}`);
        }
        this.codeId = Number.parseInt(gCodeMatch[1]);
        this.name = 'G' + this.codeId;
        let mods = cmd.replace(GCodeWithMods.gCodeExpr, '');
        this.modifiers = parseMods(mods, fmt, allowedMods);
    }

    formatOutput(fmt:CoordinateFormatSpec):string {
        let result = "G";
        if (this.codeId < 10) {
            result += '0';
        }
        result += this.codeId;
        this.modifiers.forEach(m => result += formatMod(m, fmt));
        return result;
    }
    execute(ctx:ExcellonState) {
    }
}

export class MCodeWithMods implements ExcellonCommand {
    readonly codeId:number;
    readonly name:string;
    readonly modifiers:Array<Modifier>;
    private static mCodeExpr = /M(\d+)/;

    constructor(
        cmd:string,
        fmt:CoordinateFormatSpec,
        allowedMods:string,
        readonly lineNo?:number) {
        let gCodeMatch = cmd.match(MCodeWithMods.mCodeExpr);
        if (!gCodeMatch) {
            throw new ExcellonParseException(`Invalid G code command ${cmd}`);
        }
        this.codeId = Number.parseInt(gCodeMatch[1]);
        this.name = 'M' + this.codeId;
        let mods = cmd.replace(MCodeWithMods.mCodeExpr, '');
        this.modifiers = parseMods(mods, fmt, allowedMods);
    }

    formatOutput(fmt:CoordinateFormatSpec):string {
        let result = "M";
        if (this.codeId < 10) {
            result += '0';
        }
        result += this.codeId;
        this.modifiers.forEach(m => result += formatMod(m, fmt));
        return result;
    }
    execute(ctx:ExcellonState) {
    }
}

export class RepeatCommand implements ExcellonCommand {
    readonly repeat:number;
    readonly name:string = 'R';
    readonly modifiers:Array<Modifier>;
    private static match = /R(\d+)/;

    constructor(
        cmd:string,
        fmt:CoordinateFormatSpec,
        allowedMods:string,
        readonly lineNo?:number) {
        let codeMatch = cmd.match(RepeatCommand.match);
        if (!codeMatch) {
            throw new ExcellonParseException(`Invalid R code command ${cmd}`);
        }
        this.repeat = Number.parseInt(codeMatch[1]);
        let mods = cmd.replace(RepeatCommand.match, '');
        this.modifiers = parseMods(mods, fmt, allowedMods);
    }

    formatOutput(fmt:CoordinateFormatSpec):string {
        let result = "R" + this.repeat;
        this.modifiers.forEach(m => result += formatMod(m, fmt));
        return result;
    }
    execute(ctx:ExcellonState) {
    }
}

export class PatternRepeatCommand implements ExcellonCommand {
    readonly repeat:number;
    readonly name:string = 'P';
    readonly modifiers:Array<Modifier>;
    private static match = /P(\d+)/;

    constructor(
        cmd:string,
        fmt:CoordinateFormatSpec,
        allowedMods:string,
        readonly lineNo?:number) {
        let codeMatch = cmd.match(PatternRepeatCommand.match);
        if (!codeMatch) {
            throw new ExcellonParseException(`Invalid P code command ${cmd}`);
        }
        this.repeat = Number.parseInt(codeMatch[1]);
        let mods = cmd.replace(PatternRepeatCommand.match, '');
        this.modifiers = parseMods(mods, fmt, allowedMods);
    }

    formatOutput(fmt:CoordinateFormatSpec):string {
        let result = "P" + this.repeat;
        this.modifiers.forEach(m => result += formatMod(m, fmt));
        return result;
    }
    execute(ctx:ExcellonState) {
    }
}

export class CoordinatesCommand implements ExcellonCommand {
    readonly name:string = 'move';
    readonly modifiers:Array<Modifier>;

    constructor(
        cmd:string,
        fmt:CoordinateFormatSpec,
        allowedMods:string,
        readonly lineNo?:number) {
        this.modifiers = parseMods(cmd, fmt, allowedMods);

    }

    formatOutput(fmt:CoordinateFormatSpec):string {
        let result = "";
        this.modifiers.forEach(m => result += formatMod(m, fmt));
        return result;
    }

    execute(ctx:ExcellonState) {
        let x:number = findModifier("X", this.modifiers);
        let y:number = findModifier("Y", this.modifiers);
        let isRelative = ctx.coordinateMode == CoordinateMode.RELATIVE;
        if (x === undefined) {
            x = isRelative ? 0 : ctx.xPos;
        }
        if (y === undefined) {
            y = isRelative ? 0 : ctx.yPos;
        }
        if (ctx.coordinateMode == CoordinateMode.RELATIVE) {
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