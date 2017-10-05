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
 * 
 * We do add those to the output text however. For example ths text passed to the parser for
 * the MO command would be "MOIN*", but the formatted output would be "%MOIN*%".
 */

import {
    ApertureDefinition,
    ApertureMacro,
    CoordinateFormatSpec,
    FileUnits,
    GerberParseException,
    GerberState,
    InterpolationMode,
    Primitive,
    VariableDefinition,
} from './primitives';

interface GerberCommand {
    readonly name:string;
    formatOutput(state:GerberState):string;
}

export class FSCommand implements GerberCommand {
    readonly coordinateFormat:CoordinateFormatSpec;
    readonly name:string = "FS";

    constructor(cmd:string) {
        if (cmd.length < 10 || !cmd.startsWith("FSLAX") || cmd[7] != "Y") {
            throw new GerberParseException(`Unsuported FS command ${cmd}`);
        }
        let xNumIntPos = Number.parseInt(cmd.substr(5, 1));
        let xNumDecPos = Number.parseInt(cmd.substr(6, 1));
        let yNumIntPos = Number.parseInt(cmd.substr(8, 1));
        let yNumDecPos = Number.parseInt(cmd.substr(9, 1));
        this.coordinateFormat =
            new CoordinateFormatSpec(xNumIntPos, xNumDecPos, yNumIntPos, yNumDecPos);
    }

    formatOutput():string {
        return "%FSLAX" + this.coordinateFormat.xNumIntPos
            + this.coordinateFormat.xNumDecPos
            + "Y" + this.coordinateFormat.yNumIntPos
            + this.coordinateFormat.yNumDecPos
            + "*%";
    }
}

export class MOCommand implements GerberCommand {
    readonly units:FileUnits;
    readonly name:string = "MO";

    constructor(cmd:string) {
        let mode = cmd.substr(2, 2);
        if (mode === "MM") {
            this.units = FileUnits.MILIMETERS;
        } else if (mode = "IN") {
            this.units = FileUnits.INCHES;
        } else {
            throw new GerberParseException(`Invalid file units command ${cmd}`);
        }
    }

    formatOutput():string {
        return "%MO" + (this.units == FileUnits.MILIMETERS ? "MM" : "IN") + "*%";
    }
}

