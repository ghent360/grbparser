/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 *
 * License: MIT License, see LICENSE.txt
 */
import { ArithmeticOperation } from "./expressions";
import { Polygon, PolygonSet, PolygonSetWithBounds } from "./polygonSet";
import { Point } from "./point";
export declare enum CoordinateUnits {
    INCHES = 0,
    MILLIMETERS = 1
}
export declare enum InterpolationMode {
    LINEARx1 = 0,
    LINEARx10 = 1,
    LINEARx01 = 2,
    LINEARx001 = 3,
    CLOCKWISE = 4,
    COUNTER_CLOCKWISE = 5
}
export declare enum CoordinateMode {
    ABSOLUTE = 0,
    RELATIVE = 1
}
export declare enum QuadrantMode {
    SINGLE = 0,
    MULTI = 1
}
export declare enum ObjectPolarity {
    DARK = 0,
    LIGHT = 1,
    THIN = 2
}
export declare enum ObjectMirroring {
    NONE = 0,
    X_AXIS = 1,
    Y_AXIS = 2,
    XY_AXIS = 3
}
export declare enum AttributeType {
    FILE = 0,
    APERTURE = 1,
    OBJECT = 2
}
export declare type PolygonWithThickness = {
    polygon: Polygon;
    is_solid: boolean;
};
export declare type PolygonSetWithThickness = {
    polygonSet: PolygonSet;
    is_solid: boolean;
};
export declare type PolySetWithPolarity = {
    polySet: PolygonSet;
    polarity: ObjectPolarity;
};
export declare type GraphicsObjects = Array<PolySetWithPolarity>;
export declare enum CoordinateZeroFormat {
    NONE = 0,
    LEADING = 1,
    TRAILING = 2,
    DIRECT = 3
}
export declare enum CoordinateType {
    ABSOLUTE = 1,
    INCREMENTAL = 2
}
export declare class CoordinateFormatSpec {
    readonly coordFormat: CoordinateZeroFormat;
    readonly coordType: CoordinateType;
    readonly xNumIntPos: number;
    readonly xNumDecPos: number;
    readonly yNumIntPos: number;
    readonly yNumDecPos: number;
    readonly xPow: number;
    readonly yPow: number;
    constructor(coordFormat: CoordinateZeroFormat, coordType: CoordinateType, xNumIntPos: number, xNumDecPos: number, yNumIntPos: number, yNumDecPos: number);
}
export declare class GerberParseException {
    readonly message: string;
    readonly line?: number;
    constructor(message: string, line?: number);
    toString(): string;
}
export interface ApertureBase {
    readonly apertureId: number;
    isDrawable(): boolean;
    objects(polarity: ObjectPolarity, state: ObjectState): GraphicsObjects;
    generateArcDraw(start: Point, end: Point, center: Point, state: ObjectState): PolygonWithThickness;
    generateCircleDraw(center: Point, radius: number, state: ObjectState): PolygonSetWithThickness;
    generateLineDraw(start: Point, end: Point, state: ObjectState): PolygonWithThickness;
}
export declare class BlockAperture implements ApertureBase {
    readonly apertureId: number;
    private objects_;
    constructor(apertureId: number, objects: GraphicsObjects);
    isDrawable(): boolean;
    objects(polarity: ObjectPolarity): GraphicsObjects;
    generateArcDraw(start: Point, end: Point, center: Point, state: ObjectState): PolygonWithThickness;
    generateCircleDraw(center: Point, radius: number, state: ObjectState): PolygonSetWithThickness;
    generateLineDraw(start: Point, end: Point, state: ObjectState): PolygonWithThickness;
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
    get macro(): ApertureMacro;
    execute(ctx: GerberState): void;
    generateArcDraw(start: Point, end: Point, center: Point, state: ObjectState): PolygonWithThickness;
    generateCircleDraw(center: Point, radius: number, state: ObjectState): PolygonSetWithThickness;
    generateLineDraw(start: Point, end: Point, state: ObjectState): PolygonWithThickness;
    objects(polarity: ObjectPolarity, state: ObjectState): GraphicsObjects;
    private toPolySet;
}
export declare class VariableDefinition {
    readonly id: number;
    readonly expression: ArithmeticOperation;
    constructor(id: number, expression: ArithmeticOperation);
}
export declare class Primitive {
    readonly code: number;
    readonly modifiers: Array<ArithmeticOperation>;
    constructor(code: number, modifiers: Array<ArithmeticOperation>);
}
export declare class PrimitiveComment {
    readonly text: string;
    constructor(text: string);
}
export declare class ApertureMacro {
    readonly macroName: string;
    readonly content: Array<VariableDefinition | Primitive | PrimitiveComment>;
    constructor(macroName: string, content: Array<VariableDefinition | Primitive | PrimitiveComment>);
    toPolygonSet(modifiers: Array<number>, state: ObjectState): PolygonSet;
    private static getValue;
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
    line(from: Point, to: Point, cmd: GerberCommand, ctx: GerberState): void;
    circle(center: Point, radius: number, cmd: GerberCommand, ctx: GerberState): void;
    arc(center: Point, radius: number, start: Point, end: Point, isCCW: boolean, cmd: GerberCommand, ctx: GerberState): void;
    flash(center: Point, cmd: GerberCommand, ctx: GerberState): void;
    region(contours: Array<Array<LineSegment | CircleSegment | ArcSegment>>, cmd: GerberCommand, ctx: GerberState): void;
    block(block: Block, cmd: GerberCommand, ctx: GerberState): void;
}
export declare class GerberState {
    private coordinateFormat_;
    private coordinateUnits_;
    private currentPoint_;
    private currentApertureId_;
    interpolationMode: InterpolationMode;
    coordinateMode: CoordinateMode;
    private quadrantMode_;
    objectPolarity: ObjectPolarity;
    objectMirroring: ObjectMirroring;
    objectRotation: number;
    objectScaling: number;
    private apertures;
    private apertureMacros;
    private graphicsOperationsConsumer_;
    private savedGraphicsOperationsConsumer_;
    private blockApertures_;
    private blockParams_;
    private primitives_;
    private isDone_;
    isOutlineMode: boolean;
    get coordinateFormatSpec(): CoordinateFormatSpec;
    set coordinateFormatSpec(value: CoordinateFormatSpec);
    get coordinateUnits(): CoordinateUnits;
    set coordinateUnits(value: CoordinateUnits);
    unitToMM(v: number): number;
    pointToMM(v: Point): Point;
    mmToUnit(v: number): number;
    get currentPointX(): number;
    set currentPointX(value: number);
    get currentPointY(): number;
    set currentPointY(value: number);
    get currentApertureId(): number;
    set currentApertureId(value: number);
    get quadrantMode(): QuadrantMode;
    set quadrantMode(value: QuadrantMode);
    get isDone(): boolean;
    get primitives(): Array<GraphicsPrimitive>;
    getObjectState(): ObjectState;
    getAperture(id: number): ApertureBase;
    getCurrentAperture(): ApertureBase;
    setAperture(ap: ApertureBase): void;
    getApertureMacro(name: string): ApertureMacro;
    setApertureMacro(apm: ApertureMacro): void;
    error(message: string): void;
    warning(message: string): void;
    line(from: Point, to: Point, cmd: GerberCommand): void;
    circle(center: Point, radius: number, cmd: GerberCommand): void;
    arc(center: Point, radius: number, start: Point, end: Point, isCCW: boolean, cmd: GerberCommand): void;
    flash(center: Point, cmd: GerberCommand): void;
    closeRegionContour(): void;
    startRegion(): void;
    endRegion(cmd: GerberCommand): void;
    saveGraphicsConsumer(): void;
    restoreGraphicsConsumer(): void;
    get graphicsOperations(): GraphicsOperations;
    startBlockAperture(blockId: number): void;
    endBlockAperture(): void;
    startRepeat(params: BlockParams): void;
    tryEndRepeat(cmd: GerberCommand): void;
    endRepeat(cmd: GerberCommand): void;
    endFile(cmd: GerberCommand): void;
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
    get width(): number;
    get height(): number;
    toSimpleBounds(): SimpleBounds;
}
export declare class LineSegment {
    readonly from: Point;
    readonly to: Point;
    readonly cmd: GerberCommand;
    constructor(from: Point, to: Point, cmd: GerberCommand);
    toString(): string;
    get bounds(): Bounds;
    translate(vector: Point): LineSegment;
}
export declare class CircleSegment {
    readonly center: Point;
    readonly radius: number;
    readonly cmd: GerberCommand;
    constructor(center: Point, radius: number, cmd: GerberCommand);
    toString(): string;
    get bounds(): Bounds;
    translate(vector: Point): CircleSegment;
}
export declare class ArcSegment {
    readonly center: Point;
    readonly radius: number;
    readonly start: Point;
    readonly end: Point;
    readonly isCCW: boolean;
    readonly cmd: GerberCommand;
    constructor(center: Point, radius: number, start: Point, end: Point, isCCW: boolean, cmd: GerberCommand);
    toString(): string;
    get bounds(): Bounds;
    translate(vector: Point): ArcSegment;
}
export declare type RegionSegment = LineSegment | CircleSegment | ArcSegment;
export declare type RegionContour = Array<RegionSegment>;
export declare class ObjectState {
    readonly polarity: ObjectPolarity;
    readonly mirroring: ObjectMirroring;
    readonly scale: number;
    readonly rotation: number;
    readonly units: CoordinateUnits;
    constructor(polarity?: ObjectPolarity, mirroring?: ObjectMirroring, scale?: number, rotation?: number, units?: CoordinateUnits);
    unitToMM(v: number): number;
    pointToMM(v: Point): Point;
    mmToUnit(v: number): number;
    mmToPoint(v: Point): Point;
}
export declare class Line {
    readonly from: Point;
    readonly to: Point;
    readonly aperture: ApertureBase;
    readonly state: ObjectState;
    readonly cmd: GerberCommand;
    private objects_;
    constructor(from: Point, to: Point, aperture: ApertureBase, state: ObjectState, cmd: GerberCommand);
    toString(): string;
    get objects(): GraphicsObjects;
    get bounds(): Bounds;
    get primitives(): this;
    translate(vector: Point): Line;
}
export declare class Circle {
    readonly center: Point;
    readonly radius: number;
    readonly aperture: ApertureBase;
    readonly state: ObjectState;
    readonly cmd: GerberCommand;
    private objects_;
    constructor(center: Point, radius: number, aperture: ApertureBase, state: ObjectState, cmd: GerberCommand);
    toString(): string;
    get objects(): GraphicsObjects;
    get bounds(): Bounds;
    get primitives(): this;
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
    readonly cmd: GerberCommand;
    private objects_;
    constructor(center: Point, radius: number, start: Point, end: Point, isCCW: boolean, aperture: ApertureBase, state: ObjectState, cmd: GerberCommand);
    toString(): string;
    get objects(): GraphicsObjects;
    get bounds(): Bounds;
    get primitives(): this;
    translate(vector: Point): Arc;
}
export declare class Flash {
    readonly center: Point;
    readonly aperture: ApertureBase;
    readonly state: ObjectState;
    readonly cmd: GerberCommand;
    private objects_;
    constructor(center: Point, aperture: ApertureBase, state: ObjectState, cmd: GerberCommand);
    toString(): string;
    get objects(): GraphicsObjects;
    get bounds(): Bounds;
    get primitives(): this;
    translate(vector: Point): Flash;
}
export declare class Region {
    readonly state: ObjectState;
    readonly cmd: GerberCommand;
    private objects_;
    readonly contours: Array<RegionContour>;
    constructor(contours: Array<RegionContour>, state: ObjectState, cmd: GerberCommand);
    toString(): string;
    private static startPoint;
    private static endPoint;
    private static matchPoint;
    private static reOrderContour;
    private static buildPolygonSet;
    private static buildPolygon;
    get objects(): GraphicsObjects;
    get bounds(): Bounds;
    get primitives(): this;
    translate(vector: Point): Region;
}
export declare class Repeat {
    readonly block: Block;
    readonly xOffset: number;
    readonly yOffset: any;
    readonly cmd: GerberCommand;
    private objects_;
    private primitives_;
    constructor(block: Block, xOffset: number, yOffset: any, cmd: GerberCommand);
    toString(): string;
    get objects(): GraphicsObjects;
    get bounds(): Bounds;
    private buildObjects;
    private buildPrimitives;
    get primitives(): GraphicsPrimitive[];
    translate(vector: Point): Repeat;
}
export declare type GraphicsPrimitive = Line | Circle | Arc | Flash | Region | Repeat;
export declare function EmptyBounds(): Bounds;
export declare class BaseGraphicsOperationsConsumer implements GraphicsOperations {
    private primitives_;
    get primitives(): Array<GraphicsPrimitive>;
    line(from: Point, to: Point, cmd: GerberCommand, ctx: GerberState): void;
    circle(center: Point, radius: number, cmd: GerberCommand, ctx: GerberState): void;
    arc(center: Point, radius: number, start: Point, end: Point, isCCW: boolean, cmd: GerberCommand, ctx: GerberState): void;
    flash(center: Point, cmd: GerberCommand, ctx: GerberState): void;
    region(contours: Array<RegionContour>, cmd: GerberCommand, ctx: GerberState): void;
    block(block: Block, cmd: GerberCommand, ctx: GerberState): void;
}
export declare class BlockGraphicsOperationsConsumer implements GraphicsOperations {
    private objects_;
    private primitives_;
    get primitives(): Array<GraphicsPrimitive>;
    get objects(): GraphicsObjects;
    line(from: Point, to: Point, cmd: GerberCommand, ctx: GerberState): void;
    circle(center: Point, radius: number, cmd: GerberCommand, ctx: GerberState): void;
    arc(center: Point, radius: number, start: Point, end: Point, isCCW: boolean, cmd: GerberCommand, ctx: GerberState): void;
    flash(center: Point, cmd: GerberCommand, ctx: GerberState): void;
    region(contours: Array<RegionContour>, cmd: GerberCommand, ctx: GerberState): void;
    block(block: Block, cmd: GerberCommand, ctx: GerberState): void;
}
export declare function composeSolidImage(objects: GraphicsObjects, union?: boolean): PolygonSetWithBounds;
export interface GerberCommand {
    readonly name: string;
    readonly lineNo?: number;
    readonly isAdvanced: boolean;
    formatOutput(fmt: CoordinateFormatSpec): string;
    execute(ctx: GerberState): void;
}
export declare const Epsilon = 1e-12;
