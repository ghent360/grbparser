/**
 * This file contains some classes that abstract primitives in the Gerber
 * file format.
 * 
 * Some of these are for internal consumption.
 */

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
    readonly xPow:number;  // The power of 1 to multiply the X coordinate by 10^(-xNumDecPos)
    readonly yPow:number;  // The power of 1 to multiply the Y coordinate by 10^(-yNumDecPos)

    constructor(
        readonly xNumIntPos:number,
        readonly xNumDecPos:number,
        readonly yNumIntPos:number,
        readonly yNumDecPos:number) {
            this.xPow = Math.pow(10, -this.xNumDecPos);
            this.yPow = Math.pow(10, -this.yNumDecPos);
        }
}

export class Point {
    public x:number;
    public y:number;
}

export class GerberParseException {
    constructor(readonly message:string, readonly line?:number) {
    }
}

export class Block {
}

export class GerberState {
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

export class ApertureDefinition {
    constructor(
        readonly apertureId:number,
        readonly templateName:string,
        readonly modifiers:number[]) {
    }
}

export class VariableDefinition {
    constructor(readonly id:number, readonly expression:string) {
    }
}

export class Primitive {
    constructor(
        readonly code:number,
        readonly modifiers:string[]) {
    }
}

export class ApertureMacro {
    constructor(
        readonly macroName:string,
        readonly content:Array<VariableDefinition|Primitive>) {
    }
}
