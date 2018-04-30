/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */

/**
 * This file contains some classes that abstract primitives in the Gerber
 * file format.
 * 
 * Some of these are for internal consumption.
 */

import {formatFloat} from "./utils";
import {
    vectorLength,
    scaleVector,
    unitVector,
    addVector,
    negVector,
} from "./vectorUtils";
import {
    AritmeticOperation,
    Memory} from "./expressions";
import {
    Polygon,
    PolygonSet,
    translatePolygon,
    translatePolySet,
    rotatePolygon,
    rotatePolySet,
    mirrorPolySet,
    polySetBounds,
    unionPolygonSet,
    subtractPolygonSet,
    scalePolySet,
    mirrorPolygon,
    objectsBounds,
    translateObjects,
    distance2,
    PolygonSetWithBounds,
    copyObjects,
} from "./polygonSet";
import {Point} from "./point";
import {
    arcToPolygon,
    circleToPolygon,
    rectangleToPolygon,
    obroundToPolygon,
    NUMSTEPS,
    reversePolygon,
} from "./polygonTools";

export enum CoordinateUnits {
    INCHES,
    MILIMETERS
}

export enum InterpolationMode {
    LINEARx1,
    LINEARx10,
    LINEARx01,
    LINEARx001,
    CLOCKWISE,
    COUNTER_CLOCKWISE
}

export enum CoordinateMode {
    ABSOLUTE,
    RELATIVE
}

export enum QuadrantMode {
    SINGLE,
    MULTI
}

export enum ObjectPolarity {
    DARK,
    LIGHT,
    THIN
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

export type PolyongWithThinkness = {polygon:Polygon, is_solid:boolean};
export type PolyongSetWithThinkness = {polygonSet:PolygonSet, is_solid:boolean};
export type PolySetWithPolarity = {polySet:PolygonSet, polarity:ObjectPolarity};
export type GraphicsObjects = Array<PolySetWithPolarity>;

function reversePolarity(polarity:ObjectPolarity):ObjectPolarity {
    switch (polarity) {
        case ObjectPolarity.DARK:
            return ObjectPolarity.LIGHT;
        case ObjectPolarity.LIGHT:
            return ObjectPolarity.DARK;
        case ObjectPolarity.THIN:
            return ObjectPolarity.THIN;
    }
}

function reverseObjectsPolarity(objects:GraphicsObjects):GraphicsObjects {
    return objects.map(o => {
        return {polySet:o.polySet, polarity:reversePolarity(o.polarity)};
    });
}

function polygonOrientation(polygon:Float64Array):number {
    let sum = 0;
    if (polygon.length < 6) return 0;
    let startx = polygon[0];
    let starty = polygon[1];
    let endx:number;
    let endy:number;
    for (let idx = 2; idx < polygon.length; idx += 2) {
        endx = polygon[idx];
        endy = polygon[idx + 1];
        sum += (endx - startx) * (endy + starty);
        startx = endx;
        starty = endy;
    }
    // Close to the start
    endx = polygon[0];
    endy = polygon[1];
    sum += (endx - startx) * (endy + starty);
    return sum;
}

export enum CoordinateSkipZeros {
    NONE = 0,
    LEADING = 1,
    TRAILING = 2,
    DIRECT = 3
}

export enum CoordinateType {
    ABSOLUTE = 1,
    INCREMENTAL = 2
}

export class CoordinateFormatSpec {
    readonly xPow:number;  // The power of 1 to multiply the X coordinate by 10^(-xNumDecPos)
    readonly yPow:number;  // The power of 1 to multiply the Y coordinate by 10^(-yNumDecPos)

