/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */
import {Point} from "./point";
import {ObjectMirroring, Bounds, EmptyBounds, Epsilon, GraphicsObjects} from "./primitives";
import {ClipperSubModule} from "clipperjs/clipper";

const clipperModule = import("clipperjs/clipper_js");
let cl:ClipperSubModule;

export async function waitClipperLoad() {
    cl = await clipperModule;
}

export type Polygon = Float64Array;
export type PolygonSet = Array<Polygon>;

export function rotatePolygon(poly:Polygon, angle:number):Polygon {
    if (Math.abs(angle) < Epsilon) {
        return poly;
    }
    let angleRadians = angle * (Math.PI * 2.0) / 360;
    let cosA = Math.cos(angleRadians);
    let sinA = Math.sin(angleRadians);
    let len = poly.length;
    let result = new Float64Array(len);
    for (let idx = len - 2; idx >= 0; idx -= 2) {
        let x = poly[idx];
        let y = poly[idx + 1];
        result[idx] = x * cosA - y * sinA;
        result[idx + 1] = x * sinA + y * cosA;
    }
    return result;
}

export function rotatePolySet(polySet:PolygonSet, angle:number):PolygonSet {
    if (Math.abs(angle) < Epsilon) {
        return polySet;
    }
    return polySet.map(polygon => rotatePolygon(polygon, angle));
}

export function translatePolygon(poly:Polygon, offset:Point):Polygon {
    if (Math.abs(offset.x) < Epsilon
        && Math.abs(offset.y) < Epsilon) {
        return poly;
    }
    let len = poly.length;
    let result = new Float64Array(len);
    for (let idx = len - 2; idx >= 0; idx -= 2) {
        result[idx] = poly[idx] + offset.x;
        result[idx + 1] = poly[idx + 1] + offset.y;
    }
    return result;
}

export function translatePolySet(polySet:PolygonSet, offset:Point):PolygonSet {
    if (Math.abs(offset.x) < Epsilon
        && Math.abs(offset.y) < Epsilon) {
        return polySet;
    }
    return polySet.map(polygon => translatePolygon(polygon, offset));
}

export function translateObjects(objects:GraphicsObjects, offset:Point):GraphicsObjects {
    if (Math.abs(offset.x) < Epsilon
        && Math.abs(offset.y) < Epsilon) {
        return objects;
    }
    return objects.map(object => {
        return {polySet:translatePolySet(object.polySet, offset), polarity:object.polarity};
    });
}

export function scalePolygon(poly:Polygon, scale:number):Polygon {
    if (Math.abs(scale - 1) < Epsilon) {
        return poly;
    }
    let len = poly.length;
    let result = new Float64Array(len);
    for (let idx = len - 1; idx >= 0; idx--) {
        result[idx] = poly[idx] * scale;
    }
    return result;
}

export function scalePolySet(polySet:PolygonSet, scale:number):PolygonSet {
    if (Math.abs(scale - 1) < Epsilon) {
        return polySet;
    }
    return polySet.map(polygon => scalePolygon(polygon, scale));
}

export function mirrorPolygon(poly:Polygon, mirror:ObjectMirroring):Polygon {
    if (mirror === ObjectMirroring.NONE) {
        return poly;
    }
    let len = poly.length;
    let result = new Float64Array(len);
    switch (mirror) {
        case ObjectMirroring.X_AXIS:
            for (let idx = len - 2; idx >= 0; idx -= 2) {
                result[idx] = -poly[idx];
                result[idx + 1] = poly[idx + 1];
            }
            break;
        case ObjectMirroring.Y_AXIS:
            for (let idx = len - 2; idx >= 0; idx -= 2) {
                result[idx] = poly[idx];
                result[idx + 1] = -poly[idx + 1];
            }
            break;
        case ObjectMirroring.XY_AXIS:
            for (let idx = len - 2; idx >= 0; idx -= 2) {
                result[idx] = -poly[idx];
                result[idx + 1] = -poly[idx + 1];
            }
            break;
    }
    return result;
}

export function mirrorPolySet(polySet:PolygonSet, mirror:ObjectMirroring):PolygonSet {
    if (mirror == ObjectMirroring.NONE) {
        return polySet;
    }
    return polySet.map(polygon => mirrorPolygon(polygon, mirror));
}

export function polygonBounds(poly:Polygon):Bounds {
    if (poly.length == 0) {
        return EmptyBounds();
    }
    let start = new Point(poly[0], poly[1]);
    let bounds = new Bounds(start, start.clone());
    let len = poly.length;
    for (let idx = len - 2; idx >= 0; idx -= 2) {
        bounds.mergexy(poly[idx], poly[idx + 1]);
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

export function objectsBounds(objects:GraphicsObjects):Bounds {
    if (objects.length == 0) {
        return EmptyBounds();
    }
    let bounds = polySetBounds(objects[0].polySet);
    for (let idx = 1; idx < objects.length; idx++) {
        bounds.merge(polySetBounds(objects[idx].polySet));
    }
    return bounds;
}

export function unionPolygonSet(one:PolygonSet, other:PolygonSet):PolygonSet {
    let clipper = new cl.Clipper<Point>(100000000);
    clipper.addPathArrays(one, cl.PathType.Subject, false);
    clipper.addPathArrays(other, cl.PathType.Clip, false);
    let result = clipper.executeClosedToArrays(cl.ClipType.Union, cl.FillRule.NonZero);
    clipper.delete();
    if (result.success) {
        return result.solution_closed;
    }
    return [];
}

export function subtractPolygonSet(one:PolygonSet, other:PolygonSet):PolygonSet {
    let clipper = new cl.Clipper<Point>(100000000);
    clipper.addPathArrays(one, cl.PathType.Subject, false);
    clipper.addPathArrays(other, cl.PathType.Clip, false);
    let result = clipper.executeClosedToArrays(cl.ClipType.Difference, cl.FillRule.NonZero);
    clipper.delete();
    if (result.success) {
        return result.solution_closed;
    }
    return [];
}

export function distance2(x1:number, y1:number, x2:number, y2:number):number {
    let dx = x1 - x2;
    let dy = y1 - y2;
    return dx * dx + dy * dy;
}

export function connectWires(polygonSet:PolygonSet):PolygonSet {
    if (polygonSet.length < 1) {
        return polygonSet;
    }
    let last = polygonSet[0];
    let lastPtx = last[last.length - 2];
    let lastPty = last[last.length - 1];
    let result:PolygonSet = [last];
    let Epsilon2 = Epsilon * Epsilon;
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
            } else {
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