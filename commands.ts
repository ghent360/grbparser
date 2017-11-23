/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */

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

import {
    ApertureDefinition,
    ApertureMacro,
    CoordinateFormatSpec,
    FileUnits,
    GerberParseException,
    InterpolationMode,
    QuadrantMode,
    ObjectPolarity,
    ObjectMirroring,
    Primitive,
    PrimitiveComment,
    Attribute,
    AttributeType,
    VariableDefinition,
    GerberCommand,
    GerberState,
    Epsilon,
} from './primitives';
import {Point} from "./point";
import {
    vectorLength,
    scaleVector,
    unitVector,
    addVector
} from "./vectorUtils";
import {
    AritmeticOperation,
    ExpressionParser
} from "./expressions";

export class FSCommand implements GerberCommand {
    readonly name:string = "FS";
    readonly isAdvanced = true;
    readonly coordinateFormat:CoordinateFormatSpec;

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
        return "FSLAX" + this.coordinateFormat.xNumIntPos
            + this.coordinateFormat.xNumDecPos
            + "Y" + this.coordinateFormat.yNumIntPos
            + this.coordinateFormat.yNumDecPos
            + "*";
    }

    execute(ctx:GerberState) {
        ctx.coordinateFormatSpec = this.coordinateFormat;
    }
}

export class MOCommand implements GerberCommand {
    readonly name:string = "MO";
    readonly isAdvanced = true;
    readonly units:FileUnits;

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
        return "MO" + (this.units == FileUnits.MILIMETERS ? "MM" : "IN") + "*";
    }

    execute(ctx:GerberState) {
        ctx.fileUnits = this.units;
    }
}

