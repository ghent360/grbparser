/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */

import * as assert from 'assert';
import {Point} from "../point";
import * as pr from '../primitives';
import * as ps from '../polygonSet';

function arrayToPath(array:Array<Array<number>>):Array<Point> {
    return array.map(p => new Point(p[0], p[1]))
}

describe("PolygonSet tests", () => {
    it('Union Tests', () => {
        let poly1 = arrayToPath([[0, 0], [10, 0], [10, 20], [0, 20], [0, 0]]);
        let poly2 = arrayToPath([[0, 0], [20, 0], [20, 10], [0, 10], [0, 0]]);
        let result = ps.unionPolygonSet([poly1], [poly2]);
        console.log(result);
    });
    it('Subtract Tests', () => {
        let poly1 = arrayToPath([[0, 0], [10, 0], [10, 20], [0, 20], [0, 0]]);
        let poly2 = arrayToPath([[0, 0], [20, 0], [20, 10], [0, 10], [0, 0]]);
        let result = ps.subtractPolygonSet([poly1], [poly2]);
        console.log(result);
    });
});