    constructor(
        readonly coordFormat:CoordinateSkipZeros,
        readonly coordType:CoordinateType,
        readonly xNumIntPos:number,
        readonly xNumDecPos:number,
        readonly yNumIntPos:number,
        readonly yNumDecPos:number) {
            this.xPow = Math.pow(10, -this.xNumDecPos);
            this.yPow = Math.pow(10, -this.yNumDecPos);
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

export interface ApertureBase {
    readonly apertureId:number;
    
    isDrawable():boolean;
    objects(polarity:ObjectPolarity):GraphicsObjects;
    generateArcDraw(start:Point, end:Point, center:Point, state:ObjectState):PolyongWithThinkness;
    generateCircleDraw(center:Point, radius:number, state:ObjectState):PolyongSetWithThinkness;
    generateLineDraw(start:Point, end:Point, state:ObjectState):PolyongWithThinkness;
}

export class BlockAperture implements ApertureBase {
    private objects_:GraphicsObjects;

    constructor(
        readonly apertureId:number,
        objects:GraphicsObjects) {
        this.objects_ = objects;
    }

    isDrawable():boolean {
        return false;
    }

    objects(polarity:ObjectPolarity):GraphicsObjects {
        if (polarity === ObjectPolarity.LIGHT) {
            return reverseObjectsPolarity(this.objects_);
        }
        return this.objects_;
    }

    generateArcDraw(start:Point, end:Point, center:Point, state:ObjectState):PolyongWithThinkness {
        throw new GerberParseException("Draw with block aperture is not supported.");
    }

    generateCircleDraw(center:Point, radius:number, state:ObjectState):PolyongSetWithThinkness {
        throw new GerberParseException("Draw with block aperture is not supported.");
    }

    generateLineDraw(start:Point, end:Point, state:ObjectState):PolyongWithThinkness {
        throw new GerberParseException("Draw with block aperture is not supported.");
    }
}

export class ApertureDefinition implements ApertureBase {
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

    generateArcDraw(start:Point, end:Point, center:Point, state:ObjectState):PolyongWithThinkness {
        let result:Polygon;
        if (start.distance(end) < Epsilon) {
            if (this.templateName == "C" || this.templateName == "O") {
                let radius = state.scale * this.modifiers[0] / 2;
                if (radius < Epsilon) {
                    return {polygon:Float64Array.of(), is_solid:false};
                }
                let polygon = circleToPolygon(radius);
                translatePolygon(polygon, start.midPoint(end));
                return {polygon:polygon, is_solid:true};
            } else if (this.templateName == "R") {
                let polygon = rectangleToPolygon(
                    state.scale * this.modifiers[0],
                    state.scale * this.modifiers[1]);
                translatePolygon(polygon, start.midPoint(end))
                return {polygon:polygon, is_solid:true};
            }
            throw new GerberParseException(`Draw with this aperture is not supported. ${this.templateName}`);
        }
        let startVector = {x:start.x - center.x, y:start.y - center.y};
        let endVector = {x:end.x - center.x, y:end.y - center.y};
        // This is the radius of the aperture, not the arc itself
        let apertureRadius = state.scale * this.modifiers[0] / 2;
        let rStartVector = scaleVector(unitVector(startVector), apertureRadius);
        let rEndVector = scaleVector(unitVector(endVector), apertureRadius);
        let innerStartVector = addVector(startVector, negVector(rStartVector));
        let outerStartVector = addVector(startVector, rStartVector);
        let innerEndVector = addVector(endVector, negVector(rEndVector));
        let outerEndVector = addVector(endVector, rEndVector);
        let innerStart = new Point(innerStartVector.x + center.x, innerStartVector.y + center.y);
        let outerStart = new Point(outerStartVector.x + center.x, outerStartVector.y + center.y);
        let innerEnd = new Point(innerEndVector.x + center.x, innerEndVector.y + center.y);
        let outerEnd = new Point(outerEndVector.x + center.x, outerEndVector.y + center.y);
        if (this.templateName == "C" || this.templateName == "O") {
            if (apertureRadius < Epsilon) {
                return {polygon:arcToPolygon(start, end, center), is_solid:false};
            }
            result = new Float64Array(NUMSTEPS * 8 - 6);
            result.set(arcToPolygon(innerStart, outerStart, innerStart.midPoint(outerStart), false));
            result.set(arcToPolygon(outerStart, outerEnd, center, false), NUMSTEPS * 2 - 2);
            result.set(arcToPolygon(outerEnd, innerEnd, outerEnd.midPoint(innerEnd), false), NUMSTEPS * 4 - 4);
            let closingArc = arcToPolygon(innerStart, innerEnd, center);
            reversePolygon(closingArc);
            result.set(closingArc, NUMSTEPS * 6 - 6);
            return {polygon:result, is_solid:true};
        } else if (this.templateName == "R") {
            if (Math.abs(state.rotation) > Epsilon
                || state.mirroring != ObjectMirroring.NONE) {
                throw new GerberParseException(`Unimplemented rotation or mirroring with rectangular apertures`)
            }
            let startLine = {x:outerStart.x - innerStart.x, y:outerStart.y - innerStart.y};
            let endLine = {x:outerEnd.x - innerEnd.x, y:outerEnd.y - innerEnd.y};
            let pStartLineCCW = scaleVector(unitVector({x:startLine.y, y:-startLine.x}), this.modifiers[1]);
            let pEncLineCW = scaleVector(unitVector({x:-endLine.y, y:endLine.x}), this.modifiers[1]);
            result = new Float64Array(10 + NUMSTEPS * 4);
            result[0] = innerStart.x;
            result[1] = innerStart.y;
            result[2] = innerStart.x + pStartLineCCW.x;
            result[3] = innerStart.y + pStartLineCCW.y;
            result[4] = outerStart.x + pStartLineCCW.x;
            result[5] = outerStart.y + pStartLineCCW.y;
            result.set(arcToPolygon(outerStart, outerEnd, center, false), 6);
            result[4 + NUMSTEPS * 2] = outerEnd.x;
            result[5 + NUMSTEPS * 2] = outerEnd.y;
            result[6 + NUMSTEPS * 2] = outerEnd.x + pEncLineCW.x;
            result[7 + NUMSTEPS * 2] = outerEnd.y + pEncLineCW.y;
            result[8 + NUMSTEPS * 2] = innerEnd.x + pEncLineCW.x;
            result[9 + NUMSTEPS * 2] = innerEnd.y + pEncLineCW.y;
            let closingArc = arcToPolygon(innerStart, innerEnd, center);
            reversePolygon(closingArc);
            result.set(closingArc, 10 + NUMSTEPS * 2);
            return {polygon:result, is_solid:true};
        }
        throw new GerberParseException(`Draw with this aperture is not supported. ${this.templateName}`);
    }

    generateCircleDraw(center:Point, radius:number, state:ObjectState):PolyongSetWithThinkness {
        if (this.templateName == "C" || this.templateName == "O" || this.templateName == "R") {
            let result:PolygonSet = [];
            let apertureRadius = state.scale * this.modifiers[0] / 2;
            if (apertureRadius < Epsilon) {
                let polygon = circleToPolygon(radius);
                translatePolygon(polygon, center)
                return {polygonSet:[polygon], is_solid:false};
            }
            let polygon = circleToPolygon(radius + apertureRadius);
            translatePolygon(polygon, center)
            result.push(polygon);
            let innerCircle = circleToPolygon(radius - apertureRadius);
            translatePolygon(innerCircle, center);
            reversePolygon(innerCircle);
            result.push(innerCircle);
            return {polygonSet:result, is_solid:true};
        }
        throw new GerberParseException(`Draw with this aperture is not supported. ${this.templateName}`);
    }

    generateLineDraw(start:Point, end:Point, state:ObjectState):PolyongWithThinkness {
        let result:Polygon;
        if (start.distance(end) < Epsilon) {
            if (this.templateName == "C" || this.templateName == "O") {
                let radius = state.scale * this.modifiers[0] / 2;
                if (radius < Epsilon) {
                    return {polygon:Float64Array.of(), is_solid:false};
                }
                let polygon = circleToPolygon(radius);
                translatePolygon(polygon, start.midPoint(end));
                return {polygon: polygon, is_solid:true};
            } else if (this.templateName == "R") {
                let polygon = rectangleToPolygon(
                    state.scale * this.modifiers[0],
                    state.scale * this.modifiers[1]);
                mirrorPolygon(polygon, state.mirroring);
                rotatePolygon(polygon, state.rotation);
                translatePolygon(polygon, start.midPoint(end));
                return {polygon:polygon, is_solid:true};
            }
            throw new GerberParseException(`Draw with this aperture is not supported. ${this.templateName}`);
        }
        let angle = start.angleFrom(end);

        if (this.templateName == "C" || this.templateName == "O") {
            let radius = state.scale * this.modifiers[0] / 2;
            if (radius < Epsilon) {
                return {polygon: Float64Array.of(start.x, start.y, end.x, end.y), is_solid:false};
            }
            let vector = {x:end.x - start.x, y:end.y - start.y};
            let uVector = unitVector(vector);

            let pCW = scaleVector({x:uVector.y, y:-uVector.x}, radius);
            let pCCW = scaleVector({x:-uVector.y, y:uVector.x}, radius);

            let startLeft = addVector({x:start.x, y:start.y}, pCCW);
            let endLeft = addVector(startLeft, vector);
            let startRight = addVector({x:start.x, y:start.y}, pCW);
            let endRight = addVector(startRight, vector);
            result = new Float64Array(NUMSTEPS * 4 + 2);
            result.set(arcToPolygon(
                new Point(startLeft.x, startLeft.y),
                new Point(startRight.x, startRight.y),
                start));
            result.set(arcToPolygon(
                new Point(endRight.x, endRight.y),
                new Point(endLeft.x, endLeft.y),
                end),
                NUMSTEPS * 2);
            result[NUMSTEPS * 4] = startLeft.x;
            result[NUMSTEPS * 4 + 1] = startLeft.y;
            return {polygon:result, is_solid:true};
        } else if (this.templateName == "R") {
            if (Math.abs(state.rotation) > Epsilon
                || state.mirroring != ObjectMirroring.NONE) {
                throw new GerberParseException(`Unimplemented rotation or mirroring with rectangular apertures`)
            }
            let width2 = state.scale * this.modifiers[0] / 2;
            let height2 = state.scale * this.modifiers[1] / 2;
            if (Math.abs(start.x - end.x) < Epsilon) { // Vertical Line
                let polygon = rectangleToPolygon(this.modifiers[0], Math.abs(end.y - start.y) + this.modifiers[1]);
                translatePolygon(polygon, start.midPoint(end));
                return {polygon:polygon, is_solid:true};
            } else if (Math.abs(start.y - end.y) < Epsilon) { // Horizontal Line
                let polygon = rectangleToPolygon(Math.abs(end.x - start.x) + this.modifiers[0], this.modifiers[1]);
                translatePolygon(polygon, start.midPoint(end));
                return {polygon:polygon, is_solid:true};
            } else {
                let vector = {x:end.x - start.x, y:end.y - start.y};
                if (angle < Math.PI / 2) {
                    result = Float64Array.of(
                        start.x - width2, start.y - height2,
                        start.x + width2, start.y - height2,
                        end.x + width2, end.y - height2,
                        end.x + width2, end.y + height2,
                        end.x - width2, end.y + height2,
                        start.x - width2, start.y + height2,
                        start.x - width2, start.y - height2);
                } else if (angle < Math.PI) {
                    result = Float64Array.of(
                        start.x - width2, start.y - height2,
                        start.x + width2, start.y - height2,
                        start.x + width2, start.y + height2,
                        end.x + width2, end.y + height2,
                        end.x - width2, end.y + height2,
                        end.x - width2, end.y - height2,
                        start.x - width2, start.y - height2);
                } else if (angle < 3 * Math.PI / 2) {
                    result = Float64Array.of(
                        end.x - width2, end.y - height2,
                        end.x + width2, end.y - height2,
                        start.x + width2, start.y - height2,
                        start.x + width2, start.y + height2,
                        start.x - width2, start.y + height2,
                        end.x - width2, end.y + height2,
                        end.x - width2, end.y - height2);
                } else {
                    result = Float64Array.of(
                        end.x - width2, end.y - height2,
                        end.x + width2, end.y - height2,
                        end.x + width2, end.y + height2,
                        start.x + width2, start.y + height2,
                        start.x - width2, start.y + height2,
                        start.x - width2, start.y - height2,
                        start.x - width2, start.y - height2);
                }
                return {polygon:result, is_solid:true};
            }
        }
        throw new GerberParseException(`Draw with this aperture is not supported. ${this.templateName}`);
    }

    objects(polarity:ObjectPolarity):GraphicsObjects {
        return [{polySet:this.toPolySet(), polarity:polarity}];
    }

    toPolySet():PolygonSet {
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
            if (this.modifiers.length == 2 && this.modifiers[1] > Epsilon) {
                let hole = circleToPolygon(this.modifiers[1] / 2);
                reversePolygon(hole);
                result.push(hole);
            } else if (this.modifiers.length == 3 && this.modifiers[1] > Epsilon && this.modifiers[2] > Epsilon) {
                let hole = rectangleToPolygon(this.modifiers[1], this.modifiers[2]);
                reversePolygon(hole);
                result.push(hole);
            }
        } else if (this.templateName === "R") {
            result.push(rectangleToPolygon(this.modifiers[0], this.modifiers[1]));
            if (this.modifiers.length == 3 && this.modifiers[2] > Epsilon) {
                let hole = circleToPolygon(this.modifiers[2] / 2);
                reversePolygon(hole);
                result.push(hole);
            } else if (this.modifiers.length == 4 && this.modifiers[2] > Epsilon && this.modifiers[3] > Epsilon) {
                let hole = rectangleToPolygon(this.modifiers[2], this.modifiers[3]);
                reversePolygon(hole);
                result.push(hole);
            }
        } else if (this.templateName === "O") {
            result.push(obroundToPolygon(this.modifiers[0], this.modifiers[1]));
            if (this.modifiers.length == 3 && this.modifiers[2] > Epsilon) {
                let hole = circleToPolygon(this.modifiers[2] / 2);
                reversePolygon(hole);
                result.push(hole);
            } else if (this.modifiers.length == 4 && this.modifiers[3] > Epsilon && this.modifiers[4] > Epsilon) {
                let hole = rectangleToPolygon(this.modifiers[2], this.modifiers[3]);
                reversePolygon(hole);
                result.push(hole);
            }
        } else if (this.templateName === "P") {
            if (this.modifiers.length == 2) {
                result.push(circleToPolygon(this.modifiers[0] / 2, this.modifiers[1]));
            } else if (this.modifiers.length > 2) {
                result.push(circleToPolygon(this.modifiers[0] / 2, this.modifiers[1], this.modifiers[2]));
            }
            if (this.modifiers.length == 4 && this.modifiers[3] > Epsilon) {
                let hole = circleToPolygon(this.modifiers[3] / 2);
                reversePolygon(hole);
                result.push(hole);
            } else if (this.modifiers.length == 5 && this.modifiers[3] > Epsilon && this.modifiers[4] > Epsilon) {
                let hole = rectangleToPolygon(this.modifiers[3], this.modifiers[4]);
                reversePolygon(hole);
                result.push(hole);
            }
        } else {
            return this.macro.toPolygonSet(this.modifiers);
        }
        this.polygonSet_ = result;
        return result;
    }
}

export class VariableDefinition {
    constructor(readonly id:number, readonly expression:AritmeticOperation) {
    }
}

export class Primitive {
    constructor(
        readonly code:number,
        readonly modifiers:Array<AritmeticOperation>) {
    }
}

export class PrimitiveComment {
    constructor(
        readonly text:string) {
    }
}

export class ApertureMacro {
    constructor(
        readonly macroName:string,
        readonly content:Array<VariableDefinition|Primitive|PrimitiveComment>) {
    }

