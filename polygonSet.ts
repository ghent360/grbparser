import {Point, Bounds, EmptyBounds} from "./primitives";

export type Polygon = Array<Point>;
export type PolygonSet = Array<Polygon>;

export function rotatePolygon(poly:Polygon, angle:number):Polygon {
    if (angle == 0) {
        return poly;
    }
    let angleRadians = angle * (Math.PI * 2.0) / 360;
    let cosA = Math.cos(angleRadians);
    let sinA = Math.sin(angleRadians);

    return poly.map(point => new Point(
        point.x * cosA - point.y * sinA,
        point.x * sinA + point.y * cosA));
}

export function translatePolygon(poly:Polygon, offset:Point):Polygon {
    if (offset.x == 0 && offset.y == 0) {
        return poly;
    }
    return poly.map(point => point.add(offset));
}

export function translatePolySet(polySet:PolygonSet, offset:Point):PolygonSet {
    if (offset.x == 0 && offset.y == 0) {
        return polySet;
    }
    return polySet.map(polygon => translatePolygon(polygon, offset));
}

export function scalePolygon(poly:Polygon, scale:number):Polygon {
    if (scale == 1) {
        return poly;
    }
    return poly.map(point => point.scale(scale));
}

export function scalePolySet(polySet:PolygonSet, scale:number):PolygonSet {
    if (scale == 1) {
        return polySet;
    }
    return polySet.map(polygon => scalePolygon(polygon, scale));
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
