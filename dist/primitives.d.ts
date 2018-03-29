import { AritmeticOperation } from "./expressions";
import { Polygon, PolygonSet, PolygonSetWithBounds } from "./polygonSet";
import { Point } from "./point";
export declare enum CoordinateUnits {
    INCHES = 0,
    MILIMETERS = 1,
}
export declare enum InterpolationMode {
    LINEARx1 = 0,
    LINEARx10 = 1,
    LINEARx01 = 2,
    LINEARx001 = 3,
    CLOCKWISE = 4,
    COUNTER_CLOCKWISE = 5,
}
export declare enum CoordinateMode {
    ABSOLUTE = 0,
    RELATIVE = 1,
}
export declare enum QuadrantMode {
    SINGLE = 0,
    MULTI = 1,
}
export declare enum ObjectPolarity {
    DARK = 0,
    LIGHT = 1,
    THIN = 2,
}
export declare enum ObjectMirroring {
    NONE = 0,
    X_AXIS = 1,
    Y_AXIS = 2,
    XY_AXIS = 3,
}
export declare enum AttributeType {
    FILE = 0,
    APERTURE = 1,
    OBJECT = 2,
}
export declare type PolyongWithThinkness = {
    polygon: Polygon;
    is_solid: boolean;
};
export declare type PolyongSetWithThinkness = {
    polygonSet: PolygonSet;
    is_solid: boolean;
};
export declare type PolySetWithPolarity = {
    polySet: PolygonSet;
    polarity: ObjectPolarity;
};
export declare type GraphicsObjects = Array<PolySetWithPolarity>;
export declare enum CoordinateSkipZeros {
    NONE = 0,
    LEADING = 1,
    TRAILING = 2,
    DIRECT = 3,
}
export declare enum CoordinateType {
    ABSOLUTE = 1,
    INCREMENTAL = 2,
}
export declare class CoordinateFormatSpec {
    readonly coordFormat: CoordinateSkipZeros;
    readonly coordType: CoordinateType;
    readonly xNumIntPos: number;
    readonly xNumDecPos: number;
    readonly yNumIntPos: number;
    readonly yNumDecPos: number;
    readonly xPow: number;
    readonly yPow: number;
    constructor(coordFormat: CoordinateSkipZeros, coordType: CoordinateType, xNumIntPos: number, xNumDecPos: number, yNumIntPos: number, yNumDecPos: number);
}
export declare class GerberParseException {
    readonly message: string;
    readonly line: number;
    constructor(message: string, line?: number);
    toString(): string;
}
export interface ApertureBase {
    readonly apertureId: number;
    isDrawable(): boolean;
    objects(polarity: ObjectPolarity): GraphicsObjects;
    generateArcDraw(start: Point, end: Point, center: Point, state: ObjectState): PolyongWithThinkness;
    generateCircleDraw(center: Point, radius: number, state: ObjectState): PolyongSetWithThinkness;
    generateLineDraw(start: Point, end: Point, state: ObjectState): PolyongWithThinkness;
}
export declare class BlockAperture implements ApertureBase {
    readonly apertureId: number;
    private objects_;
    constructor(apertureId: number, objects: GraphicsObjects);
    isDrawable(): boolean;
    objects(polarity: ObjectPolarity): GraphicsObjects;
    generateArcDraw(start: Point, end: Point, center: Point, state: ObjectState): PolyongWithThinkness;
    generateCircleDraw(center: Point, radius: number, state: ObjectState): PolyongSetWithThinkness;
    generateLineDraw(start: Point, end: Point, state: ObjectState): PolyongWithThinkness;
}
export declare class ApertureDefinition implements ApertureBase {
    readonly apertureId: number;
    readonly templateName: string;
    readonly modifiers: number[];
    private macro_;
    private static standardTemplates;
    private polygonSet_;
    constructor(apertureId: number, templateName: string, modifiers: number[]);
    isMacro(): boolean;
    isDrawable(): boolean;
    readonly macro: ApertureMacro;
    execute(ctx: GerberState): void;
    generateArcDraw(start: Point, end: Point, center: Point, state: ObjectState): PolyongWithThinkness;
    generateCircleDraw(center: Point, radius: number, state: ObjectState): PolyongSetWithThinkness;
    generateLineDraw(start: Point, end: Point, state: ObjectState): PolyongWithThinkness;
    objects(polarity: ObjectPolarity): GraphicsObjects;
    toPolySet(): PolygonSet;
}
export declare class VariableDefinition {
    readonly id: number;
    readonly expression: AritmeticOperation;
    constructor(id: number, expression: AritmeticOperation);
}
export declare class Primitive {
    readonly code: number;
    readonly modifiers: Array<AritmeticOperation>;
    constructor(code: number, modifiers: Array<AritmeticOperation>);
}
export declare class PrimitiveComment {
    readonly text: string;
    constructor(text: string);
}
export declare class ApertureMacro {
    readonly macroName: string;
    readonly content: Array<VariableDefinition | Primitive | PrimitiveComment>;
    constructor(macroName: string, content: Array<VariableDefinition | Primitive | PrimitiveComment>);
    toPolygonSet(modifiers: Array<number>): PolygonSet;
    private static getValue(modifiers, idx);
}
export declare class Attribute {
    readonly type: AttributeType;
    readonly name: string;
    readonly fields: string[];
    constructor(type: AttributeType, name: string, fields: string[]);
}
export declare class BlockParams {
    readonly xRepeat: number;
    readonly yRepeat: number;
    readonly xDelta: number;
    readonly yDelta: number;
    constructor(xRepeat: number, yRepeat: number, xDelta: number, yDelta: number);
}
export declare class Block {
    readonly xRepeat: number;
    readonly yRepeat: number;
    readonly xDelta: number;
    readonly yDelta: number;
    readonly primitives: Array<GraphicsPrimitive>;
    readonly objects: GraphicsObjects;
    constructor(xRepeat: number, yRepeat: number, xDelta: number, yDelta: number, primitives: Array<GraphicsPrimitive>, objects: GraphicsObjects);
}
export interface GraphicsOperations {
    line(from: Point, to: Point, ctx: GerberState): void;
    circle(center: Point, radius: number, ctx: GerberState): void;
    arc(center: Point, radius: number, start: Point, end: Point, isCCW: boolean, ctx: GerberState): void;
    flash(center: Point, ctx: GerberState): void;
    region(contours: Array<Array<LineSegment | CircleSegment | ArcSegment>>, ctx: GerberState): void;
    block(block: Block, ctx: GerberState): void;
}
export declare class GerberState {
    private coordinateFormat_;
    private coordinateUnits_;
    private currentPoint_;
    private currentCenterOffset_;
    private currentAppretureId_;
    interpolationMode: InterpolationMode;
    coordinateMode: CoordinateMode;
    private quadrantMode_;
    objectPolarity: ObjectPolarity;
    objectMirroring: ObjectMirroring;
    objectRotation: number;
    objectScaling: number;
    private apertures;
    private apertureMacros;
    private graphisOperationsConsumer_;
    private savedGraphisOperationsConsumer_;
    private blockApertures_;
    private blockParams_;
    private primitives_;
    private isDone_;
    coordinateFormatSpec: CoordinateFormatSpec;
    coordinateUnits: CoordinateUnits;
    currentPointX: number;
    currentPointY: number;
    currentI: number;
    currentJ: number;
    currentAppretureId: number;
    quadrantMode: QuadrantMode;
    readonly isDone: boolean;
    readonly primitives: Array<GraphicsPrimitive>;
    getObjectState(): ObjectState;
    getAperture(id: number): ApertureBase;
    getCurrentAperture(): ApertureBase;
    setAperture(ap: ApertureBase): void;
    getApertureMacro(name: string): ApertureMacro;
    setApertureMacro(apm: ApertureMacro): void;
    error(message: string): void;
    warning(message: string): void;
    line(from: Point, to: Point): void;
    circle(center: Point, radius: number): void;
    arc(center: Point, radius: number, start: Point, end: Point, isCCW: boolean): void;
    flash(center: Point): void;
    closeRegionContour(): void;
    startRegion(): void;
    endRegion(): void;
    saveGraphicsConsumer(): void;
    restoreGraphicsConsumer(): void;
    readonly graphicsOperations: GraphicsOperations;
    startBlockAperture(blockId: number): void;
    endBlockAperture(): void;
    startRepeat(params: BlockParams): void;
    tryEndRepeat(): void;
    endRepeat(): void;
    endFile(): void;
}
export interface SimpleBounds {
    readonly minx: number;
    readonly miny: number;
    readonly maxx: number;
    readonly maxy: number;
}
export declare class Bounds {
    min: Point;
    max: Point;
    constructor(min: Point, max: Point);
    merge(other: Bounds | Point | SimpleBounds): void;
    mergexy(x: number, y: number): void;
    readonly width: number;
    readonly height: number;
    toSimpleBounds(): SimpleBounds;
}
export declare class LineSegment {
    readonly from: Point;
    readonly to: Point;
    constructor(from: Point, to: Point);
    toString(): string;
    readonly bounds: Bounds;
    translate(vector: Point): LineSegment;
}
export declare class CircleSegment {
    readonly center: Point;
    readonly radius: number;
    constructor(center: Point, radius: number);
    toString(): string;
    readonly bounds: Bounds;
    translate(vector: Point): CircleSegment;
}
export declare class ArcSegment {
    readonly center: Point;
    readonly radius: number;
    readonly start: Point;
    readonly end: Point;
    readonly isCCW: boolean;
    constructor(center: Point, radius: number, start: Point, end: Point, isCCW: boolean);
    toString(): string;
    readonly bounds: Bounds;
    translate(vector: Point): ArcSegment;
}
export declare type RegionSegment = LineSegment | CircleSegment | ArcSegment;
export declare type RegionContour = Array<RegionSegment>;
export declare class ObjectState {
    readonly polarity: ObjectPolarity;
    readonly mirroring: ObjectMirroring;
    readonly scale: number;
    readonly rotation: number;
    constructor(polarity?: ObjectPolarity, mirroring?: ObjectMirroring, scale?: number, rotation?: number);
}
export declare class Line {
    readonly from: Point;
    readonly to: Point;
    readonly aperture: ApertureBase;
    readonly state: ObjectState;
    private objects_;
    constructor(from: Point, to: Point, aperture: ApertureBase, state: ObjectState);
    toString(): string;
    readonly objects: GraphicsObjects;
    readonly bounds: Bounds;
    readonly primitives: this;
    translate(vector: Point): Line;
}
export declare class Circle {
    readonly center: Point;
    readonly radius: number;
    readonly aperture: ApertureBase;
    readonly state: ObjectState;
    private objects_;
    constructor(center: Point, radius: number, aperture: ApertureBase, state: ObjectState);
    toString(): string;
    readonly objects: GraphicsObjects;
    readonly bounds: Bounds;
    readonly primitives: this;
    translate(vector: Point): Circle;
}
export declare class Arc {
    readonly center: Point;
    readonly radius: number;
    readonly start: Point;
    readonly end: Point;
    readonly isCCW: boolean;
    readonly aperture: ApertureBase;
    readonly state: ObjectState;
    private objects_;
    constructor(center: Point, radius: number, start: Point, end: Point, isCCW: boolean, aperture: ApertureBase, state: ObjectState);
    toString(): string;
    readonly objects: GraphicsObjects;
    readonly bounds: Bounds;
    readonly primitives: this;
    translate(vector: Point): Arc;
}
export declare class Flash {
    readonly center: Point;
    readonly aperture: ApertureBase;
    readonly state: ObjectState;
    private objects_;
    constructor(center: Point, aperture: ApertureBase, state: ObjectState);
    toString(): string;
    readonly objects: GraphicsObjects;
    readonly bounds: Bounds;
    readonly primitives: this;
    translate(vector: Point): Flash;
}
export declare class Region {
    readonly state: ObjectState;
    private objects_;
    readonly contours: Array<RegionContour>;
    constructor(contours: Array<RegionContour>, state: ObjectState);
    toString(): string;
    private static startPoint(segment);
    private static endPoint(segment);
    private static matchPoint(p, segment, matchStart);
    private static reOrderCountour(contour);
    private static buildPolygonSet(contours);
    private static buildPolygon(contour);
    readonly objects: GraphicsObjects;
    readonly bounds: Bounds;
    readonly primitives: this;
    translate(vector: Point): Region;
}
export declare class Repeat {
    readonly block: Block;
    readonly xOffset: number;
    readonly yOffset: number;
    private objects_;
    private primitives_;
    constructor(block: Block, xOffset?: number, yOffset?: number);
    toString(): string;
    readonly objects: GraphicsObjects;
    readonly bounds: Bounds;
    private buildObjects();
    private buildPrimitives();
    readonly primitives: GraphicsPrimitive[];
    translate(vector: Point): Repeat;
}
export declare type GraphicsPrimitive = Line | Circle | Arc | Flash | Region | Repeat;
export declare function EmptyBounds(): Bounds;
export declare class BaseGraphicsOperationsConsumer implements GraphicsOperations {
    private primitives_;
    readonly primitives: Array<GraphicsPrimitive>;
    line(from: Point, to: Point, ctx: GerberState): void;
    circle(center: Point, radius: number, ctx: GerberState): void;
    arc(center: Point, radius: number, start: Point, end: Point, isCCW: boolean, ctx: GerberState): void;
    flash(center: Point, ctx: GerberState): void;
    region(contours: Array<RegionContour>, ctx: GerberState): void;
    block(block: Block, ctx: GerberState): void;
}
export declare class BlockGraphicsOperationsConsumer implements GraphicsOperations {
    private objects_;
    private primitives_;
    readonly primitives: Array<GraphicsPrimitive>;
    readonly objects: GraphicsObjects;
    line(from: Point, to: Point, ctx: GerberState): void;
    circle(center: Point, radius: number, ctx: GerberState): void;
    arc(center: Point, radius: number, start: Point, end: Point, isCCW: boolean, ctx: GerberState): void;
    flash(center: Point, ctx: GerberState): void;
    region(contours: Array<RegionContour>, ctx: GerberState): void;
    block(block: Block, ctx: GerberState): void;
}
export declare function composeSolidImage(objects: GraphicsObjects, union?: boolean): PolygonSetWithBounds;
export interface GerberCommand {
    readonly name: string;
    readonly isAdvanced: boolean;
    formatOutput(fmt: CoordinateFormatSpec): string;
    execute(ctx: GerberState): void;
}
export declare const Epsilon = 1e-12;
