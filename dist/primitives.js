"use strict";
/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 *
 * License: MIT License, see LICENSE.txt
 */
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * This file contains some classes that abstract primitives in the Gerber
 * file format.
 *
 * Some of these are for internal consumption.
 */
const utils_1 = require("./utils");
const vectorUtils_1 = require("./vectorUtils");
const expressions_1 = require("./expressions");
const polygonSet_1 = require("./polygonSet");
const point_1 = require("./point");
const polygonTools_1 = require("./polygonTools");
var CoordinateUnits;
(function (CoordinateUnits) {
    CoordinateUnits[CoordinateUnits["INCHES"] = 0] = "INCHES";
    CoordinateUnits[CoordinateUnits["MILLIMETERS"] = 1] = "MILLIMETERS";
})(CoordinateUnits = exports.CoordinateUnits || (exports.CoordinateUnits = {}));
var InterpolationMode;
(function (InterpolationMode) {
    InterpolationMode[InterpolationMode["LINEARx1"] = 0] = "LINEARx1";
    InterpolationMode[InterpolationMode["LINEARx10"] = 1] = "LINEARx10";
    InterpolationMode[InterpolationMode["LINEARx01"] = 2] = "LINEARx01";
    InterpolationMode[InterpolationMode["LINEARx001"] = 3] = "LINEARx001";
    InterpolationMode[InterpolationMode["CLOCKWISE"] = 4] = "CLOCKWISE";
    InterpolationMode[InterpolationMode["COUNTER_CLOCKWISE"] = 5] = "COUNTER_CLOCKWISE";
})(InterpolationMode = exports.InterpolationMode || (exports.InterpolationMode = {}));
var CoordinateMode;
(function (CoordinateMode) {
    CoordinateMode[CoordinateMode["ABSOLUTE"] = 0] = "ABSOLUTE";
    CoordinateMode[CoordinateMode["RELATIVE"] = 1] = "RELATIVE";
})(CoordinateMode = exports.CoordinateMode || (exports.CoordinateMode = {}));
var QuadrantMode;
(function (QuadrantMode) {
    QuadrantMode[QuadrantMode["SINGLE"] = 0] = "SINGLE";
    QuadrantMode[QuadrantMode["MULTI"] = 1] = "MULTI";
})(QuadrantMode = exports.QuadrantMode || (exports.QuadrantMode = {}));
var ObjectPolarity;
(function (ObjectPolarity) {
    ObjectPolarity[ObjectPolarity["DARK"] = 0] = "DARK";
    ObjectPolarity[ObjectPolarity["LIGHT"] = 1] = "LIGHT";
    ObjectPolarity[ObjectPolarity["THIN"] = 2] = "THIN";
})(ObjectPolarity = exports.ObjectPolarity || (exports.ObjectPolarity = {}));
var ObjectMirroring;
(function (ObjectMirroring) {
    ObjectMirroring[ObjectMirroring["NONE"] = 0] = "NONE";
    ObjectMirroring[ObjectMirroring["X_AXIS"] = 1] = "X_AXIS";
    ObjectMirroring[ObjectMirroring["Y_AXIS"] = 2] = "Y_AXIS";
    ObjectMirroring[ObjectMirroring["XY_AXIS"] = 3] = "XY_AXIS";
})(ObjectMirroring = exports.ObjectMirroring || (exports.ObjectMirroring = {}));
var AttributeType;
(function (AttributeType) {
    AttributeType[AttributeType["FILE"] = 0] = "FILE";
    AttributeType[AttributeType["APERTURE"] = 1] = "APERTURE";
    AttributeType[AttributeType["OBJECT"] = 2] = "OBJECT";
})(AttributeType = exports.AttributeType || (exports.AttributeType = {}));
function reversePolarity(polarity) {
    switch (polarity) {
        case ObjectPolarity.DARK:
            return ObjectPolarity.LIGHT;
        case ObjectPolarity.LIGHT:
            return ObjectPolarity.DARK;
        case ObjectPolarity.THIN:
            return ObjectPolarity.THIN;
    }
}
function reverseObjectsPolarity(objects) {
    return objects.map(o => {
        return { polySet: o.polySet, polarity: reversePolarity(o.polarity) };
    });
}
function polygonOrientation(polygon) {
    let sum = 0;
    if (polygon.length < 6)
        return 0;
    let startx = polygon[0];
    let starty = polygon[1];
    let endx;
    let endy;
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
var CoordinateZeroFormat;
(function (CoordinateZeroFormat) {
    CoordinateZeroFormat[CoordinateZeroFormat["NONE"] = 0] = "NONE";
    CoordinateZeroFormat[CoordinateZeroFormat["LEADING"] = 1] = "LEADING";
    CoordinateZeroFormat[CoordinateZeroFormat["TRAILING"] = 2] = "TRAILING";
    CoordinateZeroFormat[CoordinateZeroFormat["DIRECT"] = 3] = "DIRECT";
})(CoordinateZeroFormat = exports.CoordinateZeroFormat || (exports.CoordinateZeroFormat = {}));
var CoordinateType;
(function (CoordinateType) {
    CoordinateType[CoordinateType["ABSOLUTE"] = 1] = "ABSOLUTE";
    CoordinateType[CoordinateType["INCREMENTAL"] = 2] = "INCREMENTAL";
})(CoordinateType = exports.CoordinateType || (exports.CoordinateType = {}));
class CoordinateFormatSpec {
    constructor(coordFormat, coordType, xNumIntPos, xNumDecPos, yNumIntPos, yNumDecPos) {
        this.coordFormat = coordFormat;
        this.coordType = coordType;
        this.xNumIntPos = xNumIntPos;
        this.xNumDecPos = xNumDecPos;
        this.yNumIntPos = yNumIntPos;
        this.yNumDecPos = yNumDecPos;
        this.xPow = Math.pow(10, -this.xNumDecPos);
        this.yPow = Math.pow(10, -this.yNumDecPos);
    }
}
exports.CoordinateFormatSpec = CoordinateFormatSpec;
class GerberParseException {
    constructor(message, line) {
        this.message = message;
        this.line = line;
    }
    toString() {
        if (this.line != undefined) {
            return `Error parsing gerber file at line ${this.line}: ${this.message}`;
        }
        return `Error parsing gerber file: ${this.message}`;
    }
}
exports.GerberParseException = GerberParseException;
class BlockAperture {
    constructor(apertureId, objects) {
        this.apertureId = apertureId;
        this.objects_ = objects;
    }
    isDrawable() {
        return false;
    }
    objects(polarity) {
        if (polarity === ObjectPolarity.LIGHT) {
            return reverseObjectsPolarity(this.objects_);
        }
        return this.objects_;
    }
    generateArcDraw(start, end, center, state) {
        throw new GerberParseException("Draw with block aperture is not supported.");
    }
    generateCircleDraw(center, radius, state) {
        throw new GerberParseException("Draw with block aperture is not supported.");
    }
    generateLineDraw(start, end, state) {
        throw new GerberParseException("Draw with block aperture is not supported.");
    }
}
exports.BlockAperture = BlockAperture;
class ApertureDefinition {
    constructor(apertureId, templateName, modifiers) {
        this.apertureId = apertureId;
        this.templateName = templateName;
        this.modifiers = modifiers;
        this.macro_ = undefined;
        this.polygonSet_ = undefined;
    }
    isMacro() {
        return ApertureDefinition.standardTemplates.indexOf(this.templateName) < 0;
    }
    isDrawable() {
        return (this.templateName === 'C' && this.modifiers.length == 1)
            || (this.templateName === 'R' && this.modifiers.length == 2);
    }
    get macro() {
        return this.macro_;
    }
    execute(ctx) {
        if (this.isMacro()) {
            this.macro_ = ctx.getApertureMacro(this.templateName);
        }
        else if (ctx.isOutlineMode) {
            if (this.templateName == "C" || this.templateName == "O") {
                this.modifiers[0] = 0;
            }
        }
    }
    generateArcDraw(start, end, center, state) {
        let result;
        if (start.distance(end) < exports.Epsilon) {
            if (this.templateName == "C" || this.templateName == "O") {
                let radius = state.unitToMM(state.scale * this.modifiers[0] / 2);
                if (radius < exports.Epsilon) {
                    return { polygon: Float64Array.of(), is_solid: false };
                }
                let polygon = polygonTools_1.circleToPolygon(radius);
                polygonSet_1.translatePolygon(polygon, start.midPoint(end));
                return { polygon: polygon, is_solid: true };
            }
            else if (this.templateName == "R") {
                let polygon = polygonTools_1.rectangleToPolygon(state.unitToMM(state.scale * this.modifiers[0]), state.unitToMM(state.scale * this.modifiers[1]));
                polygonSet_1.translatePolygon(polygon, start.midPoint(end));
                return { polygon: polygon, is_solid: true };
            }
            throw new GerberParseException(`Draw with this aperture is not supported. ${this.templateName}`);
        }
        let startVector = { x: start.x - center.x, y: start.y - center.y };
        let endVector = { x: end.x - center.x, y: end.y - center.y };
        // This is the radius of the aperture, not the arc itself
        let apertureRadius = state.unitToMM(state.scale * this.modifiers[0] / 2);
        let rStartVector = vectorUtils_1.scaleVector(vectorUtils_1.unitVector(startVector), apertureRadius);
        let rEndVector = vectorUtils_1.scaleVector(vectorUtils_1.unitVector(endVector), apertureRadius);
        let innerStartVector = vectorUtils_1.addVector(startVector, vectorUtils_1.negVector(rStartVector));
        let outerStartVector = vectorUtils_1.addVector(startVector, rStartVector);
        let innerEndVector = vectorUtils_1.addVector(endVector, vectorUtils_1.negVector(rEndVector));
        let outerEndVector = vectorUtils_1.addVector(endVector, rEndVector);
        let innerStart = new point_1.Point(innerStartVector.x + center.x, innerStartVector.y + center.y);
        let outerStart = new point_1.Point(outerStartVector.x + center.x, outerStartVector.y + center.y);
        let innerEnd = new point_1.Point(innerEndVector.x + center.x, innerEndVector.y + center.y);
        let outerEnd = new point_1.Point(outerEndVector.x + center.x, outerEndVector.y + center.y);
        if (this.templateName == "C" || this.templateName == "O") {
            if (apertureRadius < exports.Epsilon) {
                return { polygon: polygonTools_1.arcToPolygon(start, end, center), is_solid: false };
            }
            result = new Float64Array(polygonTools_1.NUMSTEPS * 8 - 6);
            result.set(polygonTools_1.arcToPolygon(innerStart, outerStart, innerStart.midPoint(outerStart), false));
            result.set(polygonTools_1.arcToPolygon(outerStart, outerEnd, center, false), polygonTools_1.NUMSTEPS * 2 - 2);
            result.set(polygonTools_1.arcToPolygon(outerEnd, innerEnd, outerEnd.midPoint(innerEnd), false), polygonTools_1.NUMSTEPS * 4 - 4);
            let closingArc = polygonTools_1.arcToPolygon(innerStart, innerEnd, center);
            polygonTools_1.reversePolygon(closingArc);
            result.set(closingArc, polygonTools_1.NUMSTEPS * 6 - 6);
            return { polygon: result, is_solid: true };
        }
        else if (this.templateName == "R") {
            if (Math.abs(state.rotation) > exports.Epsilon
                || state.mirroring != ObjectMirroring.NONE) {
                throw new GerberParseException(`Unimplemented rotation or mirroring with rectangular apertures`);
            }
            let startLine = { x: outerStart.x - innerStart.x, y: outerStart.y - innerStart.y };
            let endLine = { x: outerEnd.x - innerEnd.x, y: outerEnd.y - innerEnd.y };
            let pStartLineCCW = vectorUtils_1.scaleVector(vectorUtils_1.unitVector({ x: startLine.y, y: -startLine.x }), this.modifiers[1]);
            let pEncLineCW = vectorUtils_1.scaleVector(vectorUtils_1.unitVector({ x: -endLine.y, y: endLine.x }), this.modifiers[1]);
            result = new Float64Array(10 + polygonTools_1.NUMSTEPS * 4);
            result[0] = innerStart.x;
            result[1] = innerStart.y;
            result[2] = innerStart.x + pStartLineCCW.x;
            result[3] = innerStart.y + pStartLineCCW.y;
            result[4] = outerStart.x + pStartLineCCW.x;
            result[5] = outerStart.y + pStartLineCCW.y;
            result.set(polygonTools_1.arcToPolygon(outerStart, outerEnd, center, false), 6);
            result[4 + polygonTools_1.NUMSTEPS * 2] = outerEnd.x;
            result[5 + polygonTools_1.NUMSTEPS * 2] = outerEnd.y;
            result[6 + polygonTools_1.NUMSTEPS * 2] = outerEnd.x + pEncLineCW.x;
            result[7 + polygonTools_1.NUMSTEPS * 2] = outerEnd.y + pEncLineCW.y;
            result[8 + polygonTools_1.NUMSTEPS * 2] = innerEnd.x + pEncLineCW.x;
            result[9 + polygonTools_1.NUMSTEPS * 2] = innerEnd.y + pEncLineCW.y;
            let closingArc = polygonTools_1.arcToPolygon(innerStart, innerEnd, center);
            polygonTools_1.reversePolygon(closingArc);
            result.set(closingArc, 10 + polygonTools_1.NUMSTEPS * 2);
            return { polygon: result, is_solid: true };
        }
        throw new GerberParseException(`Draw with this aperture is not supported. ${this.templateName}`);
    }
    generateCircleDraw(center, radius, state) {
        if (this.templateName == "C" || this.templateName == "O" || this.templateName == "R") {
            let result = [];
            let apertureRadius = state.unitToMM(state.scale * this.modifiers[0] / 2);
            if (apertureRadius < exports.Epsilon) {
                let polygon = polygonTools_1.circleToPolygon(radius);
                polygonSet_1.translatePolygon(polygon, center);
                return { polygonSet: [polygon], is_solid: false };
            }
            let polygon = polygonTools_1.circleToPolygon(radius + apertureRadius);
            polygonSet_1.translatePolygon(polygon, center);
            result.push(polygon);
            let innerCircle = polygonTools_1.circleToPolygon(radius - apertureRadius);
            polygonSet_1.translatePolygon(innerCircle, center);
            polygonTools_1.reversePolygon(innerCircle);
            result.push(innerCircle);
            return { polygonSet: result, is_solid: true };
        }
        throw new GerberParseException(`Draw with this aperture is not supported. ${this.templateName}`);
    }
    generateLineDraw(start, end, state) {
        let result;
        if (start.distance(end) < exports.Epsilon) {
            if (this.templateName == "C" || this.templateName == "O") {
                let radius = state.unitToMM(state.scale * this.modifiers[0] / 2);
                if (radius < exports.Epsilon) {
                    return { polygon: Float64Array.of(), is_solid: false };
                }
                let polygon = polygonTools_1.circleToPolygon(radius);
                polygonSet_1.translatePolygon(polygon, start.midPoint(end));
                return { polygon: polygon, is_solid: true };
            }
            else if (this.templateName == "R") {
                let polygon = polygonTools_1.rectangleToPolygon(state.unitToMM(state.scale * this.modifiers[0]), state.unitToMM(state.scale * this.modifiers[1]));
                polygonSet_1.mirrorPolygon(polygon, state.mirroring);
                polygonSet_1.rotatePolygon(polygon, state.rotation);
                polygonSet_1.translatePolygon(polygon, start.midPoint(end));
                return { polygon: polygon, is_solid: true };
            }
            throw new GerberParseException(`Draw with this aperture is not supported. ${this.templateName}`);
        }
        let angle = start.angleFrom(end);
        if (this.templateName == "C" || this.templateName == "O") {
            let radius = state.unitToMM(state.scale * this.modifiers[0] / 2);
            if (radius < exports.Epsilon) {
                return { polygon: Float64Array.of(start.x, start.y, end.x, end.y), is_solid: false };
            }
            let vector = { x: end.x - start.x, y: end.y - start.y };
            let uVector = vectorUtils_1.unitVector(vector);
            let pCW = vectorUtils_1.scaleVector({ x: uVector.y, y: -uVector.x }, radius);
            let pCCW = vectorUtils_1.scaleVector({ x: -uVector.y, y: uVector.x }, radius);
            let startLeft = vectorUtils_1.addVector({ x: start.x, y: start.y }, pCCW);
            let endLeft = vectorUtils_1.addVector(startLeft, vector);
            let startRight = vectorUtils_1.addVector({ x: start.x, y: start.y }, pCW);
            let endRight = vectorUtils_1.addVector(startRight, vector);
            result = new Float64Array(polygonTools_1.NUMSTEPS * 4 + 2);
            result.set(polygonTools_1.arcToPolygon(new point_1.Point(startLeft.x, startLeft.y), new point_1.Point(startRight.x, startRight.y), start));
            result.set(polygonTools_1.arcToPolygon(new point_1.Point(endRight.x, endRight.y), new point_1.Point(endLeft.x, endLeft.y), end), polygonTools_1.NUMSTEPS * 2);
            result[polygonTools_1.NUMSTEPS * 4] = startLeft.x;
            result[polygonTools_1.NUMSTEPS * 4 + 1] = startLeft.y;
            return { polygon: result, is_solid: true };
        }
        else if (this.templateName == "R") {
            if (Math.abs(state.rotation) > exports.Epsilon
                || state.mirroring != ObjectMirroring.NONE) {
                throw new GerberParseException(`Unimplemented rotation or mirroring with rectangular apertures`);
            }
            let width2 = state.unitToMM(state.scale * this.modifiers[0] / 2);
            let height2 = state.unitToMM(state.scale * this.modifiers[1] / 2);
            if (Math.abs(start.x - end.x) < exports.Epsilon) { // Vertical Line
                let polygon = polygonTools_1.rectangleToPolygon(state.unitToMM(this.modifiers[0]), Math.abs(end.y - start.y) + state.unitToMM(this.modifiers[1]));
                polygonSet_1.translatePolygon(polygon, start.midPoint(end));
                return { polygon: polygon, is_solid: true };
            }
            else if (Math.abs(start.y - end.y) < exports.Epsilon) { // Horizontal Line
                let polygon = polygonTools_1.rectangleToPolygon(Math.abs(end.x - start.x) + state.unitToMM(this.modifiers[0]), state.unitToMM(this.modifiers[1]));
                polygonSet_1.translatePolygon(polygon, start.midPoint(end));
                return { polygon: polygon, is_solid: true };
            }
            else {
                let vector = { x: end.x - start.x, y: end.y - start.y };
                if (angle < Math.PI / 2) {
                    result = Float64Array.of(start.x - width2, start.y - height2, start.x + width2, start.y - height2, end.x + width2, end.y - height2, end.x + width2, end.y + height2, end.x - width2, end.y + height2, start.x - width2, start.y + height2, start.x - width2, start.y - height2);
                }
                else if (angle < Math.PI) {
                    result = Float64Array.of(start.x - width2, start.y - height2, start.x + width2, start.y - height2, start.x + width2, start.y + height2, end.x + width2, end.y + height2, end.x - width2, end.y + height2, end.x - width2, end.y - height2, start.x - width2, start.y - height2);
                }
                else if (angle < 3 * Math.PI / 2) {
                    result = Float64Array.of(end.x - width2, end.y - height2, end.x + width2, end.y - height2, start.x + width2, start.y - height2, start.x + width2, start.y + height2, start.x - width2, start.y + height2, end.x - width2, end.y + height2, end.x - width2, end.y - height2);
                }
                else {
                    result = Float64Array.of(end.x - width2, end.y - height2, end.x + width2, end.y - height2, end.x + width2, end.y + height2, start.x + width2, start.y + height2, start.x - width2, start.y + height2, start.x - width2, start.y - height2, start.x - width2, start.y - height2);
                }
                return { polygon: result, is_solid: true };
            }
        }
        throw new GerberParseException(`Draw with this aperture is not supported. ${this.templateName}`);
    }
    objects(polarity, state) {
        return [{ polySet: this.toPolySet(state), polarity: polarity }];
    }
    toPolySet(state) {
        if (this.polygonSet_ != undefined) {
            return this.polygonSet_;
        }
        let result = [];
        if (this.templateName === "C") {
            let radius = state.unitToMM(this.modifiers[0] / 2);
            if (radius < exports.Epsilon) {
                throw new GerberParseException('Can not convert zero size aperture to poly set');
            }
            result.push(polygonTools_1.circleToPolygon(radius));
            if (this.modifiers.length == 2 && this.modifiers[1] > exports.Epsilon) {
                let hole = polygonTools_1.circleToPolygon(state.unitToMM(this.modifiers[1] / 2));
                polygonTools_1.reversePolygon(hole);
                result.push(hole);
            }
            else if (this.modifiers.length == 3 && this.modifiers[1] > exports.Epsilon && this.modifiers[2] > exports.Epsilon) {
                let hole = polygonTools_1.rectangleToPolygon(state.unitToMM(this.modifiers[1]), state.unitToMM(this.modifiers[2]));
                polygonTools_1.reversePolygon(hole);
                result.push(hole);
            }
        }
        else if (this.templateName === "R") {
            result.push(polygonTools_1.rectangleToPolygon(state.unitToMM(this.modifiers[0]), state.unitToMM(this.modifiers[1])));
            if (this.modifiers.length == 3 && this.modifiers[2] > exports.Epsilon) {
                let hole = polygonTools_1.circleToPolygon(state.unitToMM(this.modifiers[2] / 2));
                polygonTools_1.reversePolygon(hole);
                result.push(hole);
            }
            else if (this.modifiers.length == 4 && this.modifiers[2] > exports.Epsilon && this.modifiers[3] > exports.Epsilon) {
                let hole = polygonTools_1.rectangleToPolygon(state.unitToMM(this.modifiers[2]), state.unitToMM(this.modifiers[3]));
                polygonTools_1.reversePolygon(hole);
                result.push(hole);
            }
        }
        else if (this.templateName === "O") {
            result.push(polygonTools_1.obroundToPolygon(state.unitToMM(this.modifiers[0]), state.unitToMM(this.modifiers[1])));
            if (this.modifiers.length == 3 && this.modifiers[2] > exports.Epsilon) {
                let hole = polygonTools_1.circleToPolygon(state.unitToMM(this.modifiers[2] / 2));
                polygonTools_1.reversePolygon(hole);
                result.push(hole);
            }
            else if (this.modifiers.length == 4 && this.modifiers[3] > exports.Epsilon && this.modifiers[4] > exports.Epsilon) {
                let hole = polygonTools_1.rectangleToPolygon(state.unitToMM(this.modifiers[2]), state.unitToMM(this.modifiers[3]));
                polygonTools_1.reversePolygon(hole);
                result.push(hole);
            }
        }
        else if (this.templateName === "P") {
            if (this.modifiers.length == 2) {
                result.push(polygonTools_1.circleToPolygon(state.unitToMM(this.modifiers[0] / 2), this.modifiers[1]));
            }
            else if (this.modifiers.length > 2) {
                result.push(polygonTools_1.circleToPolygon(state.unitToMM(this.modifiers[0] / 2), this.modifiers[1], this.modifiers[2]));
            }
            if (this.modifiers.length == 4 && this.modifiers[3] > exports.Epsilon) {
                let hole = polygonTools_1.circleToPolygon(state.unitToMM(this.modifiers[3] / 2));
                polygonTools_1.reversePolygon(hole);
                result.push(hole);
            }
            else if (this.modifiers.length == 5 && this.modifiers[3] > exports.Epsilon && this.modifiers[4] > exports.Epsilon) {
                let hole = polygonTools_1.rectangleToPolygon(state.unitToMM(this.modifiers[3]), state.unitToMM(this.modifiers[4]));
                polygonTools_1.reversePolygon(hole);
                result.push(hole);
            }
        }
        else {
            return this.macro.toPolygonSet(this.modifiers, state);
        }
        this.polygonSet_ = result;
        return result;
    }
}
exports.ApertureDefinition = ApertureDefinition;
ApertureDefinition.standardTemplates = ["C", "R", "O", "P"];
class VariableDefinition {
    constructor(id, expression) {
        this.id = id;
        this.expression = expression;
    }
}
exports.VariableDefinition = VariableDefinition;
class Primitive {
    constructor(code, modifiers) {
        this.code = code;
        this.modifiers = modifiers;
    }
}
exports.Primitive = Primitive;
class PrimitiveComment {
    constructor(text) {
        this.text = text;
    }
}
exports.PrimitiveComment = PrimitiveComment;
class ApertureMacro {
    constructor(macroName, content) {
        this.macroName = macroName;
        this.content = content;
    }
    toPolygonSet(modifiers, state) {
        let positives = [];
        let negatives = [];
        let memory = new expressions_1.Memory(modifiers);
        for (let element of this.content) {
            if (element instanceof PrimitiveComment) {
                continue;
            }
            else if (element instanceof VariableDefinition) {
                let variable = element;
                memory.set(variable.id, variable.expression.getValue(memory));
                continue;
            }
            else {
                let primitive = element;
                let modifiers = primitive.modifiers.map(m => m.getValue(memory));
                let numModifiers = modifiers.length;
                let shape;
                let isPositive;
                let center;
                let diameter;
                let rotation;
                let gap;
                let outerDiameter;
                let width;
                let height;
                switch (primitive.code) {
                    case 1: // Circle (exposure, diameter, center x, center y, rotation)
                        isPositive = ApertureMacro.getValue(modifiers, 0) != 0;
                        diameter = state.unitToMM(ApertureMacro.getValue(modifiers, 1));
                        center = state.pointToMM(new point_1.Point(ApertureMacro.getValue(modifiers, 2), ApertureMacro.getValue(modifiers, 3)));
                        if (diameter > exports.Epsilon) {
                            let polygon = polygonTools_1.circleToPolygon(diameter / 2);
                            polygonSet_1.translatePolygon(polygon, center);
                            polygonSet_1.rotatePolygon(polygon, ApertureMacro.getValue(modifiers, 4));
                            shape = [polygon];
                        }
                        else {
                            shape = [];
                            //console.log("Empty circle shape");
                        }
                        break;
                    case 4: // Outline (exposure, num vertices, start x, start y, ..., (3+2n) end x, 4+2n end y, rotation)
                        isPositive = ApertureMacro.getValue(modifiers, 0) != 0;
                        let numPoints = ApertureMacro.getValue(modifiers, 1);
                        if (numPoints < 1) {
                            throw new GerberParseException(`Invalid number of points in a macro outline ${numPoints}`);
                        }
                        let outline = new Float64Array(numPoints * 2 + 2);
                        for (let idx = 0; idx <= numPoints; idx++) {
                            outline[idx * 2] = state.unitToMM(ApertureMacro.getValue(modifiers, 2 * idx + 2));
                            outline[idx * 2 + 1] = state.unitToMM(ApertureMacro.getValue(modifiers, 2 * idx + 3));
                        }
                        // If the contour is clockwise, reverse the polygon.
                        if (polygonOrientation(outline) > 0) {
                            polygonTools_1.reversePolygon(outline);
                        }
                        polygonSet_1.rotatePolygon(outline, ApertureMacro.getValue(modifiers, 2 * numPoints + 4));
                        shape = [outline];
                        break;
                    case 5: // Polygon (exposure, num vertices, center x, center y, diameter, rotation)
                        isPositive = ApertureMacro.getValue(modifiers, 0) != 0;
                        let numSteps = ApertureMacro.getValue(modifiers, 1);
                        center = state.pointToMM(new point_1.Point(ApertureMacro.getValue(modifiers, 2), ApertureMacro.getValue(modifiers, 3)));
                        diameter = state.unitToMM(ApertureMacro.getValue(modifiers, 4));
                        if (numSteps < 3) {
                            throw new GerberParseException(`Invalid number of steps in a macro polygon ${numSteps}`);
                        }
                        if (diameter > exports.Epsilon) {
                            let polygon = polygonTools_1.circleToPolygon(diameter / 2, numSteps);
                            polygonSet_1.translatePolygon(polygon, center);
                            polygonSet_1.rotatePolygon(polygon, ApertureMacro.getValue(modifiers, 5));
                            shape = [polygon];
                        }
                        else {
                            shape = [];
                            //console.log("Empty polygon shape");
                        }
                        break;
                    case 6: // Moire (center x, center y, outer diam, ring thickness, gap, num rings, cross hair thickness, cross hair len, rotation)
                        // exposure is always on
                        isPositive = true;
                        shape = [];
                        center = state.pointToMM(new point_1.Point(ApertureMacro.getValue(modifiers, 0), ApertureMacro.getValue(modifiers, 1)));
                        outerDiameter = state.unitToMM(ApertureMacro.getValue(modifiers, 2));
                        let ringThickness = state.unitToMM(ApertureMacro.getValue(modifiers, 3));
                        gap = state.unitToMM(ApertureMacro.getValue(modifiers, 4));
                        let maxRings = ApertureMacro.getValue(modifiers, 5);
                        let crossThickness = state.unitToMM(ApertureMacro.getValue(modifiers, 6));
                        let crossLen = state.unitToMM(ApertureMacro.getValue(modifiers, 7));
                        rotation = ApertureMacro.getValue(modifiers, 8);
                        if (ringThickness > exports.Epsilon) {
                            for (let ringNo = 0; ringNo < maxRings && outerDiameter > exports.Epsilon; ringNo++) {
                                let innerDiameter = outerDiameter - ringThickness * 2;
                                let polygon = polygonTools_1.circleToPolygon(outerDiameter / 2);
                                polygonSet_1.translatePolygon(polygon, center);
                                polygonSet_1.rotatePolygon(polygon, rotation);
                                shape.push(polygon);
                                if (innerDiameter > exports.Epsilon) {
                                    let closingCircle = polygonTools_1.circleToPolygon(innerDiameter / 2);
                                    polygonTools_1.reversePolygon(closingCircle);
                                    polygonSet_1.translatePolygon(closingCircle, center);
                                    polygonSet_1.rotatePolygon(closingCircle, rotation);
                                    shape.push(closingCircle);
                                }
                                outerDiameter = innerDiameter - gap * 2;
                            }
                        }
                        if (crossLen > exports.Epsilon && crossThickness > exports.Epsilon) {
                            let hLine = polygonTools_1.rectangleToPolygon(crossLen, crossThickness);
                            let vLine = polygonTools_1.rectangleToPolygon(crossThickness, crossLen);
                            polygonSet_1.translatePolygon(hLine, center);
                            polygonSet_1.translatePolygon(vLine, center);
                            polygonSet_1.rotatePolygon(hLine, rotation);
                            polygonSet_1.rotatePolygon(vLine, rotation);
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
                        center = state.pointToMM(new point_1.Point(ApertureMacro.getValue(modifiers, 0), ApertureMacro.getValue(modifiers, 1)));
                        outerDiameter = state.unitToMM(ApertureMacro.getValue(modifiers, 2));
                        let innerDiameter = state.unitToMM(ApertureMacro.getValue(modifiers, 3));
                        gap = state.unitToMM(ApertureMacro.getValue(modifiers, 4));
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
                        let polygon;
                        if (outerDiameter > exports.Epsilon) {
                            if (gap > exports.Epsilon) {
                                if (innerDiameter > exports.Epsilon) {
                                    // Quadrant 1 shape
                                    polygon = new Float64Array(2 + polygonTools_1.NUMSTEPS * 4);
                                    let innerStart = new point_1.Point(innerRadius + center.x, gap2 + center.y);
                                    let outerStart = new point_1.Point(outerRadius + center.x, gap2 + center.y);
                                    let innerEnd = new point_1.Point(gap2 + center.x, innerRadius + center.y);
                                    let outerEnd = new point_1.Point(gap2 + center.x, outerRadius + center.y);
                                    polygon[0] = innerStart.x;
                                    polygon[1] = innerStart.y;
                                    polygon.set(polygonTools_1.arcToPolygon(outerStart, outerEnd, center), 2);
                                    let closingArc = polygonTools_1.arcToPolygon(innerStart, innerEnd, center);
                                    polygonTools_1.reversePolygon(closingArc);
                                    polygon.set(closingArc, 2 + polygonTools_1.NUMSTEPS * 2);
                                    polygonSet_1.rotatePolygon(polygon, rotation);
                                    shape.push(polygon);
                                    // Quadrant 2 shape
                                    polygon = new Float64Array(2 + polygonTools_1.NUMSTEPS * 4);
                                    innerStart = new point_1.Point(-gap2 + center.x, innerRadius + center.y);
                                    outerStart = new point_1.Point(-gap2 + center.x, outerRadius + center.y);
                                    innerEnd = new point_1.Point(-innerRadius + center.x, gap2 + center.y);
                                    outerEnd = new point_1.Point(-outerRadius + center.x, gap2 + center.y);
                                    polygon[0] = innerStart.x;
                                    polygon[1] = innerStart.y;
                                    polygon.set(polygonTools_1.arcToPolygon(outerStart, outerEnd, center), 2);
                                    closingArc = polygonTools_1.arcToPolygon(innerStart, innerEnd, center);
                                    polygonTools_1.reversePolygon(closingArc);
                                    polygon.set(closingArc, 2 + polygonTools_1.NUMSTEPS * 2);
                                    polygonSet_1.rotatePolygon(polygon, rotation);
                                    shape.push(polygon);
                                    // Quadrant 3 shape
                                    polygon = new Float64Array(2 + polygonTools_1.NUMSTEPS * 4);
                                    innerStart = new point_1.Point(-innerRadius + center.x, -gap2 + center.y);
                                    outerStart = new point_1.Point(-outerRadius + center.x, -gap2 + center.y);
                                    innerEnd = new point_1.Point(-gap2 + center.x, -innerRadius + center.y);
                                    outerEnd = new point_1.Point(-gap2 + center.x, -outerRadius + center.y);
                                    polygon[0] = innerStart.x;
                                    polygon[1] = innerStart.y;
                                    polygon.set(polygonTools_1.arcToPolygon(outerStart, outerEnd, center), 2);
                                    closingArc = polygonTools_1.arcToPolygon(innerStart, innerEnd, center);
                                    polygonTools_1.reversePolygon(closingArc);
                                    polygon.set(closingArc, 2 + polygonTools_1.NUMSTEPS * 2);
                                    polygonSet_1.rotatePolygon(polygon, rotation);
                                    shape.push(polygon);
                                    // Quadrant 4 shape
                                    polygon = new Float64Array(2 + polygonTools_1.NUMSTEPS * 4);
                                    innerStart = new point_1.Point(gap2 + center.x, -innerRadius + center.y);
                                    outerStart = new point_1.Point(gap2 + center.x, -outerRadius + center.y);
                                    innerEnd = new point_1.Point(innerRadius + center.x, -gap2 + center.y);
                                    outerEnd = new point_1.Point(outerRadius + center.x, -gap2 + center.y);
                                    polygon[0] = innerStart.x;
                                    polygon[1] = innerStart.y;
                                    polygon.set(polygonTools_1.arcToPolygon(outerStart, outerEnd, center), 2);
                                    closingArc = polygonTools_1.arcToPolygon(innerStart, innerEnd, center);
                                    polygonTools_1.reversePolygon(closingArc);
                                    polygon.set(closingArc, 2 + polygonTools_1.NUMSTEPS * 2);
                                    polygonSet_1.rotatePolygon(polygon, rotation);
                                    shape.push(polygon);
                                }
                                else {
                                    // Quadrant 1 shape
                                    polygon = new Float64Array(4 + polygonTools_1.NUMSTEPS * 2);
                                    let innerPoint = new point_1.Point(gap2 + center.x, gap2 + center.y);
                                    let outerStart = new point_1.Point(outerRadius + center.x, gap2 + center.y);
                                    let outerEnd = new point_1.Point(gap2 + center.x, outerRadius + center.y);
                                    polygon[0] = innerPoint.x;
                                    polygon[1] = innerPoint.y;
                                    polygon.set(polygonTools_1.arcToPolygon(outerStart, outerEnd, center), 2);
                                    polygon[2 + polygonTools_1.NUMSTEPS * 2] = innerPoint.x;
                                    polygon[3 + polygonTools_1.NUMSTEPS * 2] = innerPoint.y;
                                    polygonSet_1.rotatePolygon(polygon, rotation);
                                    shape.push(polygon);
                                    // Quadrant 2 shape
                                    polygon = new Float64Array(4 + polygonTools_1.NUMSTEPS * 2);
                                    innerPoint = new point_1.Point(-gap2 + center.x, gap2 + center.y);
                                    outerStart = new point_1.Point(-gap2 + center.x, outerRadius + center.y);
                                    outerEnd = new point_1.Point(-outerRadius + center.x, gap2 + center.y);
                                    polygon[0] = innerPoint.x;
                                    polygon[1] = innerPoint.y;
                                    polygon.set(polygonTools_1.arcToPolygon(outerStart, outerEnd, center), 2);
                                    polygon[2 + polygonTools_1.NUMSTEPS * 2] = innerPoint.x;
                                    polygon[3 + polygonTools_1.NUMSTEPS * 2] = innerPoint.y;
                                    polygonSet_1.rotatePolygon(polygon, rotation);
                                    shape.push(polygon);
                                    // Quadrant 3 shape
                                    polygon = new Float64Array(4 + polygonTools_1.NUMSTEPS * 2);
                                    innerPoint = new point_1.Point(-gap2 + center.x, -gap2 + center.y);
                                    outerStart = new point_1.Point(-outerRadius + center.x, -gap2 + center.y);
                                    outerEnd = new point_1.Point(-gap2 + center.x, -outerRadius + center.y);
                                    polygon[0] = innerPoint.x;
                                    polygon[1] = innerPoint.y;
                                    polygon.set(polygonTools_1.arcToPolygon(outerStart, outerEnd, center), 2);
                                    polygon[2 + polygonTools_1.NUMSTEPS * 2] = innerPoint.x;
                                    polygon[3 + polygonTools_1.NUMSTEPS * 2] = innerPoint.y;
                                    polygonSet_1.rotatePolygon(polygon, rotation);
                                    shape.push(polygon);
                                    // Quadrant 4 shape
                                    polygon = new Float64Array(4 + polygonTools_1.NUMSTEPS * 2);
                                    innerPoint = new point_1.Point(gap2 + center.x, -gap2 + center.y);
                                    outerStart = new point_1.Point(gap2 + center.x, -outerRadius + center.y);
                                    outerEnd = new point_1.Point(outerRadius + center.x, -gap2 + center.y);
                                    polygon[0] = innerPoint.x;
                                    polygon[1] = innerPoint.y;
                                    polygon.set(polygonTools_1.arcToPolygon(outerStart, outerEnd, center), 2);
                                    polygon[2 + polygonTools_1.NUMSTEPS * 2] = innerPoint.x;
                                    polygon[3 + polygonTools_1.NUMSTEPS * 2] = innerPoint.y;
                                    polygonSet_1.rotatePolygon(polygon, rotation);
                                    shape.push(polygon);
                                }
                            }
                            else {
                                let circle = polygonTools_1.circleToPolygon(outerRadius);
                                polygonSet_1.translatePolygon(circle, center);
                                polygonSet_1.rotatePolygon(circle, rotation);
                                shape.push(circle);
                                if (innerDiameter > exports.Epsilon) {
                                    let closingCircle = polygonTools_1.circleToPolygon(innerRadius);
                                    polygonTools_1.reversePolygon(closingCircle);
                                    polygonSet_1.translatePolygon(closingCircle, center);
                                    polygonSet_1.rotatePolygon(closingCircle, rotation);
                                    shape.push(closingCircle);
                                }
                            }
                        }
                        else {
                            shape = [];
                            //console.log("Empty thermal shape");
                        }
                        break;
                    case 20: // Vector line (exposure, width, start x, start y, end x, end y, rotation)
                        isPositive = ApertureMacro.getValue(modifiers, 0) != 0;
                        width = state.unitToMM(ApertureMacro.getValue(modifiers, 1) / 2);
                        let centerStart = state.pointToMM(new point_1.Point(ApertureMacro.getValue(modifiers, 2), ApertureMacro.getValue(modifiers, 3)));
                        let centerEnd = state.pointToMM(new point_1.Point(ApertureMacro.getValue(modifiers, 4), ApertureMacro.getValue(modifiers, 5)));
                        rotation = ApertureMacro.getValue(modifiers, 6);
                        let direction = vectorUtils_1.unitVector({ x: centerEnd.x - centerStart.x, y: centerEnd.y - centerStart.y });
                        let dirNormalCCW = vectorUtils_1.scaleVector({ x: -direction.y, y: direction.x }, width);
                        let startLeft = new point_1.Point(centerStart.x + dirNormalCCW.x, centerStart.y + dirNormalCCW.y);
                        let startRight = new point_1.Point(centerStart.x - dirNormalCCW.x, centerStart.y - dirNormalCCW.y);
                        let endLeft = new point_1.Point(centerEnd.x + dirNormalCCW.x, centerEnd.y + dirNormalCCW.y);
                        let endRight = new point_1.Point(centerEnd.x - dirNormalCCW.x, centerEnd.y - dirNormalCCW.y);
                        let line = Float64Array.of(startLeft.x, startLeft.y, startRight.x, startRight.y, endRight.x, endRight.y, endLeft.x, endLeft.y, startLeft.x, startLeft.y);
                        polygonSet_1.rotatePolygon(line, rotation);
                        shape = [line];
                        break;
                    case 21: // Center line (exposure, width, height, center x, center y, rotation)
                        isPositive = ApertureMacro.getValue(modifiers, 0) != 0;
                        width = state.unitToMM(ApertureMacro.getValue(modifiers, 1));
                        height = state.unitToMM(ApertureMacro.getValue(modifiers, 2));
                        center = state.pointToMM(new point_1.Point(ApertureMacro.getValue(modifiers, 3), ApertureMacro.getValue(modifiers, 4)));
                        rotation = ApertureMacro.getValue(modifiers, 5);
                        if (width > exports.Epsilon && height > exports.Epsilon) {
                            let line = polygonTools_1.rectangleToPolygon(width, height);
                            polygonSet_1.translatePolygon(line, center);
                            polygonSet_1.rotatePolygon(line, rotation);
                            shape = [line];
                        }
                        else {
                            shape = [];
                            //console.log("Empty center line shape");
                        }
                        break;
                    default:
                        throw new GerberParseException(`Unsupported macro primitive ${primitive.code}`);
                }
                if (isPositive) {
                    positives.push(...shape);
                }
                else {
                    negatives.push(...shape);
                }
            }
        }
        if (negatives.length > 0) {
            return polygonSet_1.subtractPolygonSet(positives, negatives).polygonSet;
        }
        return positives;
    }
    static getValue(modifiers, idx) {
        let r = modifiers[idx];
        if (r === undefined) {
            return 0;
        }
        return r;
    }
}
exports.ApertureMacro = ApertureMacro;
class Attribute {
    constructor(type, name, fields) {
        this.type = type;
        this.name = name;
        this.fields = fields;
    }
}
exports.Attribute = Attribute;
class BlockParams {
    constructor(xRepeat, yRepeat, xDelta, yDelta) {
        this.xRepeat = xRepeat;
        this.yRepeat = yRepeat;
        this.xDelta = xDelta;
        this.yDelta = yDelta;
    }
}
exports.BlockParams = BlockParams;
class Block {
    constructor(xRepeat, yRepeat, xDelta, yDelta, primitives, objects) {
        this.xRepeat = xRepeat;
        this.yRepeat = yRepeat;
        this.xDelta = xDelta;
        this.yDelta = yDelta;
        this.primitives = primitives;
        this.objects = objects;
    }
}
exports.Block = Block;
class GerberState {
    constructor() {
        this.coordinateFormat_ = undefined;
        this.coordinateUnits_ = undefined;
        this.currentPoint_ = new point_1.Point();
        //private currentCenterOffset_:Point = new Point();
        this.currentApertureId_ = undefined;
        this.interpolationMode = InterpolationMode.LINEARx1;
        this.coordinateMode = CoordinateMode.ABSOLUTE;
        this.quadrantMode_ = undefined;
        this.objectPolarity = ObjectPolarity.DARK;
        this.objectMirroring = ObjectMirroring.NONE;
        this.objectRotation = 0;
        this.objectScaling = 1.0;
        this.apertures = {};
        this.apertureMacros = {};
        this.graphicsOperationsConsumer_ = new BaseGraphicsOperationsConsumer();
        this.savedGraphicsOperationsConsumer_ = [];
        this.blockApertures_ = [];
        this.blockParams_ = [];
        this.isDone_ = false;
        this.isOutlineMode = false;
    }
    get coordinateFormatSpec() {
        if (this.coordinateFormat_ == undefined) {
            this.error("File coordinate format is not set.");
        }
        return this.coordinateFormat_;
    }
    set coordinateFormatSpec(value) {
        if (this.coordinateFormat_ != undefined) {
            this.warning("File coordinate format already set.");
        }
        this.coordinateFormat_ = value;
        this.coordinateMode =
            value.coordType == CoordinateType.ABSOLUTE ? CoordinateMode.ABSOLUTE : CoordinateMode.RELATIVE;
    }
    get coordinateUnits() {
        if (this.coordinateUnits_ == undefined) {
            this.error("Coordinate units are not set.");
        }
        return this.coordinateUnits_;
    }
    set coordinateUnits(value) {
        this.coordinateUnits_ = value;
    }
    unitToMM(v) {
        if (this.coordinateUnits_ == CoordinateUnits.MILLIMETERS) {
            return v;
        }
        return v * 25.4;
    }
    pointToMM(v) {
        if (this.coordinateUnits_ == CoordinateUnits.MILLIMETERS) {
            return v;
        }
        return new point_1.Point(v.x * 25.4, v.y * 25.4);
    }
    mmToUnit(v) {
        if (this.coordinateUnits_ == CoordinateUnits.MILLIMETERS) {
            return v;
        }
        return v / 25.4;
    }
    get currentPointX() {
        if (this.currentPoint_.x == undefined) {
            this.error("Current point X is not set.");
        }
        return this.currentPoint_.x;
    }
    set currentPointX(value) {
        this.currentPoint_.x = value;
    }
    get currentPointY() {
        if (this.currentPoint_.y == undefined) {
            this.error("Current point Y is not set.");
        }
        return this.currentPoint_.y;
    }
    set currentPointY(value) {
        this.currentPoint_.y = value;
    }
    /*
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
    */
    get currentApertureId() {
        if (this.currentApertureId_ == undefined) {
            this.error("Current aperture is not set.");
        }
        return this.currentApertureId_;
    }
    set currentApertureId(value) {
        this.currentApertureId_ = value;
    }
    get quadrantMode() {
        if (this.quadrantMode_ == undefined) {
            this.error("Current quadrant mode is not set.");
        }
        return this.quadrantMode_;
    }
    set quadrantMode(value) {
        this.quadrantMode_ = value;
    }
    get isDone() {
        return this.isDone_;
    }
    get primitives() {
        if (!this.isDone_) {
            this.warning("Parsing is not complete");
        }
        return this.primitives_;
    }
    getObjectState() {
        return new ObjectState(this.objectPolarity, this.objectMirroring, this.objectScaling, this.objectRotation, this.coordinateUnits);
    }
    getAperture(id) {
        if (id < 10) {
            this.error(`Invalid aperture ID ${id}`);
        }
        if (this.apertures[id] == undefined) {
            this.error(`Aperture ID ${id} is not defined yet`);
        }
        return this.apertures[id];
    }
    getCurrentAperture() {
        let id = this.currentApertureId;
        if (this.apertures[id] == undefined) {
            this.error(`Aperture ID ${id} is not defined yet`);
        }
        return this.apertures[id];
    }
    setAperture(ap) {
        if (this.apertures[ap.apertureId] != undefined) {
            this.warning(`Overriding aperture ${ap.apertureId}`);
        }
        this.apertures[ap.apertureId] = ap;
    }
    getApertureMacro(name) {
        if (this.apertureMacros[name] == undefined) {
            this.error(`Aperture macro name ${name} is not defined yet`);
        }
        return this.apertureMacros[name];
    }
    setApertureMacro(apm) {
        if (this.apertureMacros[apm.macroName] != undefined) {
            this.warning(`Overriding aperture macro ${apm.macroName}`);
        }
        this.apertureMacros[apm.macroName] = apm;
    }
    error(message) {
        throw new GerberParseException(message);
    }
    warning(message) {
        console.log(`Warning: ${message}`);
    }
    line(from, to, cmd) {
        if (!from.isValid() || !to.isValid()) {
            this.error(`Invalid line ${from} ${to}`);
        }
        this.graphicsOperationsConsumer_.line(this.pointToMM(from), this.pointToMM(to), cmd, this);
    }
    circle(center, radius, cmd) {
        if (!center.isValid() || radius <= exports.Epsilon) {
            this.error(`Invalid circle ${center} R${radius}`);
        }
        this.graphicsOperationsConsumer_.circle(this.pointToMM(center), this.unitToMM(radius), cmd, this);
    }
    arc(center, radius, start, end, isCCW, cmd) {
        if (!center.isValid() || radius <= exports.Epsilon || !start.isValid() || !end.isValid()) {
            this.error(`Invalid arc ${center} R${radius} from ${start} to ${end}`);
        }
        this.graphicsOperationsConsumer_.arc(this.pointToMM(center), this.unitToMM(radius), this.pointToMM(start), this.pointToMM(end), isCCW, cmd, this);
    }
    flash(center, cmd) {
        if (!center.isValid()) {
            this.error(`Invalid flash location ${center}`);
        }
        this.graphicsOperationsConsumer_.flash(this.pointToMM(center), cmd, this);
    }
    closeRegionContour() {
        if (this.graphicsOperationsConsumer_ instanceof RegionGraphicsOperationsConsumer) {
            let regionConsumer = this.graphicsOperationsConsumer_;
            regionConsumer.closeRegionContour(this);
        }
    }
    startRegion() {
        this.saveGraphicsConsumer();
        this.graphicsOperationsConsumer_ = new RegionGraphicsOperationsConsumer();
    }
    endRegion(cmd) {
        let region = this.graphicsOperationsConsumer_;
        region.closeRegionContour(this);
        this.restoreGraphicsConsumer();
        this.graphicsOperationsConsumer_.region(region.regionContours, cmd, this);
    }
    saveGraphicsConsumer() {
        this.savedGraphicsOperationsConsumer_.push(this.graphicsOperationsConsumer_);
    }
    restoreGraphicsConsumer() {
        if (this.savedGraphicsOperationsConsumer_.length == 0) {
            throw new GerberParseException("Invalid parsing state, can't restore operations consumer");
        }
        this.graphicsOperationsConsumer_ = this.savedGraphicsOperationsConsumer_.pop();
    }
    get graphicsOperations() {
        return this.graphicsOperationsConsumer_;
    }
    startBlockAperture(blockId) {
        this.saveGraphicsConsumer();
        this.blockApertures_.push(blockId);
        this.graphicsOperationsConsumer_ = new BlockGraphicsOperationsConsumer();
    }
    endBlockAperture() {
        if (this.blockApertures_.length == 0) {
            throw new GerberParseException('Closing aperture block without matching opening.');
        }
        let blockId = this.blockApertures_.pop();
        let blockConsumer = this.graphicsOperationsConsumer_;
        let aperture = new BlockAperture(blockId, blockConsumer.objects);
        this.setAperture(aperture);
        this.restoreGraphicsConsumer();
    }
    startRepeat(params) {
        this.saveGraphicsConsumer();
        this.blockParams_.push(params);
        this.graphicsOperationsConsumer_ = new BlockGraphicsOperationsConsumer();
    }
    tryEndRepeat(cmd) {
        if (this.blockParams_.length > 0) {
            this.endRepeat(cmd);
        }
    }
    endRepeat(cmd) {
        if (this.blockParams_.length == 0) {
            throw new GerberParseException('Closing repeat block without matching opening.');
        }
        let params = this.blockParams_.pop();
        let blockConsumer = this.graphicsOperationsConsumer_;
        let block = new Block(params.xRepeat, params.yRepeat, this.unitToMM(params.xDelta), this.unitToMM(params.yDelta), blockConsumer.primitives, blockConsumer.objects);
        this.restoreGraphicsConsumer();
        this.graphicsOperationsConsumer_.block(block, cmd, this);
    }
    endFile(cmd) {
        while (this.blockParams_.length > 0) {
            this.endRepeat(cmd);
        }
        let topConsumer = this.graphicsOperationsConsumer_;
        this.primitives_ = topConsumer.primitives;
        this.isDone_ = true;
    }
}
exports.GerberState = GerberState;
class Bounds {
    constructor(min, max) {
        this.min = min;
        this.max = max;
    }
    merge(other) {
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
        }
        else if (other instanceof point_1.Point) {
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
        else {
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
    mergexy(x, y) {
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
    get width() {
        return this.max.x - this.min.x;
    }
    get height() {
        return this.max.y - this.min.y;
    }
    toSimpleBounds() {
        return {
            minx: this.min.x,
            miny: this.min.y,
            maxx: this.max.x,
            maxy: this.max.y
        };
    }
}
exports.Bounds = Bounds;
class LineSegment {
    constructor(from, to, cmd) {
        this.from = from;
        this.to = to;
        this.cmd = cmd;
    }
    toString() {
        return `l(${this.from}, ${this.to})`;
    }
    get bounds() {
        return new Bounds(new point_1.Point(Math.min(this.from.x, this.to.x), Math.min(this.from.y, this.to.y)), new point_1.Point(Math.max(this.from.x, this.to.x), Math.max(this.from.y, this.to.y)));
    }
    translate(vector) {
        return new LineSegment(this.from.add(vector), this.to.add(vector), this.cmd);
    }
}
exports.LineSegment = LineSegment;
class CircleSegment {
    constructor(center, radius, cmd) {
        this.center = center;
        this.radius = radius;
        this.cmd = cmd;
    }
    toString() {
        return `c(${this.center}R${utils_1.formatFloat(this.radius, 3)})`;
    }
    get bounds() {
        return new Bounds(new point_1.Point(this.center.x - this.radius, this.center.x - this.radius), new point_1.Point(this.center.x + this.radius, this.center.x + this.radius));
    }
    translate(vector) {
        return new CircleSegment(this.center.add(vector), this.radius, this.cmd);
    }
}
exports.CircleSegment = CircleSegment;
class ArcSegment {
    constructor(center, radius, start, end, isCCW, cmd) {
        this.center = center;
        this.radius = radius;
        this.start = start;
        this.end = end;
        this.isCCW = isCCW;
        this.cmd = cmd;
    }
    toString() {
        return `a(${this.start}, ${this.end}@${this.center}R${utils_1.formatFloat(this.radius, 3)})`;
    }
    get bounds() {
        return new Bounds(new point_1.Point(Math.min(this.start.x, this.end.x), Math.min(this.start.y, this.end.y)), new point_1.Point(Math.max(this.start.x, this.end.x), Math.max(this.start.y, this.end.y)));
    }
    translate(vector) {
        return new ArcSegment(this.center.add(vector), this.radius, this.start.add(vector), this.end.add(vector), this.isCCW, this.cmd);
    }
}
exports.ArcSegment = ArcSegment;
function translateRegionContour(contour, vector) {
    return contour.map(segment => segment.translate(vector));
}
function contourOrientation(contour) {
    let sum = 0;
    contour.forEach(s => {
        let start;
        let end;
        if (s instanceof CircleSegment) {
            // Not sure what to do with circle segments. Start and end point are the same,
            // so it should compute as 0
            return;
        }
        else if (s instanceof ArcSegment) {
            // Threat arcs like line from start to end point.
            let arc = s;
            start = s.start;
            end = s.end;
        }
        else {
            let line = s;
            start = s.from;
            end = s.to;
        }
        sum += (end.x - start.x) * (end.y + start.y);
    });
    return sum;
}
class RegionGraphicsOperationsConsumer {
    constructor() {
        this.contour_ = [];
        this.regionContours_ = [];
    }
    get regionContours() {
        return this.regionContours_;
    }
    line(from, to, cmd) {
        this.contour_.push(new LineSegment(from, to, cmd));
    }
    circle(center, radius, cmd) {
        this.contour_.push(new CircleSegment(center, radius, cmd));
    }
    arc(center, radius, start, end, isCCW, cmd, ctx) {
        this.contour_.push(new ArcSegment(center, radius, start, end, isCCW, cmd));
    }
    flash(center, cmd, ctx) {
        ctx.error("Flashes are not allowed inside a region definition.");
    }
    closeRegionContour(ctx) {
        if (this.contour_.length > 0) {
            this.regionContours_.push(this.contour_);
            this.contour_ = [];
        }
    }
    region(contours, cmd, ctx) {
        ctx.error("Regions are not allowed inside a region definition.");
    }
    block(block, cmd, ctx) {
        ctx.error("Blocks are not allowed inside a region definition.");
    }
}
class ObjectState {
    constructor(polarity = ObjectPolarity.DARK, mirroring = ObjectMirroring.NONE, scale = 1, rotation = 0, units = CoordinateUnits.MILLIMETERS) {
        this.polarity = polarity;
        this.mirroring = mirroring;
        this.scale = scale;
        this.rotation = rotation;
        this.units = units;
    }
    unitToMM(v) {
        if (this.units == CoordinateUnits.MILLIMETERS) {
            return v;
        }
        return v * 25.4;
    }
    pointToMM(v) {
        if (this.units == CoordinateUnits.MILLIMETERS) {
            return v;
        }
        return new point_1.Point(v.x * 25.4, v.y * 25.4);
    }
    mmToUnit(v) {
        if (this.units == CoordinateUnits.MILLIMETERS) {
            return v;
        }
        return v / 25.4;
    }
    mmToPoint(v) {
        if (this.units == CoordinateUnits.MILLIMETERS) {
            return v;
        }
        return new point_1.Point(v.x / 25.4, v.y / 25.4);
    }
}
exports.ObjectState = ObjectState;
class Line {
    constructor(from, to, aperture, state, cmd) {
        this.from = from;
        this.to = to;
        this.aperture = aperture;
        this.state = state;
        this.cmd = cmd;
    }
    toString() {
        return `L(${this.from}, ${this.to})`;
    }
    get objects() {
        if (!this.objects_) {
            let draw = this.aperture.generateLineDraw(this.from, this.to, this.state);
            let polarity = (draw.is_solid) ? this.state.polarity : ObjectPolarity.THIN;
            this.objects_ = [
                {
                    polySet: [draw.polygon],
                    polarity: polarity
                }
            ];
        }
        return this.objects_;
    }
    get bounds() {
        return polygonSet_1.objectsBounds(this.objects);
    }
    get primitives() {
        return this;
    }
    translate(vector) {
        return new Line(this.from.add(vector), this.to.add(vector), this.aperture, this.state, this.cmd);
    }
}
exports.Line = Line;
class Circle {
    constructor(center, radius, aperture, state, cmd) {
        this.center = center;
        this.radius = radius;
        this.aperture = aperture;
        this.state = state;
        this.cmd = cmd;
    }
    toString() {
        return `C(${this.center}R${utils_1.formatFloat(this.radius, 3)})`;
    }
    get objects() {
        if (!this.objects_) {
            let draw = this.aperture.generateCircleDraw(this.center, this.radius, this.state);
            let polarity = (draw.is_solid) ? this.state.polarity : ObjectPolarity.THIN;
            this.objects_ = [
                {
                    polySet: draw.polygonSet,
                    polarity: polarity
                }
            ];
        }
        return this.objects_;
    }
    get bounds() {
        return polygonSet_1.objectsBounds(this.objects);
    }
    get primitives() {
        return this;
    }
    translate(vector) {
        return new Circle(this.center.add(vector), this.radius, this.aperture, this.state, this.cmd);
    }
}
exports.Circle = Circle;
class Arc {
    constructor(center, radius, start, end, isCCW, aperture, state, cmd) {
        this.center = center;
        this.radius = radius;
        this.start = start;
        this.end = end;
        this.isCCW = isCCW;
        this.aperture = aperture;
        this.state = state;
        this.cmd = cmd;
    }
    toString() {
        return `A(${this.start}, ${this.end}@${this.center}R${utils_1.formatFloat(this.radius, 3)})`;
    }
    get objects() {
        if (!this.objects_) {
            let draw = this.aperture.generateArcDraw((this.isCCW) ? this.start : this.end, (this.isCCW) ? this.end : this.start, this.center, this.state);
            let polarity = (draw.is_solid) ? this.state.polarity : ObjectPolarity.THIN;
            this.objects_ = [
                {
                    polySet: [draw.polygon],
                    polarity: polarity
                }
            ];
        }
        return this.objects_;
    }
    get bounds() {
        return polygonSet_1.objectsBounds(this.objects);
    }
    get primitives() {
        return this;
    }
    translate(vector) {
        return new Arc(this.center.add(vector), this.radius, this.start.add(vector), this.end.add(vector), this.isCCW, this.aperture, this.state, this.cmd);
    }
}
exports.Arc = Arc;
class Flash {
    constructor(center, aperture, state, cmd) {
        this.center = center;
        this.aperture = aperture;
        this.state = state;
        this.cmd = cmd;
    }
    toString() {
        return `F(${this.aperture.apertureId}@${this.center})`;
    }
    get objects() {
        if (!this.objects_) {
            this.objects_ = polygonSet_1.copyObjects(this.aperture.objects(this.state.polarity, this.state));
            this.objects_.forEach(o => {
                polygonSet_1.mirrorPolySet(o.polySet, this.state.mirroring);
                polygonSet_1.rotatePolySet(o.polySet, this.state.rotation);
                polygonSet_1.scalePolySet(o.polySet, this.state.scale);
                polygonSet_1.translatePolySet(o.polySet, this.center);
            });
        }
        return this.objects_;
    }
    get bounds() {
        return polygonSet_1.objectsBounds(this.objects);
    }
    get primitives() {
        return this;
    }
    translate(vector) {
        return new Flash(this.center.add(vector), this.aperture, this.state, this.cmd);
    }
}
exports.Flash = Flash;
class Region {
    constructor(contours, state, cmd) {
        this.state = state;
        this.cmd = cmd;
        //this.contours = contours.map(c => Region.reOrderContour(c));
        this.contours = contours;
    }
    toString() {
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
    static startPoint(segment) {
        if (segment instanceof CircleSegment) {
            throw new GerberParseException("Circle segment inside region.");
        }
        else if (segment instanceof LineSegment) {
            return segment.from;
        }
        else if (segment instanceof ArcSegment) {
            return segment.start;
        }
        throw new GerberParseException(`Unsupported segment ${segment} inside region.`);
    }
    static endPoint(segment) {
        if (segment instanceof CircleSegment) {
            throw new GerberParseException("Circle segment inside region.");
        }
        else if (segment instanceof LineSegment) {
            return segment.to;
        }
        else if (segment instanceof ArcSegment) {
            return segment.end;
        }
        throw new GerberParseException(`Unsupported segment ${segment} inside region.`);
    }
    static matchPoint(p, segment, matchStart) {
        let pt = (matchStart) ? Region.startPoint(segment) : Region.endPoint(segment);
        return pt.distance2(p) < exports.Epsilon;
    }
    static reOrderContour(contour) {
        if (contour.length < 2)
            return contour;
        let result = [];
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
                    throw new GerberParseException(`Region is disconnected ${contour} - can't locate continuation for ${segment}`);
                }
            }
            segment = contour[nextSegmentIdx];
            console.log(`Matched with ${segment}`);
            result.push(segment);
            contour.splice(nextSegmentIdx, 1);
        }
        return result;
    }
    static buildPolygonSet(contours) {
        return contours.map(c => Region.buildPolygon(c));
    }
    static buildPolygon(contour) {
        let numPoints = 0;
        let lastPt = undefined;
        let firstPt = undefined;
        contour.forEach(segment => {
            if (segment instanceof LineSegment) {
                let line = segment;
                numPoints += 2;
                lastPt = line.to;
                if (!firstPt) {
                    firstPt = line.from;
                }
            }
            else if (segment instanceof ArcSegment) {
                let arc = segment;
                numPoints += polygonTools_1.NUMSTEPS;
                lastPt = arc.end;
                if (!firstPt) {
                    firstPt = arc.start;
                }
            }
            else if (segment instanceof CircleSegment) {
                numPoints += polygonTools_1.NUMSTEPS * 2;
            }
        });
        let needsClose = firstPt && lastPt
            && polygonSet_1.distance2(firstPt.x, firstPt.y, lastPt.x, lastPt.y) > exports.Epsilon;
        let result = new Float64Array(numPoints * 2 + ((needsClose) ? 2 : 0));
        let arrayOffset = 0;
        contour.forEach(segment => {
            if (segment instanceof LineSegment) {
                let line = segment;
                result[arrayOffset++] = line.from.x;
                result[arrayOffset++] = line.from.y;
                result[arrayOffset++] = line.to.x;
                result[arrayOffset++] = line.to.y;
            }
            else if (segment instanceof ArcSegment) {
                let arc = segment;
                let polygon = polygonTools_1.arcToPolygon(arc.isCCW ? arc.start : arc.end, arc.isCCW ? arc.end : arc.start, arc.center);
                if (!arc.isCCW) {
                    polygonTools_1.reversePolygon(polygon);
                }
                result.set(polygon, arrayOffset);
                arrayOffset += polygonTools_1.NUMSTEPS * 2;
            }
            else if (segment instanceof CircleSegment) {
                let circle = segment;
                let polygon = polygonTools_1.circleToPolygon(circle.radius);
                polygonSet_1.translatePolygon(polygon, circle.center);
                result.set(polygon, arrayOffset);
                arrayOffset += polygonTools_1.NUMSTEPS * 2;
            }
            else {
                throw new GerberParseException(`Unsupported segment type ${segment}`);
            }
        });
        // Close the polygon if we have to
        if (needsClose) {
            result[arrayOffset++] = result[0];
            result[arrayOffset++] = result[1];
        }
        // If the contour is clockwise, reverse the polygon.
        if (contourOrientation(contour) > 0) {
            polygonTools_1.reversePolygon(result);
        }
        return result;
    }
    get objects() {
        if (!this.objects_) {
            this.objects_ = [
                {
                    polySet: Region.buildPolygonSet(this.contours),
                    polarity: this.state.polarity
                }
            ];
        }
        return this.objects_;
    }
    get bounds() {
        return polygonSet_1.objectsBounds(this.objects);
    }
    get primitives() {
        return this;
    }
    translate(vector) {
        return new Region(this.contours.map(contour => translateRegionContour(contour, vector)), this.state, this.cmd);
    }
}
exports.Region = Region;
class Repeat {
    constructor(block, xOffset, yOffset, cmd) {
        this.block = block;
        this.xOffset = xOffset;
        this.yOffset = yOffset;
        this.cmd = cmd;
    }
    toString() {
        return `B(${this.block.xRepeat}, ${this.block.yRepeat}:${this.block.xDelta}, ${this.block.yDelta})`;
    }
    get objects() {
        if (!this.objects_) {
            this.buildObjects();
        }
        return this.objects_;
    }
    get bounds() {
        return polygonSet_1.objectsBounds(this.objects);
    }
    buildObjects() {
        let xOffset = this.xOffset;
        this.objects_ = [];
        for (let xCnt = 0; xCnt < this.block.xRepeat; xCnt++) {
            let yOffset = this.yOffset;
            for (let yCnt = 0; yCnt < this.block.yRepeat; yCnt++) {
                let translateVector = new point_1.Point(xOffset, yOffset);
                let blockObjects = polygonSet_1.copyObjects(this.block.objects);
                polygonSet_1.translateObjects(blockObjects, translateVector);
                this.objects_.push(...blockObjects);
                yOffset += this.block.yDelta;
            }
            xOffset += this.block.xDelta;
        }
    }
    buildPrimitives() {
        let xOffset = this.xOffset;
        this.primitives_ = [];
        for (let xCnt = 0; xCnt < this.block.xRepeat; xCnt++) {
            let yOffset = this.yOffset;
            for (let yCnt = 0; yCnt < this.block.yRepeat; yCnt++) {
                let translateVector = new point_1.Point(xOffset, yOffset);
                this.primitives_.push(...translatePrimitives(this.block.primitives, translateVector));
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
    translate(vector) {
        return new Repeat(this.block, this.xOffset + vector.x, this.yOffset + vector.y, this.cmd);
    }
}
exports.Repeat = Repeat;
function translatePrimitives(primitives, vector) {
    return primitives.map(primitive => primitive.translate(vector));
}
function EmptyBounds() {
    return new Bounds(new point_1.Point(0, 0), new point_1.Point(0, 0));
}
exports.EmptyBounds = EmptyBounds;
class BaseGraphicsOperationsConsumer {
    constructor() {
        this.primitives_ = [];
    }
    get primitives() {
        return this.primitives_;
    }
    line(from, to, cmd, ctx) {
        this.primitives_.push(new Line(from, to, ctx.getCurrentAperture(), ctx.getObjectState(), cmd));
    }
    circle(center, radius, cmd, ctx) {
        this.primitives_.push(new Circle(center, radius, ctx.getCurrentAperture(), ctx.getObjectState(), cmd));
    }
    arc(center, radius, start, end, isCCW, cmd, ctx) {
        this.primitives_.push(new Arc(center, radius, start, end, isCCW, ctx.getCurrentAperture(), ctx.getObjectState(), cmd));
    }
    flash(center, cmd, ctx) {
        this.primitives_.push(new Flash(center, ctx.getCurrentAperture(), ctx.getObjectState(), cmd));
    }
    region(contours, cmd, ctx) {
        this.primitives_.push(new Region(contours, ctx.getObjectState(), cmd));
    }
    block(block, cmd, ctx) {
        this.primitives_.push(new Repeat(block, 0, 0, cmd));
    }
}
exports.BaseGraphicsOperationsConsumer = BaseGraphicsOperationsConsumer;
class BlockGraphicsOperationsConsumer {
    constructor() {
        this.objects_ = [];
        this.primitives_ = [];
    }
    get primitives() {
        return this.primitives_;
    }
    get objects() {
        return this.objects_;
    }
    line(from, to, cmd, ctx) {
        let l = new Line(from, to, ctx.getCurrentAperture(), ctx.getObjectState(), cmd);
        this.primitives_.push(l);
        this.objects_.push(...l.objects);
    }
    circle(center, radius, cmd, ctx) {
        let c = new Circle(center, radius, ctx.getCurrentAperture(), ctx.getObjectState(), cmd);
        this.primitives_.push(c);
        this.objects_.push(...c.objects);
    }
    arc(center, radius, start, end, isCCW, cmd, ctx) {
        let a = new Arc(center, radius, start, end, isCCW, ctx.getCurrentAperture(), ctx.getObjectState(), cmd);
        this.primitives_.push(a);
        this.objects_.push(...a.objects);
    }
    flash(center, cmd, ctx) {
        let f = new Flash(center, ctx.getCurrentAperture(), ctx.getObjectState(), cmd);
        this.primitives_.push(f);
        this.objects_.push(...f.objects);
    }
    region(contours, cmd, ctx) {
        let r = new Region(contours, ctx.getObjectState(), cmd);
        this.primitives_.push(r);
        this.objects_.push(...r.objects);
    }
    block(block, cmd, ctx) {
        let r = new Repeat(block, 0, 0, cmd);
        this.primitives_.push(r);
        this.objects_.push(...r.objects);
    }
}
exports.BlockGraphicsOperationsConsumer = BlockGraphicsOperationsConsumer;
function composeSolidImage(objects, union = false) {
    if (objects.length == 0) {
        return {
            polygonSet: [],
            bounds: undefined
        };
    }
    let image = [];
    let clear = [];
    objects
        .filter(o => o.polarity != ObjectPolarity.THIN)
        .forEach(o => {
        if (o.polarity === ObjectPolarity.DARK) {
            // Check if there is anything to clean?
            if (clear.length > 0) {
                // Check if we are creating from something
                if (image.length > 0) {
                    image = polygonSet_1.subtractPolygonSet(image, clear).polygonSet;
                }
                clear = [];
            }
            image.push(...o.polySet);
        }
        else {
            clear.push(...o.polySet);
        }
    });
    // Check if there is anything left to clean?
    if (clear.length > 0) {
        // Check if we are creating from something
        if (image.length > 0) {
            if (!union) {
                return polygonSet_1.subtractPolygonSet(image, clear);
            }
            image = polygonSet_1.subtractPolygonSet(image, clear).polygonSet;
        }
    }
    if (union) {
        return polygonSet_1.unionPolygonSet(image, []);
    }
    return {
        polygonSet: image,
        bounds: polygonSet_1.polySetBounds(image).toSimpleBounds()
    };
}
exports.composeSolidImage = composeSolidImage;
exports.Epsilon = 1E-12;
//# sourceMappingURL=primitives.js.map