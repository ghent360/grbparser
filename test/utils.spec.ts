/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */

import * as assert from 'assert';
import * as cm from '../utils';
import { CoordinateFormatSpec, CoordinateType, CoordinateZeroFormat } from '../primitives';

describe("Utils tests", () => {
    it('Number format', () => {
        let str = cm.formatFixedNumber(1, 3, 2, CoordinateZeroFormat.NONE);
        assert.equal(str, "01000");
        str = cm.formatFixedNumber(-1, 3, 2, CoordinateZeroFormat.NONE);
        assert.equal(str, "-01000");
        str = cm.formatFixedNumber(-1.23441, 3, 2, CoordinateZeroFormat.NONE);
        assert.equal(str, "-01234");
        str = cm.formatFixedNumber(12.3441, 3, 2, CoordinateZeroFormat.NONE);
        assert.equal(str, "12344");
        assert.throws(() => cm.formatFixedNumber(123, 3, 2, CoordinateZeroFormat.NONE));

        str = cm.formatFixedNumber(1, 3, 2, CoordinateZeroFormat.TRAILING);
        assert.equal(str, "1000");
        str = cm.formatFixedNumber(-1, 3, 2, CoordinateZeroFormat.TRAILING);
        assert.equal(str, "-1000");
        str = cm.formatFixedNumber(-1.23441, 3, 2, CoordinateZeroFormat.TRAILING);
        assert.equal(str, "-1234");
        str = cm.formatFixedNumber(12.3441, 3, 2, CoordinateZeroFormat.TRAILING);
        assert.equal(str, "12344");
        assert.throws(() => cm.formatFixedNumber(1234, 3, 2, CoordinateZeroFormat.TRAILING));
        str = cm.formatFixedNumber(0.03, 3, 2, CoordinateZeroFormat.TRAILING);
        assert.equal(str, "30");

        str = cm.formatFixedNumber(1, 2, 3, CoordinateZeroFormat.LEADING);
        assert.equal(str, "001");
        str = cm.formatFixedNumber(-1, 2, 3, CoordinateZeroFormat.LEADING);
        assert.equal(str, "-001");
        str = cm.formatFixedNumber(-1.23441, 2, 3, CoordinateZeroFormat.LEADING);
        assert.equal(str, "-00123");
        str = cm.formatFixedNumber(-1.2, 2, 3, CoordinateZeroFormat.LEADING);
        assert.equal(str, "-0012");
        str = cm.formatFixedNumber(123.441, 2, 3, CoordinateZeroFormat.LEADING);
        assert.equal(str, "12344");
        assert.throws(() => cm.formatFixedNumber(1000, 2, 3, CoordinateZeroFormat.LEADING));
        str = cm.formatFixedNumber(0.03, 3, 2, CoordinateZeroFormat.LEADING);
        assert.equal(str, "0003");
    });
    it('Number parse', () => {
        let value = cm.parseCoordinate("-12345", 2, 3, CoordinateZeroFormat.NONE);
        assert.ok(Math.abs(value - -12.345) < 1e-10, `NO Expected -12.345, got ${value}`);
        value = cm.parseCoordinate("2345", 2, 3, CoordinateZeroFormat.NONE);
        assert.ok(Math.abs(value - 2.345) < 1e-10);

        value = cm.parseCoordinate("-12345", 2, 3, CoordinateZeroFormat.LEADING);
        assert.ok(Math.abs(value - -12.345) < 1e-10, `LE Expected -12.345, got ${value}`);
        value = cm.parseCoordinate("2345", 2, 3, CoordinateZeroFormat.LEADING);
        assert.ok(Math.abs(value - 23.45) < 1e-10);

        value = cm.parseCoordinate("-12345", 2, 3, CoordinateZeroFormat.TRAILING);
        assert.ok(Math.abs(value - -12.345) < 1e-10, `TR Expected -12.345, got ${value}`);
        value = cm.parseCoordinate("2345", 2, 3, CoordinateZeroFormat.TRAILING);
        assert.ok(Math.abs(value - 2.345) < 1e-10);

        value = cm.parseCoordinate("0003", 2, 3, CoordinateZeroFormat.LEADING);
        assert.ok(Math.abs(value - 0.03) < 1e-10);

        value = cm.parseCoordinate("30", 2, 3, CoordinateZeroFormat.TRAILING);
        assert.ok(Math.abs(value - 0.03) < 1e-10);

        value = cm.parseCoordinate("0.03", 2, 3, CoordinateZeroFormat.TRAILING);
        assert.ok(Math.abs(value - 0.03) < 1e-10);
        value = cm.parseCoordinate("0.03", 2, 3, CoordinateZeroFormat.LEADING);
        assert.ok(Math.abs(value - 0.03) < 1e-10);
    });
});
