"use strict";
/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 *
 * License: MIT License, see LICENSE.txt
 */
Object.defineProperty(exports, "__esModule", { value: true });
function formatFloat(n, precision) {
    let s = n.toFixed(precision);
    let dotIdx = s.indexOf('.');
    if (dotIdx >= 0 && s.indexOf('e') < 0) {
        let idx;
        for (idx = s.length - 1; idx > dotIdx + 1; idx--) {
            if (s[idx] != '0') {
                break;
            }
        }
        s = s.substring(0, idx + 1);
    }
    return s;
}
exports.formatFloat = formatFloat;
//# sourceMappingURL=utils.js.map