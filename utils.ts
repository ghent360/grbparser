/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */

export function formatFloat(n:number, precision:number):string {
    let s = n.toPrecision(precision);
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