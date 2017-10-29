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

export enum AttributeType {
    FILE,
    APERTURE,
    OBJECT
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

function formatFloat(n:number, precision:number):string {
    let s = n.toPrecision(precision);
    let dotIdx = s.indexOf('.');
    if (dotIdx >= 0) {
        let idx:number;
        for (idx = s.length - 1; idx > dotIdx + 1; idx--) {
            if (s[idx] != '0') {
                break;
            }
        }
        s = s.substring(0, idx + 1);
    }
    return s;
}

export class Point {
    constructor (public x?:number, public y?:number) {
    }

    isValid():boolean {
        return this.x != undefined && this.y != undefined;
    }

    toString():string {
        return `(${formatFloat(this.x, 6)}, ${formatFloat(this.y, 6)})`;
    }
}

export class GerberParseException {
    constructor(readonly message:string, readonly line?:number) {
    }

    toString():string {
        if (this.line != undefined) {
            return `Error parsing gerber file at line ${this.line}: ${this.message}`;
        }
        return `Error parsing gerber file: ${this.message}`;
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

export class Attribute {
    constructor(
        readonly type:AttributeType,
        readonly name:string,
        readonly fields:string[]) {
    }
}

export interface GraphicsOperations {
    line(from:Point, to:Point, ctx:GerberState);
    circle(center:Point, radius:number, ctx:GerberState);
    arc(center:Point, radius:number, start:Point, end:Point, ctx:GerberState);
    flash(center:Point, ctx:GerberState);
    close(ctx:GerberState);
    block(contours:Array<Array<LineSegment|CircleSegment|ArcSegment>>, ctx:GerberState);
}

export class GerberState {
    private coordinateFormat_:CoordinateFormatSpec = undefined;
    private fileUnits_:FileUnits = undefined;
    private currentPoint_:Point = new Point();
    private currentCenterOffset_:Point = new Point();
    private currentAppretureId_:number = undefined;
    public interpolationMode:InterpolationMode = InterpolationMode.LINEAR;
    private quadrantMode_:QuadrantMode = undefined;
    public objectPolarity:ObjectPolarity = ObjectPolarity.DARK;
    public objectMirroring:ObjectMirroring = ObjectMirroring.NONE;
    public objectRotation:number = 0;
    public objectScaling:number = 1.0;
    private apertures:{[id:number]:ApertureDefinition} = {};
    private apertureMacros:{[name:string]:ApertureMacro} = {};
    private graphisOperationsConsumer_:GraphicsOperations = new BaseGraphicsOperationsConsumer();
    private savedGraphisOperationsConsumer_:GraphicsOperations;
    
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

    get currentPointX():number {
        if (this.currentPoint_.x == undefined) {
            this.error("Current point X is not set.");
        }
        return this.currentPoint_.x;
    }

    set currentPointX(value:number) {
        this.currentPoint_.x = value;        
    }

    get currentPointY():number {
        if (this.currentPoint_.y == undefined) {
            this.error("Current point Y is not set.");
        }
        return this.currentPoint_.y;
    }

    set currentPointY(value:number) {
        this.currentPoint_.y = value;        
    }

    get currentI():number {
        if (this.currentCenterOffset_.x == undefined) {
            this.error("Current I is not set.");
        }
        return this.currentCenterOffset_.x;
    }

    set currentI(value:number) {
        this.currentCenterOffset_.x = value;
    }

    get currentJ():number {
        if (this.currentCenterOffset_.y == undefined) {
            this.error("Current J is not set.");
        }
        return this.currentCenterOffset_.y;
    }

    set currentJ(value:number) {
        this.currentCenterOffset_.y = value;
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

    get quadrantMode():QuadrantMode {
        if (this.quadrantMode_ == undefined) {
            this.error("Current quadrant mode is not set.");
        }
        return this.quadrantMode_;
    }

    set quadrantMode(value:QuadrantMode) {
        this.quadrantMode_ = value;        
    }

    getAperture(id:number):ApertureDefinition {
        if (id < 10) {
            this.error(`Invalid aprture ID ${id}`);
        }
        if (this.apertures[id] == undefined) {
            this.error(`Aprture ID ${id} is not defined yet`);
        }
        return this.apertures[id];
    }

    getCurrentAperture():ApertureDefinition {
        let id = this.currentAppretureId
        if (this.apertures[id] == undefined) {
            this.error(`Aprture ID ${id} is not defined yet`);
        }
        return this.apertures[id];
    }

    setAperture(ap:ApertureDefinition) {
        if (this.apertures[ap.apertureId] != undefined) {
            this.error(`Overriding aperture ${ap.apertureId}`);
        }
        this.apertures[ap.apertureId] = ap;
    }

    getApertureMacro(name:number):ApertureMacro {
        if (this.apertureMacros[name] == undefined) {
            this.error(`Aprture macro name ${name} is not defined yet`);
        }
        return this.apertureMacros[name];
    }

    setApertureMacro(apm:ApertureMacro) {
        if (this.apertureMacros[apm.macroName] != undefined) {
            this.error(`Overriding aperture macro ${apm.macroName}`);
        }
        this.apertureMacros[apm.macroName] = apm;
    }

    error(message:string) {
        throw new GerberParseException(message);
    }

    line(from:Point, to:Point) {
        if (!from.isValid() || !to.isValid()) {
            this.error(`Invalid line ${from} ${to}`);
        }
        this.graphisOperationsConsumer_.line(from, to, this);
    }

    circle(center:Point, radius:number) {
        if (!center.isValid() || radius <= Epsilon) {
            this.error(`Invalid circle ${center} R${radius}`);
        }
        this.graphisOperationsConsumer_.circle(center, radius, this);
    }

    arc(center:Point, radius:number, start:Point, end:Point) {
        if (!center.isValid() || radius <= Epsilon || !start.isValid() || !end.isValid()) {
            this.error(`Invalid arc ${center} R${radius} from ${start} to ${end}`);
        }
        this.graphisOperationsConsumer_.arc(center, radius, start, end, this);
    }

    flash(center:Point) {
        if (!center.isValid()) {
            this.error(`Invalid flash location ${center}`);
        }
        this.graphisOperationsConsumer_.flash(center, this);
    }

    close() {
        this.graphisOperationsConsumer_.close(this);
    }

    startBlock() {
        this.savedGraphisOperationsConsumer_ = this.graphisOperationsConsumer_;
        this.graphisOperationsConsumer_ = new BlockGraphicsOperationsConsumer();
    }

    endBlock() {
        let block = this.graphisOperationsConsumer_ as BlockGraphicsOperationsConsumer;
        block.close(this);

        this.graphisOperationsConsumer_ = this.savedGraphisOperationsConsumer_;
        this.graphisOperationsConsumer_.block(block.blockContours, this);
    }

    get graphicsOperations():GraphicsOperations {
        return this.graphisOperationsConsumer_;
    }
}

export class LineSegment {
    constructor(
        readonly from:Point,
        readonly to:Point){
    }
}

export class CircleSegment {
    constructor(
        readonly center:Point,
        readonly radius:number) {
    }
}

export class ArcSegment {
    constructor(
        readonly center:Point,
        readonly radius:number,
        readonly start:Point,
        readonly end:Point) {
    }
}

class BlockGraphicsOperationsConsumer implements GraphicsOperations {
    private contour_:Array<LineSegment|CircleSegment|ArcSegment> = [];
    private blockContours_:Array<Array<LineSegment|CircleSegment|ArcSegment>> = [];

    get blockContours():Array<Array<LineSegment|CircleSegment|ArcSegment>> {
        return this.blockContours_;
    }

    line(from:Point, to:Point) {
        this.contour_.push(new LineSegment(from, to));
    }

    circle(center:Point, radius:number) {
        this.contour_.push(new CircleSegment(center, radius));
    }

    arc(center:Point, radius:number, start:Point, end:Point, ctx:GerberState) {
        this.contour_.push(new ArcSegment(center, radius, start, end));
    }

    flash(center:Point, ctx:GerberState) {
        ctx.error("Flashes are not allowed inside a block definition.");
    }

    close(ctx:GerberState) {
        if (this.contour_.length > 0) {
            this.blockContours_.push(this.contour_);
            this.contour_ = [];
        }
    }

    block(contours:Array<Array<LineSegment|CircleSegment|ArcSegment>>, ctx:GerberState) {
        ctx.error("Blocks are not allowed inside a block definition.");
    }
}

export class Line {
    constructor(
        readonly from:Point,
        readonly to:Point,
        readonly aperture:ApertureDefinition) {
    }
}

export class Circle {
    constructor(
        readonly center:Point,
        readonly radius:number,
        readonly aperture:ApertureDefinition) {
    }
}

export class Arc {
    constructor(
        readonly center:Point,
        readonly radius:number,
        readonly start:Point,
        readonly end:Point,
        readonly aperture:ApertureDefinition) {
    }
}

export class Flash {
    constructor(
        readonly center:Point,
        readonly aperture:ApertureDefinition) {
    }
}

export class Block {
    constructor(
        readonly contours:Array<Array<LineSegment|CircleSegment|ArcSegment>>) {
    }
}

export class BaseGraphicsOperationsConsumer implements GraphicsOperations {
    private primitives_:Array<Line|Circle|Arc|Flash|Block> = [];

    get primitives():Array<Line|Circle|Arc|Flash|Block> {
        return this.primitives_;
    }

    line(from:Point, to:Point, ctx:GerberState) {
        this.primitives_.push(new Line(from, to, ctx.getCurrentAperture()));
    }

    circle(center:Point, radius:number, ctx:GerberState) {
        this.primitives_.push(new Circle(center, radius, ctx.getCurrentAperture()));
    }

    arc(center:Point, radius:number, start:Point, end:Point, ctx:GerberState) {
        this.primitives_.push(new Arc(center, radius, start, end, ctx.getCurrentAperture()));
    }

    flash(center:Point, ctx:GerberState) {
        this.primitives_.push(new Flash(center, ctx.getCurrentAperture()));
    }

    close(ctx:GerberState) {
    }

    block(contours:Array<Array<LineSegment|CircleSegment|ArcSegment>>, ctx:GerberState) {
        this.primitives_.push(new Block(contours));
    }
}

export interface GerberCommand {
    readonly name:string;
    readonly isAdvanced:boolean;
    formatOutput(fmt:CoordinateFormatSpec):string;
    execute(ctx:GerberState);
}

export const Epsilon = 1E-12;