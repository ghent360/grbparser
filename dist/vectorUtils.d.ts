/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 *
 * License: MIT License, see LICENSE.txt
 */
export declare function vectorLength(v: {
    x: number;
    y: number;
}): number;
export declare function scaleVector(v: {
    x: number;
    y: number;
}, s: number): {
    x: number;
    y: number;
};
export declare function unitVector(v: {
    x: number;
    y: number;
}): {
    x: number;
    y: number;
};
export declare function addVector(a: {
    x: number;
    y: number;
}, b: {
    x: number;
    y: number;
}): {
    x: number;
    y: number;
};
export declare function negVector(v: {
    x: number;
    y: number;
}): {
    x: number;
    y: number;
};
export declare function distanceVector2(a: {
    x: number;
    y: number;
}, b: {
    x: number;
    y: number;
}): number;
