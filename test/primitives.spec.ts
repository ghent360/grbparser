/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */

import * as assert from 'assert';
import * as fs from 'fs';
import {SVGBuilder} from "../svgbuilder";
import * as pr from '../primitives';
import * as ps from '../polygonSet';
import * as exp from '../expressions';
import {Point} from "../point";
import {NUMSTEPS} from "../polygonTools";
import { ObjectPolarity } from '../primitives';

function saveSVGPolygons(polygons:ps.PolygonSet, fileName:string) {
    let svgbldr = new SVGBuilder();
    svgbldr.Add(polygons);
    let stream = fs.createWriteStream(fileName);
    svgbldr.SaveToSVG(stream);
    stream.end();
}

function saveSVGObjects(objects:pr.GraphicsObjects, fileName:string) {
    let svgbldr = new SVGBuilder();
    let polygons = pr.composeImage(objects);
    svgbldr.Add(polygons);
    let stream = fs.createWriteStream(fileName);
    svgbldr.SaveToSVG(stream);
    stream.end();
}

function perseExpressions(expressions:Array<string>):Array<exp.AritmeticOperation> {
    return expressions.map(e => new exp.ExpressionParser(e).parse());
}

const defaultState = new pr.ObjectState();

describe("Primitives tests", () => {
    it('Standard Circle Aperture Tests', () => {
        let aperture = new pr.ApertureDefinition(10, "C", [10]);
        assert.equal(aperture.isMacro(), false);
        let objects = aperture.objects(ObjectPolarity.DARK);
        assert.equal(objects.length, 1);
        assert.equal(objects[0].polySet.length, 1);
        assert.equal(objects[0].polySet[0].length, NUMSTEPS + 1);
        assert.ok(objects[0].polySet[0][0].distance(objects[0].polySet[0][NUMSTEPS]) < pr.Epsilon);

        aperture = new pr.ApertureDefinition(10, "C", [10, 5]);
        objects = aperture.objects(ObjectPolarity.DARK);
        assert.equal(objects.length, 1);
        assert.equal(objects[0].polySet.length, 2);
        assert.equal(objects[0].polySet[0].length, NUMSTEPS + 1);
        assert.equal(objects[0].polySet[1].length, NUMSTEPS + 1);
        assert.ok(objects[0].polySet[0][0].distance(objects[0].polySet[0][NUMSTEPS]) < pr.Epsilon);
        assert.ok(objects[0].polySet[1][0].distance(objects[0].polySet[1][NUMSTEPS]) < pr.Epsilon);

        aperture = new pr.ApertureDefinition(10, "C", [10, 3, 5]);
        objects = aperture.objects(ObjectPolarity.DARK);
        assert.equal(objects.length, 1);
        assert.equal(objects[0].polySet.length, 2);
        assert.equal(objects[0].polySet[0].length, NUMSTEPS + 1);
        assert.equal(objects[0].polySet[1].length, 5);
        assert.ok(objects[0].polySet[0][0].distance(objects[0].polySet[0][NUMSTEPS]) < pr.Epsilon);
        assert.ok(objects[0].polySet[1][0].distance(objects[0].polySet[1][4]) < pr.Epsilon);
    });
    it('Standard Rectangle Aperture Tests', () => {
        let aperture = new pr.ApertureDefinition(10, "R", [10, 5]);
        assert.equal(aperture.isMacro(), false);
        let objects = aperture.objects(ObjectPolarity.DARK);
        assert.equal(objects.length, 1);
        assert.equal(objects[0].polySet.length, 1);
        assert.equal(objects[0].polySet[0].length, 5);
        assert.ok(objects[0].polySet[0][0].distance(objects[0].polySet[0][4]) < pr.Epsilon);

        aperture = new pr.ApertureDefinition(10, "R", [10, 5, 3]);
        objects = aperture.objects(ObjectPolarity.DARK);
        assert.equal(objects.length, 1);
        assert.equal(objects[0].polySet.length, 2);
        assert.equal(objects[0].polySet[0].length, 5);
        assert.equal(objects[0].polySet[1].length, NUMSTEPS + 1);
        assert.ok(objects[0].polySet[0][0].distance(objects[0].polySet[0][4]) < pr.Epsilon);
        assert.ok(objects[0].polySet[1][0].distance(objects[0].polySet[1][NUMSTEPS]) < pr.Epsilon);
        
        aperture = new pr.ApertureDefinition(10, "R", [10, 5, 3, 2]);
        objects = aperture.objects(ObjectPolarity.DARK);
        assert.equal(objects.length, 1);
        assert.equal(objects[0].polySet.length, 2);
        assert.equal(objects[0].polySet[0].length, 5);
        assert.equal(objects[0].polySet[1].length, 5);
        assert.ok(objects[0].polySet[0][0].distance(objects[0].polySet[0][4]) < pr.Epsilon);
        assert.ok(objects[0].polySet[1][0].distance(objects[0].polySet[1][4]) < pr.Epsilon);
    });
    it('Standard Obround Aperture Tests', () => {
        let aperture = new pr.ApertureDefinition(10, "O", [5, 10]);
        assert.equal(aperture.isMacro(), false);
        let objects = aperture.objects(ObjectPolarity.DARK);
        assert.equal(objects.length, 1);
        assert.equal(objects[0].polySet.length, 1);
        assert.equal(objects[0].polySet[0].length, NUMSTEPS + 3);
        //console.log(`O poly set ${polySet}`);
        saveSVGObjects(objects, "oblong.svg");
    });
    it('Standard Polygon Aperture Tests', () => {
        let aperture = new pr.ApertureDefinition(10, "P", [10, 3, 45, 3]);
        assert.equal(aperture.isMacro(), false);
        let objects = aperture.objects(ObjectPolarity.DARK);
        assert.equal(objects.length, 1);
        assert.equal(objects[0].polySet.length, 2);
        assert.equal(objects[0].polySet[0].length, 4);
        saveSVGObjects(objects, "polygon3.svg");
        //console.log(`P poly set ${polySet}`);
    });
    it('Line draw with circular aperture', () => {
        let aperture = new pr.ApertureDefinition(10, "C", [15]);
        let result = aperture.generateLineDraw(new Point(10, 10), new Point(100, 100), defaultState);
        saveSVGPolygons([result], "line_draw_circle.svg");
    });
    it('Line draw with rectangular aperture', () => {
        let aperture = new pr.ApertureDefinition(10, "R", [15, 6]);
        let result1 = aperture.generateLineDraw(new Point(10, 10), new Point(100, 100), defaultState);
        let result2 = aperture.generateLineDraw(new Point(-20, 10), new Point(-20, 100), defaultState);
        let result3 = aperture.generateLineDraw(new Point(10, -10), new Point(100, -10), defaultState);
        saveSVGPolygons([result1, result2, result3], "line_draw_rectangle.svg");
    });
    it('Arc draw with circular aperture', () => {
        let aperture = new pr.ApertureDefinition(10, "C", [3]);
        let result1 = aperture.generateArcDraw(
            new Point(10, 0), new Point(7.071, 7.071), new Point(0, 0), defaultState);
        let result2 = aperture.generateArcDraw(
            new Point(14.1421, 14.1421), new Point(20, 0), new Point(0, 0), defaultState);
        let result3 = aperture.generateArcDraw(
            new Point(7.071, 7.071), new Point(10, 0), new Point(17.1,7.071), defaultState);
        saveSVGPolygons([result2, result3], "arc_draw_circle.svg");
    });
    it('Arc draw with rectangular aperture', () => {
        let aperture = new pr.ApertureDefinition(10, "R", [3, 6]);
        let result2 = aperture.generateArcDraw(
            new Point(14.1421, 14.1421), new Point(20, 0), new Point(0, 0), defaultState);
        let result3 = aperture.generateArcDraw(
            new Point(7.071, 7.071), new Point(10, 0), new Point(17.1,7.071), defaultState);
        saveSVGPolygons([result2, result3], "arc_draw_rectangle.svg");
    });
    it('Aperture macro - circles', () => {
        let aperture = new pr.ApertureMacro("MACRO", [
            new pr.Primitive(1, perseExpressions(["1", "1", "5", "0", "0"])),
            new pr.Primitive(1, perseExpressions(["1", "1.2", "5", "0", "20"])),
            new pr.Primitive(1, perseExpressions(["1", "1.4", "5", "0", "40"])),
            new pr.Primitive(1, perseExpressions(["1", "1.6", "5", "0", "60"])),
            new pr.Primitive(1, perseExpressions(["1", "1.8", "5", "0", "90"]))]);
        let result = aperture.toPolygonSet([]);
        saveSVGPolygons(result, "macro_circles.svg");
    });
    it('Aperture macro - outline', () => {
        let aperture = new pr.ApertureMacro("MACRO", [
            new pr.Primitive(4, perseExpressions(["1", "4", "0.1", "0.1", "0.5", "0.1", "0.5", "0.5", "0.1", "0.5", "0.1", "0.1", "30"])),
        ]);
        let result = aperture.toPolygonSet([]);
        saveSVGPolygons(result, "macro_outline.svg");
    });
    it('Aperture macro - polygon', () => {
        let aperture = new pr.ApertureMacro("MACRO", [
            new pr.Primitive(5, perseExpressions(["1", "5", "50", "0", "10", "30"])),
        ]);
        let result = aperture.toPolygonSet([]);
        saveSVGPolygons(result, "macro_polygon.svg");
    });
    it('Aperture macro - moire', () => {
        let aperture = new pr.ApertureMacro("MACRO", [
            new pr.Primitive(6, perseExpressions(["50", "0", "10", "0.5", "0.2", "3", "1.5", "12", "0"])),
            new pr.Primitive(6, perseExpressions(["0", "50", "10", "0.5", "0.2", "13", "0.5", "12", "0"])),
        ]);
        let result = aperture.toPolygonSet([]);
        saveSVGPolygons(result, "macro_moire.svg");
    });
    it('Aperture macro - thermal', () => {
        let aperture = new pr.ApertureMacro("MACRO", [
            new pr.Primitive(7, perseExpressions(["50", "0", "10", "8.5", "1.1", "0"])),
            new pr.Primitive(7, perseExpressions(["0", "50", "10", "0", "1.1", "30"])),
        ]);
        let result = aperture.toPolygonSet([]);
        saveSVGPolygons(result, "macro_thermal.svg");
    });
    it('Aperture macro - vectorLine', () => {
        let aperture = new pr.ApertureMacro("MACRO", [
            new pr.Primitive(20, perseExpressions(["1", "2", "10", "10", "30", "15", "90"])),
        ]);
        let result = aperture.toPolygonSet([]);
        saveSVGPolygons(result, "macro_vectorLine.svg");
    });
});
