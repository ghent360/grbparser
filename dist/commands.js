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
/**
* This file contains classes that implement functionality for
* the individual gerber commands.
*
* Each command class would parse the command from the input text and construct one or more
* primitives which hold the command data in consumable form.
*
* Each command class would be able to construct a well formatted text representation of
* the command suitable for output in a gerber file.
*
* Note that in the input text the command separators are stipped by the command tokenizer.
*/
const primitives_1 = require("./primitives");
const point_1 = require("./point");
const vectorUtils_1 = require("./vectorUtils");
const expressions_1 = require("./expressions");
class FSCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.name = "FS";
        this.isAdvanced = true;
        let match = FSCommand.matchExp.exec(cmd);
        if (!match) {
            throw new primitives_1.GerberParseException(`Unsuported FS command ${cmd}`);
        }
        let coordZeros = primitives_1.CoordinateSkipZeros.NONE;
        if (match[1]) {
            switch (match[1]) {
                case 'L':
                    coordZeros = primitives_1.CoordinateSkipZeros.LEADING;
                    break;
                case 'T':
                    coordZeros = primitives_1.CoordinateSkipZeros.TRAILING;
                    break;
                case 'D':
                    coordZeros = primitives_1.CoordinateSkipZeros.DIRECT;
                    break;
            }
        }
        let coordType = (match[2] == 'A') ? primitives_1.CoordinateType.ABSOLUTE : primitives_1.CoordinateType.INCREMENTAL;
        let xNumIntPos = Number.parseInt(match[5]);
        let xNumDecPos = Number.parseInt(match[6]);
        let yNumIntPos = Number.parseInt(match[7]);
        let yNumDecPos = Number.parseInt(match[8]);
        this.coordinateFormat =
            new primitives_1.CoordinateFormatSpec(coordZeros, coordType, xNumIntPos, xNumDecPos, yNumIntPos, yNumDecPos);
    }
    formatOutput() {
        let result = "FS";
        if (this.coordinateFormat.coordFormat != primitives_1.CoordinateSkipZeros.NONE) {
            switch (this.coordinateFormat.coordFormat) {
                case primitives_1.CoordinateSkipZeros.LEADING:
                    result += "L";
                    break;
                case primitives_1.CoordinateSkipZeros.TRAILING:
                    result += "T";
                    break;
                case primitives_1.CoordinateSkipZeros.DIRECT:
                    result += "D";
                    break;
            }
        }
        result += (this.coordinateFormat.coordType == primitives_1.CoordinateType.ABSOLUTE) ? "A" : "I";
        result += "X";
        result += this.coordinateFormat.xNumIntPos;
        result += this.coordinateFormat.xNumDecPos;
        result += "Y";
        result += this.coordinateFormat.yNumIntPos;
        result += this.coordinateFormat.yNumDecPos;
        result += "*";
        return result;
    }
    execute(ctx) {
        ctx.coordinateFormatSpec = this.coordinateFormat;
    }
}
FSCommand.matchExp = /^FS([LTD]?)([IA])(N\d)?(G\d)?X(\d)(\d)Y(\d)(\d)(Z\d+)?(D\d)?(M\d)?\*$/;
exports.FSCommand = FSCommand;
class MOCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.name = "MO";
        this.isAdvanced = true;
        let mode = cmd.substr(2, 2);
        if (mode === "MM") {
            this.units = primitives_1.CoordinateUnits.MILIMETERS;
        }
        else if (mode = "IN") {
            this.units = primitives_1.CoordinateUnits.INCHES;
        }
        else {
            throw new primitives_1.GerberParseException(`Invalid file units command ${cmd}`);
        }
    }
    formatOutput() {
        return "MO" + (this.units == primitives_1.CoordinateUnits.MILIMETERS ? "MM" : "IN") + "*";
    }
    execute(ctx) {
        ctx.coordinateUnits = this.units;
    }
}
exports.MOCommand = MOCommand;
class ADCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.name = "AD";
        this.isAdvanced = true;
        let match = ADCommand.matchExp.exec(cmd);
        if (!match) {
            throw new primitives_1.GerberParseException(`Invalid aperture AD command ${cmd}`);
        }
        let apertureId = Number.parseInt(match[1]);
        if (apertureId < 10) {
            throw new primitives_1.GerberParseException(`Invalid aperture ID ${apertureId}`);
        }
        let templateName = match[2];
        let modifiers = [];
        let modifiersTxt = match[3];
        if (modifiersTxt != undefined) {
            let modifierStrStart = 1;
            while (modifierStrStart < modifiersTxt.length) {
                let xIdx = modifiersTxt.indexOf('X', modifierStrStart);
                if (xIdx < 0) {
                    xIdx = modifiersTxt.length;
                }
                let valueStr = modifiersTxt.substring(modifierStrStart, xIdx);
                let value = Number.parseFloat(valueStr);
                if (value == NaN) {
                    throw new primitives_1.GerberParseException(`Invalid aperture modifier ${valueStr}`);
                }
                modifiers.push(value);
                modifierStrStart = xIdx + 1;
            }
        }
        this.definition = new primitives_1.ApertureDefinition(apertureId, templateName, modifiers);
        this.checkStandardApertures();
    }
    formatOutput() {
        let result = "ADD" + this.definition.apertureId + this.definition.templateName;
        let first = true;
        for (let m of this.definition.modifiers) {
            if (first) {
                first = false;
                result += ",";
            }
            else {
                result += "X";
            }
            result += m.toString();
        }
        result += "*";
        return result;
    }
    execute(ctx) {
        this.definition.execute(ctx);
        ctx.setAperture(this.definition);
    }
    checkStandardApertures() {
        if (this.definition.templateName === "C") {
            this.checkCircleAperture();
        }
        else if (this.definition.templateName === "R") {
            this.checkRectangleAperture();
        }
        else if (this.definition.templateName === "O") {
            this.checkObroundAperture();
        }
    }
    checkCircleAperture() {
        if (this.definition.modifiers.length < 1 || this.definition.modifiers.length > 3) {
            throw new primitives_1.GerberParseException(`Invalid circle aperture ${this.formatOutput()}`);
        }
        if (this.definition.modifiers[0] < 0) {
            throw new primitives_1.GerberParseException(`Invalid circle aperture radius D${this.definition.apertureId}:`
                + ` ${this.definition.modifiers[0]}`);
        }
        if (this.definition.modifiers.length > 0
            && (this.definition.modifiers[1] < 0
                || this.definition.modifiers[1] > this.definition.modifiers[0])) {
            throw new primitives_1.GerberParseException(`Invalid circle aperture hole radius D${this.definition.apertureId}:`
                + ` ${this.definition.modifiers[1]}`);
        }
        if (this.definition.modifiers.length > 1
            && (this.definition.modifiers[2] < 0
                || this.definition.modifiers[2] > this.definition.modifiers[0])) {
            throw new primitives_1.GerberParseException(`Invalid circle aperture hole size D${this.definition.apertureId}:`
                + ` ${this.definition.modifiers[1]}`);
        }
    }
    checkRectangleAperture() {
        if (this.definition.modifiers.length < 2 || this.definition.modifiers.length > 4) {
            throw new primitives_1.GerberParseException(`Invalid rectangle aperture ${this.formatOutput()}`);
        }
        if (this.definition.modifiers[0] < 0 || this.definition.modifiers[1] < 0) {
            throw new primitives_1.GerberParseException(`Invalid rectangle aperture size D${this.definition.apertureId}: `
                + `${this.definition.modifiers[0]}X${this.definition.modifiers[1]}`);
        }
        if (this.definition.modifiers.length > 2) {
            let radius = this.definition.modifiers[2];
            if (radius < 0) {
                throw new primitives_1.GerberParseException(`Invalid rectangle aperture hole radius D${this.definition.apertureId}: `
                    + `${this.definition.modifiers[2]}`);
            }
        }
        if (this.definition.modifiers.length > 3) {
            let height = this.definition.modifiers[4];
            if (height < 0) {
                throw new primitives_1.GerberParseException(`Invalid rectangle aperture hole height D${this.definition.apertureId}: `
                    + `${this.definition.modifiers[2]}`);
            }
        }
    }
    checkObroundAperture() {
        if (this.definition.modifiers.length < 2 || this.definition.modifiers.length > 4) {
            throw new primitives_1.GerberParseException(`Invalid obround aperture ${this.formatOutput()}`);
        }
        if (this.definition.modifiers[0] <= 0 || this.definition.modifiers[1] <= 0) {
            throw new primitives_1.GerberParseException(`Invalid obround aperture size D${this.definition.apertureId}: `
                + `${this.definition.modifiers[0]}X${this.definition.modifiers[1]}`);
        }
        if (this.definition.modifiers.length > 2) {
            let radius = this.definition.modifiers[2];
            if (radius <= 0) {
                throw new primitives_1.GerberParseException(`Invalid obround aperture hole radius D${this.definition.apertureId}: `
                    + `${this.definition.modifiers[2]}`);
            }
        }
        if (this.definition.modifiers.length > 3) {
            let height = this.definition.modifiers[3];
            if (height <= 0) {
                throw new primitives_1.GerberParseException(`Invalid obround aperture hole height D${this.definition.apertureId}: `
                    + `${this.definition.modifiers[2]}`);
            }
        }
    }
    checkPolygonAperture() {
        if (this.definition.modifiers.length < 2 || this.definition.modifiers.length > 4) {
            throw new primitives_1.GerberParseException(`Invalid polygon aperture ${this.formatOutput()}`);
        }
        if (this.definition.modifiers[0] <= 0) {
            throw new primitives_1.GerberParseException(`Invalid polygon aperture radius D${this.definition.apertureId}: `
                + `${this.definition.modifiers[0]}`);
        }
        if (this.definition.modifiers[1] < 3
            || this.definition.modifiers[1] > 12
            || Math.floor(this.definition.modifiers[1]) != this.definition.modifiers[1]) {
            throw new primitives_1.GerberParseException(`Invalid polygon aperture number of vertices D${this.definition.apertureId}: `
                + `${this.definition.modifiers[1]}`);
        }
        if (this.definition.modifiers.length > 3) {
            let radius = this.definition.modifiers[3];
            if (radius <= 0 || radius >= this.definition.modifiers[0]) {
                throw new primitives_1.GerberParseException(`Invalid polygon aperture hole radius D${this.definition.apertureId}: `
                    + `${this.definition.modifiers[3]}`);
            }
        }
    }
}
ADCommand.matchExp = /^ADD(\d+)([a-zA-Z_.$][a-zA-Z\-0-9_~.$]*)(,(?:\s*[\+\-]?(?:\d*\.?\d*)(?:[eE][\+\-]?\d+)?\s*)(?:X\s*[\+\-]?(?:\d*\.?\d*)(?:[eE][\+\-]?\d+)?\s*)*)?\*$/;
exports.ADCommand = ADCommand;
function skipIntCode(cmd, start = 1) {
    for (let startIdx = start; startIdx < cmd.length; startIdx++) {
        let charAt = cmd.charAt(startIdx);
        if (charAt < '0' || charAt > '9') {
            return startIdx;
        }
    }
    return cmd.length;
}
class G04Command {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.name = "G04";
        this.isAdvanced = false;
        let match = G04Command.matchExp.exec(cmd);
        if (!match) {
            throw new primitives_1.GerberParseException(`Invalid G04 command ${cmd}`);
        }
        this.comment = match[1];
    }
    formatOutput() {
        return "G04" + this.comment;
    }
    execute(ctx) {
    }
}
G04Command.matchExp = /^G[0]*4(.*)$/;
exports.G04Command = G04Command;
class AMCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.name = "AM";
        this.isAdvanced = true;
        let content = cmd.split("*");
        let name = content[0].substring(2);
        let macroContent = [];
        for (let idx = 1; idx < content.length - 1; idx++) {
            let part = content[idx];
            if (part[0] == "$") {
                let numEndIdx = skipIntCode(part, 1);
                let varId = Number.parseInt(part.substring(1, numEndIdx));
                if (part[numEndIdx] != "=") {
                    throw new primitives_1.GerberParseException(`Invalid variable definition ${part}`);
                }
                let parser = new expressions_1.ExpressionParser(part.substring(numEndIdx + 1));
                macroContent.push(new primitives_1.VariableDefinition(varId, parser.parse()));
            }
            else {
                if (part.startsWith("0 ")) {
                    macroContent.push(new primitives_1.PrimitiveComment(part.substr(2)));
                }
                else {
                    let primitiveParts = part.split(",");
                    let primitiveId = Number.parseInt(primitiveParts[0]);
                    primitiveParts.splice(0, 1);
                    macroContent.push(new primitives_1.Primitive(primitiveId, primitiveParts.map(part => {
                        let parser = new expressions_1.ExpressionParser(part);
                        return parser.parse();
                    })));
                }
            }
        }
        this.macro = new primitives_1.ApertureMacro(name, macroContent);
    }
    formatOutput() {
        let result = "AM" + this.macro.macroName + "*";
        for (let part of this.macro.content) {
            result += "\n";
            if (part instanceof primitives_1.VariableDefinition) {
                let varDef = part;
                result += "$" + varDef.id + "=" + varDef.expression + "*";
            }
            else if (part instanceof primitives_1.PrimitiveComment) {
                let comment = part;
                result += "0 " + comment.text + "*";
            }
            else {
                let primitive = part;
                result += primitive.code;
                for (let modifier of primitive.modifiers) {
                    result += "," + modifier.toString();
                }
                result += "*";
            }
        }
        return result;
    }
    execute(ctx) {
        ctx.setApertureMacro(this.macro);
    }
}
exports.AMCommand = AMCommand;
class ABCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.name = "AB";
        this.isAdvanced = true;
        let match = ABCommand.matchExp.exec(cmd);
        if (!match) {
            throw new primitives_1.GerberParseException(`Invalid AB command format ${cmd}`);
        }
        if (match[1] == undefined) {
            this.blockId = -1;
        }
        else {
            this.blockId = Number.parseInt(match[1]);
            if (this.blockId < 10) {
                throw new primitives_1.GerberParseException(`Invalid AB command format ${cmd}`);
            }
        }
    }
    formatOutput() {
        let result = "AB";
        if (this.blockId > 0) {
            result += "D" + this.blockId;
        }
        result += "*";
        return result;
    }
    execute(ctx) {
        if (this.blockId >= 10) {
            ctx.startBlockAperture(this.blockId);
        }
        else {
            ctx.endBlockAperture();
        }
    }
}
ABCommand.matchExp = /^AB(?:D(\d+))?\*$/;
exports.ABCommand = ABCommand;
/**
 * This is the "set current aperture" command, not the D01, D02 or D03 command.
 */
class DCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.name = "D";
        this.isAdvanced = false;
        let match = DCommand.matchExp.exec(cmd);
        if (!match) {
            throw new primitives_1.GerberParseException(`Invalid D command format ${cmd}`);
        }
        this.apertureId = Number.parseInt(match[1]);
        if (this.apertureId < 10) {
            throw new primitives_1.GerberParseException(`Invalid D command format ${cmd}`);
        }
    }
    formatOutput() {
        return "D" + this.apertureId;
    }
    execute(ctx) {
        ctx.getAperture(this.apertureId);
        ctx.currentAppretureId = this.apertureId;
    }
}
DCommand.matchExp = /^(?:G54)?D(\d+)$/;
exports.DCommand = DCommand;
function parseCoordinateX(coordinate, fmt) {
    let xLen = fmt.xNumIntPos + fmt.xNumDecPos;
    let sign = 1;
    if (coordinate[0] == '-') {
        sign = -1;
        coordinate = coordinate.substring(1);
    }
    //if (coordinate.length > xLen) {
    //    throw new GerberParseException(`Coordinate ${coordinate} longer than the X format allows ${fmt.xNumIntPos}${fmt.xNumDecPos}`);
    //}
    let zeroMult = 1;
    if (fmt.coordFormat == primitives_1.CoordinateSkipZeros.TRAILING && coordinate.length < xLen) {
        zeroMult = Math.pow(10, xLen - coordinate.length);
    }
    let num = Number.parseFloat(coordinate);
    return sign * num * fmt.xPow * zeroMult;
}
exports.parseCoordinateX = parseCoordinateX;
function parseCoordinateY(coordinate, fmt) {
    let yLen = fmt.yNumIntPos + fmt.yNumDecPos;
    let sign = 1;
    if (coordinate[0] == '-') {
        sign = -1;
        coordinate = coordinate.substring(1);
    }
    //if (coordinate.length > yLen) {
    //    throw new GerberParseException(`Coordinate ${coordinate} longer than the Y format allows ${fmt.xNumIntPos}${fmt.xNumDecPos}`);
    //}
    let zeroMult = 1;
    if (fmt.coordFormat == primitives_1.CoordinateSkipZeros.TRAILING && coordinate.length < yLen) {
        zeroMult = Math.pow(10, yLen - coordinate.length);
    }
    let num = Number.parseFloat(coordinate);
    return sign * num * fmt.yPow * zeroMult;
}
exports.parseCoordinateY = parseCoordinateY;
function formatFixedNumber(value, precision, intPos, skip) {
    let totalLen = intPos + precision;
    let sign = "";
    if (value < 0) {
        value = -value;
        sign = "-";
    }
    let intValue = Math.round(value * Math.pow(10, precision));
    let strValue = intValue.toString();
    switch (skip) {
        case primitives_1.CoordinateSkipZeros.NONE:
            if (strValue.length < totalLen) {
                strValue = "0".repeat(totalLen - strValue.length) + strValue;
            }
            if (strValue.length > totalLen) {
                throw new primitives_1.GerberParseException(`Value ${value} does note fit format ${intPos}${precision}.`);
            }
            return sign + strValue;
        case primitives_1.CoordinateSkipZeros.LEADING:
            if (strValue.length > totalLen) {
                throw new primitives_1.GerberParseException(`Value ${value} does note fit format ${intPos}${precision}.`);
            }
            return sign + strValue;
        case primitives_1.CoordinateSkipZeros.TRAILING:
            if (strValue.length < totalLen) {
                strValue = "0".repeat(totalLen - strValue.length) + strValue;
            }
            if (strValue.length > totalLen) {
                throw new primitives_1.GerberParseException(`Value ${value} does note fit format ${intPos}${precision}.`);
            }
            let endTrim = strValue.length - 1;
            while (endTrim >= 0 && strValue[endTrim] == '0') {
                endTrim--;
            }
            strValue = strValue.substr(0, endTrim + 1);
            return sign + strValue;
    }
}
exports.formatFixedNumber = formatFixedNumber;
function formatCoordinateX(value, fmt) {
    return formatFixedNumber(value, fmt.xNumDecPos, fmt.xNumIntPos, fmt.coordFormat);
}
function formatCoordinateY(value, fmt) {
    return formatFixedNumber(value, fmt.yNumDecPos, fmt.yNumIntPos, fmt.coordFormat);
}
class D01Command {
    constructor(cmd, fmt, lineNo) {
        this.lineNo = lineNo;
        this.name = "D01";
        this.isAdvanced = false;
        let match = D01Command.matchExp.exec(cmd);
        if (!match) {
            throw new primitives_1.GerberParseException(`Invalid D01 command: ${cmd}`);
        }
        if (match[2] != undefined) {
            this.x = parseCoordinateX(match[2], fmt);
        }
        else {
            this.x = undefined;
        }
        if (match[4] != undefined) {
            this.y = parseCoordinateY(match[4], fmt);
        }
        else {
            this.y = undefined;
        }
        if (match[6] != undefined) {
            this.i = parseCoordinateX(match[6], fmt);
        }
        else {
            this.i = undefined;
        }
        if (match[8] != undefined) {
            this.j = parseCoordinateY(match[8], fmt);
        }
        else {
            this.j = undefined;
        }
    }
    formatOutput(fmt) {
        let result = "";
        if (this.x != undefined) {
            result += "X" + formatCoordinateX(this.x, fmt);
        }
        if (this.y != undefined) {
            result += "Y" + formatCoordinateY(this.y, fmt);
        }
        if (this.i != undefined) {
            result += "I" + formatCoordinateX(this.i, fmt);
        }
        if (this.j != undefined) {
            result += "J" + formatCoordinateY(this.j, fmt);
        }
        result += "D01";
        return result;
    }
    execute(ctx) {
        if (ctx.interpolationMode == primitives_1.InterpolationMode.LINEARx1) {
            if (this.x == undefined && this.y == undefined) {
                // Empty D01 command
                return;
            }
            let startPointX = ctx.currentPointX;
            let startPointY = ctx.currentPointY;
            let endPointX;
            let endPointY;
            if (this.x != undefined) {
                endPointX = this.x;
                ctx.currentPointX = this.x;
            }
            else {
                endPointX = ctx.currentPointX;
            }
            if (this.y != undefined) {
                endPointY = this.y;
                ctx.currentPointY = this.y;
            }
            else {
                endPointY = ctx.currentPointY;
            }
            ctx.line(new point_1.Point(startPointX, startPointY), new point_1.Point(endPointX, endPointY), this);
        }
        else {
            if (this.x == undefined && this.y == undefined && this.i == undefined && this.j == undefined) {
                // Empty D01 command
                return;
            }
            let targetI;
            let targetJ;
            if (this.i != undefined) {
                targetI = this.i;
                ctx.currentI = this.i;
            }
            else {
                targetI = ctx.currentI;
            }
            if (this.j != undefined) {
                targetJ = this.j;
                ctx.currentJ = this.j;
            }
            else {
                targetJ = ctx.currentJ;
            }
            let startPointX = ctx.currentPointX;
            let startPointY = ctx.currentPointY;
            let endPointX;
            let endPointY;
            if (this.x != undefined) {
                endPointX = this.x;
                ctx.currentPointX = this.x;
            }
            else {
                endPointX = ctx.currentPointX;
            }
            if (this.y != undefined) {
                endPointY = this.y;
                ctx.currentPointY = this.y;
            }
            else {
                endPointY = ctx.currentPointY;
            }
            let radius = Math.sqrt(targetI * targetI + targetJ * targetJ);
            if (Math.abs(startPointX - endPointX) < primitives_1.Epsilon
                && Math.abs(startPointY - endPointY) < primitives_1.Epsilon) {
                if (ctx.quadrantMode == primitives_1.QuadrantMode.SINGLE) {
                    ctx.error("D01 zero length arc.");
                }
                else if (radius > primitives_1.Epsilon) {
                    let centerX = startPointX + targetI;
                    let centerY = startPointY + targetJ;
                    ctx.circle(new point_1.Point(centerX, centerY), radius, this);
                }
                else {
                    ctx.warning("D01 arc radius too small.");
                }
                return;
            }
            /*
                        let centerX:number;
                        let centerY:number;
                        if (ctx.quadrantMode == QuadrantMode.MULTI) {
                            centerX = startPointX + targetI;
                            centerY = startPointY + targetJ;
                        } else {
                            centerX = targetI;
                            centerY = targetJ;
                            let dx = endPointX - startPointX;
                            let dy = endPointY - startPointY;
                            if (dx >= 0 && dy >= 0) {
                                centerX = -centerX;
                            } else if (dx >= 0 && dy < 0) {
                                // nothing
                            } else if (dx < 0 && dy >= 0) {
                                centerX = -centerX;
                                centerY = -centerY;
                            } else {
                                centerY = -centerY;
                            }
                            if (ctx.interpolationMode == InterpolationMode.CLOCKWISE) {
                                centerX = -centerX;
                                centerY = -centerY;
                            }
                            centerX += startPointX;
                            centerY += startPointY;
                        }
                        ctx.arc(
                            new Point(centerX, centerY),
                            radius,
                            new Point(startPointX, startPointY),
                            new Point(endPointX, endPointY),
                            ctx.interpolationMode == InterpolationMode.COUNTER_CLOCKWISE);
            */
            let mid = { x: (startPointX + endPointX) / 2, y: (startPointY + endPointY) / 2 };
            let v = { x: (startPointX - endPointX), y: (startPointY - endPointY) };
            let v2 = { x: v.x / 2, y: v.y / 2 };
            let v2len = vectorUtils_1.vectorLength(v2);
            let d2 = radius * radius - v2len * v2len;
            // We consider everything in (-Epsilon, +Epsion) to be 0
            if (d2 < -primitives_1.Epsilon) {
                ctx.warning("D01 Invalid arc, radius too small");
            }
            // Fix values (-Epsion, 0) to be 0, so Math.sqrt does not complain.
            if (d2 < 0) {
                d2 = 0;
            }
            let d = Math.sqrt(d2);
            let pvCW = vectorUtils_1.unitVector({ x: -v.y, y: v.x });
            if (ctx.interpolationMode == primitives_1.InterpolationMode.CLOCKWISE) {
                let centerCW = vectorUtils_1.addVector(mid, vectorUtils_1.scaleVector(pvCW, d));
                let centerCCW = vectorUtils_1.addVector(mid, vectorUtils_1.scaleVector(pvCW, -d));
                let center;
                if (ctx.quadrantMode == primitives_1.QuadrantMode.MULTI) {
                    let ctr = { x: startPointX + targetI, y: startPointY + targetJ };
                    center = (vectorUtils_1.distanceVector2(ctr, centerCW) < vectorUtils_1.distanceVector2(ctr, centerCCW)) ? centerCW : centerCCW;
                }
                else {
                    center = centerCW;
                }
                ctx.arc(new point_1.Point(center.x, center.y), radius, new point_1.Point(startPointX, startPointY), new point_1.Point(endPointX, endPointY), false, this);
            }
            else {
                let centerCW = vectorUtils_1.addVector(mid, vectorUtils_1.scaleVector(pvCW, d));
                let centerCCW = vectorUtils_1.addVector(mid, vectorUtils_1.scaleVector(pvCW, -d));
                let center;
                if (ctx.quadrantMode == primitives_1.QuadrantMode.MULTI) {
                    let ctr = { x: startPointX + targetI, y: startPointY + targetJ };
                    center = (vectorUtils_1.distanceVector2(ctr, centerCW) < vectorUtils_1.distanceVector2(ctr, centerCCW)) ? centerCW : centerCCW;
                }
                else {
                    center = centerCCW;
                }
                ctx.arc(new point_1.Point(center.x, center.y), radius, new point_1.Point(startPointX, startPointY), new point_1.Point(endPointX, endPointY), true, this);
            }
            //
        }
    }
}
D01Command.matchExp = /^(X([\+\-]?\d+))?(Y([\+\-]?\d+))?(I([\+\-]?\d+))?(J([\+\-]?\d+))?(?:D[0]*1)?$/;
exports.D01Command = D01Command;
class D02Command {
    constructor(cmd, fmt, lineNo) {
        this.lineNo = lineNo;
        this.name = "D02";
        this.isAdvanced = false;
        let match = D02Command.matchExp.exec(cmd);
        if (!match) {
            throw new primitives_1.GerberParseException(`Invalid D02 command: ${cmd}`);
        }
        if (match[2] != undefined) {
            this.x = parseCoordinateX(match[2], fmt);
        }
        else {
            this.x = undefined;
        }
        if (match[4] != undefined) {
            this.y = parseCoordinateY(match[4], fmt);
        }
        else {
            this.y = undefined;
        }
    }
    formatOutput(fmt) {
        let result = "";
        if (this.x != undefined) {
            result += "X" + formatCoordinateX(this.x, fmt);
        }
        if (this.y != undefined) {
            result += "Y" + formatCoordinateY(this.y, fmt);
        }
        result += "D02";
        return result;
    }
    execute(ctx) {
        if (this.x != undefined) {
            ctx.currentPointX = this.x;
        }
        if (this.y != undefined) {
            ctx.currentPointY = this.y;
        }
        ctx.closeRegionContour();
    }
}
D02Command.matchExp = /^(X([\+\-]?\d+))?(Y([\+\-]?\d+))?(?:D[0]*2)?$/;
exports.D02Command = D02Command;
class D03Command {
    constructor(cmd, fmt, lineNo) {
        this.lineNo = lineNo;
        this.name = "D03";
        this.isAdvanced = false;
        let match = D03Command.matchExp.exec(cmd);
        if (!match) {
            throw new primitives_1.GerberParseException(`Invalid D03 command: ${cmd}`);
        }
        if (match[2] != undefined) {
            this.x = parseCoordinateX(match[2], fmt);
        }
        else {
            this.x = undefined;
        }
        if (match[4] != undefined) {
            this.y = parseCoordinateY(match[4], fmt);
        }
        else {
            this.y = undefined;
        }
    }
    formatOutput(fmt) {
        let result = "";
        if (this.x != undefined) {
            result += "X" + formatCoordinateX(this.x, fmt);
        }
        if (this.y != undefined) {
            result += "Y" + formatCoordinateY(this.y, fmt);
        }
        result += "D03";
        return result;
    }
    execute(ctx) {
        let targetX;
        let targetY;
        if (this.x != undefined) {
            targetX = this.x;
            ctx.currentPointX = this.x;
        }
        else {
            targetX = ctx.currentPointX;
        }
        if (this.y != undefined) {
            targetY = this.y;
            ctx.currentPointY = this.y;
        }
        else {
            targetY = ctx.currentPointY;
        }
        ctx.flash(new point_1.Point(targetX, targetY), this);
    }
}
D03Command.matchExp = /^(X([\+\-]?\d+))?(Y([\+\-]?\d+))?(?:D[0]*3)?$/;
exports.D03Command = D03Command;
class BaseGCodeCommand {
    constructor(cmd, cmdCode, lineNo) {
        this.lineNo = lineNo;
        this.isAdvanced = false;
        let match = BaseGCodeCommand.matchExp.exec(cmd);
        if (!match) {
            throw new primitives_1.GerberParseException(`Invalid G command format ${cmd}`);
        }
        this.codeId = Number.parseInt(match[1]);
        if (cmdCode != undefined && this.codeId != cmdCode) {
            throw new primitives_1.GerberParseException(`G code mismatch expected ${cmdCode} got ${this.codeId}`);
        }
    }
    formatOutput() {
        let result = "G";
        if (this.codeId < 10) {
            result += "0";
        }
        result += this.codeId;
        return result;
    }
}
BaseGCodeCommand.matchExp = /^G(\d+)$/;
exports.BaseGCodeCommand = BaseGCodeCommand;
class G01Command extends BaseGCodeCommand {
    constructor(cmd, lineNo) {
        super(cmd, 1, lineNo);
        this.name = "G01";
    }
    execute(ctx) {
        ctx.interpolationMode = primitives_1.InterpolationMode.LINEARx1;
    }
}
exports.G01Command = G01Command;
class G02Command extends BaseGCodeCommand {
    constructor(cmd, lineNo) {
        super(cmd, 2, lineNo);
        this.name = "G02";
    }
    execute(ctx) {
        ctx.interpolationMode = primitives_1.InterpolationMode.CLOCKWISE;
    }
}
exports.G02Command = G02Command;
class G03Command extends BaseGCodeCommand {
    constructor(cmd, lineNo) {
        super(cmd, 3, lineNo);
        this.name = "G03";
    }
    execute(ctx) {
        ctx.interpolationMode = primitives_1.InterpolationMode.COUNTER_CLOCKWISE;
    }
}
exports.G03Command = G03Command;
class G10Command extends BaseGCodeCommand {
    constructor(cmd, lineNo) {
        super(cmd, 10, lineNo);
        this.name = "G10";
    }
    execute(ctx) {
        ctx.interpolationMode = primitives_1.InterpolationMode.LINEARx10;
    }
}
exports.G10Command = G10Command;
class G11Command extends BaseGCodeCommand {
    constructor(cmd, lineNo) {
        super(cmd, 11, lineNo);
        this.name = "G11";
    }
    execute(ctx) {
        ctx.interpolationMode = primitives_1.InterpolationMode.LINEARx01;
    }
}
exports.G11Command = G11Command;
class G12Command extends BaseGCodeCommand {
    constructor(cmd, lineNo) {
        super(cmd, 12, lineNo);
        this.name = "G12";
    }
    execute(ctx) {
        ctx.interpolationMode = primitives_1.InterpolationMode.LINEARx001;
    }
}
exports.G12Command = G12Command;
class G74Command extends BaseGCodeCommand {
    constructor(cmd, lineNo) {
        super(cmd, 74, lineNo);
        this.name = "G74";
    }
    execute(ctx) {
        ctx.quadrantMode = primitives_1.QuadrantMode.SINGLE;
    }
}
exports.G74Command = G74Command;
class G75Command extends BaseGCodeCommand {
    constructor(cmd, lineNo) {
        super(cmd, 75, lineNo);
        this.name = "G75";
    }
    execute(ctx) {
        ctx.quadrantMode = primitives_1.QuadrantMode.MULTI;
    }
}
exports.G75Command = G75Command;
class G90Command extends BaseGCodeCommand {
    constructor(cmd, lineNo) {
        super(cmd, 90, lineNo);
        this.name = "G90";
    }
    execute(ctx) {
        ctx.coordinateMode = primitives_1.CoordinateMode.ABSOLUTE;
    }
}
exports.G90Command = G90Command;
class G91Command extends BaseGCodeCommand {
    constructor(cmd, lineNo) {
        super(cmd, 91, lineNo);
        this.name = "G91";
    }
    execute(ctx) {
        ctx.coordinateMode = primitives_1.CoordinateMode.RELATIVE;
    }
}
exports.G91Command = G91Command;
class G70Command extends BaseGCodeCommand {
    constructor(cmd, lineNo) {
        super(cmd, 70, lineNo);
        this.name = "G70";
    }
    execute(ctx) {
        ctx.coordinateUnits = primitives_1.CoordinateUnits.INCHES;
    }
}
exports.G70Command = G70Command;
class G71Command extends BaseGCodeCommand {
    constructor(cmd, lineNo) {
        super(cmd, 71, lineNo);
        this.name = "G71";
    }
    execute(ctx) {
        ctx.coordinateUnits = primitives_1.CoordinateUnits.MILIMETERS;
    }
}
exports.G71Command = G71Command;
class LPCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.name = "LP";
        this.isAdvanced = true;
        let match = LPCommand.matchExp.exec(cmd);
        if (!match) {
            throw new primitives_1.GerberParseException(`Invalid LP command format ${cmd}`);
        }
        this.polarity = (match[1] == "C") ? primitives_1.ObjectPolarity.LIGHT : primitives_1.ObjectPolarity.DARK;
    }
    formatOutput() {
        return "LP" + ((this.polarity == primitives_1.ObjectPolarity.LIGHT) ? "C" : "D") + "*";
    }
    execute(ctx) {
        ctx.objectPolarity = this.polarity;
    }
}
LPCommand.matchExp = /^LP(C|D)\*$/;
exports.LPCommand = LPCommand;
class LMCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.name = "LM";
        this.isAdvanced = true;
        let match = LMCommand.matchExp.exec(cmd);
        if (!match) {
            throw new primitives_1.GerberParseException(`Invalid LM command format ${cmd}`);
        }
        let code = match[1];
        if (code == "N") {
            this.miroring = primitives_1.ObjectMirroring.NONE;
        }
        else if (code == "X") {
            this.miroring = primitives_1.ObjectMirroring.X_AXIS;
        }
        else if (code == "Y") {
            this.miroring = primitives_1.ObjectMirroring.Y_AXIS;
        }
        else if (code == "XY") {
            this.miroring = primitives_1.ObjectMirroring.XY_AXIS;
        }
    }
    formatOutput() {
        let result = "LM";
        switch (this.miroring) {
            case primitives_1.ObjectMirroring.NONE:
                result += "N";
                break;
            case primitives_1.ObjectMirroring.X_AXIS:
                result += "X";
                break;
            case primitives_1.ObjectMirroring.Y_AXIS:
                result += "Y";
                break;
            case primitives_1.ObjectMirroring.XY_AXIS:
                result += "XY";
                break;
        }
        result += "*";
        return result;
    }
    execute(ctx) {
        ctx.objectMirroring = this.miroring;
    }
}
LMCommand.matchExp = /^LM(N|X|Y|XY)\*$/;
exports.LMCommand = LMCommand;
class LRCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.name = "LR";
        this.isAdvanced = true;
        let match = LRCommand.matchExp.exec(cmd);
        if (!match) {
            throw new primitives_1.GerberParseException(`Invalid LR command format ${cmd}`);
        }
        this.rotation = Number.parseFloat(match[1]);
    }
    formatOutput() {
        return "LR" + this.rotation + "*";
    }
    execute(ctx) {
        ctx.objectRotation = this.rotation;
    }
}
LRCommand.matchExp = /^LR([\+\-]?(?:\d*\.\d+|\d+))\*$/;
exports.LRCommand = LRCommand;
class LSCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.name = "LS";
        this.isAdvanced = true;
        let match = LSCommand.matchExp.exec(cmd);
        if (!match) {
            throw new primitives_1.GerberParseException(`Invalid LS command format ${cmd}`);
        }
        this.scale = Number.parseFloat(match[1]);
    }
    formatOutput() {
        return "LS" + this.scale + "*";
    }
    execute(ctx) {
        ctx.objectScaling = this.scale;
    }
}
LSCommand.matchExp = /^LS([\+\-]?(?:\d*\.\d+|\d+))\*$/;
exports.LSCommand = LSCommand;
class G36Command extends BaseGCodeCommand {
    constructor(cmd, lineNo) {
        super(cmd, 36, lineNo);
        this.name = "G36";
    }
    execute(ctx) {
        ctx.startRegion();
    }
}
exports.G36Command = G36Command;
class G37Command extends BaseGCodeCommand {
    constructor(cmd, lineNo) {
        super(cmd, 37, lineNo);
        this.name = "G37";
    }
    execute(ctx) {
        ctx.endRegion(this);
    }
}
exports.G37Command = G37Command;
class SRCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.name = "SR";
        this.isAdvanced = true;
        let match = SRCommand.matchExp.exec(cmd);
        if (!match) {
            throw new primitives_1.GerberParseException(`Invalid SR command: ${cmd}`);
        }
        if (match[1] != undefined) {
            this.x = Number.parseInt(match[1]);
            this.y = Number.parseInt(match[2]);
            this.i = Number.parseFloat(match[3]);
            this.j = Number.parseFloat(match[4]);
            if (this.x < 1 || this.y < 1) {
                throw new primitives_1.GerberParseException(`Invalid X or Y step ${this.x}, ${this.y}`);
            }
        }
    }
    formatOutput() {
        let result = "SR";
        if (this.x != undefined) {
            result += "X" + this.x.toString();
            result += "Y" + this.y.toString();
            result += "I" + this.i.toString();
            result += "J" + this.j.toString();
        }
        result += "*";
        return result;
    }
    execute(ctx) {
        if (this.x !== undefined) {
            ctx.tryEndRepeat(this);
            let params = new primitives_1.BlockParams(this.x, this.y, this.i, this.j);
            ctx.startRepeat(params);
        }
        else {
            ctx.endRepeat(this);
        }
    }
}
SRCommand.matchExp = /^SR(?:X(\d+)Y(\d+)I(\d*\.\d+|\d+)J(\d*\.\d+|\d+))?\*$/;
exports.SRCommand = SRCommand;
class M02Command {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.isAdvanced = false;
        this.name = "M02";
        let match = M02Command.matchExp.exec(cmd);
        if (!match) {
            throw new primitives_1.GerberParseException(`Invalid M02 command ${cmd}`);
        }
    }
    formatOutput() {
        return "M02";
    }
    execute(ctx) {
        ctx.endFile(this);
    }
}
M02Command.matchExp = /^M0*[20]$/;
exports.M02Command = M02Command;
class TCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.isAdvanced = true;
        let match = TCommand.matchExp.exec(cmd);
        if (!match) {
            throw new primitives_1.GerberParseException(`Invalid Tx command format ${cmd}`);
        }
        let cmdName = match[1];
        let attributeType;
        switch (cmdName) {
            case "A":
                attributeType = primitives_1.AttributeType.APERTURE;
                break;
            case "F":
                attributeType = primitives_1.AttributeType.FILE;
                break;
            case "O":
                attributeType = primitives_1.AttributeType.OBJECT;
                break;
            default: throw new primitives_1.GerberParseException(`Unknown attribute command ${cmd}`);
        }
        let attrinuteName = match[2];
        let fields;
        if (match[3]) {
            fields = match[3].substring(1).split(',');
        }
        else {
            fields = [];
        }
        this.attribute = new primitives_1.Attribute(attributeType, attrinuteName, fields);
    }
    get name() {
        switch (this.attribute.type) {
            case primitives_1.AttributeType.APERTURE: return "TA";
            case primitives_1.AttributeType.FILE: return "TF";
            case primitives_1.AttributeType.OBJECT: return "TO";
        }
        throw new Error(`Unsuported attribute type ${this.attribute.type}`);
    }
    formatOutput() {
        let result = this.name + this.attribute.name;
        for (let field of this.attribute.fields) {
            result += ",";
            result += field;
        }
        result += "*";
        return result;
    }
    execute(ctx) {
        //TODO(vne): implement attributes.
        //console.log("Tx command is not implemnted");
    }
}
TCommand.matchExp = /^T(A|F|O)([a-zA-Z_.$][a-zA-Z0-9_.$]*)((?:,[^,]+)*)\*$/;
exports.TCommand = TCommand;
class TDCommand {
    constructor(cmd, lineNo) {
        this.lineNo = lineNo;
        this.isAdvanced = true;
        this.name = "TD";
        let match = TDCommand.matchExp.exec(cmd);
        if (!match) {
            throw new primitives_1.GerberParseException(`Invalid TD command format ${cmd}`);
        }
        if (match[1]) {
            this.attributeName = match[1];
        }
        else {
            this.attributeName = "";
        }
    }
    formatOutput() {
        return "TD" + this.attributeName + "*";
    }
    execute(ctx) {
        //TODO(vne): implement attributes.
        //console.log("TD command is not implemnted");
    }
}
TDCommand.matchExp = /^TD([a-zA-Z_.$][a-zA-Z0-9_.$]*)?\*$/;
exports.TDCommand = TDCommand;
//# sourceMappingURL=commands.js.map