export class ADCommand implements GerberCommand {
    readonly name:string = "AD";
    readonly isAdvanced = true;
    readonly definition:ApertureDefinition;
    private static matchExp = /^ADD(\d+)([a-zA-Z_.$][a-zA-Z0-9_.$]*)(,(?:[\+\-]?(?:\d*\.\d+|\d+)(?:X[\+\-]?(?:\d*\.\d+|\d+))*))?\*$/;

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
        let result = "ADD" + this.definition.apertureId + this.definition.templateName;
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
        result += "*";
        return result;
    }

    execute(ctx:GerberState) {
        this.definition.execute(ctx);
        ctx.setAperture(this.definition);
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
        if (this.definition.modifiers.length < 1 || this.definition.modifiers.length > 3) {
            throw new GerberParseException(`Invalid circle aperture ${this.formatOutput()}`);
        }
        if (this.definition.modifiers[0] < 0) {
            throw new GerberParseException(
                `Invalid circle aperture radius D${this.definition.apertureId}:`
                + ` ${this.definition.modifiers[0]}`);
        }
        if (this.definition.modifiers.length > 0
            && (this.definition.modifiers[1] <= 0
                || this.definition.modifiers[1] >= this.definition.modifiers[0])) {
            throw new GerberParseException(
                `Invalid circle aperture hole radius D${this.definition.apertureId}:`
                + ` ${this.definition.modifiers[1]}`);
        }
        if (this.definition.modifiers.length > 1
            && (this.definition.modifiers[2] <= 0
                || this.definition.modifiers[2] >= this.definition.modifiers[0])) {
            throw new GerberParseException(
                `Invalid circle aperture hole size D${this.definition.apertureId}:`
                + ` ${this.definition.modifiers[1]}`);
        }
    }

    private checlRectangleAperture() {
        if (this.definition.modifiers.length < 2 || this.definition.modifiers.length > 4) {
            throw new GerberParseException(`Invalid rectangle aperture ${this.formatOutput()}`);
        }
        if (this.definition.modifiers[0] <= 0 || this.definition.modifiers[1] <= 0) {
            throw new GerberParseException(
                `Invalid rectangle aperture size D${this.definition.apertureId}: `
                + `${this.definition.modifiers[0]}X${this.definition.modifiers[1]}`);
        }
        if (this.definition.modifiers.length > 2) {
            let radius = this.definition.modifiers[2];
            if (radius <= 0) {
                throw new GerberParseException(
                    `Invalid rectangle aperture hole radius D${this.definition.apertureId}: `
                    + `${this.definition.modifiers[2]}`);
            }
        }
        if (this.definition.modifiers.length > 3) {
            let height = this.definition.modifiers[4];
            if (height <= 0) {
                throw new GerberParseException(
                    `Invalid rectangle aperture hole height D${this.definition.apertureId}: `
                    + `${this.definition.modifiers[2]}`);
            }
        }
    }

    private checlObroundAperture() {
        if (this.definition.modifiers.length < 2 || this.definition.modifiers.length > 4) {
            throw new GerberParseException(`Invalid obround aperture ${this.formatOutput()}`);
        }
        if (this.definition.modifiers[0] <= 0 || this.definition.modifiers[1] <= 0) {
            throw new GerberParseException(
                `Invalid obround aperture size D${this.definition.apertureId}: `
                + `${this.definition.modifiers[0]}X${this.definition.modifiers[1]}`);
        }
        if (this.definition.modifiers.length > 2) {
            let radius = this.definition.modifiers[2];
            if (radius <= 0) {
                throw new GerberParseException(
                    `Invalid obround aperture hole radius D${this.definition.apertureId}: `
                    + `${this.definition.modifiers[2]}`);
            }
        }
        if (this.definition.modifiers.length > 3) {
            let height = this.definition.modifiers[3];
            if (height <= 0) {
                throw new GerberParseException(
                    `Invalid obround aperture hole height D${this.definition.apertureId}: `
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
    readonly isAdvanced = false;
    readonly comment:string;
    private static matchExp = /^G[0]*4(.*)$/;

    constructor(cmd:string) {
        let match = G04Command.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid G04 command ${cmd}`);
        }
        this.comment = match[1];
    }

    formatOutput():string {
        return "G04" + this.comment;
    }

    execute(ctx:GerberState) {
    }
}

export class AMCommand implements GerberCommand {
    readonly name:string = "AM";
    readonly isAdvanced = true;
    readonly macro:ApertureMacro;

    constructor(cmd:string) {
        let content = cmd.split("*");
        let name = content[0].substring(2);
        let macroContent:Array<VariableDefinition|Primitive|PrimitiveComment> = [];
        for (let idx = 1; idx < content.length - 1; idx++) {
            let part = content[idx];
            if (part[0] == "$") {
                let numEndIdx = skipIntCode(part, 1);
                let varId = Number.parseInt(part.substring(1, numEndIdx));
                if (part[numEndIdx] != "=") {
                    throw new GerberParseException(`Invalid variable definition ${part}`);
                }
                let parser = new ExpressionParser(part.substring(numEndIdx + 1));
                macroContent.push(new VariableDefinition(varId, parser.parse()));
            } else {
                if (part.startsWith("0 ")) {
                    macroContent.push(new PrimitiveComment(part.substr(2)));
                } else {
                    let primitiveParts = part.split(",");
                    let primitiveId = Number.parseInt(primitiveParts[0]);
                    primitiveParts.splice(0, 1);
                    macroContent.push(new Primitive(primitiveId, primitiveParts.map(part => {
                        let parser = new ExpressionParser(part);
                        return parser.parse();
                    })));
                }
            }
        }
        this.macro = new ApertureMacro(name, macroContent);
    }

    formatOutput():string {
        let result = "AM" + this.macro.macroName + "*";
        for (let part of this.macro.content) {
            result += "\n";
            if (part instanceof VariableDefinition) {
                let varDef = part as VariableDefinition;
                result += "$" + varDef.id + "=" + varDef.expression + "*";
            } else if (part instanceof PrimitiveComment) {
                let comment = part as PrimitiveComment;
                result += "0 " + comment.text + "*";
            } else {
                let primitive = part as Primitive;
                result += primitive.code;
                for (let modifier of primitive.modifiers) {
                    result += "," + modifier.toString();
                }
                result += "*";
            }
        }
        return result;
    }

    execute(ctx:GerberState) {
        ctx.setApertureMacro(this.macro);
    }
}

export class ABCommand implements GerberCommand {
    readonly name = "AB";
    readonly isAdvanced = true;
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
        let result = "AB";
        if (this.blockId > 0) {
            result += "D" + this.blockId;
        }
        result += "*";
        return result;
    }

    execute(ctx:GerberState) {
        console.log("AB commant not implemented");
    }
}

/**
 * This is the "set current aperture" command, not the D01, D02 or D03 command.
 */
export class DCommand implements GerberCommand {
    readonly name = "D";
    readonly isAdvanced = false;
    readonly apertureId:number;
    private static matchExp = /^(?:G54)?D(\d+)$/;

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
        return "D" + this.apertureId;
    }

    execute(ctx:GerberState) {
        ctx.getAperture(this.apertureId);
        ctx.currentAppretureId = this.apertureId;
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
    readonly isAdvanced = false;
    readonly x?:number;
    readonly y?:number;
    readonly i?:number;
    readonly j?:number;
    private static matchExp = /^(X([\+\-]?\d+))?(Y([\+\-]?\d+))?(I([\+\-]?\d+))?(J([\+\-]?\d+))?D[0]*1$/;

    constructor(cmd:string, fmt:CoordinateFormatSpec) {
        let match = D01Command.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid D01 command: ${cmd}`);
        }
        if (match[2] != undefined) {
            this.x = parseCoordinateX(match[2], fmt);
        } else {
            this.x = undefined;
        }
        if (match[4] != undefined) {
            this.y = parseCoordinateY(match[4], fmt);
        } else {
            this.y = undefined;
        }
        if (match[6] != undefined) {
            this.i = parseCoordinateX(match[6], fmt);
        } else {
            this.i = undefined;
        }
        if (match[8] != undefined) {
            this.j = parseCoordinateY(match[8], fmt);
        } else {
            this.j = undefined;
        }
    }

    formatOutput(fmt:CoordinateFormatSpec):string {
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

    execute(ctx:GerberState) {
        if (ctx.interpolationMode == InterpolationMode.LINEAR) {
            let startPointX = ctx.currentPointX;
            let startPointY = ctx.currentPointY;
            let endPointX:number;
            let endPointY:number;
            if (this.x != undefined) {
                endPointX = this.x;
                ctx.currentPointX = this.x;
            } else {
                endPointX = ctx.currentPointX;
            }

            if (this.y != undefined) {
                endPointY = this.y;
                ctx.currentPointY = this.y;
            } else {
                endPointY = ctx.currentPointY;
            }
            ctx.line(new Point(startPointX, startPointY),  new Point(endPointX, endPointY));
        } else {
            let targetI:number;
            let targetJ:number;
            if (this.i != undefined) {
                targetI = this.i;
                ctx.currentI = this.i;
            } else {
                targetI = ctx.currentI;
            }
            if (this.j != undefined) {
                targetJ = this.j;
                ctx.currentJ = this.j;
            } else {
                targetJ = ctx.currentJ;
            }
            let startPointX = ctx.currentPointX;
            let startPointY = ctx.currentPointY;
            let endPointX:number;
            let endPointY:number;

            if (this.x != undefined) {
                endPointX = this.x;
                ctx.currentPointX = this.x;
            } else {
                endPointX = ctx.currentPointX;
            }
            if (this.y != undefined) {
                endPointY = this.y;
                ctx.currentPointY = this.y;
            } else {
                endPointY = ctx.currentPointY;
            }
            let radius = Math.sqrt(targetI * targetI + targetJ * targetJ);
            if (Math.abs(startPointX - endPointX) < Epsilon
                && Math.abs(startPointY - endPointY) < Epsilon) {
                if (ctx.quadrantMode == QuadrantMode.SINGLE) {
                    ctx.error("D01 zero length arc.");
                } else {
                    let centerX = startPointX + targetI;
                    let centerY = startPointY + targetJ;
                    ctx.circle(new Point(centerX, centerY), radius);
                }
                return;
            }
            let mid = {x:(startPointX + endPointX) / 2, y:(startPointY + endPointY) / 2};
            let v = {x:(startPointX - endPointX), y:(startPointY - endPointY)};
            let v2 = {x:v.x / 2, y:v.y / 2};
            let v2len = vectorLength(v2);
            let d2 = radius * radius - v2len * v2len;
            if (d2 < 0) {
                ctx.error("D01 Invalid arc, radius too small");
                return;
            }
            let d = Math.sqrt(d2);
            let center: {x:number, y:number};
            if (ctx.interpolationMode == InterpolationMode.CLOCKWISE) {
                let pvCW = unitVector({ x:-v.y, y:v.x });
                center = addVector(mid, scaleVector(pvCW, d));
                ctx.arc(
                    new Point(center.x, center.y),
                    radius,
                    new Point(endPointX, endPointY),
                    new Point(startPointX, startPointY));
                } else {
                let pvCCW = unitVector({ x:v.y, y:-v.x });
                center = addVector(mid, scaleVector(pvCCW, d));
                ctx.arc(
                    new Point(center.x, center.y),
                    radius,
                    new Point(startPointX, startPointY),
                    new Point(endPointX, endPointY));
                }
        }
    }
}

export class D02Command implements GerberCommand {
    readonly name = "D02";
    readonly isAdvanced = false;
    readonly x?:number;
    readonly y?:number;
    private static matchExp = /^(X([\+\-]?\d+))?(Y([\+\-]?\d+))?D[0]*2$/;

    constructor(cmd:string, fmt:CoordinateFormatSpec) {
        let match = D02Command.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid D02 command: ${cmd}`);
        }
        if (match[2] != undefined) {
            this.x = parseCoordinateX(match[2], fmt);
        } else {
            this.x = undefined;
        }
        if (match[4] != undefined) {
            this.y = parseCoordinateY(match[4], fmt);
        } else {
            this.y = undefined;
        }
    }

    formatOutput(fmt:CoordinateFormatSpec):string {
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

    execute(ctx:GerberState) {
        if (this.x != undefined) {
            ctx.currentPointX = this.x;
        }
        if (this.y != undefined) {
            ctx.currentPointY = this.y;
        }
        ctx.close();
    }
}

export class D03Command implements GerberCommand {
    readonly name = "D03";
    readonly isAdvanced = false;
    readonly x?:number;
    readonly y?:number;
    private static matchExp = /^(X([\+\-]?\d+))?(Y([\+\-]?\d+))?D[0]*3$/;

    constructor(cmd:string, fmt:CoordinateFormatSpec) {
        let match = D03Command.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid D03 command: ${cmd}`);
        }
        if (match[2] != undefined) {
            this.x = parseCoordinateX(match[2], fmt);
        } else {
            this.x = undefined;
        }
        if (match[4] != undefined) {
            this.y = parseCoordinateY(match[4], fmt);
        } else {
            this.y = undefined;
        }
    }

    formatOutput(fmt:CoordinateFormatSpec):string {
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

    execute(ctx:GerberState) {
        let targetX:number;
        let targetY:number;

        if (this.x != undefined) {
            targetX = this.x;
            ctx.currentPointX = this.x;
        } else {
            targetX = ctx.currentPointX;
        }

        if (this.y != undefined) {
            targetY = this.y;
            ctx.currentPointY = this.y;
        } else {
            targetY = ctx.currentPointY;
        }
        ctx.flash(new Point(targetX, targetY));
    }
}

class BaseGCodeCommand {
    readonly codeId:number;
    readonly isAdvanced = false;
    private static matchExp = /^G(\d+)$/;

    constructor(cmd:string, cmdCode?:number) {
        let match = BaseGCodeCommand.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid G command format ${cmd}`);
        }
        this.codeId = Number.parseInt(match[1]);
        if (cmdCode != undefined && this.codeId != cmdCode) {
            throw new GerberParseException(
                `G code mismatch expected ${cmdCode} got ${this.codeId}`);
        }
    }

    formatOutput():string {
        let result = "G";
        if (this.codeId < 10) {
            result += "0";
        }
        result += this.codeId;
        return result;
    }
}

export class G01Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G01";
    constructor(cmd:string) {
        super(cmd, 1);
    }

    execute(ctx:GerberState) {
        ctx.interpolationMode = InterpolationMode.LINEAR;
    }
}

export class G02Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G02";
    constructor(cmd:string) {
        super(cmd, 2);
    }

    execute(ctx:GerberState) {
        ctx.interpolationMode = InterpolationMode.CLOCKWISE;
    }
}

export class G03Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G03";
    constructor(cmd:string) {
        super(cmd, 3);
    }

    execute(ctx:GerberState) {
        ctx.interpolationMode = InterpolationMode.COUNTER_CLOCKWISE;
    }
}

export class G74Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G74";
    constructor(cmd:string) {
        super(cmd, 74);
    }

    execute(ctx:GerberState) {
        ctx.quadrantMode = QuadrantMode.SINGLE;
    }
}

export class G75Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G75";
    constructor(cmd:string) {
        super(cmd, 75);
    }

    execute(ctx:GerberState) {
        ctx.quadrantMode = QuadrantMode.MULTI;
    }
}

export class LPCommand implements GerberCommand {
    readonly name = "LP";
    readonly isAdvanced = true;
    readonly polarity:ObjectPolarity;
    private static matchExp = /^LP(C|D)\*$/;

    constructor(cmd:string) {
        let match = LPCommand.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid LP command format ${cmd}`);
        }
        this.polarity = (match[1] == "C") ? ObjectPolarity.LIGHT : ObjectPolarity.DARK;
    }

    formatOutput():string {
        return "LP" + ((this.polarity == ObjectPolarity.LIGHT) ? "C" : "D") + "*";
    }

    execute(ctx:GerberState) {
        ctx.objectPolarity = this.polarity;
    }
}

