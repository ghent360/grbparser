/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 *
 * License: MIT License, see LICENSE.txt
 */
/**
 * This file contains classes that convert graphics object primitives from the parset
 * to other formats for example - polygon sets, svg etc.
 */
import { Line, Circle, Arc, Flash, Region, GraphicsPrimitive, Repeat, SimpleBounds } from "./primitives";
import { PolygonSet } from "./polygonSet";
export declare abstract class ConverterBase<T> {
    convert(primitives: Array<GraphicsPrimitive>): Array<T>;
    header(primitives: Array<GraphicsPrimitive>): Array<T>;
    footer(primitives: Array<GraphicsPrimitive>): Array<T>;
    abstract convertLine(l: Line): T;
    abstract convertArc(a: Arc): T;
    abstract convertCircle(c: Circle): T;
    abstract convertFlash(f: Flash): T;
    abstract convertRegion(r: Region): T;
    abstract convertRepeat(r: Repeat): T;
}
export declare class DebugConverter {
    convert(primitives: Array<GraphicsPrimitive>): Array<string>;
}
export declare const Init: Promise<void>;
export declare function WaitInit(callback: () => void): void;
export declare class SVGConverter extends ConverterBase<string> {
    scale: number;
    margin: number;
    layerColor: number;
    precision: number;
    private bounds_;
    private width_;
    private height_;
    private offset_;
    private objects_;
    convertLine(l: Line): string;
    convertArc(a: Arc): string;
    convertCircle(c: Circle): string;
    convertFlash(f: Flash): string;
    convertRegion(r: Region): string;
    convertRepeat(r: Repeat): string;
    header(primitives: Array<GraphicsPrimitive>): Array<string>;
    footer(): Array<string>;
    private polySetToSolidPath(polySet);
    private polySetToWirePath(polySet);
    private static toString2(n);
    private static colorToHtml(clr);
    static GerberToSvg(content: string, layerColor?: number, scale?: number, margin?: number): string;
}
export declare class PolygonConverterResult {
    readonly solids: PolygonSet;
    readonly thins: PolygonSet;
    readonly bounds: SimpleBounds;
}
export declare function GerberToPolygons(content: string, union?: boolean): PolygonConverterResult;
export declare class PrimitiveConverter {
    static GerberToPrimitives(content: string): Array<GraphicsPrimitive>;
}
