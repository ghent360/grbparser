"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 *
 * License: MIT License, see LICENSE.txt
 */
const point_1 = require("./point");
const primitives_1 = require("./primitives");
const clipperModule = Promise.resolve().then(() => require("clipperjs/clipper_js"));
let cl;
function waitClipperLoad() {
    return __awaiter(this, void 0, void 0, function* () {
        cl = yield clipperModule;
    });
}
exports.waitClipperLoad = waitClipperLoad;
function copyPolygon(poly) {
    let result = new Float64Array(poly.length);
    result.set(poly);
    return result;
}
exports.copyPolygon = copyPolygon;
function copyPolygonSet(polySet) {
    return polySet.map(p => copyPolygon(p));
}
exports.copyPolygonSet = copyPolygonSet;
function copyObjects(objects) {
    return objects.map(object => {
        return {
            polySet: copyPolygonSet(object.polySet),
            polarity: object.polarity
        };
    });
}
exports.copyObjects = copyObjects;
function rotatePolygon(poly, angle) {
    if (Math.abs(angle) < primitives_1.Epsilon) {
        return;
    }
    let angleRadians = angle * (Math.PI * 2.0) / 360;
    let cosA = Math.cos(angleRadians);
    let sinA = Math.sin(angleRadians);
    let len = poly.length;
    for (let idx = 0; idx < len; idx += 2) {
        let x = poly[idx];
        let y = poly[idx + 1];
        poly[idx] = x * cosA - y * sinA;
        poly[idx + 1] = x * sinA + y * cosA;
    }
}
exports.rotatePolygon = rotatePolygon;
function rotatePolySet(polySet, angle) {
    if (Math.abs(angle) < primitives_1.Epsilon) {
        return;
    }
    polySet.forEach(polygon => rotatePolygon(polygon, angle));
}
exports.rotatePolySet = rotatePolySet;
function translatePolygon(poly, offset) {
    if (Math.abs(offset.x) < primitives_1.Epsilon
        && Math.abs(offset.y) < primitives_1.Epsilon) {
        return;
    }
    let len = poly.length;
    for (let idx = 0; idx < len; idx += 2) {
        poly[idx] += offset.x;
        poly[idx + 1] += offset.y;
    }
}
exports.translatePolygon = translatePolygon;
function translatePolySet(polySet, offset) {
    if (Math.abs(offset.x) < primitives_1.Epsilon
        && Math.abs(offset.y) < primitives_1.Epsilon) {
        return;
    }
    polySet.forEach(polygon => translatePolygon(polygon, offset));
}
exports.translatePolySet = translatePolySet;
function translateObjects(objects, offset) {
    if (Math.abs(offset.x) < primitives_1.Epsilon
        && Math.abs(offset.y) < primitives_1.Epsilon) {
        return;
    }
    objects.forEach(object => translatePolySet(object.polySet, offset));
}
exports.translateObjects = translateObjects;
function scalePolygon(poly, scale) {
    if (Math.abs(scale - 1) < primitives_1.Epsilon) {
        return;
    }
    let len = poly.length;
    for (let idx = 0; idx < len; idx++) {
        poly[idx] *= scale;
    }
}
exports.scalePolygon = scalePolygon;
function scalePolySet(polySet, scale) {
    if (Math.abs(scale - 1) < primitives_1.Epsilon) {
        return;
    }
    polySet.forEach(polygon => scalePolygon(polygon, scale));
}
exports.scalePolySet = scalePolySet;
function mirrorPolygon(poly, mirror) {
    if (mirror === primitives_1.ObjectMirroring.NONE) {
        return;
    }
    let len = poly.length;
    switch (mirror) {
        case primitives_1.ObjectMirroring.X_AXIS:
            for (let idx = 0; idx < len; idx += 2) {
                poly[idx] = -poly[idx];
                //poly[idx + 1] = poly[idx + 1];
            }
            break;
        case primitives_1.ObjectMirroring.Y_AXIS:
            for (let idx = 0; idx < len; idx += 2) {
                //poly[idx] = poly[idx];
                poly[idx + 1] = -poly[idx + 1];
            }
            break;
        case primitives_1.ObjectMirroring.XY_AXIS:
            for (let idx = 0; idx < len; idx += 2) {
                poly[idx] = -poly[idx];
                poly[idx + 1] = -poly[idx + 1];
            }
            break;
    }
}
exports.mirrorPolygon = mirrorPolygon;
function mirrorPolySet(polySet, mirror) {
    if (mirror == primitives_1.ObjectMirroring.NONE) {
        return;
    }
    polySet.forEach(polygon => mirrorPolygon(polygon, mirror));
}
exports.mirrorPolySet = mirrorPolySet;
function polygonBounds(poly) {
    if (poly.length == 0) {
        return primitives_1.EmptyBounds();
    }
    let start = new point_1.Point(poly[0], poly[1]);
    let bounds = new primitives_1.Bounds(start, start.clone());
    let len = poly.length;
    for (let idx = 0; idx < len; idx += 2) {
        bounds.mergexy(poly[idx], poly[idx + 1]);
    }
    return bounds;
}
exports.polygonBounds = polygonBounds;
function polySetBounds(polygonSet) {
    if (polygonSet.length == 0) {
        return primitives_1.EmptyBounds();
    }
    let bounds = polygonBounds(polygonSet[0]);
    for (let idx = 1; idx < polygonSet.length; idx++) {
        bounds.merge(polygonBounds(polygonSet[idx]));
    }
    return bounds;
}
exports.polySetBounds = polySetBounds;
function objectsBounds(objects) {
    if (objects.length == 0) {
        return primitives_1.EmptyBounds();
    }
    let bounds = polySetBounds(objects[0].polySet);
    for (let idx = 1; idx < objects.length; idx++) {
        bounds.merge(polySetBounds(objects[idx].polySet));
    }
    return bounds;
}
exports.objectsBounds = objectsBounds;
function unionPolygonSet(one, other) {
    let clipper = new cl.Clipper(100000000);
    clipper.addPathArrays(one, cl.PathType.Subject, false);
    if (other.length > 0) {
        clipper.addPathArrays(other, cl.PathType.Clip, false);
    }
    let result = clipper.executeClosedToArrays(cl.ClipType.Union, cl.FillRule.NonZero);
    clipper.delete();
    if (result.success) {
        return {
            polygonSet: result.solution_closed,
            bounds: result.bounds_closed
        };
    }
    return {
        polygonSet: result.solution_closed,
        bounds: undefined
    };
}
exports.unionPolygonSet = unionPolygonSet;
function subtractPolygonSet(one, other) {
    if (other.length == 0) {
        return {
            polygonSet: one,
            bounds: polySetBounds(one).toSimpleBounds()
        };
    }
    let clipper = new cl.Clipper(100000000);
    clipper.addPathArrays(one, cl.PathType.Subject, false);
    clipper.addPathArrays(other, cl.PathType.Clip, false);
    let result = clipper.executeClosedToArrays(cl.ClipType.Difference, cl.FillRule.NonZero);
    clipper.delete();
    if (result.success) {
        return {
            polygonSet: result.solution_closed,
            bounds: result.bounds_closed
        };
    }
    return {
        polygonSet: result.solution_closed,
        bounds: undefined
    };
}
exports.subtractPolygonSet = subtractPolygonSet;
function distance2(x1, y1, x2, y2) {
    let dx = x1 - x2;
    let dy = y1 - y2;
    return dx * dx + dy * dy;
}
exports.distance2 = distance2;
function connectWires(polygonSet) {
    if (polygonSet.length < 1) {
        return polygonSet;
    }
    let last = polygonSet[0];
    let lastPtx = last[last.length - 2];
    let lastPty = last[last.length - 1];
    let result = [last];
    let Epsilon2 = primitives_1.Epsilon * primitives_1.Epsilon;
    for (let idx = 1; idx < polygonSet.length; idx++) {
        if (polygonSet[idx].length > 0) {
            let polygon = polygonSet[idx];
            if (distance2(lastPtx, lastPty, polygon[0], polygon[1]) < Epsilon2) {
                result.pop();
                let concat = new Float64Array(last.length + polygon.length - 2);
                concat.set(last);
                concat.set(polygon.subarray(2), last.length);
                result.push(concat);
                last = concat;
                lastPtx = last[last.length - 2];
                lastPty = last[last.length - 1];
            }
            else {
                last = polygon;
                result.push(last);
                lastPtx = last[last.length - 2];
                lastPty = last[last.length - 1];
            }
        }
    }
    //if (result.length < polygonSet.length) {
    //    console.log(`Simplified wires from ${polygonSet.length} to ${result.length}`);
    //}
    return result;
}
exports.connectWires = connectWires;
//# sourceMappingURL=polygonSet.js.map