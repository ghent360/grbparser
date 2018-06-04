import { CoordinateFormatSpec, ExcellonCommand } from "./excellonparser";
/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2018
 *
 * License: MIT License, see LICENSE.txt
 */
/**
* This file contains classes that implement functionality for
* the individual excellon commands.
*
* Each command class would parse the command from the input text and construct one or more
* primitives which hold the command data in consumable form.
*
* Each command class would be able to construct a well formatted text representation of
* the command suitable for output in a gerber file.
*
* Note that in the input text the command separators are stipped by the command tokenizer.
*/
export declare class CommentCommand implements ExcellonCommand {
    readonly lineNo?: number;
    private static matchExp;
    private comment;
    readonly name: string;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
}
export declare class GCodeCommand implements ExcellonCommand {
    readonly lineNo?: number;
    readonly codeId: number;
    readonly name: string;
    private static matchExp;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
}
export declare class MCodeCommand implements ExcellonCommand {
    readonly lineNo?: number;
    readonly codeId: number;
    readonly name: string;
    private static matchExp;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
}
export declare class CommaCommandBase implements ExcellonCommand {
    readonly lineNo?: number;
    values: Array<string>;
    name: string;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
}
export declare class ResetCommand extends CommaCommandBase {
    readonly lineNo?: number;
    constructor(cmd: string, lineNo?: number);
}
export declare class AxisVersionCommand extends CommaCommandBase {
    readonly lineNo?: number;
    constructor(cmd: string, lineNo?: number);
}
export declare class FileFormatCommand extends CommaCommandBase {
    readonly lineNo?: number;
    constructor(cmd: string, lineNo?: number);
}
export declare class UnitsCommand extends CommaCommandBase {
    readonly lineNo?: number;
    constructor(cmd: string, lineNo?: number);
}
export interface Modifier {
    readonly code: string;
    readonly value?: number;
}
export declare class ToolPost {
    readonly start: number;
    readonly end?: number;
    constructor(start: number, end?: number);
    isRange(): boolean;
    toString(): string;
}
export declare class ToolDefinitionCommand implements ExcellonCommand {
    readonly lineNo?: number;
    readonly name: string;
    readonly tool: ToolPost;
    readonly modifiers: Array<Modifier>;
    private static match;
    private static toolMatch;
    constructor(cmd: string, fmt: CoordinateFormatSpec, lineNo?: number);
    formatOutput(fmt: CoordinateFormatSpec): string;
}
export declare class ToolChangeCommand implements ExcellonCommand {
    readonly lineNo?: number;
    readonly name: string;
    readonly toolId: number;
    private static match;
    constructor(cmd: string, lineNo?: number);
    formatOutput(fmt: CoordinateFormatSpec): string;
}
export declare class EndOfHeaderCommand implements ExcellonCommand {
    readonly lineNo?: number;
    readonly name: string;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
}
export declare class GCodeWithMods implements ExcellonCommand {
    readonly lineNo?: number;
    readonly codeId: number;
    readonly name: string;
    readonly modifiers: Array<Modifier>;
    private static gCodeExpr;
    constructor(cmd: string, fmt: CoordinateFormatSpec, allowedMods: string, lineNo?: number);
    formatOutput(fmt: CoordinateFormatSpec): string;
}
export declare class MCodeWithMods implements ExcellonCommand {
    readonly lineNo?: number;
    readonly codeId: number;
    readonly name: string;
    readonly modifiers: Array<Modifier>;
    private static mCodeExpr;
    constructor(cmd: string, fmt: CoordinateFormatSpec, allowedMods: string, lineNo?: number);
    formatOutput(fmt: CoordinateFormatSpec): string;
}
export declare class RepeatCommand implements ExcellonCommand {
    readonly lineNo?: number;
    readonly repeat: number;
    readonly name: string;
    readonly modifiers: Array<Modifier>;
    private static match;
    constructor(cmd: string, fmt: CoordinateFormatSpec, allowedMods: string, lineNo?: number);
    formatOutput(fmt: CoordinateFormatSpec): string;
}
export declare class PatternRepeatCommand implements ExcellonCommand {
    readonly lineNo?: number;
    readonly repeat: number;
    readonly name: string;
    readonly modifiers: Array<Modifier>;
    private static match;
    constructor(cmd: string, fmt: CoordinateFormatSpec, allowedMods: string, lineNo?: number);
    formatOutput(fmt: CoordinateFormatSpec): string;
}
export declare class CoordinatesCommand implements ExcellonCommand {
    readonly lineNo?: number;
    readonly name: string;
    readonly modifiers: Array<Modifier>;
    constructor(cmd: string, fmt: CoordinateFormatSpec, allowedMods: string, lineNo?: number);
    formatOutput(fmt: CoordinateFormatSpec): string;
}