export class ADCommand implements GerberCommand {
    readonly name:string = "AD";
    readonly definition:ApertureDefinition;
    private static matchExp = /^ADD(\d+)([a-zA-Z_.$][a-zA-Z0-9_.$]*)(,(?:[+-]?(?:\d+|\d*.\d+)(?:X[+-]?(?:\d+|\d*.\d+))*))?\*$/;
    constructor(cmd:string) {
        let match = ADCommand.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid aperture AD command ${cmd}`);
        }
        let apertureId = Number.parseInt(match[1]);
        if (apertureId < 10) {
            throw new GerberParseException(`Invalid aperture ID ${apertureId}`);
        }
        let templateName = match[2];
        let modifiers:number[] = [];
        let modifiersTxt = match[3];
        if (modifiersTxt != undefined) {
            let modifierStrStart = 1;
            while (modifierStrStart < modifiersTxt.length) {
                let xIdx = modifiersTxt.indexOf('X', modifierStrStart);
                if (xIdx < 0) {
                    xIdx = modifiersTxt.length;
                }
                let valueStr = modifiersTxt.substring(modifierStrStart, xIdx);
                modifiers.push(Number.parseFloat(valueStr));
                modifierStrStart = xIdx + 1;
            }
            }
        this.definition = new ApertureDefinition(apertureId, templateName, modifiers);
        this.checkStandardApertures();
    }

    formatOutput():string {
        let result = "%ADD" + this.definition.apertureId + this.definition.templateName;
        let first = true;
        for (let m of this.definition.modifiers) {
            if (first) {
                first = false;
                result += ",";
            } else {
                result += "X";
            }
            result += m.toPrecision();
        }
        result += "*%";
        return result;
    }

    private checkStandardApertures() {
        if (this.definition.templateName === "C") {
            this.checlCircleAperture();
        } else if (this.definition.templateName === "R") {
            this.checlRectangleAperture();
        } else if (this.definition.templateName === "O") {
            this.checlObroundAperture();
        }
    }

    private checlCircleAperture() {
        if (this.definition.modifiers.length < 1 || this.definition.modifiers.length > 2) {
            throw new GerberParseException(`Invalid circle aperture ${this.formatOutput()}`);
        }
        if (this.definition.modifiers[0] < 0) {
            throw new GerberParseException(
                `Invalid circle aperture radius D${this.definition.apertureId}:`
                + ` ${this.definition.modifiers[0]}`);
        }
        if (this.definition.modifiers.length > 1
            && (this.definition.modifiers[1] <= 0
                || this.definition.modifiers[1] >= this.definition.modifiers[0])) {
            throw new GerberParseException(
                `Invalid circle aperture hole radius D${this.definition.apertureId}:`
                + ` ${this.definition.modifiers[1]}`);
        }
    }

    private checlRectangleAperture() {
        if (this.definition.modifiers.length < 2 || this.definition.modifiers.length > 3) {
            throw new GerberParseException(`Invalid rectangle aperture ${this.formatOutput()}`);
        }
        if (this.definition.modifiers[0] <= 0 || this.definition.modifiers[1] <= 0) {
            throw new GerberParseException(
                `Invalid rectangle aperture size D${this.definition.apertureId}: `
                + `${this.definition.modifiers[0]}X${this.definition.modifiers[1]}`);
        }
        if (this.definition.modifiers.length > 2) {
            let radius = this.definition.modifiers[2];
            if (radius <= 0
                || radius >= Math.min(this.definition.modifiers[0], this.definition.modifiers[1])) {
                throw new GerberParseException(
                    `Invalid rectangle aperture hole radius D${this.definition.apertureId}: `
                    + `${this.definition.modifiers[2]}`);
            }
        }
    }

    private checlObroundAperture() {
        if (this.definition.modifiers.length < 2 || this.definition.modifiers.length > 3) {
            throw new GerberParseException(`Invalid obround aperture ${this.formatOutput()}`);
        }
        if (this.definition.modifiers[0] <= 0 || this.definition.modifiers[1] <= 0) {
            throw new GerberParseException(
                `Invalid obround aperture size D${this.definition.apertureId}: `
                + `${this.definition.modifiers[0]}X${this.definition.modifiers[1]}`);
        }
        if (this.definition.modifiers.length > 2) {
            let radius = this.definition.modifiers[2];
            if (radius <= 0
                || radius >= Math.min(this.definition.modifiers[0], this.definition.modifiers[1])) {
                throw new GerberParseException(
                    `Invalid obround aperture hole radius D${this.definition.apertureId}: `
                    + `${this.definition.modifiers[2]}`);
            }
        }
    }

    private checlPolygonAperture() {
        if (this.definition.modifiers.length < 2 || this.definition.modifiers.length > 4) {
            throw new GerberParseException(`Invalid polygon aperture ${this.formatOutput()}`);
        }
        if (this.definition.modifiers[0] <= 0) {
            throw new GerberParseException(
                `Invalid polygon aperture radius D${this.definition.apertureId}: `
                + `${this.definition.modifiers[0]}`);
        }
        if (this.definition.modifiers[1] < 3
            || this.definition.modifiers[1] > 12
            || Math.floor(this.definition.modifiers[1]) != this.definition.modifiers[1]) {
            throw new GerberParseException(
                `Invalid polygon aperture number of vertices D${this.definition.apertureId}: `
                + `${this.definition.modifiers[1]}`);
        }
        if (this.definition.modifiers.length > 3) {
            let radius = this.definition.modifiers[3];
            if (radius <= 0 || radius >= this.definition.modifiers[0]) {
                throw new GerberParseException(
                    `Invalid polygon aperture hole radius D${this.definition.apertureId}: `
                    + `${this.definition.modifiers[3]}`);
            }
        }
    }
}

function skipIntCode(cmd:string, start:number = 1):number {
    for (let startIdx = start; startIdx < cmd.length; startIdx++) {
        let charAt = cmd.charAt(startIdx);
        if (charAt < '0' || charAt > '9') {
            return startIdx;
        }
    }
    return cmd.length;
}

export class G04Command implements GerberCommand {
    readonly name:string = "G04";
    readonly comment:string;
    private static matchExp = /^G[0]*4(.*)\*$/;

    constructor(cmd:string) {
        let match = G04Command.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid G04 command ${cmd}`);
        }
        this.comment = match[1];
    }

    formatOutput():string {
        return "G04" + this.comment + "*";
    }
}

