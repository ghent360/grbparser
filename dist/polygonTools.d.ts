/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 *
 * License: MIT License, see LICENSE.txt
 */
/**
 * This file contains helper functions used to construct polygons from
 * various basic shapes.
 */
import { Point } from "./point";
import { Polygon } from "./polygonSet";
export declare const NUMSTEPS = 30;
export declare function circleToPolygon(radius: number, nsteps?: number, rotation?: number): Polygon;
export declare function rectangleToPolygon(width: number, height: number): Polygon;
export declare function obroundToPolygon(width: number, height: number): Polygon;
export declare function arcToPolygon(start: Point, end: Point, center: Point, closeEnd?: boolean, closeStart?: boolean): Polygon;
export declare function reversePolygon(poly: Polygon): void;