export class LMCommand implements GerberCommand {
    readonly name = "LM";
    readonly isAdvanced = true;
    readonly miroring:ObjectMirroring;
    private static matchExp = /^LM(N|X|Y|XY)\*$/;

    constructor(cmd:string) {
        let match = LMCommand.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid LM command format ${cmd}`);
        }
        let code = match[1];
        if (code == "N") {
            this.miroring = ObjectMirroring.NONE;
        } else if (code == "X") {
            this.miroring = ObjectMirroring.X_AXIS;
        } else if (code == "Y") {
            this.miroring = ObjectMirroring.Y_AXIS;
        } else if (code == "XY") {
            this.miroring = ObjectMirroring.XY_AXIS;
        }
    }

    formatOutput():string {
        let result = "LM";
        switch (this.miroring) {
            case ObjectMirroring.NONE: result += "N";break;
            case ObjectMirroring.X_AXIS: result += "X";break;
            case ObjectMirroring.Y_AXIS: result += "Y";break;
            case ObjectMirroring.XY_AXIS: result += "XY";break;
        }
        result += "*";
        return result;
    }

    execute(ctx:GerberState) {
        ctx.objectMirroring = this.miroring;
    }
}

export class LRCommand implements GerberCommand {
    readonly name = "LR";
    readonly isAdvanced = true;
    readonly rotation:number;
    private static matchExp = /^LR([\+\-]?(?:\d*\.\d+|\d+))\*$/;

    constructor(cmd:string) {
        let match = LRCommand.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid LR command format ${cmd}`);
        }
        this.rotation = Number.parseFloat(match[1]);
    }

    formatOutput():string {
        return "LR" + this.rotation + "*";
    }

    execute(ctx:GerberState) {
        ctx.objectRotation = this.rotation;
    }
}