export class AMCommand implements GerberCommand {
    readonly name:string = "AM";
    readonly macro:ApertureMacro;

    constructor(cmd:string) {
        let content = cmd.split("*");
        let name = content[0].substring(2);
        let macroContent:Array<VariableDefinition|Primitive> = [];
        for (let idx = 1; idx < content.length - 1; idx++) {
            let part = content[idx];
            if (part[0] == "$") {
                let numEndIdx = skipIntCode(part, 1);
                let varId = Number.parseInt(part.substring(1, numEndIdx));
                if (part[numEndIdx] != "=") {
                    throw new GerberParseException(`Invalid variable definition ${part}`);
                }
                macroContent.push(new VariableDefinition(varId, part.substring(numEndIdx + 1)));
            } else {
                if (part.startsWith("0 ")) {
                    macroContent.push(new Primitive(0, [part.substr(2)]));
                } else {
                    let primitiveParts = part.split(",");
                    let primitiveId = Number.parseInt(primitiveParts[0]);
                    primitiveParts.splice(0, 1);
                    macroContent.push(new Primitive(primitiveId, primitiveParts));
                }
            }
        }
        this.macro = new ApertureMacro(name, macroContent);
    }

    formatOutput():string {
        let result = "%AM" + this.macro.macroName + "*";
        for (let part of this.macro.content) {
            result += "\n";
            if (part instanceof VariableDefinition) {
                let varDef = part as VariableDefinition;
                result += "$" + varDef.id + "=" + varDef.expression + "*";
            } else {
                let primitive = part as Primitive;
                if (primitive.code == 0) {
                    result += "0 " + primitive.modifiers[0] + "*";
                } else {
                    result += primitive.code;
                    for (let modifier of primitive.modifiers) {
                        result += "," + modifier;
                    }
                    result += "*";
                }
            }
        }
        result += "%";
        return result;
    }
}

export class ABCommand implements GerberCommand {
    readonly name = "AB";
    readonly blockId:number;
    private static matchExp = /^AB(?:D(\d+))?\*$/;

    constructor(cmd:string) {
        let match = ABCommand.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid AB command format ${cmd}`);
        }
        if (match[1] == undefined) {
            this.blockId = -1;
        } else {
            this.blockId = Number.parseInt(match[1]);
            if (this.blockId < 10) {
                throw new GerberParseException(`Invalid AB command format ${cmd}`);
            }
        }
    }

    formatOutput():string {
        let result = "%AB";
        if (this.blockId > 0) {
            result += "D" + this.blockId;
        }
        result += "*%";
        return result;
    }
}

/**
 * This is the "set current aperture" command, not the D01, D02 or D03 command.
 */
export class DCommand implements GerberCommand {
    readonly name = "D";
    readonly apertureId:number;
    private static matchExp = /^D(\d+)\*$/;

    constructor(cmd:string) {
        let match = DCommand.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid D command format ${cmd}`);
        }
        this.apertureId = Number.parseInt(match[1]);
        if (this.apertureId < 10) {
            throw new GerberParseException(`Invalid D command format ${cmd}`);
        }
    }

    formatOutput():string {
        return "D" + this.apertureId + "*";
    }
}

function parseCoordinateX(coordinate:string, fmt:CoordinateFormatSpec):number {
    let num = Number.parseFloat(coordinate);
    return num * fmt.xPow;
}

function parseCoordinateY(coordinate:string, fmt:CoordinateFormatSpec):number {
    let num = Number.parseFloat(coordinate);
    return num * fmt.yPow;
}

function formatFixedNumber(value:number, precision:number):string {
    let intValue = Math.round(value * Math.pow(10, precision));
    return intValue.toString();
}

function formatCoordinateX(value:number, fmt:CoordinateFormatSpec):string {
    return formatFixedNumber(value, fmt.xNumDecPos);
}

function formatCoordinateY(value:number, fmt:CoordinateFormatSpec):string {
    return formatFixedNumber(value, fmt.yNumDecPos);
}

export class D01Command implements GerberCommand {
    readonly name = "D01";
    readonly x?:number;
    readonly y?:number;
    readonly i?:number;
    readonly j?:number;
    readonly targetX:number;
    readonly targetY:number;
    private static matchExp = /^(X([+-]?\d+))?(Y([+-]?\d+))?(I([+-]?\d+))?(J([+-]?\d+))?D[0]*1\*$/;

