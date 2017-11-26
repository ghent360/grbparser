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
import * as cl from "clipperjs";

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
    clipper.delete();
    if (result.success) {
        return result.solution_closed;
    }
    return [];
}

export function subtractPolygonSet(one:PolygonSet, other:PolygonSet):PolygonSet {
    let clipper = new cl.Clipper<Point>(100000000);
    clipper.addPaths(one, cl.PathType.Subject, false);
    clipper.addPaths(other, cl.PathType.Clip, false);
    let result = clipper.execute(cl.ClipType.Difference, cl.FillRule.NonZero, Point);
    clipper.delete();
    if (result.success) {
        return result.solution_closed;
    }
    return [];
}
