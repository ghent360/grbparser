/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 *
 * License: MIT License, see LICENSE.txt
 */
/// <reference types="node" />
import { PolygonSet } from "./polygonSet";
import * as fs from "fs";
export declare class StyleInfo {
    brushClr: number;
    penClr: number;
    penWidth: number;
    showCoords: boolean;
    Clone(): StyleInfo;
    constructor();
}
export interface Point {
    x: number;
    y: number;
}
export declare class SVGBuilder {
    style: StyleInfo;
    private PolyInfoList;
    constructor();
    Add(poly: PolygonSet): void;
    SaveToSVG(file: fs.WriteStream, scale?: number, margin?: number): boolean;
}