    toPolygonSet(modifiers:Array<number>):PolygonSet {
        let positives:PolygonSet = [];
        let negatives:PolygonSet = [];

        let memory = new Memory(modifiers);
        for (let element of this.content) {
            if (element instanceof PrimitiveComment) {
                continue;
            } else if (element instanceof VariableDefinition) {
                let variable = element as VariableDefinition;
                memory.set(variable.id, variable.expression.getValue(memory));
                continue;
            } else {
                let primitive = element as Primitive;
                let modifiers = primitive.modifiers.map(m => m.getValue(memory));
                let numModifiers = modifiers.length;
                let shape:PolygonSet;
                let isPositive:boolean;
                let center:Point;
                let diameter:number;
                let rotation:number;
                let gap:number;
                let outerDiameter:number;
                let width:number;
                let height:number;
                switch (primitive.code) {
                    case 1: // Circle (exposure, diameter, center x, center y, rotation)
                        isPositive =  ApertureMacro.getValue(modifiers, 0) != 0;
                        diameter = ApertureMacro.getValue(modifiers, 1);
                        center = new Point(ApertureMacro.getValue(modifiers, 2), ApertureMacro.getValue(modifiers, 3));
                        if (diameter > Epsilon) {
                            let polygon = circleToPolygon(diameter / 2);
                            translatePolygon(polygon, center);
                            rotatePolygon(polygon, ApertureMacro.getValue(modifiers, 4));
                            shape = [polygon];
                        } else {
                            shape = [];
                            //console.log("Empty circle shape");
                        }
                        break;

                    case 4: // Outline (exposure, num vertices, start x, start y, ..., (3+2n) end x, 4+2n end y, rotation)
                        isPositive =  ApertureMacro.getValue(modifiers, 0) != 0; 
                        let numPoints = ApertureMacro.getValue(modifiers, 1);
                        if (numPoints < 1) {
                            throw new GerberParseException(`Invalid number of points in a macro outline ${numPoints}`);
                        }
                        let outline = new Float64Array(numPoints * 2 + 2);
                        for (let idx = 0; idx <= numPoints; idx++) {
                            outline[idx * 2] = ApertureMacro.getValue(modifiers, 2 * idx + 2);
                            outline[idx * 2 + 1] = ApertureMacro.getValue(modifiers, 2 * idx + 3);
                        }
                        // If the contour is clockwise, reverse the polygon.
                        if (polygonOrientation(outline) > 0) {
                            reversePolygon(outline);
                        }
                        
                        rotatePolygon(outline, ApertureMacro.getValue(modifiers, 2 * numPoints + 4));
                        shape = [outline];
                        break;

                    case 5: // Polygon (exposure, num vertices, center x, center y, diameter, rotation)
                        isPositive =  ApertureMacro.getValue(modifiers, 0) != 0;
                        let numSteps = ApertureMacro.getValue(modifiers, 1);
                        center = new Point(ApertureMacro.getValue(modifiers, 2), ApertureMacro.getValue(modifiers, 3));
                        diameter = ApertureMacro.getValue(modifiers, 4);
                        if (numSteps < 3) {
                            throw new GerberParseException(`Invalid number of steps in a macro polygon ${numSteps}`);
                        }
                        if (diameter > Epsilon) {
                            let polygon = circleToPolygon(diameter / 2, numSteps);
                            translatePolygon(polygon, center);
                            rotatePolygon(polygon, ApertureMacro.getValue(modifiers, 5));
                            shape = [polygon];
                        } else {
                            shape = [];
                            //console.log("Empty polygon shape");
                        }
                        break;

                    case 6: // Moire (center x, center y, outer diam, ring thickness, gap, num rings, cross hair thickness, cross hair len, rotation)
                            // exposure is always on
                        isPositive = true;
                        shape = [];
                        center = new Point(ApertureMacro.getValue(modifiers, 0), ApertureMacro.getValue(modifiers, 1));
                        outerDiameter = ApertureMacro.getValue(modifiers, 2);
                        let ringThickness = ApertureMacro.getValue(modifiers, 3);
                        gap = ApertureMacro.getValue(modifiers, 4);
                        let maxRings = ApertureMacro.getValue(modifiers, 5);
                        let crossThickness = ApertureMacro.getValue(modifiers, 6);
                        let crossLen = ApertureMacro.getValue(modifiers, 7);
                        rotation = ApertureMacro.getValue(modifiers, 8);
                        if (ringThickness > Epsilon) {
                            for (let ringNo = 0; ringNo < maxRings && outerDiameter > Epsilon; ringNo++) {
                                let innerDiameter = outerDiameter - ringThickness * 2;
                                let polygon = circleToPolygon(outerDiameter / 2);
                                translatePolygon(polygon, center);
                                rotatePolygon(polygon, rotation)
                                shape.push(polygon);
                                if (innerDiameter > Epsilon) {
                                    let closingCircle = circleToPolygon(innerDiameter / 2);
                                    reversePolygon(closingCircle);
                                    translatePolygon(closingCircle, center);
                                    rotatePolygon(closingCircle, rotation)
                                    shape.push(closingCircle);
                                }
                                outerDiameter = innerDiameter - gap * 2;
                            }
                        }
                        if (crossLen > Epsilon && crossThickness > Epsilon) {
                            let hLine = rectangleToPolygon(crossLen, crossThickness);
                            let vLine = rectangleToPolygon(crossThickness, crossLen);
                            translatePolygon(hLine, center);
                            translatePolygon(vLine, center);
                            rotatePolygon(hLine, rotation);
                            rotatePolygon(vLine, rotation);
                            shape.push(hLine);
                            shape.push(vLine);
                            //shape = unionPolygonSet(shape, []).polygonSet;
                        }
                        if (shape.length < 1) {
                            //console.log("Empty moire shape");
                        }
                        break;

                    case 7: // Thermal (center x, center y, outer diam, inner diam, gap, rotation)
                        isPositive = true;
                        center = new Point(ApertureMacro.getValue(modifiers, 0), ApertureMacro.getValue(modifiers, 1));
                        outerDiameter = ApertureMacro.getValue(modifiers, 2);
                        let innerDiameter = ApertureMacro.getValue(modifiers, 3);
                        gap = ApertureMacro.getValue(modifiers, 4);
                        let gap2 = gap / 2;
                        let innerRadius = innerDiameter / 2;
                        let outerRadius = outerDiameter / 2;
                        rotation = ApertureMacro.getValue(modifiers, 5);
                        if (outerDiameter <= innerDiameter) {
                            throw new GerberParseException(`Invalid thermal shape outer=${outerDiameter}, inner=${innerDiameter}`);
                        }
                        if (gap >= outerDiameter / Math.sqrt(2)) {
                            throw new GerberParseException(`Invalid thermal shape outer=${outerDiameter}, gap=${gap}`);
                        }
                        shape = [];
                        let polygon:Polygon;
                        if (outerDiameter > Epsilon) {
                            if (gap > Epsilon) {
                                if (innerDiameter > Epsilon) {
                                    // Quadrant 1 shape
                                    polygon = new Float64Array(2 + NUMSTEPS * 4);
                                    let innerStart = new Point(innerRadius + center.x, gap2 + center.y);
                                    let outerStart = new Point(outerRadius + center.x, gap2 + center.y);
                                    let innerEnd = new Point(gap2 + center.x, innerRadius + center.y);
                                    let outerEnd = new Point(gap2 + center.x, outerRadius + center.y);
                                    polygon[0] = innerStart.x;
                                    polygon[1] = innerStart.y;
                                    polygon.set(arcToPolygon(outerStart, outerEnd, center), 2);
                                    let closingArc = arcToPolygon(innerStart, innerEnd, center);
                                    reversePolygon(closingArc);
                                    polygon.set(closingArc, 2 + NUMSTEPS * 2);
                                    rotatePolygon(polygon, rotation);
                                    shape.push(polygon);

                                    // Quadrant 2 shape
                                    polygon = new Float64Array(2 + NUMSTEPS * 4);
                                    innerStart = new Point(-gap2 + center.x, innerRadius + center.y);
                                    outerStart = new Point(-gap2 + center.x, outerRadius + center.y);
                                    innerEnd = new Point(-innerRadius + center.x, gap2 + center.y);
                                    outerEnd = new Point(-outerRadius + center.x, gap2 + center.y);
                                    polygon[0] = innerStart.x;
                                    polygon[1] = innerStart.y;
                                    polygon.set(arcToPolygon(outerStart, outerEnd, center), 2);
                                    closingArc = arcToPolygon(innerStart, innerEnd, center);
                                    reversePolygon(closingArc);
                                    polygon.set(closingArc, 2 + NUMSTEPS * 2);
                                    rotatePolygon(polygon, rotation);
                                    shape.push(polygon);

                                    // Quadrant 3 shape
                                    polygon = new Float64Array(2 + NUMSTEPS * 4);
                                    innerStart = new Point(-innerRadius + center.x, -gap2 + center.y);
                                    outerStart = new Point(-outerRadius + center.x, -gap2 + center.y);
                                    innerEnd = new Point(-gap2 + center.x, -innerRadius + center.y);
                                    outerEnd = new Point(-gap2 + center.x, -outerRadius + center.y);
                                    polygon[0] = innerStart.x;
                                    polygon[1] = innerStart.y;
                                    polygon.set(arcToPolygon(outerStart, outerEnd, center), 2);
                                    closingArc = arcToPolygon(innerStart, innerEnd, center);
                                    reversePolygon(closingArc);
                                    polygon.set(closingArc, 2 + NUMSTEPS * 2);
                                    rotatePolygon(polygon, rotation);
                                    shape.push(polygon);

                                    // Quadrant 4 shape
                                    polygon = new Float64Array(2 + NUMSTEPS * 4);
                                    innerStart = new Point(gap2 + center.x, -innerRadius + center.y);
                                    outerStart = new Point(gap2 + center.x, -outerRadius + center.y);
                                    innerEnd = new Point(innerRadius + center.x, -gap2 + center.y);
                                    outerEnd = new Point(outerRadius + center.x, -gap2 + center.y);
                                    polygon[0] = innerStart.x;
                                    polygon[1] = innerStart.y;
                                    polygon.set(arcToPolygon(outerStart, outerEnd, center), 2);
                                    closingArc = arcToPolygon(innerStart, innerEnd, center);
                                    reversePolygon(closingArc);
                                    polygon.set(closingArc, 2 + NUMSTEPS * 2);
                                    rotatePolygon(polygon, rotation);
                                    shape.push(polygon);
                                } else {
                                    // Quadrant 1 shape
                                    polygon = new Float64Array(4 + NUMSTEPS * 2);
                                    let innerPoint = new Point(gap2 + center.x, gap2 + center.y);
                                    let outerStart = new Point(outerRadius + center.x, gap2 + center.y);
                                    let outerEnd = new Point(gap2 + center.x, outerRadius + center.y);
                                    polygon[0] = innerPoint.x;
                                    polygon[1] = innerPoint.y;
                                    polygon.set(arcToPolygon(outerStart, outerEnd, center), 2);
                                    polygon[2 + NUMSTEPS * 2] = innerPoint.x;
                                    polygon[3 + NUMSTEPS * 2] = innerPoint.y;
                                    rotatePolygon(polygon, rotation);
                                    shape.push(polygon);

                                    // Quadrant 2 shape
                                    polygon = new Float64Array(4 + NUMSTEPS * 2);
                                    innerPoint = new Point(-gap2 + center.x, gap2 + center.y);
                                    outerStart = new Point(-gap2 + center.x, outerRadius + center.y);
                                    outerEnd = new Point(-outerRadius + center.x, gap2 + center.y);
                                    polygon[0] = innerPoint.x;
                                    polygon[1] = innerPoint.y;
                                    polygon.set(arcToPolygon(outerStart, outerEnd, center), 2);
                                    polygon[2 + NUMSTEPS * 2] = innerPoint.x;
                                    polygon[3 + NUMSTEPS * 2] = innerPoint.y;
                                    rotatePolygon(polygon, rotation);
                                    shape.push(polygon);

                                    // Quadrant 3 shape
                                    polygon = new Float64Array(4 + NUMSTEPS * 2);
                                    innerPoint = new Point(-gap2 + center.x, -gap2 + center.y);
                                    outerStart = new Point(-outerRadius + center.x, -gap2 + center.y);
                                    outerEnd = new Point(-gap2 + center.x, -outerRadius + center.y);
                                    polygon[0] = innerPoint.x;
                                    polygon[1] = innerPoint.y;
                                    polygon.set(arcToPolygon(outerStart, outerEnd, center), 2);
                                    polygon[2 + NUMSTEPS * 2] = innerPoint.x;
                                    polygon[3 + NUMSTEPS * 2] = innerPoint.y;
                                    rotatePolygon(polygon, rotation);
                                    shape.push(polygon);

                                    // Quadrant 4 shape
                                    polygon = new Float64Array(4 + NUMSTEPS * 2);
                                    innerPoint = new Point(gap2 + center.x, -gap2 + center.y);
                                    outerStart = new Point(gap2 + center.x, -outerRadius + center.y);
                                    outerEnd = new Point(outerRadius + center.x, -gap2 + center.y);
                                    polygon[0] = innerPoint.x;
                                    polygon[1] = innerPoint.y;
                                    polygon.set(arcToPolygon(outerStart, outerEnd, center), 2);
                                    polygon[2 + NUMSTEPS * 2] = innerPoint.x;
                                    polygon[3 + NUMSTEPS * 2] = innerPoint.y;
                                    rotatePolygon(polygon, rotation);
                                    shape.push(polygon);
                                }
                            } else {
                                let circle = circleToPolygon(outerRadius);
                                translatePolygon(circle, center);
                                rotatePolygon(circle, rotation);
                                shape.push(circle);
                                if (innerDiameter > Epsilon) {
                                    let closingCircle = circleToPolygon(innerRadius);
                                    reversePolygon(closingCircle);
                                    translatePolygon(closingCircle, center);
                                    rotatePolygon(closingCircle, rotation)
                                    shape.push(closingCircle);
                                }
                            }
                        } else {
                            shape = [];
                            //console.log("Empty thermal shape");
                        }
                        break;

                    case 20: // Vector line (exposure, width, start x, start y, end x, end y, rotation)
                        isPositive = ApertureMacro.getValue(modifiers, 0) != 0;
                        width = ApertureMacro.getValue(modifiers, 1);
                        let centerStart = new Point(ApertureMacro.getValue(modifiers, 2), ApertureMacro.getValue(modifiers, 3));
                        let centerEnd = new Point(ApertureMacro.getValue(modifiers, 4), ApertureMacro.getValue(modifiers, 5));
                        rotation = ApertureMacro.getValue(modifiers, 6);
                        let direction = unitVector(
                            {x:centerEnd.x - centerStart.x, y:centerEnd.y - centerStart.y});
                        let dirNormalCCW = scaleVector({x:-direction.y, y:direction.x}, width);
                        let startLeft = new Point(
                            centerStart.x + dirNormalCCW.x,
                            centerStart.y + dirNormalCCW.y);
                        let startRight = new Point(
                            centerStart.x - dirNormalCCW.x,
                            centerStart.y - dirNormalCCW.y);
                        let endLeft = new Point(
                            centerEnd.x + dirNormalCCW.x,
                            centerEnd.y + dirNormalCCW.y);
                        let endRight = new Point(
                            centerEnd.x - dirNormalCCW.x,
                            centerEnd.y - dirNormalCCW.y);
                        let line = Float64Array.of(
                            startLeft.x, startLeft.y,
                            startRight.x, startRight.y,
                            endRight.x, endRight.y,
                            endLeft.x, endLeft.y, 
                            startLeft.x, startLeft.y);
                        rotatePolygon(line, rotation);
                        shape = [line];
                        break;
    
                    case 21: // Center line (exposure, width, height, center x, center y, rotation)
                        isPositive =  ApertureMacro.getValue(modifiers, 0) != 0;
                        width = ApertureMacro.getValue(modifiers, 1);
                        height = ApertureMacro.getValue(modifiers, 2);
                        center = new Point(ApertureMacro.getValue(modifiers, 3), ApertureMacro.getValue(modifiers, 4));
                        rotation = ApertureMacro.getValue(modifiers, 5);
                        if (width > Epsilon && height > Epsilon) {
                            let line = rectangleToPolygon(width, height);
                            translatePolygon(line, center);
                            rotatePolygon(line, rotation);
                            shape = [line];
                        } else {
                            shape = [];
                            //console.log("Empty center line shape");
                        }
                        break;
                    default:
                        throw new GerberParseException(`Unsupported macro primitive ${primitive.code}`);
                }
                if (isPositive) {
                    positives.push(...shape);
                } else {
                    negatives.push(...shape);
                }
            }
        }
        if (negatives.length > 0) {
            return subtractPolygonSet(positives, negatives).polygonSet;
        }
        return positives;
    }

