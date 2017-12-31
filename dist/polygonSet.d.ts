/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 *
 * License: MIT License, see LICENSE.txt
 */
import { Point } from "./point";
import { ObjectMirroring, Bounds, GraphicsObjects, SimpleBounds } from "./primitives";
export declare function waitClipperLoad(): Promise<void>;
export declare type Polygon = Float64Array;
export declare type PolygonSet = Array<Polygon>;
export interface PolygonSetWithBounds {
    readonly polygonSet: PolygonSet;
    readonly bounds: SimpleBounds;
}
export declare function rotatePolygon(poly: Polygon, angle: number): Polygon;
export declare function rotatePolySet(polySet: PolygonSet, angle: number): PolygonSet;
export declare function translatePolygon(poly: Polygon, offset: Point): Polygon;
export declare function translatePolySet(polySet: PolygonSet, offset: Point): PolygonSet;
export declare function translateObjects(objects: GraphicsObjects, offset: Point): GraphicsObjects;
export declare function scalePolygon(poly: Polygon, scale: number): Polygon;
export declare function scalePolySet(polySet: PolygonSet, scale: number): PolygonSet;
export declare function mirrorPolygon(poly: Polygon, mirror: ObjectMirroring): Polygon;
export declare function mirrorPolySet(polySet: PolygonSet, mirror: ObjectMirroring): PolygonSet;
export declare function polygonBounds(poly: Polygon): Bounds;
export declare function polySetBounds(polygonSet: PolygonSet): Bounds;
export declare function objectsBounds(objects: GraphicsObjects): Bounds;
export declare function unionPolygonSet(one: PolygonSet, other: PolygonSet): PolygonSetWithBounds;
export declare function subtractPolygonSet(one: PolygonSet, other: PolygonSet): PolygonSetWithBounds;
export declare function distance2(x1: number, y1: number, x2: number, y2: number): number;
export declare function connectWires(polygonSet: PolygonSet): PolygonSet;