    constructor(cmd:string, state:GerberState) {
        let match = D01Command.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid D01 command: ${cmd}`);
        }
        if (match[2] != undefined) {
            this.x = parseCoordinateX(match[2], state.coordinateFormatSpec);
            this.targetX = this.x;
        } else {
            this.targetX = state.currentPointX;
        }
        if (match[4] != undefined) {
            this.y = parseCoordinateY(match[4], state.coordinateFormatSpec);
            this.targetY = this.y;
        } else {
            this.targetY = state.currentPointY;
        }
        if (state.interpolationMode != InterpolationMode.LINEAR) {
            if (match[6] == undefined || match[8] == undefined) {
                throw new GerberParseException(
                    "Invalid D01 command (missing I and/or J "
                    + `values in circular interpolation mode): ${cmd}`);
            }
            this.i = parseCoordinateX(match[6], state.coordinateFormatSpec);
            this.j = parseCoordinateY(match[8], state.coordinateFormatSpec);
        } else {
            if (match[6] != undefined || match[8] != undefined) {
                throw new GerberParseException(
                    "Invalid D01 command (present I and/or J "
                    + `values in linear interpolation mode): ${cmd}`);
            }
        }
    }

    formatOutput(state:GerberState):string {
        let result = "";
        if (this.x != undefined) {
            result += "X" + formatCoordinateX(this.x, state.coordinateFormatSpec);
        }
        if (this.y != undefined) {
            result += "Y" + formatCoordinateY(this.y, state.coordinateFormatSpec);
        }
        if (this.i != undefined) {
            result += "I" + formatCoordinateX(this.i, state.coordinateFormatSpec);
        }
        if (this.j != undefined) {
            result += "J" + formatCoordinateY(this.j, state.coordinateFormatSpec);
        }
        result += "D01*";
        return result;
    }
}

export class D02Command implements GerberCommand {
    readonly name = "D02";
    readonly x?:number;
    readonly y?:number;
    readonly targetX:number;
    readonly targetY:number;
    private static matchExp = /^(X([+-]?\d+))?(Y([+-]?\d+))?D[0]*2\*$/;

    constructor(cmd:string, state:GerberState) {
        let match = D02Command.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid D02 command: ${cmd}`);
        }
        if (match[2] != undefined) {
            this.x = parseCoordinateX(match[2], state.coordinateFormatSpec);
            this.targetX = this.x;
            state.currentPointX = this.x;
        } else {
            this.targetX = state.currentPointX;
        }
        if (match[4] != undefined) {
            this.y = parseCoordinateY(match[4], state.coordinateFormatSpec);
            this.targetY = this.y;
            state.currentPointY = this.y;
        } else {
            this.targetY = state.currentPointY;
        }
    }

    formatOutput(state:GerberState):string {
        let result = "";
        if (this.x != undefined) {
            result += "X" + formatCoordinateX(this.x, state.coordinateFormatSpec);
        }
        if (this.y != undefined) {
            result += "Y" + formatCoordinateY(this.y, state.coordinateFormatSpec);
        }
        result += "D02*";
        return result;
    }
}

export class D03Command implements GerberCommand {
    readonly name = "D03";
    readonly x?:number;
    readonly y?:number;
    readonly targetX:number;
    readonly targetY:number;
    private static matchExp = /^(X([+-]?\d+))?(Y([+-]?\d+))?D[0]*3\*$/;

    constructor(cmd:string, state:GerberState) {
        let match = D03Command.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid D03 command: ${cmd}`);
        }
        if (match[2] != undefined) {
            this.x = parseCoordinateX(match[2], state.coordinateFormatSpec);
            this.targetX = this.x;
        } else {
            this.targetX = state.currentPointX;
        }
        if (match[4] != undefined) {
            this.y = parseCoordinateY(match[4], state.coordinateFormatSpec);
            this.targetY = this.y;
        } else {
            this.targetY = state.currentPointY;
        }
    }

    formatOutput(state:GerberState):string {
        let result = "";
        if (this.x != undefined) {
            result += "X" + formatCoordinateX(this.x, state.coordinateFormatSpec);
        }
        if (this.y != undefined) {
            result += "Y" + formatCoordinateY(this.y, state.coordinateFormatSpec);
        }
        result += "D03*";
        return result;
    }
}