    private static getValue(modifiers:Array<number>, idx:number):number {
        let r = modifiers[idx];
        if (r === undefined) {
            return 0;
        }
        return r;
    }
}

export class Attribute {
    constructor(
        readonly type:AttributeType,
        readonly name:string,
        readonly fields:string[]) {
    }
}

export class BlockParams {
    constructor(
        readonly xRepeat:number,
        readonly yRepeat:number,
        readonly xDelta:number,
        readonly yDelta:number) {
    }
}

export class Block {
    constructor(
        readonly xRepeat:number,
        readonly yRepeat:number,
        readonly xDelta:number,
        readonly yDelta:number,
        readonly primitives:Array<GraphicsPrimitive>,
        readonly objects:GraphicsObjects) {
    }
}

export interface GraphicsOperations {
    line(from:Point, to:Point, cmd:GerberCommand, ctx:GerberState):void;
    circle(center:Point, radius:number, cmd:GerberCommand, ctx:GerberState):void;
    arc(
        center:Point,
        radius:number,
        start:Point,
        end:Point,
        isCCW:boolean,
        cmd:GerberCommand,
        ctx:GerberState):void;
    flash(center:Point, cmd:GerberCommand, ctx:GerberState):void;
    region(
        contours:Array<Array<LineSegment|CircleSegment|ArcSegment>>,
        cmd:GerberCommand,
        ctx:GerberState):void;
    block(block:Block, cmd:GerberCommand, ctx:GerberState):void;
}

export class GerberState {
    private coordinateFormat_:CoordinateFormatSpec = undefined;
    private coordinateUnits_:CoordinateUnits = undefined;
    private currentPoint_:Point = new Point();
    private currentCenterOffset_:Point = new Point();
    private currentAppretureId_:number = undefined;
    public interpolationMode:InterpolationMode = InterpolationMode.LINEARx1;
    public coordinateMode:CoordinateMode = CoordinateMode.ABSOLUTE;
    private quadrantMode_:QuadrantMode = undefined;
    public objectPolarity:ObjectPolarity = ObjectPolarity.DARK;
    public objectMirroring:ObjectMirroring = ObjectMirroring.NONE;
    public objectRotation:number = 0;
    public objectScaling:number = 1.0;
    private apertures:{[id:number]:ApertureBase} = {};
    private apertureMacros:{[name:string]:ApertureMacro} = {};
    private graphisOperationsConsumer_:GraphicsOperations = new BaseGraphicsOperationsConsumer();
    private savedGraphisOperationsConsumer_:Array<GraphicsOperations> = [];
    private blockApertures_:Array<number> = [];
    private blockParams_:Array<BlockParams> = [];
    private primitives_:Array<GraphicsPrimitive>;
    private isDone_:boolean = false;
    
