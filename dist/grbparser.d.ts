/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 *
 * License: MIT License, see LICENSE.txt
 */
import { GerberState } from "./primitives";
/**
 * This is an internal class to "tokenize" the gerber commands from the stream.
 *
 * It would remove all \n \r and \t from the stream and call a "consumer" for each
 * complete command found in the stream.
 *
 * The input can be partial buffer.
 */
export declare class CommandParser {
    lineNumber: number;
    private nextTokenSeparator;
    private consumer;
    private commandLineStart;
    private command;
    private errorHandler;
    private static gCodeSplit;
    private static gdmnCodeSplit;
    private static g04Match;
    private static dCmdMatch;
    private static coordinatesOrder;
    parseBlock(buffer: string): void;
    private append(chr);
    private static consoleError(lineNumber, buffer, idx);
    private static emptyConsumer(cmd, line);
    setConsumer(consumer: (cmd: string, lineNo: number, isAdvanced: boolean) => void): (cmd: string, lineNo: number, isAdvanced: boolean) => void;
    setErrorHandler(handler: (lineNumber: number, buffer: string, idx: number) => void): (lineNumber: number, buffer: string, idx: number) => void;
    private commandPreprocessor();
    private static coordinatePosition(coordinate);
    /**
     * Sometimes we receive D operation where the coordinates are out of order
     * for example Y123X567D03. We convert it to X567Y123D03.
     * @param cmd input command
     */
    private static orderDoperation(cmd);
}
/**
 * The main gerber parser class.
 *
 * Usage TBD.
 */
export declare class GerberParser {
    private commandParser;
    private fmt;
    private lastDcmd;
    private commandDispatcher;
    private commands;
    constructor();
    parseBlock(block: string): void;
    private parseCommand(cmd, lineNo);
    output(): string;
    execute(ctx: GerberState): void;
}
