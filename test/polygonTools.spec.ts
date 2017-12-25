/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */

import * as assert from 'assert';
import * as pt from '../polygonTools';

describe("PolygonTools tests", () => {
    it('Reverse Polygon Test', () => {
        let polygon1 = Float64Array.of(5, 10);
        pt.reversePolygon(polygon1);
        assert.equal(polygon1[0], 5);
        assert.equal(polygon1[1], 10);

        let polygon2 = Float64Array.of(5, 10, 50, 250);
        pt.reversePolygon(polygon2);
        assert.equal(polygon2[0], 50);
        assert.equal(polygon2[1], 250);
        assert.equal(polygon2[2], 5);
        assert.equal(polygon2[3], 10);

        let polygon3 = Float64Array.of(5, 10, 50, 250, -20, -40);
        pt.reversePolygon(polygon3);
        assert.equal(polygon3[0], -20);
        assert.equal(polygon3[1], -40);
        assert.equal(polygon3[2], 50);
        assert.equal(polygon3[3], 250);
        assert.equal(polygon3[4], 5);
        assert.equal(polygon3[5], 10);
    });
});