import * as assert from 'assert';
import * as fs from 'fs';
import {SVGBuilder} from "../svgbuilder";
import * as pr from '../primitives';

function saveSVG(polygonSet:pr.PolygonSet, fileName:string) {
    let svgbldr = new SVGBuilder();
    svgbldr.Add(polygonSet);
    let stream = fs.createWriteStream(fileName);
    svgbldr.SaveToSVG(stream);
    stream.end();
}

describe("Primitives tests", () => {
    it('Standard Circle Aperture Tests', () => {
        let aperture = new pr.ApertureDefinition(10, "C", [10]);
        assert.equal(aperture.isMacro(), false);
        let polySet = aperture.toPolygonSet();
        assert.equal(polySet.length, 1);
        assert.equal(polySet[0].length, pr.NUMSTEPS + 1);
        assert.ok(polySet[0][0].distance(polySet[0][pr.NUMSTEPS]) < pr.Epsilon);

        aperture = new pr.ApertureDefinition(10, "C", [10, 5]);
        polySet = aperture.toPolygonSet();
        assert.equal(polySet.length, 2);
        assert.equal(polySet[0].length, pr.NUMSTEPS + 1);
        assert.equal(polySet[1].length, pr.NUMSTEPS + 1);
        assert.ok(polySet[0][0].distance(polySet[0][pr.NUMSTEPS]) < pr.Epsilon);
        assert.ok(polySet[1][0].distance(polySet[1][pr.NUMSTEPS]) < pr.Epsilon);

        aperture = new pr.ApertureDefinition(10, "C", [10, 3, 5]);
        polySet = aperture.toPolygonSet();
        assert.equal(polySet.length, 2);
        assert.equal(polySet[0].length, pr.NUMSTEPS + 1);
        assert.equal(polySet[1].length, 5);
        assert.ok(polySet[0][0].distance(polySet[0][pr.NUMSTEPS]) < pr.Epsilon);
        assert.ok(polySet[1][0].distance(polySet[1][4]) < pr.Epsilon);
    });
    it('Standard Rectangle Aperture Tests', () => {
        let aperture = new pr.ApertureDefinition(10, "R", [10, 5]);
        assert.equal(aperture.isMacro(), false);
        let polySet = aperture.toPolygonSet();
        assert.equal(polySet.length, 1);
        assert.equal(polySet[0].length, 5);
        assert.ok(polySet[0][0].distance(polySet[0][4]) < pr.Epsilon);

        aperture = new pr.ApertureDefinition(10, "R", [10, 5, 3]);
        polySet = aperture.toPolygonSet();
        assert.equal(polySet.length, 2);
        assert.equal(polySet[0].length, 5);
        assert.equal(polySet[1].length, pr.NUMSTEPS + 1);
        assert.ok(polySet[0][0].distance(polySet[0][4]) < pr.Epsilon);
        assert.ok(polySet[1][0].distance(polySet[1][pr.NUMSTEPS]) < pr.Epsilon);
        
        aperture = new pr.ApertureDefinition(10, "R", [10, 5, 3, 2]);
        polySet = aperture.toPolygonSet();
        assert.equal(polySet.length, 2);
        assert.equal(polySet[0].length, 5);
        assert.equal(polySet[1].length, 5);
        assert.ok(polySet[0][0].distance(polySet[0][4]) < pr.Epsilon);
        assert.ok(polySet[1][0].distance(polySet[1][4]) < pr.Epsilon);
    });
    it('Standard Obround Aperture Tests', () => {
        let aperture = new pr.ApertureDefinition(10, "O", [5, 10]);
        assert.equal(aperture.isMacro(), false);
        let polySet = aperture.toPolygonSet();
        assert.equal(polySet.length, 1);
        assert.equal(polySet[0].length, pr.NUMSTEPS + 3);
        //console.log(`O poly set ${polySet}`);
        saveSVG(polySet, "oblong.svg");
    });
    it('Standard Polygon Aperture Tests', () => {
        let aperture = new pr.ApertureDefinition(10, "P", [10, 3, 45, 3]);
        assert.equal(aperture.isMacro(), false);
        let polySet = aperture.toPolygonSet();
        assert.equal(polySet.length, 2);
        assert.equal(polySet[0].length, 4);
        saveSVG(polySet, "polygon3.svg");
        //console.log(`P poly set ${polySet}`);
    });
});