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
} from "./polygonSet";
import {Point} from "./point";
import {
    arcToPolygon,
    circleToPolygon,
    rectangleToPolygon,
    obroundToPolygon,
} from "./polygonTools";

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
                    return {polygon:[], is_solid:false};
                }
                return {
                    polygon:translatePolygon(circleToPolygon(radius), start.midPoint(end)),
                    is_solid:true};
            } else if (this.templateName == "R") {
                return {
                    polygon:translatePolygon(
                        rectangleToPolygon(
                            state.scale * this.modifiers[0],
                            state.scale * this.modifiers[1]),
                        start.midPoint(end)),
                    is_solid:true};
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
            result = arcToPolygon(innerStart, outerStart, innerStart.midPoint(outerStart), false);
            result = result.concat(arcToPolygon(outerStart, outerEnd, center, false));
            result = result.concat(arcToPolygon(outerEnd, innerEnd, outerEnd.midPoint(innerEnd), false));
            result = result.concat(arcToPolygon(innerStart, innerEnd, center).reverse());
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
            result = [
                innerStart.clone(),
                new Point(innerStart.x + pStartLineCCW.x, innerStart.y + pStartLineCCW.y),
                new Point(outerStart.x + pStartLineCCW.x, outerStart.y + pStartLineCCW.y)
            ];
            result = result.concat(arcToPolygon(outerStart, outerEnd, center, false));
            result = result.concat([
                outerEnd.clone(),
                new Point(outerEnd.x + pEncLineCW.x, outerEnd.y + pEncLineCW.y),
                new Point(innerEnd.x + pEncLineCW.x, innerEnd.y + pEncLineCW.y)
            ]);
            result = result.concat(arcToPolygon(innerStart, innerEnd, center).reverse());
            return {polygon:result, is_solid:true};
        }
        throw new GerberParseException(`Draw with this aperture is not supported. ${this.templateName}`);
    }

    generateCircleDraw(center:Point, radius:number, state:ObjectState):PolyongSetWithThinkness {
        if (this.templateName == "C" || this.templateName == "O" || this.templateName == "R") {
            let result:PolygonSet = [];
            let apertureRadius = state.scale * this.modifiers[0] / 2;
            if (apertureRadius < Epsilon) {
                return {polygonSet:[translatePolygon(circleToPolygon(radius), center)], is_solid:false};
            }
            result.push(translatePolygon(circleToPolygon(radius + apertureRadius), center));
            result.push(translatePolygon(circleToPolygon(radius - apertureRadius), center).reverse());
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
                    return {polygon:[], is_solid:false};
                }
                return {
                    polygon: translatePolygon(circleToPolygon(radius), start.midPoint(end)),
                    is_solid:true};
            } else if (this.templateName == "R") {
                return {
                    polygon:translatePolygon(
                        rotatePolygon(
                            mirrorPolygon(
                                rectangleToPolygon(
                                    state.scale * this.modifiers[0],
                                    state.scale * this.modifiers[1]),
                                state.mirroring),
                            state.rotation),
                        start.midPoint(end)),
                    is_solid:true};
            }
            throw new GerberParseException(`Draw with this aperture is not supported. ${this.templateName}`);
        }
        let angle = start.angleFrom(end);

        if (this.templateName == "C" || this.templateName == "O") {
            let radius = state.scale * this.modifiers[0] / 2;
            if (radius < Epsilon) {
                return {polygon:[start.clone(), end.clone()], is_solid:false};
            }
            let vector = {x:end.x - start.x, y:end.y - start.y};
            let uVector = unitVector(vector);

            let pCW = scaleVector({x:uVector.y, y:-uVector.x}, radius);
            let pCCW = scaleVector({x:-uVector.y, y:uVector.x}, radius);

            let startLeft = addVector({x:start.x, y:start.y}, pCCW);
            let endLeft = addVector(startLeft, vector);
            let startRight = addVector({x:start.x, y:start.y}, pCW);
            let endRight = addVector(startRight, vector);
            result = arcToPolygon(
                new Point(startLeft.x, startLeft.y),
                new Point(startRight.x, startRight.y),
                start);
            result = result.concat(arcToPolygon(
                new Point(endRight.x, endRight.y),
                new Point(endLeft.x, endLeft.y),
                end));
            result.push(new Point(startLeft.x, startLeft.y));
            return {polygon:result, is_solid:true};
        } else if (this.templateName == "R") {
            if (Math.abs(state.rotation) > Epsilon
                || state.mirroring != ObjectMirroring.NONE) {
                throw new GerberParseException(`Unimplemented rotation or mirroring with rectangular apertures`)
            }
            let width2 = state.scale * this.modifiers[0] / 2;
            let height2 = state.scale * this.modifiers[1] / 2;
            if (Math.abs(start.x - end.x) < Epsilon) { // Vertical Line
                return {
                    polygon:translatePolygon(
                        rectangleToPolygon(this.modifiers[0], Math.abs(end.y - start.y) + this.modifiers[1]),
                        start.midPoint(end)),
                    is_solid:true};
            } else if (Math.abs(start.y - end.y) < Epsilon) { // Horizontal Line
                return {
                    polygon:translatePolygon(
                        rectangleToPolygon(Math.abs(end.x - start.x) + this.modifiers[0], this.modifiers[1]),
                        start.midPoint(end)),
                    is_solid:true};
            } else {
                let vector = {x:end.x - start.x, y:end.y - start.y};
                result = new Array<Point>(7);
                if (angle < Math.PI / 2) {
                    result[0] = new Point(start.x - width2, start.y - height2);
                    result[1] = new Point(start.x + width2, start.y - height2);
                    result[2] = new Point(end.x + width2, end.y - height2);
                    result[3] = new Point(end.x + width2, end.y + height2);
                    result[4] = new Point(end.x - width2, end.y + height2);
                    result[5] = new Point(start.x - width2, start.y + height2);
                    result[6] = new Point(start.x - width2, start.y - height2);
                } else if (angle < Math.PI) {
                    result[0] = new Point(start.x - width2, start.y - height2);
                    result[1] = new Point(start.x + width2, start.y - height2);
                    result[2] = new Point(start.x + width2, start.y + height2);
                    result[3] = new Point(end.x + width2, end.y + height2);
                    result[4] = new Point(end.x - width2, end.y + height2);
                    result[5] = new Point(end.x - width2, end.y - height2);
                    result[6] = new Point(start.x - width2, start.y - height2);
                } else if (angle < Math.PI) {
                    result[0] = new Point(end.x - width2, end.y - height2);
                    result[1] = new Point(end.x + width2, end.y - height2);
                    result[2] = new Point(start.x + width2, start.y - height2);
                    result[3] = new Point(start.x + width2, start.y + height2);
                    result[4] = new Point(start.x - width2, start.y + height2);
                    result[5] = new Point(end.x - width2, end.y + height2);
                    result[6] = new Point(end.x - width2, end.y - height2);
                } else {
                    result[0] = new Point(end.x - width2, end.y - height2);
                    result[1] = new Point(end.x + width2, end.y - height2);
                    result[2] = new Point(end.x + width2, end.y + height2);
                    result[3] = new Point(start.x + width2, start.y + height2);
                    result[4] = new Point(start.x - width2, start.y + height2);
                    result[5] = new Point(start.x - width2, start.y - height2);
                    result[6] = new Point(start.x - width2, start.y - height2);
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
            if (this.modifiers.length == 2) {
                result.push(circleToPolygon(this.modifiers[1] / 2).reverse());
            } else if (this.modifiers.length == 3) {
                result.push(rectangleToPolygon(this.modifiers[1], this.modifiers[2]).reverse());
            }
        } else if (this.templateName === "R") {
            result.push(rectangleToPolygon(this.modifiers[0], this.modifiers[1]));
            if (this.modifiers.length == 3) {
                result.push(circleToPolygon(this.modifiers[2] / 2).reverse());
            } else if (this.modifiers.length == 4) {
                result.push(rectangleToPolygon(this.modifiers[2], this.modifiers[3]).reverse());
            }
        } else if (this.templateName === "O") {
            result.push(obroundToPolygon(this.modifiers[0], this.modifiers[1]));
            if (this.modifiers.length == 3) {
                result.push(circleToPolygon(this.modifiers[2] / 2).reverse());
            } else if (this.modifiers.length == 4) {
                result.push(rectangleToPolygon(this.modifiers[2], this.modifiers[3]).reverse());
            }
        } else if (this.templateName === "P") {
            if (this.modifiers.length == 2) {
                result.push(circleToPolygon(this.modifiers[0] / 2, this.modifiers[1]));
            } else if (this.modifiers.length > 2) {
                result.push(circleToPolygon(this.modifiers[0] / 2, this.modifiers[1], this.modifiers[2]));
            }
            if (this.modifiers.length == 4) {
                result.push(circleToPolygon(this.modifiers[3] / 2).reverse());
            } else if (this.modifiers.length == 5) {
                result.push(rectangleToPolygon(this.modifiers[3], this.modifiers[4]).reverse());
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
                            shape = [
                                rotatePolygon(
                                    translatePolygon(circleToPolygon(diameter / 2), center),
                                    ApertureMacro.getValue(modifiers, 4))];
                        } else {
                            shape = [];
                            console.log("Empty circle shape");
                        }
                        break;

                    case 4: // Outline (exposure, num vertices, start x, start y, ..., (3+2n) end x, 4+2n end y, rotation)
                        isPositive =  ApertureMacro.getValue(modifiers, 0) != 0; 
                        let numPoints = ApertureMacro.getValue(modifiers, 1);
                        if (numPoints < 1) {
                            throw new GerberParseException(`Invalid number of points in a macro outline ${numPoints}`);
                        }
                        let outline = new Array<Point>(numPoints + 1);
                        for (let idx = 0; idx <= numPoints; idx++) {
                            outline[idx] = new Point(
                                ApertureMacro.getValue(modifiers, 2 * idx + 2),
                                ApertureMacro.getValue(modifiers, 2 * idx + 3));
                        }
                        shape = [rotatePolygon(outline, ApertureMacro.getValue(modifiers, 2 * numPoints + 4))];
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
                            shape = [
                                rotatePolygon(
                                    translatePolygon(circleToPolygon(diameter / 2, numSteps), center),
                                    ApertureMacro.getValue(modifiers, 5))];
                        } else {
                            shape = [];
                            console.log("Empty polygon shape");
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
                                shape.push(rotatePolygon(translatePolygon(circleToPolygon(outerDiameter / 2), center), rotation));
                                if (innerDiameter > Epsilon) {
                                    shape.push(
                                        rotatePolygon(
                                            translatePolygon(
                                                circleToPolygon(innerDiameter / 2).reverse(),
                                                center),
                                            rotation));
                                }
                                outerDiameter = innerDiameter - gap * 2;
                            }
                        }
                        if (crossLen > Epsilon && crossThickness > Epsilon) {
                            shape.push(rotatePolygon(translatePolygon(rectangleToPolygon(crossLen, crossThickness), center), rotation));
                            shape.push(rotatePolygon(translatePolygon(rectangleToPolygon(crossThickness, crossLen), center), rotation));
                            shape = unionPolygonSet(shape, []);
                        }
                        if (shape.length < 1) {
                            console.log("Empty moire shape");
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
                        if (outerDiameter > Epsilon) {
                            if (gap > Epsilon) {
                                if (innerDiameter > Epsilon) {
                                    // Quadrant 1 shape
                                    let polygon:Polygon = [];
                                    let innerStart = new Point(innerRadius + center.x, gap2 + center.y);
                                    let outerStart = new Point(outerRadius + center.x, gap2 + center.y);
                                    let innerEnd = new Point(gap2 + center.x, innerRadius + center.y);
                                    let outerEnd = new Point(gap2 + center.x, outerRadius + center.y);
                                    polygon.push(innerStart);
                                    polygon = polygon.concat(arcToPolygon(outerStart, outerEnd, center));
                                    polygon = polygon.concat(arcToPolygon(innerStart, innerEnd, center).reverse());
                                    shape.push(rotatePolygon(polygon, rotation));

                                    // Quadrant 2 shape
                                    polygon = [];
                                    innerStart = new Point(-gap2 + center.x, innerRadius + center.y);
                                    outerStart = new Point(-gap2 + center.x, outerRadius + center.y);
                                    innerEnd = new Point(-innerRadius + center.x, gap2 + center.y);
                                    outerEnd = new Point(-outerRadius + center.x, gap2 + center.y);
                                    polygon.push(innerStart);
                                    polygon = polygon.concat(arcToPolygon(outerStart, outerEnd, center));
                                    polygon = polygon.concat(arcToPolygon(innerStart, innerEnd, center).reverse());
                                    shape.push(rotatePolygon(polygon, rotation));

                                    // Quadrant 3 shape
                                    polygon = [];
                                    innerStart = new Point(-innerRadius + center.x, -gap2 + center.y);
                                    outerStart = new Point(-outerRadius + center.x, -gap2 + center.y);
                                    innerEnd = new Point(-gap2 + center.x, -innerRadius + center.y);
                                    outerEnd = new Point(-gap2 + center.x, -outerRadius + center.y);
                                    polygon.push(innerStart);
                                    polygon = polygon.concat(arcToPolygon(outerStart, outerEnd, center));
                                    polygon = polygon.concat(arcToPolygon(innerStart, innerEnd, center).reverse());
                                    shape.push(rotatePolygon(polygon, rotation));

                                    // Quadrant 4 shape
                                    polygon = [];
                                    innerStart = new Point(gap2 + center.x, -innerRadius + center.y);
                                    outerStart = new Point(gap2 + center.x, -outerRadius + center.y);
                                    innerEnd = new Point(innerRadius + center.x, -gap2 + center.y);
                                    outerEnd = new Point(outerRadius + center.x, -gap2 + center.y);
                                    polygon.push(innerStart);
                                    polygon = polygon.concat(arcToPolygon(outerStart, outerEnd, center));
                                    polygon = polygon.concat(arcToPolygon(innerStart, innerEnd, center).reverse());
                                    shape.push(rotatePolygon(polygon, rotation));
                                } else {
                                    // Quadrant 1 shape
                                    let polygon:Polygon = [];
                                    let innerPoint = new Point(gap2 + center.x, gap2 + center.y);
                                    let outerStart = new Point(outerRadius + center.x, gap2 + center.y);
                                    let outerEnd = new Point(gap2 + center.x, outerRadius + center.y);
                                    polygon.push(innerPoint);
                                    polygon = polygon.concat(arcToPolygon(outerStart, outerEnd, center));
                                    polygon.push(innerPoint);
                                    shape.push(rotatePolygon(polygon, rotation));

                                    // Quadrant 2 shape
                                    polygon = [];
                                    innerPoint = new Point(-gap2 + center.x, gap2 + center.y);
                                    outerStart = new Point(-gap2 + center.x, outerRadius + center.y);
                                    outerEnd = new Point(-outerRadius + center.x, gap2 + center.y);
                                    polygon.push(innerPoint);
                                    polygon = polygon.concat(arcToPolygon(outerStart, outerEnd, center));
                                    polygon.push(innerPoint);
                                    shape.push(rotatePolygon(polygon, rotation));

                                    // Quadrant 3 shape
                                    polygon = [];
                                    innerPoint = new Point(-gap2 + center.x, -gap2 + center.y);
                                    outerStart = new Point(-outerRadius + center.x, -gap2 + center.y);
                                    outerEnd = new Point(-gap2 + center.x, -outerRadius + center.y);
                                    polygon.push(innerPoint);
                                    polygon = polygon.concat(arcToPolygon(outerStart, outerEnd, center));
                                    polygon.push(innerPoint);
                                    shape.push(rotatePolygon(polygon, rotation));

                                    // Quadrant 4 shape
                                    polygon = [];
                                    innerPoint = new Point(gap2 + center.x, -gap2 + center.y);
                                    outerStart = new Point(gap2 + center.x, -outerRadius + center.y);
                                    outerEnd = new Point(outerRadius + center.x, -gap2 + center.y);
                                    polygon.push(innerPoint);
                                    polygon = polygon.concat(arcToPolygon(outerStart, outerEnd, center));
                                    polygon.push(innerPoint);
                                    shape.push(rotatePolygon(polygon, rotation));
                                }
                            } else {
                                shape.push(rotatePolygon(translatePolygon(circleToPolygon(outerRadius), center), rotation));
                                if (innerDiameter > Epsilon) {
                                    shape.push(rotatePolygon(translatePolygon(circleToPolygon(innerRadius), center), rotation));
                                }
                            }
                        } else {
                            shape = [];
                            console.log("Empty thermal shape");
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
                        shape = [rotatePolygon(
                            [startLeft, startRight, endRight, endLeft, startLeft.clone()],
                            rotation)];
                        break;
    
                    case 21: // Center line (exposure, width, height, center x, center y, rotation)
                        isPositive =  ApertureMacro.getValue(modifiers, 0) != 0;
                        width = ApertureMacro.getValue(modifiers, 1);
                        height = ApertureMacro.getValue(modifiers, 2);
                        center = new Point(ApertureMacro.getValue(modifiers, 3), ApertureMacro.getValue(modifiers, 4));
                        rotation = ApertureMacro.getValue(modifiers, 5);
                        if (width > Epsilon && height > Epsilon) {
                            shape = [
                                rotatePolygon(translatePolygon(rectangleToPolygon(width, height), center), rotation)];
                        } else {
                            shape = [];
                            console.log("Empty center line shape");
                        }
                        break;
                    default:
                        throw new GerberParseException(`Unsupported macro primitive ${primitive.code}`);
                }
                if (isPositive) {
                    positives = positives.concat(shape);
                } else {
                    negatives = negatives.concat(shape);
                }
            }
        }
        return subtractPolygonSet(positives, negatives);
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
    line(from:Point, to:Point, ctx:GerberState):void;
    circle(center:Point, radius:number, ctx:GerberState):void;
    arc(center:Point, radius:number, start:Point, end:Point, ctx:GerberState):void;
    flash(center:Point, ctx:GerberState):void;
    region(contours:Array<Array<LineSegment|CircleSegment|ArcSegment>>, ctx:GerberState):void;
    block(block:Block, ctx:GerberState):void;
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

    get isDone():boolean {
        return this.isDone_;
    }

    get primitives():Array<GraphicsPrimitive> {
        if (!this.isDone_) {
            throw new GerberParseException("Parsing is not complete");
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

    endRegion() {
        let region = this.graphisOperationsConsumer_ as RegionGraphicsOperationsConsumer;
        region.closeRegionContour(this);

        this.restoreGraphicsConsumer();
        this.graphisOperationsConsumer_.region(region.regionContours, this);
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

    tryEndRepeat() {
        if (this.blockParams_.length > 0) {
            this.endRepeat();
        }
    }

    endRepeat() {
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
        this.graphisOperationsConsumer_.block(block, this);
    }

    endFile() {
        while (this.blockParams_.length > 0) {
            this.endRepeat();
        }
        let topConsumer = this.graphisOperationsConsumer_ as BaseGraphicsOperationsConsumer;
        this.primitives_ = topConsumer.primitives;
        this.isDone_ = true;
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

export type RegionSegment = LineSegment | CircleSegment | ArcSegment;
export type RegionContour = Array<RegionSegment>;

class RegionGraphicsOperationsConsumer implements GraphicsOperations {
    private contour_:RegionContour = [];
    private regionContours_:Array<RegionContour> = [];

    get regionContours():Array<RegionContour> {
        return this.regionContours_;
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
        ctx.error("Flashes are not allowed inside a region definition.");
    }

    closeRegionContour(ctx:GerberState) {
        if (this.contour_.length > 0) {
            this.regionContours_.push(this.contour_);
            this.contour_ = [];
        }
    }

    region(contours:Array<RegionContour>, ctx:GerberState) {
        ctx.error("Regions are not allowed inside a region definition.");
    }

    block(block:Block, ctx:GerberState) {
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
        readonly state:ObjectState) {
        let draw = aperture.generateLineDraw(from, to, state);
        let polarity = (draw.is_solid) ? state.polarity : ObjectPolarity.THIN;
        this.objects_ = [{polySet:[draw.polygon], polarity:polarity}];
    }

    toString():string {
        return `L(${this.from}, ${this.to})`;
    }

    get objects():GraphicsObjects {
        return this.objects_;
    }

    get bounds():Bounds {
        return objectsBounds(this.objects_);
    }
}

export class Circle {
    private objects_:GraphicsObjects;
    
    constructor(
        readonly center:Point,
        readonly radius:number,
        readonly aperture:ApertureBase,
        readonly state:ObjectState) {
        let draw = aperture.generateCircleDraw(center, radius, state);
        let polarity = (draw.is_solid) ? state.polarity : ObjectPolarity.THIN;
        this.objects_ = [{polySet:draw.polygonSet, polarity:polarity}];
    }

    toString():string {
        return `C(${this.center}R${formatFloat(this.radius, 3)})`;
    }

    get objects():GraphicsObjects {
        return this.objects_;
    }

    get bounds():Bounds {
        return objectsBounds(this.objects_);
    }
}

export class Arc {
    private objects_:GraphicsObjects;

    constructor(
        readonly center:Point,
        readonly radius:number,
        readonly start:Point,
        readonly end:Point,
        readonly aperture:ApertureBase,
        readonly state:ObjectState) {
        let draw = aperture.generateArcDraw(start, end, center, state);
        let polarity = (draw.is_solid) ? state.polarity : ObjectPolarity.THIN;
        this.objects_ = [{polySet:[draw.polygon], polarity:polarity}];
    }

    toString():string {
        return `A(${this.start}, ${this.end}@${this.center}R${formatFloat(this.radius, 3)})`;
    }

    get objects():GraphicsObjects {
        return this.objects_;
    }

    get bounds():Bounds {
        return objectsBounds(this.objects_);
    }
}

export class Flash {
    private objects_:GraphicsObjects;

    constructor(
        readonly center:Point,
        readonly aperture:ApertureBase,
        readonly state:ObjectState) {
        this.objects_ = aperture.objects(state.polarity).map(o => {
            return {
                polySet:translatePolySet(
                    scalePolySet(
                        rotatePolySet(
                            mirrorPolySet(o.polySet, state.mirroring),
                            state.rotation),
                        state.scale),
                    center),
                polarity: (state.polarity === ObjectPolarity.DARK) ? o.polarity : reversePolarity(o.polarity)};
        });
    }

    toString():string {
        return `F(${this.aperture.apertureId}@${this.center})`;
    }

    get objects():GraphicsObjects {
        return this.objects_;
    }

    get bounds():Bounds {
        return objectsBounds(this.objects_);
    }
}

export class Region {
    private objects_:GraphicsObjects;
    
    constructor(
        readonly contours:Array<RegionContour>,
        readonly state:ObjectState) {
        this.objects_ = [{polySet:Region.buildPolygonSet(contours), polarity:state.polarity}];
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

    private static buildPolygonSet(contours:Array<RegionContour>):PolygonSet {
        return contours.map(c => Region.buildPolygon(c));
    }

    private static buildPolygon(contour:RegionContour):Polygon {
        let result:Polygon = [];
        contour.forEach(
            segment => {
                if (segment instanceof LineSegment) {
                    let line = segment as LineSegment;
                    result.push(line.from);
                    result.push(line.to);
                } else if (segment instanceof ArcSegment) {
                    let arc = segment as ArcSegment;
                    result = result.concat(arcToPolygon(arc.start, arc.end, arc.center));
                } else if (segment instanceof CircleSegment) {
                    let circle = segment as CircleSegment;
                    result = result.concat(translatePolygon(circleToPolygon(circle.radius), circle.center));
                } else {
                    throw new GerberParseException(`Unsupported segment type ${segment}`);
                }
            }
        );
        // Close the polygon if we have to
        if (result[0].distance(result[result.length - 1]) > Epsilon) {
            result.push(result[0].clone());
        }
        return result;
    }

    get objects():GraphicsObjects {
        return this.objects_;
    }

    get bounds():Bounds {
        return objectsBounds(this.objects_);
    }
}

export class Repeat {
    private objects_:GraphicsObjects = [];
    private primitives_:Array<GraphicsPrimitive> = [];

    constructor(readonly block:Block) {
        let xOffset = 0;
        for (let xCnt = 0; xCnt < block.xRepeat; xCnt++) {
            let yOffset = 0;
            for (let yCnt = 0; yCnt < block.yRepeat; yCnt++) {
                let translateVector = new Point(xOffset, yOffset);
                this.objects_ = this.objects_.concat(
                    translateObjects(block.objects, translateVector));
                this.primitives_ = this.primitives_.concat(
                    translatePrimitives(block.primitives, translateVector));
                yOffset += block.yDelta;
            }
            xOffset += block.xDelta;
        }
    }

    toString():string {
        return `B(${this.block.xRepeat}, ${this.block.yRepeat}:${this.block.xDelta}, ${this.block.yDelta})`;
    }

    get objects():GraphicsObjects {
        return this.objects_;
    }

    get bounds():Bounds {
        return objectsBounds(this.objects_);
    }
}

function translatePrimitives(primitives:Array<GraphicsPrimitive>, vector:Point):Array<GraphicsPrimitive> {
    return [];
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

    line(from:Point, to:Point, ctx:GerberState) {
        this.primitives_.push(
            new Line(
                from,
                to,
                ctx.getCurrentAperture(),
                ctx.getObjectState()));
    }

    circle(center:Point, radius:number, ctx:GerberState) {
        this.primitives_.push(new Circle(center, radius, ctx.getCurrentAperture(), ctx.getObjectState()));
    }

    arc(center:Point, radius:number, start:Point, end:Point, ctx:GerberState) {
        this.primitives_.push(new Arc(center, radius, start, end, ctx.getCurrentAperture(), ctx.getObjectState()));
    }

    flash(center:Point, ctx:GerberState) {
        this.primitives_.push(new Flash(center, ctx.getCurrentAperture(), ctx.getObjectState()));
    }

    region(contours:Array<RegionContour>, ctx:GerberState) {
        this.primitives_.push(new Region(contours, ctx.getObjectState()));
    }

    block(block:Block, ctx:GerberState) {
        this.primitives_.push(new Repeat(block));
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

    line(from:Point, to:Point, ctx:GerberState) {
        let l = new Line(
            from,
            to,
            ctx.getCurrentAperture(),
            ctx.getObjectState());
        this.primitives_.push(l);
        this.objects_ = this.objects_.concat(l.objects);
    }

    circle(center:Point, radius:number, ctx:GerberState) {
        let c = new Circle(center, radius, ctx.getCurrentAperture(), ctx.getObjectState());
        this.primitives_.push(c);
        this.objects_ = this.objects_.concat(c.objects);
    }

    arc(center:Point, radius:number, start:Point, end:Point, ctx:GerberState) {
        let a = new Arc(center, radius, start, end, ctx.getCurrentAperture(), ctx.getObjectState());
        this.primitives_.push(a);
        this.objects_ = this.objects_.concat(a.objects);
    }

    flash(center:Point, ctx:GerberState) {
        let f = new Flash(center, ctx.getCurrentAperture(), ctx.getObjectState());
        this.primitives_.push(f);
        this.objects_ = this.objects_.concat(f.objects);
    }

    region(contours:Array<RegionContour>, ctx:GerberState) {
        let r = new Region(contours, ctx.getObjectState());
        this.primitives_.push(r);
        this.objects_ = this.objects_.concat(r.objects);
    }

    block(block:Block, ctx:GerberState) {
        let r = new Repeat(block);
        this.primitives_.push(r);
        this.objects_ = this.objects_.concat(r.objects);
    }
}

export function composeSolidImage(objects:GraphicsObjects, union:boolean = false):PolygonSet {
    if (objects.length == 0) {
        return [];
    }
    let image:PolygonSet = [];
    let clear:PolygonSet = [];
    objects
        .filter(o => o.polarity != ObjectPolarity.THIN)
        .forEach(o => {
        if (o.polarity === ObjectPolarity.DARK) {
            if (clear.length > 0) {
                if (image.length > 0) {
                    image = subtractPolygonSet(image, clear);
                }
                clear = [];
            }
            image = image.concat(o.polySet);
        } else {
            clear = clear.concat(o.polySet);
        }
    });
    if (clear.length > 0) {
        if (image.length > 0) {
            image = subtractPolygonSet(image, clear);
        }
    }
    if (union) {
        image = unionPolygonSet(image, []);
    }
    return image;
}

export interface GerberCommand {
    readonly name:string;
    readonly isAdvanced:boolean;
    formatOutput(fmt:CoordinateFormatSpec):string;
    execute(ctx:GerberState):void;
}

export const Epsilon = 1E-12;
