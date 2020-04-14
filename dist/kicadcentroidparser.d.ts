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
import { BoardLayer } from "./gerberutils";
export declare class KicadCentroidParseException {
    readonly message: string;
    readonly line?: number;
    constructor(message: string, line?: number);
    toString(): string;
}
/**
 * This is an internal class to "tokenize" the input file from the stream.
 *
 * It would remove all \n and \r from the stream and call a "consumer" for each
 * line in the stream.
 *
 * The input can be partial buffer.
 */
export declare class CommandParser {
    lineNumber: number;
    private consumer;
    private commandLineStart;
    private command;
    parseBlock(buffer: string): void;
    flush(): void;
    private append;
    private static emptyConsumer;
    setConsumer(consumer: (cmd: string, lineNo: number) => void): (cmd: string, lineNo: number) => void;
    private commandPreprocessor;
}
export interface ComponentPosition {
    readonly name: string;
    readonly lineNo?: number;
    readonly center: Point;
    readonly rotation: number;
    readonly layer: BoardLayer;
    readonly attributes: Array<string>;
    formatOutput(): string;
}
export interface KicadCentroidParserResult {
    components: Array<ComponentPosition>;
    bounds: SimpleBounds;
}
/**
 * The main Kicad centroid parser class.
 *
 * Usage TBD.
 */
export declare class KicadCentroidParser {
    private commandParser;
    constructor();
    parseBlock(block: string): void;
    flush(): void;
    result(): void;
    private calcBounds;
    private parseCommand;
    output(): string;
}
