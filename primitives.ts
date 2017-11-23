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
    negVector
} from "./vectorUtils";
import {AritmeticOperation, Memory} from "./expressions";
import {
    Polygon,
    PolygonSet,
    translatePolygon,
    translatePolySet,
    rotatePolygon,
    polySetBounds,
    unionPolygonSet,
    subtractPolygonSet
} from "./polygonSet";

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
    public x:number;
    public y:number;

    constructor (x?:number, y?:number) {
        if (x != undefined) {
            this.x = x;
        } else {
            this.x = 0;
        }
        if (y != undefined) {
            this.y = y;
        } else {
            this.y = 0;
        }
    }

    isValid():boolean {
        return this.x != undefined && this.y != undefined;
    }

    toString():string {
        return `(${formatFloat(this.x, 3)}, ${formatFloat(this.y, 3)})`;
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

    midPoint(other:Point):Point {
        return new Point((this.x + other.x) / 2, (this.y + other.y) / 2);
    }

    // The angle of the vector (other - this) in radians 0..2PI
    angleFrom(other:Point):number {
        let angle = Math.atan2(other.y - this.y, other.x - this.x);
        if (angle < 0) {
            angle += Math.PI * 2;
        }
        return angle;
    }

    angleTo(other:Point):number {
        let angle = Math.atan2(this.y - other.y, this.x - other.x);
        if (angle < 0) {
            angle += Math.PI * 2;
        }
        return angle;
    }

    // The angle of the vector (this - (0, 0)) in radians 0..2PI
    angle():number {
        let angle = Math.atan2(this.y, this.x);
        if (angle < 0) {
            angle += Math.PI * 2;
        }
        return angle;
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

const PI2 = Math.PI * 2;
export const NUMSTEPS = 40;
const NUMSTEPS2 = NUMSTEPS / 2;
const ZeroPoint = new Point(0, 0);

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

function arcToPolygon(
    start:Point,
    end:Point,
    center:Point,
    closeEnd:boolean = true,
    closeStart:boolean = true):Polygon {
    let result:Polygon = new Array<Point>(NUMSTEPS - ((closeStart) ? 0 : 1) - ((closeEnd) ? 0 : 1));
    let startAngle = center.angleFrom(start);
    let endAngle = center.angleFrom(end);
    if (endAngle < startAngle) {
        endAngle += Math.PI * 2;
    }
    let radius = (center.distance(start) + center.distance(end)) / 2;
    let step = (endAngle - startAngle) / NUMSTEPS;
    let startOffset = -1;
    if (closeStart) {
        result[0] = start.clone();
        startOffset = 0;
    }
    for (let idx = 1; idx < NUMSTEPS; idx++) {
        let angle = idx * step + startAngle;
        let x = center.x + radius * Math.cos(angle);
        let y = center.y + radius * Math.sin(angle);
        result[idx + startOffset] = new Point(x, y);
    }
    if (closeEnd) {
        result[NUMSTEPS - 1 + startOffset] = end.clone();
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

    generateArcDraw(start:Point, end:Point, center:Point):Polygon {
        let result:Polygon;
        if (start.distance(end) < Epsilon) {
            if (this.templateName == "C" || this.templateName == "O") {
                return translatePolygon(
                    circleToPolygon(this.modifiers[0] / 2),
                    start.midPoint(end));
            } else if (this.templateName == "R") {
                return translatePolygon(
                    rectangleToPolygon(this.modifiers[0], this.modifiers[1]),
                    start.midPoint(end));
            }
            throw new GerberParseException(`Draw with this aperture is not supported. ${this.templateName}`);
        }
        let startVector = {x:start.x - center.x, y:start.y - center.y};
        let endVector = {x:end.x - center.x, y:end.y - center.y};
        // This is the radius of the aperture, not the arc itself
        let radius = this.modifiers[0] / 2;
        let rStartVector = scaleVector(unitVector(startVector), radius);
        let rEndVector = scaleVector(unitVector(endVector), radius);
        let innerStartVector = addVector(startVector, negVector(rStartVector));
        let outerStartVector = addVector(startVector, rStartVector);
        let innerEndVector = addVector(endVector, negVector(rEndVector));
        let outerEndVector = addVector(endVector, rEndVector);
        let innerStart = new Point(innerStartVector.x + center.x, innerStartVector.y + center.y);
        let outerStart = new Point(outerStartVector.x + center.x, outerStartVector.y + center.y);
        let innerEnd = new Point(innerEndVector.x + center.x, innerEndVector.y + center.y);
        let outerEnd = new Point(outerEndVector.x + center.x, outerEndVector.y + center.y);
        if (this.templateName == "C" || this.templateName == "O") {
            result = arcToPolygon(innerStart, outerStart, innerStart.midPoint(outerStart), false);
            result = result.concat(arcToPolygon(outerStart, outerEnd, center, false));
            result = result.concat(arcToPolygon(outerEnd, innerEnd, outerEnd.midPoint(innerEnd), false));
            result = result.concat(arcToPolygon(innerStart, innerEnd, center).reverse());
            return result;
        } else if (this.templateName == "R") {
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
            return result;
        }
        throw new GerberParseException(`Draw with this aperture is not supported. ${this.templateName}`);
    }

    generateCircleDraw(center:Point, radius:number):PolygonSet {
        if (this.templateName == "C" || this.templateName == "O" || this.templateName == "R") {
            let result:PolygonSet = [];
            let apertureRadius = this.modifiers[0] / 2;
            result.push(translatePolygon(circleToPolygon(radius - apertureRadius), center));
            result.push(translatePolygon(circleToPolygon(radius + apertureRadius), center));
            return result;
        }
        throw new GerberParseException(`Draw with this aperture is not supported. ${this.templateName}`);
    }

    generateLineDraw(start:Point, end:Point):Polygon {
        let result:Polygon;
        if (start.distance(end) < Epsilon) {
            if (this.templateName == "C" || this.templateName == "O") {
                return translatePolygon(
                    circleToPolygon(this.modifiers[0] / 2),
                    start.midPoint(end));
            } else if (this.templateName == "R") {
                return translatePolygon(
                    rectangleToPolygon(this.modifiers[0], this.modifiers[1]),
                    start.midPoint(end));
            }
            throw new GerberParseException(`Draw with this aperture is not supported. ${this.templateName}`);
        }
        let angle = start.angleFrom(end);

        if (this.templateName == "C" || this.templateName == "O") {
            let radius = this.modifiers[0] / 2;
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
            return result;
        } else if (this.templateName == "R") {
            let width2 = this.modifiers[0] / 2;
            let height2 = this.modifiers[1] / 2;
            if (Math.abs(start.x - end.x) < Epsilon) { // Vertical Line
                return translatePolygon(
                    rectangleToPolygon(this.modifiers[0], Math.abs(end.y - start.y) + this.modifiers[1]),
                    start.midPoint(end));
            } else if (Math.abs(start.y - end.y) < Epsilon) { // Horizontal Line
                return translatePolygon(
                    rectangleToPolygon(Math.abs(end.x - start.x) + this.modifiers[0], this.modifiers[1]),
                    start.midPoint(end));
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
                return result;
            }
        }
        throw new GerberParseException(`Draw with this aperture is not supported. ${this.templateName}`);
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

export interface GraphicsOperations {
    line(from:Point, to:Point, ctx:GerberState);
    circle(center:Point, radius:number, ctx:GerberState);
    arc(center:Point, radius:number, start:Point, end:Point, ctx:GerberState);
    flash(center:Point, ctx:GerberState);
    close(ctx:GerberState);
    region(contours:Array<Array<LineSegment|CircleSegment|ArcSegment>>, ctx:GerberState);
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

    startRegion() {
        this.savedGraphisOperationsConsumer_ = this.graphisOperationsConsumer_;
        this.graphisOperationsConsumer_ = new RegionGraphicsOperationsConsumer();
    }

    endRegion() {
        let region = this.graphisOperationsConsumer_ as RegionGraphicsOperationsConsumer;
        region.close(this);

        this.graphisOperationsConsumer_ = this.savedGraphisOperationsConsumer_;
        this.graphisOperationsConsumer_.region(region.regionContours, this);
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

    close(ctx:GerberState) {
        if (this.contour_.length > 0) {
            this.regionContours_.push(this.contour_);
            this.contour_ = [];
        }
    }

    region(contours:Array<RegionContour>, ctx:GerberState) {
        ctx.error("Regions are not allowed inside a region definition.");
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

export class Region {
    constructor(
        readonly contours:Array<RegionContour>) {
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

    get bounds():Bounds {
        if (this.contours.length == 0) {
            return EmptyBounds();
        }
        let bounds = Region.contourBounds(this.contours[0]);
        this.contours.forEach(c => bounds.merge(Region.contourBounds(c)));
        return bounds;
    }

    private static contourBounds(contour:RegionContour):Bounds {
        if (contour.length == 0) {
            return EmptyBounds();
        }
        let bounds = contour[0].bounds;
        contour.forEach(s => bounds.merge(s.bounds));
        return bounds;
    }
}

export type GraphicsPrimitive = Line | Circle | Arc | Flash | Region;

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

    region(contours:Array<RegionContour>, ctx:GerberState) {
        this.primitives_.push(new Region(contours));
    }
}

export interface GerberCommand {
    readonly name:string;
    readonly isAdvanced:boolean;
    formatOutput(fmt:CoordinateFormatSpec):string;
    execute(ctx:GerberState);
}

export const Epsilon = 1E-12;
