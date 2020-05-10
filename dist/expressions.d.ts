/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 *
 * License: MIT License, see LICENSE.txt
 */
export declare class Memory {
    private variables;
    constructor(modifiers: Array<number>);
    get(idx: number): number;
    set(idx: number, value: number): void;
}
export interface ArithmeticOperation {
    getValue(memory: Memory): number;
}
export declare class ExpressionParser {
    private expression_;
    private token?;
    private prevToken?;
    private bracketLevel;
    private static MatchVariable;
    private static MatchNumber;
    constructor(expression: string);
    private nextToken;
    private consume;
    private accept;
    private expect;
    private operand;
    private factor;
    private term;
    private expression;
    parse(): ArithmeticOperation;
}
