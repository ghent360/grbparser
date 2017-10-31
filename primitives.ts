/**
 * This file contains some classes that abstract primitives in the Gerber
 * file format.
 * 
 * Some of these are for internal consumption.
 */

 import {formatFloat} from "./utils";

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

export class Point {
    constructor (public x?:number, public y?:number) {
    }

    isValid():boolean {
        return this.x != undefined && this.y != undefined;
    }

    toString():string {
        return `(${formatFloat(this.x, 4)}, ${formatFloat(this.y, 4)})`;
    }

    add(other:Point):Point {
        return new Point(this.x + other.x, this.y + other.y);
    }

    subtract(other:Point):Point {
        return new Point(this.x - other.x, this.y - other.y);
    }

    scale(scale:number):Point {
        return new Point(this.x * scale, this.y * scale);
    }

    distance1(other:Point):number {
        let dx = this.x - other.x;
        let dy = this.y - other.y;
        return Math.abs(dx) + Math.abs(dy);
    }

    distance2(other:Point):number {
        let dx = this.x - other.x;
        let dy = this.y - other.y;
        return dx * dx + dy * dy;
    }

    distance(other:Point):number {
        return Math.sqrt(this.distance2(other));
    }

    clone():Point {
        return new Point(this.x, this.y);
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

export type Polygon = Array<Point>;
export type PolygonSet = Array<Polygon>;
const PI2 = Math.PI * 2;
export const NUMSTEPS = 40;
const NUMSTEPS2 = NUMSTEPS / 2;
const ZeroPoint = new Point(0, 0);

function translatePolygon(poly:Polygon, offset:Point):Polygon {
    return poly.map(point => point.add(offset));
}

export function translatePolySet(polySet:PolygonSet, offset:Point):PolygonSet {
    return polySet.map(polygon => translatePolygon(polygon, offset));
}

function scalePolygon(poly:Polygon, scale:number):Polygon {
    return poly.map(point => point.scale(scale));
}

export function scalePolySet(polySet:PolygonSet, scale:number):PolygonSet {
    return polySet.map(polygon => scalePolygon(polygon, scale));
}

function polygonBounds(poly:Polygon):Bounds {
    if (poly.length == 0) {
        return EmptyBounds();
    }
    let bounds = new Bounds(poly[0].clone(), poly[0].clone());
    for (let idx = 1; idx < poly.length; idx++) {
        bounds.merge(poly[idx]);
    }
    return bounds;
}

export function polySetBounds(polygonSet:PolygonSet):Bounds {
    if (polygonSet.length == 0) {
        return EmptyBounds();
    }
    let bounds = polygonBounds(polygonSet[0]);
    for (let idx = 1; idx < polygonSet.length; idx++) {
        bounds.merge(polygonBounds(polygonSet[idx]));
    }
    return bounds;
}

function circleToPolygon(
    radius:number,
    nsteps:number = NUMSTEPS,
    rotation:number = 0):Polygon {
    let result:Polygon = new Array<Point>(nsteps + 1);
    let step = PI2 / nsteps;
    rotation = (PI2 * rotation) / 360;
    for (let idx = 0; idx <= nsteps; idx++) {
        let dx = Math.cos(idx * step - rotation) * radius;
        let dy = Math.sin(idx * step - rotation) * radius;
        result[idx] = new Point(dx, dy);
    }
    return result;
}

function rectangleToPolygon(width:number, height:number):Polygon {
    let result:Polygon = new Array<Point>(5);
    let width2 = width / 2;
    let height2 = height / 2;

    result[0] = new Point(width2, -height2);
    result[1] = new Point(width2, height2);
    result[2] = new Point(-width2, height2);
    result[3] = new Point(-width2, -height2);
    result[4] = new Point(result[0].x, result[0].y);
    return result;
}

function obroundToPolygon(width:number, height:number):Polygon {
    let result:Polygon = new Array<Point>(NUMSTEPS + 3);
    if (width < height) {
        let radius = width / 2;
        let innerHeight = height - width;
        let height2 = innerHeight / 2;
        result[0] = new Point(radius, -height2);
        let step = Math.PI / NUMSTEPS2;
        for (let idx = 0; idx <= NUMSTEPS2; idx++) {
            let dx = Math.cos(idx * step) * radius;
            let dy = Math.sin(idx * step) * radius + height2;
            result[idx + 1] = new Point(dx, dy);
        }
        for (let idx = 0; idx <= NUMSTEPS2; idx++) {
            let dx = Math.cos(idx * step + Math.PI) * radius;
            let dy = Math.sin(idx * step + Math.PI) * radius - height2;
            result[idx + NUMSTEPS2 + 2] = new Point(dx, dy);
        }
    } else {
        let radius = height / 2;
        let innerWidth = width - height;
        let width2 = innerWidth / 2;
        result[0] = new Point(-width2, -radius);
        let step = Math.PI / NUMSTEPS2;
        for (let idx = 0; idx <= NUMSTEPS2; idx++) {
            let dx = Math.sin(idx * step) * radius + width2;
            let dy = -Math.cos(idx * step) * radius;
            result[idx + 1] = new Point(dx, dy);
        }
        for (let idx = 0; idx <= NUMSTEPS2; idx++) {
            let dx = -Math.sin(idx * step) * radius - width2;
            let dy = Math.cos(idx * step) * radius;
            result[idx + NUMSTEPS2 + 2] = new Point(dx, dy);
        }
    }
    return result;
}

export class ApertureDefinition {
    private macro_:ApertureMacro = undefined;
    private static standardTemplates = ["C", "R", "O", "P"];
    private polygonSet_:PolygonSet = undefined;

    constructor(
        readonly apertureId:number,
        readonly templateName:string,
        readonly modifiers:number[]) {
    }

    isMacro():boolean {
        return ApertureDefinition.standardTemplates.indexOf(this.templateName) < 0;
    }

    isDrawable():boolean {
        return (this.templateName === 'C' && this.modifiers.length == 1)
            || (this.templateName === 'R' && this.modifiers.length == 2);
    }

    get macro():ApertureMacro {
        return this.macro_;
    }

    execute(ctx:GerberState) {
        if (this.isMacro()) {
            this.macro_ = ctx.getApertureMacro(this.templateName);
        }
    }

    toPolygonSet():PolygonSet {
        if (this.polygonSet_ != undefined) {
            return this.polygonSet_;
        }

        let result:PolygonSet = [];

        if (this.templateName === "C") {
            let radius = this.modifiers[0] / 2;
            if (radius < Epsilon) {
                throw new GerberParseException('Can not convert zero size aperture to polyset');
            }
            result.push(circleToPolygon(radius));
            if (this.modifiers.length == 2) {
                result.push(circleToPolygon(this.modifiers[1] / 2));
            } else if (this.modifiers.length == 3) {
                result.push(rectangleToPolygon(this.modifiers[1], this.modifiers[2]));
            }
        } else if (this.templateName === "R") {
            result.push(rectangleToPolygon(this.modifiers[0], this.modifiers[1]));
            if (this.modifiers.length == 3) {
                result.push(circleToPolygon(this.modifiers[2] / 2));
            } else if (this.modifiers.length == 4) {
                result.push(rectangleToPolygon(this.modifiers[2], this.modifiers[3]));
            }
        } else if (this.templateName === "O") {
            result.push(obroundToPolygon(this.modifiers[0], this.modifiers[1]));
            if (this.modifiers.length == 3) {
                result.push(circleToPolygon(this.modifiers[2] / 2));
            } else if (this.modifiers.length == 4) {
                result.push(rectangleToPolygon(this.modifiers[2], this.modifiers[3]));
            }
        } else if (this.templateName === "P") {
            if (this.modifiers.length == 2) {
                result.push(circleToPolygon(this.modifiers[0] / 2, this.modifiers[1]));
            } else if (this.modifiers.length > 2) {
                result.push(circleToPolygon(this.modifiers[0] / 2, this.modifiers[1], this.modifiers[2]));
            }
            if (this.modifiers.length == 4) {
                result.push(circleToPolygon(this.modifiers[3] / 2));
            } else if (this.modifiers.length == 5) {
                result.push(rectangleToPolygon(this.modifiers[3], this.modifiers[4]));
            }
        } else {
            result.push(circleToPolygon(1));
        }
        this.polygonSet_ = result;
        return result;
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

    getApertureMacro(name:string):ApertureMacro {
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

export class Bounds {
    constructor(public min:Point, public max:Point) {
    }

    merge(other:Bounds|Point) {
        if (other instanceof Bounds) {
            if (other.min.x < this.min.x) {
                this.min.x = other.min.x;
            }
            if (other.min.y < this.min.y) {
                this.min.y = other.min.y;
            }
            if (other.max.x > this.max.x) {
                this.max.x = other.max.x;
            }
            if (other.max.y > this.max.y) {
                this.max.y = other.max.y;
            }
        } else {
            if (other.x < this.min.x) {
                this.min.x = other.x;
            }
            if (other.y < this.min.y) {
                this.min.y = other.y;
            }
            if (other.x > this.max.x) {
                this.max.x = other.x;
            }
            if (other.y > this.max.y) {
                this.max.y = other.y;
            }
        }
    }

    get width():number {
        return this.max.x - this.min.x;
    }

    get height():number {
        return this.max.y - this.min.y;
    }
}

export class LineSegment {
    constructor(
        readonly from:Point,
        readonly to:Point){
    }

    toString():string {
        return `l(${this.from}, ${this.to})`;
    }

    get bounds():Bounds {
        return new Bounds(
            new Point(Math.min(this.from.x, this.to.x), Math.min(this.from.y, this.to.y)),
            new Point(Math.max(this.from.x, this.to.x), Math.max(this.from.y, this.to.y)));
    }
}

export class CircleSegment {
    constructor(
        readonly center:Point,
        readonly radius:number) {
    }

    toString():string {
        return `c(${this.center}R${formatFloat(this.radius, 3)})`;
    }

    get bounds():Bounds {
        return new Bounds(
            new Point(this.center.x - this.radius, this.center.x - this.radius),
            new Point(this.center.x + this.radius, this.center.x + this.radius));
    }
}

export class ArcSegment {
    constructor(
        readonly center:Point,
        readonly radius:number,
        readonly start:Point,
        readonly end:Point) {
    }

    toString():string {
        return `a(${this.start}, ${this.end}@${this.center}R${formatFloat(this.radius, 3)})`;
    }

    get bounds():Bounds {
        return new Bounds(
            new Point(Math.min(this.start.x, this.end.x), Math.min(this.start.y, this.end.y)),
            new Point(Math.max(this.start.x, this.end.x), Math.max(this.start.y, this.end.y)));
    }
}

export type BlockSegment = LineSegment | CircleSegment | ArcSegment;
export type BlockContour = Array<BlockSegment>;

class BlockGraphicsOperationsConsumer implements GraphicsOperations {
    private contour_:BlockContour = [];
    private blockContours_:Array<BlockContour> = [];

    get blockContours():Array<BlockContour> {
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

    block(contours:Array<BlockContour>, ctx:GerberState) {
        ctx.error("Blocks are not allowed inside a block definition.");
    }
}

export class Line {
    constructor(
        readonly from:Point,
        readonly to:Point,
        readonly aperture:ApertureDefinition) {
    }

    toString():string {
        return `L(${this.from}, ${this.to})`;
    }

    get bounds():Bounds {
        return new Bounds(
            new Point(Math.min(this.from.x, this.to.x), Math.min(this.from.y, this.to.y)),
            new Point(Math.max(this.from.x, this.to.x), Math.max(this.from.y, this.to.y)));
    }
}

export class Circle {
    constructor(
        readonly center:Point,
        readonly radius:number,
        readonly aperture:ApertureDefinition) {
    }

    toString():string {
        return `C(${this.center}R${formatFloat(this.radius, 3)})`;
    }

    get bounds():Bounds {
        return new Bounds(
            new Point(this.center.x - this.radius, this.center.y - this.radius),
            new Point(this.center.x + this.radius, this.center.y + this.radius));
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

    toString():string {
        return `A(${this.start}, ${this.end}@${this.center}R${formatFloat(this.radius, 3)})`;
    }

    get bounds():Bounds {
        return new Bounds(
            new Point(Math.min(this.start.x, this.end.x), Math.min(this.start.y, this.end.y)),
            new Point(Math.max(this.start.x, this.end.x), Math.max(this.start.y, this.end.y)));
    }
}

export class Flash {
    private polygonSet_:PolygonSet;

    constructor(
        readonly center:Point,
        readonly aperture:ApertureDefinition) {
        this.polygonSet_ = translatePolySet(aperture.toPolygonSet(), center);
    }

    toString():string {
        return `F(${this.aperture.apertureId}@${this.center})`;
    }

    get polygonSet():PolygonSet {
        return this.polygonSet_;
    }

    get bounds():Bounds {
        return polySetBounds(this.polygonSet_);
    }
}

export function EmptyBounds():Bounds {
    return new Bounds(new Point(0, 0), new Point(0, 0));
}

export class Block {
    constructor(
        readonly contours:Array<BlockContour>) {
    }

    toString():string {
        let result = "B[";
        let firstContour = true;
        this.contours.forEach(contour => {
            if (!firstContour) {
                result += ", ";
            }
            firstContour = false;
            result += "contour {";
            let firstSegment = true;
            contour.forEach(segment => {
                if (!firstSegment) {
                    result += ", ";
                }
                firstSegment = false;
                result += segment.toString();
            });
            result += "}";
        });
        result += "]";
        return result;
    }

    get bounds():Bounds {
        if (this.contours.length == 0) {
            return EmptyBounds();
        }
        let bounds = Block.contourBounds(this.contours[0]);
        this.contours.forEach(c => bounds.merge(Block.contourBounds(c)));
        return bounds;
    }

    private static contourBounds(contour:BlockContour):Bounds {
        if (contour.length == 0) {
            return EmptyBounds();
        }
        let bounds = contour[0].bounds;
        contour.forEach(s => bounds.merge(s.bounds));
        return bounds;
    }
}

export type GraphicsPrimitive = Line | Circle | Arc | Flash | Block;

export class BaseGraphicsOperationsConsumer implements GraphicsOperations {
    private primitives_:Array<GraphicsPrimitive> = [];

    get primitives():Array<GraphicsPrimitive> {
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

    block(contours:Array<BlockContour>, ctx:GerberState) {
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