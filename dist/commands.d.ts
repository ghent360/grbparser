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
import { ApertureDefinition, ApertureMacro, CoordinateFormatSpec, FileUnits, ObjectPolarity, ObjectMirroring, Attribute, GerberCommand, GerberState, CoordinateSkipZeros } from './primitives';
export declare class FSCommand implements GerberCommand {
    readonly name: string;
    readonly isAdvanced: boolean;
    readonly coordinateFormat: CoordinateFormatSpec;
    private static matchExp;
    constructor(cmd: string);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class MOCommand implements GerberCommand {
    readonly name: string;
    readonly isAdvanced: boolean;
    readonly units: FileUnits;
    constructor(cmd: string);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class ADCommand implements GerberCommand {
    readonly name: string;
    readonly isAdvanced: boolean;
    readonly definition: ApertureDefinition;
    private static matchExp;
    constructor(cmd: string);
    formatOutput(): string;
    execute(ctx: GerberState): void;
    private checkStandardApertures();
    private checlCircleAperture();
    private checlRectangleAperture();
    private checlObroundAperture();
    private checlPolygonAperture();
}
export declare class G04Command implements GerberCommand {
    readonly name: string;
    readonly isAdvanced: boolean;
    readonly comment: string;
    private static matchExp;
    constructor(cmd: string);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class AMCommand implements GerberCommand {
    readonly name: string;
    readonly isAdvanced: boolean;
    readonly macro: ApertureMacro;
    constructor(cmd: string);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class ABCommand implements GerberCommand {
    readonly name: string;
    readonly isAdvanced: boolean;
    readonly blockId: number;
    private static matchExp;
    constructor(cmd: string);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
/**
 * This is the "set current aperture" command, not the D01, D02 or D03 command.
 */
export declare class DCommand implements GerberCommand {
    readonly name: string;
    readonly isAdvanced: boolean;
    readonly apertureId: number;
    private static matchExp;
    constructor(cmd: string);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare function parseCoordinateX(coordinate: string, fmt: CoordinateFormatSpec): number;
export declare function parseCoordinateY(coordinate: string, fmt: CoordinateFormatSpec): number;
export declare function formatFixedNumber(value: number, precision: number, intPos: number, skip: CoordinateSkipZeros): string;
export declare class D01Command implements GerberCommand {
    readonly name: string;
    readonly isAdvanced: boolean;
    readonly x?: number;
    readonly y?: number;
    readonly i?: number;
    readonly j?: number;
    private static matchExp;
    constructor(cmd: string, fmt: CoordinateFormatSpec);
    formatOutput(fmt: CoordinateFormatSpec): string;
    execute(ctx: GerberState): void;
}
export declare class D02Command implements GerberCommand {
    readonly name: string;
    readonly isAdvanced: boolean;
    readonly x?: number;
    readonly y?: number;
    private static matchExp;
    constructor(cmd: string, fmt: CoordinateFormatSpec);
    formatOutput(fmt: CoordinateFormatSpec): string;
    execute(ctx: GerberState): void;
}
export declare class D03Command implements GerberCommand {
    readonly name: string;
    readonly isAdvanced: boolean;
    readonly x?: number;
    readonly y?: number;
    private static matchExp;
    constructor(cmd: string, fmt: CoordinateFormatSpec);
    formatOutput(fmt: CoordinateFormatSpec): string;
    execute(ctx: GerberState): void;
}
export declare class BaseGCodeCommand {
    readonly codeId: number;
    readonly isAdvanced: boolean;
    private static matchExp;
    constructor(cmd: string, cmdCode?: number);
    formatOutput(): string;
}
export declare class G01Command extends BaseGCodeCommand implements GerberCommand {
    readonly name: string;
    constructor(cmd: string);
    execute(ctx: GerberState): void;
}
export declare class G02Command extends BaseGCodeCommand implements GerberCommand {
    readonly name: string;
    constructor(cmd: string);
    execute(ctx: GerberState): void;
}
export declare class G03Command extends BaseGCodeCommand implements GerberCommand {
    readonly name: string;
    constructor(cmd: string);
    execute(ctx: GerberState): void;
}
export declare class G74Command extends BaseGCodeCommand implements GerberCommand {
    readonly name: string;
    constructor(cmd: string);
    execute(ctx: GerberState): void;
}
export declare class G75Command extends BaseGCodeCommand implements GerberCommand {
    readonly name: string;
    constructor(cmd: string);
    execute(ctx: GerberState): void;
}
export declare class LPCommand implements GerberCommand {
    readonly name: string;
    readonly isAdvanced: boolean;
    readonly polarity: ObjectPolarity;
    private static matchExp;
    constructor(cmd: string);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class LMCommand implements GerberCommand {
    readonly name: string;
    readonly isAdvanced: boolean;
    readonly miroring: ObjectMirroring;
    private static matchExp;
    constructor(cmd: string);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class LRCommand implements GerberCommand {
    readonly name: string;
    readonly isAdvanced: boolean;
    readonly rotation: number;
    private static matchExp;
    constructor(cmd: string);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class LSCommand implements GerberCommand {
    readonly name: string;
    readonly isAdvanced: boolean;
    readonly scale: number;
    private static matchExp;
    constructor(cmd: string);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class G36Command extends BaseGCodeCommand implements GerberCommand {
    readonly name: string;
    constructor(cmd: string);
    execute(ctx: GerberState): void;
}
export declare class G37Command extends BaseGCodeCommand implements GerberCommand {
    readonly name: string;
    constructor(cmd: string);
    execute(ctx: GerberState): void;
}
export declare class SRCommand implements GerberCommand {
    readonly name: string;
    readonly isAdvanced: boolean;
    readonly x?: number;
    readonly y?: number;
    readonly i?: number;
    readonly j?: number;
    private static matchExp;
    constructor(cmd: string);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class M02Command implements GerberCommand {
    readonly isAdvanced: boolean;
    readonly name: string;
    constructor(cmd: string);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class TCommand implements GerberCommand {
    readonly attribute: Attribute;
    readonly isAdvanced: boolean;
    private static matchExp;
    constructor(cmd: string);
    readonly name: string;
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
export declare class TDCommand implements GerberCommand {
    readonly attributeName: string;
    readonly isAdvanced: boolean;
    readonly name: string;
    private static matchExp;
    constructor(cmd: string);
    formatOutput(): string;
    execute(ctx: GerberState): void;
}
