/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2018
 *
 * License: MIT License, see LICENSE.txt
 */
import { CoordinateZeroFormat } from "./primitives";
export declare class ExcellonParseException {
    readonly message: string;
    readonly line?: number;
    constructor(message: string, line?: number);
    toString(): string;
}
/**
 * This is an internal class to "tokenize" the excellon commands from the stream.
 *
 * It would remove all \n \r and \t from the stream and call a "consumer" for each
 * complete command found in the stream.
 *
 * The input can be partial buffer.
 */
export declare class CommandParser {
    lineNumber: number;
    private consumer;
    private commandLineStart;
    private command;
    private errorHandler;
    parseBlock(buffer: string): void;
    flush(): void;
    private append;
    private static consoleError;
    private static emptyConsumer;
    setConsumer(consumer: (cmd: string, lineNo: number) => void): (cmd: string, lineNo: number) => void;
    setErrorHandler(handler: (lineNumber: number, buffer: string, idx: number) => void): (lineNumber: number, buffer: string, idx: number) => void;
    private commandPreprocessor;
}
export declare class CoordinateFormatSpec {
    numIntPos: number;
    numDecimalPos: number;
    zeroSkip: CoordinateZeroFormat;
    constructor(numIntPos: number, numDecimalPos: number, zeroSkip: CoordinateZeroFormat);
}
export interface ExcellonCommand {
    readonly name: string;
    readonly lineNo?: number;
    formatOutput(fmt: CoordinateFormatSpec): string;
    execute(ctx: ExcellonState): any;
}
export declare enum Units {
    MILIMETERS = 0,
    INCHES = 1
}
export declare enum CoordinateMode {
    ABSOLUTE = 0,
    RELATIVE = 1
}
export interface DrillHole {
    x: number;
    y: number;
    drillSize: number;
}
export declare class ExcellonState {
    tools: Map<number, number>;
    activeTool: number;
    units: Units;
    coordinateMode: CoordinateMode;
    header: boolean;
    fmt: CoordinateFormatSpec;
    fmtSet: boolean;
    isDrilling: boolean;
    xPos: number;
    yPos: number;
    holes: Array<DrillHole>;
    toMM(v: number): number;
    toInch(v: number): number;
    fromMM(v: number): number;
    fromInch(v: number): number;
    drillCommand(x: number, y: number, drill: number): void;
}
/**
 * The main excellon parser class.
 *
 * Usage TBD.
 */
export declare class ExcellonParser {
    private commandParser;
    private ctx;
    private commandDispatcher;
    private commands;
    constructor();
    parseBlock(block: string): void;
    flush(): void;
    private parseCommand;
    output(): string;
}
