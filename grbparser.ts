
export class CommandParser {
    public lineNumber = 1;
    private nextTokenSeparator = '*';
    private leftoverBuffer = "";
    private consumerStack:Array<(cmd:string, line:number) => void> = [];
    private commandLineStart:number;
    private command = "";
    private errorHandler:(line:number, buffer:string, idx:number) => void = CommandParser.error;

    parseBlock(block:string) {
        let buffer = this.leftoverBuffer + block;
        let idx:number;
        this.leftoverBuffer = "";
        for(idx = 0; idx < buffer.length; idx++) {
            let nextChar = buffer[idx];
            if (nextChar == '\n') {
                this.lineNumber++;
                continue;
            } else if (nextChar == '\r') {
                continue;
            } else if (nextChar == '\\') {
                if (buffer.length - idx < 6) {
                    this.leftoverBuffer = buffer.substring(idx);
                    break;
                }
                if (buffer[idx + 1] != 'u') {
                    this.errorHandler(this.lineNumber, buffer, idx);
                    idx++;
                    continue;
                }
                let hexCode = buffer.substring(idx + 2, idx + 6);
                let unicodeChar = String.fromCharCode(Number.parseInt(hexCode, 16));
                this.append(unicodeChar);
                idx += 5;
                continue;
            } else if (nextChar == this.nextTokenSeparator) {
                //console.log(`cmd: ${this.command}`);
                this.consumerStack[this.consumerStack.length - 1](
                    this.command, this.commandLineStart);
                this.command = "";
                this.nextTokenSeparator = '*';
                continue;
            } else if (nextChar == '%') {
                if (this.command.trim().length != 0) {
                    console.log(`Error, what to do with '${this.command}?'`);
                }
                this.command = "";
                this.nextTokenSeparator = '%';
            } else {
                this.append(nextChar);
            }
        }
    }

    private append(chr:string) {
        if (this.command.length == 0) {
            this.commandLineStart = this.lineNumber;
        }
        this.command += chr;
    }

    private static error(lineNumber:number, buffer:string, idx:number) {
        console.log(`Error at line ${lineNumber}`);
        console.log(`   ${buffer}`);
        console.log(`---${'-'.repeat(idx + 1)}^`);
    }

    pushConsumer(consumer:(cmd:string, lineNo:number) => void) {
        this.consumerStack.push(consumer);
    }

    popConsumer() {
        this.consumerStack.pop();
    }

    setErrorHandler(handler:(lineNumber:number, buffer:string, idx:number)=>void)
        : (lineNumber:number, buffer:string, idx:number)=>void {
        let old = this.errorHandler;
        this.errorHandler = handler;
        return old;
    }
}

export enum FileUnits {
    INCHES,
    MILIMETERS
}

export enum InterpolationMode {
    LINEAR,
    CLOCKWISE,
    COUNTER_CLOCKWISE
}

export enum QuadrantMode {
    SINGLE,
    MULTI
}

export enum ObjectPolarity {
    DARK,
    LIGHT
}

export enum ObjectMirroring {
    NONE,
    X_AXIS,
    Y_AXIS,
    XY_AXIS
}

export class CoordinateFormatSpec {
    constructor(
        readonly xNumIntPos:number,
        readonly xNumDecPos:number,
        readonly yNumIntPos:number,
        readonly yNumDecPos:number) {
    }
}

export class Point {
    public x:number;
    public y:number;
}

class GerberParseException {
    constructor(readonly message:string, readonly line?:number) {
    }
}

class Block {
}

class GerberState {
    private coordinateFormat_:CoordinateFormatSpec = undefined;
    private fileUnits_:FileUnits = undefined;
    private currentPoint_:Point = undefined;
    private currentAppretureId_:number = undefined;
    private interpolationMode_:InterpolationMode = undefined;
    private quadrantMode_:QuadrantMode = undefined;
    public objectPolarity:ObjectPolarity = ObjectPolarity.DARK;
    public objectMirroring:ObjectMirroring = ObjectMirroring.NONE;
    public objectRotation:number = 0;
    public objectScaling:number = 1.0;
    private lineNo:number;

    get coordinateFormatSpec():CoordinateFormatSpec {
        if (this.coordinateFormat_ == undefined) {
            this.error("File coordinate format is not set.");
        }
        return this.coordinateFormat_;
    }

    set coordinateFormatSpec(value:CoordinateFormatSpec) {
        if (this.coordinateFormat_ != undefined) {
            this.error("File coordinate format already set.");
        }
        this.coordinateFormat_ = value;        
    }

    get fileUnits():FileUnits {
        if (this.fileUnits_ == undefined) {
            this.error("File units are not set.");
        }
        return this.fileUnits_;
    }

    set fileUnits(value:FileUnits) {
        if (this.fileUnits_ != undefined) {
            this.error("File units already set.");
        }
        this.fileUnits_ = value;        
    }

    get currentPoint():Point {
        if (this.currentPoint_ == undefined) {
            this.error("Current point is not set.");
        }
        return this.currentPoint_;
    }

    set currentPoint(value:Point) {
        this.currentPoint_ = value;        
    }

    get currentAppretureId():number {
        if (this.currentAppretureId_ == undefined) {
            this.error("Current appreture is not set.");
        }
        return this.currentAppretureId_;
    }

    set currentAppretureId(value:number) {
        this.currentAppretureId_ = value;        
    }

    get interpolationMode():InterpolationMode {
        if (this.interpolationMode_ == undefined) {
            this.error("Current interpolation mode is not set.");
        }
        return this.interpolationMode_;
    }

    set interpolationMode(value:InterpolationMode) {
        this.interpolationMode_ = value;        
    }