    get coordinateFormatSpec():CoordinateFormatSpec {
        if (this.coordinateFormat_ == undefined) {
            this.error("File coordinate format is not set.");
        }
        return this.coordinateFormat_;
    }

    set coordinateFormatSpec(value:CoordinateFormatSpec) {
        if (this.coordinateFormat_ != undefined) {
            this.warning("File coordinate format already set.");
        }
        this.coordinateFormat_ = value;        
    }

    get coordinateUnits():CoordinateUnits {
        if (this.coordinateUnits_ == undefined) {
            this.error("Coordinate units are not set.");
        }
        return this.coordinateUnits_;
    }

    set coordinateUnits(value:CoordinateUnits) {
        this.coordinateUnits_ = value;        
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

    get isDone():boolean {
        return this.isDone_;
    }

    get primitives():Array<GraphicsPrimitive> {
        if (!this.isDone_) {
            this.warning("Parsing is not complete");
        }
        return this.primitives_;
    }

    getObjectState():ObjectState {
        return new ObjectState(
            this.objectPolarity,
            this.objectMirroring,
            this.objectScaling,
            this.objectRotation);
    }

    getAperture(id:number):ApertureBase {
        if (id < 10) {
            this.error(`Invalid aprture ID ${id}`);
        }
        if (this.apertures[id] == undefined) {
            this.error(`Aprture ID ${id} is not defined yet`);
        }
        return this.apertures[id];
    }

    getCurrentAperture():ApertureBase {
        let id = this.currentAppretureId
        if (this.apertures[id] == undefined) {
            this.error(`Aprture ID ${id} is not defined yet`);
        }
        return this.apertures[id];
    }

    setAperture(ap:ApertureBase) {
        if (this.apertures[ap.apertureId] != undefined) {
            this.warning(`Overriding aperture ${ap.apertureId}`);
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
            this.warning(`Overriding aperture macro ${apm.macroName}`);
        }
        this.apertureMacros[apm.macroName] = apm;
    }

    error(message:string) {
        throw new GerberParseException(message);
    }

    warning(message:string) {
        console.log(`Warning: ${message}`);
    }

    line(from:Point, to:Point, cmd:GerberCommand) {
        if (!from.isValid() || !to.isValid()) {
            this.error(`Invalid line ${from} ${to}`);
        }
        this.graphisOperationsConsumer_.line(from, to, cmd, this);
    }

    circle(center:Point, radius:number, cmd:GerberCommand) {
        if (!center.isValid() || radius <= Epsilon) {
            this.error(`Invalid circle ${center} R${radius}`);
        }
        this.graphisOperationsConsumer_.circle(center, radius, cmd, this);
    }

    arc(center:Point, radius:number, start:Point, end:Point, isCCW:boolean, cmd:GerberCommand) {
        if (!center.isValid() || radius <= Epsilon || !start.isValid() || !end.isValid()) {
            this.error(`Invalid arc ${center} R${radius} from ${start} to ${end}`);
        }
        this.graphisOperationsConsumer_.arc(center, radius, start, end, isCCW, cmd, this);
    }

    flash(center:Point, cmd:GerberCommand) {
        if (!center.isValid()) {
            this.error(`Invalid flash location ${center}`);
        }
        this.graphisOperationsConsumer_.flash(center, cmd, this);
    }

    closeRegionContour() {
        if (this.graphisOperationsConsumer_ instanceof RegionGraphicsOperationsConsumer) {
            let regionConsumer = this.graphisOperationsConsumer_ as RegionGraphicsOperationsConsumer;
            regionConsumer.closeRegionContour(this);
        }
    }

    startRegion() {
        this.saveGraphicsConsumer();
        this.graphisOperationsConsumer_ = new RegionGraphicsOperationsConsumer();
    }

    endRegion(cmd:GerberCommand) {
        let region = this.graphisOperationsConsumer_ as RegionGraphicsOperationsConsumer;
        region.closeRegionContour(this);

        this.restoreGraphicsConsumer();
        this.graphisOperationsConsumer_.region(region.regionContours, cmd, this);
    }

    saveGraphicsConsumer() {
        this.savedGraphisOperationsConsumer_.push(this.graphisOperationsConsumer_);
    }

    restoreGraphicsConsumer() {
        if (this.savedGraphisOperationsConsumer_.length == 0) {
            throw new GerberParseException("Invalid parsing state, can't restore operations consumer");
        }
        this.graphisOperationsConsumer_ = this.savedGraphisOperationsConsumer_.pop();
    }

    get graphicsOperations():GraphicsOperations {
        return this.graphisOperationsConsumer_;
    }

    startBlockAperture(blockId:number) {
        this.saveGraphicsConsumer();
        this.blockApertures_.push(blockId);
        this.graphisOperationsConsumer_ = new BlockGraphicsOperationsConsumer();
    }

    endBlockAperture() {
        if (this.blockApertures_.length == 0) {
            throw new GerberParseException('Closing aperture block without mathing opening.');
        }
        let blockId = this.blockApertures_.pop();
        let blockConsumer = this.graphisOperationsConsumer_ as BlockGraphicsOperationsConsumer;
        let aperture = new BlockAperture(blockId, blockConsumer.objects);
        this.setAperture(aperture);
        this.restoreGraphicsConsumer();
    }

    startRepeat(params:BlockParams) {
        this.saveGraphicsConsumer();
        this.blockParams_.push(params);
        this.graphisOperationsConsumer_ = new BlockGraphicsOperationsConsumer();
    }

    tryEndRepeat(cmd:GerberCommand) {
        if (this.blockParams_.length > 0) {
            this.endRepeat(cmd);
        }
    }

    endRepeat(cmd:GerberCommand) {
        if (this.blockParams_.length == 0) {
            throw new GerberParseException('Closing repeat block without mathing opening.');
        }
        let params = this.blockParams_.pop();
        let blockConsumer = this.graphisOperationsConsumer_ as BlockGraphicsOperationsConsumer;
        let block = new Block(
            params.xRepeat,
            params.yRepeat,
            params.xDelta,
            params.yDelta,
            blockConsumer.primitives,
            blockConsumer.objects);
        this.restoreGraphicsConsumer();
        this.graphisOperationsConsumer_.block(block, cmd, this);
    }

    endFile(cmd:GerberCommand) {
        while (this.blockParams_.length > 0) {
            this.endRepeat(cmd);
        }
        let topConsumer = this.graphisOperationsConsumer_ as BaseGraphicsOperationsConsumer;
        this.primitives_ = topConsumer.primitives;
        this.isDone_ = true;
    }
}

export interface SimpleBounds {
    readonly minx:number;
    readonly miny:number;
    readonly maxx:number;
    readonly maxy:number;
}

export class Bounds {
    constructor(public min:Point, public max:Point) {
    }

