import { CoordinateZeroFormat } from "./primitives";
/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 *
 * License: MIT License, see LICENSE.txt
 */
export declare function formatFloat(n: number, precision: number): string;
export declare class FormatException {
    readonly message: string;
    constructor(message: string);
    toString(): string;
}
export declare function formatFixedNumber(value: number, precision: number, intPos: number, skip: CoordinateZeroFormat): string;
export declare function parseCoordinate(coordinate: string, numIntPos: number, numDecPos: number, zeroSkip: CoordinateZeroFormat): number;
