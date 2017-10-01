import {CoordinateFormatSpec,
        GerberParseException,
        FileUnits,
        ApertureDefinition} from "./primitives";

interface GerberCommand {
    readonly name:string;
    formatOutput():string;
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

    constructor(cmd:string) {
        let endId = skipIntCode(cmd, 4);
        let idStr = cmd.substring(3, endId);
        let apertureId = Number.parseInt(idStr);
        if (apertureId < 10) {
            throw new GerberParseException(`Invalid aperture ID ${apertureId}`);
        }
        let commaIdx = cmd.indexOf(",");
        if (commaIdx < 0) {
            commaIdx = cmd.length - 1;
        }
        let templateName = cmd.substring(endId, commaIdx);
        let modifiers:number[] = [];
        let modifierStrStart = commaIdx + 1;
        while (modifierStrStart < cmd.length - 1) {
            let xIdx = cmd.indexOf('X', modifierStrStart);
            if (xIdx < 0) {
                xIdx = cmd.length - 1;
            }
            let valueStr = cmd.substring(modifierStrStart, xIdx);
            modifiers.push(Number.parseFloat(valueStr));
            modifierStrStart = xIdx + 1;
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

    constructor(cmd:string) {
        let startIdx = skipIntCode(cmd);
        this.comment = cmd.substr(startIdx, cmd.length - startIdx);
    }

    formatOutput():string {
        return "G04" + this.comment + "*";
    }
}
