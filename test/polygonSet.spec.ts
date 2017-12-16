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
import {SVGBuilder} from "../svgbuilder";
import * as fs from 'fs';

function saveSVGPolygons(polygons:ps.PolygonSet, fileName:string) {
    let svgbldr = new SVGBuilder();
    svgbldr.Add(polygons);
    let stream = fs.createWriteStream(fileName);
    svgbldr.SaveToSVG(stream, 1, 0);
    stream.end();
}

function arrayToPath(array:Array<Array<number>>):Array<Point> {
    return array.map(p => new Point(p[0], p[1]))
}

function circleToPolygon(
    center:Point, radius:number, numSegments:number = 40):Array<Point> {
    let result = new Array<Point>(numSegments);
    let angleStep = (2 * Math.PI) / numSegments;
    for (let idx = 0; idx <= numSegments; idx++) {
        let angle = idx * angleStep;
        result[idx] = new Point(
            center.x + radius * Math.cos(angle),
            center.y + radius * Math.sin(angle)
        );
    }
    return result;
}

function rectPolygon(x:number, y:number, w:number, h:number):Array<Point> {
    let result = new Array<Point>(5);
    result[0] = new Point(x, y);
    result[1] = new Point(x + w, y);
    result[2] = new Point(x + w, y + h);
    result[3] = new Point(x, y + h);
    result[4] = new Point(x, y);
    return result;
}

describe("PolygonSet tests", () => {
    it('Wait for Clipper', () => ps.waitClipperLoad());
    it('Union Test 1', () => {
        let poly1 = rectPolygon(0, 0, 10, 20);
        let poly2 = rectPolygon(0, 0, 20, 10);
        let poly3 = circleToPolygon(new Point(0, 0), 50);
        let poly4 = circleToPolygon(new Point(0, 0), 48).reverse();
        let result = ps.unionPolygonSet([poly1, poly2, poly3, poly4], []);
        saveSVGPolygons(result, 'union_test1.svg');
        //console.log(result);
    });
    it('Union Test 1', () => {
        let poly1 = rectPolygon(0, 0, 91, 10);
        let poly2 = rectPolygon(90, 0, 10, 91);
        let poly3 = rectPolygon(9, 90, 91, 10);
        let poly4 = rectPolygon(0, 9, 10, 91);
        let result = ps.unionPolygonSet([poly1, poly2, poly3, poly4], []);
        saveSVGPolygons([poly1, poly2, poly3, poly4], 'union_test2_a.svg');
        saveSVGPolygons(result, 'union_test2.svg');
        //console.log(result);
    });
    it('Subtract Tests', () => {
        let poly1 = rectPolygon(0, 0, 10, 20);
        let poly2 = rectPolygon(0, 0, 20, 10);
        let result = ps.subtractPolygonSet([poly1], [poly2]);
        saveSVGPolygons(result, 'subtract_test1.svg');
        //console.log(result);
    });
});