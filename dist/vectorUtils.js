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
function vectorLength(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
}
exports.vectorLength = vectorLength;
function scaleVector(v, s) {
    return { x: v.x * s, y: v.y * s };
}
exports.scaleVector = scaleVector;
function unitVector(v) {
    return scaleVector(v, 1 / vectorLength(v));
}
exports.unitVector = unitVector;
function addVector(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
}
exports.addVector = addVector;
function negVector(v) {
    return { x: -v.x, y: -v.y };
}
exports.negVector = negVector;
//# sourceMappingURL=vectorUtils.js.map