export class LSCommand implements GerberCommand {
    readonly name = "LS";
    readonly isAdvanced = true;
    readonly scale:number;
    private static matchExp = /^LS([\+\-]?(?:\d*\.\d+|\d+))\*$/;

    constructor(cmd:string) {
        let match = LSCommand.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid LS command format ${cmd}`);
        }
        this.scale = Number.parseFloat(match[1]);
    }

    formatOutput():string {
        return "LS" + this.scale + "*";
    }

    execute(ctx:GerberState) {
        ctx.objectScaling = this.scale;
    }
}

export class G36Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G36";
    constructor(cmd:string) {
        super(cmd, 36);
    }

    execute(ctx:GerberState) {
        ctx.startRegion();
    }
}

export class G37Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G37";
    constructor(cmd:string) {
        super(cmd, 37);
    }

    execute(ctx:GerberState) {
        ctx.endRegion();
    }
}

export class SRCommand implements GerberCommand {
    readonly name = "SR";
    readonly isAdvanced = true;
    readonly x?:number;
    readonly y?:number;
    readonly i?:number;
    readonly j?:number;
    private static matchExp = /^SR(?:X(\d+)Y(\d+)I(\d*\.\d+|\d+)J(\d*\.\d+|\d+))?\*$/;

    constructor(cmd:string) {
        let match = SRCommand.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid SR command: ${cmd}`);
        }
        if (match[1] != undefined) {
            this.x = Number.parseInt(match[1]);
            this.y = Number.parseInt(match[2]);
            this.i = Number.parseFloat(match[3]);
            this.j = Number.parseFloat(match[4]);

            if (this.x < 1 || this.y < 1) {
                throw new GerberParseException(`Invalid X or Y step ${this.x}, ${this.y}`);
            }
        }
    }

    formatOutput():string {
        let result = "SR";
        if (this.x != undefined) {
            result += "X" + this.x.toString();
            result += "Y" + this.y.toString();
            result += "I" + this.i.toPrecision();
            result += "J" + this.j.toPrecision();
        }
        result += "*";
        return result;
    }

    execute(ctx:GerberState) {
        console.log("SR command is not implemnted");
    }
}

