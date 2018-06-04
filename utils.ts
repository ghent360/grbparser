import { CoordinateZeroFormat } from "./primitives";

/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */

export function formatFloat(n:number, precision:number):string {
    let s = n.toFixed(precision);
    let dotIdx = s.indexOf('.');
    if (dotIdx >= 0 && s.indexOf('e') < 0) {
        let idx:number;
        for (idx = s.length - 1; idx > dotIdx + 1; idx--) {
            if (s[idx] != '0') {
                break;
            }
        }
        s = s.substring(0, idx + 1);
    }
    return s;
}

export class FormatException {
    constructor(readonly message:string) {
    }

    toString():string {
        return `FormatException: ${this.message}`;
    }
}

export function formatFixedNumber(value:number, precision:number, intPos:number, skip:CoordinateZeroFormat):string {
    let totalLen = intPos + precision;
    let sign = "";
    if (value < 0) {
        value = -value;
        sign = "-";
    }
    let intValue = Math.round(value * Math.pow(10, precision));
    let strValue = intValue.toString();
    switch (skip) {
        case CoordinateZeroFormat.NONE:
            if (strValue.length < totalLen) {
                strValue = "0".repeat(totalLen - strValue.length) + strValue;
            }
            if (strValue.length > totalLen) {
                throw new FormatException(`Value ${value} does note fit format ${intPos}${precision}.`);
            }
            return sign + strValue;
        case CoordinateZeroFormat.LEADING:
            if (strValue.length > totalLen) {
                throw new FormatException(`Value ${value} does note fit format ${intPos}${precision}.`);
            }
            return sign + strValue;
        case CoordinateZeroFormat.TRAILING:
            if (strValue.length < totalLen) {
                strValue = "0".repeat(totalLen - strValue.length) + strValue;
            }
            if (strValue.length > totalLen) {
                throw new FormatException(`Value ${value} does note fit format ${intPos}${precision}.`);
            }
            let endTrim = strValue.length - 1;
            while (endTrim > 0 && strValue[endTrim] == '0') {
                endTrim--;
            }
            strValue = strValue.substr(0, endTrim + 1);
            return sign + strValue;
    }
}

export function parseCoordinate(
    coordinate:string,
    numIntPos:number,
    numDecPos:number,
    zeroSkip:CoordinateZeroFormat):number {
    if (coordinate.indexOf('.') >= 0) {
        return Number.parseFloat(coordinate);
    }
    let pow = Math.pow(10, -numDecPos);
    let len = numIntPos + numDecPos;
    let sign = 1;
    let numDigits = 0;
    // Count how many digits are in the string:
    for (let idx = 0; idx < coordinate.length; idx++) {
        if (coordinate[idx] >= '0' && coordinate[idx] <= '9') {
            numDigits++;
        }
    }
    if (coordinate[0] == '-') {
        sign = -1;
        coordinate = coordinate.substring(1);
    }
    //if (numDigits > len) {
    //    throw new FormatException(`Coordinate ${coordinate} longer than the format allows ${numIntPos}.${numDecPos}`);
    //}
    let zeroMult = 1;
    if (zeroSkip == CoordinateZeroFormat.TRAILING && numDigits < len) {
        zeroMult = Math.pow(10, len - numDigits);
    }
    let num = Number.parseFloat(coordinate);
    return sign * num * pow * zeroMult;
}
