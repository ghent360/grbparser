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

export type Polygon = Array<Point>;
export type PolygonSet = Array<Polygon>;

export function rotatePolygon(poly:Polygon, angle:number):Polygon {
    if (Math.abs(angle) < Epsilon) {
        return poly;
    }
    let angleRadians = angle * (Math.PI * 2.0) / 360;
    let cosA = Math.cos(angleRadians);
    let sinA = Math.sin(angleRadians);

    return poly.map(point => new Point(
        point.x * cosA - point.y * sinA,
        point.x * sinA + point.y * cosA));
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
    return poly.map(point => point.add(offset));
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
    return poly.map(point => point.scale(scale));
}

export function scalePolySet(polySet:PolygonSet, scale:number):PolygonSet {
    if (Math.abs(scale - 1) < Epsilon) {
        return polySet;
    }
    return polySet.map(polygon => scalePolygon(polygon, scale));
}


export function mirrorPolygon(poly:Polygon, mirror:ObjectMirroring):Polygon {
    if (mirror == ObjectMirroring.NONE) {
        return poly;
    }
    return poly.map(point => point.mirror(mirror));
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
    clipper.addPaths(one, cl.PathType.Subject, false);
    clipper.addPaths(other, cl.PathType.Clip, false);
    let result = clipper.execute(cl.ClipType.Union, cl.FillRule.NonZero, Point);
    clipper.clear();
    clipper.delete();
    if (result.success) {
        return simplifyPolygonSet(result.solution_closed);
    }
    return [];
}

export function subtractPolygonSet(one:PolygonSet, other:PolygonSet):PolygonSet {
    let clipper = new cl.Clipper<Point>(100000000);
    clipper.addPaths(one, cl.PathType.Subject, false);
    clipper.addPaths(other, cl.PathType.Clip, false);
    let result = clipper.execute(cl.ClipType.Difference, cl.FillRule.NonZero, Point);
    clipper.clear();
    clipper.delete();
    if (result.success) {
        return simplifyPolygonSet(result.solution_closed);
    }
    return [];
}

function slopesAreEqual(pt1:Point, pt2:Point, pt3:Point):boolean {
    let dx12 = pt1.x - pt2.x;
    let dy12 = pt1.y - pt2.y;
    let dx23 = pt2.x - pt3.x;
    let dy23 = pt2.y - pt3.y;
    return Math.abs(dy12 * dx23 - dx12 * dy23) < Epsilon;
}

function removeDuplicatePoints(polygon:Polygon):Polygon {
    if (polygon.length < 2) {
        return polygon;
    }
    let last = polygon[0];
    let result = [last];
    let Epsilon2 = Epsilon * Epsilon;
    for (let idx = 1; idx < polygon.length; idx++) {
        if (polygon[idx].distance2(last) < Epsilon2) {
            continue;
        }
        last = polygon[idx];
        result.push(last);
    }
    return result;
}

function removeMidPoints(polygon:Polygon):Polygon {
    if (polygon.length < 3) {
        return polygon;
    }
    let result:Polygon = [];
    if (!slopesAreEqual(polygon[polygon.length - 1], polygon[0], polygon[1])) {
        result.push(polygon[0]);
    }
    for (let idx = 1; idx < polygon.length - 1; idx++) {
        if (!slopesAreEqual(polygon[idx - 1], polygon[idx], polygon[idx+1])) {
            result.push(polygon[idx]);
        }
    }
    if (!slopesAreEqual(polygon[polygon.length - 2], polygon[polygon.length - 1], polygon[0])) {
        result.push(polygon[polygon.length - 1]);
    }
    return result;
}

export function simplifyPolygon(polygon:Polygon):Polygon {
    return removeMidPoints(removeDuplicatePoints(polygon));
}

export function simplifyPolygonSet(polygonSet:PolygonSet):PolygonSet {
    return polygonSet.map(p => simplifyPolygon(p));
}

export function connectWires(polygonSet:PolygonSet):PolygonSet {
    if (polygonSet.length < 1) {
        return polygonSet;
    }
    let last = polygonSet[0];
    let lastPt = last[last.length - 1];
    let result:PolygonSet = [last];
    let Epsilon2 = Epsilon * Epsilon;
    for (let idx = 1; idx < polygonSet.length; idx++) {
        if (polygonSet[idx].length > 0) {
            let polygon = polygonSet[idx];
            if (lastPt.distance2(polygon[0]) < Epsilon2) {
                result.pop();
                last = last.concat(polygon.slice(1));
                result.push(last);
                lastPt = last[last.length - 1];
            } else {
                last = polygon;
                result.push(last);
                lastPt = last[last.length - 1];
            }
        }
    }
    return result;
}