    merge(other:Bounds|Point|SimpleBounds) {
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
        } else if (other instanceof Point) {
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
        } else {
            if (other.minx < this.min.x) {
                this.min.x = other.minx;
            }
            if (other.miny < this.min.y) {
                this.min.y = other.miny;
            }
            if (other.maxx > this.max.x) {
                this.max.x = other.maxx;
            }
            if (other.maxy > this.max.y) {
                this.max.y = other.maxy;
            }
        }
    }

    mergexy(x:number, y:number) {
        if (x < this.min.x) {
            this.min.x = x;
        }
        if (y < this.min.y) {
            this.min.y = y;
        }
        if (x > this.max.x) {
            this.max.x = x;
        }
        if (y > this.max.y) {
            this.max.y = y;
        }
    }

    get width():number {
        return this.max.x - this.min.x;
    }

    get height():number {
        return this.max.y - this.min.y;
    }

    toSimpleBounds():SimpleBounds {
        return {
            minx:this.min.x,
            miny:this.min.y,
            maxx:this.max.x,
            maxy:this.max.y
        };
    }
}

export class LineSegment {
    constructor(
        readonly from:Point,
        readonly to:Point,
        readonly cmd:GerberCommand){
    }

    toString():string {
        return `l(${this.from}, ${this.to})`;
    }

    get bounds():Bounds {
        return new Bounds(
            new Point(Math.min(this.from.x, this.to.x), Math.min(this.from.y, this.to.y)),
            new Point(Math.max(this.from.x, this.to.x), Math.max(this.from.y, this.to.y)));
    }

    public translate(vector:Point):LineSegment {
        return new LineSegment(
            this.from.add(vector),
            this.to.add(vector),
            this.cmd);
    }
}

export class CircleSegment {
    constructor(
        readonly center:Point,
        readonly radius:number,
        readonly cmd:GerberCommand) {
    }

    toString():string {
        return `c(${this.center}R${formatFloat(this.radius, 3)})`;
    }

    get bounds():Bounds {
        return new Bounds(
            new Point(this.center.x - this.radius, this.center.x - this.radius),
            new Point(this.center.x + this.radius, this.center.x + this.radius));
    }

    public translate(vector:Point):CircleSegment {
        return new CircleSegment(
            this.center.add(vector),
            this.radius,
            this.cmd);
    }
}

export class ArcSegment {
    constructor(
        readonly center:Point,
        readonly radius:number,
        readonly start:Point,
        readonly end:Point,
        readonly isCCW:boolean,
        readonly cmd:GerberCommand) {
    }

    toString():string {
        return `a(${this.start}, ${this.end}@${this.center}R${formatFloat(this.radius, 3)})`;
    }

    get bounds():Bounds {
        return new Bounds(
            new Point(Math.min(this.start.x, this.end.x), Math.min(this.start.y, this.end.y)),
            new Point(Math.max(this.start.x, this.end.x), Math.max(this.start.y, this.end.y)));
    }

    public translate(vector:Point):ArcSegment {
        return new ArcSegment(
            this.center.add(vector),
            this.radius,
            this.start.add(vector),
            this.end.add(vector),
            this.isCCW,
            this.cmd);
    }
}

export type RegionSegment = LineSegment | CircleSegment | ArcSegment;
export type RegionContour = Array<RegionSegment>;

function translateRegionContour(contour:RegionContour, vector:Point):RegionContour {
    return contour.map(segment => segment.translate(vector));
}

function contourOrientation(countour:RegionContour):number {
    let sum = 0;
    countour.forEach(s => {
        let start:Point;
        let end:Point;

        if (s instanceof CircleSegment) {
            // Not sure what to do with circle segments. Start and end point are the same,
            // so it should compute as 0
            return;
        } else if (s instanceof ArcSegment) {
            // Threat arcs like line from start to end point.
            let arc = s as ArcSegment;
            start = s.start;
            end = s.end;
        } else {
            let line = s as LineSegment;
            start = s.from;
            end = s.to;
        }
        sum += (end.x - start.x) * (end.y + start.y);
    });
    return sum;
}

class RegionGraphicsOperationsConsumer implements GraphicsOperations {
    private contour_:RegionContour = [];
    private regionContours_:Array<RegionContour> = [];

    get regionContours():Array<RegionContour> {
        return this.regionContours_;
    }

    line(from:Point, to:Point, cmd:GerberCommand) {
        this.contour_.push(new LineSegment(from, to, cmd));
    }

    circle(center:Point, radius:number, cmd:GerberCommand) {
        this.contour_.push(new CircleSegment(center, radius, cmd));
    }

    arc(center:Point, radius:number, start:Point, end:Point, isCCW, cmd:GerberCommand, ctx:GerberState) {
        this.contour_.push(new ArcSegment(center, radius, start, end, isCCW, cmd));
    }

    flash(center:Point, cmd:GerberCommand, ctx:GerberState) {
        ctx.error("Flashes are not allowed inside a region definition.");
    }

    closeRegionContour(ctx:GerberState) {
        if (this.contour_.length > 0) {
            this.regionContours_.push(this.contour_);
            this.contour_ = [];
        }
    }

    region(contours:Array<RegionContour>, cmd:GerberCommand, ctx:GerberState) {
        ctx.error("Regions are not allowed inside a region definition.");
    }

    block(block:Block, cmd:GerberCommand, ctx:GerberState) {
        ctx.error("Blocks are not allowed inside a region definition.");
    }
}

export class ObjectState {
    constructor(
        readonly polarity:ObjectPolarity = ObjectPolarity.DARK,
        readonly mirroring:ObjectMirroring = ObjectMirroring.NONE,
        readonly scale:number = 1,
        readonly rotation:number = 0) {
    }
}

export class Line {
    private objects_:GraphicsObjects;
    
    constructor(
        readonly from:Point,
        readonly to:Point,
        readonly aperture:ApertureBase,
        readonly state:ObjectState,
        readonly cmd:GerberCommand) {
    }