export class M02Command implements GerberCommand {
    readonly isAdvanced = false;
    readonly name:string = "M02";

    constructor(cmd:string) {
        if (cmd != "M02") {
            throw new GerberParseException(`Invalid M02 command ${cmd}`);
        }
    }

    formatOutput():string {
        return "M02";
    }

    execute() {
    }
}

export class TCommand implements GerberCommand {
    readonly attribute:Attribute;
    readonly isAdvanced = true;
    private static matchExp = /^T(A|F|O)([a-zA-Z_.$][a-zA-Z0-9_.$]*)((?:,[^,]+)*)\*$/;
    
    constructor(cmd:string) {
        let match = TCommand.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid Tx command format ${cmd}`);
        }
        let cmdName = match[1];
        let attributeType:AttributeType;
        switch (cmdName) {
            case "A": attributeType = AttributeType.APERTURE; break;
            case "F": attributeType = AttributeType.FILE; break;
            case "O": attributeType = AttributeType.OBJECT; break;
            default: throw new GerberParseException(`Unknown attribute command ${cmd}`);
        }
        let attrinuteName = match[2];
        let fields:Array<string>;
        if (match[3]) {
            fields = match[3].substring(1).split(',');
        } else {
            fields = [];
        }
        this.attribute = new Attribute(attributeType, attrinuteName, fields);
    }

    get name():string {
        switch (this.attribute.type) {
            case AttributeType.APERTURE: return "TA";
            case AttributeType.FILE: return "TF";
            case AttributeType.OBJECT: return "TO";
        }
        throw new Error(`Unsuported attribute type ${this.attribute.type}`);
    }

    formatOutput():string {
        let result = this.name + this.attribute.name;
        for (let field of this.attribute.fields) {
            result += ",";
            result += field;
        }
        result += "*";
        return result;
    }

    execute(ctx:GerberState) {
        console.log("Tx command is not implemnted");
    }
}

export class TDCommand implements GerberCommand {
    readonly attributeName:string;
    readonly isAdvanced = true;
    readonly name = "TD";
    private static matchExp = /^TD([a-zA-Z_.$][a-zA-Z0-9_.$]*)\*$/;
    
    constructor(cmd:string) {
        let match = TDCommand.matchExp.exec(cmd);
        if (!match) {
            throw new GerberParseException(`Invalid TD command format ${cmd}`);
        }
        this.attributeName = match[1];
    }

    formatOutput():string {
        return "TD" + this.attributeName + "*";
    }

    execute(ctx:GerberState) {
        console.log("TD command is not implemnted");
    }
}
