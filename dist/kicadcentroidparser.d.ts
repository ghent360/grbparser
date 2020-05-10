/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2020
 *
 * License: MIT License, see LICENSE.txt
 */
import { SimpleBounds } from "./primitives";
import { Point } from "./point";
import { BoardSide } from "./gerberutils";
export declare class KicadCentroidParseException {
    readonly message: string;
    readonly line?: number | undefined;
    constructor(message: string, line?: number | undefined);
    toString(): string;
}
export interface ComponentPosition {
    readonly name: string;
    readonly center: Point;
    readonly rotation: number;
    readonly layer: BoardSide;
    readonly attributes: ReadonlyArray<string>;
    formatOutput(): string;
}
export interface KicadCentroidParserResult {
    components: Array<ComponentPosition>;
    bounds: SimpleBounds;
    side: BoardSide;
}
/**
 * The main Kicad centroid parser class.
 *
 * Usage TBD.
 */
export declare class KicadCentroidParser {
    private csvParser;
    private header?;
    private nameIdx;
    private xPosIdx;
    private rotationIdx;
    private layerIdx;
    private components;
    private bounds?;
    constructor();
    parseBlock(block: string): void;
    flush(): void;
    result(): KicadCentroidParserResult;
    private processRecord;
    private static toBoardSide;
    private processHeader;
    private calcBounds;
    output(): string;
}