    toString():string {
        return `L(${this.from}, ${this.to})`;
    }

    get objects():GraphicsObjects {
        if (!this.objects_) {
            let draw = this.aperture.generateLineDraw(
                this.from,
                this.to,
                this.state);
            let polarity = (draw.is_solid) ? this.state.polarity : ObjectPolarity.THIN;
            this.objects_ = [
                {
                    polySet:[draw.polygon],
                    polarity:polarity
                }
            ];
        }
        return this.objects_;
    }

    get bounds():Bounds {
        return objectsBounds(this.objects);
    }

    get primitives() {
        return this;
    }

    public translate(vector:Point):Line {
        return new Line(
            this.from.add(vector),
            this.to.add(vector),
            this.aperture,
            this.state,
            this.cmd);
    }
}

export class Circle {
    private objects_:GraphicsObjects;
    
    constructor(
        readonly center:Point,
        readonly radius:number,
        readonly aperture:ApertureBase,
        readonly state:ObjectState,
        readonly cmd:GerberCommand) {
    }

    toString():string {
        return `C(${this.center}R${formatFloat(this.radius, 3)})`;
    }

    get objects():GraphicsObjects {
        if (!this.objects_) {
            let draw = this.aperture.generateCircleDraw(
                this.center,
                this.radius,
                this.state);
            let polarity = (draw.is_solid) ? this.state.polarity : ObjectPolarity.THIN;
            this.objects_ = [
                {
                    polySet:draw.polygonSet,
                    polarity:polarity
                }
            ];
        }
        return this.objects_;
    }

    get bounds():Bounds {
        return objectsBounds(this.objects);
    }

    get primitives() {
        return this;
    }

    public translate(vector:Point):Circle {
        return new Circle(
            this.center.add(vector),
            this.radius,
            this.aperture,
            this.state,
            this.cmd);
    }
}

export class Arc {
    private objects_:GraphicsObjects;

    constructor(
        readonly center:Point,
        readonly radius:number,
        readonly start:Point,
        readonly end:Point,
        readonly isCCW:boolean,
        readonly aperture:ApertureBase,
        readonly state:ObjectState,
        readonly cmd:GerberCommand) {
    }

    toString():string {
        return `A(${this.start}, ${this.end}@${this.center}R${formatFloat(this.radius, 3)})`;
    }

    get objects():GraphicsObjects {
        if (!this.objects_) {
            let draw = this.aperture.generateArcDraw(
                (this.isCCW) ? this.start : this.end,
                (this.isCCW) ? this.end : this.start,
                this.center,
                this.state);
            let polarity = (draw.is_solid) ? this.state.polarity : ObjectPolarity.THIN;
            this.objects_ = [
                {
                    polySet:[draw.polygon],
                    polarity:polarity
                }
            ];
        }
        return this.objects_;
    }

    get bounds():Bounds {
        return objectsBounds(this.objects);
    }

    get primitives() {
        return this;
    }

    public translate(vector:Point):Arc {
        return new Arc(
            this.center.add(vector),
            this.radius,
            this.start.add(vector),
            this.end.add(vector),
            this.isCCW,
            this.aperture,
            this.state,
            this.cmd);
    }
}

export class Flash {
    private objects_:GraphicsObjects;

    constructor(
        readonly center:Point,
        readonly aperture:ApertureBase,
        readonly state:ObjectState,
        readonly cmd:GerberCommand) {
    }

    toString():string {
        return `F(${this.aperture.apertureId}@${this.center})`;
    }

    get objects():GraphicsObjects {
        if (!this.objects_) {
            this.objects_ = copyObjects(this.aperture.objects(this.state.polarity));
            this.objects_.forEach(o => {
                mirrorPolySet(o.polySet, this.state.mirroring);
                rotatePolySet(o.polySet, this.state.rotation);
                scalePolySet(o.polySet, this.state.scale);
                translatePolySet(o.polySet, this.center);
            });
        }
        return this.objects_;
    }

    get bounds():Bounds {
        return objectsBounds(this.objects);
    }

    get primitives() {
        return this;
    }

    public translate(vector:Point):Flash {
        return new Flash(
            this.center.add(vector),
            this.aperture,
            this.state,
            this.cmd);
    }
}

export class Region {
    private objects_:GraphicsObjects;
    readonly contours:Array<RegionContour>;

    constructor(
        contours:Array<RegionContour>,
        readonly state:ObjectState,
        readonly cmd:GerberCommand) {
        //this.contours = contours.map(c => Region.reOrderCountour(c));
        this.contours = contours;
    }

    toString():string {
        let result = "R[";
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

    private static startPoint(segment:RegionSegment):Point {
        if (segment instanceof CircleSegment) {
            throw new GerberParseException("Circle segment inside region.");
        } else if (segment instanceof LineSegment) {
            return (segment as LineSegment).from;
        } else if (segment instanceof ArcSegment) {
            return (segment as ArcSegment).start;
        }
        throw new GerberParseException(`Unsupportede segment ${segment} inside region.`);
    }

    private static endPoint(segment:RegionSegment):Point {
        if (segment instanceof CircleSegment) {
            throw new GerberParseException("Circle segment inside region.");
        } else if (segment instanceof LineSegment) {
            return (segment as LineSegment).to;
        } else if (segment instanceof ArcSegment) {
            return (segment as ArcSegment).end;
        }
        throw new GerberParseException(`Unsupportede segment ${segment} inside region.`);
    }

    private static matchPoint(p:Point, segment:RegionSegment, matchStart:boolean):boolean {
        let pt = (matchStart) ? Region.startPoint(segment) : Region.endPoint(segment);
        return pt.distance2(p) < Epsilon;
    }

    private static reOrderCountour(contour:RegionContour):RegionContour {
        if (contour.length < 2) return contour;
        let result:RegionContour = [];
        let segment = contour[0];
        console.log(`Re ordering ${contour}, started with ${segment}`);
        contour.splice(0, 1);
        result.push(segment);
        while (contour.length > 0) {
            let endPoint = Region.endPoint(segment);
            let nextSegmentIdx = contour.findIndex(s => Region.matchPoint(endPoint, s, true));
            if (nextSegmentIdx < 0) {
                console.log(`No match for end point ${endPoint}`);
                let startPoint = Region.startPoint(segment);
                nextSegmentIdx = contour.findIndex(s => Region.matchPoint(startPoint, s, false));
                if (nextSegmentIdx < 0) {
                    console.log(`No match for start point ${startPoint}`);
                    throw new GerberParseException(
                        `Region is disconnected ${contour} - can't locate continuation for ${segment}`);
                }
            }
            segment = contour[nextSegmentIdx];
            console.log(`Matched with ${segment}`);
            result.push(segment);
            contour.splice(nextSegmentIdx, 1);
        }
        return result;
    }

    private static buildPolygonSet(contours:Array<RegionContour>):PolygonSet {
        return contours.map(c => Region.buildPolygon(c));
    }

    private static buildPolygon(contour:RegionContour):Polygon {
        let numPoints = 0;
        let lastPt:Point = undefined;
        let firstPt:Point = undefined;
        contour.forEach(
            segment => {
                if (segment instanceof LineSegment) {
                    let line = segment as LineSegment;
                    numPoints += 2;
                    lastPt = line.to;
                    if (!firstPt) {
                        firstPt = line.from;
                    }
                } else if (segment instanceof ArcSegment) {
                    let arc = segment as ArcSegment;
                    numPoints += NUMSTEPS;
                    lastPt = arc.end;
                    if (!firstPt) {
                        firstPt = arc.start;
                    }
                } else if (segment instanceof CircleSegment) {
                    numPoints += NUMSTEPS * 2;
                }
            }
        );
        let needsClose = firstPt && lastPt
            && distance2(firstPt.x, firstPt.y, lastPt.x, lastPt.y) > Epsilon;
        let result:Polygon = new Float64Array(numPoints * 2 + ((needsClose) ? 2 : 0));
        let arrayOffset = 0;
        contour.forEach(
            segment => {
                if (segment instanceof LineSegment) {
                    let line = segment as LineSegment;
                    result[arrayOffset++] = line.from.x;
                    result[arrayOffset++] = line.from.y;
                    result[arrayOffset++] = line.to.x;
                    result[arrayOffset++] = line.to.y;
                } else if (segment instanceof ArcSegment) {
                    let arc = segment as ArcSegment;
                    let polygon = arcToPolygon(
                        arc.isCCW ? arc.start : arc.end,
                        arc.isCCW ? arc.end : arc.start,
                        arc.center);
                    if (!arc.isCCW) {
                        reversePolygon(polygon);
                    }
                    result.set(polygon, arrayOffset);
                    arrayOffset += NUMSTEPS * 2;
                } else if (segment instanceof CircleSegment) {
                    let circle = segment as CircleSegment;
                    let polygon = circleToPolygon(circle.radius);
                    translatePolygon(polygon, circle.center);
                    result.set(polygon, arrayOffset);
                    arrayOffset += NUMSTEPS * 2;
                } else {
                    throw new GerberParseException(`Unsupported segment type ${segment}`);
                }
            }
        );
        // Close the polygon if we have to
        if (needsClose) {
            result[arrayOffset++] = result[0];
            result[arrayOffset++] = result[1];
        }
        // If the contour is clockwise, reverse the polygon.
        if (contourOrientation(contour) > 0) {
            reversePolygon(result);
        }
        return result;
    }

    get objects():GraphicsObjects {
        if (!this.objects_) {
            this.objects_ = [
                {
                    polySet:Region.buildPolygonSet(this.contours),
                    polarity:this.state.polarity
                }
            ];
        }
        return this.objects_;
    }

    get bounds():Bounds {
        return objectsBounds(this.objects);
    }

    get primitives() {
        return this;
    }

    public translate(vector:Point):Region {
        return new Region(
            this.contours.map(contour => translateRegionContour(contour, vector)),
            this.state,
            this.cmd);
    }
}

export class Repeat {
    private objects_:GraphicsObjects;
    private primitives_:Array<GraphicsPrimitive>;

