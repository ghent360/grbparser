/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 *
 * License: MIT License, see LICENSE.txt
 */
/**
* This file contains classes that implement functionality for
* the individual gerber commands.
*
* Each command class would parse the command from the input text and construct one or more
* primitives which hold the command data in consumable form.
*
* Each command class would be able to construct a well formatted text representation of
* the command suitable for output in a gerber file.
*
* Note that in the input text the command separators are stipped by the command tokenizer.
*/
import { ApertureDefinition, ApertureMacro, CoordinateFormatSpec, CoordinateUnits, ObjectPolarity, ObjectMirroring, Attribute, GerberCommand, GerberState } from './primitives';
export declare class FSCommand implements GerberCommand {
    readonly lineNo?: number;
    readonly name: string;
    readonly isAdvanced = true;
    readonly coordinateFormat: CoordinateFormatSpec;
    private static matchExp;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class MOCommand implements GerberCommand {
    readonly lineNo?: number;
    readonly name: string;
    readonly isAdvanced = true;
    readonly units: CoordinateUnits;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class ADCommand implements GerberCommand {
    readonly lineNo?: number;
    readonly name: string;
    readonly isAdvanced = true;
    readonly definition: ApertureDefinition;
    private static matchExp;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
    execute(ctx: GerberState): void;
    private checkStandardApertures;
    private checkCircleAperture;
    private checkRectangleAperture;
    private checkObroundAperture;
    private checkPolygonAperture;
}
export declare class G04Command implements GerberCommand {
    readonly lineNo?: number;
    readonly name: string;
    readonly isAdvanced = false;
    readonly comment: string;
    private static matchExp;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class AMCommand implements GerberCommand {
    readonly lineNo?: number;
    readonly name: string;
    readonly isAdvanced = true;
    readonly macro: ApertureMacro;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class ABCommand implements GerberCommand {
    readonly lineNo?: number;
    readonly name = "AB";
    readonly isAdvanced = true;
    readonly blockId: number;
    private static matchExp;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
/**
 * This is the "set current aperture" command, not the D01, D02 or D03 command.
 */
export declare class DCommand implements GerberCommand {
    readonly lineNo?: number;
    readonly name = "D";
    readonly isAdvanced = false;
    readonly apertureId: number;
    private static matchExp;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class D01Command implements GerberCommand {
    readonly lineNo?: number;
    readonly name = "D01";
    readonly isAdvanced = false;
    readonly x?: number;
    readonly y?: number;
    readonly i?: number;
    readonly j?: number;
    private static matchExp;
    constructor(cmd: string, fmt: CoordinateFormatSpec, lineNo?: number);
    formatOutput(fmt: CoordinateFormatSpec): string;
    execute(ctx: GerberState): void;
}
export declare class D02Command implements GerberCommand {
    readonly lineNo?: number;
    readonly name = "D02";
    readonly isAdvanced = false;
    readonly x?: number;
    readonly y?: number;
    private static matchExp;
    constructor(cmd: string, fmt: CoordinateFormatSpec, lineNo?: number);
    formatOutput(fmt: CoordinateFormatSpec): string;
    execute(ctx: GerberState): void;
}
export declare class D03Command implements GerberCommand {
    readonly lineNo?: number;
    readonly name = "D03";
    readonly isAdvanced = false;
    readonly x?: number;
    readonly y?: number;
    private static matchExp;
    constructor(cmd: string, fmt: CoordinateFormatSpec, lineNo?: number);
    formatOutput(fmt: CoordinateFormatSpec): string;
    execute(ctx: GerberState): void;
}
export declare class BaseGCodeCommand {
    readonly lineNo?: number;
    readonly codeId: number;
    readonly isAdvanced = false;
    private static matchExp;
    constructor(cmd: string, cmdCode?: number, lineNo?: number);
    formatOutput(): string;
}
export declare class G01Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G01";
    constructor(cmd: string, lineNo?: number);
    execute(ctx: GerberState): void;
}
export declare class G02Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G02";
    constructor(cmd: string, lineNo?: number);
    execute(ctx: GerberState): void;
}
export declare class G03Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G03";
    constructor(cmd: string, lineNo?: number);
    execute(ctx: GerberState): void;
}
export declare class G10Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G10";
    constructor(cmd: string, lineNo?: number);
    execute(ctx: GerberState): void;
}
export declare class G11Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G11";
    constructor(cmd: string, lineNo?: number);
    execute(ctx: GerberState): void;
}
export declare class G12Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G12";
    constructor(cmd: string, lineNo?: number);
    execute(ctx: GerberState): void;
}
export declare class G74Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G74";
    constructor(cmd: string, lineNo?: number);
    execute(ctx: GerberState): void;
}
export declare class G75Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G75";
    constructor(cmd: string, lineNo?: number);
    execute(ctx: GerberState): void;
}
export declare class G90Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G90";
    constructor(cmd: string, lineNo?: number);
    execute(ctx: GerberState): void;
}
export declare class G91Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G91";
    constructor(cmd: string, lineNo?: number);
    execute(ctx: GerberState): void;
}
export declare class G70Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G70";
    constructor(cmd: string, lineNo?: number);
    execute(ctx: GerberState): void;
}
export declare class G71Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G71";
    constructor(cmd: string, lineNo?: number);
    execute(ctx: GerberState): void;
}
export declare class LPCommand implements GerberCommand {
    readonly lineNo?: number;
    readonly name = "LP";
    readonly isAdvanced = true;
    readonly polarity: ObjectPolarity;
    private static matchExp;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class LMCommand implements GerberCommand {
    readonly lineNo?: number;
    readonly name = "LM";
    readonly isAdvanced = true;
    readonly miroring: ObjectMirroring;
    private static matchExp;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class LRCommand implements GerberCommand {
    readonly lineNo?: number;
    readonly name = "LR";
    readonly isAdvanced = true;
    readonly rotation: number;
    private static matchExp;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class LSCommand implements GerberCommand {
    readonly lineNo?: number;
    readonly name = "LS";
    readonly isAdvanced = true;
    readonly scale: number;
    private static matchExp;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class G36Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G36";
    constructor(cmd: string, lineNo?: number);
    execute(ctx: GerberState): void;
}
export declare class G37Command extends BaseGCodeCommand implements GerberCommand {
    readonly name = "G37";
    constructor(cmd: string, lineNo?: number);
    execute(ctx: GerberState): void;
}
export declare class SRCommand implements GerberCommand {
    readonly lineNo?: number;
    readonly name = "SR";
    readonly isAdvanced = true;
    readonly x?: number;
    readonly y?: number;
    readonly i?: number;
    readonly j?: number;
    private static matchExp;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class M02Command implements GerberCommand {
    readonly lineNo?: number;
    readonly isAdvanced = false;
    readonly name: string;
    private static matchExp;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class TCommand implements GerberCommand {
    readonly lineNo?: number;
    readonly attribute: Attribute;
    readonly isAdvanced = true;
    private static matchExp;
    constructor(cmd: string, lineNo?: number);
    readonly name: string;
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class TDCommand implements GerberCommand {
    readonly lineNo?: number;
    readonly attributeName: string;
    readonly isAdvanced = true;
    readonly name = "TD";
    private static matchExp;
    constructor(cmd: string, lineNo?: number);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}