    get quadrantMode():QuadrantMode {
        if (this.quadrantMode_ == undefined) {
            this.error("Current quadrant mode is not set.");
        }
        return this.quadrantMode_;
    }

    set quadrantMode(value:QuadrantMode) {
        this.quadrantMode_ = value;        
    }

    setLineNo(lineNo:number) {
        this.lineNo = lineNo;
    }

    private error(message:string) {
        console.log(`Error parsing gerber file ${message}`);
    }
}

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
        this.coordinateFormat = new CoordinateFormatSpec(xNumIntPos, xNumDecPos, yNumIntPos, yNumDecPos);
    }

    formatOutput():string {
        return "%FSLAX" + this.coordinateFormat.xNumIntPos + this.coordinateFormat.xNumDecPos
            + "Y" + this.coordinateFormat.yNumIntPos + this.coordinateFormat.yNumDecPos
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
    readonly apertureId:number;
    readonly templateName:string;
    readonly modifiers:number[];

    constructor(cmd:string) {
        let endId = skipIntCode(cmd, 4);
        let idStr = cmd.substring(3, endId);
        this.apertureId = Number.parseInt(idStr);
        if (this.apertureId < 10) {
            throw new GerberParseException(`Invalid aperture ID ${this.apertureId}`);
        }
        let commaIdx = cmd.indexOf(",");
        if (commaIdx < 0) {
            commaIdx = cmd.length - 1;
        }
        this.templateName = cmd.substring(endId, commaIdx);
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
        this.modifiers = modifiers;
        this.checkStandardApertures();
    }

    formatOutput():string {
        let result = "%ADD" + this.apertureId + this.templateName;
        let first = true;
        for (let m of this.modifiers) {
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
        if (this.templateName === "C") {
            this.checlCircleAperture();
        } else if (this.templateName === "R") {
            this.checlRectangleAperture();
        } else if (this.templateName === "O") {
            this.checlObroundAperture();
        }
    }

    private checlCircleAperture() {
        if (this.modifiers.length < 1 || this.modifiers.length > 2) {
            throw new GerberParseException(`Invalid circle aperture ${this.formatOutput()}`);
        }
        if (this.modifiers[0] < 0) {
            throw new GerberParseException(
                `Invalid circle aperture radius D${this.apertureId}: ${this.modifiers[0]}`);
        }
        if (this.modifiers.length > 1
            && (this.modifiers[1] <= 0 || this.modifiers[1] >= this.modifiers[0])) {
            throw new GerberParseException(
                `Invalid circle aperture hole radius D${this.apertureId}: ${this.modifiers[1]}`);
        }
    }

    private checlRectangleAperture() {
        if (this.modifiers.length < 2 || this.modifiers.length > 3) {
            throw new GerberParseException(`Invalid rectangle aperture ${this.formatOutput()}`);
        }
        if (this.modifiers[0] <= 0 || this.modifiers[1] <= 0) {
            throw new GerberParseException(
                `Invalid rectangle aperture size D${this.apertureId}: ${this.modifiers[0]}X${this.modifiers[1]}`);
        }
        if (this.modifiers.length > 2) {
            let radius = this.modifiers[2];
            if (radius <= 0 || radius >= Math.min(this.modifiers[0], this.modifiers[1])) {
                throw new GerberParseException(
                    `Invalid rectangle aperture hole radius D${this.apertureId}: ${this.modifiers[2]}`);
            }
        }
    }

    private checlObroundAperture() {
        if (this.modifiers.length < 2 || this.modifiers.length > 3) {
            throw new GerberParseException(`Invalid obround aperture ${this.formatOutput()}`);
        }
        if (this.modifiers[0] <= 0 || this.modifiers[1] <= 0) {
            throw new GerberParseException(
                `Invalid obround aperture size D${this.apertureId}: ${this.modifiers[0]}X${this.modifiers[1]}`);
        }
        if (this.modifiers.length > 2) {
            let radius = this.modifiers[2];
            if (radius <= 0 || radius >= Math.min(this.modifiers[0], this.modifiers[1])) {
                throw new GerberParseException(
                    `Invalid obround aperture hole radius D${this.apertureId}: ${this.modifiers[2]}`);
            }
        }
    }

    private checlPolygonAperture() {
        if (this.modifiers.length < 2 || this.modifiers.length > 4) {
            throw new GerberParseException(`Invalid polygon aperture ${this.formatOutput()}`);
        }
        if (this.modifiers[0] <= 0) {
            throw new GerberParseException(
                `Invalid polygon aperture radius D${this.apertureId}: ${this.modifiers[0]}`);
        }
        if (this.modifiers[1] < 3 || this.modifiers[1] > 12 || Math.floor(this.modifiers[1]) != this.modifiers[1]) {
            throw new GerberParseException(
                `Invalid polygon aperture number of vertices D${this.apertureId}: ${this.modifiers[1]}`);
        }
        if (this.modifiers.length > 3) {
            let radius = this.modifiers[3];
            if (radius <= 0 || radius >= this.modifiers[0]) {
                throw new GerberParseException(
                    `Invalid polygon aperture hole radius D${this.apertureId}: ${this.modifiers[3]}`);
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

export class GerberParser {
    private commandParser:CommandParser = new CommandParser();
    private state:GerberState = new GerberState();

    constructor() {
        this.commandParser.pushConsumer((cmd:string, lineNo:number) => this.parseCommand(cmd, lineNo));
    }

    parseBlock(block:string) {
        this.commandParser.parseBlock(block);
    }

    private parseCommand(cmd:string, lineNo:number) {
        this.state.setLineNo(lineNo);
    }
}