    constructor(readonly block:Block, readonly xOffset:number, readonly yOffset, readonly cmd:GerberCommand) {
    }

    toString():string {
        return `B(${this.block.xRepeat}, ${this.block.yRepeat}:${this.block.xDelta}, ${this.block.yDelta})`;
    }

    get objects():GraphicsObjects {
        if (!this.objects_) {
            this.buildObjects();
        }
        return this.objects_;
    }

    get bounds():Bounds {
        return objectsBounds(this.objects);
    }

    private buildObjects() {
        let xOffset = this.xOffset;
        this.objects_ = [];
        for (let xCnt = 0; xCnt < this.block.xRepeat; xCnt++) {
            let yOffset = this.yOffset;
            for (let yCnt = 0; yCnt < this.block.yRepeat; yCnt++) {
                let translateVector = new Point(xOffset, yOffset);
                let blockObjects = copyObjects(this.block.objects);
                translateObjects(blockObjects, translateVector);
                this.objects_.push(...blockObjects);
                yOffset += this.block.yDelta;
            }
            xOffset += this.block.xDelta;
        }
    }

    private buildPrimitives() {
        let xOffset = this.xOffset;
        this.primitives_ = [];
        for (let xCnt = 0; xCnt < this.block.xRepeat; xCnt++) {
            let yOffset = this.yOffset;
            for (let yCnt = 0; yCnt < this.block.yRepeat; yCnt++) {
                let translateVector = new Point(xOffset, yOffset);
                this.primitives_.push(
                    ...translatePrimitives(this.block.primitives, translateVector));
                yOffset += this.block.yDelta;
            }
            xOffset += this.block.xDelta;
        }
    }

    get primitives() {
        if (!this.primitives_) {
            this.buildPrimitives();
        }
        return this.primitives_;
    }

    public translate(vector:Point):Repeat {
        return new Repeat(
            this.block,
            this.xOffset + vector.x,
            this.yOffset + vector.y,
            this.cmd);
    }
}

function translatePrimitives(
    primitives:Array<GraphicsPrimitive>,
    vector:Point):Array<GraphicsPrimitive> {
    return primitives.map(primitive => primitive.translate(vector));
}

export type GraphicsPrimitive = Line | Circle | Arc | Flash | Region | Repeat;

export function EmptyBounds():Bounds {
    return new Bounds(new Point(0, 0), new Point(0, 0));
}

export class BaseGraphicsOperationsConsumer implements GraphicsOperations {
    private primitives_:Array<GraphicsPrimitive> = [];

    get primitives():Array<GraphicsPrimitive> {
        return this.primitives_;
    }

    line(from:Point, to:Point, cmd:GerberCommand, ctx:GerberState) {
        this.primitives_.push(
            new Line(
                from,
                to,
                ctx.getCurrentAperture(),
                ctx.getObjectState(),
                cmd));
    }

    circle(center:Point, radius:number, cmd:GerberCommand, ctx:GerberState) {
        this.primitives_.push(new Circle(center, radius, ctx.getCurrentAperture(), ctx.getObjectState(), cmd));
    }

    arc(center:Point, radius:number, start:Point, end:Point, isCCW:boolean, cmd:GerberCommand, ctx:GerberState) {
        this.primitives_.push(new Arc(center, radius, start, end, isCCW, ctx.getCurrentAperture(), ctx.getObjectState(), cmd));
    }

    flash(center:Point, cmd:GerberCommand, ctx:GerberState) {
        this.primitives_.push(new Flash(center, ctx.getCurrentAperture(), ctx.getObjectState(), cmd));
    }

    region(contours:Array<RegionContour>, cmd:GerberCommand, ctx:GerberState) {
        this.primitives_.push(new Region(contours, ctx.getObjectState(), cmd));
    }

    block(block:Block, cmd:GerberCommand, ctx:GerberState) {
        this.primitives_.push(new Repeat(block, 0, 0, cmd));
    }
}

export class BlockGraphicsOperationsConsumer implements GraphicsOperations {
    private objects_:GraphicsObjects = [];
    private primitives_:Array<GraphicsPrimitive> = [];
    
    get primitives():Array<GraphicsPrimitive> {
        return this.primitives_;
    }
    
    get objects():GraphicsObjects {
        return this.objects_;
    }

    line(from:Point, to:Point, cmd:GerberCommand, ctx:GerberState) {
        let l = new Line(
            from,
            to,
            ctx.getCurrentAperture(),
            ctx.getObjectState(),
            cmd);
        this.primitives_.push(l);
        this.objects_.push(...l.objects);
    }

    circle(center:Point, radius:number, cmd:GerberCommand, ctx:GerberState) {
        let c = new Circle(center, radius, ctx.getCurrentAperture(), ctx.getObjectState(), cmd);
        this.primitives_.push(c);
        this.objects_.push(...c.objects);
    }

    arc(center:Point, radius:number, start:Point, end:Point, isCCW:boolean, cmd:GerberCommand, ctx:GerberState) {
        let a = new Arc(center, radius, start, end, isCCW, ctx.getCurrentAperture(), ctx.getObjectState(), cmd);
        this.primitives_.push(a);
        this.objects_.push(...a.objects);
    }

    flash(center:Point, cmd:GerberCommand, ctx:GerberState) {
        let f = new Flash(center, ctx.getCurrentAperture(), ctx.getObjectState(), cmd);
        this.primitives_.push(f);
        this.objects_.push(...f.objects);
    }

    region(contours:Array<RegionContour>, cmd:GerberCommand, ctx:GerberState) {
        let r = new Region(contours, ctx.getObjectState(), cmd);
        this.primitives_.push(r);
        this.objects_.push(...r.objects);
    }

    block(block:Block, cmd:GerberCommand, ctx:GerberState) {
        let r = new Repeat(block, 0, 0, cmd);
        this.primitives_.push(r);
        this.objects_.push(...r.objects);
    }
}

export function composeSolidImage(objects:GraphicsObjects, union:boolean = false):PolygonSetWithBounds {
    if (objects.length == 0) {
        return {
            polygonSet:[],
            bounds: undefined
        };
    }
    let image:PolygonSet = [];
    let clear:PolygonSet = [];
    objects
        .filter(o => o.polarity != ObjectPolarity.THIN)
        .forEach(o => {
            if (o.polarity === ObjectPolarity.DARK) {
                // Check if there is anything to clean?
                if (clear.length > 0) {
                    // Check if we are crearing from something
                    if (image.length > 0) {
                        image = subtractPolygonSet(image, clear).polygonSet;
                    }
                    clear = [];
                }
                image.push(...o.polySet);
            } else {
                clear.push(...o.polySet);
            }
        });
    // Check if there is anything left to clean?
    if (clear.length > 0) {
        // Check if we are crearing from something
        if (image.length > 0) {
            if (!union) {
                return subtractPolygonSet(image, clear);
            }
            image = subtractPolygonSet(image, clear).polygonSet;
        }
    }
    if (union) {
        return unionPolygonSet(image, []);
    }
    return {
        polygonSet: image,
        bounds: polySetBounds(image).toSimpleBounds()
    }
}

export interface GerberCommand {
    readonly name:string;
    readonly isAdvanced:boolean;
    readonly lineNo?:number;
    formatOutput(fmt:CoordinateFormatSpec):string;
    execute(ctx:GerberState):void;
}

export const Epsilon = 1E-12;
